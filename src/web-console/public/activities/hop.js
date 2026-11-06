// Plan2Code Web Console - Crossing Rush, the tenth activity: the lanes, the hoppers and their hops and pickups, the rivals' planner, the zones and the game contract.
//
// The Activities window (screens/activities.js) drives everything: it ticks
// the game, hands it keys (and their releases) and pauses it. A game never
// runs a timer or listens for a key of its own, so a paused game cannot move.
// The rules are plain functions over a round object (newRound, newHeat,
// buildLanes, advance, hop, laneAt, occupied, sendBack, usePower, plan,
// applyPower), exported so the unit suite can drive them without a canvas;
// the drawing lives in hop-draw.js, and the default export is the contract
// every listed game answers.
//
// A strip of lanes eleven cells wide and taller than the board, a pavement at
// the bottom and the finish at the top. Planny and two rival hoppers race up
// it a cell a hop: roads of cars and trucks, rivers of logs and turtles to
// ride, train tracks that flash before a train, and grass with bushes and
// rocks in the way. A car, a train or the water sends a hopper back down to
// the last grass row, never out, so every heat ends with someone at the top,
// and leaves it dazed there for a moment before it may hop again. Pickups on
// the grass stack up, and space uses them one at a time in the order you got
// them (none carries over to the next heat). First to the top wins the heat and moves on a zone; second or third costs
// one of three lives and runs the heat again (in the first two zones second
// place still gets through). The nine zones bring something new each, and
// past the ninth Rush Hour repeats, quicker each time. The memo keeps the
// furthest zone ever reached.

import { DANGER, GOLD, drawScene, readColors, zoneColor } from "./hop-draw.js";

// The strip: COLS cells across, VIEW_ROWS of them on the board at once (a
// zone is taller, and the view follows you), each CELL units square. Above
// it a strip for the pills, and beside it the race bar. The canvas scales a
// unit in quarter-pixel steps.
export const COLS = 11;
export const VIEW_ROWS = 14;
export const CELL = 6;
export const FIELD_W = COLS * CELL;
export const FIELD_H = VIEW_ROWS * CELL;
// The strip is one row of pills tall (the draw file's hudLayout shrinks the
// pills to keep them in one row), and the field runs to the canvas's edges
// with no frame, so the play gets the room.
export const HUD_H = 4.5;
export const PAD = 0;
// The gap between the field and the bar beside it.
export const GAP = 1;
export const BAR_W = 7;
export const W = PAD * 2 + FIELD_W + GAP + BAR_W;
export const H = HUD_H + FIELD_H + PAD;

// Below this many pixels a unit, the board is too small to play: resize()
// says so and the window shows its bigger-window note.
export const MIN_CELL = 3;

// A hop takes HOP_MS, a Spring hop of two cells SPRING_MS. For its first
// half a hopper still counts as in the cell it left, for the second as in the
// one it lands on. A hopper is BODY cells either side of its center.
export const HOP_MS = 120;
const HALF_MS = HOP_MS / 2;
export const SPRING_MS = HOP_MS * 1.5;
export const BODY = 0.3;
// A hopper stands on a log or a turtle while its center is no further than
// GRIP past an end.
const GRIP = 0.15;

// Hit or in the water, a hopper flies back down to the last grass row for
// SENDBACK_MS, then stands there dazed for DAZE_MS before it may hop again.
// A Shield lets cars and trains through for SHIELD_MS; a car or a train still
// on the hopper keeps it from running below GRACE_HOLD_MS, so a slow truck
// cannot send it back as the Shield runs out under it.
export const SENDBACK_MS = 400;
export const DAZE_MS = 2000;
export const SHIELD_MS = 3000;
export const GRACE_HOLD_MS = HOP_MS;

// Cars and logs wrap round a lane MARGIN cells longer than the board each
// side, so nothing pops in or out on screen.
export const MARGIN = 4.5;

// The trains: a warning for WARN_MS (the lane flashes and the bell rings),
// then a TRAIN_LEN train across the whole lane in PASS_MS, then a quiet spell
// of IDLE_MS give or take IDLE_SPREAD_MS.
export const WARN_MS = 1200;
export const PASS_MS = 600;
export const TRAIN_LEN = 18;
export const TRAIN_SPEED = ((COLS + TRAIN_LEN) * 1000) / PASS_MS;
const IDLE_MS = 3000;
const IDLE_SPREAD_MS = 3500;

// Diving turtles: up for TURTLE_UP_MS, sinking (still standing room, and
// blinking) for TURTLE_SINK_MS, under for TURTLE_UNDER_MS.
export const TURTLE_UP_MS = 3000;
export const TURTLE_SINK_MS = 900;
export const TURTLE_UNDER_MS = 1300;
const TURTLE_CYCLE = TURTLE_UP_MS + TURTLE_SINK_MS + TURTLE_UNDER_MS;

// A Highway lane that surges switches between SURGE_SLOW and SURGE_FAST of
// its speed every SURGE_MS; a Rapids lane flips its flow every FLIP_MS.
export const SURGE_MS = 2400;
export const SURGE_SLOW = 0.6;
export const SURGE_FAST = 1.45;
export const FLIP_MS = 5200;

// A Horn stops the cars in the nearest road for HORN_MS.
export const HORN_MS = 1500;

// A heat holds still for READY_MS so everyone can see the lanes (the first
// one only briefly: the window has just counted 3, 2, 1), and shows how it
// went for DONE_MS before the next. A heat still going at HEAT_CAP_MS is lost.
export const READY_MS = 1400;
const FIRST_READY_MS = 300;
export const DONE_MS = 1900;
export const HEAT_CAP_MS = 150000;

export const START_LIVES = 3;
export const MAX_ZONE = 9;
// Up to this zone, second place still gets through (no life lost, no win).
export const PASS_ZONE = 2;

// Points: PROGRESS_POINTS for each row higher than you had got this heat, a
// heat won WIN_POINTS times the zone (times the streak of clean wins, wins
// with no send-back, up to MAX_STREAK) plus LEAD_POINTS for each row the
// runner-up still had to go, CLOSE_POINTS for a car through the cell you just
// left within CLOSE_MS, and COIN_POINTS a coin.
export const PROGRESS_POINTS = 1;
export const WIN_POINTS = 50;
export const LEAD_POINTS = 3;
export const CLOSE_POINTS = 5;
export const CLOSE_MS = 100;
export const COIN_POINTS = 10;
export const MAX_STREAK = 3;

// A rival waits REACT_MS after a landing at sharpness 0, REACT_FAST_MS at 1
// (times its pace), and looks LOOKAHEAD hops ahead, LOOKAHEAD_SHARP at 1.
// Waiting, it looks again every WAIT_MS. A sloppy one, up to MISTAKE of its
// choices, hops on regardless.
export const REACT_MS = 420;
const REACT_FAST_MS = 150;
export const LOOKAHEAD = 2;
export const LOOKAHEAD_SHARP = 5;
const WAIT_MS = HOP_MS;
const MISTAKE = 0.06;

// Time is handed to the hoppers and the lanes in slices this long.
const SLICE_MS = 8;

const deepFreeze = (o) => Object.freeze(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Object.freeze(Array.isArray(v.rivals) ? { ...v, rivals: Object.freeze([...v.rivals]) } : v)])));

// The pickups, sitting on grass rows. `weight` is how often each turns up
// against the others. A coin scores at once; the others go in your stack for
// space to use, oldest first (a rival uses one the moment it lands on it).
export const POWERS = deepFreeze({
  spring: { name: "Spring", blurb: "Leap two cells the way you face", color: "#57b54a", weight: 2 },
  shield: { name: "Shield", blurb: `Cars and trains pass through you for ${SHIELD_MS / 1000} s`, color: "#1fb6d9", weight: 2 },
  coin: { name: "Coin", blurb: `${COIN_POINTS} points`, color: GOLD, weight: 2 },
  horn: { name: "Horn", blurb: "The nearest road stops for a moment", color: "#ff8a1f", weight: 2 },
});

// The rivals, each a small animal with a way of crossing: `pace` scales its
// wait after a landing, `margin` how much room it leaves a car (in cells),
// `tail` how far past its plan it checks the cell it ends on (in half hops),
// `safe` how much it likes to stop on grass and `slips` its share of mistakes.
export const RIVALS = deepFreeze({
  hopper: { name: "Hopper", blurb: "Safe and steady: waits for a clear gap", pace: 1.15, margin: 0.3, tail: 3, safe: 6, slips: 0.4 },
  daredevil: { name: "Daredevil", blurb: "Takes the tight gaps, and sometimes pays", pace: 0.8, margin: 0.02, tail: 0, safe: 0, slips: 1.6 },
  bruiser: { name: "Bruiser", blurb: "Quick and pushy: barges through tight gaps", pace: 0.9, margin: 0.08, tail: 1, safe: 1, slips: 1 },
  tagalong: { name: "Tagalong", blurb: "Follows you up, then races you to the top", pace: 0.9, margin: 0.15, tail: 1, safe: 2, slips: 1 },
});

// Each zone: its rivals, how sharp they are (0 to 1), its rows (start and
// finish included), car and river speeds in cells a second, the shortest gap
// between cars, the gaps between logs, the kind of group that shows its new
// thing (`feature`, always the first), how often each kind of group turns up
// after it, and the most bushes and rocks on a grass row.
export const ZONES = deepFreeze({
  1: { title: "Side Street", sub: "Hop the traffic to the top", rivals: ["hopper", "daredevil"], smart: 0.1, rows: 30, car: [1.5, 2.1], gap: 3, river: [1, 1.4], logGap: [1.2, 2.4], feature: "road", groups: { road: 1 }, trees: 2 },
  2: { title: "Riverside", sub: "Ride the logs across the river", rivals: ["hopper", "daredevil"], smart: 0.18, rows: 32, car: [1.6, 2.4], gap: 3, river: [1, 1.5], logGap: [1.2, 2.4], feature: "river", groups: { road: 2, river: 2 }, trees: 2 },
  3: { title: "Rail Yard", sub: "Red lights mean a train", rivals: ["hopper", "daredevil"], smart: 0.26, rows: 34, car: [1.7, 2.6], gap: 2.8, river: [1.1, 1.6], logGap: [1.2, 2.5], feature: "rail", groups: { road: 3, river: 2, rail: 2 }, trees: 3 },
  4: { title: "Turtle Bay", sub: "Turtles dive now and then", rivals: ["hopper", "daredevil"], smart: 0.34, rows: 34, car: [1.8, 2.8], gap: 2.6, river: [1.1, 1.7], logGap: [1.2, 2.6], feature: "turtles", groups: { road: 3, river: 2, rail: 1, turtles: 2 }, trees: 3 },
  5: { title: "Highway", sub: "Trucks, and lanes that speed up", rivals: ["bruiser", "daredevil"], smart: 0.44, rows: 36, car: [2, 3], gap: 2.5, river: [1.2, 1.8], logGap: [1.3, 2.7], feature: "highway", groups: { road: 2, highway: 2, river: 2, rail: 1, turtles: 1 }, trees: 3 },
  6: { title: "Night Market", sub: "Dusk falls: watch for headlights", rivals: ["hopper", "bruiser"], smart: 0.54, rows: 36, car: [2, 3.1], gap: 2.4, river: [1.2, 1.8], logGap: [1.3, 2.7], feature: "road", groups: { road: 3, highway: 1, river: 2, rail: 1, turtles: 1 }, trees: 3, dark: true },
  7: { title: "Rapids", sub: "Rivers that turn round", rivals: ["tagalong", "daredevil"], smart: 0.64, rows: 38, car: [2.1, 3.2], gap: 2.3, river: [1.3, 1.9], logGap: [1.3, 2.8], feature: "rapids", groups: { road: 3, highway: 1, river: 1, rapids: 2, rail: 1, turtles: 1 }, trees: 3 },
  8: { title: "Ice Road", sub: "Icy lanes slide you a cell on", rivals: ["bruiser", "tagalong"], smart: 0.76, rows: 38, car: [2.2, 3.3], gap: 2.2, river: [1.3, 1.9], logGap: [1.3, 2.8], feature: "ice", groups: { road: 2, highway: 1, ice: 2, river: 1, rapids: 1, rail: 1, turtles: 1 }, trees: 4 },
  9: { title: "Rush Hour", sub: "Everything, and tighter gaps", rivals: ["daredevil", "bruiser"], smart: 0.9, rows: 40, car: [2.5, 3.6], gap: 2, river: [1.4, 2], logGap: [1.4, 3], feature: "highway", groups: { road: 2, highway: 2, ice: 1, river: 1, rapids: 1, rail: 2, turtles: 1 }, trees: 4 },
});

// Zones past the ninth are Rush Hour again, named Rush Hour 2, 3 and on, the
// traffic and the water a little quicker each time; their rivals take turns.
// The rules ask for a zone many times a slice, so each one is built once.
const EXTRA = new Map();
const LATE_RIVALS = Object.freeze([Object.freeze(["daredevil", "bruiser"]), Object.freeze(["tagalong", "daredevil"]), Object.freeze(["bruiser", "tagalong"])]);
export function zoneFor(level) {
  const n = Math.max(1, Math.floor(level) || 1);
  if (n <= MAX_ZONE) return ZONES[n];
  if (!EXTRA.has(n)) {
    const extra = n - MAX_ZONE;
    const last = ZONES[MAX_ZONE];
    const pace = 1 + Math.min(0.3, extra * 0.05);
    EXTRA.set(
      n,
      Object.freeze({
        ...last,
        title: `Rush Hour ${extra + 1}`,
        sub: "Quicker traffic, quicker water",
        rivals: LATE_RIVALS[extra % LATE_RIVALS.length],
        car: Object.freeze(last.car.map((v) => v * pace)),
        river: Object.freeze(last.river.map((v) => v * Math.min(1.15, pace))),
        pace,
      }),
    );
  }
  return EXTRA.get(n);
}

// How each rival plays at a zone: its lookahead, its wait after a landing
// (in ms and in half hops), its margin, its tail check, its liking for grass
// and its odds of a mistake. Asked for at every choice, so each zone's is
// built once.
const POWER_AT = new Map();
export function rivalPower(level) {
  const spec = zoneFor(level);
  if (!POWER_AT.has(spec)) {
    const s = spec.smart;
    const out = {};
    for (const [kind, r] of Object.entries(RIVALS)) {
      const reactMs = (REACT_MS - (REACT_MS - REACT_FAST_MS) * s) * r.pace;
      out[kind] = Object.freeze({
        kind,
        smart: s,
        depth: Math.round(LOOKAHEAD + (LOOKAHEAD_SHARP - LOOKAHEAD) * s),
        reactMs,
        react: Math.max(1, Math.round(reactMs / HALF_MS)),
        margin: r.margin,
        tail: r.tail,
        safe: r.safe,
        mistake: (1 - s) * MISTAKE * r.slips,
        noise: (1 - s) * 6,
        tag: kind === "tagalong",
      });
    }
    POWER_AT.set(spec, Object.freeze(out));
  }
  return POWER_AT.get(spec);
}

// The way the scratch sims (and a test) drive you with the planner: sharp,
// quick and careful.
export const SHARP_POWER = Object.freeze({ kind: "planny", smart: 1, depth: 5, reactMs: HALF_MS, react: 1, margin: 0.1, tail: 2, safe: 2, mistake: 0, noise: 0, tag: false });

// The rivals' colors, one per kind in RIVALS order, kept apart from the
// lanes and from each other.
export const RIVAL_COLORS = Object.freeze(["#ff8a1f", "#ff4fa3", "#a466ff", "#b07a45"]);
const RIVAL_KINDS = Object.freeze(Object.keys(RIVALS));

// Your color is the page's highlight, any of many, so a rival's can land
// next to it. A rival color nearer yours than NEAR_COLOR (a distance in RGB)
// gives way to the spare that stands furthest from yours and from every
// other rival's.
export const SPARE_COLORS = Object.freeze(["#c7d63a", "#5c6b8a", "#e8e2d0"]);
export const NEAR_COLOR = 70;

// "#rgb", "#rrggbb" or "rgb(r, g, b)" as [r, g, b]; null for anything else.
function rgbOf(color) {
  const c = String(color || "").trim();
  let m = /^#([0-9a-f]{3})$/i.exec(c);
  if (m) return [...m[1]].map((h) => parseInt(h + h, 16));
  m = /^#([0-9a-f]{6})$/i.exec(c);
  if (m) return [0, 2, 4].map((k) => parseInt(m[1].slice(k, k + 2), 16));
  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(c);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

const colorGap = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// The rivals' colors in RIVALS order with yours as `you`: RIVAL_COLORS, but
// any too near yours swapped for a spare. A color it cannot read keeps them all.
export function rivalColors(you) {
  const out = [...RIVAL_COLORS];
  const mine = rgbOf(you);
  if (!mine) return out;
  for (let k = 0; k < out.length; k++) {
    if (colorGap(rgbOf(out[k]), mine) >= NEAR_COLOR) continue;
    let best = out[k];
    let bestGap = -1;
    for (const spare of SPARE_COLORS) {
      if (out.includes(spare)) continue;
      const rgb = rgbOf(spare);
      let gap = colorGap(rgb, mine);
      for (let j = 0; j < out.length; j++) if (j !== k) gap = Math.min(gap, colorGap(rgb, rgbOf(out[j])));
      if (gap > bestGap) {
        bestGap = gap;
        best = spare;
      }
    }
    out[k] = best;
  }
  return out;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// A small seeded random source, so a zone's lanes come out the same from the
// same seed.
function rngOf(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* -------------------------------------------------------------- lanes */

const SAFE_KINDS = Object.freeze({ start: true, grass: true, goal: true });
export const isSafe = (lane) => Boolean(lane && SAFE_KINDS[lane.kind]);

function makeLane(kind, row) {
  return {
    kind,
    row,
    dir: 1,
    speed: 0,
    shift: 0,
    drift: 0,
    items: [],
    span: COLS + MARGIN * 2,
    trees: new Array(COLS).fill(0),
    icy: false,
    surge: 0,
    surgeIn: 0,
    fast: false,
    flip: 0,
    flipIn: 0,
    stop: 0,
    phase: "idle",
    phaseMs: 0,
    nextIdle: 0,
    seed: 0,
  };
}

const between = (rng, [lo, hi]) => lo + (hi - lo) * rng();

// Lays a lane's cars or floats along it: one from `make` after another, each
// followed by a gap from `gap`, until the lane is longer than the board and
// both margins. The last gap wraps round to the first, so every gap keeps to
// its range.
function fill(lane, rng, make, gap) {
  let p = 0;
  while (p < COLS + MARGIN * 2) {
    const it = make();
    it.p = p;
    lane.items.push(it);
    p += it.len + gap();
  }
  lane.span = p;
  lane.shift = rng() * p;
}

const item = (kind, len, tint) => ({ kind, p: 0, len, tint, dive: false, phase: 0 });

function roadLane(lane, spec, rng, opts) {
  lane.kind = "road";
  lane.speed = between(rng, spec.car) * (opts.icy ? 0.85 : 1);
  lane.icy = Boolean(opts.icy);
  if (opts.surge) {
    lane.surge = SURGE_MS;
    lane.surgeIn = rng() * SURGE_MS;
    lane.fast = rng() < 0.5;
    lane.speed = Math.min(lane.speed, spec.car[1] / SURGE_FAST * 1.15);
  }
  const trucks = opts.trucks || 0;
  fill(
    lane,
    rng,
    () => {
      const roll = rng();
      if (roll < trucks) return item("truck", 3, Math.floor(rng() * 4));
      return roll < trucks + (1 - trucks) * 0.3 ? item("van", 2, Math.floor(rng() * 6)) : item("car", 1.2, Math.floor(rng() * 6));
    },
    () => spec.gap + rng() * 2 + (trucks ? 0.5 : 0),
  );
}

function riverLane(lane, spec, rng, opts) {
  lane.kind = "river";
  lane.speed = between(rng, spec.river);
  if (opts.flip) {
    lane.flip = FLIP_MS;
    lane.flipIn = FLIP_MS * (0.4 + 0.6 * rng());
  }
  if (opts.turtles) {
    let first = true;
    fill(
      lane,
      rng,
      () => {
        const it = item("turtle", rng() < 0.5 ? 2 : 3, 0);
        // At least the first group in a lane never dives, so there is always
        // a way across.
        it.dive = !first && rng() < 0.6;
        it.phase = rng() * TURTLE_CYCLE;
        first = false;
        return it;
      },
      () => 1 + rng() * 1.3,
    );
    return;
  }
  fill(
    lane,
    rng,
    () => item("log", [2.5, 3, 3, 4][Math.floor(rng() * 4)], Math.floor(rng() * 3)),
    () => between(rng, spec.logGap),
  );
}

function railLane(lane, rng) {
  lane.kind = "rail";
  lane.seed = Math.floor(rng() * 4294967296) >>> 0;
  lane.phase = "idle";
  lane.phaseMs = 800 + rng() * (IDLE_MS + IDLE_SPREAD_MS);
  lane.nextIdle = rollIdle(lane);
}

// The quiet spell after the next train, from the lane's own seed, so a
// lane's trains come the same way every time it is built from a seed.
function rollIdle(lane) {
  lane.seed = (Math.imul(lane.seed, 1103515245) + 12345) >>> 0;
  return IDLE_MS + (lane.seed / 4294967296) * IDLE_SPREAD_MS;
}

function grassLane(lane, spec, rng) {
  lane.kind = "grass";
  const n = Math.floor(rng() * (spec.trees + 1));
  for (let k = 0; k < n; k++) lane.trees[Math.floor(rng() * COLS)] = rng() < 0.6 ? 1 : 2;
}

// A group of lanes of one kind, `n` of them, flowing each way in turn.
function group(lanes, kind, n, spec, rng) {
  let dir = rng() < 0.5 ? 1 : -1;
  for (let k = 0; k < n; k++) {
    const lane = makeLane("road", lanes.length);
    lane.dir = dir;
    dir = -dir;
    if (kind === "road") roadLane(lane, spec, rng, { trucks: spec.pace || spec.feature === "highway" ? 0.15 : 0, surge: false, icy: false });
    else if (kind === "highway") roadLane(lane, spec, rng, { trucks: 0.45, surge: k === 0 || rng() < 0.35 });
    else if (kind === "ice") roadLane(lane, spec, rng, { icy: true });
    else if (kind === "river") riverLane(lane, spec, rng, {});
    else if (kind === "turtles") riverLane(lane, spec, rng, { turtles: k % 2 === 0 });
    else if (kind === "rapids") riverLane(lane, spec, rng, { flip: k === 0 || rng() < 0.4 });
    else railLane(lane, rng);
    lanes.push(lane);
  }
}

const GROUP_SIZES = Object.freeze({ road: [2, 4], highway: [2, 4], ice: [2, 3], river: [2, 3], turtles: [2, 3], rapids: [2, 3], rail: [1, 1] });

function pickGroup(spec, rng) {
  const kinds = Object.keys(spec.groups);
  const total = kinds.reduce((sum, k) => sum + spec.groups[k], 0);
  let roll = rng() * total;
  for (const k of kinds) {
    roll -= spec.groups[k];
    if (roll < 0) return k;
  }
  return kinds[kinds.length - 1];
}

// A zone's lanes from `seed`, row 0 (the pavement you start on) up to the
// finish: groups of lanes of one kind, a grass row between each two, the
// zone's new thing in the first group. The same seed builds the same lanes.
export function buildLanes(zone, seed = 1) {
  const spec = zoneFor(zone);
  const rng = rngOf(seed);
  const rows = spec.rows;
  const lanes = [makeLane("start", 0)];
  let first = true;
  while (lanes.length < rows - 1) {
    const kind = first ? spec.feature : pickGroup(spec, rng);
    const [lo, hi] = GROUP_SIZES[kind];
    // The first zone keeps its groups to three lanes.
    const most = zone <= 1 ? Math.min(hi, 3) : hi;
    const n = Math.min(lo + Math.floor(rng() * (most - lo + 1)), rows - 1 - lanes.length);
    group(lanes, kind, n, spec, rng);
    first = false;
    if (lanes.length < rows - 1) {
      const lane = makeLane("grass", lanes.length);
      grassLane(lane, spec, rng);
      lanes.push(lane);
    }
  }
  lanes.push(makeLane("goal", lanes.length));
  return lanes;
}

export const laneAt = (round, row) => (row >= 0 && row < round.lanes.length ? round.lanes[row] : null);

// A lane's speed right now, with its direction: zero while a Horn holds it.
function velocity(lane, dir, fast, stop) {
  if (stop > 0 || !lane.speed) return 0;
  return dir * lane.speed * (lane.surge ? (fast ? SURGE_FAST : SURGE_SLOW) : 1);
}

// Runs a lane's flow on by `ms` in `s`, which is the lane itself or a copy of
// its moving parts: the Horn running out, a Rapids lane flipping, a Highway
// lane surging, each at its exact moment.
function flow(lane, s, ms) {
  let left = ms;
  while (left > 1e-9) {
    let step = left;
    if (s.stop > 0) step = Math.min(step, s.stop);
    if (lane.flip) step = Math.min(step, s.flipIn);
    if (lane.surge) step = Math.min(step, s.surgeIn);
    s.shift += (velocity(lane, s.dir, s.fast, s.stop) * step) / 1000;
    left -= step;
    if (s.stop > 0) s.stop = Math.max(0, s.stop - step);
    if (lane.flip) {
      s.flipIn -= step;
      if (s.flipIn <= 1e-9) {
        s.flipIn = lane.flip;
        s.dir = -s.dir;
      }
    }
    if (lane.surge) {
      s.surgeIn -= step;
      if (s.surgeIn <= 1e-9) {
        s.surgeIn = lane.surge;
        s.fast = !s.fast;
      }
    }
  }
}

const AHEAD = { shift: 0, dir: 1, fast: false, stop: 0, flipIn: 0, surgeIn: 0 };

// Where a lane's flow will have got to `ms` from now, its flips, surges and
// a Horn included, without moving it.
export function shiftAt(lane, ms) {
  if (!ms) return lane.shift;
  AHEAD.shift = lane.shift;
  AHEAD.dir = lane.dir;
  AHEAD.fast = lane.fast;
  AHEAD.stop = lane.stop;
  AHEAD.flipIn = lane.flipIn;
  AHEAD.surgeIn = lane.surgeIn;
  flow(lane, AHEAD, ms);
  return AHEAD.shift;
}

// The left edge of a car or a float on screen, in columns (column c's
// center is c), at a lane flow of `shift`.
export const itemX = (lane, it, shift) => ((((it.p + shift) % lane.span) + lane.span) % lane.span) - MARGIN;

// A diving turtle's state at `clock`: 0 up, 1 sinking (still standing
// room), 2 under.
export function turtleState(it, clock) {
  if (!it.dive) return 0;
  const c = (((clock + it.phase) % TURTLE_CYCLE) + TURTLE_CYCLE) % TURTLE_CYCLE;
  return c < TURTLE_UP_MS ? 0 : c < TURTLE_UP_MS + TURTLE_SINK_MS ? 1 : 2;
}

const RAIL = { phase: "idle", elapsed: 0 };

// A train lane's phase `ms` from now, and how far into it (in RAIL). Past the
// quiet spell after the next train it guesses the shortest.
function railAt(lane, ms) {
  let phase = lane.phase;
  let left = lane.phaseMs;
  let t = ms;
  let idle = lane.nextIdle;
  while (t >= left) {
    t -= left;
    if (phase === "idle") {
      phase = "warn";
      left = WARN_MS;
    } else if (phase === "warn") {
      phase = "pass";
      left = PASS_MS;
    } else {
      phase = "idle";
      left = idle;
      idle = IDLE_MS;
    }
  }
  RAIL.phase = phase;
  RAIL.elapsed = phase === "pass" ? PASS_MS - left + t : 0;
  return RAIL;
}

// Where the train is, as [lo, hi] in columns, `elapsed` ms into its pass.
export function trainSpan(lane, elapsed) {
  const f = (elapsed / 1000) * TRAIN_SPEED;
  return lane.dir > 0 ? [-0.5 + f - TRAIN_LEN, -0.5 + f] : [COLS - 0.5 - f, COLS - 0.5 - f + TRAIN_LEN];
}

function trainCovers(lane, ms, lo, hi) {
  const at = railAt(lane, ms);
  if (at.phase !== "pass") return false;
  const [a, b] = trainSpan(lane, at.elapsed);
  return a < hi && b > lo;
}

// True when a car or a train in a road or a train lane covers a hopper
// centered at `x` at a lane flow of `shift`, `ms` from now, `margin` cells to
// spare.
function hitIn(lane, x, ms, shift, margin) {
  const lo = x - BODY - margin;
  const hi = x + BODY + margin;
  if (lane.kind === "rail") return trainCovers(lane, ms, lo, hi);
  if (lane.kind !== "road") return false;
  for (const it of lane.items) {
    const a = itemX(lane, it, shift);
    if (a < hi && a + it.len > lo) return true;
  }
  return false;
}

// True when a log or a turtle up out of the water holds up a hopper centered
// at `x` at a lane flow of `shift` and `clock`; `margin` cells in from the
// ends, and a careful one (`margin` past 0.1) never trusts a sinking turtle.
function floatIn(lane, x, shift, clock, margin) {
  for (const it of lane.items) {
    if (it.dive) {
      const st = turtleState(it, clock);
      if (st === 2 || (st === 1 && margin > 0.1)) continue;
    }
    const a = itemX(lane, it, shift);
    if (x >= a - GRIP + margin && x <= a + it.len + GRIP - margin) return true;
  }
  return false;
}

const onBoard = (x) => x >= -0.5 && x <= COLS - 0.5;

// True when a hopper standing at `col` (a column, whole or not: column c's
// center is c) of `row` would be sent back `atMs` from now: a car or a train
// on it, or, in a river, nothing to stand on or the board's edge.
export function occupied(round, row, col, atMs = 0) {
  const lane = laneAt(round, row);
  if (!lane) return false;
  if (lane.kind === "river") return !onBoard(col) || !floatIn(lane, col, shiftAt(lane, atMs), round.clock + atMs, 0);
  return hitIn(lane, col, atMs, shiftAt(lane, atMs), 0);
}

/* ------------------------------------------------------------- hoppers */

// Where each hopper starts on the pavement: you in the middle.
const SPAWN = Object.freeze([5, 2, 8]);

function makeHopper(id, kind, col) {
  return {
    id,
    kind,
    row: 0,
    x: col,
    face: "up",
    hop: null,
    queued: null,
    daze: 0,
    back: null,
    furthest: 0,
    shield: 0,
    blocked: false,
    spring: false,
    powers: [],
    finished: false,
    finishAt: 0,
    place: 0,
    backs: 0,
    think: 0,
  };
}

const STEP = Object.freeze({ up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] });
export const DIRS = Object.freeze(["up", "left", "right", "down"]);

// Out of play: home, or flying back down.
const away = (h) => h.finished || Boolean(h.back);

const TARGET = { row: 0, x: 0 };

// The cell a hop `cells` long goes to from (row, x), into `out`: false when
// it would leave the board or land on a bush or a rock. Sideways on a river
// a hopper keeps its place on its log; onto land it lands on the nearest
// whole column.
export function target(round, row, x, dir, out = TARGET, cells = 1) {
  const [dx, dy] = STEP[dir];
  const nr = row + dy * cells;
  const lane = laneAt(round, nr);
  if (!lane) return false;
  let nx = x + dx * cells;
  if (lane.kind === "river") {
    if (!onBoard(nx)) return false;
  } else {
    nx = Math.round(nx);
    if (nx < 0 || nx > COLS - 1) return false;
    if (lane.trees[nx]) return false;
  }
  out.row = nr;
  out.x = nx;
  return true;
}

// Starts a hop: one cell `dir`, two with a Spring (one when the second is
// shut). False, a bump and nothing more, when the way is shut, and false
// when the hopper is busy (hopping, dazed, flying back or home) or the heat
// is not on.
export function hop(round, h, dir) {
  if (round.phase !== "play" || away(h) || h.hop || h.daze > 0 || !STEP[dir]) return false;
  h.face = dir;
  let spring = false;
  if (h.spring && target(round, h.row, h.x, dir, TARGET, 2)) spring = true;
  else if (!target(round, h.row, h.x, dir, TARGET, 1)) {
    round.events.push({ type: "bonk", id: h.id, row: h.row, x: h.x });
    return false;
  }
  if (spring) h.spring = false;
  h.hop = { kind: spring ? "spring" : "hop", dir, fromRow: h.row, fromX: h.x, toRow: TARGET.row, toX: TARGET.x, ms: 0, max: spring ? SPRING_MS : HOP_MS, half: false };
  round.events.push({ type: "hop", id: h.id, dir, spring, forward: TARGET.row > h.row, row: h.row, x: h.x });
  return true;
}

// The highest grass row (or the pavement) at or below `row`.
export function safeBelow(round, row) {
  for (let r = Math.min(row, round.lanes.length - 1); r > 0; r--) if (isSafe(round.lanes[r]) && round.lanes[r].kind !== "goal") return r;
  return 0;
}

// The open column of `row` nearest `x`.
function openCol(round, row, x) {
  const lane = round.lanes[row];
  const c0 = clamp(Math.round(x), 0, COLS - 1);
  for (let d = 0; d < COLS; d++) {
    for (const c of [c0 - d, c0 + d]) if (c >= 0 && c < COLS && !lane.trees[c]) return c;
  }
  return c0;
}

// Sends a hopper back down to the last grass row, flying for SENDBACK_MS:
// hit by a car (`cause` "car") or a train, in the water ("splash") or off the
// edge on a log ("swept"). It lands dazed (runBack). Returns false for one
// already flying back or home.
export function sendBack(round, h, cause = "car") {
  if (away(h)) return false;
  const toRow = safeBelow(round, h.row);
  const toX = openCol(round, toRow, h.x);
  h.back = { cause, fromRow: h.row, fromX: h.x, toRow, toX, ms: 0, max: SENDBACK_MS };
  h.hop = null;
  h.queued = null;
  h.daze = 0;
  h.backs += 1;
  if (h.id === 0) round.clean = false;
  round.events.push({ type: "back", id: h.id, cause, row: h.row, x: h.x });
  return true;
}

// A hit by a car or a train: a Shield lets it through (held on while
// whatever hit is still on the hopper), else back down.
function hit(round, h, cause) {
  if (h.shield > 0) {
    h.shield = Math.max(h.shield, GRACE_HOLD_MS);
    if (!h.blocked) {
      h.blocked = true;
      round.events.push({ type: "shield", id: h.id, row: h.row, x: h.x });
    }
    return;
  }
  sendBack(round, h, cause);
}

/* -------------------------------------------------------------- pickups */

// The road nearest the hopper (the one above on a tie) stops for HORN_MS.
function sound(round, h) {
  let best = null;
  for (const lane of round.lanes) {
    if (lane.kind !== "road") continue;
    const d = Math.abs(lane.row - h.row) - (lane.row > h.row ? 0.1 : 0);
    if (!best || d < best.d) best = { lane, d };
  }
  if (!best) return;
  best.lane.stop = HORN_MS;
  round.events.push({ type: "horn", id: h.id, row: best.lane.row });
}

// A pickup landed on: a coin scores at once; anything else goes on the end
// of your stack, or a rival uses it on the spot (a Spring then waits for its
// next hop).
export function applyPower(round, h, kind) {
  if (!POWERS[kind]) return false;
  if (kind === "coin") {
    if (h.id === 0) {
      round.score += COIN_POINTS;
      round.coins += 1;
    }
  } else if (h.id === 0) h.powers.push(kind);
  else if (kind === "spring") h.spring = true;
  else if (kind === "shield") {
    h.shield = SHIELD_MS;
    h.blocked = false;
  } else if (kind === "horn") sound(round, h);
  round.events.push({ type: "power", id: h.id, kind, row: h.row, x: h.x });
  return true;
}

// Space: the oldest pickup in the stack goes off. A Spring leaps two cells
// the way you face, and stays in the stack (a bump) when that cell is shut; a
// Shield goes up for SHIELD_MS; a Horn stops the nearest road. Mid-hop it
// waits for the landing (one wait at a time, like a queued hop). False when
// the stack is empty, the hopper is dazed or out of play, or the heat is not
// on.
export function usePower(round, h) {
  if (round.phase !== "play" || away(h) || h.daze > 0 || !h.powers.length) return false;
  if (h.hop) {
    h.queued = "power";
    return true;
  }
  const kind = h.powers[0];
  if (kind === "spring") {
    if (!target(round, h.row, h.x, h.face, TARGET, 2)) {
      round.events.push({ type: "bonk", id: h.id, row: h.row, x: h.x });
      return false;
    }
    h.powers.shift();
    h.spring = true;
    hop(round, h, h.face);
  } else {
    h.powers.shift();
    if (kind === "shield") {
      h.shield = SHIELD_MS;
      h.blocked = false;
    } else sound(round, h);
  }
  if (h.id === 0) round.powersUsed += 1;
  round.events.push({ type: "use", id: h.id, kind, row: h.row, x: h.x });
  return true;
}

function pickPower(random) {
  const kinds = Object.keys(POWERS);
  const total = kinds.reduce((sum, k) => sum + POWERS[k].weight, 0);
  let roll = random() * total;
  for (const k of kinds) {
    roll -= POWERS[k].weight;
    if (roll < 0) return k;
  }
  return kinds[kinds.length - 1];
}

// PICKUPS to PICKUPS_MORE pickups on open grass cells, each on a grass row of
// its own while there are rows to spare, so they are spread up the zone.
export const PICKUPS = 4;
const PICKUPS_MORE = 6;
function placePickups(round, random) {
  round.pickups = [];
  const rows = round.lanes.filter((l) => l.kind === "grass").map((l) => l.row);
  if (!rows.length) return;
  const n = PICKUPS + Math.floor(random() * (PICKUPS_MORE - PICKUPS + 1));
  for (let k = 0; k < n; k++) {
    for (let tries = 0; tries < 30; tries++) {
      const row = rows[Math.floor(random() * rows.length) % rows.length];
      const x = Math.floor(random() * COLS) % COLS;
      if (round.lanes[row].trees[x] || round.pickups.some((p) => p.row === row && (p.x === x || tries < 20))) continue;
      round.pickups.push({ row, x, kind: pickPower(random) });
      break;
    }
  }
}

/* --------------------------------------------------------------- heats */

// A fresh heat at `zone`: its lanes from the round's seed (a heat run again
// keeps its lanes), you and the rivals on the pavement, a pickup or two. The
// traffic runs during the hold; nobody hops until it is over.
export function newHeat(round, zone = round.level, random = Math.random, readyMs = READY_MS) {
  round.level = Math.max(1, Math.floor(zone) || 1);
  const spec = zoneFor(round.level);
  round.lanes = buildLanes(round.level, round.seed);
  round.rows = round.lanes.length;
  round.dark = Boolean(spec.dark);
  const kinds = ["planny", ...spec.rivals];
  round.hoppers = kinds.map((kind, i) => makeHopper(i, kind, SPAWN[i % SPAWN.length]));
  placePickups(round, random);
  round.phase = "ready";
  round.phaseMs = readyMs;
  round.clock = 0;
  round.result = null;
  round.finishers = [];
  round.clean = true;
  round.close = null;
  round.order = 0;
  return round;
}

export function newRound(random = Math.random) {
  const round = {
    level: 1,
    lives: START_LIVES,
    score: 0,
    heatsWon: 0,
    streak: 0,
    bestStreak: 0,
    powersUsed: 0,
    closeCalls: 0,
    coins: 0,
    over: false,
    events: [],
    seed: Math.floor(random() * 2147483647),
    landed: [],
  };
  return newHeat(round, 1, random, FIRST_READY_MS);
}

// Points for rows higher than you had got this heat.
function climb(round, h) {
  if (h.row <= h.furthest) return;
  if (h.id === 0) round.score += (h.row - h.furthest) * PROGRESS_POINTS;
  h.furthest = h.row;
}

// A hop past its half: the hopper now counts as in the cell it lands on. For
// you, a car or a train through the cell just left in the next CLOSE_MS is a
// close call.
function halfway(round, h) {
  const p = h.hop;
  p.half = true;
  const from = round.lanes[p.fromRow];
  h.row = p.toRow;
  h.x = p.toX;
  climb(round, h);
  if (h.id === 0 && (from.kind === "road" || from.kind === "rail")) round.close = { row: p.fromRow, x: p.fromX, ms: CLOSE_MS };
}

// A hop come down `over` ms ago: the finish, a pickup, an icy lane's slide on
// a cell, and a rival's wait before its next choice.
function land(round, h, p, over) {
  const lane = round.lanes[h.row];
  if (lane.kind === "goal") {
    h.finished = true;
    h.finishAt = round.clock - over;
    round.landed.push(h);
    return;
  }
  const k = round.pickups.findIndex((q) => q.row === h.row && q.x === h.x);
  if (k >= 0) applyPower(round, h, round.pickups.splice(k, 1)[0].kind);
  if (lane.icy && p.kind !== "slide" && target(round, h.row, h.x, p.dir, TARGET, 1)) {
    h.hop = { kind: "slide", dir: p.dir, fromRow: h.row, fromX: h.x, toRow: TARGET.row, toX: TARGET.x, ms: over, max: HOP_MS, half: false };
    round.events.push({ type: "slide", id: h.id, row: h.row, x: h.x });
    return;
  }
  if (h.id !== 0) h.think = rivalPower(round.level)[h.kind].reactMs - over;
  round.events.push({ type: "land", id: h.id, row: h.row, x: h.x, kind: lane.kind });
}

// A hop or a slide run on by `ms`.
function runHop(round, h, ms) {
  const p = h.hop;
  p.ms += ms;
  if (!p.half && p.ms >= p.max / 2) halfway(round, h);
  if (p.ms < p.max) return;
  h.hop = null;
  land(round, h, p, p.ms - p.max);
}

// A flight back down run on by `ms`; at its end the hopper stands dazed on
// the grass row for DAZE_MS, the planner's wait starting over after it.
function runBack(round, h, ms) {
  const b = h.back;
  b.ms += ms;
  if (b.ms < b.max) return;
  h.back = null;
  h.row = b.toRow;
  h.x = b.toX;
  h.daze = DAZE_MS;
  h.think = h.id === 0 ? 0 : rivalPower(round.level)[h.kind].reactMs;
  round.events.push({ type: "home", id: h.id, row: h.row, x: h.x });
}

// What can send a hopper back where it counts as standing: a car or a train
// on its cell, and on a river (feet down: not mid-hop) the water or the edge.
function hazards(round, h) {
  if (away(h)) return;
  const lane = round.lanes[h.row];
  if (lane.kind === "road" || lane.kind === "rail") {
    if (hitIn(lane, h.x, 0, lane.shift, 0)) hit(round, h, lane.kind === "rail" ? "train" : "car");
    return;
  }
  if (lane.kind !== "river" || h.hop) return;
  if (!onBoard(h.x)) sendBack(round, h, "swept");
  else if (!floatIn(lane, h.x, lane.shift, round.clock, 0)) sendBack(round, h, "splash");
}

// A lane run on by `ms`: the traffic or the water flows; a train lane goes
// from quiet to warning to its train.
function runLane(round, lane, ms) {
  if (lane.kind === "rail") {
    lane.phaseMs -= ms;
    while (lane.phaseMs <= 0) {
      if (lane.phase === "idle") {
        lane.phase = "warn";
        lane.phaseMs += WARN_MS;
        round.events.push({ type: "warn", row: lane.row });
      } else if (lane.phase === "warn") {
        lane.phase = "pass";
        lane.phaseMs += PASS_MS;
        round.events.push({ type: "train", row: lane.row, dir: lane.dir });
      } else {
        lane.phase = "idle";
        lane.phaseMs += lane.nextIdle;
        lane.nextIdle = rollIdle(lane);
      }
    }
    return;
  }
  if (!lane.speed) return;
  const before = lane.shift;
  flow(lane, lane, ms);
  lane.drift = lane.shift - before;
}

// The order hoppers that got home in the same slice finish in: by the moment
// each landed, and a dead heat to you.
function byFinish(a, b) {
  return a.finishAt - b.finishAt || a.id - b.id;
}

function checkEnd(round) {
  if (round.phase !== "play") return;
  const you = round.hoppers[0];
  const pass = round.level <= PASS_ZONE;
  if (you.finished) {
    if (you.place === 1) endHeat(round, "win");
    else endHeat(round, you.place === 2 && pass ? "pass" : "lose");
  } else if (round.finishers.length >= (pass ? 2 : 1) || round.finishers.length >= round.hoppers.length - 1) endHeat(round, "lose");
  else if (round.clock >= HEAT_CAP_MS) endHeat(round, "lose");
}

// The rows the runner-up still had to go when you got home.
function leadOf(round) {
  let best = 0;
  for (const h of round.hoppers) if (h.id !== 0 && !h.finished) best = Math.max(best, h.row);
  return round.rows - 1 - best;
}

function endHeat(round, result) {
  round.phase = "done";
  round.phaseMs = DONE_MS;
  round.result = result;
  round.close = null;
  if (result === "win") {
    round.streak = round.clean ? Math.min(MAX_STREAK, round.streak + 1) : 0;
    round.bestStreak = Math.max(round.bestStreak, round.streak);
    const times = Math.max(1, round.streak);
    const lead = leadOf(round);
    const points = WIN_POINTS * round.level * times + LEAD_POINTS * lead;
    round.score += points;
    round.heatsWon += 1;
    round.events.push({ type: "win", points, times, lead, level: round.level });
  } else if (result === "pass") {
    round.streak = 0;
    round.events.push({ type: "pass", level: round.level });
  } else {
    if (!round.infinite) round.lives -= 1;
    round.streak = 0;
    round.events.push({ type: "lose", lives: round.lives, time: round.clock >= HEAT_CAP_MS });
  }
}

// After a heat's result has shown: the next zone on a win or a pass (with
// fresh lanes), the same heat again otherwise, and the end of the round when
// the last life is gone.
function nextHeat(round, random) {
  if (round.result === "lose" && round.lives <= 0) {
    round.over = true;
    round.events.push({ type: "over" });
    return;
  }
  const on = round.result !== "lose";
  if (on) round.seed = Math.floor(random() * 2147483647);
  newHeat(round, on ? round.level + 1 : round.level, random);
  round.events.push(on ? { type: "level", level: round.level } : { type: "retry", lives: round.lives });
}

// One slice of a heat in play.
function play(round, ms, random) {
  round.clock += ms;
  for (const lane of round.lanes) runLane(round, lane, ms);
  const hs = round.hoppers;
  // A hopper standing on a log or a turtle goes with it.
  for (const h of hs) {
    if (away(h) || h.hop) continue;
    const lane = round.lanes[h.row];
    if (lane.kind === "river") h.x += lane.drift;
  }
  // The rivals choose, taking turns at going first.
  round.order = (round.order + 1) % (hs.length - 1);
  for (let k = 0; k < hs.length - 1; k++) drive(round, hs[1 + ((k + round.order) % (hs.length - 1))], ms, random);
  for (const h of hs) {
    h.daze = Math.max(0, h.daze - ms);
    h.shield = Math.max(0, h.shield - ms);
  }
  // Every hopper is checked where it stands before any hop moves it on, so a
  // car meets everyone at the same moment.
  for (const h of hs) hazards(round, h);
  round.landed.length = 0;
  for (const h of hs) {
    if (h.back) runBack(round, h, ms);
    else if (h.hop) {
      runHop(round, h, ms);
      if (!away(h)) hazards(round, h);
    }
  }
  // Your next hop (or pickup), queued while the last hop was on.
  const you = hs[0];
  if (you.queued && !you.hop && !you.daze && !away(you)) {
    const dir = you.queued;
    you.queued = null;
    if (dir === "power") usePower(round, you);
    else hop(round, you, dir);
  }
  if (round.close) {
    const c = round.close;
    const lane = round.lanes[c.row];
    if (!away(you) && (lane.kind === "rail" ? trainCovers(lane, 0, c.x - 0.5, c.x + 0.5) : hitIn(lane, c.x, 0, lane.shift, 0.2))) {
      round.score += CLOSE_POINTS;
      round.closeCalls += 1;
      round.events.push({ type: "close", points: CLOSE_POINTS, row: c.row, x: c.x });
      round.close = null;
    } else if ((c.ms -= ms) <= 0) round.close = null;
  }
  if (round.landed.length) {
    round.landed.sort(byFinish);
    for (const h of round.landed) {
      round.finishers.push(h);
      h.place = round.finishers.length;
      round.events.push({ type: "finish", id: h.id, place: h.place, row: h.row, x: h.x });
    }
    round.landed.length = 0;
  }
  checkEnd(round);
}

// After a heat ends the hops and flights in the air come down while the
// result shows, and the traffic keeps going.
function settle(round, ms) {
  for (const lane of round.lanes) runLane(round, lane, ms);
  for (const h of round.hoppers) {
    if (h.hop) {
      h.hop.ms += ms;
      if (h.hop.ms >= h.hop.max) {
        h.row = h.hop.toRow;
        h.x = h.hop.toX;
        h.hop = null;
      }
    } else if (h.back) {
      h.back.ms += ms;
      if (h.back.ms >= h.back.max) {
        h.row = h.back.toRow;
        h.x = h.back.toX;
        h.back = null;
      }
    } else if (!h.finished && round.lanes[h.row].kind === "river") h.x = clamp(h.x + round.lanes[h.row].drift, -0.5, COLS - 0.5);
  }
}

// Moves the round on by `ms`: the hold before a heat (the traffic already
// running), the play, and the pause after it, in small slices.
export function advance(round, ms, random = Math.random) {
  let left = ms;
  while (left > 0 && !round.over) {
    const slice = Math.min(left, SLICE_MS);
    left -= slice;
    if (round.phase === "ready") {
      for (const lane of round.lanes) runLane(round, lane, slice);
      round.phaseMs -= slice;
      if (round.phaseMs <= 0) {
        round.phase = "play";
        round.events.push({ type: "go" });
      }
    } else if (round.phase === "done") {
      round.phaseMs -= slice;
      settle(round, slice);
      if (round.phaseMs <= 0) nextHeat(round, random);
    } else play(round, slice, random);
  }
  return round.over ? "over" : round.phase;
}

/* -------------------------------------------------------------- rivals */

// The planner looks ahead in half hops (HALF_MS each) up to KMAX of them; a
// lane's flow at each is worked out once a choice, when first asked for.
const KMAX = 64;
const MAX_ROWS = 64;
const FLOWS = new Float64Array(MAX_ROWS * KMAX);
const MARKS = new Int32Array(MAX_ROWS * KMAX);
let stamp = 0;

function flowK(round, row, k) {
  const i = row * KMAX + k;
  if (MARKS[i] !== stamp) {
    MARKS[i] = stamp;
    FLOWS[i] = shiftAt(round.lanes[row], k * HALF_MS);
  }
  return FLOWS[i];
}

// Where a hopper riding `row` from half hop k0 has drifted to by k.
const driftK = (round, row, x, k0, k) => (round.lanes[row].kind === "river" ? x + flowK(round, row, k) - flowK(round, row, k0) : x);

// True when a hopper at (row, x) at half hop k is safe with `m` cells to
// spare: no car or train on it, and on a river (unless `air`, mid-hop)
// something to stand on and the board under it, `m` in from its edge. (Twice
// `m` once walled a careful rival into an end column beside a bush: every
// hop onto the water looked unsafe, so it never moved again.)
function safeK(round, row, x, k, m, air) {
  if (k >= KMAX) return true;
  const lane = round.lanes[row];
  if (lane.kind === "road") return !hitIn(lane, x, 0, flowK(round, row, k), m);
  if (lane.kind === "rail") return !trainCovers(lane, k * HALF_MS, x - BODY - m, x + BODY + m);
  if (lane.kind !== "river" || air) return true;
  if (x < -0.5 + m || x > COLS - 0.5 - m) return false;
  return floatIn(lane, x, flowK(round, row, k), round.clock + k * HALF_MS, m);
}

const DEAD = -100000;
const GOAL_VALUE = 10000;

// How good it is to end a look ahead at (row, x) at half hop k: higher is
// better, the middle a little better than the edges, grass better for a
// careful rival, and a cell about to be hit much worse. A Tagalong likes the
// cell just behind you until you near the top.
function leafValue(round, h, P, row, x, k) {
  let v = row * 10 - Math.abs(x - (COLS - 1) / 2) * 0.15 - k * 0.05;
  const lane = round.lanes[row];
  if (isSafe(lane)) v += P.safe;
  for (let j = 1; j <= P.tail; j++) {
    if (!safeK(round, row, driftK(round, row, x, k, k + j), k + j, P.margin, false)) {
      v -= 40;
      break;
    }
  }
  if (P.tag) {
    const you = round.hoppers[0];
    if (!away(you) && you.row < round.rows - 6) v -= Math.abs(row - (you.row - 1)) * 8 + Math.abs(x - you.x) * 2;
  }
  return v;
}

// The best that can come of standing at (row, x) at half hop k with `depth`
// choices left.
function search(round, h, P, row, x, k, depth) {
  if (round.lanes[row].kind === "goal") return GOAL_VALUE - k;
  if (depth <= 0) return leafValue(round, h, P, row, x, k);
  let best = -Infinity;
  for (let a = 0; a <= DIRS.length; a++) {
    const v = act(round, h, P, row, x, k, depth, a, 1);
    if (v > best) best = v;
  }
  return best;
}

// The best that can come of choice `a` (a hop DIRS[a] `cells` long, or with
// `a` past the hops, a wait) from (row, x) at half hop k. A hop counts in its
// first cell for its first half and lands at its end, on ice it slides a cell
// more, and after it the hopper waits its reaction time where it landed; a
// wait is a hop's length where it stands. Dying scores DEAD plus how long it
// lasted.
function act(round, h, P, row, x, k, depth, a, cells) {
  const m = P.margin;
  if (a >= DIRS.length) {
    for (let j = 1; j <= 2; j++) if (!safeK(round, row, driftK(round, row, x, k, k + j), k + j, m, false)) return DEAD + k + j;
    return search(round, h, P, row, driftK(round, row, x, k, k + 2), k + 2, depth - 1) - 0.5;
  }
  const dir = DIRS[a];
  if (!target(round, row, x, dir, TARGET, cells)) {
    if (cells > 1) return act(round, h, P, row, x, k, depth, a, 1);
    return -Infinity;
  }
  let tr = TARGET.row;
  let tx = TARGET.x;
  const halves = cells > 1 ? 3 : 2;
  // The hop's middle: the cell it leaves until the half hop at or after it,
  // the one it lands on from the half hop at or before it (both mid-air over
  // water). A Spring hop's middle falls between two half hops, so its first
  // cell is checked at the later one: it counts there until then.
  const mid = k + Math.floor(halves / 2);
  if (!safeK(round, row, x, k + Math.ceil(halves / 2), m, true) || !safeK(round, tr, tx, mid, m, true)) return DEAD + mid;
  let kk = k + halves;
  if (!safeK(round, tr, tx, kk, m, false)) return DEAD + kk;
  if (round.lanes[tr].icy && target(round, tr, tx, dir, TARGET, 1)) {
    const sx = TARGET.x;
    const sr = TARGET.row;
    if (!safeK(round, tr, tx, kk + 1, m, false) || !safeK(round, sr, sx, kk + 1, m, true)) return DEAD + kk + 1;
    tr = sr;
    tx = sx;
    kk += 2;
    if (!safeK(round, tr, tx, kk, m, false)) return DEAD + kk;
  }
  if (round.lanes[tr].kind === "goal") return GOAL_VALUE - kk;
  let bonus = 0;
  for (const p of round.pickups) if (p.row === tr && p.x === tx) bonus = 4;
  for (let j = 1; j <= P.react; j++) if (!safeK(round, tr, driftK(round, tr, tx, kk, kk + j), kk + j, m, false)) return DEAD + kk + j;
  return search(round, h, P, tr, driftK(round, tr, tx, kk, kk + P.react), kk + P.react, depth - 1) + bonus;
}

// A hopper's next hop ("up", "down", "left" or "right"), or null to wait:
// the best of every choice looked at `depth` hops ahead (more when sharp),
// each hop followed by the hopper's wait where it lands, against the lanes as
// they will move. A sharp one never hops where it would be hit or fall in. A
// sloppy one now and then hops on regardless, and weighs its choices loosely.
// `power` is the hopper's way of playing (its rival's at the round's zone
// unless given).
export function plan(round, h, random = Math.random, power = null) {
  if (round.phase !== "play" || away(h) || h.hop || h.daze > 0) return null;
  const P = power || rivalPower(round.level)[h.kind] || SHARP_POWER;
  stamp = (stamp + 1) | 0;
  if (P.mistake > 0 && random() < P.mistake) {
    const dir = random() < 0.75 ? "up" : random() < 0.5 ? "left" : "right";
    if (target(round, h.row, h.x, dir, TARGET, 1)) return dir;
  }
  let best = -1;
  let bestV = -Infinity;
  for (let a = 0; a <= DIRS.length; a++) {
    let v = act(round, h, P, h.row, h.x, 0, P.depth, a, h.spring ? 2 : 1);
    if (P.noise && v > DEAD / 2) v += (random() - 0.5) * P.noise;
    if (v > bestV) {
      bestV = v;
      best = a;
    }
  }
  return best >= 0 && best < DIRS.length ? DIRS[best] : null;
}

// A rival's turn at a slice: after its wait, its planner's hop, or another
// look after WAIT_MS.
function drive(round, h, ms, random) {
  if (away(h) || h.hop || h.daze > 0) return;
  h.think -= ms;
  if (h.think > 0) return;
  const dir = plan(round, h, random);
  if (dir && hop(round, h, dir)) return;
  h.think = WAIT_MS;
}

/* ------------------------------------------------------------- contract */

const MAX_PARTS = 400;

// The zone's name for the pills and the screens: "ZONE 3".
const zoneTag = (level) => `ZONE ${level}`;

// "Rail Yard (zone 3 of 9)", or past the ninth "Rush Hour 3 (zone 11)".
export function zoneName(level) {
  const spec = zoneFor(level);
  return level > MAX_ZONE ? `${spec.title} (zone ${level})` : `${spec.title} (zone ${level} of ${MAX_ZONE})`;
}

// The over screen's nudge to play again: the next zone not yet reached.
function teaser(furthest) {
  if (furthest < MAX_ZONE) return `Next up, zone ${furthest + 1}: ${ZONES[furthest + 1].title}.`;
  return "Every zone reached. How many Rush Hours can you cross?";
}

const PLACES = Object.freeze(["1ST", "2ND", "3RD"]);

// Each hopper's place right now: those home in the order they got there,
// then by height (a tie to you).
export function standings(round) {
  return round.hoppers.slice().sort((a, b) => {
    if (a.finished || b.finished) return a.finished && b.finished ? a.place - b.place : a.finished ? -1 : 1;
    return b.row - a.row || a.id - b.id;
  });
}

// The bell rings every BELL_MS while a train is coming in view.
const BELL_MS = 320;
// Forward hops this close together climb the hop blip's pitch.
const CHAIN_MS = 420;

// A Shield this close to running out ticks, quicker the closer it gets.
const SHIELD_LOW_MS = 900;
// Cars and trucks this many rows from you are heard, the nearest of each the
// louder the closer it is (within HEAR_CELLS, a cell across counting less
// than a row up or down).
const HEAR_ROWS = 3;
const HEAR_CELLS = 4.5;

// A little pitch wobble so a sound heard often is never quite the same twice:
// sound only, never the rules.
const vary = (spread = 0.1) => 1 - spread / 2 + Math.random() * spread;

// The log or turtle under column `x` of a river lane, or null.
function floatAt(lane, x) {
  for (const it of lane.items) {
    const a = itemX(lane, it, lane.shift);
    if (x >= a - GRIP && x <= a + it.len + GRIP) return it;
  }
  return null;
}

function create({ canvas, tone = () => {}, hum = () => {}, onScore = () => {}, best = () => 0, memo = null }) {
  const ctx = canvas.getContext("2d");
  let colors = null;
  let round = newRound();
  let state = "ready";
  let u = MIN_CELL;
  let bestAtStart = 0;
  let beaten = false;
  // A press waits for the first tick after a start or a play-on, so the key
  // that plays on (an arrow passed on with the resume) never also hops.
  let armed = false;
  // The arrows held down: a hop a press, never another until it is let go
  // (its key repeats, marked as such, never hop either).
  const held = { up: false, down: false, left: false, right: false };
  // The furthest zone ever reached, and whether this round went past it.
  // Without a memo (the unit suite) it lasts as long as the game.
  let furthest = 1;
  let further = false;
  try {
    furthest = Math.max(1, memo ? Number(memo.get()) | 0 : 1);
  } catch {}
  // Sparks, floating words, rings, the banners, the view's height (`cam`, the
  // row at its bottom), the shake and the flash, in board units and ms.
  let fx = null;
  const resetFx = () => (fx = { parts: [], floats: [], banners: [], rings: [], shake: 0, shakeMag: 0, flash: null, clock: 0, cam: 0, chain: 0, lastUp: -1e9, bell: 0, cheer: 0, combo: null, dazed: false, shieldWas: 0, shieldTick: 0, sink: null });
  resetFx();

  // The rivals' colors, worked out again whenever yours changes.
  let rivalPalette = RIVAL_COLORS;
  let paletteFor = null;
  const colorOf = (id) => {
    if (id === 0) return colors.you;
    if (paletteFor !== colors.you) {
      rivalPalette = rivalColors(colors.you);
      paletteFor = colors.you;
    }
    const h = round.hoppers[id];
    return rivalPalette[Math.max(0, RIVAL_KINDS.indexOf(h ? h.kind : "hopper"))];
  };
  const nameOf = (id) => (id === 0 ? "You" : round.hoppers[id] ? RIVALS[round.hoppers[id].kind].name : "A rival");

  // A spot on the board for row `row`, column `x`, in field units.
  const spot = (row, x) => ({ x: (x + 0.5) * CELL, y: FIELD_H - (row - fx.cam + 0.5) * CELL, row });
  const burst = (p, color, n, speed = 16) => {
    for (let i = 0; i < n && fx.parts.length < MAX_PARTS; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      fx.parts.push({ x: p.x, row: p.row, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 300 + Math.random() * 300, max: 600, color, size: 0.5 + Math.random() * 0.6, cam: fx.cam });
    }
  };
  // Floats and rings keep to the row they began on, so the view moving under
  // them carries them along.
  const float = (p, text, color, size = 2.6) => fx.floats.push({ x: p.x, row: p.row, rise: 0, text, color, size, life: 1000, max: 1000 });
  const ring = (p, color, r0, grow, ms = 420) => fx.rings.push({ x: p.x, row: p.row, color, r0, grow, life: ms, max: ms });
  const banner = (title, sub, color, ms = 1800) => {
    if (fx.banners.length >= 3 || fx.banners.some((b) => b.title === title)) return null;
    const b = { title, sub, color, life: ms, max: ms, tag: "", row: null, see: 1 };
    fx.banners.push(b);
    return b;
  };
  // A shake still running keeps the stronger of the two; a new one starts
  // from its own strength, so one big hit never loudens every later shake.
  const shake = (ms, mag) => {
    fx.shakeMag = Math.max(fx.shake > 0 ? fx.shakeMag : 0, mag);
    fx.shake = Math.max(fx.shake, ms);
  };
  const flash = (color, ms = 260) => (fx.flash = { color, life: ms, max: ms });

  const reach = (level, b) => {
    if (level <= furthest) return;
    furthest = level;
    further = true;
    try {
      if (memo) memo.set(furthest);
    } catch {}
    if (b) b.tag = level > MAX_ZONE ? `NEW FURTHEST: ${zoneFor(level).title.toUpperCase()}` : `NEW ZONE ${level} / ${MAX_ZONE}`;
  };

  // True when row `row` is on the board or just off it.
  const inView = (row) => row >= fx.cam - 1 && row <= fx.cam + VIEW_ROWS;

  const handle = (e) => {
    const you = round.hoppers[0];
    if (e.type === "go") tone("go");
    else if (e.type === "hop") {
      if (e.id === 0) {
        if (e.forward) {
          fx.chain = fx.clock - fx.lastUp < CHAIN_MS ? Math.min(8, fx.chain + 1) : 0;
          fx.lastUp = fx.clock;
        } else fx.chain = 0;
        tone("hop", e.spring ? 0.9 : 0.6, (e.spring ? 1.3 : 1) * (1 + 0.06 * fx.chain));
        if (e.spring) tone("jump", 0.6);
      } else if (inView(e.row)) tone("hop", 0.12, 0.85);
    } else if (e.type === "land") {
      // Feet down: a knock on a log, a slap on a turtle, a rustle on grass
      // (a rival's only on the water, and only in view).
      const lane = round.lanes[e.row];
      if (lane && lane.kind === "river") {
        if (e.id === 0 || inView(e.row)) {
          const it = floatAt(lane, e.x);
          tone(it && it.kind === "turtle" ? "hopTurtleLand" : "hopLogLand", e.id === 0 ? 0.6 : 0.15, vary());
        }
      } else if (e.id === 0 && lane && (lane.kind === "grass" || lane.kind === "start")) tone("hopGrassStep", 0.3, vary(0.3));
    } else if (e.type === "bonk") {
      if (e.id === 0) {
        tone("wall", 0.5);
        tone("thud", 0.35);
      }
    } else if (e.type === "slide") {
      if (inView(e.row)) {
        tone("shield", e.id === 0 ? 0.35 : 0.12, 0.6);
        tone("hopIceSlide", e.id === 0 ? 0.6 : 0.15, vary());
      }
    } else if (e.type === "back") {
      const p = spot(e.row, e.x);
      const color = colorOf(e.id);
      if (e.cause === "splash" || e.cause === "swept") {
        tone("splash", e.id === 0 ? 1 : 0.4);
        if (e.id === 0) tone("splashBig", 0.9, e.cause === "swept" ? 0.85 : 1);
        else if (inView(e.row)) tone("hopPlop", 0.35, vary(0.2));
        if (e.id === 0 && e.cause === "swept") tone("whoosh", 0.5, 0.8);
        ring(p, "#ffffff", 1, 5, 420);
        burst(p, "#bfe6ff", e.id === 0 ? 14 : 6, 12);
      } else {
        tone("crash", e.id === 0 ? 1 : 0.4, e.cause === "train" ? 0.8 : 1);
        if (e.id === 0) {
          tone("hopSquash", 1, e.cause === "train" ? 0.8 : vary());
          // A train flattens you with a metal smash; a car's driver leans on
          // the horn.
          if (e.cause === "train") tone("smash", 0.8, 0.7);
          else tone("honk", 0.45, vary(0.25));
        } else if (inView(e.row)) tone("squish", 0.35, vary(0.3));
        burst(p, color, e.id === 0 ? 16 : 8, 18);
        burst(p, "#ffffff", 6, 12);
      }
      tone("boing", e.id === 0 ? 0.8 : 0.3);
      if (e.id === 0) {
        shake(e.cause === "train" ? 380 : 240, e.cause === "train" ? 1.2 : 0.7);
        flash(DANGER, 220);
        float(p, e.cause === "splash" ? "Splash!" : e.cause === "swept" ? "Swept away!" : e.cause === "train" ? "Train!" : "Bonk!", DANGER, 2.8);
      } else float(p, `${nameOf(e.id)}: back!`, color, 2.2);
    } else if (e.type === "home") {
      if (e.id === 0) {
        float(spot(e.row, e.x), "Dazed!", "#ffffff", 2.4);
        tone("hopDazed", 0.5);
      }
    } else if (e.type === "whiff") tone("swing", 0.35);
    else if (e.type === "shield") {
      tone("shield", e.id === 0 ? 1 : 0.4);
      tone("hopShieldBlock", e.id === 0 ? 0.8 : 0.3, vary());
      ring(spot(e.row, e.x), POWERS.shield.color, 2, 6, 460);
    } else if (e.type === "use") {
      const spec = POWERS[e.kind];
      const p = spot(e.row, e.x);
      ring(p, spec.color, 1.5, 5, 380);
      if (e.kind === "shield") {
        tone("shield", 0.8);
        tone("shieldUp", 0.6);
        float(p, "Shield up!", spec.color, 2.6);
      } else if (e.kind === "spring") tone("power", 0.6, 1.2);
    } else if (e.type === "power") {
      const spec = POWERS[e.kind];
      const p = spot(e.row, e.x);
      burst(p, spec.color, e.id === 0 ? 16 : 8, 14);
      if (e.id === 0) {
        if (e.kind === "coin") {
          tone("coinUp", 1, vary(0.06));
          float(p, `+${COIN_POINTS}`, GOLD, 2.6);
        } else {
          tone("powerUp", 0.8);
          const n = you.powers.length;
          banner(spec.name, n > 1 ? `${spec.blurb}. Space: ${n} stacked, oldest first` : `${spec.blurb}. Press space to use it`, spec.color, 1500);
        }
      } else {
        if (inView(e.row)) tone("coin", 0.3, 0.8);
        float(p, `${nameOf(e.id)}: ${spec.name}`, spec.color, 2.2);
      }
    } else if (e.type === "horn") {
      // The Horn blares, and the road it stops brakes hard.
      tone("horn", 0.8);
      tone("honk", 0.7, 0.8);
      tone("brake", 0.5);
      float(spot(e.row, COLS / 2 - 0.5), "HONK!", POWERS.horn.color, 3);
    } else if (e.type === "close") {
      // A close call: the car or the train whips past right behind you, and
      // lets you know about it.
      tone("combo", 0.9, 1.3);
      tone("hopNearMiss", 0.8, vary());
      const lane = round.lanes[e.row];
      if (lane && lane.kind === "rail") tone("trainHorn", 0.5);
      else tone("honk", 0.4, vary(0.3));
      float(spot(e.row, e.x), `Close! +${e.points}`, GOLD, 2.4);
    } else if (e.type === "warn") {
      fx.bell = BELL_MS;
      // The train sounds its horn on the way in, louder the nearer the track.
      if (inView(e.row)) tone("trainHorn", Math.abs(e.row - you.row) <= 3 ? 0.5 : 0.25);
    } else if (e.type === "train") {
      if (inView(e.row)) {
        tone("tunnel", 0.6, 0.7);
        tone("hopTrainRush", Math.abs(e.row - you.row) <= 3 ? 0.9 : 0.45);
        shake(120, 0.35);
      }
    } else if (e.type === "finish") {
      const p = spot(e.row, e.x);
      if (e.id === 0) {
        tone("cup");
        tone("cheer", 0.5);
        burst(p, GOLD, 24, 18);
      } else {
        tone("shank", 0.5);
        float(p, `${nameOf(e.id)} made it!`, colorOf(e.id), 2.4);
        if (e.place === 1 && round.level <= PASS_ZONE && !you.finished) banner(`${nameOf(e.id)} got there first`, "Get there second to go through", colorOf(e.id), 1600);
      }
    } else if (e.type === "win") {
      tone("hopHeatWin");
      tone("applause", 0.45);
      flash(GOLD, 300);
      const b = banner("First to the top!", `+${e.points} points${e.times > 1 ? `, clean x${e.times}` : ""}`, GOLD, DONE_MS);
      if (b && e.times > 1) fx.combo = { n: e.times, life: 1600, max: 1600 };
      fx.cheer = DONE_MS;
      burst(spot(you.row, you.x), GOLD, 36, 22);
      if (e.times > 1) {
        tone("perfect", 0.8, 1 + 0.1 * e.times);
        tone("sparkle", 0.6, 1 + 0.1 * e.times);
      }
    } else if (e.type === "pass") {
      tone("cup", 0.8);
      tone("cheer", 0.35);
      banner("Second: through!", `Zones 1 and ${PASS_ZONE} let second place on`, "#ffffff", DONE_MS);
    } else if (e.type === "lose") {
      // A heat lost: a sad trombone, or the game-over sting on the last life.
      tone("fall", 0.8);
      tone(e.lives > 0 ? "hopLoseSting" : "gameOver", e.lives > 0 ? 0.7 : 1);
      banner(e.time ? "Time!" : "Beaten to the top!", e.lives > 0 ? `${e.lives} ${e.lives === 1 ? "life" : "lives"} left` : "That was your last life", DANGER, DONE_MS);
    } else if (e.type === "level") {
      const spec = zoneFor(e.level);
      // A zone never reached before gets the full fanfare.
      tone(e.level > furthest ? "fanfare" : "levelup");
      tone("whoosh", 0.4);
      flash(zoneColor(e.level), 400);
      fx.cam = 0;
      fx.dazed = false;
      fx.shieldWas = 0;
      reach(e.level, banner(e.level > MAX_ZONE ? spec.title : `Zone ${e.level}`, `${spec.title}: ${spec.sub}`, zoneColor(e.level), 2200));
    } else if (e.type === "retry") {
      fx.cam = 0;
      fx.dazed = false;
      fx.shieldWas = 0;
      tone("swoosh", 0.45);
      // One life left: a heartbeat under the rerun.
      if (e.lives === 1) tone("heartbeat", 0.8);
      banner(zoneFor(round.level).title, "Again! First to the top wins", zoneColor(round.level), 1400);
    }
  };

  // A score past the best this round began with: once a round, a fanfare.
  const checkBest = () => {
    if (beaten || !(bestAtStart > 0) || round.score <= bestAtStart) return;
    beaten = true;
    tone("best");
    tone("sparkle", 0.5);
    banner("New best!", "Every point from here is a record", GOLD, 1800);
  };

  const drain = () => {
    colors ||= readColors(canvas);
    for (const e of round.events.splice(0)) handle(e);
    checkBest();
  };

  // Where the view's bottom row heads: three rows under you (where you fly
  // back to as you fly), never past either end of the zone.
  const camTarget = () => {
    const you = round.hoppers[0];
    const row = you.back ? you.back.fromRow + (you.back.toRow - you.back.fromRow) * Math.min(1, you.back.ms / you.back.max) : you.hop ? you.hop.fromRow + (you.hop.toRow - you.hop.fromRow) * Math.min(1, you.hop.ms / you.hop.max) : you.row;
    return clamp(row - 3, 0, Math.max(0, round.rows - VIEW_ROWS));
  };

  // A banner sits on the half of the board away from you, and fades almost
  // clear while you hop under it.
  const youY = () => FIELD_H - (round.hoppers[0].row - fx.cam + 0.5) * CELL;
  const bannerRow = () => (youY() < FIELD_H / 2 ? FIELD_H * 0.72 : FIELD_H * 0.3);
  const underBanner = (row) => Math.abs(youY() - row) < 10;

  // The bell, while a train is coming on a lane in view.
  const runBells = (ms) => {
    if (round.phase === "ready") return;
    let near = null;
    for (const lane of round.lanes) if (lane.kind === "rail" && lane.phase === "warn" && inView(lane.row)) near = lane;
    if (!near) return;
    fx.bell += ms;
    if (fx.bell < BELL_MS) return;
    fx.bell = 0;
    tone("bell", Math.abs(near.row - round.hoppers[0].row) <= 2 ? 0.7 : 0.35);
  };

  // The held sounds, each tick: the nearest car and the nearest truck on the
  // roads around you (louder the closer, pitched with the lane's speed, a
  // touch higher coming at you than going away, idling while a Horn holds
  // the road), the river you are on or next to (quicker water higher), a
  // train passing in view, your Shield's shimmer, and the Night Market's
  // crowd. A hum not asked for fades by itself.
  const near = { d: 0, v: 0, toward: false, kind: "" };
  const truck = { d: 0, v: 0, toward: false, kind: "" };
  const engine = (id, name, n, base, per) => {
    if (!(n.d < HEAR_CELLS)) return;
    const t = 1 - n.d / HEAR_CELLS;
    const speed = Math.abs(n.v);
    const pitch = (speed ? base + speed * per : 1) * (n.kind === "van" ? 0.9 : 1) * (speed ? (n.toward ? 1.05 : 0.95) : 1);
    hum(id, name, 0.15 + 0.85 * t * t, pitch);
  };
  const runHums = () => {
    const you = round.hoppers[0];
    if (!you) return;
    near.d = truck.d = Infinity;
    let water = 0;
    let waterPitch = 1;
    let rail = 0;
    for (const lane of round.lanes) {
      const dy = Math.abs(lane.row - you.row);
      if (lane.kind === "road" && dy <= HEAR_ROWS) {
        const v = velocity(lane, lane.dir, lane.fast, lane.stop);
        for (const it of lane.items) {
          const a = itemX(lane, it, lane.shift);
          if (a > COLS + 1 || a + it.len < -2) continue;
          const dx = Math.max(0, a - you.x, you.x - (a + it.len));
          const d = Math.hypot(dx * 0.7, dy);
          const n = it.kind === "truck" ? truck : near;
          if (d >= n.d) continue;
          n.d = d;
          n.v = v;
          n.kind = it.kind;
          n.toward = (you.x - (a + it.len / 2)) * v > 0;
        }
      } else if (lane.kind === "river" && dy <= 2) {
        const t = dy === 0 ? 1 : dy === 1 ? 0.5 : 0.22;
        if (t > water) {
          water = t;
          waterPitch = 0.8 + Math.abs(velocity(lane, lane.dir, lane.fast, lane.stop)) * 0.3 + (lane.flip ? 0.25 : 0);
        }
      } else if (lane.kind === "rail" && lane.phase === "pass" && inView(lane.row)) rail = Math.max(rail, Math.max(0.3, 1 - dy / 8));
    }
    engine("hop:car", "car", near, 1.4, 0.45);
    engine("hop:truck", "hopTruck", truck, 1, 0.35);
    if (water) hum("hop:river", "river", water, waterPitch);
    if (rail) hum("hop:train", "train", rail, 1.4);
    if (you.shield > 0) hum("hop:shield", "hopShield", you.shield < SHIELD_LOW_MS ? 0.5 : 0.8, you.shield < SHIELD_LOW_MS ? 1.2 : 1);
    if (round.dark) hum("hop:market", "crowd", 0.5);
  };

  // What each lane near you was doing last tick, so a change can be heard.
  let laneWas = new WeakMap();

  // One-shot cues the rules raise no event for, heard as they change: the
  // daze wearing off, your Shield running low and out, a turtle you stand on
  // starting to dive, and the lanes near you: a Highway lane surging, a
  // Rapids lane turning round, and a road the Horn stopped pulling away.
  const runCues = (ms) => {
    const you = round.hoppers[0];
    if (!you) return;
    const dazed = you.daze > 0;
    if (fx.dazed && !dazed && !away(you)) tone("hopUnDaze", 0.5);
    fx.dazed = dazed;
    if (you.shield > 0 && you.shield < SHIELD_LOW_MS) {
      fx.shieldTick -= ms;
      if (fx.shieldTick <= 0) {
        tone("hopShieldTick", 0.5, 1 + (1 - you.shield / SHIELD_LOW_MS) * 0.3);
        fx.shieldTick = 90 + (you.shield / SHIELD_LOW_MS) * 160;
      }
    } else fx.shieldTick = 0;
    if (fx.shieldWas > 0 && you.shield <= 0) tone("powerDown", 0.35);
    fx.shieldWas = you.shield;
    const here = round.lanes[you.row];
    const under = here && here.kind === "river" && !you.hop && !away(you) ? floatAt(here, you.x) : null;
    if (under && under.dive && turtleState(under, round.clock) === 1) {
      if (fx.sink !== under) tone("hopTurtleSink", 0.6, vary());
      fx.sink = under;
    } else fx.sink = null;
    for (const lane of round.lanes) {
      if (Math.abs(lane.row - you.row) > HEAR_ROWS || !(lane.surge || lane.flip || lane.kind === "road")) continue;
      const was = laneWas.get(lane);
      if (!was) {
        laneWas.set(lane, { fast: lane.fast, dir: lane.dir, stop: lane.stop });
        continue;
      }
      if (lane.surge && lane.fast && !was.fast) tone("zoom", 0.45, vary());
      if (lane.flip && lane.dir !== was.dir) tone("hopRapidsTurn", 0.6, vary());
      if (was.stop > 0 && lane.stop <= 0) tone("rev", 0.5, vary());
      was.fast = lane.fast;
      was.dir = lane.dir;
      was.stop = lane.stop;
    }
  };

  const runFx = (ms) => {
    fx.clock += ms;
    const s = ms / 1000;
    fx.cam += (camTarget() - fx.cam) * (1 - Math.exp(-ms / 110));
    fx.parts = fx.parts.filter((p) => {
      p.life -= ms;
      p.x += p.vx * s;
      p.y += p.vy * s;
      p.vx *= 0.9;
      p.vy *= 0.9;
      return p.life > 0;
    });
    fx.floats = fx.floats.filter((f) => {
      f.life -= ms;
      f.rise += 5 * s;
      return f.life > 0;
    });
    fx.rings = fx.rings.filter((r) => (r.life -= ms) > 0);
    if (fx.combo && (fx.combo.life -= ms) <= 0) fx.combo = null;
    fx.cheer = Math.max(0, fx.cheer - ms);
    if (fx.banners.length) {
      const b = fx.banners[0];
      if (b.row == null) b.row = bannerRow();
      const target = underBanner(b.row) ? 0.15 : 1;
      b.see += (target - b.see) * Math.min(1, ms / 140);
      b.life -= ms;
      if (b.life <= 0) fx.banners.shift();
    }
    fx.shake = Math.max(0, fx.shake - ms);
    if (fx.flash && (fx.flash.life -= ms) <= 0) fx.flash = null;
  };

  // The pills' numbers: the zone, lives, your daze and Shield running down,
  // the pickup space uses next and how many more wait behind it, the clean
  // streak, and your place.
  const hudOf = () => {
    const you = round.hoppers[0];
    const effects = [];
    if (you.daze > 0) effects.push({ text: "DAZED", color: "#ffffff", fill: you.daze / DAZE_MS });
    if (you.shield > 0) effects.push({ text: "SHIELD", color: POWERS.shield.color, fill: Math.min(1, you.shield / SHIELD_MS) });
    if (you.powers.length) {
      const next = POWERS[you.powers[0]];
      effects.push({ text: `SPACE: ${next.name.toUpperCase()}`, color: next.color, fill: 1 });
      if (you.powers.length > 1) effects.push({ text: `+${you.powers.length - 1}`, color: "#ffffff", fill: 1 });
    }
    const place = standings(round).indexOf(you);
    return { zone: zoneTag(round.level), effects, streak: round.streak, place: PLACES[place] || `${place + 1}TH`, first: place === 0 };
  };

  // The view hop-draw.js draws from: one object, refilled each frame.
  const view = { g: Object.freeze({ W, H, COLS, VIEW_ROWS, CELL, FIELD_W, FIELD_H, HUD_H, PAD, GAP, BAR_W }), powers: POWERS, rivals: RIVALS, maxZone: MAX_ZONE, colorOf, nameOf, trainSpan, itemX, turtleState, passMs: PASS_MS };
  const shakeAt = { x: 0, y: 0 };

  const paint = () => {
    if (!ctx) return;
    colors ||= readColors(canvas);
    // A banner takes its place on its first frame: a frame painted before the
    // next tick (the start's, held through the 3, 2, 1) would draw it at the top.
    const head = fx.banners[0] || null;
    if (head && head.row == null) head.row = bannerRow();
    view.u = u;
    view.clock = fx.clock;
    view.state = state;
    view.colors = colors;
    view.level = round.level;
    view.round = round;
    view.fx = fx;
    view.cam = fx.cam;
    view.pillH = Math.max(12 / u, 2.4);
    view.hud = hudOf();
    view.cheer = fx.cheer > 0;
    view.combo = fx.combo;
    view.flash = fx.flash;
    view.banner = head;
    view.furthest = furthest;
    view.lost = (round.phase === "done" && round.result === "lose") || state === "over";
    view.shake = null;
    if (fx.shake > 0 && state === "running") {
      shakeAt.x = (Math.random() - 0.5) * 2 * fx.shakeMag;
      shakeAt.y = (Math.random() - 0.5) * 2 * fx.shakeMag;
      view.shake = shakeAt;
    }
    view.tally = null;
    view.big = null;
    const reached = `Furthest: ${zoneName(furthest)}`;
    if (state === "ready") view.tally = ["Hop to the top before your rivals do", `Arrows hop, space uses pickups. ${reached}`];
    else if (state === "over") {
      view.big = String(round.score);
      view.tally = [`Reached ${zoneName(round.level)}${further ? ". New furthest!" : ""}${beaten ? " A new best!" : ""}`, `${round.heatsWon} heat${round.heatsWon === 1 ? "" : "s"} won, best streak x${Math.max(1, round.bestStreak)}, ${round.powersUsed} pickup${round.powersUsed === 1 ? "" : "s"} used, ${round.closeCalls} close call${round.closeCalls === 1 ? "" : "s"}. ${teaser(furthest)}`];
    }
    drawScene(ctx, view);
  };

  // Nothing held carries over a pause or a new round: a release may never
  // arrive, and a queued hop is dropped.
  const letGo = () => {
    for (const k of Object.keys(held)) held[k] = false;
    if (round.hoppers) round.hoppers[0].queued = null;
  };

  const start = () => {
    colors = readColors(canvas);
    round = newRound();
    state = "running";
    further = false;
    armed = false;
    resetFx();
    laneWas = new WeakMap();
    try {
      bestAtStart = Number(best()) || 0;
    } catch {
      bestAtStart = 0;
    }
    beaten = false;
    banner(ZONES[1].title, ZONES[1].sub, zoneColor(1), 1600);
    paint();
  };

  const end = () => {
    state = "over";
    letGo();
    onScore(round.score);
  };

  // A press of an arrow: a hop now, or the one queued behind the hop that is
  // on (the latest press wins). Nothing during the hold before a heat, while
  // you fly back, nor while you stand dazed (a press then is just lost, so it
  // never hops you out the moment the daze ends).
  const press = (dir) => {
    const you = round.hoppers[0];
    if (round.phase !== "play" || away(you) || you.daze > 0) return;
    if (you.hop) you.queued = dir;
    else hop(round, you, dir);
  };

  // Space in play: the oldest pickup in your stack, or a whiff with none.
  const useAhead = () => {
    const you = round.hoppers[0];
    if (round.phase !== "play" || away(you) || you.daze > 0) return;
    if (!you.powers.length) round.events.push({ type: "whiff" });
    else usePower(round, you);
  };

  const MOVES = Object.freeze({ left: true, right: true, up: true, down: true });

  return {
    get score() {
      return round.score;
    },
    get state() {
      return state;
    },
    // For the tests only: the window never reads it.
    get round() {
      return round;
    },
    // Endless lives for this round (the Activities window's code), or not.
    cheat(on) {
      round.infinite = Boolean(on);
    },
    start,
    pause() {
      if (state === "running") state = "paused";
      letGo();
      paint();
    },
    resume() {
      if (state !== "paused") return;
      state = "running";
      armed = false;
    },
    // An arrow hops once a press: its key repeats (an arrow held down, or held
    // through the countdown) never hop, and nor does it again until it is let
    // go. Space starts a round, plays on from a pause or uses a pickup; a
    // repeat of it never uses one.
    key(name, repeat = false) {
      if (name === "action") {
        if (state === "ready" || state === "over") start();
        else if (state === "paused") {
          state = "running";
          armed = false;
        } else if (!repeat && armed) {
          useAhead();
          drain();
        }
        return true;
      }
      if (!MOVES[name]) return false;
      if (repeat || held[name]) return true;
      held[name] = true;
      if (state === "running" && armed) {
        press(name);
        drain();
      }
      return true;
    },
    // An arrow let go: its next press hops again.
    release(name) {
      if (MOVES[name]) held[name] = false;
    },
    tick(ms) {
      if (state !== "running") return;
      runFx(ms);
      runBells(ms);
      advance(round, ms);
      drain();
      runCues(ms);
      runHums();
      if (round.over) end();
      paint();
      armed = true;
    },
    resize(w, h) {
      const next = Math.floor(Math.min(w / W, h / H) * 4) / 4;
      if (!(next >= MIN_CELL)) return false;
      u = next;
      colors = null;
      const ratio = typeof devicePixelRatio === "number" && devicePixelRatio > 0 ? devicePixelRatio : 1;
      canvas.width = Math.round(W * u * ratio);
      canvas.height = Math.round(H * u * ratio);
      if (canvas.style) {
        canvas.style.width = `${Math.round(W * u)}px`;
        canvas.style.height = `${Math.round(H * u)}px`;
      }
      if (ctx && typeof ctx.setTransform === "function") ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      paint();
      return true;
    },
  };
}

export default Object.freeze({ id: "hop", title: "Crossing Rush", create });
