// Plan2Code Web Console - Ghoul Rush's dark ride, its scene table: the 12 rooms, what stands in each, how long each is and how fast the car rolls through it; data only, no imports.
//
// Ported from prototypes/ghoul-rush-ride/gallery.html (its SCENES table), the
// seconds as measured there: about 92 s for a clean run, 100 s on the game's
// own clock (`spec.ride.time` in ghoul-rooms.js). Each row:
//
//   id, name, tag     the room's key, its plaque and its tag line
//   len               how far the car goes in it, in ride units
//   skip              author units cut off the front (the author's coordinates
//                     below start `skip` before the room's first unit)
//   src               (the Dark and the Barker) the author's own start, so their
//                     spawn coordinates keep the prototype's numbers
//   floor             the aisle's two colors (the art may override)
//   speed             units a second the car wants in the room, or null when
//                     the rules decide (ghoul-ride.js SPEEDS: the bay's start,
//                     the lift hill, a mini-boss slowing the car, the Barker)
//   tempo             seconds between the music box's notes (the rules'), nobox
//                     no music box (the lift hill's silence)
//   spawn             rows [kind, ...] in author coordinates (a world x is the
//                     coordinate plus the scene's `sh`); the rules make them:
//        ["lant", x, y, variant, delay, opts]       a lit thing to shoot on a chain (skull, bubble, jar...)
//        ["pop", type, x, opts]                      a figure that rises, waits and lunges at the car
//        ["inno", x, variant]                        a guest: never shoot (green heart)
//        ["door", x, hands, variant, at]             a door that bursts into hands
//        ["axe", x, phase, variant, opts]            a swinging blade, hoop or horse: shoot the chain, or duck
//        ["chand", x, variant]                       a chandelier, spiked ball or beam on a chain
//        ["mir", x, n, reals]                        n mirrors, the `reals` indexes are the solid ghouls
//        ["web", x, y]                               a web across the rail
//        ["mini", id, x]                             a mini-boss (swan, spider)
//        ["boss", x]                                 the Barker
//        opts of a pop: trig (distance at which it wakes), wait (seconds, or [lo, hi]), y (a height) or dy (an offset from the stage
//        floor), stand, slump, burn, boss (name), orbit {cx, R, ph, w}; of a lant: lightAt, maxLit, expire ("hand").
//
// Computed here: every row's `a` (where it starts along the ride) and `sh`
// (the shift from the author's coordinates to the ride's), END_P (the ride's
// length), and the indexes DARK_I, BARK_I.

const TAU = Math.PI * 2;
const freeze = (o) => Object.freeze(o);
// l, l + step, ... below `to`, a row for each.
const run = (from, to, step, make) => {
  const out = [];
  for (let l = from, k = 0; l < to; l += step, k++) out.push(make(l, k));
  return out;
};

const FLOOR_OF = {
  wax: ["#4a1a3a", "#150812"],
  torture: ["#3a342e", "#0e0c0a"],
  carousel: ["#6a3a1c", "#180a06"],
  mirrors: ["#2a4a5a", "#08121a"],
  tunnel: ["#1a3a3a", "#050e10"],
  web: ["#1a1e1c", "#050606"],
  lift: ["#2a2230", "#08060c"],
  tent: ["#6a2a10", "#220a04"],
  exit: ["#3a3a46", "#0c0c12"],
};

const ROWS = [
  {
    id: "bay", name: "THE LOAD BAY", tag: "Keep arms and legs inside", len: 40, skip: 16, src: 0, floor: ["#2a1a10", "#0c0608"], speed: null,
    spawn: [["lant", 48, 15, "skull", 0.3], ["lant", 60, 23, "skull", 0.2]],
  },
  {
    id: "wax", name: "THE WAX MUSEUM", tag: "Do not touch the guests", len: 108, skip: 8, floor: FLOOR_OF.wax, speed: 8.5,
    spawn: [
      ...[14, 25, 36, 47, 58, 69, 80, 91, 102, 113].map((l, i) => ["pop", "wax", l, { stand: true, dy: -1.5, trig: 44 + (i % 3) * 5, wait: [0.3, 0.9] }]),
      ...[[19, "kid"], [37, "nurse"], [55, "tourist"], [73, "kid"], [91, "nurse"], [109, "tourist"]].map(([l, v]) => ["inno", l, v]),
      ["lant", 30, 13, "skull"], ["lant", 70, 13, "skull"],
    ],
  },
  {
    id: "torture", name: "THE CHAMBER OF TORTURE", tag: "The exhibits are very hands on", len: 150, skip: 10, floor: FLOOR_OF.torture, speed: null,
    spawn: [
      ["door", 20, 2, "maiden", 54], ["door", 54, 2, "maiden", 54],
      ["chand", 100, "spike"],
      ...[92, 99, 106].map((l) => ["pop", "corpse", l, { slump: true, trig: 40, wait: 4 }]),
      ["pop", "corpse", 58, { slump: true, trig: 50 }], ["pop", "corpse", 84, { slump: true, trig: 50 }],
      ["axe", 116, 0, "axe", { T: 1.9 }], ["axe", 126, 1.1, "axe", { T: 1.9 }],
      ["lant", 34, 14, "skull"], ["lant", 62, 14, "skull"], ["lant", 112, 14, "skull"],
      ["pop", "hood", 146, { trig: 62, boss: "THE EXECUTIONER" }],
    ],
  },
  {
    id: "carousel", name: "THE CARNIVAL CAROUSEL", tag: "Every horse is a winner", len: 124, skip: 44, floor: FLOOR_OF.carousel, tempo: 0.2, speed: 8.5,
    spawn: [
      ...[0, 2, 4].map((i) => ["pop", "horse", 95, { trig: 64, wait: 1.7 + i * 0.9, orbit: { cx: 95, R: 26, ph: (i * TAU) / 6, w: 1.2 } }]),
      ["inno", 52, "kid"], ["inno", 60, "kid"],
      ...[0, 1.0, 2.0].map((ph, i) => ["axe", 122 + i * 10, ph, "horse", { T: 2.9, len: 38 }]),
      ["lant", 56, 12, "skull"], ["lant", 138, 13, "skull"],
      ...[142, 152].map((l) => ["pop", "horse", l, { trig: 52, wait: 0.4 }]),
    ],
  },
  {
    id: "mirrors", name: "THE HALL OF MIRRORS", tag: "Only one of you is real", len: 104, skip: 24, floor: FLOOR_OF.mirrors, speed: 8.5,
    spawn: [["mir", 40, 3, [1]], ["mir", 66, 3, [0]], ["mir", 92, 5, [1, 3]], ["mir", 118, 5, [2]], ["lant", 28, 13, "skull"], ["lant", 80, 12, "skull"]],
  },
  {
    id: "tunnel", name: "THE TUNNEL OF LOVE", tag: "Kiss the bride. Quietly.", len: 170, skip: 24, floor: FLOOR_OF.tunnel, tempo: 0.3, speed: null,
    spawn: [
      ...[[30, 34], [60, 64], [88, 92]].flatMap(([a, b]) => [
        ["pop", "corpse", a, { slump: true, trig: 50, wait: 0.8, dy: -1 }],
        ["pop", "corpse", b, { slump: true, trig: 48, wait: 1.3, dy: -1 }],
      ]),
      ["inno", 74, "tourist"], ["inno", 78, "kid"],
      ...[104, 109, 114, 119, 124].map((l, i) => ["lant", l, 29 + (i % 2) * 3, "bubble", 0, { lightAt: 42, maxLit: 2.2, expire: "hand" }]),
      ["mini", "swan", 176],
    ],
  },
  {
    id: "web", name: "THE WIDOW'S NEST", tag: "Mind the web", len: 150, skip: 20, floor: FLOOR_OF.web, tempo: 0.5, speed: null,
    spawn: [
      ["web", 30, 27], ["web", 54, 27], ["web", 78, 27],
      ...run(0, 5, 1, (i) => ["pop", "spiderling", 38 + i * 10, { trig: 48, wait: [0.1, 0.5] }]),
      ["lant", 46, 12, "skull"], ["lant", 90, 12, "skull"],
      ["mini", "spider", 158],
    ],
  },
  {
    id: "lift", name: "THE LIFT HILL", tag: "Hold on", len: 110, skip: 8, floor: FLOOR_OF.lift, nobox: true, speed: null,
    spawn: [
      ...[14, 20, 26, 31].map((l) => ["pop", "ghoul", l, { trig: 46, wait: 0.2 }]),
      ["lant", 18, 14, "skull"], ["lant", 28, 12, "skull"],
      ...run(0, 9, 1, (i) => ["pop", "bat", 52 + i * 4.5, { trig: 56, y: 22 + (i % 4) * 4, wait: 0.05 + i * 0.1 }]),
      ["chand", 108, "beam"],
    ],
  },
  {
    id: "tent", name: "THE BURNING BIG TOP", tag: "Run", len: 140, skip: 10, floor: FLOOR_OF.tent, tempo: 0.18, speed: 8.5,
    spawn: [
      ...run(12, 148, 13, (l, k) => ["pop", k % 4 === 3 ? "hound" : "clown", l, { trig: 50, wait: [0.05, 0.35], burn: true }]),
      ["axe", 40, 0, "hoop", { T: 2.2, len: 36 }], ["axe", 84, 0.8, "hoop", { T: 1.8, len: 36 }], ["axe", 124, 0.4, "hoop", { T: 1.8, len: 36 }],
      ["chand", 62, "beam"], ["chand", 104, "beam"], ["chand", 142, "beam"],
    ],
  },
  {
    id: "exit", name: "THE EXIT", tag: "Thank you for riding", len: 74, skip: 6, floor: FLOOR_OF.exit, tempo: 0.22, speed: 5.5,
    spawn: run(8, 70, 7, (l) => ["inno", l, "pick", { jitter: 2, pick: ["kid", "tourist", "nurse"] }]),
  },
  { id: "dark", name: "THE DARK", tag: "Please remain seated", len: 24, src: 500, floor: ["#14101a", "#030204"], speed: 9, spawn: [] },
  {
    id: "barker", name: "THE BARKER", tag: "Step right up", len: 122, skip: 18, src: 532, floor: ["#3a2050", "#0a0412"], speed: null,
    spawn: [["boss", 630]],
  },
];

// Lay the rooms end to end.
let at = 0;
export const SCENES = freeze(
  ROWS.map((r) => {
    const row = freeze({ ...r, a: at, sh: (r.src !== undefined ? at - r.src : at) - (r.skip || 0) });
    at += r.len;
    return row;
  }),
);
export const END_P = at;
export const DARK_I = SCENES.findIndex((s) => s.id === "dark");
export const DARK_A = SCENES[DARK_I].a;
export const BARK_I = SCENES.findIndex((s) => s.id === "barker");
// Rooms with a mini-boss or a boss, marked on the progress bar.
export const BOSS_SCENES = freeze({ torture: 1, tunnel: 1, web: 1, barker: 1 });
export const sceneIndexAt = (p) => {
  let z = 0;
  for (let i = 0; i < SCENES.length; i++) if (p >= SCENES[i].a) z = i;
  return z;
};
