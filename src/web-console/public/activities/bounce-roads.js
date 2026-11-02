// Plan2Code Web Console - Bounce Road's stages as data: each stage's length, the road's widths, the pieces it lays and how often, the holes it may cut and how long, the hazards it brings, and the rivals on it.
//
// Data only (no imports): bounce-road.js builds the road from these numbers,
// a stage at a time from a seed, and bounce-scenery.js draws each stage in
// the look named by its id. Every stage keeps most of what the earlier ones
// brought and adds something of its own; past the last, the road goes round
// again from LAP_FROM, quicker and meaner (bounce-road.js's stageFor makes
// the numbers for that).

// The field: FIELD_W units across, FIELD_H of road on the board at once. The
// road is laid in rows ROW units long.
export const FIELD_W = 72;
export const FIELD_H = 90;
export const ROW = 2;

// The longest hole any stage may cut, in units. bounce-road.js checks it
// against a jump's reach at a fair speed (see JUMP_FAIR there); the unit
// suite does too. A drawbridge's open span counts as a hole.
export const MAX_HOLE = 30;

// Past the last stage, the road goes round again from this stage.
export const LAP_FROM = 3;

// Per stage:
// - `len`: units of road from its line to the next stage's; `par`: the
//   seconds a quick run takes, the time bonus counting from it.
// - `width`: the road's narrowest and widest, in units.
// - `weights`: how often each piece is laid: `straight`, `crack` (a hole
//   across the road), `river` (water crossed on a bridge, some broken, some
//   with a drawbridge), `split` (a flowerbed down the middle), `ramp` (a
//   ramp in one lane before a crack, stars over it), `chicane` (barriers
//   from alternate edges), `crumble` (road that falls away behind you),
//   `train` (a toy train crossing), `sway` (a bridge that sways), and the
//   hazards laid on a straight: `boost` (speed strips), `slick` (oil and
//   water), `ball` (a ball rolling across), `sprinkler` (a sweeping spray),
//   `drop` (something falling where you are heading) and `wind` (gusts).
//   A crack waits for `crackFrom` of the stage.
// - `crack` and `gap`: the shortest and longest crack, and broken span.
// - `bridge`: the bridge's narrowest and widest; `river` its length.
// - `broken`: the share of bridges with a broken span; `double`: the share
//   of those with two; `drawbridge`: the share of the rest with a span that
//   lifts on a timer.
// - `median`: a flowerbed's shortest and longest; `medianWidth`: its
//   narrowest and widest; `splitWidth`: the road's whole width round it.
// - `barrier`: what a chicane is made of, "cone" (knocked flying, it slows
//   you) or "block" (solid: nose first is a crash). `drops`: what falls.
// - `rivals`: how many on the road at once; `kinds`: which; `pace`: their
//   speed, times their own; `sharp`: how keenly they block, ram and dodge.
// - `pickups`: whether power-ups lie on the road; `stars`: the share of
//   holes with a line of stars over them; `boss`: the Monster truck comes.
// Every list and table in a stage is frozen with it.
const stage = (s) => Object.freeze(Object.fromEntries(Object.entries(s).map(([k, v]) => [k, typeof v === "object" && v ? Object.freeze(v) : v])));

export const STAGES = Object.freeze([
  stage({
    id: "chalk",
    title: "Chalk Lane",
    sub: "Bump them off, jump the cracks, hit the boost",
    len: 1500,
    par: 29,
    width: [32, 44],
    weights: { straight: 2, crack: 1.2, boost: 1, chicane: 0.7 },
    crackFrom: 0.2,
    crack: [8, 14],
    barrier: "cone",
    rivals: 3,
    kinds: ["zigzag", "brick"],
    pace: 1,
    sharp: 0.25,
    pickups: false,
    stars: 0.6,
  }),
  stage({
    id: "hose",
    title: "Hose Creek",
    sub: "Broken bridges and a sprinkler on the loose",
    len: 1700,
    par: 32,
    width: [30, 44],
    weights: { straight: 2, crack: 1, river: 1.6, sprinkler: 1, boost: 0.6 },
    crackFrom: 0,
    crack: [10, 16],
    gap: [12, 18],
    bridge: [18, 22],
    river: [36, 56],
    broken: 0.7,
    double: 0,
    drawbridge: 0,
    rivals: 3,
    kinds: ["zigzag", "brick", "frog"],
    pace: 1.03,
    sharp: 0.35,
    pickups: true,
    stars: 0.6,
  }),
  stage({
    id: "kitchen",
    title: "Kitchen Floor",
    sub: "Oil slicks, a rolling orange, and a Sneak dropping cones",
    len: 1800,
    par: 33,
    width: [30, 42],
    weights: { straight: 1.8, crack: 1, slick: 1.3, ball: 1.1, chicane: 0.8, boost: 0.6 },
    crackFrom: 0,
    crack: [12, 18],
    barrier: "cone",
    rivals: 4,
    kinds: ["zigzag", "brick", "frog", "sneak"],
    pace: 1.06,
    sharp: 0.45,
    pickups: true,
    stars: 0.65,
  }),
  stage({
    id: "beds",
    title: "Flowerbed Fork",
    sub: "Ramps, falling flowerpots, and the Nudge",
    len: 1900,
    par: 35,
    width: [30, 42],
    weights: { straight: 1.6, crack: 0.8, river: 0.9, split: 1.4, ramp: 1.1, drop: 1, slick: 0.4 },
    crackFrom: 0,
    crack: [12, 20],
    gap: [14, 20],
    bridge: [17, 21],
    river: [36, 56],
    broken: 0.7,
    double: 0,
    drawbridge: 0,
    median: [70, 130],
    medianWidth: [8, 14],
    splitWidth: [50, 60],
    drops: "pot",
    rivals: 4,
    kinds: ["zigzag", "brick", "frog", "nudge", "sneak"],
    pace: 1.09,
    sharp: 0.55,
    pickups: true,
    stars: 0.7,
  }),
  stage({
    id: "sand",
    title: "Sandbox Run",
    sub: "The road crumbles. Trucks too heavy to bump",
    len: 2000,
    par: 36,
    width: [27, 38],
    weights: { straight: 1.5, crack: 0.9, river: 0.8, split: 0.8, crumble: 1.2, chicane: 1, drop: 0.6, ramp: 0.6 },
    crackFrom: 0,
    crack: [12, 22],
    gap: [16, 22],
    bridge: [16, 20],
    river: [40, 60],
    broken: 0.8,
    double: 0.3,
    drawbridge: 0,
    median: [70, 130],
    medianWidth: [8, 12],
    splitWidth: [48, 56],
    barrier: "block",
    drops: "bucket",
    rivals: 5,
    kinds: ["zigzag", "brick", "frog", "nudge", "hauler", "bruiser"],
    pace: 1.12,
    sharp: 0.62,
    pickups: true,
    stars: 0.7,
  }),
  stage({
    id: "toys",
    title: "Toy Room",
    sub: "Mind the train. Catch the Racer",
    len: 2100,
    par: 37,
    width: [28, 40],
    weights: { straight: 1.4, crack: 0.9, train: 1.4, chicane: 1, ball: 0.9, ramp: 0.7, boost: 0.7, slick: 0.4 },
    crackFrom: 0,
    crack: [14, 22],
    barrier: "block",
    rivals: 5,
    kinds: ["zigzag", "brick", "frog", "nudge", "sneak", "racer", "bruiser"],
    pace: 1.15,
    sharp: 0.7,
    pickups: true,
    stars: 0.75,
  }),
  stage({
    id: "pond",
    title: "Garden Pond",
    sub: "Swaying bridges and drawbridges. The cops are out",
    len: 2200,
    par: 39,
    width: [28, 40],
    weights: { straight: 1.3, crack: 0.6, river: 1.4, sway: 1.3, split: 0.7, sprinkler: 0.7, drop: 0.5 },
    crackFrom: 0,
    crack: [14, 22],
    gap: [16, 24],
    bridge: [17, 21],
    river: [40, 64],
    broken: 0.75,
    double: 0.4,
    drawbridge: 0.8,
    median: [70, 130],
    medianWidth: [8, 12],
    splitWidth: [48, 58],
    drops: "acorn",
    rivals: 5,
    kinds: ["zigzag", "brick", "frog", "nudge", "cop", "racer"],
    pace: 1.18,
    sharp: 0.78,
    pickups: true,
    stars: 0.75,
  }),
  stage({
    id: "gutter",
    title: "Rooftop Gutter",
    sub: "Gusts, a crumbling gutter, and nowhere to hide",
    len: 2300,
    par: 40,
    width: [25, 34],
    weights: { straight: 1.2, crack: 1, wind: 1.4, crumble: 1.1, chicane: 0.8, drop: 0.7, boost: 0.6, river: 0.6 },
    crackFrom: 0,
    crack: [14, 24],
    gap: [16, 24],
    bridge: [16, 19],
    river: [40, 60],
    broken: 0.9,
    double: 0.4,
    drawbridge: 0.5,
    barrier: "block",
    drops: "cone",
    rivals: 5,
    kinds: ["zigzag", "brick", "frog", "nudge", "hauler", "cop", "bruiser", "sneak"],
    pace: 1.21,
    sharp: 0.85,
    pickups: true,
    stars: 0.8,
  }),
  stage({
    id: "night",
    title: "Night Lights",
    sub: "Everything at once, in the dark",
    len: 2400,
    par: 42,
    width: [26, 38],
    weights: { straight: 1.2, crack: 1, river: 1, split: 0.8, ramp: 0.7, chicane: 0.7, crumble: 0.7, train: 0.8, sway: 0.7, ball: 0.7, sprinkler: 0.5, drop: 0.6, wind: 0.5, slick: 0.5, boost: 0.6 },
    crackFrom: 0,
    crack: [16, 26],
    gap: [18, 26],
    bridge: [16, 20],
    river: [44, 64],
    broken: 0.9,
    double: 0.5,
    drawbridge: 0.6,
    median: [70, 130],
    medianWidth: [8, 12],
    splitWidth: [48, 58],
    barrier: "block",
    drops: "pot",
    rivals: 6,
    kinds: ["zigzag", "brick", "frog", "nudge", "hauler", "cop", "racer", "bruiser", "sneak"],
    pace: 1.24,
    sharp: 0.92,
    pickups: true,
    stars: 0.8,
  }),
  stage({
    id: "giant",
    title: "Monster Mash",
    sub: "The Monster truck. Land on its roof five times",
    len: 2600,
    par: 46,
    width: [28, 40],
    weights: { straight: 1.4, crack: 1, river: 0.8, ramp: 1, chicane: 0.6, crumble: 0.6, train: 0.5, ball: 0.6, drop: 0.5, boost: 0.8, slick: 0.4 },
    crackFrom: 0,
    crack: [16, 26],
    gap: [18, 26],
    bridge: [17, 21],
    river: [40, 60],
    broken: 0.9,
    double: 0.4,
    drawbridge: 0.5,
    barrier: "block",
    drops: "tire",
    rivals: 4,
    kinds: ["zigzag", "brick", "frog", "nudge", "cop", "racer", "bruiser", "sneak"],
    pace: 1.26,
    sharp: 1,
    pickups: true,
    stars: 0.85,
    boss: true,
  }),
]);
