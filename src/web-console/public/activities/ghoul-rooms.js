// Plan2Code Web Console - Ghoul Rush's rooms as data: the long hall every run starts in, then each stage's rooms (three, then a boss's), side on, left to right, with their floors, pits, shelves, candy, power-ups, monsters, key and door, and the stages themselves.
//
// Data only, no imports: ghoul.js builds each room's numbers from these, and
// the unit suite walks every layout to prove it can be finished (a route from
// the start to the key and on to the door, no jump wider than a jump clears).
//
// Units: the field is FIELD_W across and FIELD_H tall on screen, y counted up
// from the bottom. A room is `length` units long and the camera scrolls along
// it. Every room is laid out on the same plan:
//
// - `ground`: [x0, x1, y] pieces, sorted, each a solid block from its top `y`
//   down. A gap between two pieces is a pit. A step of STEP_UP (3) or less
//   between touching pieces is walked; a taller one is a wall to jump.
// - `shelves`: [x0, x1, y, kind] one-way boards (bookcases, counters,
//   rafters): landed on from above, jumped up through from below, dropped
//   through with down. A "crumble" board shakes once stood on, falls away,
//   and comes back; no route ever needs one.
// - `start`: where Planny comes in (and comes back after a life lost).
// - `key`: [x, y], sitting on a surface at height y; null in a boss room,
//   where beating the boss opens the door.
// - `door`: the x of the way out, on the ground at the room's right end.
// - `candy`: [x0, y, n] rows of n candies, 3 apart, centered at height y.
// - `items`: [kind, x, y] power-ups and secondary weapons sitting on a surface at
//   height y. A weapon sits just before what it answers (ghoul-arms.js).
// - `sky`: [kind, x, y] treasures floating high over the key's shelf,
//   centered at height y: a "crystal" or a power-up (Silver bolts are found
//   nowhere else). Too high for one jump from anywhere; Bat wings' second
//   jump from that shelf reaches them, so each room with some has wings on
//   the way.
// - `spawns`: what haunts the room, each woken as the camera reaches it:
//   ["zombie", x] shambles toward you; ["door", x, n, every] is a door in the
//   wall that lets n zombies out, one every `every` ms; ["crawl", x] is a
//   loose floorboard a crawler comes up through when you are near; ["bat",
//   x, y] roosts until you come close, then swoops; ["ghost", x, y] drifts
//   through walls, fading in and out; ["skel", x, y] stands on the surface at
//   height y and throws bones; ["hound", x] prowls the floor and lunges once
//   you are close; ["spider", x] hangs from the ceiling and drops when you
//   pass under it; ["wraith", x, y] hovers at height y, then shrieks and
//   dives at you; ["spitter", x] wades along the floor lobbing acid that
//   leaves a burning puddle. A door's fifth entry names what comes out of it
//   (a zombie, or in the Graveyard a rotter, out of an open grave). A stage
//   pack's monsters spawn the same way, at the height named for a perching
//   one (["crow", x, y], ["moth", x, y], a flock of three); see
//   ghoul-graveyard.js and ghoul-grounds.js.
// - `horde`: what keeps pouring in from the edges of the view while you are
//   in the room (none in a boss room), one every `hordeMs`.
// - `chandeliers`: the x of each one; it shakes and drops when you run under.
// - `boss`: null, or the boss that waits at the room's end ("gourd",
//   "bones" or a stage pack's), whose arena is the last FIELD_W of the room.
// - `toll`: the bell's period in ms, for a room where the bell tolls (the
//   Chapel's tower and choir): about every `toll` it swings, then rings and
//   freezes everything on screen for a second, you included.
// - `flicker`: the lamps' period in ms, for a room where they stutter and go
//   out (the Sanatorium's baths and theater): about every `flicker` they
//   stutter, then a blackout; see ghoul-sanatorium.js.
// - `moon`: the moonrise's length in ms, for a room where the moon climbs
//   (Hollow End's street, inn and square): at full, the villagers in view turn
//   and the moonhounds grow; see ghoul-village.js. A hanged man's spawn names
//   his beam's height, a shutter ghoul's the window's.
// - `rocks`: the rockfall's period in ms, for a room where rocks fall from the
//   ceiling now and then (the Deep Seam Mine's shaft, tunnels and collapse): a
//   dust warning over a spot, then the rock; see ghoul-mine.js.
// - `water`: [x0, x1] spans of the floor that are knee-deep water (the Mine's
//   tunnels): on the floor in one, Planny runs at 0.65 speed and jumps a little
//   lower (ghoul.js), and blind crawlers hear his steps from further.
//   The Mine's cage lifts are spawn rows too: ["cage", x, lowest y, highest y]
//   (the cage's bottom), a floor board Planny rides up and down.
// - `belts`: [x0, x1, speed] stretches of the floor that are conveyor belts (the
//   Carnival's funhouse): standing on the floor in one, Planny is carried along at
//   `speed` units a second (positive runs right), on top of his own running, never
//   while he is in the air; ghoul.js adds it (`you.belt`). Keep a belt on flat floor,
//   and clear of a pit.
// - `ice`: [x0, x1] spans of the floor that are slippery ice (the Frozen Lake): on the
//   floor in one, Planny's run eases toward the held direction and, let go, he slides
//   about 8 units, a jump keeps his speed, and Hot Cocoa turns it off (ghoul-frozen.js,
//   `iceRun`). Frozen Ghouls slide too. A pit right at the end of a span is a slide to plan
//   for (a run and a jump still clear it); keep a thin tile off both.
// - `thin`: [x0, x1] tiles of the floor that are thin ice (the Frozen Lake): stood on
//   they crack and then break into a pit, to freeze again a while later (ghoul-frozen.js,
//   `stepThin`). Each lies wholly on one level piece of `ground`, is narrow enough to
//   jump as a gap (the room test cuts them out and still walks the room), and keeps
//   solid floor of its own piece at least 6 clear of its ends and of its neighbors.
// - `ride`: null, or a ride room's track (the Deep Seam Mine's Runaway Cart,
//   see ghoul-cart.js): Planny rides a mine cart instead of walking. Its parts:
//   `track`, a list of polylines (each a list of [x, y] points, x rising) the
//   cart rolls along (two lines may overlap in x: a split track; a gap between
//   two lines is a jump; a line ending rising is a ramp); `beams` [x0, x1, y]
//   (a low lintel across the track whose underside is y over the room's floor,
//   to duck); `rubble` [x, line] and `crates` [x, line] (on track `line`);
//   `checks` (x positions of the checkpoints), `stop` (where the buffer stop
//   halts the cart), `time` (the room's clock in ms) and `surge` ([x0, x1, mult]
//   spans where the boulder rolls mult times faster). The ground is the cave
//   floor at the start and the end only, the rest is the chasm, and a ride room
//   has no key: the door opens at the buffer stop.
// - `ride.sled`: true for the Frozen Lake's Coffin Sled (ghoul-sled.js): the same `track`, `checks` and `time`, with
//   `stones` and `drifts` [x, line] (jump), `lows` [x0, x1, y, kind] (duck: a branch, kind 0, or an arch, kind 1, its underside y),
//   `hands` [x, line] (a hand that reaches out of the snow: jump or shoot), `icicles` and `pops` [x, line] (shoot: a hanging
//   cluster, a ghoul that pops up), `finish` (where the snowbank at the end begins; the last line ends in a lip that
//   launches the sled onto it) and `how` (the controls line); no `beams`, `rubble`, `crates`, `stop` or `surge`.
// - `ride.gallery`: true for the Carnival's dark ride (a shooting gallery, not a track: `time` the clock in ms, `ready` the
//   intro's ms, `how` the controls line of its banner; see ghoul-ride.js).
// - `bonus`: true for a bonus room (the Runaway Cart, the dark ride, the Coffin Sled): it plays for 5 hearts of its own, pays
//   Lucky Dice for a finish and costs the run nothing (ghoul-bonus.js).
// - `dark`: true for a room always dark, false for one always lit; left out,
//   each time it is entered it is dark DARK_CHANCE of the time (ghoul.js).

export const FIELD_W = 96;
export const FIELD_H = 54;
// The floor's usual height, the ceiling's, and where a chandelier hangs.
export const FLOOR_Y = 6;
export const CEILING_Y = 50;
export const CHANDELIER_Y = 44;

const freeze = (o) => Object.freeze(o);
const list = (rows) => freeze(rows.map((r) => freeze(r)));
// Frozen all the way down, for a ride's nested lists.
const deep = (o) => (o && typeof o === "object" ? freeze(Array.isArray(o) ? o.map(deep) : Object.fromEntries(Object.entries(o).map(([k, v]) => [k, deep(v)]))) : o);

function room(id, title, sub, spec) {
  return freeze({
    id,
    title,
    sub,
    length: spec.length,
    ground: list(spec.ground),
    shelves: list(spec.shelves || []),
    start: spec.start ?? 8,
    bonus: Boolean(spec.bonus),
    key: spec.key ? freeze(spec.key) : null,
    door: spec.door,
    candy: list(spec.candy || []),
    items: list(spec.items || []),
    sky: list(spec.sky || []),
    spawns: list(spec.spawns || []),
    chandeliers: freeze(spec.chandeliers || []),
    boss: spec.boss || null,
    horde: freeze(spec.horde || []),
    hordeMs: spec.hordeMs || 0,
    dark: spec.dark ?? null,
    toll: spec.toll || 0,
    flicker: spec.flicker || 0,
    moon: spec.moon || 0,
    rocks: spec.rocks || 0,
    water: list(spec.water || []),
    belts: list(spec.belts || []),
    ice: list(spec.ice || []),
    thin: list(spec.thin || []),
    ride: spec.ride ? deep(spec.ride) : null,
  });
}

export const ROOMS = freeze([
  // Every run starts here: a long, easy walk with only zombies, then the
  // first choice of stage.
  room("hall", "The Long Hall", "Every door but one is locked", {
    length: 540,
    ground: [[0, 180, 6], [180, 186, 8.5], [186, 300, 11], [300, 306, 8.5], [306, 540, 6]],
    shelves: [[110, 126, 15], [240, 256, 19.5], [400, 416, 15]],
    key: [248, 19.5],
    door: 530,
    candy: [[40, 8.5, 5], [111, 18, 4], [200, 13.5, 6], [241, 22.5, 4], [330, 8.5, 6], [401, 18, 4], [450, 8.5, 6]],
    items: [["wings", 60, 6], ["rapid", 122, 15], ["dyn", 44, 6], ["stake", 262, 11]],
    sky: [["crystal", 242, 42], ["crystal", 248, 44], ["crystal", 254, 42]],
    spawns: [["zombie", 80], ["zombie", 150], ["zombie", 220], ["door", 280, 2, 2200], ["zombie", 350], ["zombie", 430], ["door", 470, 2, 2200], ["zombie", 505]],
    horde: ["zombie"],
    hordeMs: 3400,
  }),
  // Zombies and the first hounds: run, shoot, climb the stairs, jump for the key.
  room("foyer", "Foyer", "The front door locked behind you", {
    length: 550,
    ground: [[0, 150, 6], [150, 156, 8.5], [156, 162, 11], [162, 214, 13.5], [214, 220, 11], [220, 226, 8.5], [226, 550, 6]],
    shelves: [[60, 76, 15], [178, 198, 22], [280, 296, 15], [330, 346, 15], [420, 436, 15]],
    key: [188, 22],
    door: 540,
    candy: [[61, 18, 3], [100, 8.5, 6], [166, 16, 4], [232, 8.5, 5], [283, 18, 4], [333, 18, 4], [423, 18, 4], [455, 8.5, 5], [505, 8.5, 5]],
    items: [["rapid", 72, 15], ["wings", 120, 6], ["stake", 234, 6], ["ball", 316, 6]],
    sky: [["crystal", 182, 43], ["crystal", 188, 45], ["crystal", 194, 43]],
    spawns: [["zombie", 90], ["zombie", 128], ["zombie", 200], ["door", 240, 3, 1600], ["zombie", 305], ["door", 352, 2, 1800], ["hound", 330], ["zombie", 410], ["door", 452, 3, 1700], ["hound", 470], ["zombie", 480], ["zombie", 520]],
    chandeliers: [270],
    horde: ["zombie"],
    hordeMs: 2600,
  }),
  // Pits, crawlers coming up through the boards, spiders overhead.
  room("gallery", "Portrait Gallery", "The paintings have stopped pretending", {
    length: 520,
    ground: [[0, 100, 6], [110, 190, 6], [190, 196, 8.5], [196, 250, 11], [260, 330, 6], [340, 430, 6], [440, 520, 6]],
    shelves: [[130, 146, 15], [290, 302, 15], [286, 306, 24], [452, 468, 15]],
    key: [296, 24],
    door: 510,
    candy: [[40, 8.5, 5], [102, 12, 3], [131, 18, 3], [200, 13.5, 6], [252, 15, 3], [332, 12, 3], [360, 8.5, 5], [432, 12, 3], [455, 18, 4]],
    items: [["spread", 142, 15], ["wings", 235, 11], ["ball", 58, 6], ["rocket", 115, 6]],
    sky: [["crystal", 290, 44], ["silver", 296, 46], ["crystal", 302, 44]],
    spawns: [["crawl", 70], ["zombie", 150], ["crawl", 172], ["door", 222, 3, 1500], ["crawl", 280], ["zombie", 315], ["crawl", 368], ["zombie", 398], ["door", 470, 2, 1600], ["crawl", 488], ["zombie", 505], ["spider", 120], ["spider", 236], ["hound", 352], ["spider", 455]],
    horde: ["zombie", "hound"],
    hordeMs: 2400,
  }),
  // Bats in the rafters, spiders in the stacks, and boards that give way.
  room("library", "Library", "Something is nesting in the stacks", {
    length: 420,
    ground: [[0, 90, 6], [102, 170, 6], [182, 260, 6], [260, 266, 8.5], [266, 272, 11], [272, 420, 11]],
    shelves: [[88, 104, 6, "crumble"], [168, 184, 6, "crumble"], [40, 56, 15], [120, 136, 15], [124, 132, 24], [300, 316, 20], [350, 366, 20, "crumble"]],
    key: [128, 24],
    door: 410,
    candy: [[41, 18, 3], [92, 10, 4], [125, 31, 3], [196, 8.5, 6], [302, 23, 4], [380, 13.5, 5]],
    items: [["garlic", 52, 15], ["lantern", 230, 6], ["wings", 70, 6], ["rocket", 40, 6], ["ball", 200, 6]],
    sky: [["crystal", 122, 44], ["crystal", 128, 46], ["crystal", 134, 44]],
    spawns: [["bat", 62, 44], ["crawl", 115], ["bat", 150, 44], ["zombie", 212], ["bat", 232, 44], ["door", 290, 3, 1500], ["bat", 332, 44], ["crawl", 372], ["zombie", 400], ["spider", 66], ["spider", 196], ["hound", 240], ["hound", 345]],
    horde: ["zombie", "hound", "bat"],
    hordeMs: 2300,
  }),
  // The first boss.
  room("ballroom", "Ballroom", "The music stopped years ago. The dancing did not", {
    length: 200,
    ground: [[0, 200, 6]],
    // The arena (104 on) is a dance floor stacked to the ceiling with
    // balconies: the low ones (15) still within the Gourd's reach, the rest
    // (24, 33) over its head, where its hop and its quake cannot reach you.
    shelves: [[110, 122, 15], [136, 148, 15], [162, 174, 15], [178, 188, 15], [116, 132, 24], [150, 166, 24], [172, 186, 24], [128, 144, 33], [158, 174, 33]],
    key: null,
    door: 194,
    items: [["ball", 52, 6]],
    candy: [[20, 8.5, 5], [66, 8.5, 5]],
    spawns: [["zombie", 62], ["hound", 88]],
    chandeliers: [48],
    boss: "gourd",
  }),
  // Skeletons on the counters, and trapdoors to the cellar.
  room("kitchen", "Kitchen", "Something is still cooking", {
    length: 430,
    ground: [[0, 70, 6], [70, 110, 11], [110, 150, 6], [162, 210, 6], [210, 216, 8.5], [216, 270, 11], [282, 430, 6]],
    shelves: [[30, 46, 16], [120, 136, 16], [180, 196, 15], [182, 194, 24], [300, 316, 16], [360, 376, 16]],
    key: [188, 24],
    door: 420,
    candy: [[33, 19, 4], [74, 13.5, 4], [152, 10, 3], [185, 31, 3], [228, 13.5, 6], [303, 19, 4], [390, 8.5, 5]],
    items: [["rapid", 128, 16], ["hourglass", 340, 6], ["wings", 90, 11], ["skillet", 78, 11], ["rocket", 290, 6]],
    sky: [["crystal", 182, 44], ["silver", 188, 46], ["crystal", 194, 44]],
    spawns: [["zombie", 44], ["skel", 92, 11], ["crawl", 132], ["door", 175, 2, 1800], ["zombie", 232], ["skel", 248, 11], ["bat", 300, 44], ["crawl", 322], ["skel", 368, 16], ["door", 404, 2, 1600], ["spitter", 140], ["hound", 196], ["spitter", 300], ["hound", 392]],
    chandeliers: [236, 335],
    horde: ["zombie", "hound"],
    hordeMs: 2200,
  }),
  // Ghosts drifting through the glass, wraiths diving out of the dark.
  room("conservatory", "Conservatory", "Everything in here died screaming", {
    length: 440,
    ground: [[0, 100, 6], [112, 180, 6], [180, 186, 8.5], [186, 240, 11], [252, 330, 6], [330, 336, 8.5], [336, 440, 11]],
    shelves: [[50, 66, 15], [130, 146, 15], [134, 142, 24], [270, 286, 16, "crumble"], [300, 316, 16], [380, 396, 20]],
    key: [138, 24],
    door: 430,
    candy: [[51, 18, 3], [103, 12, 3], [135, 31, 3], [192, 13.5, 6], [255, 9, 4], [288, 9, 4], [381, 23, 3]],
    items: [["spread", 62, 15], ["garlic", 392, 20], ["bell", 20, 6], ["wings", 96, 6], ["rocket", 196, 11], ["skillet", 270, 6]],
    sky: [["crystal", 132, 44], ["crystal", 138, 46], ["crystal", 144, 44]],
    spawns: [["ghost", 104, 20], ["door", 122, 2, 1800], ["ghost", 162, 24], ["crawl", 200], ["ghost", 232, 26], ["crawl", 282], ["skel", 308, 16], ["ghost", 322, 22], ["bat", 360, 44], ["ghost", 408, 24], ["zombie", 422], ["spitter", 150], ["wraith", 210, 32], ["wraith", 300, 34], ["hound", 350], ["wraith", 395, 30]],
    horde: ["zombie", "hound"],
    hordeMs: 2100,
  }),
  // Everything at once, over the rafters.
  room("attic", "Attic", "Whatever they locked up here got out", {
    length: 450,
    ground: [[0, 70, 6], [82, 140, 6], [152, 200, 6], [200, 206, 8.5], [206, 212, 11], [212, 270, 13.5], [282, 340, 11], [352, 450, 6]],
    shelves: [[68, 84, 6, "crumble"], [138, 154, 6, "crumble"], [100, 116, 15], [160, 176, 15], [164, 172, 24], [290, 306, 20], [380, 396, 15]],
    key: [168, 24],
    door: 440,
    candy: [[30, 8.5, 5], [72, 10, 3], [100, 18, 3], [165, 31, 3], [220, 16, 5], [290, 23, 2], [360, 8.5, 5]],
    items: [["rapid", 112, 15], ["life", 304, 20], ["lantern", 45, 6], ["hourglass", 400, 6], ["wings", 60, 6], ["skillet", 100, 6], ["dyn", 356, 6]],
    sky: [["crystal", 162, 44], ["silver", 168, 46], ["crystal", 174, 44]],
    spawns: [["bat", 40, 44], ["crawl", 90], ["skel", 128, 6], ["ghost", 122, 24], ["bat", 150, 44], ["crawl", 182], ["door", 232, 3, 1500], ["bat", 252, 44], ["skel", 298, 20], ["ghost", 322, 26], ["crawl", 372], ["bat", 392, 44], ["zombie", 424], ["hound", 56], ["spider", 110], ["wraith", 196, 34], ["spider", 300], ["spitter", 365], ["spider", 418]],
    chandeliers: [244, 402],
    horde: ["zombie", "hound", "bat"],
    hordeMs: 2000,
  }),
  // The second boss, down among the tombs.
  room("crypt", "Crypt", "Something old is awake down here", {
    length: 200,
    ground: [[0, 200, 6]],
    shelves: [[132, 148, 17]],
    key: null,
    door: 194,
    items: [["skillet", 20, 6]],
    candy: [[18, 8.5, 5], [70, 8.5, 5]],
    spawns: [["crawl", 46], ["crawl", 74], ["hound", 30], ["spitter", 62]],
    boss: "bones",
  }),
  // The Graveyard, out past the manor: rotters climbing out of graves (the
  // "door" spawns name what comes out), hands under the dirt, mourners,
  // grave robbers and crows on the headstones.
  room("lychgate", "Lychgate", "Every gate here only opens one way", {
    length: 480,
    ground: [[0, 110, 6], [120, 190, 6], [190, 196, 8.5], [196, 250, 11], [260, 340, 6], [350, 480, 6]],
    shelves: [[40, 56, 15], [140, 156, 15], [286, 302, 15], [282, 306, 24], [400, 416, 15]],
    key: [294, 24],
    door: 470,
    candy: [[20, 8.5, 5], [41, 18, 3], [112, 12, 3], [141, 18, 3], [200, 13.5, 6], [252, 15, 3], [287, 27, 4], [360, 8.5, 5], [401, 18, 3]],
    items: [["spread", 152, 15], ["wings", 235, 11], ["salt", 66, 6], ["stake", 308, 6]],
    sky: [["crystal", 288, 44], ["silver", 294, 46], ["crystal", 300, 44]],
    spawns: [["hands", 80], ["rotter", 140], ["crow", 170, 10], ["hands", 215], ["door", 228, 2, 1800, "rotter"], ["mourner", 320], ["hands", 372], ["crow", 410, 15], ["rotter", 440], ["robber", 455]],
    horde: ["rotter"],
    hordeMs: 2500,
  }),
  room("graves", "Open Graves", "They were dug this morning", {
    length: 500,
    ground: [[0, 80, 6], [88, 150, 6], [158, 230, 6], [230, 236, 8.5], [236, 290, 11], [300, 360, 6], [368, 420, 6], [430, 500, 6]],
    shelves: [[100, 116, 15], [176, 192, 15], [180, 188, 24], [310, 326, 15], [440, 456, 15]],
    key: [184, 24],
    door: 490,
    candy: [[20, 8.5, 5], [101, 18, 3], [181, 27, 3], [240, 13.5, 6], [311, 18, 3], [380, 8.5, 5], [441, 18, 3]],
    items: [["wings", 60, 6], ["garlic", 320, 15], ["hourglass", 395, 6], ["salt", 100, 6], ["rocket", 258, 11]],
    sky: [["crystal", 178, 44], ["crystal", 184, 46], ["crystal", 190, 44]],
    spawns: [["robber", 60], ["hands", 120], ["rotter", 170], ["door", 205, 2, 1700, "rotter"], ["robber", 250], ["crow", 270, 15], ["hands", 330], ["mourner", 345], ["rotter", 390], ["hands", 460], ["robber", 480]],
    horde: ["rotter", "crow"],
    hordeMs: 2400,
  }),
  room("mausoleums", "Mausoleum Row", "The families are home", {
    length: 460,
    ground: [[0, 90, 6], [90, 96, 8.5], [96, 140, 11], [152, 220, 6], [220, 226, 8.5], [226, 232, 11], [232, 280, 13.5], [292, 360, 6], [372, 460, 6]],
    shelves: [[40, 56, 15], [110, 126, 20], [170, 186, 15], [174, 182, 24], [250, 266, 22], [310, 326, 15], [390, 406, 15]],
    key: [178, 24],
    door: 450,
    candy: [[20, 8.5, 5], [41, 18, 3], [111, 23, 3], [175, 27, 3], [240, 16, 6], [311, 18, 3], [380, 8.5, 5]],
    items: [["lantern", 30, 6], ["wings", 100, 11], ["rapid", 258, 22], ["life", 398, 15], ["salt", 156, 6], ["stake", 300, 6]],
    sky: [["crystal", 172, 44], ["silver", 178, 46], ["crystal", 184, 44]],
    spawns: [["door", 60, 2, 1700, "rotter"], ["mourner", 120], ["crow", 118, 20], ["hands", 165], ["robber", 200], ["door", 245, 3, 1500, "rotter"], ["crow", 258, 22], ["mourner", 320], ["hands", 340], ["rotter", 385], ["robber", 420], ["crow", 398, 15]],
    horde: ["rotter", "crow"],
    hordeMs: 2200,
  }),
  // The Graveyard's boss: Mother Mourning, in the plot at the end.
  room("angel", "Angel's Rest", "She has wept here for two hundred years", {
    length: 200,
    ground: [[0, 200, 6]],
    shelves: [[110, 122, 14], [126, 140, 22], [146, 158, 14]],
    key: null,
    door: 194,
    items: [["salt", 24, 6]],
    candy: [[18, 8.5, 5], [70, 8.5, 5]],
    spawns: [["hands", 40], ["rotter", 62], ["crow", 80, 12]],
    boss: "angel",
  }),
  // The Grounds, the manor's gardens: hedge blocks to jump and hop between
  // with topiary beasts in the gaps, rootlings under the lawn, mulch crawlers
  // in the leaf piles and lantern moths (a moth row is a flock of three).
  room("maze", "Hedge Maze", "The hedges move when you look away", {
    length: 520,
    ground: [[0, 100, 6], [100, 116, 12], [116, 140, 6], [140, 158, 15], [158, 186, 6], [186, 200, 12], [200, 262, 6], [262, 278, 12], [278, 300, 6], [300, 320, 15], [320, 350, 6], [350, 366, 12], [366, 520, 6]],
    shelves: [[228, 244, 15], [224, 248, 24], [60, 76, 15], [400, 416, 15]],
    key: [236, 24],
    door: 510,
    candy: [[20, 8.5, 5], [102, 14.5, 4], [142, 17.5, 4], [204, 8.5, 5], [229, 18, 3], [264, 14.5, 4], [302, 17.5, 4], [370, 8.5, 5], [401, 18, 3], [450, 8.5, 5]],
    items: [["wings", 40, 6], ["shears", 150, 15], ["spread", 270, 12], ["lantern", 330, 6], ["sickle", 120, 6], ["rocket", 324, 6]],
    sky: [["crystal", 230, 44], ["crystal", 236, 46], ["crystal", 242, 44]],
    spawns: [["zombie", 56], ["mulch", 82], ["topiary", 128], ["moth", 178, 30], ["topiary", 170], ["hound", 215], ["zombie", 250], ["mulch", 286], ["topiary", 290], ["moth", 330, 32], ["topiary", 336], ["zombie", 392], ["mulch", 420], ["hound", 470]],
    horde: ["zombie", "moth", "topiary"],
    hordeMs: 2600,
  }),
  // Open lawns and ponds: roots bursting up under your feet, leaf piles.
  room("topiary", "Topiary Garden", "Nobody trimmed them into those shapes", {
    length: 540,
    ground: [[0, 100, 6], [110, 180, 6], [180, 186, 8.5], [186, 240, 11], [250, 330, 6], [330, 336, 8.5], [336, 400, 11], [400, 406, 8.5], [406, 540, 6]],
    shelves: [[276, 292, 15], [272, 296, 24], [130, 146, 15], [350, 366, 20]],
    key: [284, 24],
    door: 530,
    candy: [[20, 8.5, 5], [131, 18, 3], [190, 13.5, 6], [255, 8.5, 5], [277, 18, 3], [340, 13.5, 5], [351, 23, 3], [420, 8.5, 6], [480, 8.5, 5]],
    items: [["shears", 120, 6], ["wings", 150, 6], ["garlic", 138, 15], ["shears", 345, 11], ["lantern", 36, 6], ["hourglass", 470, 6], ["sickle", 72, 6], ["dyn", 420, 6]],
    sky: [["crystal", 278, 44], ["silver", 284, 46], ["crystal", 290, 44]],
    spawns: [["rootling", 48], ["topiary", 90], ["mulch", 130], ["rootling", 168], ["moth", 205, 30], ["rootling", 222], ["topiary", 260], ["mulch", 300], ["rootling", 312], ["hound", 345], ["rootling", 372], ["topiary", 390], ["mulch", 430], ["zombie", 450], ["rootling", 485], ["bat", 510, 44]],
    horde: ["rootling", "mulch", "topiary", "moth"],
    hordeMs: 2300,
  }),
  // A party that never ended: tables to hop along, the gazebo's roof, moths.
  room("gazebo", "Gazebo", "The party is still waiting for you", {
    length: 500,
    ground: [[0, 120, 6], [130, 220, 6], [220, 226, 8.5], [226, 290, 11], [300, 370, 6], [380, 500, 6]],
    shelves: [[40, 58, 11], [150, 166, 11], [170, 186, 17], [240, 256, 17], [320, 336, 15], [316, 340, 24], [400, 418, 11], [430, 448, 11]],
    key: [328, 24],
    door: 490,
    candy: [[41, 13.5, 3], [100, 8.5, 5], [151, 13.5, 3], [171, 19.5, 3], [232, 13.5, 6], [241, 19.5, 3], [321, 18, 3], [401, 13.5, 4], [431, 13.5, 3], [465, 8.5, 5]],
    items: [["wings", 80, 6], ["shears", 160, 11], ["rapid", 248, 17], ["lantern", 20, 6], ["life", 440, 11], ["rocket", 60, 6], ["sickle", 210, 6]],
    sky: [["crystal", 322, 44], ["silver", 328, 46], ["crystal", 334, 44]],
    spawns: [["moth", 70, 28], ["zombie", 100], ["ghost", 140, 20], ["moth", 190, 30], ["mulch", 205], ["topiary", 236], ["bat", 262, 44], ["moth", 280, 30], ["rootling", 312], ["moth", 350, 28], ["ghost", 360, 22], ["topiary", 395], ["moth", 410, 30], ["hound", 425], ["rootling", 448], ["moth", 470, 30]],
    horde: ["moth", "zombie", "topiary", "moth"],
    hordeMs: 2000,
  }),
  // The Grounds' boss: the Groundskeeper, in his yard behind the gazebo.
  room("yard", "The Groundskeeper's Yard", "He has been tending this garden a long time", {
    length: 200,
    ground: [[0, 200, 6]],
    // Shelves over the mower's reach (22 clears his 14.4 above the floor) up
    // stairs of lower boards.
    shelves: [[106, 122, 12], [116, 138, 22], [150, 166, 12], [144, 164, 22]],
    key: null,
    door: 194,
    candy: [[18, 8.5, 5], [70, 8.5, 5]],
    items: [["shears", 60, 6], ["sickle", 30, 6]],
    spawns: [["rootling", 40], ["topiary", 62], ["moth", 80, 30]],
    boss: "keeper",
  }),
  // The Chapel, past the gardens: candlelit stone and stained glass. Pews to
  // hop along, choir ghosts and censer monks.
  room("nave", "Nave", "The congregation never left", {
    length: 520,
    ground: [[0, 200, 6], [200, 206, 8.5], [206, 212, 11], [212, 300, 11], [300, 306, 8.5], [306, 520, 6]],
    shelves: [[36, 52, 11], [60, 76, 11], [84, 100, 11], [150, 166, 11], [174, 190, 11], [236, 252, 17], [330, 346, 11], [352, 368, 11], [380, 396, 15], [374, 402, 24], [430, 446, 11], [454, 470, 11]],
    key: [388, 24],
    door: 510,
    candy: [[20, 8.5, 5], [37, 14, 3], [61, 14, 3], [85, 14, 3], [151, 14, 3], [175, 14, 3], [220, 13.5, 6], [237, 20, 3], [331, 14, 3], [381, 18, 3], [432, 14, 3], [480, 8.5, 5]],
    items: [["wings", 24, 6], ["holy", 104, 6], ["spread", 160, 11], ["garlic", 242, 17], ["rapid", 440, 11], ["fork", 112, 6], ["stake", 310, 6]],
    sky: [["crystal", 382, 44], ["crystal", 388, 46], ["crystal", 394, 44]],
    spawns: [["monk", 70], ["skel", 92, 11], ["chorister", 125, 22], ["monk", 180], ["ghost", 232, 24], ["chorister", 260, 26], ["monk", 322], ["skel", 340, 11], ["monk", 410], ["chorister", 450, 24], ["zombie", 500]],
    chandeliers: [270],
    horde: ["monk", "chorister", "zombie"],
    hordeMs: 2600,
  }),
  // A climb up beams and ladders under the bells: gargoyles on the ledges,
  // bats asleep in the bells, and the bell itself.
  room("tower", "Bell Tower", "Something is ringing the bells", {
    length: 480,
    ground: [[0, 100, 6], [110, 170, 6], [170, 176, 8.5], [176, 182, 11], [182, 240, 13.5], [252, 330, 6], [340, 400, 6], [400, 406, 8.5], [406, 480, 11]],
    shelves: [[130, 146, 15], [138, 154, 21], [190, 206, 19], [196, 212, 25], [296, 312, 15], [292, 316, 24], [350, 366, 15], [356, 372, 21], [430, 446, 17]],
    key: [304, 24],
    door: 470,
    candy: [[20, 8.5, 5], [131, 18, 3], [139, 24, 3], [185, 16, 5], [191, 22, 3], [197, 28, 3], [260, 8.5, 5], [297, 18, 3], [351, 18, 3], [357, 24, 3], [372, 8.5, 4], [431, 20, 3], [450, 13.5, 4]],
    items: [["wings", 20, 6], ["holy", 112, 6], ["rapid", 134, 15], ["garlic", 196, 19], ["hourglass", 345, 6], ["fork", 126, 6], ["rocket", 256, 6]],
    sky: [["crystal", 298, 44], ["silver", 304, 46], ["crystal", 310, 44]],
    spawns: [["bellbat", 120, 38], ["monk", 60], ["gargoyle", 148, 30], ["chorister", 160, 26], ["bellbat", 220, 38], ["monk", 195], ["ghost", 232, 24], ["gargoyle", 262, 28], ["bellbat", 290, 38], ["chorister", 320, 28], ["gargoyle", 372, 30], ["bellbat", 345, 38], ["monk", 380], ["skel", 358, 21], ["bellbat", 440, 38], ["gargoyle", 450, 30]],
    chandeliers: [],
    horde: ["bellbat", "monk", "chorister"],
    hordeMs: 2300,
    toll: 12000,
  }),
  // Everything at once among the pipes and balconies.
  room("loft", "Organ Loft", "Every hymn is the same wrong note", {
    length: 500,
    ground: [[0, 90, 6], [100, 160, 6], [160, 166, 8.5], [166, 172, 11], [172, 230, 11], [242, 300, 6], [300, 306, 8.5], [306, 312, 11], [312, 380, 11], [392, 440, 6], [440, 446, 8.5], [446, 500, 11]],
    shelves: [[110, 126, 15], [120, 136, 20], [180, 196, 17], [190, 206, 23], [256, 272, 15], [252, 276, 24], [330, 346, 17], [340, 356, 23], [400, 416, 14], [410, 426, 20]],
    key: [264, 24],
    door: 490,
    candy: [[20, 8.5, 5], [111, 18, 3], [121, 23, 3], [176, 13.5, 4], [181, 20, 3], [191, 26, 3], [257, 18, 3], [331, 20, 3], [341, 26, 3], [401, 17, 3], [411, 23, 3], [455, 13.5, 5]],
    items: [["wings", 20, 6], ["holy", 104, 6], ["rapid", 112, 15], ["lantern", 176, 11], ["life", 336, 17], ["fork", 108, 6], ["dyn", 248, 6]],
    sky: [["crystal", 258, 44], ["crystal", 264, 46], ["crystal", 270, 44]],
    spawns: [["monk", 50], ["skel", 118, 15], ["gargoyle", 120, 30], ["chorister", 140, 24], ["monk", 190], ["gargoyle", 200, 32], ["chorister", 215, 28], ["ghost", 236, 22], ["monk", 258], ["gargoyle", 275, 30], ["chorister", 285, 24], ["monk", 322], ["skel", 336, 17], ["gargoyle", 350, 32], ["chorister", 370, 26], ["zombie", 395], ["monk", 420], ["gargoyle", 430, 30], ["chorister", 460, 26], ["monk", 470], ["zombie", 480]],
    chandeliers: [212, 362],
    horde: ["monk", "chorister", "bellbat", "zombie"],
    hordeMs: 2000,
  }),
  // The Chapel's boss: the Choirmaster at his organ. Boards at three heights
  // for the staff's gaps (a note is passed on the floor or on a board).
  room("choir", "The Choir", "He has been rehearsing for centuries", {
    length: 200,
    ground: [[0, 200, 6]],
    shelves: [[108, 122, 12], [118, 134, 16.5], [130, 146, 22]],
    key: null,
    door: 194,
    candy: [[18, 8.5, 5], [70, 8.5, 5]],
    items: [["holy", 60, 6], ["fork", 28, 6]],
    spawns: [["monk", 40], ["chorister", 90, 26]],
    boss: "choirmaster",
    toll: 12000,
  }),
  // Blackmoor Sanatorium, past the chapel: green-gray tile and ceiling lamps
  // that flicker. Benches and a reception desk to hop along; orderlies and
  // gurneys first met here.
  room("admissions", "Admissions", "Your bed has been made up", {
    length: 500,
    ground: [[0, 150, 6], [150, 156, 8.5], [156, 240, 11], [240, 246, 8.5], [246, 500, 6]],
    shelves: [[36, 52, 11], [60, 76, 11], [84, 100, 11], [180, 206, 17], [212, 228, 17], [330, 346, 15], [326, 350, 24], [400, 416, 11], [424, 440, 11]],
    key: [338, 24],
    door: 490,
    candy: [[20, 8.5, 5], [37, 14, 3], [61, 14, 3], [85, 14, 3], [165, 13.5, 6], [181, 20, 3], [260, 8.5, 5], [331, 18, 3], [401, 14, 3], [425, 14, 3], [460, 8.5, 5]],
    items: [["wings", 24, 6], ["garlic", 68, 11], ["salts", 120, 6], ["spread", 190, 17], ["saw", 290, 6], ["rapid", 432, 11], ["flash", 172, 11], ["stake", 254, 6]],
    sky: [["crystal", 332, 44], ["crystal", 338, 46], ["crystal", 344, 44]],
    spawns: [["zombie", 70], ["gurney", 110], ["crawl", 140], ["orderly", 190], ["ghost", 225, 24], ["gurney", 262], ["spitter", 285], ["zombie", 310], ["orderly", 372], ["crawl", 385], ["gurney", 420], ["zombie", 450], ["gurney", 470]],
    chandeliers: [300],
    horde: ["zombie", "gurney"],
    hordeMs: 2600,
  }),
  // Tubs as low pits to hop, tiled ledges; specimen bloaters and flickers, and
  // the lamps going out now and then.
  room("baths", "Hydrotherapy Baths", "The water is warm and moving", {
    length: 520,
    ground: [[0, 100, 6], [108, 170, 6], [170, 176, 8.5], [176, 240, 11], [248, 300, 6], [308, 360, 6], [360, 366, 8.5], [366, 430, 11], [438, 520, 6]],
    shelves: [[30, 46, 11], [112, 128, 11], [190, 206, 17], [264, 288, 24], [268, 284, 15], [320, 336, 11], [392, 408, 17], [456, 472, 11]],
    key: [276, 24],
    door: 510,
    candy: [[20, 8.5, 5], [31, 14, 3], [113, 14, 3], [178, 13.5, 6], [191, 20, 3], [250, 8.5, 5], [269, 18, 3], [310, 8.5, 5], [321, 14, 3], [368, 13.5, 5], [393, 20, 3], [457, 14, 3], [480, 8.5, 5]],
    items: [["wings", 20, 6], ["spread", 40, 11], ["salts", 118, 11], ["saw", 200, 17], ["rapid", 330, 11], ["garlic", 400, 17], ["hourglass", 480, 6], ["flash", 74, 6], ["dyn", 252, 6]],
    sky: [["crystal", 270, 44], ["crystal", 276, 46], ["crystal", 282, 44]],
    spawns: [["zombie", 50], ["flicker", 90], ["specimen", 132], ["gurney", 150], ["crawl", 182], ["flicker", 210], ["orderly", 225], ["specimen", 255], ["flicker", 285], ["zombie", 318], ["gurney", 340], ["ghost", 350, 24], ["flicker", 385], ["specimen", 410], ["orderly", 445], ["crawl", 470], ["flicker", 495]],
    horde: ["zombie", "flicker", "specimen", "crawler"],
    hordeMs: 2300,
    flicker: 9000,
  }),
  // The tiered gallery as stacked boards; everything at once, and the lamps
  // fail more often.
  room("theater", "Surgical Theater", "The audience is taking notes", {
    length: 540,
    ground: [[0, 110, 6], [110, 116, 8.5], [116, 200, 11], [208, 290, 6], [298, 380, 6], [380, 386, 8.5], [386, 540, 11]],
    shelves: [[130, 146, 17], [138, 154, 23], [244, 260, 15], [240, 264, 24], [300, 316, 11], [308, 324, 16], [316, 332, 21], [340, 356, 11], [348, 364, 16], [356, 372, 21], [420, 436, 17], [428, 444, 23], [470, 486, 17]],
    key: [252, 24],
    door: 530,
    candy: [[20, 8.5, 5], [131, 20, 3], [139, 26, 3], [217, 8.5, 5], [245, 18, 3], [301, 14, 3], [309, 19, 3], [317, 24, 3], [341, 14, 3], [357, 24, 3], [421, 20, 3], [429, 26, 3], [490, 13.5, 5]],
    items: [["wings", 24, 6], ["salts", 136, 17], ["saw", 306, 11], ["rapid", 350, 11], ["garlic", 362, 21], ["spread", 436, 23], ["life", 480, 17], ["flash", 146, 11], ["stake", 304, 6]],
    sky: [["crystal", 246, 44], ["crystal", 252, 46], ["crystal", 258, 44]],
    spawns: [["zombie", 50], ["orderly", 90], ["gurney", 135], ["flicker", 160], ["specimen", 185], ["crawl", 225], ["flicker", 235], ["orderly", 270], ["gurney", 282], ["ghost", 300, 24], ["specimen", 318], ["flicker", 345], ["gurney", 362], ["zombie", 372], ["orderly", 410], ["flicker", 430], ["specimen", 455], ["crawl", 470], ["orderly", 505], ["gurney", 515]],
    chandeliers: [160, 440],
    horde: ["zombie", "orderly", "flicker", "specimen", "gurney", "crawler"],
    hordeMs: 2000,
    flicker: 6500,
  }),
  // The Sanatorium's boss: the Night Matron, on her rounds in the ward. Two
  // medicine cabinets (raised floor blocks 4.5 high at 136 and 164: cover from
  // her lantern, which hangs 8 over her feet; bolts stop at them too) and, up
  // two stairs of boards, boards above the beam's reach (17 and 22).
  room("ward", "The Night Ward", "She makes her rounds at midnight", {
    length: 200,
    ground: [[0, 136, 6], [136, 144, 10.5], [144, 164, 6], [164, 172, 10.5], [172, 200, 6]],
    shelves: [[110, 124, 12], [118, 132, 17], [126, 148, 22], [148, 160, 12], [152, 166, 17], [156, 178, 22]],
    key: null,
    door: 194,
    candy: [[18, 8.5, 5], [70, 8.5, 5]],
    items: [["salts", 60, 6], ["saw", 80, 6], ["flash", 30, 6]],
    spawns: [["zombie", 40], ["gurney", 64], ["orderly", 88]],
    boss: "matron",
  }),
  // Hollow End Village, past the sanatorium: out under the night sky, the moon
  // climbing. Awnings and rooftops to hop along, shutter ghouls in the windows
  // (a row names the window's height) and the torch mob in groups of three.
  room("street", "Main Street", "Every curtain twitches as you pass", {
    length: 500,
    ground: [[0, 110, 6], [110, 116, 8.5], [116, 170, 11], [178, 240, 6], [240, 246, 8.5], [246, 252, 11], [252, 312, 13.5], [312, 386, 6], [394, 500, 6]],
    shelves: [[30, 48, 11], [60, 78, 11], [66, 84, 17], [124, 140, 17], [186, 204, 11], [192, 210, 17], [258, 274, 19], [322, 338, 15], [318, 342, 24], [350, 366, 11], [420, 438, 11], [430, 448, 17]],
    key: [330, 24],
    door: 490,
    candy: [[20, 8.5, 5], [31, 14, 3], [61, 14, 3], [67, 20, 3], [125, 20, 3], [130, 13.5, 6], [187, 14, 3], [193, 20, 3], [259, 22, 3], [296, 16, 4], [323, 18, 3], [351, 14, 3], [370, 8.5, 5], [421, 14, 3], [431, 20, 3], [466, 8.5, 5]],
    items: [["wings", 24, 6], ["spread", 70, 11], ["bane", 150, 11], ["garlic", 198, 11], ["rapid", 436, 11], ["rocket", 184, 6], ["trap", 330, 6]],
    sky: [["crystal", 324, 44], ["crystal", 330, 46], ["crystal", 336, 44]],
    spawns: [["zombie", 60], ["shutter", 96, 13], ["villager", 136], ["bat", 160, 40], ["shutter", 190, 13], ["crow", 202, 16], ["crawler", 215], ["shutter", 280, 20.5], ["zombie", 330], ["hound", 350], ["villager", 360], ["shutter", 372, 13], ["crawler", 420], ["crow", 432, 22], ["shutter", 470, 13]],
    horde: ["crawler", "zombie"],
    hordeMs: 3200,
    moon: 45000,
  }),
  // The one room indoors: tavern tables and a balcony to hop along; moonhounds
  // and villagers.
  room("inn", "The Crooked Inn", "Rooms are free. Leaving is not", {
    length: 520,
    ground: [[0, 100, 6], [108, 170, 6], [170, 176, 8.5], [176, 236, 11], [244, 310, 6], [318, 380, 6], [380, 386, 8.5], [386, 392, 11], [392, 520, 11]],
    shelves: [[30, 46, 11], [56, 72, 11], [120, 136, 11], [126, 142, 17], [180, 214, 17], [268, 284, 15], [264, 288, 24], [330, 346, 15], [340, 356, 21], [410, 426, 17], [440, 456, 17]],
    key: [276, 24],
    door: 510,
    candy: [[20, 8.5, 5], [31, 14, 3], [57, 14, 3], [112, 8.5, 5], [121, 14, 3], [127, 20, 3], [181, 20, 3], [200, 20, 3], [178, 13.5, 4], [269, 18, 3], [265, 27, 3], [331, 18, 3], [341, 24, 3], [411, 20, 3], [441, 20, 3], [470, 13.5, 5]],
    items: [["wings", 24, 6], ["spread", 60, 11], ["bane", 112, 6], ["garlic", 190, 17], ["rapid", 334, 15], ["hourglass", 470, 11], ["trap", 72, 6], ["stake", 248, 6]],
    sky: [["crystal", 270, 44], ["crystal", 276, 46], ["crystal", 282, 44]],
    spawns: [["zombie", 50], ["moonhound", 84], ["villager", 125], ["bat", 150, 40], ["moonhound", 160], ["villager", 200], ["ghost", 226, 24], ["moonhound", 255], ["villager", 295], ["zombie", 325], ["moonhound", 345], ["villager", 365], ["ghost", 380, 24], ["moonhound", 405], ["villager", 430], ["zombie", 450], ["moonhound", 480], ["villager", 500]],
    chandeliers: [150, 360],
    horde: ["villager", "moonhound", "zombie"],
    hordeMs: 2300,
    moon: 40000,
  }),
  // The gallows platform and its beams: hanged men over the platform and the
  // cobbles, everything at once.
  room("square", "Town Square", "The gallows creak without wind", {
    length: 540,
    ground: [[0, 110, 6], [118, 190, 6], [190, 196, 8.5], [196, 202, 11], [202, 270, 11], [278, 350, 6], [350, 356, 8.5], [356, 362, 11], [362, 430, 11], [438, 540, 6]],
    shelves: [[30, 46, 11], [60, 76, 11], [66, 82, 17], [124, 152, 11], [218, 234, 17], [214, 238, 24], [300, 316, 15], [308, 324, 21], [380, 396, 17], [386, 402, 23], [460, 476, 11], [470, 486, 17]],
    key: [226, 24],
    door: 530,
    candy: [[20, 8.5, 5], [31, 14, 3], [61, 14, 3], [67, 20, 3], [125, 14, 6], [205, 13.5, 3], [219, 20, 3], [215, 27, 3], [240, 13.5, 5], [301, 18, 3], [309, 24, 3], [330, 8.5, 5], [365, 13.5, 5], [381, 20, 3], [387, 26, 3], [461, 14, 3], [471, 20, 3], [500, 8.5, 5]],
    items: [["wings", 24, 6], ["bane", 90, 6], ["spread", 70, 11], ["rapid", 132, 11], ["garlic", 306, 15], ["life", 392, 17], ["hourglass", 500, 6], ["trap", 152, 6], ["dyn", 284, 6]],
    sky: [["crystal", 220, 44], ["crystal", 226, 46], ["crystal", 232, 44]],
    spawns: [["zombie", 50], ["villager", 85], ["hanged", 130, 24], ["hanged", 146, 24], ["moonhound", 170], ["shutter", 182, 13], ["villager", 208], ["crow", 242, 22], ["hanged", 250, 24], ["moonhound", 262], ["villager", 296], ["hanged", 330, 19], ["bat", 336, 40], ["shutter", 342, 13], ["villager", 392], ["hanged", 408, 24], ["moonhound", 420], ["hanged", 445, 19], ["villager", 462], ["moonhound", 490]],
    // Half the zombies of an even mix, the others as often as ever.
    horde: ["villager", "villager", "moonhound", "moonhound", "zombie", "crow", "crow"],
    hordeMs: 2285,
    moon: 35000,
  }),
  // The Village's boss: the Beast, on the green. The arena's two ends are the
  // walls it clings to (not terrain: nothing to jump); boards at 12 and 17.5
  // either side, the high ones above the floor-bound Beast's reach (10.5 tall).
  room("green", "The Village Green", "You met it at the inn", {
    length: 200,
    ground: [[0, 200, 6]],
    shelves: [[116, 130, 12], [124, 138, 17.5], [170, 184, 12], [162, 176, 17.5]],
    key: null,
    door: 194,
    candy: [[18, 8.5, 5], [70, 8.5, 5]],
    items: [["bane", 60, 6], ["trap", 30, 6]],
    spawns: [["zombie", 40], ["villager", 66]],
    boss: "beast",
  }),
  // The Deep Seam Mine, past the village: always dark. Timber landings to hop
  // along and cage lifts that ride their tracks (a row: ["cage", x, lowest
  // bottom, highest bottom]; the cage's board is 1.2 above its bottom, level
  // with a landing's top at the high end); knocker imps, dead miners and bats,
  // and the odd rock from the ceiling. The first room is an easy one.
  room("shaft", "Mine Shaft", "The cage only goes down", {
    length: 500,
    ground: [[0, 110, 6], [110, 116, 8.5], [116, 190, 11], [190, 196, 8.5], [196, 300, 6], [308, 376, 6], [376, 382, 8.5], [382, 388, 11], [388, 500, 11]],
    shelves: [[30, 46, 11], [56, 72, 15], [78, 98, 19], [124, 142, 17], [150, 170, 17], [254, 270, 15], [248, 274, 24], [288, 300, 15], [322, 334, 15], [340, 360, 19], [400, 416, 17], [424, 440, 22]],
    key: [262, 24],
    door: 490,
    candy: [[20, 8.5, 5], [31, 14, 3], [57, 18, 3], [79, 22, 3], [118, 13.5, 5], [125, 20, 3], [151, 20, 3], [200, 8.5, 5], [255, 18, 3], [251, 27, 3], [312, 8.5, 4], [323, 18, 3], [341, 22, 3], [401, 20, 3], [425, 25, 3], [450, 13.5, 5]],
    items: [["wings", 24, 6], ["hat", 64, 15], ["spread", 135, 17], ["dyn", 156, 17], ["garlic", 292, 15], ["rapid", 410, 17], ["rocket", 208, 6]],
    sky: [["crystal", 256, 44], ["crystal", 262, 46], ["crystal", 268, 44]],
    spawns: [["zombie", 55], ["cage", 100, 6.2, 17.8], ["imp", 140], ["miner", 168], ["bat", 215, 40], ["cage", 244, 6.2, 22.8], ["imp", 280], ["crawl", 292], ["cage", 336, 6.2, 17.8], ["miner", 360], ["bat", 368, 40], ["imp", 420], ["zombie", 450], ["miner", 475]],
    horde: ["zombie", "imp"],
    hordeMs: 3200,
    rocks: 30000,
    dark: true,
  }),
  // A low ceiling and knee-deep water along the floor (slow, and every step
  // splashes): blind crawlers that hunt by sound, canary ghosts, dead miners.
  room("tunnels", "Flooded Tunnels", "The pumps stopped in 1891", {
    length: 520,
    ground: [[0, 100, 6], [100, 106, 8.5], [106, 176, 11], [176, 182, 8.5], [182, 260, 6], [268, 330, 6], [330, 336, 8.5], [336, 400, 11], [408, 520, 6]],
    shelves: [[30, 46, 11], [56, 72, 15], [112, 128, 17], [136, 152, 17], [196, 212, 15], [222, 238, 19], [304, 320, 15], [300, 324, 24], [350, 366, 17], [372, 388, 22], [420, 436, 12], [440, 456, 17]],
    key: [312, 24],
    door: 510,
    candy: [[20, 8.5, 5], [31, 14, 3], [57, 18, 3], [113, 20, 3], [137, 20, 3], [110, 13.5, 4], [188, 8.5, 5], [197, 18, 3], [223, 22, 3], [274, 8.5, 5], [301, 27, 3], [337, 13.5, 4], [351, 20, 3], [373, 25, 3], [421, 15, 3], [441, 20, 3], [470, 8.5, 5]],
    items: [["wings", 24, 6], ["hat", 64, 15], ["dyn", 120, 17], ["spread", 204, 15], ["garlic", 228, 19], ["rapid", 358, 17], ["hourglass", 430, 12], ["rocket", 194, 6]],
    sky: [["crystal", 306, 44], ["crystal", 312, 46], ["crystal", 318, 44]],
    spawns: [["zombie", 50], ["blind", 80], ["miner", 125], ["canary", 150, 19.5], ["blind", 196], ["canary", 215, 14.5], ["miner", 235], ["bat", 250, 40], ["blind", 285], ["canary", 298, 14.5], ["miner", 345], ["blind", 380], ["canary", 392, 19.5], ["zombie", 430], ["blind", 455], ["miner", 485]],
    horde: ["zombie", "blind", "miner"],
    hordeMs: 2600,
    rocks: 12000,
    water: [[16, 92], [190, 256], [272, 326], [414, 500]],
    dark: true,
  }),
  // Rubble heaps as steps and a cracked ceiling: the most rockfall, and
  // everything at once.
  room("collapse", "The Collapse", "They are still knocking", {
    length: 540,
    ground: [[0, 90, 6], [90, 96, 8.5], [96, 102, 11], [102, 130, 13.5], [130, 136, 11], [136, 142, 8.5], [142, 230, 6], [238, 300, 6], [300, 306, 8.5], [306, 380, 11], [380, 386, 8.5], [386, 392, 6], [392, 470, 6], [478, 540, 6]],
    shelves: [[30, 46, 11], [52, 68, 16], [104, 120, 19], [150, 166, 15], [170, 186, 20], [256, 272, 15], [252, 276, 24], [320, 336, 17], [344, 360, 22], [400, 416, 12], [420, 436, 18], [490, 506, 13]],
    key: [264, 24],
    door: 530,
    candy: [[20, 8.5, 5], [31, 14, 3], [53, 19, 3], [105, 22, 3], [108, 16, 4], [151, 18, 3], [171, 23, 3], [200, 8.5, 5], [257, 18, 3], [253, 27, 3], [321, 20, 3], [345, 25, 3], [312, 13.5, 4], [401, 15, 3], [421, 21, 3], [491, 16, 3], [440, 8.5, 5]],
    items: [["wings", 24, 6], ["hat", 60, 6], ["dyn", 108, 19], ["garlic", 158, 15], ["hat", 325, 17], ["dyn", 348, 22], ["rapid", 425, 18], ["stake", 150, 6]],
    sky: [["crystal", 258, 44], ["crystal", 264, 46], ["crystal", 270, 44]],
    spawns: [["zombie", 50], ["imp", 75], ["miner", 112], ["canary", 150, 14.5], ["blind", 160], ["imp", 190], ["bat", 205, 40], ["miner", 215], ["canary", 245, 14.5], ["blind", 262], ["imp", 285], ["miner", 320], ["canary", 340, 19.5], ["blind", 355], ["imp", 372], ["zombie", 395], ["miner", 420], ["canary", 440, 14.5], ["blind", 450], ["imp", 490], ["miner", 510]],
    horde: ["zombie", "imp", "miner", "blind"],
    hordeMs: 2000,
    rocks: 7000,
    dark: true,
  }),
  // The Runaway Cart, a BONUS ROUND (see ghoul-cart.js and ghoul-bonus.js): a ride, not a
  // walk. Planny rides a mine cart down a roller coaster of track over the chasm,
  // about 65 seconds of it at 40 a second: a gentle start, a camelback, a ramp
  // that hops a gap, crates, the fork (jump for the upper line, roll on for the
  // lower, which dead-ends at a ramp), rubble, crates and ledge imps along the
  // upper, the big jump, then a gauntlet of beams, rubble and a wall of crates, a
  // staircase of ever bigger gaps, a second fork whose upper bridge is the wrong
  // branch (a lure of souls and a wall of crates), a chase (the boulder surges: lean
  // forward to stay ahead), a last ramp and the buffer stop. Five hearts of its own.
  room("cart", "The Runaway Cart", "The brakes went in 1891", {
    length: 2830,
    ground: [[0, 30, 18], [2794, 2830, 8]],
    start: 8,
    key: null,
    door: 2820,
    bonus: true,
    candy: [
      [10, 21.2, 1], [24, 21.2, 1], [38, 21.2, 1], [52, 20.5, 1], [66, 19.8, 1], [80, 23.1, 1],
      [94, 22.5, 1], [108, 16.9, 1], [122, 16.1, 1], [136, 15.4, 1], [168, 13.8, 1], [182, 12.8, 1],
      [196, 12.2, 1], [210, 12, 1], [224, 12.8, 1], [238, 16.1, 1], [252, 20.5, 1], [266, 24.1, 1],
      [280, 26.3, 1], [294, 26.7, 1], [308, 24.8, 1], [322, 20.1, 1], [336, 21.7, 1], [350, 17.1, 1],
      [364, 13.2, 1], [378, 13.6, 1], [418, 17.6, 1], [432, 21, 1], [446, 21.8, 1], [460, 16.2, 1],
      [474, 15.9, 1], [523, 14.8, 1], [537, 14.8, 1], [551, 14.8, 1], [565, 14.8, 1], [593, 14.8, 1],
      [621, 14.8, 1], [649, 14.8, 1], [691, 14.8, 1], [705, 12.9, 1], [719, 9.6, 1], [733, 9.5, 1],
      [747, 9.5, 1], [761, 12.7, 1], [775, 14.8, 1], [789, 9.4, 1], [803, 12.3, 1], [817, 14.8, 1],
      [831, 9.3, 1], [845, 9.2, 1], [859, 9.2, 1], [723, 20.6, 1], [737, 20.6, 1], [751, 20.6, 1],
      [765, 21.1, 1], [779, 21.7, 1], [793, 22.2, 1], [807, 22.8, 1], [821, 23.4, 1], [835, 23.9, 1],
      [849, 24.2, 1], [863, 24.6, 1], [877, 24.6, 1], [891, 24.6, 1], [905, 24.3, 1], [919, 23.4, 1],
      [933, 22.3, 1], [947, 20.6, 1], [961, 18.8, 1], [975, 17.6, 1], [989, 16.5, 1], [1003, 15.5, 1],
      [1017, 15.1, 1], [1045, 16.2, 1], [1059, 16.6, 1], [1073, 20.4, 1], [1087, 14.6, 1], [1101, 16.2, 1],
      [1129, 14.7, 1], [1143, 15.2, 1], [1157, 16.9, 1], [1171, 20.2, 1], [1185, 23.4, 1], [1199, 26.3, 1],
      [1213, 29.1, 1], [1227, 30.8, 1], [1241, 30.7, 1], [1298, 18, 1], [1312, 16.5, 1], [1326, 15.7, 1],
      [1340, 14.8, 1], [1354, 14.8, 1], [1396, 16, 1], [1424, 14.8, 1], [1466, 14.8, 1], [1480, 19.5, 1],
      [1508, 14.8, 1], [1522, 14.8, 1], [1550, 14.8, 1], [1564, 20.6, 1], [1578, 16.8, 1], [1592, 19.5, 1],
      [1606, 19.1, 1], [1620, 14.8, 1], [1648, 14.8, 1], [1662, 14.8, 1], [1676, 14.8, 1], [1690, 14.8, 1],
      [1726, 14.8, 1], [1740, 14.8, 1], [1792, 16.6, 1], [1806, 16.6, 1], [1860, 18.2, 1], [1888, 16.6, 1],
      [1933, 10.6, 1], [1947, 10.6, 1], [1961, 10.6, 1], [1975, 10.6, 1], [1989, 10.6, 1], [2003, 10.6, 1],
      [2017, 10.6, 1], [2031, 10.6, 1], [2045, 10.6, 1], [2059, 10.6, 1], [2073, 10.6, 1], [2087, 10.6, 1],
      [2101, 10.6, 1], [2129, 10.6, 1], [2143, 10.6, 1], [2157, 10.6, 1], [2171, 10.6, 1], [2185, 10.6, 1],
      [2199, 10.6, 1], [2213, 11.5, 1], [2227, 15.9, 1], [2241, 18.6, 1], [2255, 14.3, 1], [2269, 15.5, 1],
      [2283, 16.9, 1], [2004, 20.6, 1], [2018, 22.2, 1], [2046, 23.8, 1], [2060, 24.3, 1], [2074, 27.5, 1],
      [2088, 22.5, 1], [2130, 22.6, 1], [2332, 22, 1], [2346, 21.1, 1], [2360, 20.2, 1], [2374, 21.6, 1],
      [2388, 24.1, 1], [2402, 17.5, 1], [2416, 16.8, 1], [2430, 16.1, 1], [2458, 15.5, 1], [2472, 14.6, 1],
      [2486, 14.6, 1], [2500, 19.8, 1], [2514, 18.1, 1], [2528, 14.6, 1], [2542, 14.6, 1], [2556, 18.1, 1],
      [2570, 19.8, 1], [2584, 14.6, 1], [2598, 14.6, 1], [2612, 14.6, 1], [2626, 16.3, 1], [2678, 16, 1],
      [2692, 15.1, 1], [2706, 17.8, 1], [2720, 18.8, 1], [2734, 12.9, 1], [2748, 12.2, 1], [2762, 11.6, 1],
      [2776, 11.4, 1], [2790, 11.3, 1], [2000, 20.6, 1], [2007, 20.6, 1], [2014, 20.6, 1], [2021, 25.6, 1],
      [2042, 25.7, 1], [2049, 21, 1], [2056, 21.2, 1], [2063, 26.5, 1], [2077, 27.1, 1], [2084, 22.4, 1],
      [2091, 22.6, 1], [2098, 22.6, 1], [2105, 22.6, 1], [2112, 22.6, 1], [2119, 22.6, 1], [2126, 22.6, 1],
      [2133, 22.6, 1], [2140, 22.6, 1],
    ],
    items: [["spread", 187.5, 10], ["hat", 812.5, 20.5], ["rapid", 1052, 12], ["garlic", 1352, 13.4], ["rapid", 1905, 15.4], ["spread", 2250, 11]],
    spawns: [
      ["canary", 175, 22], ["bat", 196, 32], ["bat", 335, 26], ["bat", 410, 24],
      ["ledgeimp", 556, 21.7], ["bat", 602, 20], ["bat", 652, 22], ["canary", 750, 30],
      ["bat", 780, 32], ["ledgeimp", 819, 30.2], ["bat", 900, 30], ["canary", 1019, 24],
      ["ledgeimp", 1060, 21.5], ["ledgeimp", 1169, 26.7], ["bat", 1170, 32], ["bat", 1330, 26],
      ["canary", 1420, 22], ["bat", 1480, 24], ["ledgeimp", 1545, 21.7], ["bat", 1620, 24],
      ["bat", 1790, 24], ["ledgeimp", 1800, 23.5], ["canary", 1850, 24], ["bat", 1880, 26],
      ["ledgeimp", 2000, 27.5], ["bat", 2070, 30], ["canary", 2120, 14], ["ledgeimp", 2180, 17.5],
      ["bat", 2260, 24], ["bat", 2360, 28], ["canary", 2380, 22], ["ledgeimp", 2440, 22.5],
      ["bat", 2470, 24], ["bat", 2700, 24],
    ],
    horde: ["bat"],
    hordeMs: 7000,
    dark: true,
    ride: {
      time: 115000,
      stop: 2800,
      track: [
        [[0, 18.6], [37.5, 18.6], [70, 17], [100, 14.8], [130, 13], [147.5, 12.4]],
        [[157.5, 12], [177.5, 10.4], [200, 9.4], [220, 9.4], [237.5, 13.5], [255, 19], [272.5, 23.2], [290, 24.4], [305, 23], [327.5, 15.5], [345, 11.5], [362.5, 10.6], [375, 10.6], [387.5, 12.4], [397.5, 15.6]],
        [[407.5, 15.2], [432.5, 14.6], [465, 13.4], [490, 13]],
        [[512.5, 12.2], [700, 12.2], [712.5, 7], [862.5, 6.6], [872.5, 8.4], [880, 11]],
        [[712.5, 18], [750, 18], [787.5, 19.4], [825, 21], [862.5, 22], [900, 22], [930, 20], [962.5, 16], [1000, 13], [1032.5, 12], [1125, 12], [1150, 12.8], [1187.5, 21.5], [1220, 28], [1237.5, 28.5], [1262.5, 25.5]],
        [[1287.5, 16.5], [1310, 14], [1340, 12.2], [1700, 12.2]],
        [[1716, 12.2], [1762, 12.2]],
        [[1782, 14], [1828, 14]],
        [[1850, 14], [1898, 14]],
        [[1923, 8], [2200, 8], [2260, 12], [2300, 16]],
        [[1994, 18], [2040, 18], [2090, 20], [2150, 20]],
        [[2322, 20], [2400, 15], [2460, 12], [2620, 12], [2640, 17.5]],
        [[2668, 14], [2700, 12], [2760, 9], [2800, 8.6]],
      ],
      beams: [[577.5, 581.5, 15.4], [607.5, 611.5, 15.4], [637.5, 641.5, 15.4], [667.5, 671.5, 15.4], [1372, 1376, 15.4], [1444, 1448, 15.4], [1530, 1534, 15.4], [1636, 1640, 15.4], [2108, 2112, 23.2]],
      rubble: [[87.5, 0], [340, 1], [770, 3], [1032.5, 4], [1112.5, 4], [1408, 5], [1566, 5], [1598, 5], [1872, 8], [2070, 10], [2236, 9], [2385, 11], [2505, 11], [2565, 11], [2715, 12]],
      crates: [[440, 2], [812.5, 3], [1070, 4], [1486, 5], [1489, 5], [1492, 5], [2030, 10], [2033, 10], [2036, 10], [2445, 11]],
      checks: [281, 562, 844, 1131, 1330, 1660, 1950, 2290, 2570],
      surge: [[2330, 2570, 1.55]],
    },
  }),
  // The Mine's boss: the Tommyknocker, in the seam. A gallery of boards each
  // side (12 and 17.5; he stands 15 tall, so a bolt from 17.5 still meets his
  // head), no rockfall of its own: his knocks bring it down.
  room("seam", "The Mother Seam", "Follow the knocking, not the light", {
    length: 200,
    ground: [[0, 200, 6]],
    shelves: [[110, 124, 12], [118, 132, 17.5], [172, 186, 12], [164, 178, 17.5]],
    key: null,
    door: 194,
    candy: [[18, 8.5, 5], [70, 8.5, 5]],
    items: [["hat", 60, 6], ["dyn", 80, 6]],
    spawns: [["zombie", 40], ["imp", 66]],
    boss: "tommy",
    dark: true,
  }),
  // The Midnight Carnival, past the mine: booths and counters to hop along,
  // grinners honking acid balloons, strongmen and circus hounds. The first room
  // is an easy one: one strongman and one hound, late.
  room("midway", "Midway", "Every game is rigged in its favor", {
    length: 500,
    ground: [[0, 100, 6], [100, 106, 8.5], [106, 170, 11], [170, 176, 8.5], [176, 280, 6], [288, 350, 6], [350, 356, 8.5], [356, 362, 11], [362, 500, 11]],
    shelves: [[24, 40, 11], [48, 64, 15], [112, 130, 17], [136, 154, 17], [188, 204, 11], [208, 224, 15], [236, 260, 24], [242, 254, 15], [296, 312, 11], [320, 334, 15], [372, 388, 17], [392, 408, 22], [430, 446, 16]],
    key: [248, 24],
    door: 490,
    candy: [[18, 8.5, 5], [25, 14, 3], [49, 18, 3], [113, 20, 3], [137, 20, 3], [108, 13.5, 4], [190, 14, 3], [209, 18, 3], [243, 18, 3], [240, 27, 3], [297, 14, 3], [321, 18, 3], [373, 20, 3], [393, 25, 3], [431, 19, 3], [460, 13.5, 5]],
    items: [["wings", 20, 6], ["floss", 66, 6], ["pie", 92, 6], ["spread", 120, 17], ["garlic", 214, 15], ["rapid", 380, 17], ["rocket", 184, 6]],
    sky: [["crystal", 242, 44], ["crystal", 248, 46], ["crystal", 254, 44]],
    spawns: [["zombie", 46], ["grinner", 84], ["zombie", 126], ["grinner", 160], ["crawl", 196], ["bat", 214, 40], ["zombie", 268], ["grinner", 304], ["strongman", 336], ["zombie", 376], ["bat", 396, 40], ["circushound", 412], ["zombie", 450], ["grinner", 470]],
    horde: ["zombie", "grinner"],
    hordeMs: 3200,
  }),
  // The Hall of Mirrors, indoors: wide flat floors, so a reflection has room to
  // copy you. Mirror You steps out of a panel as you come near.
  room("mirrors", "Hall of Mirrors", "Only one of you is real", {
    length: 520,
    ground: [[0, 150, 6], [150, 156, 8.5], [156, 162, 11], [162, 236, 11], [236, 242, 8.5], [242, 248, 6], [248, 360, 6], [368, 520, 6]],
    shelves: [[26, 42, 11], [52, 68, 15], [94, 110, 11], [116, 132, 15], [168, 186, 16], [194, 212, 20], [250, 264, 11], [298, 322, 24], [304, 316, 15], [330, 346, 15], [380, 396, 12], [404, 420, 17], [446, 462, 13]],
    key: [310, 24],
    door: 510,
    candy: [[18, 8.5, 5], [27, 14, 3], [53, 18, 3], [95, 14, 3], [117, 18, 3], [140, 8.5, 4], [169, 19, 3], [195, 23, 3], [215, 13.5, 4], [251, 14, 3], [299, 27, 3], [305, 18, 3], [331, 18, 3], [381, 15, 3], [405, 20, 3], [447, 16, 3], [480, 8.5, 5]],
    items: [["wings", 20, 6], ["floss", 58, 15], ["pie", 100, 11], ["spread", 122, 15], ["garlic", 176, 16], ["rapid", 256, 11], ["hourglass", 336, 15], ["rocket", 270, 6]],
    sky: [["crystal", 304, 44], ["crystal", 310, 46], ["crystal", 316, 44]],
    spawns: [["zombie", 44], ["mirror", 88], ["grinner", 138], ["mirror", 176], ["ghost", 196, 18], ["strongman", 224], ["circushound", 262], ["mirror", 284], ["grinner", 346], ["mirror", 392], ["hound", 410], ["zombie", 436], ["mirror", 466], ["circushound", 490]],
    horde: ["zombie", "grinner", "circushound"],
    hordeMs: 2600,
  }),
  // The Funhouse: conveyor floors that drag you (`belts`, [x0, x1, speed]),
  // marionettes in the rafters, everything else on the loose.
  room("funhouse", "Funhouse", "The laughter is coming from inside the walls", {
    length: 540,
    ground: [[0, 120, 6], [120, 126, 8.5], [126, 200, 11], [200, 206, 8.5], [206, 330, 6], [338, 420, 6], [420, 426, 8.5], [426, 432, 11], [432, 540, 11]],
    shelves: [[30, 46, 11], [58, 74, 15], [130, 148, 17], [154, 172, 17], [228, 252, 24], [234, 246, 15], [270, 286, 15], [290, 304, 19], [352, 368, 12], [372, 388, 17], [440, 456, 16], [470, 486, 21], [498, 514, 16]],
    key: [240, 24],
    door: 530,
    candy: [[18, 8.5, 5], [31, 14, 3], [59, 18, 3], [131, 20, 3], [155, 20, 3], [120, 13.5, 4], [210, 8.5, 5], [235, 18, 3], [229, 27, 3], [271, 18, 3], [291, 22, 3], [353, 15, 3], [373, 20, 3], [442, 19, 3], [471, 24, 3], [499, 19, 3]],
    items: [["wings", 20, 6], ["floss", 34, 6], ["pie", 52, 6], ["spread", 138, 17], ["garlic", 278, 15], ["rapid", 380, 17], ["hourglass", 360, 12], ["rocket", 346, 6]],
    sky: [["crystal", 234, 44], ["crystal", 240, 46], ["crystal", 246, 44]],
    spawns: [["zombie", 44], ["marionette", 84, 10.8], ["mirror", 100], ["grinner", 136], ["marionette", 151, 15.8], ["circushound", 188], ["marionette", 220, 10.8], ["strongman", 262], ["mirror", 290], ["marionette", 310, 10.8], ["grinner", 352], ["circushound", 380], ["marionette", 400, 10.8], ["zombie", 440], ["mirror", 458], ["marionette", 462, 15.8], ["strongman", 500], ["grinner", 520]],
    horde: ["zombie", "grinner", "circushound"],
    hordeMs: 2000,
    belts: [[18, 104, -12], [216, 320, 14], [346, 412, -14], [440, 520, 12]],
  }),
  // The dark ride, the Carnival's BONUS ROUND (see ghoul-ride.js, ghoul-ride-scenes.js and
  // ghoul-bonus.js): a side-view shooting gallery on rails, 12 rooms and about 92 seconds
  // at a clean run. Planny sits in the car; the arrows or the mouse aim a reticle, Space or a
  // click fires, the reticle pulled into the car ducks. Five hearts of its own. The floor
  // is a stand-in (the ride never walks him): the room only needs a start, a door and a clock.
  room("darkride", "The Dark Ride", "Keep your arms inside the car", {
    length: 100,
    ground: [[0, 100, 17]],
    start: 24,
    key: null,
    door: 90,
    bonus: true,
    dark: false,
    ride: {
      gallery: true,
      time: 100000,
      ready: 5200,
      how: "Mouse: move to aim, click or hold to fire",
    },
  }),
  // The Big Top, the Carnival's boss room: a ladder of trapeze boards up to the
  // middle and down again (12, 16.5, 22; the puppet's three strings are cut
  // from them or by jumping), cages in the wings for the hounds.
  room("bigtop", "The Big Top", "Shoot the strings, not the puppet", {
    length: 200,
    ground: [[0, 200, 6]],
    shelves: [[112, 124, 12], [128, 140, 16.5], [144, 156, 22], [160, 172, 16.5], [176, 188, 12]],
    key: null,
    door: 194,
    candy: [[18, 8.5, 5], [70, 8.5, 5]],
    items: [["floss", 56, 6], ["pie", 84, 6]],
    spawns: [["zombie", 40], ["grinner", 66]],
    boss: "ringmaster",
  }),
  // The Frozen Lake, past the carnival: a frozen lake under a night of snow. Ice Fishing
  // Huts, an open lake of slippery ice with the huts as boards to hop along, three thin
  // tiles on it and holes in the ice (the pits); frozen ghouls, hands under the ice, one
  // shade and one ice wraith. The first room is the easy one.
  room("huts", "Ice Fishing Huts", "The lines are all pulled taut", {
    length: 480,
    ground: [[0, 96, 6], [96, 102, 8.5], [102, 150, 11], [150, 156, 8.5], [156, 238, 6], [246, 320, 6], [320, 326, 8.5], [326, 372, 11], [380, 420, 11], [420, 426, 8.5], [426, 480, 6]],
    ice: [[16, 96], [160, 236], [250, 318], [430, 476]],
    thin: [[190, 196], [286, 292], [452, 458]],
    shelves: [[24, 40, 11], [48, 64, 15], [108, 126, 17], [132, 146, 17], [164, 178, 11], [182, 196, 15], [204, 228, 24], [210, 222, 15], [262, 278, 11], [282, 298, 15], [302, 316, 11], [336, 352, 17], [356, 370, 17], [384, 400, 17], [404, 418, 22], [434, 450, 11], [456, 472, 15]],
    key: [216, 24],
    door: 470,
    candy: [[18, 8.5, 5], [25, 14, 3], [49, 18, 3], [109, 20, 3], [133, 20, 3], [104, 13.5, 4], [165, 14, 3], [183, 18, 3], [205, 27, 3], [263, 14, 3], [283, 18, 3], [337, 20, 3], [357, 20, 3], [385, 20, 3], [405, 25, 3], [435, 14, 3], [457, 18, 3]],
    items: [["wings", 20, 6], ["cocoa", 56, 6], ["flare", 78, 6], ["spread", 120, 17], ["garlic", 188, 15], ["rocket", 252, 6], ["rapid", 340, 17], ["hourglass", 410, 22]],
    sky: [["crystal", 210, 44], ["crystal", 216, 46], ["crystal", 222, 44]],
    spawns: [["zombie", 46], ["hand", 112], ["bat", 150, 40], ["frozen", 176], ["shade", 232], ["zombie", 262], ["icewraith", 330, 30], ["skel", 362, 17], ["frozen", 408], ["frozen", 462]],
    horde: ["zombie"],
    hordeMs: 4600,
  }),
  // Snowbound Lodge, indoors: furniture to hop along, a hall frozen over where the roof
  // fell in, shades you only see by their footprints.
  room("lodge", "Snowbound Lodge", "The fire went out a long time ago", {
    length: 520,
    ground: [[0, 120, 6], [120, 126, 8.5], [126, 200, 11], [200, 206, 8.5], [206, 330, 6], [338, 420, 6], [420, 426, 8.5], [426, 432, 11], [432, 520, 11]],
    ice: [[8, 100], [216, 326], [350, 414]],
    thin: [[250, 257], [384, 391], [470, 477]],
    shelves: [[30, 46, 11], [56, 72, 15], [130, 148, 17], [152, 170, 17], [226, 242, 12], [262, 286, 24], [268, 280, 15], [290, 306, 15], [352, 368, 12], [372, 388, 17], [440, 456, 16], [462, 478, 21], [490, 506, 16]],
    key: [274, 24],
    door: 510,
    candy: [[18, 8.5, 5], [31, 14, 3], [57, 18, 3], [131, 20, 3], [153, 20, 3], [120, 13.5, 4], [227, 15, 3], [263, 27, 3], [269, 18, 3], [291, 18, 3], [353, 15, 3], [373, 20, 3], [441, 19, 3], [463, 24, 3], [491, 19, 3]],
    items: [["wings", 20, 6], ["cocoa", 40, 6], ["flare", 60, 6], ["rapid", 138, 17], ["garlic", 232, 12], ["stake", 346, 6], ["hourglass", 378, 17], ["spread", 446, 16]],
    sky: [["crystal", 268, 44], ["crystal", 274, 46], ["crystal", 280, 44]],
    spawns: [["zombie", 44], ["shade", 88], ["frozen", 110], ["hand", 136], ["bat", 160, 40], ["shade", 190], ["frozen", 224], ["skel", 234, 12], ["hand", 268], ["shade", 300], ["icewraith", 322, 30], ["frozen", 354], ["skel", 380, 17], ["bat", 400, 40], ["shade", 414], ["frozen", 436], ["hand", 466], ["icewraith", 490, 30], ["zombie", 506]],
    horde: ["zombie", "frozen"],
    hordeMs: 2600,
  }),
  // The Black Ice: a long stretch of ice with thin tiles all along it, and hands
  // under it everywhere you look.
  room("blackice", "The Black Ice", "Faces under the surface follow you", {
    length: 580,
    ground: [[0, 150, 6], [150, 156, 8.5], [156, 162, 11], [162, 260, 11], [260, 266, 8.5], [266, 380, 6], [388, 470, 6], [470, 476, 8.5], [476, 482, 11], [482, 580, 11]],
    ice: [[10, 146], [166, 256], [270, 376], [392, 466], [486, 576]],
    thin: [[60, 67], [100, 107], [190, 197], [226, 233], [296, 303], [330, 337], [352, 358], [412, 419], [440, 447], [520, 527], [556, 563]],
    shelves: [[26, 42, 11], [50, 66, 15], [110, 128, 12], [132, 150, 16], [170, 186, 17], [208, 244, 24], [220, 232, 15], [270, 286, 11], [290, 306, 15], [318, 334, 12], [340, 356, 17], [400, 416, 12], [420, 436, 17], [444, 460, 12], [490, 506, 17], [510, 526, 22], [538, 552, 16], [558, 574, 21]],
    key: [226, 24],
    door: 570,
    candy: [[18, 8.5, 5], [27, 14, 3], [51, 18, 3], [111, 15, 3], [133, 19, 3], [171, 20, 3], [209, 27, 3], [221, 18, 3], [271, 14, 3], [291, 18, 3], [319, 15, 3], [341, 20, 3], [401, 15, 3], [421, 20, 3], [445, 15, 3], [491, 20, 3], [511, 25, 3], [539, 19, 3], [559, 24, 3]],
    items: [["wings", 20, 6], ["cocoa", 40, 6], ["flare", 70, 6], ["rocket", 116, 12], ["spread", 140, 16], ["garlic", 178, 17], ["cocoa", 276, 11], ["rapid", 296, 15], ["hourglass", 346, 17]],
    sky: [["crystal", 220, 44], ["crystal", 226, 46], ["crystal", 232, 44]],
    spawns: [["zombie", 44], ["frozen", 70], ["hand", 96], ["frozen", 128], ["bat", 150, 40], ["hand", 180], ["shade", 200], ["frozen", 224], ["icewraith", 250, 30], ["hand", 274], ["frozen", 300], ["shade", 322], ["hand", 344], ["frozen", 362], ["icewraith", 378, 30], ["hand", 404], ["frozen", 430], ["shade", 452], ["hand", 498], ["skel", 518, 22], ["frozen", 536], ["hand", 548], ["icewraith", 552, 30], ["zombie", 566]],
    horde: ["frozen", "zombie", "icewraith"],
    hordeMs: 2000,
  }),
  // The Coffin Sled, the Frozen Lake's BONUS ROUND (see ghoul-sled.js and ghoul-bonus.js): a ride, not a
  // walk. Planny rides a coffin lid down a long frozen cemetery hill, about 67 seconds of it at 45 a
  // second: rolling descents (steep, long) and short climbs, seven cracks in the ice to jump, 7 headstones and
  // 5 snowdrifts to jump, 8 low branches and tombstone arches to duck, 6 ghoul hands that reach from the snow, icicles and
  // ghouls beside the track to shoot, seven checkpoints, and a gentle jump off the end of the hill (the
  // lip) onto the snowbank where the door is. Five hearts of its own. The numbers are generated: the
  // track is 16 descents and 15 climbs (the crest of each falls a little further down the hill).
  room("sled", "Coffin Sled", "Hold on. The hill is longer than it looks", {
    length: 2990,
    ground: [[0, 30, 36], [2912, 2990, 10]],
    start: 8,
    key: null,
    door: 2980,
    bonus: true,
    dark: false,
    candy: [
      [30, 39.1, 1], [44, 38.6, 1], [58, 38.2, 1], [72, 37.6, 1], [86, 36.1, 1], [100, 34.6, 1], [114, 33.2, 1],
      [128, 31.7, 1], [142, 30.2, 1], [156, 28.7, 1], [170, 27.2, 1], [184, 25.8, 1], [198, 24.3, 1], [212, 28.4, 1],
      [226, 32.6, 1], [240, 36.7, 1], [254, 37.5, 1], [268, 35.6, 1], [296, 32, 1], [310, 30.2, 1], [338, 26.6, 1],
      [352, 24.8, 1], [366, 28.1, 1], [380, 32.4, 1], [394, 36.6, 1], [408, 36.7, 1], [422, 35.1, 1], [441, 35.4, 1],
      [445, 37.9, 1], [449, 35.4, 1], [464, 30.3, 1], [478, 28.7, 1], [492, 27.1, 1], [506, 25.5, 1], [534, 22.3, 1],
      [548, 24.7, 1], [562, 28.8, 1], [576, 32.9, 1], [590, 36.9, 1], [604, 35.2, 1], [632, 31.6, 1], [646, 29.8, 1],
      [660, 28, 1], [688, 24.5, 1], [702, 22.7, 1], [716, 24.3, 1], [730, 28.5, 1], [744, 32.6, 1], [758, 36, 1],
      [772, 34.4, 1], [800, 31.1, 1], [814, 29.5, 1], [832, 30.1, 1], [836, 32.6, 1], [840, 30.1, 1], [856, 24.7, 1],
      [870, 23.1, 1], [884, 21.5, 1], [898, 19.9, 1], [912, 21.5, 1], [926, 25.5, 1], [940, 29.5, 1], [954, 33.6, 1],
      [968, 34.3, 1], [982, 32.5, 1], [1010, 28.9, 1], [1024, 27.1, 1], [1038, 25.4, 1], [1052, 23.6, 1], [1066, 21.8, 1],
      [1080, 24.3, 1], [1094, 28.5, 1], [1108, 32.8, 1], [1122, 33.6, 1], [1136, 31.9, 1], [1150, 30.2, 1], [1164, 28.4, 1],
      [1178, 26.7, 1], [1192, 25, 1], [1206, 23.3, 1], [1218, 24.6, 1], [1222, 27.1, 1], [1226, 24.6, 1], [1234, 19.8, 1],
      [1248, 19.8, 1], [1262, 24.1, 1], [1276, 28.3, 1], [1290, 32.6, 1], [1304, 32.6, 1], [1332, 29.5, 1], [1346, 27.9, 1],
      [1360, 26.3, 1], [1388, 23.1, 1], [1402, 21.5, 1], [1416, 20, 1], [1430, 18.4, 1], [1444, 16.8, 1], [1458, 20.8, 1],
      [1472, 24.8, 1], [1486, 28.8, 1], [1500, 32.9, 1], [1514, 31.1, 1], [1528, 29.4, 1], [1537.5, 30.8, 1], [1541.5, 33.3, 1],
      [1545.5, 30.8, 1], [1556, 25.9, 1], [1570, 24.1, 1], [1584, 22.4, 1], [1612, 18.9, 1], [1626, 19.6, 1], [1640, 23.8, 1],
      [1654, 27.9, 1], [1668, 32.1, 1], [1682, 30.5, 1], [1696, 28.9, 1], [1710, 27.4, 1], [1738, 24.2, 1], [1752, 22.6, 1],
      [1780, 19.5, 1], [1808, 16.3, 1], [1822, 19.6, 1], [1836, 23.7, 1], [1850, 27.7, 1], [1864, 31, 1], [1878, 29.2, 1],
      [1906, 25.7, 1], [1920, 24, 1], [1934, 22.2, 1], [1948.5, 23.2, 1], [1952.5, 25.7, 1], [1956.5, 23.2, 1], [1976, 17.8, 1],
      [1990, 22.1, 1], [2004, 26.3, 1], [2018, 30.5, 1], [2032, 28.9, 1], [2046, 27.3, 1], [2060, 25.8, 1], [2074, 24.2, 1],
      [2102, 21, 1], [2116, 19.4, 1], [2130, 17.8, 1], [2158, 14.7, 1], [2172, 14.7, 1], [2186, 18.7, 1], [2200, 22.7, 1],
      [2214, 26.7, 1], [2228, 29.1, 1], [2242, 27.3, 1], [2258.5, 28, 1], [2262.5, 30.5, 1], [2266.5, 28, 1], [2284, 22.1, 1],
      [2312, 18.6, 1], [2326, 16.8, 1], [2340, 15.1, 1], [2354, 14.2, 1], [2368, 18.3, 1], [2382, 22.4, 1], [2396, 26.4, 1],
      [2410, 28, 1], [2438, 24.5, 1], [2452, 22.8, 1], [2466, 21, 1], [2480, 19.3, 1], [2494, 17.5, 1], [2522, 14, 1],
      [2536, 17.5, 1], [2550, 21.8, 1], [2564, 26.2, 1], [2578, 27.1, 1], [2592, 25.4, 1], [2605, 26.7, 1], [2609, 29.2, 1],
      [2613, 26.7, 1], [2634, 20.3, 1], [2648, 18.6, 1], [2676, 15.2, 1], [2690, 13.5, 1], [2704, 11.8, 1], [2718, 13.4, 1],
      [2732, 17.6, 1], [2746, 21.8, 1], [2760, 26, 1], [2774, 26, 1], [2802, 22.8, 1], [2816, 21.1, 1], [2844, 17.9, 1],
      [2858, 16.3, 1], [2872, 14.6, 1], [2886, 17, 1],
    ],
    items: [["spread", 218, 27.6], ["cocoa", 372, 27.3], ["rapid", 735, 27.4], ["garlic", 1040, 22.5], ["cocoa", 1275, 25.4], ["garlic", 1640, 21.2], ["cocoa", 2190, 17.2], ["spread", 2385, 20.6], ["rapid", 2745, 18.9]],
    spawns: [],
    horde: [],
    ride: {
      sled: true,
      time: 110000,
      finish: 2912,
      how: "UP to jump, DOWN to duck, hold space to shoot",
      track: [
        [[0, 37.4], [70, 35.2], [198, 21.7], [246, 35.9], [354, 21.9], [398, 35.2], [440, 30.4]],
        [[450, 29.3], [538, 19.2], [590, 34.3], [708, 19.3], [756, 33.6], [830, 25.1]],
        [[842, 23.7], [904, 16.6], [960, 32.7], [1070, 18.7], [1114, 32], [1215, 19.6]],
        [[1229, 17.8], [1244, 16], [1294, 31.2], [1444, 14.2], [1500, 30.3], [1536, 25.8]],
        [[1547, 24.4], [1620, 15.3], [1668, 29.5], [1810, 13.5], [1862, 28.6], [1945, 18.2]],
        [[1960, 16.4], [1974, 14.6], [2018, 27.9], [2168, 10.9], [2224, 27], [2256, 23]],
        [[2269, 21.4], [2352, 11], [2404, 26.2], [2524, 11.2], [2570, 25.4], [2601, 21.7]],
        [[2617, 19.7], [2710, 8.4], [2764, 24.6], [2876, 11.6], [2902, 18.8]],
      ],
      stones: [[149, 0], [521, 1], [786, 1], [1423, 3], [1722, 4], [2294, 6], [2831, 7]],
      drifts: [[278, 0], [668, 1], [1143, 2], [1796, 4], [2510, 6]],
      lows: [[326, 334, 28.7, 0], [613, 619, 34.6, 1], [989, 997, 32.2, 0], [1366, 1372, 26.2, 1], [1590, 1598, 22.2, 0], [1890, 1896, 28.3, 1], [2086, 2094, 23.4, 0], [2659, 2665, 17.8, 1]],
      hands: [[485, 1], [1324, 3], [1762, 4], [2144, 5], [2418, 6], [2792, 7]],
      icicles: [[220, 0], [419, 0], [561, 1], [643, 1], [874, 2], [929, 2], [1021, 2], [1267, 3], [1566, 4], [1642, 4], [1924, 4], [1994, 5], [2375, 6], [2483, 6], [2734, 7], [2858, 7]],
      pops: [[108, 0], [374, 0], [730, 1], [1046, 2], [1090, 2], [1186, 2], [1469, 3], [1739, 4], [1833, 4], [2193, 5], [2545, 6]],
      checks: [398, 756, 1114, 1500, 1862, 2224, 2570],
    },
  }),
  // The Widow's Web, the Frozen Lake's boss room: a frozen waterfall's cavern, the
  // floor ice from the arena's middle, stairs of boards at each side (18 is over the
  // spikes' reach), three barrels of fire at 30, 48 and 66 into the arena (ghoul-frozen.js).
  room("widow", "The Widow's Web", "Melt her veil, then her heart", {
    length: 200,
    ground: [[0, 200, 6]],
    ice: [[116, 188]],
    shelves: [[118, 130, 12], [126, 138, 18], [170, 182, 12], [162, 174, 18]],
    key: null,
    door: 194,
    candy: [[18, 8.5, 5], [70, 8.5, 5]],
    items: [["cocoa", 56, 6], ["flare", 84, 6]],
    spawns: [["zombie", 40], ["frozen", 66]],
    boss: "frostwidow",
  }),
]);

const ROOM_IDS = new Set(ROOMS.map((r) => r.id));
export const roomById = (id) => ROOMS.find((r) => r.id === id) || null;

// The stages: three rooms and a boss's, in order. Every run starts in the
// hall, then you pick each next stage from two (one, once a single stage is
// left) not yet played that run; clearing every stage wins. `rooms` are ids
// in ROOMS, the last one the boss's.
function stage(id, title, sub, rooms) {
  for (const r of rooms) if (!ROOM_IDS.has(r)) throw new Error(`stage ${id}: no room ${r}`);
  return freeze({ id, title, sub, rooms: freeze(rooms), boss: roomById(rooms[rooms.length - 1]).boss });
}

export const STAGES = freeze([
  stage("manor", "The Manor", "Where the screaming started", ["foyer", "gallery", "library", "ballroom"]),
  stage("wing", "The East Wing", "The servants never left", ["kitchen", "conservatory", "attic", "crypt"]),
  stage("graveyard", "The Graveyard", "Everyone here was buried in a hurry", ["lychgate", "graves", "mausoleums", "angel"]),
  stage("grounds", "The Grounds", "The gardener never stopped working", ["maze", "topiary", "gazebo", "yard"]),
  stage("chapel", "The Chapel", "Service is still in session", ["nave", "tower", "loft", "choir"]),
  stage("sanatorium", "Blackmoor Sanatorium", "Visiting hours ended in 1912", ["admissions", "baths", "theater", "ward"]),
  stage("village", "Hollow End Village", "Every curtain twitches as you pass", ["street", "inn", "square", "green"]),
  stage("mine", "The Deep Seam Mine", "They are still knocking", ["shaft", "tunnels", "collapse", "cart", "seam"]),
  stage("carnival", "The Midnight Carnival", "Every game is rigged in its favor", ["midway", "mirrors", "funhouse", "darkride", "bigtop"]),
  stage("frozen", "The Frozen Lake", "The ice remembers who fell through", ["huts", "lodge", "blackice", "sled", "widow"]),
]);
export const stageById = (id) => STAGES.find((s) => s.id === id) || null;
