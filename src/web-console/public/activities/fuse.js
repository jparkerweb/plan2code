// Plan2Code Web Console - Hot Potato, the ninth activity: the runners, the bomb and its fuse, the rivals, the venues and the game contract.
//
// The Activities window (screens/activities.js) drives everything: it ticks
// the game, hands it keys (and their releases) and pauses it. A game never
// runs a timer or listens for a key of its own, so a paused game cannot move.
// The rules are plain functions over a round object (newRound, newMatch,
// advance, move, tag, burn, blast, nextFuse, think, applyPower), exported so
// the unit suite can drive them without a canvas; the drawing lives in
// fuse-draw.js, and the default export is the contract every listed game
// answers.
//
// One fizzing bomb (a merge conflict, its <<<<<<< markers showing), a handful
// of runners and a fuse that keeps getting shorter. The held arrows run, and
// whoever holds the bomb passes it by touching someone; the one holding it
// when the fuse runs out is blown out of the match. Space dashes: a lunge for
// a tag when you hold it, a dodge when you do not. The last runner standing
// wins the match and moves on to the next venue; Planny blown up costs one of
// three lives and runs the match again. The venues bring more rivals and
// something new (pickups, long rows of racks, a roof with no wall on one
// side, ice, conveyor belts, the lights out, two bombs at once), and past the
// ninth the Finale repeats, sharper each time. The memo keeps the furthest
// venue ever reached.

import { DANGER, GOLD, drawScene, readColors, venueColor } from "./fuse-draw.js";

// The arena, in units, and the board around it: a strip along the top for
// the pills and a margin round the floor. The canvas scales a unit in
// quarter-pixel steps.
export const AW = 104;
export const AH = 70;
// The strip is one row of pills tall (the draw file's hudLayout shrinks the
// pills to keep them in one row), and the field runs to the canvas's edges
// with no frame, so the play gets the room.
// Hot Potato keeps a 1 unit edge for the rooftop walls, stroked just
// outside the arena, and the ledge below it.
export const HUD_H = 4.5;
export const PAD = 1;
export const W = AW + PAD * 2;
export const H = HUD_H + AH + 1.5;

// Below this many pixels a unit, the board is too small to play: resize()
// says so and the window shows its bigger-window note.
export const MIN_CELL = 3;

// Every runner is a circle this big.
export const RUNNER_R = 3;

// Running: a runner's speed eases toward the held direction at GRIP a second,
// so a runner is quick to start and quick to stop. Whoever holds a bomb runs
// HOLDER_SPEED times as fast, so a chase can actually end.
export const SPEED = 40;
export const HOLDER_SPEED = 1.12;
export const GRIP = 14;
const ICE_GRIP = 1.8;

// A dash adds DASH_SPEED the way you run for DASH_MS: a lunge for a tag when
// you hold the bomb, a dodge when you do not. Everyone starts a match with
// START_CHARGES; one comes back every RECHARGE_MS, up to MAX_CHARGES.
export const DASH_SPEED = 70;
export const DASH_MS = 180;
export const START_CHARGES = 2;
export const MAX_CHARGES = 2;
export const RECHARGE_MS = 4000;

// A holder this close lunges. A runner who has just been handed the bomb
// cannot pass it on for NO_TAGBACK_MS (the bomb flashes white).
export const LUNGE_RANGE = 12;
export const NO_TAGBACK_MS = 600;
// A pass never leaves its new holder less than PASS_FLOOR_MS of fuse: the
// NO_TAGBACK_MS it cannot pass in, plus PASS_REACT_MS to reach someone. Handed
// over any lower, the fuse is raised to it, so a bomb at its last moment is
// not certain death on whoever it lands on. Each runner is lifted so once a
// fuse (`bomb.lifted`): handed that fuse low again, it gets what is left.
// Without that limit two runners passing straight back and forth kept one
// bomb lit for minutes in a scratch sim.
export const PASS_REACT_MS = 800;
export const PASS_FLOOR_MS = NO_TAGBACK_MS + PASS_REACT_MS;
// No tag-backs: while three or more are left, the runner who just passed the
// bomb is safe from its new holder for TAGBACK_MS.
export const TAGBACK_MS = 3000;
// Runners this close count as touching for a tag.
const TAG_SLOP = 0.4;
// A tag pushes the two runners apart this fast, so they do not stay stuck.
const KNOCK = 26;

// The fuse: a venue's first one lasts its `fuse` ms, each one after it
// FUSE_STEP_MS less, never under the venue's `floor`. Under HOT_MS a pass of
// yours is a hot pass; under DESPERATE_MS a holding rival goes for whoever is
// nearest. A bomb that blew relights on a survivor after RELIGHT_MS.
export const FUSE_MS = 12000;
export const FUSE_STEP_MS = 1500;
export const FUSE_FLOOR_MS = 5000;
export const HOT_MS = 1000;
export const DESPERATE_MS = 2000;
export const RELIGHT_MS = 1100;

// A blast knocks everyone within BLAST_R back.
export const BLAST_R = 14;
const BLAST_KICK = 30;

// A match holds still for READY_MS so everyone can see the field and who has
// the bomb (the first one only briefly: the window has just counted 3, 2, 1),
// and shows how it went for DONE_MS before the next one. A runner blown out
// waddles off for OUT_MS, charred; one off the roof falls for FALL_MS.
export const READY_MS = 1400;
const FIRST_READY_MS = 300;
export const DONE_MS = 1900;
export const OUT_MS = 1600;
export const FALL_MS = 500;

export const START_LIVES = 3;
export const MAX_VENUE = 9;

// Points: a fuse that ends on someone else is SURVIVE_POINTS times the venue,
// a pass of yours PASS_POINTS, a hot pass HOT_POINTS more times the streak
// (hot passes in a row step it up to MAX_STREAK; a pass that is not hot ends
// it), and a match won WIN_POINTS times the venue.
export const SURVIVE_POINTS = 10;
export const PASS_POINTS = 2;
export const HOT_POINTS = 15;
export const WIN_POINTS = 50;
export const MAX_STREAK = 5;

// A rival thinks every THINK_MS at sharpness 0, THINK_FAST_MS at 1. A lunge
// is wound up first, for WINDUP_MS down to WINDUP_FAST_MS: the rival stops
// and crouches, which is your moment to dodge. A Trickster feints instead,
// a step the wrong way for FAKE_MS.
export const THINK_MS = 220;
const THINK_FAST_MS = 90;
export const WINDUP_MS = 320;
const WINDUP_FAST_MS = 150;
export const FAKE_MS = 170;
// A rival with nobody chasing it and no holder nearer than CALM_RANGE walks.
const CALM_RANGE = 34;
const WALK = 0.6;
// A sloppy rival, up to MISJUDGE of its thinks, picks a spot at random.
const MISJUDGE = 0.14;
const BLIND_MS = 500;
// A runner reacts to a lunge coming at it after REACT_MS at sharpness 0,
// REACT_FAST_MS at 1.
const REACT_MS = 120;
const REACT_FAST_MS = 30;

// Pickups: one at a time on the floor from venue PICKUPS_LEVEL, the first
// FIRST_PICK_MS into a match, then PICK_MS give or take PICK_SPREAD_MS after
// the last one went, each gone after PICK_TTL_MS.
const PICKUPS_LEVEL = 2;
const FIRST_PICK_MS = 3000;
const PICK_MS = 5000;
const PICK_SPREAD_MS = 1500;
export const PICK_TTL_MS = 8000;
export const PICK_R = 2.4;
export const FREEZE_MS = 2000;
export const SNEAKERS_MS = 3000;
export const SNEAKERS = 1.3;
export const EXTRA_MS = 2000;

// The Rooftop's open edge: rivals keep EDGE_SAFE units from it.
const EDGE_SAFE = 6;
// Conveyor belts carry everyone on them at BELT_SPEED.
export const BELT_SPEED = 16;

// Time is handed to the runners in slices this long: short enough that two
// runners closing at full dash never pass through each other between two.
const SLICE_MS = 8;

// The rivals find their way on a grid of GRID-unit cells, with every cell a
// runner's center cannot reach (an obstacle, a wall, the roof's edge) shut.
export const GRID = 2;
export const GW = AW / GRID;
export const GH = AH / GRID;
const CELLS = GW * GH;
const INFLATE = RUNNER_R * 0.9;
// A path is followed toward the cell LOOK steps along it.
const LOOK = 4;
// The holders' distance field is worked out again at most every THREAT_MS.
const THREAT_MS = 100;

const deepFreeze = (o) => Object.freeze(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Object.freeze(Array.isArray(v.rivals) ? { ...v, rivals: Object.freeze([...v.rivals]) } : v)])));

// The pickups. `weight` is how often each turns up against the others.
export const POWERS = deepFreeze({
  freeze: { name: "Freeze", blurb: "Every fuse stops for 2 seconds", color: "#1fb6d9", weight: 3 },
  sneakers: { name: "Sneakers", blurb: "Faster for 3 seconds", color: "#57b54a", weight: 3 },
  extra: { name: "Extra Fuse", blurb: "Two more seconds on every fuse", color: "#f5b301", weight: 3 },
  swap: { name: "Swap", blurb: "Trade places with a random runner", color: "#a466ff", weight: 2 },
});

// The rivals: a personality each, with its top speed (as part of yours) and
// how sharply it turns.
export const RIVALS = deepFreeze({
  sprinter: { name: "Sprinter", top: 1.08, grip: 0.4, blurb: "Fast, but turns wide" },
  hider: { name: "Hider", top: 0.88, grip: 1, cover: 1.08, blurb: "Lurks behind things, slow in the open" },
  trickster: { name: "Trickster", top: 1, grip: 1, blurb: "Feints before it dashes" },
  pal: { name: "Pal", top: 0.97, grip: 1, blurb: "Sticks by you, bomb or not" },
  clingy: { name: "Clingy", top: 1.02, grip: 1, blurb: "Hugs the holder from behind" },
});

// Each venue: its rivals, how sharp they run (0 to 1), its fuse, how many
// bombs burn at once, and its floor (LAYOUTS below).
export const VENUES = deepFreeze({
  1: { title: "Break Room", sub: "Tag someone before it blows", rivals: ["sprinter", "hider", "trickster"], smart: 0.15, fuse: FUSE_MS, floor: FUSE_FLOOR_MS, bombs: 1 },
  2: { title: "Open Plan", sub: "Pickups turn up on the floor", rivals: ["sprinter", "hider", "trickster"], smart: 0.25, fuse: FUSE_MS, floor: FUSE_FLOOR_MS, bombs: 1 },
  3: { title: "Server Room", sub: "Long rows, and a Pal", rivals: ["sprinter", "hider", "trickster", "pal"], smart: 0.35, fuse: FUSE_MS, floor: FUSE_FLOOR_MS, bombs: 1 },
  4: { title: "Rooftop", sub: "No wall at the bottom: mind the drop", rivals: ["sprinter", "hider", "trickster", "pal"], smart: 0.45, fuse: FUSE_MS, floor: FUSE_FLOOR_MS, bombs: 1, open: true },
  5: { title: "Ice Machine", sub: "Slippery floor, and a Clingy", rivals: ["sprinter", "hider", "trickster", "pal", "clingy"], smart: 0.55, fuse: FUSE_MS, floor: FUSE_FLOOR_MS, bombs: 1 },
  6: { title: "Conveyor Hall", sub: "Belts carry everyone along", rivals: ["sprinter", "hider", "trickster", "pal", "clingy"], smart: 0.63, fuse: FUSE_MS, floor: FUSE_FLOOR_MS, bombs: 1 },
  7: { title: "Blackout", sub: "Lights out: follow the glow", rivals: ["sprinter", "hider", "trickster", "pal", "clingy"], smart: 0.72, fuse: FUSE_MS, floor: FUSE_FLOOR_MS, bombs: 1, dark: true },
  8: { title: "Two Bombs", sub: "Two bombs, two fuses", rivals: ["sprinter", "hider", "trickster", "pal", "clingy", "sprinter"], smart: 0.82, fuse: FUSE_MS, floor: FUSE_FLOOR_MS, bombs: 2 },
  9: { title: "Finale", sub: "Shorter fuses, and everything", rivals: ["sprinter", "hider", "trickster", "pal", "clingy", "trickster"], smart: 1, fuse: 10000, floor: 4000, bombs: 2 },
});

const rect = (x, y, w, h, kind) => Object.freeze({ x, y, w, h, kind });
const disc = (x, y, r) => Object.freeze({ x, y, r });
const belt = (x, y, w, h, dx) => Object.freeze({ x, y, w, h, dx });
const layout = (blocks, ice = [], belts = []) => Object.freeze({ blocks: Object.freeze(blocks), ice: Object.freeze(ice), belts: Object.freeze(belts) });

// Each venue's floor, in arena units: the things to run round (each a `kind`
// for the drawing), ice patches and conveyor belts (`dx` the way they run).
export const LAYOUTS = Object.freeze({
  1: layout([rect(18, 15, 16, 8, "table"), rect(70, 15, 16, 8, "table"), rect(18, 47, 16, 8, "table"), rect(70, 47, 16, 8, "table"), rect(48, 31, 8, 8, "cooler")]),
  2: layout([rect(14, 13, 22, 7, "desk"), rect(68, 13, 22, 7, "desk"), rect(41, 31, 22, 8, "desk"), rect(14, 50, 22, 7, "desk"), rect(68, 50, 22, 7, "desk")]),
  3: layout([rect(10, 13, 34, 6, "rack"), rect(60, 13, 34, 6, "rack"), rect(18, 32, 30, 6, "rack"), rect(56, 32, 30, 6, "rack"), rect(10, 51, 34, 6, "rack"), rect(60, 51, 34, 6, "rack")]),
  4: layout([rect(16, 12, 14, 10, "vent"), rect(74, 12, 14, 10, "vent"), rect(45, 24, 14, 14, "tank"), rect(26, 40, 9, 7, "box"), rect(69, 40, 9, 7, "box")]),
  5: layout([rect(46, 27, 12, 16, "icebox"), rect(14, 12, 11, 8, "crate"), rect(79, 12, 11, 8, "crate"), rect(14, 50, 11, 8, "crate"), rect(79, 50, 11, 8, "crate")], [disc(31, 35, 9), disc(73, 35, 9), disc(52, 11, 7), disc(52, 59, 7)]),
  6: layout([rect(20, 31, 8, 8, "pillar"), rect(48, 31, 8, 8, "pillar"), rect(76, 31, 8, 8, "pillar"), rect(44, 3, 16, 7, "crate"), rect(44, 60, 16, 7, "crate")], [], [belt(6, 18, 92, 9, 1), belt(6, 43, 92, 9, -1)]),
  7: layout([rect(14, 10, 5, 22, "cubicle"), rect(85, 38, 5, 22, "cubicle"), rect(28, 51, 22, 5, "cubicle"), rect(54, 14, 22, 5, "cubicle"), rect(46, 30, 12, 10, "table")]),
  8: layout([rect(22, 15, 9, 9, "pillar"), rect(73, 15, 9, 9, "pillar"), rect(22, 46, 9, 9, "pillar"), rect(73, 46, 9, 9, "pillar"), rect(46, 30, 12, 10, "cooler")]),
  9: layout([rect(18, 27, 10, 16, "crate"), rect(76, 27, 10, 16, "crate"), rect(43, 20, 18, 6, "rack"), rect(43, 44, 18, 6, "rack")], [disc(52, 35, 6)], [belt(6, 5, 92, 8, 1), belt(6, 57, 92, 8, -1)]),
});

export const layoutFor = (level) => LAYOUTS[Math.min(MAX_VENUE, Math.max(1, Math.floor(level) || 1))];

// Venues past the ninth are the Finale again, named Finale 2, Finale 3 and
// on, its rivals a little quicker and its fuses a little shorter. The rules
// ask for it many times a slice, so each one is built once.
const FINALS = new Map();
export function venueFor(level) {
  const n = Math.max(1, Math.floor(level) || 1);
  if (n <= MAX_VENUE) return VENUES[n];
  if (!FINALS.has(n)) {
    const extra = n - MAX_VENUE;
    const last = VENUES[MAX_VENUE];
    FINALS.set(n, Object.freeze({ ...last, title: `Finale ${extra + 1}`, sub: "Sharper rivals, shorter fuses", fuse: Math.max(7000, last.fuse - extra * 500), floor: Math.max(3000, last.floor - extra * 200), pace: 1 + Math.min(0.12, extra * 0.02) }));
  }
  return FINALS.get(n);
}

// How a rival runs at the round's venue: its speed as part of yours, how
// often it thinks, how long its wind-up, how often it dodges a lunge, how
// often it misjudges and how far ahead it leads a target. Asked for every
// runner every slice, so each venue's is built once.
const POWER_AT = new Map();
export function rivalPower(level) {
  const spec = venueFor(level);
  if (!POWER_AT.has(spec)) {
    const s = spec.smart;
    const pace = spec.pace || 1;
    POWER_AT.set(
      spec,
      Object.freeze({
        smart: s,
        speed: (0.82 + 0.18 * s) * pace,
        thinkMs: THINK_MS - (THINK_MS - THINK_FAST_MS) * s,
        windupMs: WINDUP_MS - (WINDUP_MS - WINDUP_FAST_MS) * s,
        dodge: 0.2 + 0.65 * s,
        misjudge: (1 - s) * MISJUDGE,
        lead: 0.35 * s,
        lungeOdds: 0.3 + 0.6 * s,
      }),
    );
  }
  return POWER_AT.get(spec);
}

// The fuse for the `n`th lit in a match (from 0) at the round's venue.
export function fuseFor(round, n) {
  const spec = venueFor(round.level);
  return Math.max(spec.floor, spec.fuse - n * FUSE_STEP_MS);
}

// The rivals' colors by their place in the line-up, kept apart from the bomb
// red and from each other.
export const RIVAL_COLORS = Object.freeze(["#ff8a1f", "#2fbf71", "#a466ff", "#ff4fa3", "#14b8a6", "#b07a45"]);

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

// The rivals' colors in line-up order with yours as `you`: RIVAL_COLORS, but
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
const len = (x, y) => Math.hypot(x, y);
const unit = (x, y) => {
  const d = Math.hypot(x, y);
  return d > 1e-9 ? { x: x / d, y: y / d } : { x: 0, y: 0 };
};

/* ------------------------------------------------------------- the floor */

const cellOf = (x, y) => clamp(Math.floor(y / GRID), 0, GH - 1) * GW + clamp(Math.floor(x / GRID), 0, GW - 1);
const cellX = (c) => (c % GW) * GRID + GRID / 2;
const cellY = (c) => Math.floor(c / GW) * GRID + GRID / 2;

// The point of a rectangle nearest (x, y), and how far off it is.
function rectGap(b, x, y) {
  const nx = clamp(x, b.x, b.x + b.w);
  const ny = clamp(y, b.y, b.y + b.h);
  return len(x - nx, y - ny);
}

// Shuts every grid cell a runner's center cannot (or, by the roof's edge,
// should not) reach: in or by an obstacle, against a wall.
function buildNav(round) {
  const nav = round.nav;
  for (let c = 0; c < CELLS; c++) {
    const x = cellX(c);
    const y = cellY(c);
    let shut = x < INFLATE || x > AW - INFLATE || y < INFLATE || (round.open ? y > AH - EDGE_SAFE : y > AH - INFLATE);
    for (let k = 0; !shut && k < round.blocks.length; k++) if (rectGap(round.blocks[k], x, y) < INFLATE) shut = true;
    nav[c] = shut ? 1 : 0;
  }
}

// True when a straight run from (ax, ay) to (bx, by) crosses no shut cell.
export function clearLine(round, ax, ay, bx, by) {
  const d = len(bx - ax, by - ay);
  const n = Math.max(1, Math.ceil(d / (GRID * 0.5)));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (round.nav[cellOf(ax + (bx - ax) * t, ay + (by - ay) * t)]) return false;
  }
  return true;
}

// Scratch for a runner's own distance field, worked out and used inside one
// think, and the queue both fields share.
const SELF = new Int16Array(CELLS);
const QUEUE = new Int32Array(CELLS);
const STEPS = Object.freeze([
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]);

// Steps from the source cells to every cell (-1 where none reach), eight
// ways round, never cutting a shut corner. A shut cell is entered only from
// another shut one, so a runner pressed against a wall still finds its way
// out.
function flood(round, out, sources) {
  out.fill(-1);
  let head = 0;
  let tail = 0;
  for (const c of sources) {
    if (out[c] >= 0) continue;
    out[c] = 0;
    QUEUE[tail++] = c;
  }
  const nav = round.nav;
  while (head < tail) {
    const c = QUEUE[head++];
    const cx = c % GW;
    const cy = (c - cx) / GW;
    const shut = nav[c];
    for (const [dx, dy] of STEPS) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
      const n = y * GW + x;
      if (out[n] >= 0 || (nav[n] && !shut)) continue;
      if (dx && dy && (nav[cy * GW + x] || nav[y * GW + cx]) && !shut) continue;
      out[n] = out[c] + 1;
      QUEUE[tail++] = n;
    }
  }
  return out;
}

// The way to run from a runner toward (gx, gy): straight there when nothing
// is in the way, else along the runner's own field (SELF, flooded from it)
// toward the cell LOOK steps along the path.
function wayTo(round, r, gx, gy) {
  if (clearLine(round, r.x, r.y, gx, gy)) return unit(gx - r.x, gy - r.y);
  let c = cellOf(gx, gy);
  if (SELF[c] < 0) return unit(gx - r.x, gy - r.y);
  while (SELF[c] > LOOK) {
    const cx = c % GW;
    const cy = (c - cx) / GW;
    let next = -1;
    for (const [dx, dy] of STEPS) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
      const n = y * GW + x;
      if (SELF[n] === SELF[c] - 1) {
        next = n;
        break;
      }
    }
    if (next < 0) break;
    c = next;
  }
  return unit(cellX(c) - r.x, cellY(c) - r.y);
}

// How boxed in a point is: of the four ways out, how many hit a wall or an
// obstacle within `reach`.
function boxedIn(round, x, y, reach = 10) {
  let n = 0;
  if (!clearLine(round, x, y, x + reach, y)) n++;
  if (!clearLine(round, x, y, x - reach, y)) n++;
  if (!clearLine(round, x, y, x, y + reach)) n++;
  if (!clearLine(round, x, y, x, y - reach)) n++;
  return n;
}

const nearCover = (round, x, y, reach = 6) => round.blocks.some((b) => rectGap(b, x, y) < RUNNER_R + reach);

const onIce = (round, x, y) => round.ice.some((p) => len(x - p.x, y - p.y) < p.r);
const beltAt = (round, x, y) => round.belts.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) || null;

/* ------------------------------------------------------------- runners */

function makeRunner(id, kind, x, y) {
  const spec = kind === "planny" ? { top: 1, grip: 1 } : RIVALS[kind];
  return {
    id,
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    face: 1,
    top: spec.top,
    grip: spec.grip,
    speed: SPEED,
    alive: true,
    out: null,
    outMs: 0,
    outX: 0,
    outY: 0,
    charges: START_CHARGES,
    recharge: 0,
    dashMs: 0,
    dashX: 0,
    dashY: 0,
    lunge: 0,
    pending: 0,
    blind: 0,
    fx: {},
    push: { x: 0, y: 0 },
    walk: false,
    think: 0,
    target: null,
    windup: 0,
    windDir: null,
    fake: 0,
    dodged: 0,
    stride: 0,
  };
}

// Spawn spots round an ellipse, you at the bottom, each moved to the nearest
// open cell.
function spawnAt(round, i, n) {
  const a = Math.PI / 2 + (i * Math.PI * 2) / n;
  const x = AW / 2 + Math.cos(a) * 36;
  const y = AH / 2 + Math.sin(a) * 22;
  let c = cellOf(x, y);
  if (round.nav[c]) {
    let best = -1;
    for (let k = 0; k < CELLS; k++) if (!round.nav[k] && (best < 0 || len(cellX(k) - x, cellY(k) - y) < len(cellX(best) - x, cellY(best) - y))) best = k;
    if (best >= 0) c = best;
  }
  return { x: cellX(c), y: cellY(c) };
}

// The bomb a runner holds, or null.
export const bombOf = (round, r) => round.bombs.find((b) => b.lit && b.holder === r.id) || null;
export const holding = (round, r) => round.bombs.some((b) => b.lit && b.holder === r.id);

function light(round, bomb, holder) {
  bomb.lit = true;
  bomb.holder = holder.id;
  bomb.max = fuseFor(round, round.fuses);
  bomb.fuse = bomb.max;
  bomb.lock = NO_TAGBACK_MS;
  bomb.gap = 0;
  bomb.from = null;
  bomb.lifted = [];
  round.fuses += 1;
  holder.think = 0;
  round.events.push({ type: "lit", holder: holder.id, fuse: bomb.max, x: holder.x, y: holder.y });
}

const pickOf = (list, random) => list[Math.min(list.length - 1, Math.floor(random() * list.length))];

// How many bombs may burn at once with `alive` runners left: the venue's
// count, but never more than one for every two runners.
const bombsFor = (round, alive) => Math.min(venueFor(round.level).bombs, Math.max(1, Math.floor(alive / 2)));

// A fresh match at `venue`: the runners on their spawns, the venue's floor,
// and its bombs on rivals picked at random (never you in a match's first
// fuse, so new players see the rules first). Nothing burns until the hold
// is over.
export function newMatch(round, venue = round.level, random = Math.random, readyMs = READY_MS) {
  round.level = Math.max(1, Math.floor(venue) || 1);
  const spec = venueFor(round.level);
  const floor = layoutFor(round.level);
  round.blocks = floor.blocks;
  round.ice = floor.ice;
  round.belts = floor.belts;
  round.open = Boolean(spec.open);
  round.dark = Boolean(spec.dark);
  buildNav(round);
  const kinds = ["planny", ...spec.rivals];
  round.runners = kinds.map((kind, i) => {
    const at = spawnAt(round, i, kinds.length);
    return makeRunner(i, kind, at.x, at.y);
  });
  for (const r of round.runners) if (r.id !== 0) r.face = r.x < AW / 2 ? 1 : -1;
  round.fuses = 0;
  round.bombs = [];
  const rivals = round.runners.slice(1);
  for (let k = 0; k < bombsFor(round, round.runners.length); k++) {
    const free = rivals.filter((r) => !holding(round, r));
    const bomb = { lit: false, holder: -1, fuse: 0, max: 0, lock: 0, gap: 0, from: null, lifted: [] };
    round.bombs.push(bomb);
    light(round, bomb, pickOf(free, random));
  }
  round.pickups = [];
  round.nextPick = FIRST_PICK_MS;
  round.freeze = 0;
  round.phase = "ready";
  round.phaseMs = readyMs;
  round.clock = 0;
  round.threatAt = -Infinity;
  round.result = null;
  round.lunges = 0;
  return round;
}

export function newRound(random = Math.random) {
  const round = {
    level: 1,
    lives: START_LIVES,
    score: 0,
    matchesWon: 0,
    passes: 0,
    hotPasses: 0,
    streak: 0,
    bestStreak: 0,
    survived: 0,
    over: false,
    events: [],
    input: { up: false, down: false, left: false, right: false },
    nav: new Uint8Array(CELLS),
    threat: new Int16Array(CELLS),
  };
  return newMatch(round, 1, random, FIRST_READY_MS);
}

/* ------------------------------------------------------------- movement */

// The way your held arrows run, as a unit vector (zero with none held, or
// two that cancel).
export function inputDir(round) {
  const { up, down, left, right } = round.input;
  return unit(Number(right) - Number(left), Number(down) - Number(up));
}

// A runner's top speed right now: its own, a rival's venue pace, the bomb's
// HOLDER_SPEED, Sneakers, and a Hider's turn of speed near cover.
export function speedOf(round, r) {
  let s = SPEED * r.top;
  if (r.id !== 0) s *= rivalPower(round.level).speed;
  if (holding(round, r)) s *= HOLDER_SPEED;
  if (r.fx.sneakers > 0) s *= SNEAKERS;
  if (r.kind === "hider" && nearCover(round, r.x, r.y)) s *= RIVALS.hider.cover / RIVALS.hider.top;
  return s;
}

// Runs a runner along `dir` (a unit vector, or zero to stop) for `ms`: its
// speed eases toward `dir` times its top speed at GRIP times its own grip
// and the floor's (`grip`), plus a belt under it (`bx`, `by`). A dash holds
// its line until it is spent.
export function move(r, dir, ms, grip = GRIP, bx = 0, by = 0) {
  const dt = ms / 1000;
  let tx;
  let ty;
  if (r.dashMs > 0) {
    tx = r.dashX * (r.speed + DASH_SPEED) + bx;
    ty = r.dashY * (r.speed + DASH_SPEED) + by;
    r.vx = tx;
    r.vy = ty;
    r.dashMs = Math.max(0, r.dashMs - ms);
  } else {
    const walk = r.walk ? WALK : 1;
    tx = (dir ? dir.x : 0) * r.speed * walk + bx;
    ty = (dir ? dir.y : 0) * r.speed * walk + by;
    const k = 1 - Math.exp(-grip * r.grip * dt);
    r.vx += (tx - r.vx) * k;
    r.vy += (ty - r.vy) * k;
  }
  r.x += r.vx * dt;
  r.y += r.vy * dt;
  const sp = len(r.vx, r.vy);
  r.stride += sp * dt;
  if (Math.abs(r.vx) > 3) r.face = r.vx > 0 ? 1 : -1;
}

// Spends a dash charge: DASH_SPEED more along `dir` (your arrows, or the way
// you face with none held) for DASH_MS. One dash at a time. A holder's dash
// is a lunge, numbered so each runner it is aimed at reacts to it once.
export function dash(round, r, dir = null) {
  if (round.phase !== "play" || !r.alive || r.charges <= 0 || r.dashMs > 0) return false;
  let d = dir || (r.id === 0 ? inputDir(round) : r.push);
  if (!d || (!d.x && !d.y)) d = len(r.vx, r.vy) > 4 ? { x: r.vx, y: r.vy } : { x: r.face, y: 0 };
  d = unit(d.x, d.y);
  r.charges -= 1;
  r.dashMs = DASH_MS;
  r.dashX = d.x;
  r.dashY = d.y;
  r.windup = 0;
  r.fake = 0;
  const lunge = holding(round, r);
  r.lunge = lunge ? r.pending || ++round.lunges : 0;
  r.pending = 0;
  round.events.push({ type: "dash", id: r.id, lunge, x: r.x, y: r.y, dx: d.x, dy: d.y });
  return true;
}

// Pushes a runner out of the walls and the obstacles, dropping its speed into
// them. The Rooftop's bottom edge has no wall.
function hitWalls(round, r) {
  const R = RUNNER_R;
  if (r.x < R) {
    r.x = R;
    r.vx = Math.max(0, r.vx);
  } else if (r.x > AW - R) {
    r.x = AW - R;
    r.vx = Math.min(0, r.vx);
  }
  if (r.y < R) {
    r.y = R;
    r.vy = Math.max(0, r.vy);
  } else if (!round.open && r.y > AH - R) {
    r.y = AH - R;
    r.vy = Math.min(0, r.vy);
  }
  for (const b of round.blocks) {
    const nx = clamp(r.x, b.x, b.x + b.w);
    const ny = clamp(r.y, b.y, b.y + b.h);
    let dx = r.x - nx;
    let dy = r.y - ny;
    let d = len(dx, dy);
    if (d >= R) continue;
    if (d < 1e-9) {
      // The center inside the block: out through the nearest side.
      const sides = [r.x - b.x, b.x + b.w - r.x, r.y - b.y, b.y + b.h - r.y];
      const k = sides.indexOf(Math.min(...sides));
      dx = k === 0 ? -1 : k === 1 ? 1 : 0;
      dy = k === 2 ? -1 : k === 3 ? 1 : 0;
      d = 0;
      r.x = k === 0 ? b.x - R : k === 1 ? b.x + b.w + R : r.x;
      r.y = k === 2 ? b.y - R : k === 3 ? b.y + b.h + R : r.y;
    } else {
      dx /= d;
      dy /= d;
      r.x = nx + dx * R;
      r.y = ny + dy * R;
    }
    const into = r.vx * dx + r.vy * dy;
    if (into < 0) {
      r.vx -= dx * into;
      r.vy -= dy * into;
    }
  }
}

/* ------------------------------------------------------------- the bomb */

// True when `target` is the runner who just handed `bomb` over, safe from it
// while three or more are left.
export function tagBack(round, bomb, target) {
  if (!bomb.from || bomb.from.id !== target.id || round.clock - bomb.from.at >= TAGBACK_MS) return false;
  let alive = 0;
  for (const r of round.runners) if (r.alive) alive += 1;
  return alive >= 3;
}

// True while `r` is safe from some lit bomb's holder by the no tag-back rule
// (the drawing rings its feet, so a touch that passes nothing is no
// surprise).
export const tagSafe = (round, r) => r.alive && round.bombs.some((b) => b.lit && tagBack(round, b, r));

// Passes the bomb `holder` has to `target`: only while it holds one, the
// bomb is past its NO_TAGBACK_MS and still has fuse left (one that ran out
// in this slice blows on its holder, not on whoever it touched as it did),
// the target holds none and is not the one who just handed it over
// (tagBack). The two are knocked apart, and a fuse under PASS_FLOOR_MS is
// raised to it, rivals' passes and yours alike, once a fuse for each runner. A pass of
// yours scores PASS_POINTS, and a hot one (under HOT_MS left as it was
// passed) HOT_POINTS more times the streak it steps up; one that is not hot
// ends the streak.
// Returns true when the bomb changed hands.
export function tag(round, holder, target) {
  const bomb = bombOf(round, holder);
  if (!bomb || bomb.lock > 0 || bomb.fuse <= 0 || !target || target === holder || !target.alive || !holder.alive || holding(round, target) || tagBack(round, bomb, target)) return false;
  bomb.holder = target.id;
  bomb.lock = NO_TAGBACK_MS;
  bomb.from = { id: holder.id, at: round.clock };
  let n = unit(target.x - holder.x, target.y - holder.y);
  if (!n.x && !n.y) n = { x: 1, y: 0 };
  const nx = n.x;
  const ny = n.y;
  holder.vx -= nx * KNOCK;
  holder.vy -= ny * KNOCK;
  target.vx += nx * KNOCK;
  target.vy += ny * KNOCK;
  holder.dashMs = 0;
  for (const r of [holder, target]) {
    if (r.id === 0) continue;
    r.windup = 0;
    r.fake = 0;
    r.think = Math.min(r.think, 60);
    r.target = null;
  }
  const hot = bomb.fuse < HOT_MS;
  const lifted = (bomb.lifted ||= []);
  if (bomb.fuse < PASS_FLOOR_MS && !lifted.includes(target.id)) {
    lifted.push(target.id);
    bomb.fuse = PASS_FLOOR_MS;
    bomb.max = Math.max(bomb.max, bomb.fuse);
  }
  let points = 0;
  if (holder.id === 0) {
    round.passes += 1;
    points = PASS_POINTS;
    if (hot) {
      round.streak = Math.min(MAX_STREAK, round.streak + 1);
      round.bestStreak = Math.max(round.bestStreak, round.streak);
      round.hotPasses += 1;
      points += HOT_POINTS * round.streak;
    } else round.streak = 0;
    round.score += points;
  }
  round.events.push({ type: "tag", from: holder.id, to: target.id, hot, points, streak: holder.id === 0 && hot ? round.streak : 0, x: (holder.x + target.x) / 2, y: (holder.y + target.y) / 2 });
  return true;
}

// Burns every lit fuse by `ms`, after any Freeze left has used up its share.
// True when a fuse has run out.
export function burn(round, ms) {
  let left = ms;
  if (round.freeze > 0) {
    const used = Math.min(round.freeze, left);
    round.freeze -= used;
    left -= used;
  }
  let out = false;
  for (const b of round.bombs) {
    if (!b.lit) continue;
    b.lock = Math.max(0, b.lock - ms);
    b.fuse -= left;
    if (b.fuse <= 0) out = true;
  }
  return out;
}

// Takes a runner out of the match: blown up (it waddles off, charred) or
// off the roof. A bomb it held goes with it, to relight after RELIGHT_MS.
function knockOut(round, r, cause) {
  r.alive = false;
  r.out = cause;
  r.outMs = cause === "fall" ? FALL_MS : OUT_MS;
  r.dashMs = 0;
  r.windup = 0;
  // The way it waddles off: to the nearest side.
  const sides = [r.x, AW - r.x, r.y, AH - r.y];
  const k = sides.indexOf(Math.min(...sides));
  r.outX = k === 0 ? -1 : k === 1 ? 1 : 0;
  r.outY = k === 2 ? -1 : k === 3 ? 1 : 0;
  const bomb = round.bombs.find((b) => b.lit && b.holder === r.id);
  if (bomb) endFuse(round, bomb);
  return bomb;
}

// A fuse is over (its holder blown up or off the roof): survive points when
// that was not you, and the bomb dark until it relights.
function endFuse(round, bomb) {
  const victim = bomb.holder;
  bomb.lit = false;
  bomb.holder = -1;
  bomb.gap = RELIGHT_MS;
  const you = round.runners[0];
  if (victim !== 0 && you.alive) {
    const points = SURVIVE_POINTS * round.level;
    round.score += points;
    round.survived += 1;
    round.events.push({ type: "survive", points, x: you.x, y: you.y });
  }
}

// The bomb (the first whose fuse has run out, unless one is named) blows:
// its holder is out, everyone near is knocked back, and the match ends when
// that was you or leaves one runner standing.
export function blast(round, bomb = null) {
  const b = bomb || round.bombs.find((k) => k.lit && k.fuse <= 0) || round.bombs.find((k) => k.lit);
  if (!b || !b.lit) return null;
  const victim = round.runners[b.holder];
  const x = victim.x;
  const y = victim.y;
  knockOut(round, victim, "blast");
  for (const r of round.runners) {
    if (!r.alive) continue;
    const d = len(r.x - x, r.y - y);
    if (d >= BLAST_R) continue;
    let n = unit(r.x - x, r.y - y);
    if (!n.x && !n.y) n = { x: 1, y: 0 };
    const kick = BLAST_KICK * (1 - d / BLAST_R);
    r.vx += n.x * kick;
    r.vy += n.y * kick;
  }
  round.events.push({ type: "blast", id: victim.id, x, y });
  checkEnd(round);
  return victim;
}

// Relights a dark bomb on a survivor picked at random (one that holds no
// other bomb), with the next, shorter fuse, unless the runners left are too
// few for another bomb. Returns the new holder, or null.
export function nextFuse(round, bomb = null, random = Math.random) {
  const b = bomb || round.bombs.find((k) => !k.lit);
  if (!b || b.lit || round.phase !== "play") return null;
  const alive = round.runners.filter((r) => r.alive);
  const lit = round.bombs.filter((k) => k.lit).length;
  if (alive.length < 2 || lit >= bombsFor(round, alive.length)) {
    b.gap = 0;
    return null;
  }
  const free = alive.filter((r) => !holding(round, r));
  if (!free.length) return null;
  const holder = pickOf(free, random);
  light(round, b, holder);
  return holder;
}

function checkEnd(round) {
  if (round.phase !== "play") return;
  const you = round.runners[0];
  const left = round.runners.filter((r) => r.alive).length;
  if (!you.alive) endMatch(round, "lose");
  else if (left <= 1) endMatch(round, "win");
}

function endMatch(round, result) {
  round.phase = "done";
  round.phaseMs = DONE_MS;
  round.result = result;
  for (const b of round.bombs) b.lit = false;
  if (result === "win") {
    const points = WIN_POINTS * round.level;
    round.score += points;
    round.matchesWon += 1;
    round.events.push({ type: "win", points, level: round.level });
  } else {
    if (!round.infinite) round.lives -= 1;
    round.streak = 0;
    round.events.push({ type: "lose", lives: round.lives });
  }
}

// After a match's result has shown: the next venue on a win, the same one
// again otherwise, and the end of the round when the last life is gone.
function nextMatch(round, random) {
  if (round.result === "lose" && round.lives <= 0) {
    round.over = true;
    round.events.push({ type: "over" });
    return;
  }
  const won = round.result === "win";
  newMatch(round, won ? round.level + 1 : round.level, random);
  round.events.push(won ? { type: "level", level: round.level } : { type: "retry", lives: round.lives });
}

/* -------------------------------------------------------------- pickups */

export function applyPower(round, r, kind, random = Math.random) {
  if (!POWERS[kind]) return false;
  if (kind === "freeze") round.freeze = Math.max(round.freeze, FREEZE_MS);
  else if (kind === "sneakers") r.fx.sneakers = SNEAKERS_MS;
  else if (kind === "extra") {
    for (const b of round.bombs) {
      if (!b.lit) continue;
      b.fuse += EXTRA_MS;
      b.max = Math.max(b.max, b.fuse);
    }
  } else if (kind === "swap") {
    const others = round.runners.filter((o) => o.alive && o !== r);
    if (others.length) {
      const o = pickOf(others, random);
      [r.x, o.x] = [o.x, r.x];
      [r.y, o.y] = [o.y, r.y];
      for (const k of [r, o]) {
        k.vx = 0;
        k.vy = 0;
        k.dashMs = 0;
      }
      round.events.push({ type: "swap", a: r.id, b: o.id, x: r.x, y: r.y, ox: o.x, oy: o.y });
    }
  }
  round.events.push({ type: "power", id: r.id, kind, x: r.x, y: r.y });
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

// A pickup on an open cell clear of every runner.
export function spawnPickup(round, kind, random = Math.random) {
  for (let tries = 0; tries < 60; tries++) {
    const c = Math.floor(random() * CELLS) % CELLS;
    if (round.nav[c]) continue;
    const x = cellX(c);
    const y = cellY(c);
    if (round.runners.some((r) => r.alive && len(r.x - x, r.y - y) < 12)) continue;
    const p = { x, y, kind, ttl: PICK_TTL_MS };
    round.pickups.push(p);
    return p;
  }
  return null;
}

/* -------------------------------------------------------------- rivals */

// The holders' distance field (THREAT, flooded from every holder), kept a
// little while since every rival asks for it.
function threatField(round) {
  if (round.clock - round.threatAt < THREAT_MS && round.threatAt <= round.clock) return round.threat;
  const sources = [];
  for (const b of round.bombs) if (b.lit) sources.push(cellOf(round.runners[b.holder].x, round.runners[b.holder].y));
  if (sources.length) flood(round, round.threat, sources);
  else round.threat.fill(-1);
  round.threatAt = round.clock;
  return round.threat;
}

// The runner a holder goes after: the nearest by the path its own field
// (SELF) says, weighted toward one with the slowest escape (boxed in, no
// dash left) unless the fuse is nearly out, and a little toward the one it
// already chases. Spread by distance, so you are not always the target.
function pickTarget(round, r, bomb, random, sharp) {
  const desperate = bomb.fuse < DESPERATE_MS;
  let best = null;
  for (const t of round.runners) {
    if (t === r || !t.alive || holding(round, t) || tagBack(round, bomb, t)) continue;
    const steps = SELF[cellOf(t.x, t.y)];
    let cost = steps >= 0 ? steps * GRID : len(t.x - r.x, t.y - r.y) * 3;
    if (!desperate) {
      cost -= boxedIn(round, t.x, t.y) * 4;
      if (t.charges <= 0) cost -= 5;
      if (t.id === r.target) cost -= 6;
      cost += random() * 10 * (1 - sharp);
    }
    if (!best || cost < best.cost) best = { t, cost };
  }
  return best ? best.t : null;
}

// A rival's choice, made every think: the way it runs ({ x, y }, a unit
// vector or zero), whether it walks, whether it dashes, and the runner it is
// after (null for none). Holding a bomb, it chases; not holding one, it
// flees the holders by their path, for spots it reaches before they do, out
// in the open and near other runners. Each personality bends that. Works for
// you too (the scratch sims drive Planny with it).
export function think(round, r, random = Math.random) {
  const power = rivalPower(round.level);
  const sharp = power.smart;
  flood(round, SELF, [cellOf(r.x, r.y)]);
  const bomb = bombOf(round, r);
  const you = round.runners[0];
  if (bomb) {
    // A Freeze or an Extra Fuse much nearer than anyone to tag is worth it
    // once the fuse runs low (Sneakers and Swap buy no time).
    const target = pickTarget(round, r, bomb, random, sharp);
    if (bomb.fuse < 5000) {
      const pick = round.pickups.find((p) => (p.kind === "freeze" || p.kind === "extra") && SELF[cellOf(p.x, p.y)] >= 0);
      if (pick && (!target || SELF[cellOf(pick.x, pick.y)] * 2 < SELF[cellOf(target.x, target.y)])) {
        const d = wayTo(round, r, pick.x, pick.y);
        return { x: d.x, y: d.y, walk: false, dash: false, target: target ? target.id : null };
      }
    }
    if (!target) return { x: 0, y: 0, walk: false, dash: false, target: null };
    const gx = target.x + target.vx * power.lead;
    const gy = target.y + target.vy * power.lead;
    const d = wayTo(round, r, gx, gy);
    const dist = len(target.x - r.x, target.y - r.y);
    let lunge = bomb.lock <= 0 && r.charges > 0 && dist < LUNGE_RANGE * (0.75 + 0.25 * sharp) && clearLine(round, r.x, r.y, target.x, target.y) && random() < power.lungeOdds;
    // Never lunge off the roof, unless it misjudges.
    if (lunge && round.open && r.y + d.y * 22 > AH - 2 && random() > power.misjudge) lunge = false;
    return { x: d.x, y: d.y, walk: false, dash: lunge, target: target.id };
  }
  const threat = threatField(round);
  const holders = round.bombs.filter((b) => b.lit).map((b) => round.runners[b.holder]);
  if (!holders.length) {
    // Nothing burning: amble somewhere open, a Pal toward you.
    const goal = r.kind === "pal" && you.alive && r !== you ? { x: you.x, y: you.y } : { x: AW / 2 + (random() - 0.5) * 50, y: AH / 2 + (random() - 0.5) * 30 };
    const d = wayTo(round, r, goal.x, goal.y);
    return { x: d.x, y: d.y, walk: true, dash: false, target: null };
  }
  let near = holders[0];
  for (const h of holders) if (len(h.x - r.x, h.y - r.y) < len(near.x - r.x, near.y - r.y)) near = h;
  const nearDist = len(near.x - r.x, near.y - r.y);
  const chased = holders.some((h) => h.target === r.id);
  const myThreat = threat[cellOf(r.x, r.y)] >= 0 ? threat[cellOf(r.x, r.y)] : Infinity;
  // A Clingy runner not chased hangs just behind the nearest holder, out of
  // reach, betting the bomb goes to someone else.
  if (r.kind === "clingy" && !chased) {
    const back = len(near.vx, near.vy) > 4 ? unit(-near.vx, -near.vy) : unit(r.x - near.x, r.y - near.y);
    const gx = clamp(near.x + back.x * (LUNGE_RANGE + 4), RUNNER_R, AW - RUNNER_R);
    const gy = clamp(near.y + back.y * (LUNGE_RANGE + 4), RUNNER_R, AH - RUNNER_R);
    if (!round.nav[cellOf(gx, gy)]) {
      const d = wayTo(round, r, gx, gy);
      return { x: d.x, y: d.y, walk: nearDist > LUNGE_RANGE + 10, dash: false, target: null };
    }
  }
  // Candidate spots: eight ways round at two reaches and a few at random.
  let best = null;
  const misjudge = random() < power.misjudge;
  const consider = (x, y) => {
    x = clamp(x, RUNNER_R, AW - RUNNER_R);
    y = clamp(y, RUNNER_R, AH - RUNNER_R);
    const c = cellOf(x, y);
    if (round.nav[c] || SELF[c] < 0) return;
    const td = threat[c] >= 0 ? threat[c] : 60;
    const sd = SELF[c];
    let score = misjudge ? random() * 100 : td * 2 - sd * 1.1;
    if (!misjudge) {
      // A spot the holder reaches first is no escape.
      if (sd >= td) score -= 40;
      score -= boxedIn(round, x, y, 9) * 5;
      for (const o of round.runners) {
        if (o === r || !o.alive || holding(round, o)) continue;
        if (len(o.x - x, o.y - y) < 14 && threat[cellOf(o.x, o.y)] >= 0 && threat[cellOf(o.x, o.y)] < td) score += 4;
      }
      if (r.kind === "hider" && nearCover(round, x, y, 4) && !clearLine(round, near.x, near.y, x, y)) score += 14;
      if (r.kind === "pal" && you.alive && r !== you) score -= len(you.x - x, you.y - y) * 0.35;
      score += random() * 10 * (1 - sharp);
    }
    if (!best || score > best.score) best = { x, y, score };
  };
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    consider(r.x + Math.cos(a) * 10, r.y + Math.sin(a) * 10);
    consider(r.x + Math.cos(a) * 20, r.y + Math.sin(a) * 20);
  }
  for (let k = 0; k < 4; k++) consider(random() * AW, random() * AH);
  const d = best ? wayTo(round, r, best.x, best.y) : unit(r.x - near.x, r.y - near.y);
  const calm = !chased && nearDist > CALM_RANGE && myThreat > CALM_RANGE / GRID;
  // A Trickster dashes off ahead of a holder closing in, with a feint first.
  const juke = r.kind === "trickster" && chased && nearDist < LUNGE_RANGE + 6 && r.charges > 0 && random() < 0.25 + 0.5 * sharp;
  return { x: d.x, y: d.y, walk: calm, dash: juke, target: null };
}

// A runner a lunge is coming at dodges it, once a lunge, at the rival's
// odds and only after its reaction time: a dash across the lunge, away from
// the side it is coming. A lunge is coming when a rival holder winds one up
// at it, or a holder's dash (yours too) heads its way.
function react(round, r, random) {
  if (r.charges <= 0 || r.dashMs > 0 || r.windup > 0 || r.fake > 0 || holding(round, r)) return;
  const power = rivalPower(round.level);
  const late = REACT_MS - (REACT_MS - REACT_FAST_MS) * power.smart;
  for (const b of round.bombs) {
    if (!b.lit) continue;
    const h = round.runners[b.holder];
    if (len(h.x - r.x, h.y - r.y) > LUNGE_RANGE + 6) continue;
    let id = 0;
    if (h.windup > 0 && h.target === r.id && power.windupMs - h.windup >= late) id = h.pending;
    else if (h.dashMs > 0 && h.lunge && DASH_MS - h.dashMs >= late) {
      const to = unit(r.x - h.x, r.y - h.y);
      if (to.x * h.dashX + to.y * h.dashY > 0.75) id = h.lunge;
    }
    if (!id || r.dodged === id) continue;
    r.dodged = id;
    if (random() >= power.dodge) continue;
    const toward = unit(r.x - h.x, r.y - h.y);
    let side = { x: -toward.y, y: toward.x };
    if (side.x * r.vx + side.y * r.vy < 0) side = { x: -side.x, y: -side.y };
    if (round.nav[cellOf(r.x + side.x * 12, r.y + side.y * 12)]) side = { x: -side.x, y: -side.y };
    const d = unit(side.x + toward.x * 0.4, side.y + toward.y * 0.4);
    if (dash(round, r, d)) round.events.push({ type: "dodge", id: r.id, x: r.x, y: r.y });
    return;
  }
}

// A rival's turn at a slice: a wind-up or a feint running its course and then
// the dash, a dodge, or a new think when its last one is old.
function drive(round, r, ms, random) {
  const power = rivalPower(round.level);
  if (r.windup > 0) {
    r.windup -= ms;
    if (r.windup > 0) return;
    // At the release a sharp rival bends its lunge toward where the target
    // has got to; a sloppy one goes the way it wound up.
    let d = r.windDir;
    const t = round.runners.find((o) => o.id === r.target && o.alive);
    if (t) {
      const to = unit(t.x + t.vx * 0.08 - r.x, t.y + t.vy * 0.08 - r.y);
      d = unit(d.x + (to.x - d.x) * power.smart * 0.7, d.y + (to.y - d.y) * power.smart * 0.7);
    }
    r.push = d;
    dash(round, r, d);
    return;
  }
  if (r.fake > 0) {
    r.fake -= ms;
    if (r.fake > 0) return;
    r.push = r.windDir;
    dash(round, r, r.windDir);
    return;
  }
  react(round, r, random);
  r.blind = Math.max(0, r.blind - ms);
  r.think -= ms;
  if (r.think > 0) return;
  r.think = power.thinkMs * (0.8 + 0.4 * random());
  const choice = think(round, r, random);
  r.push = { x: choice.x, y: choice.y };
  r.walk = choice.walk;
  r.target = choice.target;
  // Now and then a sloppy rival stops minding the roof's edge a moment.
  if (round.open && r.blind <= 0 && random() < power.misjudge * 0.3) r.blind = BLIND_MS;
  if (!choice.dash) return;
  r.windDir = r.push;
  if (holding(round, r)) r.pending = ++round.lunges;
  if (r.kind === "trickster") {
    // One step the wrong way, then the real dash.
    r.fake = FAKE_MS;
    r.push = { x: -r.windDir.y * 0.6 - r.windDir.x * 0.8, y: r.windDir.x * 0.6 - r.windDir.y * 0.8 };
    round.events.push({ type: "fake", id: r.id, x: r.x, y: r.y });
  } else if (holding(round, r)) {
    r.windup = power.windupMs;
    r.push = { x: 0, y: 0 };
    round.events.push({ type: "windup", id: r.id, x: r.x, y: r.y });
  } else dash(round, r, r.windDir);
}

/* ------------------------------------------------------------- the match */

// Every touching pair once: pushed apart evenly, and a holder touching a
// runner with no bomb passes it on.
function touchAll(round) {
  const rs = round.runners;
  for (let i = 0; i < rs.length; i++) {
    const a = rs[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < rs.length; j++) {
      const b = rs[j];
      if (!b.alive) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = len(dx, dy);
      if (d >= RUNNER_R * 2 + TAG_SLOP) continue;
      if (round.phase === "play") {
        if (holding(round, a) && !holding(round, b)) tag(round, a, b);
        else if (holding(round, b) && !holding(round, a)) tag(round, b, a);
      }
      const overlap = RUNNER_R * 2 - d;
      if (overlap <= 0) continue;
      const n = d > 1e-9 ? { x: dx / d, y: dy / d } : { x: 1, y: 0 };
      a.x -= (n.x * overlap) / 2;
      a.y -= (n.y * overlap) / 2;
      b.x += (n.x * overlap) / 2;
      b.y += (n.y * overlap) / 2;
    }
  }
}

// The knocked-out runners: a charred one waddles off to the nearest wall and
// stops there (never through a wall or a table, nor up over the pills), one
// off the roof falls.
function moveOut(round, ms) {
  const dt = ms / 1000;
  for (const r of round.runners) {
    if (r.alive || r.outMs <= 0) continue;
    r.outMs = Math.max(0, r.outMs - ms);
    if (r.out === "fall") {
      r.y += 30 * dt;
    } else {
      r.x += r.outX * 16 * dt;
      r.y += r.outY * 16 * dt;
      r.stride += 16 * dt;
      hitWalls(round, r);
    }
  }
}

// One slice of a match in play.
function play(round, ms, random) {
  round.clock += ms;
  // The bombs: fuses burn, a dark one relights after its gap.
  burn(round, ms);
  for (const b of round.bombs) {
    if (b.lit || b.gap <= 0) continue;
    b.gap -= ms;
    if (b.gap <= 0) nextFuse(round, b, random);
  }
  if (round.level >= PICKUPS_LEVEL) {
    round.pickups = round.pickups.filter((p) => (p.ttl -= ms) > 0);
    if (!round.pickups.length) {
      round.nextPick -= ms;
      if (round.nextPick <= 0) {
        round.nextPick = PICK_MS + (random() - 0.5) * 2 * PICK_SPREAD_MS;
        spawnPickup(round, pickPower(random), random);
      }
    }
  }
  for (const r of round.runners) {
    if (!r.alive) continue;
    r.speed = speedOf(round, r);
    if (r.id !== 0) drive(round, r, ms, random);
    for (const kind of Object.keys(r.fx)) {
      r.fx[kind] -= ms;
      if (r.fx[kind] <= 0) delete r.fx[kind];
    }
    // A full runner banks nothing.
    if (r.charges < MAX_CHARGES) {
      r.recharge += ms;
      if (r.recharge >= RECHARGE_MS) {
        r.recharge = 0;
        r.charges += 1;
        if (r.id === 0) round.events.push({ type: "charge", charges: r.charges });
      }
    } else r.recharge = 0;
  }
  for (const r of round.runners) {
    if (!r.alive) continue;
    let dir = r.id === 0 ? inputDir(round) : r.push;
    // A rival minding the roof's edge never runs on over it.
    if (round.open && r.id !== 0 && r.blind <= 0 && r.dashMs <= 0 && r.y + Math.max(0, r.vy) * 0.12 > AH - RUNNER_R - 1 && dir.y > -0.3) dir = unit(dir.x * 0.5, -1);
    const b = beltAt(round, r.x, r.y);
    move(r, dir, ms, onIce(round, r.x, r.y) ? ICE_GRIP : GRIP, b ? b.dx * BELT_SPEED : 0, 0);
    hitWalls(round, r);
  }
  touchAll(round);
  for (const r of round.runners) {
    if (!r.alive) continue;
    hitWalls(round, r);
    const k = round.pickups.findIndex((p) => len(p.x - r.x, p.y - r.y) < PICK_R + RUNNER_R * 0.8);
    if (k >= 0) applyPower(round, r, round.pickups.splice(k, 1)[0].kind, random);
  }
  // Off the roof's open edge: out, and the bomb with it.
  if (round.open) {
    for (const r of round.runners) {
      if (!r.alive || r.y <= AH) continue;
      const bomb = knockOut(round, r, "fall");
      round.events.push({ type: "fall", id: r.id, x: r.x, y: AH, bomb: Boolean(bomb) });
      checkEnd(round);
    }
  }
  if (round.phase === "play") {
    for (const b of round.bombs) if (b.lit && b.fuse <= 0 && round.phase === "play") blast(round, b);
  }
  moveOut(round, ms);
}

// After a match ends, the runners coast to a stop while the result shows.
function settle(round, ms) {
  for (const r of round.runners) {
    if (!r.alive) continue;
    r.dashMs = 0;
    move(r, null, ms);
    hitWalls(round, r);
    if (round.open && r.y > AH - RUNNER_R) r.y = AH - RUNNER_R;
  }
  moveOut(round, ms);
}

// Moves the round on by `ms`: the hold before a match, the play, and the
// pause after it, in small slices.
export function advance(round, ms, random = Math.random) {
  let left = ms;
  while (left > 0 && !round.over) {
    const slice = Math.min(left, SLICE_MS);
    left -= slice;
    if (round.phase === "ready") {
      round.phaseMs -= slice;
      if (round.phaseMs <= 0) {
        round.phase = "play";
        round.events.push({ type: "go" });
      }
    } else if (round.phase === "done") {
      round.phaseMs -= slice;
      settle(round, slice);
      if (round.phaseMs <= 0) nextMatch(round, random);
    } else play(round, slice, random);
  }
  return round.over ? "over" : round.phase;
}

/* ------------------------------------------------------------- contract */

const MAX_PARTS = 400;

// The venue's name for the pills and the screens: "VENUE 3", or "FINALE 2".
const venueTag = (level) => (level > MAX_VENUE ? venueFor(level).title.toUpperCase() : `VENUE ${level}`);

// "Rooftop (venue 4 of 9)", or past the ninth "Finale 3 (venue 11)".
export function venueName(level) {
  const spec = venueFor(level);
  return level > MAX_VENUE ? `${spec.title} (venue ${level})` : `${spec.title} (venue ${level} of ${MAX_VENUE})`;
}

// The over screen's nudge to play again: the next venue not yet reached.
function teaser(furthest) {
  if (furthest < MAX_VENUE) return `Next up, venue ${furthest + 1}: ${VENUES[furthest + 1].title}.`;
  return "Every venue reached. How many Finales can you last?";
}

// The fuse tick: every TICK_SLOW_MS on a full fuse, down to TICK_FAST_MS at
// the end, and higher as it goes.
const TICK_SLOW_MS = 720;
const TICK_FAST_MS = 110;

// Each venue's room tone (a hum and its loudness) and the odd noise it makes
// now and then (none at Two Bombs and the Finale, where the crowd is enough).
const ROOM_TONES = Object.freeze({ 1: ["fuseFridge", 1], 2: ["fuseOffice", 1], 3: ["fuseServers", 1], 4: ["wind", 1], 5: ["fuseCompressor", 1], 6: ["fuseConveyor", 1], 7: ["fuseDark", 1], 8: ["crowd", 0.7], 9: ["crowd", 1] });
const ROOM_NOISES = Object.freeze({ 1: "fuseVend", 2: "fusePhone", 3: "fuseBeep", 4: "gust", 5: "fuseCubes", 6: "clank", 7: "fuseFlicker" });
// Under this speed you are standing, not running: no footsteps.
const STEP_SPEED = 6;
// The heartbeat starts once the bomb in your hands has this long left.
const HEART_MS = 3000;

// The sound's own bookkeeping, apart from the round: timers for the feet,
// the heartbeat and the room's noises, and what was so last frame (on ice,
// on a belt, in Sneakers, frozen, the pickups already heard).
const freshSfx = () => ({ step: 0, foot: false, beat: 0, room: 2500, ice: false, belt: false, sneak: false, frozen: false, heard: new WeakSet() });

function create({ canvas, tone = () => {}, hum = () => {}, onScore = () => {}, best = () => 0, memo = null }) {
  const ctx = canvas.getContext("2d");
  let colors = null;
  let round = newRound();
  let state = "ready";
  let u = MIN_CELL;
  let bestAtStart = 0;
  let beaten = false;
  // The furthest venue ever reached, and whether this round went past it.
  // Without a memo (the unit suite) it lasts as long as the game.
  let furthest = 1;
  let further = false;
  try {
    furthest = Math.max(1, memo ? Number(memo.get()) | 0 : 1);
  } catch {}
  // Sparks, floating words, smoke clouds, rings, the bomb's hops, the
  // banners, the shake and the flash, all in arena units and ms, so a resize
  // mid-match keeps them in place.
  let fx = null;
  const resetFx = () => (fx = { parts: [], floats: [], banners: [], rings: [], clouds: [], hops: [], streaks: [], ticks: 0, sfx: freshSfx(), shake: 0, shakeMag: 0, flash: null, clock: 0, combo: null, cheer: 0 });
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
    return rivalPalette[(id - 1) % rivalPalette.length];
  };
  // 1 for something on top of you, down to 0.2 across the arena: a rival's
  // pass or dash is heard louder the nearer it is.
  const nearYou = (p) => {
    const you = round.runners[0];
    return clamp(1 - Math.hypot(p.x - you.x, p.y - you.y) / 80, 0.2, 1);
  };
  const nameOf = (id) => (id === 0 ? "You" : round.runners[id] ? RIVALS[round.runners[id].kind].name : "A rival");

  const burst = (p, color, n, speed = 22) => {
    for (let i = 0; i < n && fx.parts.length < MAX_PARTS; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      fx.parts.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 350 + Math.random() * 350, max: 700, color, size: 0.5 + Math.random() * 0.6 });
    }
  };
  const float = (p, text, color, size = 2.8) => fx.floats.push({ x: p.x, y: p.y - 6, text, color, size, life: 1000, max: 1000 });
  const ring = (p, color, r0, grow, ms = 420) => fx.rings.push({ x: p.x, y: p.y, color, r0, grow, life: ms, max: ms });
  const banner = (title, sub, color, ms = 1800) => {
    if (fx.banners.length >= 3 || fx.banners.some((b) => b.title === title)) return null;
    const b = { title, sub, color, life: ms, max: ms, tag: "", row: null, see: 1 };
    fx.banners.push(b);
    return b;
  };
  // A shake still running keeps the stronger of the two; a new one starts
  // from its own strength, so one big blast never loudens every later shake.
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
    if (b) b.tag = level > MAX_VENUE ? `NEW FURTHEST: ${venueFor(level).title.toUpperCase()}` : `NEW VENUE ${level} / ${MAX_VENUE}`;
  };

  const handle = (e) => {
    const you = round.runners[0];
    if (e.type === "go") {
      tone("go");
      tone("fuseWhistle", 0.7);
    } else if (e.type === "lit") {
      tone("sizzle", e.holder === 0 ? 0.8 : 0.4);
      tone("fuseStrike", e.holder === 0 ? 0.9 : 0.4 * nearYou(e));
      if (e.holder === 0) float(e, "You've got it!", DANGER, 2.6);
      ring(e, DANGER, 2, 8, 360);
    } else if (e.type === "tag") {
      tone("pop", e.from === 0 || e.to === 0 ? 1 : 0.5, e.hot ? 1.4 : 1);
      tone("fuseToss", e.from === 0 ? 0.8 : 0.35 * nearYou(e), 0.9 + Math.random() * 0.2);
      if (e.to === 0) tone("fuseCatch", 0.9);
      fx.hops.push({ from: e.from, to: e.to, life: 100, max: 100 });
      burst(e, "#ffffff", 8, 14);
      if (e.from === 0) {
        if (e.hot) {
          float(e, `Hot pass! +${e.points}`, GOLD, 3.2);
          tone("combo", 1, 1 + 0.12 * e.streak);
          tone("sparkle", 0.5, 1 + 0.08 * e.streak);
          if (e.streak >= 3) tone("coinUp", 0.5, 1 + 0.06 * e.streak);
          if (e.streak > 1) fx.combo = { n: e.streak, life: 1600, max: 1600 };
          flash(GOLD, 200);
        } else float(e, `Pass +${e.points}`, "#ffffff", 2.4);
      } else if (e.to === 0) {
        float(you, "Yours!", DANGER, 2.8);
        shake(120, 0.4);
      } else if (e.hot) {
        float(e, "Close!", "#ffffff", 2.2);
        tone("fuseGasp", 0.4 * nearYou(e));
      }
    } else if (e.type === "dash") {
      tone("tunnel", e.id === 0 ? 0.8 : 0.35, e.lunge ? 1.2 : 0.9);
      if (e.id === 0) tone("fuseDash", 0.8, e.lunge ? 1.15 : 1);
      else if (e.lunge) tone("swoosh", 0.45 * nearYou(e));
    } else if (e.type === "windup") tone("rev", 0.45);
    else if (e.type === "fake") tone("swing", 0.5);
    else if (e.type === "dodge") {
      tone("shield", 0.35);
      tone("swoosh", 0.4 * nearYou(e), 1.2);
      float(e, "Dodge!", "#ffffff", 2.2);
    } else if (e.type === "blast") {
      const color = colorOf(e.id);
      fx.clouds.push({ x: e.x, y: e.y, life: 900, max: 900, seed: fx.clock });
      burst(e, GOLD, 24, 30);
      burst(e, color, 10, 18);
      ring(e, "#ffffff", 2, BLAST_R, 360);
      if (e.id === 0) {
        tone("crash");
        tone("boom");
        tone("explode");
        tone("aww", 0.7);
        shake(460, 1.3);
        flash(DANGER, 340);
      } else {
        tone("boom", 0.8);
        tone("blast", 0.5 + 0.5 * nearYou(e));
        tone("fuseOut", 0.6);
        tone("fuseGasp", 0.6);
        // Caught in the blast: knocked back off your feet.
        if (you.alive && Math.hypot(you.x - e.x, you.y - e.y) < BLAST_R) tone("thud", 0.8);
        shake(240, 0.7);
        float(e, `${nameOf(e.id)}: out!`, color, 2.6);
      }
    } else if (e.type === "fall") {
      tone("fall", e.id === 0 ? 1 : 0.6);
      tone("fuseRoofFall", e.id === 0 ? 1 : 0.5);
      if (e.id !== 0) tone("fuseGasp", 0.5);
      if (e.id === 0) {
        shake(300, 0.9);
        flash(DANGER, 300);
      } else float(e, `${nameOf(e.id)} fell!`, colorOf(e.id), 2.4);
    } else if (e.type === "survive") {
      tone("coin", 0.7);
      tone("coinUp", 0.35);
      float(e, `Survived +${e.points}`, GOLD, 2.6);
    } else if (e.type === "power") {
      const spec = POWERS[e.kind];
      burst(e, spec.color, e.id === 0 ? 22 : 10, 18);
      if (e.id === 0) {
        tone("power");
        tone("powerUp", 0.6);
        banner(spec.name, spec.blurb, spec.color, 1300);
      } else {
        tone("coin", 0.4, 0.8);
        float(e, `${nameOf(e.id)}: ${spec.name}`, spec.color, 2.2);
      }
      // What each one does, heard by everyone it touches.
      if (e.kind === "freeze") tone("fuseFreeze", 0.8);
      else if (e.kind === "extra") tone("fuseExtra", 0.7);
      else if (e.kind === "sneakers" && e.id === 0) tone("fuseSneakers", 0.8);
      if (e.kind === "freeze") ring(e, spec.color, 3, 30, 600);
    } else if (e.type === "swap") {
      tone("mystery", 0.7);
      tone("warp", e.a === 0 || e.b === 0 ? 0.8 : 0.35);
      ring({ x: e.x, y: e.y }, POWERS.swap.color, 1, 7, 400);
      ring({ x: e.ox, y: e.oy }, POWERS.swap.color, 1, 7, 400);
    } else if (e.type === "charge") {
      tone("eat", 0.45);
      tone("fuseRecharge", 0.5, 1 + 0.12 * (e.charges - 1));
      float(you, "+1 dash", "#ff8a1f", 2.2);
    } else if (e.type === "win") {
      tone("levelup");
      tone("victory");
      tone("applause", 0.7);
      tone("cheer", 0.6);
      flash(GOLD, 300);
      banner("Last one standing!", `+${e.points} points`, GOLD, DONE_MS);
      fx.cheer = DONE_MS;
      burst(you, GOLD, 40, 26);
    } else if (e.type === "lose") {
      tone("lifeLost", 0.8);
      if (e.lives === 1) tone("warn", 0.5);
      banner(you.out === "fall" ? "Off the roof!" : "Kaboom!", e.lives > 0 ? `${e.lives} ${e.lives === 1 ? "life" : "lives"} left` : "That was your last life", DANGER, DONE_MS);
    } else if (e.type === "level") {
      const spec = venueFor(e.level);
      tone("levelup");
      // Into the next venue: a fanfare, and a boss-sized one for a Finale.
      tone(e.level >= MAX_VENUE ? "bossIntro" : "fanfare", 0.7);
      flash(venueColor(e.level), 400);
      reach(e.level, banner(e.level > MAX_VENUE ? spec.title : `Venue ${e.level}`, `${spec.title}: ${spec.sub}`, venueColor(e.level), 2200));
    } else if (e.type === "over") tone("gameOver");
    else if (e.type === "retry") {
      tone("whoosh", 0.5);
      banner(venueFor(round.level).title, "Again! Last one standing wins", venueColor(round.level), 1400);
    }
  };

  // A score past the best this round began with: once a round, a fanfare.
  const checkBest = () => {
    if (beaten || !(bestAtStart > 0) || round.score <= bestAtStart) return;
    beaten = true;
    tone("best");
    tone("sparkle", 0.8);
    banner("New best!", "Every point from here is a record", GOLD, 1800);
  };

  const drain = () => {
    colors ||= readColors(canvas);
    for (const e of round.events.splice(0)) handle(e);
    checkBest();
  };

  // A banner sits on the half of the arena away from you, and fades almost
  // clear while you run under it.
  const bannerRow = () => (round.runners[0].y < AH / 2 ? AH * 0.72 : AH * 0.28);
  const underBanner = (row) => Math.abs(round.runners[0].y - row) < 10;

  // The fuse ticks on one clock, however many bombs burn (two clocks out of
  // step chattered at twice the rate): it follows the bomb you hold, else
  // the shortest burning, quicker and higher as that one burns down, and
  // louder when it is yours.
  const runTicks = (ms) => {
    if (round.phase !== "play" || round.freeze > 0) return;
    let b = null;
    for (const k of round.bombs) {
      if (!k.lit) continue;
      if (k.holder === 0) {
        b = k;
        break;
      }
      if (!b || k.fuse < b.fuse) b = k;
    }
    if (!b) return;
    fx.ticks += ms;
    const left = clamp(b.fuse / FUSE_MS, 0, 1);
    const every = TICK_FAST_MS + (TICK_SLOW_MS - TICK_FAST_MS) * left;
    if (fx.ticks < every) return;
    fx.ticks = 0;
    tone("tick", b.holder === 0 ? 0.9 : 0.4, 1 + (1 - left) * 0.9);
  };

  // The sounds that follow the play rather than an event: the room's tone,
  // the bombs' hiss (higher and louder as each burns down, louder the nearer
  // its holder, loudest in your hands), the Freeze's shimmer and the thaw,
  // a heartbeat while your bomb is nearly gone, your feet (a slide on ice, a
  // clank onto a belt), Sneakers wearing off, a pickup turning up and the
  // room's odd noises. Sound only: nothing here touches the round.
  const runSound = (ms) => {
    const s = fx.sfx;
    const you = round.runners[0];
    const playing = round.phase === "play";
    const run = you.alive ? Math.hypot(you.vx, you.vy) : 0;
    const pace = clamp(run / SPEED, 0, 1);
    const [room, loud] = ROOM_TONES[Math.min(MAX_VENUE, round.level)] || ROOM_TONES[1];
    hum("fuse:room", room, loud * (playing ? 0.85 : 0.5), room === "wind" ? 0.9 + 0.5 * pace : 1);
    const frozen = playing && round.freeze > 0;
    if (frozen) hum("fuse:chill", "fuseChill", 0.8);
    else if (playing) {
      if (s.frozen) tone("fuseThaw", 0.7);
      round.bombs.forEach((b, i) => {
        const h = b.lit ? round.runners[b.holder] : null;
        if (!h) return;
        const burnt = 1 - clamp(b.fuse / FUSE_MS, 0, 1);
        hum(`fuse:hiss${i}`, "fuse", (b.holder === 0 ? 1 : 0.2 + 0.5 * nearYou(h)) * (0.45 + 0.55 * burnt), 0.8 + 1.1 * burnt);
      });
    }
    s.frozen = frozen;
    // The heartbeat: quicker as your fuse runs out, held still by a Freeze.
    const mine = playing && !frozen ? round.bombs.find((b) => b.lit && b.holder === 0 && b.fuse < HEART_MS) : null;
    if (mine) {
      s.beat -= ms;
      if (s.beat <= 0) {
        s.beat = 360 + 540 * (mine.fuse / HEART_MS);
        tone("fusePulse", 0.9, 1 + 0.25 * (1 - mine.fuse / HEART_MS));
      }
    } else s.beat = 0;
    const sneak = Boolean(you.fx.sneakers > 0);
    if (s.sneak && !sneak && you.alive && playing) tone("powerDown", 0.4);
    s.sneak = sneak;
    for (const p of round.pickups) {
      if (s.heard.has(p)) continue;
      s.heard.add(p);
      tone("fusePickup", 0.5, 0.95 + Math.random() * 0.1);
    }
    // Your feet, while you run (and coast out a match you won).
    const ice = you.alive && onIce(round, you.x, you.y);
    const belt = you.alive && Boolean(beltAt(round, you.x, you.y));
    if (ice) {
      hum("fuse:slide", "fuseSlide", pace, 0.8 + 0.5 * pace);
      if (!s.ice && run > STEP_SPEED) tone("fuseSkate", 0.6);
    } else if (run > STEP_SPEED && you.dashMs <= 0) {
      s.step -= ms;
      if (s.step <= 0) {
        s.step = clamp((230 * SPEED) / run, 150, 420);
        s.foot = !s.foot;
        tone("fuseStep", 0.3 + 0.3 * pace, (belt ? 1.35 : 1) * (s.foot ? 1 : 1.12) * (0.95 + Math.random() * 0.1));
      }
    } else s.step = 0;
    if (belt && !s.belt) tone("clank", 0.35);
    s.ice = ice;
    s.belt = belt;
    // The room's odd noise, every few seconds of play.
    if (playing) {
      s.room -= ms;
      if (s.room <= 0) {
        s.room = 4000 + Math.random() * 5000;
        const noise = ROOM_NOISES[round.level];
        if (noise) tone(noise, 0.4, 0.95 + Math.random() * 0.1);
      }
    }
  };

  const runFx = (ms) => {
    fx.clock += ms;
    const s = ms / 1000;
    fx.parts = fx.parts.filter((p) => {
      p.life -= ms;
      p.x += p.vx * s;
      p.y += p.vy * s;
      p.vx *= 0.92;
      p.vy *= 0.92;
      return p.life > 0;
    });
    fx.floats = fx.floats.filter((f) => {
      f.life -= ms;
      f.y -= 5 * s;
      return f.life > 0;
    });
    fx.rings = fx.rings.filter((r) => (r.life -= ms) > 0);
    fx.clouds = fx.clouds.filter((c) => (c.life -= ms) > 0);
    fx.hops = fx.hops.filter((h) => (h.life -= ms) > 0);
    fx.streaks = fx.streaks.filter((t) => (t.life -= ms) > 0);
    for (const r of round.runners) {
      if (r.alive && r.dashMs > 0) fx.streaks.push({ x: r.x, y: r.y, r: RUNNER_R * 0.8, color: colorOf(r.id), life: 200, max: 200 });
    }
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

  // The pills' numbers: the venue, lives, dash charges and the next one
  // filling, runners left, your effects and the hot streak, and the fuse:
  // the one you hold, else the shortest burning.
  const hudOf = () => {
    const you = round.runners[0];
    const effects = [];
    if (you.fx.sneakers > 0) effects.push({ text: "SNEAKERS", color: POWERS.sneakers.color, fill: you.fx.sneakers / SNEAKERS_MS });
    if (round.freeze > 0) effects.push({ text: "FROZEN", color: POWERS.freeze.color, fill: round.freeze / FREEZE_MS });
    let fuse = null;
    const lit = round.bombs.filter((b) => b.lit);
    if (lit.length && round.phase !== "done") {
      const mine = lit.find((b) => b.holder === 0);
      const b = mine || lit.reduce((a, k) => (k.fuse < a.fuse ? k : a));
      const secs = Math.max(0, b.fuse) / 1000;
      fuse = { text: `${mine ? "YOURS" : "FUSE"} ${secs.toFixed(1)}`, color: secs < DESPERATE_MS / 1000 || mine ? DANGER : "#ffffff" };
    }
    return { venue: venueTag(round.level), charges: you.charges, maxCharges: MAX_CHARGES, recharge: you.recharge / RECHARGE_MS, left: round.runners.filter((r) => r.alive).length, effects, streak: round.streak, fuse };
  };

  // The view fuse-draw.js draws from: one object, refilled each frame.
  const view = { g: Object.freeze({ W, H, AW, AH, HUD_H, PAD, RUNNER_R }), powers: POWERS, rivals: RIVALS, maxVenue: MAX_VENUE, colorOf, nameOf, holderOf: (id) => holding(round, round.runners[id]), safeOf: (id) => tagSafe(round, round.runners[id]),outMs: OUT_MS, fallMs: FALL_MS, lockMs: NO_TAGBACK_MS };
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
    view.pillH = Math.max(12 / u, 2.4);
    view.hud = hudOf();
    view.cheer = fx.cheer > 0;
    view.combo = fx.combo;
    view.flash = fx.flash;
    view.banner = head;
    view.furthest = furthest;
    view.beltSpeed = BELT_SPEED;
    // The last second of a fuse: the edges pulse, harder when it is yours.
    const mine = round.bombs.find((b) => b.lit && b.holder === 0);
    view.hot = Boolean(mine && mine.fuse < DESPERATE_MS);
    view.pulse = round.phase !== "play" ? 0 : mine && mine.fuse < HOT_MS ? 1 : round.bombs.some((b) => b.lit && b.fuse < HOT_MS) ? 0.45 : 0;
    view.shake = null;
    if (fx.shake > 0 && state === "running") {
      shakeAt.x = (Math.random() - 0.5) * 2 * fx.shakeMag;
      shakeAt.y = (Math.random() - 0.5) * 2 * fx.shakeMag;
      view.shake = shakeAt;
    }
    view.tally = null;
    view.big = null;
    const reached = `Furthest: ${venueName(furthest)}`;
    if (state === "ready") view.tally = ["Tag someone to pass the bomb. Last one standing wins", `Arrows run, space dashes. ${reached}`];
    else if (state === "over") {
      view.big = String(round.score);
      view.tally = [`Reached ${venueName(round.level)}${further ? ". New furthest!" : ""}${beaten ? " A new best!" : ""}`, `${round.passes} pass${round.passes === 1 ? "" : "es"}, ${round.hotPasses} hot, best streak x${Math.max(1, round.bestStreak)}, ${round.matchesWon} match${round.matchesWon === 1 ? "" : "es"} won. ${teaser(furthest)}`];
    }
    drawScene(ctx, view);
  };

  // Nothing held carries over a pause or a new round: a release may never arrive.
  const letGo = () => Object.keys(round.input).forEach((k) => (round.input[k] = false));

  const start = () => {
    colors = readColors(canvas);
    round = newRound();
    state = "running";
    further = false;
    resetFx();
    try {
      bestAtStart = Number(best()) || 0;
    } catch {
      bestAtStart = 0;
    }
    beaten = false;
    banner(VENUES[1].title, VENUES[1].sub, venueColor(1), 1600);
    paint();
  };

  const end = () => {
    state = "over";
    letGo();
    onScore(round.score);
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
      if (state === "paused") state = "running";
    },
    // A held arrow runs that way until it is let go (its key repeats only
    // say it is still held). Space starts a round, plays on from a pause or
    // dashes; a repeat of it (space held) never dashes.
    key(name, repeat = false) {
      if (name === "action") {
        if (state === "ready" || state === "over") start();
        else if (state === "paused") state = "running";
        else if (!repeat && dash(round, round.runners[0])) drain();
        return true;
      }
      if (!MOVES[name]) return false;
      if (state === "running") round.input[name] = true;
      return true;
    },
    // An arrow let go: stop running that way.
    release(name) {
      if (MOVES[name]) round.input[name] = false;
    },
    tick(ms) {
      if (state !== "running") return;
      runFx(ms);
      runTicks(ms);
      advance(round, ms);
      drain();
      runSound(ms);
      if (round.over) end();
      paint();
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

export default Object.freeze({ id: "fuse", title: "Hot Potato", create });
