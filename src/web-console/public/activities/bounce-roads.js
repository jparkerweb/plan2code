// Plan2Code Web Console - Bounce Road's stages as data: the themes (each one's road widths, the pieces it lays and how often, its bridges, barriers and hazards), the difficulty of each stage by its place in the run (length, par, holes, rivals), the boss arenas, the twists, and how a run deals them.
//
// Data and plain arithmetic only (no imports): bounce-road.js builds the road
// from these numbers, a stage at a time from a seed, and bounce-scenery.js
// draws each stage in the look named by its theme's id. A stage is a theme
// (what it looks like and what it throws at you) in a slot (how hard: the
// slot sets the length, the holes and the rivals), so a run can deal the
// themes in a new order every time and stay fair. Every third stage is a
// boss stage, in that boss's arena.

// The field: FIELD_W units across, FIELD_H of road on the board at once. The
// road is laid in rows ROW units long.
export const FIELD_W = 72;
export const FIELD_H = 90;
export const ROW = 2;

// The longest hole any stage may cut, in units. bounce-road.js checks it
// against a jump's reach at a fair speed (see JUMP_FAIR there); the unit
// suite does too. A drawbridge's open span counts as a hole.
export const MAX_HOLE = 30;

// Every WORLD-th stage is a boss stage; CYCLE stages make one lap of the
// run, after which the themes and the bosses are dealt again, quicker.
export const WORLD = 3;
export const CYCLE = 15;
// At most this many rivals on the road at once, however far you get.
export const MAX_RIVALS = 7;

const freeze = (s) => Object.freeze(Object.fromEntries(Object.entries(s).map(([k, v]) => [k, typeof v === "object" && v ? Object.freeze(v) : v])));

// A theme:
// - `tier`: how late in a run it belongs (0 always opens, 1 early, 3 late).
// - `width`: the road's narrowest and widest, in units.
// - `weights`: how often each piece is laid: `straight`, `crack` (a hole
//   across the road), `river` (water crossed on a bridge, some broken, some
//   with a drawbridge), `split` (a flowerbed down the middle), `ramp` (a
//   ramp in one lane before a crack, stars over it), `chicane` (barriers
//   from alternate edges), `crumble` (road that falls away behind you),
//   `train` (a toy train crossing), `sway` (a bridge that sways), and the
//   hazards laid on a straight: `boost` (speed strips), `slick` (oil and
//   water), `ball` (a ball rolling across), `sprinkler` (a sweeping spray),
//   `drop` (something falling where you are heading), `wind` (gusts), `belt`
//   (a conveyor carrying you across), `pop` (a spring pad that throws you
//   up), `bumpers` (pinball bumpers that kick you away, for points), `laser`
//   (a beam across the road on a timer), `stomper` (something heavy slamming
//   down on a timer) and `roller` (a long thing rolling across: a crash).
//   A crack waits for `crackFrom` of the stage.
// - `bridge`: the bridge's narrowest and widest; `river` its length.
// - `broken`: the share of bridges with a broken span; `double`: the share
//   of those with two; `drawbridge`: the share of the rest with a span that
//   lifts on a timer.
// - `median`: a flowerbed's shortest and longest; `medianWidth`: its
//   narrowest and widest; `splitWidth`: the road's whole width round it.
// - `barrier`: what a chicane is made of, "cone" (knocked flying, it slows
//   you) or "block" (solid: nose first is a crash). `drops`: what falls;
//   `roll`, `roller` and `stomp`: what the ball, the roller and the stomper
//   are drawn as.
// - `ice`: the whole road has little grip; `dark`: only your headlights.
// - `boss`: the boss whose arena this is (a boss stage only).
const BRIDGES = { bridge: [17, 21], river: [36, 56], broken: 0.7, double: 0.2, drawbridge: 0.3 };
const BEDS = { median: [70, 120], medianWidth: [8, 13], splitWidth: [48, 58] };

export const THEMES = Object.freeze({
  chalk: freeze({ id: "chalk", title: "Chalk Lane", sub: "Bump them off, jump the cracks, hit the boost", tier: 0, width: [32, 44], weights: { straight: 2, crack: 1.2, boost: 1, chicane: 0.7, pop: 0.5 }, crackFrom: 0.2, barrier: "cone" }),
  hose: freeze({ id: "hose", title: "Hose Creek", sub: "Broken bridges and a sprinkler on the loose", tier: 1, width: [30, 44], weights: { straight: 2, crack: 1, river: 1.6, sprinkler: 1, boost: 0.6 }, bridge: [18, 22], river: [36, 56], broken: 0.7, double: 0, drawbridge: 0 }),
  kitchen: freeze({ id: "kitchen", title: "Kitchen Floor", sub: "Oil slicks, a rolling orange and the rolling pin", tier: 1, width: [30, 42], weights: { straight: 1.8, crack: 1, slick: 1.3, ball: 1.1, chicane: 0.8, boost: 0.6, roller: 0.8 }, barrier: "cone", roll: "orange", roller: "pin" }),
  bath: freeze({ id: "bath", title: "Bubble Bath", sub: "Soap slicks, faucet jets and a wobbly bath mat", tier: 1, width: [30, 42], weights: { straight: 1.7, crack: 0.8, river: 1.1, sway: 0.7, slick: 1, pop: 1.2, sprinkler: 0.6, boost: 0.5 }, bridge: [18, 22], river: [36, 52], broken: 0.6, double: 0, drawbridge: 0 }),
  beds: freeze({ id: "beds", title: "Flowerbed Fork", sub: "Ramps, forks in the road and falling flowerpots", tier: 2, width: [30, 42], weights: { straight: 1.6, crack: 0.8, river: 0.9, split: 1.4, ramp: 1.1, drop: 1, slick: 0.4 }, ...BRIDGES, double: 0, drawbridge: 0, ...BEDS, drops: "pot" }),
  pinball: freeze({ id: "pinball", title: "Pinball Alley", sub: "Bumpers pay out. Conveyors do not care where you were going", tier: 2, width: [32, 44], weights: { straight: 1.3, crack: 0.9, bumpers: 1.7, belt: 1.1, boost: 1, ramp: 0.8, ball: 0.8, pop: 0.6 }, barrier: "cone", roll: "steel" }),
  desk: freeze({ id: "desk", title: "Homework Desk", sub: "Rolling pencils, slamming books and spilled ink", tier: 2, width: [30, 42], weights: { straight: 1.5, crack: 1, roller: 1.2, stomper: 1.2, slick: 0.7, chicane: 0.7, boost: 0.5 }, barrier: "block", roller: "pencil", stomp: "book" }),
  sand: freeze({ id: "sand", title: "Sandbox Run", sub: "The road crumbles behind you. Keep your foot down", tier: 2, width: [27, 38], weights: { straight: 1.5, crack: 0.9, river: 0.8, split: 0.8, crumble: 1.2, chicane: 1, drop: 0.6, ramp: 0.6 }, bridge: [16, 20], river: [40, 60], broken: 0.8, double: 0.3, drawbridge: 0, ...BEDS, medianWidth: [8, 12], splitWidth: [48, 56], barrier: "block", drops: "bucket" }),
  toys: freeze({ id: "toys", title: "Toy Room", sub: "Mind the train, and the mallet", tier: 2, width: [28, 40], weights: { straight: 1.4, crack: 0.9, train: 1.4, chicane: 1, ball: 0.9, ramp: 0.7, boost: 0.7, slick: 0.4, pop: 0.5, stomper: 0.5 }, barrier: "block", roll: "ball", stomp: "mallet" }),
  ice: freeze({ id: "ice", title: "Freezer Aisle", sub: "No grip anywhere, and the snowballs are rolling", tier: 3, width: [30, 42], weights: { straight: 1.7, crack: 1, ball: 1.1, river: 0.7, chicane: 0.6, wind: 0.6, crumble: 0.6, boost: 0.5 }, bridge: [18, 22], river: [36, 52], broken: 0.6, double: 0.2, drawbridge: 0, barrier: "block", roll: "snow", ice: true }),
  pond: freeze({ id: "pond", title: "Garden Pond", sub: "Swaying bridges and drawbridges over deep water", tier: 3, width: [28, 40], weights: { straight: 1.2, crack: 0.6, river: 1.4, sway: 1.7, split: 0.6, sprinkler: 0.7, drop: 0.5 }, bridge: [17, 21], river: [40, 64], broken: 0.5, double: 0.4, drawbridge: 0.9, ...BEDS, medianWidth: [8, 12], drops: "acorn" }),
  gutter: freeze({ id: "gutter", title: "Rooftop Gutter", sub: "Gusts, a crumbling gutter, and nowhere to hide", tier: 3, width: [25, 34], weights: { straight: 1.2, crack: 1, wind: 1.4, crumble: 1.1, chicane: 0.8, drop: 0.7, boost: 0.6, river: 0.6 }, bridge: [16, 19], river: [40, 60], broken: 0.7, double: 0.4, drawbridge: 0.7, barrier: "block", drops: "cone" }),
  lava: freeze({ id: "lava", title: "The Floor Is Lava", sub: "Cushion to cushion. Do not touch the floor", tier: 3, width: [28, 40], weights: { straight: 1.2, crack: 1.6, crumble: 1.1, pop: 1, ramp: 0.9, roller: 0.7, drop: 0.6, split: 0.5, boost: 0.6 }, ...BEDS, barrier: "block", drops: "rock", roller: "ember" }),
  night: freeze({ id: "night", title: "Night Lights", sub: "Everything at once, in the dark", tier: 3, width: [26, 38], weights: { straight: 1.2, crack: 1, river: 1, split: 0.8, ramp: 0.7, chicane: 0.7, crumble: 0.7, train: 0.8, sway: 0.7, ball: 0.7, sprinkler: 0.5, drop: 0.6, wind: 0.5, slick: 0.5, boost: 0.6, laser: 0.6, pop: 0.4 }, bridge: [16, 20], river: [44, 64], broken: 0.7, double: 0.5, drawbridge: 0.7, ...BEDS, medianWidth: [8, 12], barrier: "block", drops: "pot", roll: "ball", dark: true }),
  // The arenas: roomier roads with less in the way, so the fight is the boss.
  garage: freeze({ id: "garage", title: "Grease Pit", sub: "The Big Rig hauls oil and barrels. Land on its roof", tier: 4, boss: "tanker", width: [32, 42], weights: { straight: 2.2, crack: 0.8, slick: 0.6, chicane: 0.5, boost: 0.9, ramp: 0.6, pop: 0.6 }, barrier: "cone" }),
  hall: freeze({ id: "hall", title: "Hallway Runner", sub: "The Robo-Vac sweeps the hall. Jump on it when it charges", tier: 4, boss: "vac", width: [32, 42], weights: { straight: 2.3, crack: 0.9, pop: 0.8, boost: 0.8, ball: 0.5, ramp: 0.5 }, roll: "ball" }),
  attic: freeze({ id: "attic", title: "Attic Airspace", sub: "The Whirlybird bombs from above. Stomp it when it swoops", tier: 4, boss: "chopper", width: [32, 42], weights: { straight: 2.2, crack: 0.9, ramp: 0.8, pop: 0.8, boost: 0.8, laser: 0.5, chicane: 0.4 }, barrier: "block" }),
  giant: freeze({ id: "giant", title: "Monster Mash", sub: "The Monster truck. Land on its roof to beat it", tier: 4, boss: "monster", width: [30, 40], weights: { straight: 1.8, crack: 1, ramp: 1, chicane: 0.5, ball: 0.5, drop: 0.4, boost: 0.8, slick: 0.4, pop: 0.5 }, barrier: "block", drops: "tire", roll: "ball" }),
  couch: freeze({ id: "couch", title: "The Cat's Couch", sub: "The Cat. Jump its paw when it sweeps, and land on it", tier: 4, boss: "cat", width: [32, 42], weights: { straight: 2, crack: 1, ball: 0.8, ramp: 0.9, pop: 0.8, boost: 0.8 }, roll: "yarn" }),
});

// The stunt pieces every theme lays besides its own: `kicker` (a big ramp
// that flies you over a whole chicane), `wall` (a row of blocks right
// across the road: jump it), `trampoline` (spring pads right across, one
// after another) and `turbo` (a narrow lane of boost strips). The opening
// stage lays half as many.
export const WILD = Object.freeze({ kicker: 0.75, wall: 0.6, trampoline: 0.65, turbo: 0.55 });

// The themes a run deals its plain stages from, in the order a run with no
// shuffle plays them, and the bosses in theirs with each one's arena.
export const REGULAR = Object.freeze(["chalk", "hose", "kitchen", "beds", "sand", "toys", "pond", "gutter", "night", "lava", "bath", "pinball", "desk", "ice"]);
export const BOSS_ORDER = Object.freeze(["tanker", "vac", "chopper", "monster", "cat"]);
export const ARENAS = Object.freeze({ tanker: "garage", vac: "hall", chopper: "attic", monster: "giant", cat: "couch" });
// How many plain stages a lap holds: the rest of the themes sit that lap out.
export const REGULAR_PER_CYCLE = CYCLE - CYCLE / WORLD;

// A twist a shuffled run may put on a plain stage: `rush` (more rivals),
// `gold` (stars over every hole, each worth double), `dark` (lights out),
// `rain` (a wet road, little grip), `crates` (power-ups three times as
// often) and `turbo` (boost strips everywhere).
export const TWISTS = Object.freeze({
  rush: Object.freeze({ name: "Rush hour", blurb: "The road is packed" }),
  gold: Object.freeze({ name: "Gold rush", blurb: "Stars everywhere, worth double" }),
  dark: Object.freeze({ name: "Lights out", blurb: "Only your headlights" }),
  rain: Object.freeze({ name: "Downpour", blurb: "A wet road has little grip" }),
  crates: Object.freeze({ name: "Supply drop", blurb: "Crates all over the road" }),
  turbo: Object.freeze({ name: "Turbo lane", blurb: "Boost strips everywhere" }),
});
export const TWIST_NAMES = Object.freeze(Object.keys(TWISTS));
export const TWIST_SHARE = 0.4;

// The stage each rival kind first comes in (its slot in a lap; every kind is
// out from the second lap). A kind new within FRESH_SLOTS comes more often.
export const KIND_FROM = Object.freeze({ zigzag: 1, brick: 1, frog: 2, sneak: 3, nudge: 4, spike: 4, splitter: 5, hauler: 5, bruiser: 7, racer: 7, blaster: 8, cop: 8, bomber: 10, phantom: 10, slasher: 11, magnet: 14 });
export const FRESH_SLOTS = 3;

const round1 = (v) => Math.round(v * 10) / 10;

// The numbers a stage takes from its place in the run: stage `n` is slot
// `k` (1 to CYCLE) of lap `lap`. Longer, quicker, keener and busier as the
// run goes on, with longer holes (never past MAX_HOLE); a boss stage is
// longer, with fewer rivals in the way.
export function slotFor(n) {
  const lap = 1 + Math.floor((n - 1) / CYCLE);
  const k = 1 + ((n - 1) % CYCLE);
  const boss = k % WORLD === 0;
  const hard = k + (lap - 1) * 5;
  const len = 1060 + 36 * k + (boss ? 260 : 0) + (lap > 1 ? 100 : 0);
  const rivals = Math.min(MAX_RIVALS, 3 + Math.floor(k / 4) + (lap - 1));
  const kinds = Object.keys(KIND_FROM).filter((kind) => lap > 1 || KIND_FROM[kind] <= k);
  return {
    lap,
    slot: k,
    len,
    par: Math.round(len / 52),
    pace: round1(Math.min(1.45, 1 + 0.02 * (k - 1) + 0.07 * (lap - 1)) * 100) / 100,
    sharp: lap > 1 ? 1 : round1(Math.min(1, 0.25 + 0.055 * (k - 1)) * 100) / 100,
    rivals: boss ? Math.max(2, rivals - 2) : rivals,
    kinds: Object.freeze(kinds),
    fresh: Object.freeze(kinds.filter((kind) => lap === 1 && k - KIND_FROM[kind] < FRESH_SLOTS && KIND_FROM[kind] > 1)),
    crackFrom: 0,
    crack: Object.freeze([Math.min(18, 8 + Math.round(hard * 0.6)), Math.min(MAX_HOLE - 4, 14 + Math.round(hard * 0.85))]),
    gap: Object.freeze([Math.min(18, 12 + Math.round(hard * 0.45)), Math.min(MAX_HOLE - 4, 18 + Math.round(hard * 0.6))]),
    pickups: n > 1,
    stars: round1(Math.min(0.9, 0.58 + 0.02 * k)),
  };
}

// Stage `n` as theme `id`, with `twist` on it or none: the slot's numbers,
// then the theme's own, then what the twist changes.
export function stageSpec(n, id, twist = null) {
  const theme = THEMES[id] || THEMES.chalk;
  const slot = slotFor(n);
  const spec = { ...slot, ...theme, n, name: slot.lap > 1 ? `${theme.title} ${slot.lap}` : theme.title, boss: theme.boss || null, twist: null, itemRate: 1 };
  if (theme.crackFrom && n === 1) spec.crackFrom = theme.crackFrom;
  const wild = Object.fromEntries(Object.entries(WILD).map(([k, v]) => [k, n === 1 ? v / 2 : v]));
  spec.weights = Object.freeze({ ...wild, ...theme.weights });
  if (twist && TWISTS[twist]) {
    spec.twist = twist;
    if (twist === "rush") spec.rivals = Math.min(MAX_RIVALS, spec.rivals + 2);
    else if (twist === "gold") {
      spec.stars = 1;
      spec.gold = true;
    } else if (twist === "dark") spec.dark = true;
    else if (twist === "rain") spec.ice = true;
    else if (twist === "crates") spec.itemRate = 3;
    else if (twist === "turbo") spec.weights = Object.freeze({ ...spec.weights, boost: (theme.weights.boost || 0) + 1.6, turbo: WILD.turbo + 1.4 });
  }
  return Object.freeze(spec);
}

// The theme of stage `n` in a run with no shuffle: the bosses in order on
// every third stage, the plain themes in order on the rest.
export function classicTheme(n) {
  if (n % WORLD === 0) return ARENAS[BOSS_ORDER[(n / WORLD - 1) % BOSS_ORDER.length]];
  return REGULAR[(n - Math.floor(n / WORLD) - 1) % REGULAR.length];
}

// The first lap of a run with no shuffle, for the lists that name stages.
export const STAGES = Object.freeze(Array.from({ length: CYCLE }, (_, i) => stageSpec(i + 1, classicTheme(i + 1))));
