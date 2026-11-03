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
// - `darkOnKey`: the room's lights go out for good when you take its key.
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
// - `mud`: [x0, x1] spans of the floor that are sinking mud (Gallows Bog): on
//   the floor in one Planny keeps sinking while he stands, his run and his
//   jump sagging the longer he stays (ghoul.js, `mudAt`, `you.mudMs`); dry
//   floor or the air lets him go again. Keep a span on flat floor.
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
// - `ride.runner`: "banister" for the Manor's Grand Banister (ghoul-banister.js): the same `track` (the first `rails` lines are the handrail,
//   the rest brass under-rails beside it: the split track), `checks` and `time`, with `props` [x, line, kind] (a vase, kind 0, or a
//   candlestick, kind 1: jump), `lows` [x0, x1, y] (a hanging portrait frame: duck), `swings` [x, line, amp, period ms, phase ms] (a
//   chandelier on a pendulum: duck it while its bob is high, or take the under-rail), `butlers` [x, line] (lunge with a tray: jump
//   or shoot), `webs` [x, line] (shoot), `finish` (where the foyer floor at the end begins) and `how`. State: `round.runner`.
// - `ride.runner`: "tray" for the East Wing's Servants' Back Stairs (ghoul-tray.js): the same `track`, `checks` and `time`, with
//   `pots` [x, line, kind] (a rolling pot, kind 0, or a drop of cutlery, kind 1: jump), `lows` [x0, x1, y, kind] (duck: a swinging ham,
//   kind 0, or hanging pans, kind 1, its underside y), `cooks` [x, line] (a spectral cook who flings a dish: jump it or shoot the cook),
//   `domes` and `plates` [x, line, lift] (courses: run through a dome, shoot a plate), `grease` [x0, x1] (flat stretches where the
//   tray speeds up), `finish` (the dining table at the end) and `how`; the room's `candy` are the cherries. The tray's state is
//   `round.runner` (ghoul.js keeps that slot for a rolling bonus ride).
// - `ride.runner: "mower"`: the Grounds' Gardener's Revenge (ghoul-mower.js): a flat `track` whose gaps are ponds and ha-ha
//   ditches (`gaps`: 0 a pond, 1 a ditch; jump), `junk` [x, kind] (gnome, wheelbarrow, flowerpot: jump), `lows` [x0, x1, y, kind]
//   (a hedge arch, or a clothes line of gloves: duck), `hedges` [x] (thorn hedges: mow or jump), `beasts` [x] (snapping topiary:
//   shoot or jump), `grass` [x0, x1] and `weeds` [x] (mow targets for the lawn-cut grade), `checks`, `finish` (where the lawn's
//   end, the ground, begins), `time` and `how`. State: `round.runner`.
// - `ride.runner`: "pew" for the Chapel's Holy Roller (ghoul-pew.js): no `track`, an endless-runner in three lanes: `items` [x, lane, kind, len]
//   (kinds: pillar, confessional, pewx to switch; kneeler, stand, cracks, hatch to jump; censer, banner, beam to slide; garg and bell to shoot),
//   `souls` [x, lane, h, type] (wax souls and halos), `checks`, `finish` (the distance where the ride ends), `time` and `how`; built by
//   ghoul-pew-course.js. State: `round.runner`.
// - `ride.runner`: "hearse" for the Graveyard's Midnight Hearse (ghoul-hearse.js): no `track`, a flat road of two lanes (0 the road,
//   1 the verge), every thing [x, lane, ...] (`graves`, `stones` [x, lane, kind], `lows` [x0, x1, lane, kind], `hands`, `crows`
//   [x, lane, h], `blocks` [x0, x1, lane]), the lane `gates` [x0, x1], `lanterns` [x, lane], `fog` [x0, x1], `checks`, `finish`,
//   `time` and `how`. State: `round.runner`.
// - `ride.runner`: "codeblue" for Blackmoor Sanatorium's Code Blue (ghoul-gurney.js): the same `track` (the gaps are elevator shafts), `checks` and
//   `time`, with `chairs` [x, line] (a wheelchair that rolls at you: jump), `stands` [x, line] (an IV stand: jump), `lows` [x0, x1, y, kind]
//   (duck: a hanging surgical lamp, kind 0, or swinging doors, kind 1, its underside y), `orderlies` [x, line] (lunge from a doorway: jump or
//   shoot), `lamps` [x, line] (wave i's surge lamp, hung high: shoot it from the air and that blackout is called off), `waves` [x0, x1]
//   (the lights-out spans, each with a flicker and a 3, 2, 1 before x0), `finish` (where the ambulance bay begins) and `how`.
//   State: `round.runner`.
// - `ride.gallery`: true for the Carnival's dark ride (a shooting gallery, not a track: `time` the clock in ms, `ready` the
//   intro's ms, `how` the controls line of its banner; see ghoul-ride.js).
// - `ride.runner: "wagon"`: Hollow End Village's Torch Mob (ghoul-wagon.js): the same `track` (the gaps are ditches and the collapsed bridge, the
//   ramp before it launches), `checks`, `time`, `finish` and `how`, with `blocks` [x, line, kind] (a barrel, kind 0, or a crate, kind 1: jump),
//   `lows` [x0, x1, y, kind] (a washing line, kind 0, or an inn sign, kind 1: duck), `throwers` [x, line, kind] (a villager hurling a pitchfork,
//   kind 0, duck, or a torch, kind 1, jump; both can be shot), `horses` [x, line] (a spooked horse: jump or shoot), `surge` [x0, x1, extra]
//   (spans where the mob runs faster), `bridge` [x0, x1] (for the art). The mob behind (the gap) is the twist. State: `round.runner`.
// - `bonus`: true for a bonus room (the Runaway Cart, the dark ride, the Coffin Sled, Holy Roller, Code Blue, the Torch Mob): it plays for 5 hearts of its own, pays
//   Lucky Dice for a finish and costs the run nothing (ghoul-bonus.js).
// - `dark`: true for a room always dark, false for one always lit; left out,
//   each time it is entered it is dark DARK_CHANCE of the time (ghoul.js).
import { COURSE } from "./ghoul-pew-course.js";


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
    darkOnKey: Boolean(spec.darkOnKey),
    toll: spec.toll || 0,
    flicker: spec.flicker || 0,
    moon: spec.moon || 0,
    rocks: spec.rocks || 0,
    water: list(spec.water || []),
    mud: list(spec.mud || []),
    belts: list(spec.belts || []),
    ice: list(spec.ice || []),
    thin: list(spec.thin || []),
    ride: spec.ride ? deep(spec.ride) : null,
  });
}

export const ROOMS = freeze([
  // Every run starts here: a long, easy walk with only zombies, then the
  // first choice of stage. Always lit, until you take the key.
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
    dark: false,
    darkOnKey: true,
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
  // The Grand Banister, the Manor's BONUS ROUND (see ghoul-banister.js and ghoul-bonus.js): a ride, not a
  // walk. YOU slide down the grand staircase's endless polished banister from the attic landing to the
  // foyer, about 65 seconds of it at 46 a second: twenty flights of stairs (each a long descent and a
  // short climb over the newel at the landing), seven breaks in the rail to jump, vases and candlesticks
  // to jump, hanging portrait frames and swinging chandeliers to duck (the chandeliers on a timed
  // pendulum: time them, or take the brass under-rail beneath them), ghostly butlers lunging with
  // silver trays and cobwebs to shoot, eight places where a lower rail runs beside the handrail (jump
  // and hold DOWN to dive onto it), seven checkpoints and a jump off the end of the rail (the lip) onto
  // the foyer floor where the door is. Five hearts of its own. The numbers are generated.
  room("banister", "The Grand Banister", "Please keep your hands and ghosts inside the rail", {
    length: 3006,
    ground: [[0, 30, 35.9], [2928, 3006, 10]],
    start: 8,
    key: null,
    door: 2996,
    bonus: true,
    dark: false,
    candy: [
      [30, 39.2, 1], [44, 38.7, 1], [58, 38.2, 1], [72, 37.6, 1], [86, 36.2, 1], [100, 34.8, 1], [114, 33.4, 1], [128, 31.9, 1],
      [142, 30.5, 1], [156, 29.1, 1], [170, 27.7, 1], [184, 29.5, 1], [198, 33.6, 1], [212, 36.9, 1], [220, 29.1, 1], [226, 35.5, 1],
      [231, 28, 1], [240, 34.1, 1], [242, 26.9, 1], [253, 25.8, 1], [254, 32.7, 1], [264, 24.7, 1], [268, 31.3, 1], [275, 23.6, 1],
      [282, 29.9, 1], [286, 22.5, 1], [296, 28.5, 1], [297, 21.4, 1], [308, 20.3, 1], [310, 27.1, 1], [324, 26.9, 1], [338, 31, 1],
      [352, 35, 1], [366, 35.6, 1], [380, 34.1, 1], [394, 32.6, 1], [408, 31.1, 1], [413.7, 33.7, 1], [417.7, 35.3, 1], [421.7, 33.7, 1],
      [436, 28.2, 1], [450, 26.7, 1], [464, 28.2, 1], [478, 32.5, 1], [492, 35.6, 1], [499, 27.9, 1], [506, 34.2, 1], [510, 26.8, 1],
      [520, 32.8, 1], [521, 25.7, 1], [532, 24.6, 1], [534, 31.4, 1], [543, 23.5, 1], [548, 29.9, 1], [554, 22.3, 1], [562, 28.5, 1],
      [565, 21.2, 1], [576, 27.1, 1], [576, 20.1, 1], [587, 19, 1], [590, 25.7, 1], [604, 24.7, 1], [618, 28.9, 1], [632, 33.2, 1],
      [646, 34.6, 1], [649, 27.2, 1], [660, 33.1, 1], [660, 26.1, 1], [671, 24.9, 1], [674, 31.6, 1], [682, 23.8, 1], [688, 30.1, 1],
      [693, 22.6, 1], [702, 28.7, 1], [704, 21.5, 1], [715, 20.3, 1], [716, 27.2, 1], [726, 19.1, 1], [730, 25.7, 1], [737, 18, 1],
      [744, 24.2, 1], [758, 25.3, 1], [772, 29.6, 1], [786, 34, 1], [800, 33.3, 1], [814, 31.8, 1], [828, 30.2, 1], [842, 28.7, 1],
      [849.5, 31.1, 1], [853.5, 32.7, 1], [857.5, 31.1, 1], [870, 25.7, 1], [884, 24.2, 1], [898, 25.9, 1], [912, 30.1, 1], [926, 33.5, 1],
      [934, 25.6, 1], [940, 32, 1], [945, 24.4, 1], [954, 30.5, 1], [956, 23.3, 1], [967, 22.1, 1], [968, 29, 1], [978, 20.9, 1],
      [982, 27.5, 1], [989, 19.7, 1], [996, 25.9, 1], [1000, 18.5, 1], [1010, 24.4, 1], [1011, 17.3, 1], [1024, 22.9, 1], [1038, 25.5, 1],
      [1052, 29.6, 1], [1066, 33, 1], [1074, 25.1, 1], [1080, 31.4, 1], [1085, 23.9, 1], [1094, 29.9, 1], [1096, 22.7, 1], [1107, 21.5, 1],
      [1108, 28.4, 1], [1118, 20.3, 1], [1122, 26.8, 1], [1129, 19.1, 1], [1136, 25.3, 1], [1140, 17.9, 1], [1150, 23.8, 1], [1151, 16.7, 1],
      [1162, 15.4, 1], [1164, 22.2, 1], [1178, 21.1, 1], [1192, 25.3, 1], [1206, 29.5, 1], [1220, 32.1, 1], [1234, 30.7, 1], [1248, 29.2, 1],
      [1262, 27.8, 1], [1275.9, 29.6, 1], [1279.9, 31.2, 1], [1283.9, 29.6, 1], [1290, 25, 1], [1304, 23.5, 1], [1318, 22.5, 1], [1332, 26.8, 1],
      [1346, 31.2, 1], [1358, 23.8, 1], [1360, 30.6, 1], [1369, 22.7, 1], [1374, 29.2, 1], [1380, 21.6, 1], [1388, 27.8, 1], [1391, 20.5, 1],
      [1402, 26.4, 1], [1402, 19.4, 1], [1413, 18.2, 1], [1416, 24.9, 1], [1424, 17.1, 1], [1430, 23.5, 1], [1435, 16, 1], [1444, 22.1, 1],
      [1446, 14.9, 1], [1458, 20.7, 1], [1472, 24, 1], [1486, 28, 1], [1500, 30.9, 1], [1507, 23.1, 1], [1514, 29.4, 1], [1518, 22, 1],
      [1528, 27.9, 1], [1529, 20.8, 1], [1540, 19.7, 1], [1542, 26.5, 1], [1551, 18.5, 1], [1556, 25, 1], [1562, 17.3, 1], [1570, 23.5, 1],
      [1573, 16.2, 1], [1584, 22, 1], [1584, 15, 1], [1595, 13.9, 1], [1598, 20.5, 1], [1612, 21.1, 1], [1626, 25.4, 1], [1640, 29.7, 1],
      [1654, 29.4, 1], [1668, 27.9, 1], [1682, 26.4, 1], [1692.2, 28.5, 1], [1696.2, 30.1, 1], [1700.2, 28.5, 1], [1710, 23.4, 1], [1724, 21.9, 1],
      [1738, 20.4, 1], [1752, 21.8, 1], [1766, 26, 1], [1780, 29.8, 1], [1789, 21.9, 1], [1794, 28.4, 1], [1800, 20.8, 1], [1808, 26.9, 1],
      [1811, 19.6, 1], [1822, 25.5, 1], [1822, 18.5, 1], [1833, 17.4, 1], [1836, 24.1, 1], [1844, 16.3, 1], [1850, 22.7, 1], [1855, 15.2, 1],
      [1864, 21.2, 1], [1866, 14, 1], [1878, 19.8, 1], [1892, 22.7, 1], [1906, 26.8, 1], [1920, 28.6, 1], [1934, 27.1, 1], [1948, 25.6, 1],
      [1962, 24.1, 1], [1976, 22.6, 1], [1990, 21.1, 1], [2004, 19.7, 1], [2018, 19.4, 1], [2032, 23.5, 1], [2046, 27.5, 1], [2060, 27.6, 1],
      [2074, 26.1, 1], [2088, 24.6, 1], [2097.3, 26.7, 1], [2101.3, 28.3, 1], [2105.3, 26.7, 1], [2116, 21.5, 1], [2130, 20, 1], [2144, 18.5, 1],
      [2158, 17.8, 1], [2172, 21.9, 1], [2186, 26, 1], [2200, 27.4, 1], [2214, 25.9, 1], [2228, 24.5, 1], [2242, 23, 1], [2256, 21.6, 1],
      [2270, 20.1, 1], [2284, 18.7, 1], [2298, 17.2, 1], [2312, 17.4, 1], [2326, 21.6, 1], [2340, 25.8, 1], [2354, 26.4, 1], [2368, 25, 1],
      [2382, 23.6, 1], [2396, 22.2, 1], [2410, 20.7, 1], [2424, 19.3, 1], [2438, 17.9, 1], [2452, 16.5, 1], [2466, 18.7, 1], [2480, 22.8, 1],
      [2494, 26.6, 1], [2508, 25, 1], [2522, 23.5, 1], [2536, 22, 1], [2548.2, 23.8, 1], [2552.2, 25.4, 1], [2556.2, 23.8, 1], [2564, 18.9, 1],
      [2578, 17.3, 1], [2592, 15.8, 1], [2606, 15.9, 1], [2620, 20.2, 1], [2634, 24.5, 1], [2648, 25.1, 1], [2662, 23.6, 1], [2676, 22.1, 1],
      [2690, 20.6, 1], [2704, 19.1, 1], [2718, 17.7, 1], [2732, 16.2, 1], [2746, 14.7, 1], [2760, 17.7, 1], [2774, 21.8, 1], [2788, 25.2, 1],
      [2802, 23.7, 1], [2816, 22.3, 1], [2830, 20.8, 1], [2844, 19.3, 1], [2846.1, 22.3, 1], [2850.1, 23.9, 1], [2854.1, 22.3, 1], [2858, 17.9, 1],
      [2872, 16.4, 1], [2886, 14.9, 1], [2900, 16.5, 1], [2914, 20.4, 1],
    ],
    items: [],
    spawns: [],
    horde: [],
    ride: {
      runner: "banister",
      rails: 8,
      time: 110000,
      finish: 2928,
      how: "UP jump, DOWN duck (in the air: dive), LEFT brake, SPACE shoot",
      track: [
        [[0, 37.5], [70, 35.1], [176, 24.4], [210, 34.4], [321, 23.3], [357, 33.8], [410.2, 28.2]],
        [[425.2, 26.6], [457, 23.3], [489, 33.2], [603, 21.7], [639, 32.6], [752, 20.7], [788, 31.9], [847, 25.5]],
        [[860, 24.1], [890, 20.8], [924, 31], [1028, 19.8], [1064, 30.5], [1177, 18.1], [1216, 29.8], [1273.9, 23.9]],
        [[1285.9, 22.7], [1317, 19.5], [1348, 29.1], [1460, 17.8], [1497, 28.5], [1607, 16.9], [1643, 27.9], [1688.7, 23]],
        [[1703.7, 21.4], [1745, 17], [1779, 27.2], [1881, 16.8], [1914, 26.5], [2015, 15.8], [2050, 26], [2094.8, 21.1]],
        [[2107.8, 19.7], [2156, 14.5], [2193, 25.4], [2308, 13.5], [2345, 24.6], [2457, 13.3], [2493, 24], [2544.7, 18.3]],
        [[2559.7, 16.7], [2602, 12], [2639, 23.3], [2749, 11.7], [2786, 22.7], [2844.1, 16.6]],
        [[2856.1, 15.4], [2892, 11.6], [2918, 18.8]],
        [[210, 27.4], [321, 16.3]],
        [[489, 26.2], [603, 14.7]],
        [[639, 25.6], [752, 13.7]],
        [[924, 24], [1028, 12.8]],
        [[1064, 23.5], [1177, 11.1]],
        [[1348, 22.1], [1460, 10.8]],
        [[1497, 21.5], [1607, 9.9]],
        [[1779, 20.2], [1881, 9.8]],
      ],
      props: [[162, 0, 0], [287, 0, 1], [714, 10, 1], [1209, 2, 0], [1239, 2, 1], [1575, 14, 1], [1731, 4, 0], [1911, 4, 1], [2065, 4, 0], [2237, 5, 1], [2388, 5, 0], [2587, 6, 0]],
      lows: [[236, 243, 35], [665, 672, 33.1], [1524, 1531, 28.9], [1807, 1814, 27.5], [2148, 2155, 18.6], [2430, 2437, 19.2]],
      swings: [[530, 1, 9, 2400, 1088], [966, 2, 9, 2500, 1588], [1104, 2, 9, 2500, 1497], [1389, 3, 9, 2800, 624], [1969, 4, 9, 2700, 690], [2293, 5, 9, 2600, 973], [2683, 6, 9, 2600, 1273]],
      butlers: [[361, 0], [793, 1], [1648, 3], [2036, 4], [2209, 5], [2360, 5], [2491, 5], [2625, 6]],
      webs: [[302, 8], [466, 1], [738, 1], [888, 2], [1300, 3], [1602, 3], [2253, 5], [2645, 6]],
      checks: [388, 734, 1123, 1442, 1819, 2169, 2519],
    },
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
  // The Servants' Back Stairs, the East Wing's BONUS ROUND (see ghoul-tray.js and ghoul-bonus.js): a ride, not a
  // walk. YOU ride a silver serving tray down the cramped back stairs and through the steamy basement kitchens,
  // about a minute of it at 44 a second (faster on the greased stretches): 18 laps of a climb onto a pantry shelf, a flat run along it and
  // a flight of stairs down, with a gap between two flights each time; rolling pots and drops of cutlery to jump,
  // swinging hams and hanging copper pans to duck, spectral cooks who fling dishes (jump them or shoot the cook),
  // silver domes to run through and flying plates to shoot (seven of them is a full seven course meal), cherries
  // along the way, eight checkpoints, and a launch off the end of the last shelf (the lip) onto the dining table where
  // the door is. Five hearts of its own. The numbers are generated.
  room("tray", "Last Orders", "Dinner is served. You are dinner", {
    length: 3176,
    ground: [[0, 30, 28.6], [3086, 3176, 21.8]],
    start: 8,
    key: null,
    door: 3166,
    bonus: true,
    dark: false,
    candy: [
      [20, 32.6, 1], [34, 32.6, 1], [41, 32.1, 1], [46, 34.7, 1], [51, 32.1, 1], [62, 28.2, 1], [76, 25.8, 1],
      [95, 24.3, 1], [99, 26.3, 1], [103, 24.3, 1], [104, 21, 1], [118, 24.9, 1], [132, 28.8, 1], [146, 32.2, 1],
      [157, 33.4, 1], [162, 36, 1], [167, 33.4, 1], [174, 32.2, 1], [188, 32.2, 1], [202, 32.2, 1], [230, 29.5, 1],
      [244, 27.1, 1], [258, 24.8, 1], [273, 24, 1], [277, 26, 1], [281, 24, 1], [286, 21.8, 1], [300, 25.7, 1],
      [314, 29.7, 1], [328, 31.9, 1], [342, 31.9, 1], [347, 33.1, 1], [352, 35.7, 1], [357, 33.1, 1], [370, 31.9, 1],
      [384, 31.9, 1], [398, 30.9, 1], [412, 28.5, 1], [426, 26.1, 1], [440, 23.7, 1], [451, 23.5, 1], [455, 25.5, 1],
      [459, 23.5, 1], [468, 22.5, 1], [482, 26.5, 1], [496, 30.4, 1], [524, 31.5, 1], [538, 31.5, 1], [552, 31.5, 1],
      [555, 32.7, 1], [560, 35.3, 1], [565, 32.7, 1], [580, 29.8, 1], [583, 29.7, 1], [588, 32.3, 1], [593, 29.7, 1],
      [608, 25.1, 1], [629, 23.3, 1], [633, 25.3, 1], [637, 23.3, 1], [650, 23.4, 1], [664, 27.3, 1], [678, 31.2, 1],
      [685, 32.4, 1], [690, 35, 1], [695, 32.4, 1], [706, 31.2, 1], [720, 31.2, 1], [734, 31.2, 1], [748, 31.2, 1],
      [776, 26.4, 1], [790, 24, 1], [807, 22.9, 1], [811, 24.9, 1], [815, 22.9, 1], [818, 20.2, 1], [832, 24.1, 1],
      [846, 28, 1], [860, 30.8, 1], [874, 30.8, 1], [902, 30.8, 1], [916, 30.8, 1], [930, 30.1, 1], [944, 27.7, 1],
      [958, 25.3, 1], [972, 22.9, 1], [985, 22.5, 1], [989, 24.5, 1], [993, 22.5, 1], [1000, 20.9, 1], [1014, 24.8, 1],
      [1028, 28.7, 1], [1042, 30.4, 1], [1045, 31.6, 1], [1050, 34.2, 1], [1055, 31.6, 1], [1070, 30.4, 1], [1084, 30.4, 1],
      [1112, 29, 1], [1126, 26.7, 1], [1140, 24.3, 1], [1154, 22, 1], [1163, 22.2, 1], [1167, 24.2, 1], [1171, 22.2, 1],
      [1182, 21.7, 1], [1196, 25.6, 1], [1210, 29.5, 1], [1238, 30.1, 1], [1252, 30.1, 1], [1266, 30.1, 1], [1280, 30.1, 1],
      [1308, 25.7, 1], [1322, 23.3, 1], [1341, 21.8, 1], [1345, 23.8, 1], [1349, 21.8, 1], [1350, 18.5, 1], [1364, 22.4, 1],
      [1378, 26.3, 1], [1392, 29.7, 1], [1406, 29.7, 1], [1415, 30.9, 1], [1420, 33.5, 1], [1425, 30.9, 1], [1434, 29.7, 1],
      [1448, 29.7, 1], [1462, 29.4, 1], [1476, 27, 1], [1490, 24.6, 1], [1504, 22.3, 1], [1519, 21.5, 1], [1523, 23.5, 1],
      [1527, 21.5, 1], [1532, 19.3, 1], [1546, 23.2, 1], [1560, 27.2, 1], [1574, 29.4, 1], [1602, 29.4, 1], [1616, 29.4, 1],
      [1627, 30.6, 1], [1632, 33.2, 1], [1637, 30.6, 1], [1644, 28.4, 1], [1658, 26, 1], [1672, 23.6, 1], [1686, 21.2, 1],
      [1697, 21, 1], [1701, 23, 1], [1705, 21, 1], [1714, 20, 1], [1728, 24, 1], [1742, 27.9, 1], [1770, 29, 1],
      [1784, 29, 1], [1798, 29, 1], [1801, 30.2, 1], [1806, 32.8, 1], [1811, 30.2, 1], [1826, 27.3, 1], [1829, 27.1, 1],
      [1834, 29.7, 1], [1839, 27.1, 1], [1854, 22.5, 1], [1875, 20.7, 1], [1879, 22.7, 1], [1883, 20.7, 1], [1896, 20.8, 1],
      [1910, 24.7, 1], [1924, 28.6, 1], [1938, 28.6, 1], [1952, 28.6, 1], [1980, 28.6, 1], [1994, 28.6, 1], [2008, 26.2, 1],
      [2022, 23.9, 1], [2036, 21.5, 1], [2053, 20.4, 1], [2057, 22.4, 1], [2061, 20.4, 1], [2064, 17.7, 1], [2078, 21.6, 1],
      [2092, 25.5, 1], [2106, 28.3, 1], [2109, 29.5, 1], [2114, 32.1, 1], [2119, 29.5, 1], [2134, 28.3, 1], [2148, 28.3, 1],
      [2162, 28.3, 1], [2204, 22.8, 1], [2218, 20.4, 1], [2231, 20, 1], [2235, 22, 1], [2239, 20, 1], [2246, 18.4, 1],
      [2260, 22.3, 1], [2274, 26.2, 1], [2288, 27.9, 1], [2293, 29.1, 1], [2298, 31.7, 1], [2303, 29.1, 1], [2316, 27.9, 1],
      [2330, 27.9, 1], [2358, 26.5, 1], [2372, 24.2, 1], [2386, 21.8, 1], [2400, 19.5, 1], [2409, 19.7, 1], [2413, 21.7, 1],
      [2417, 19.7, 1], [2428, 19.2, 1], [2442, 23.1, 1], [2456, 27, 1], [2470, 27.6, 1], [2483, 28.8, 1], [2488, 31.4, 1],
      [2493, 28.8, 1], [2498, 27.6, 1], [2512, 27.6, 1], [2526, 27.6, 1], [2540, 25.6, 1], [2554, 23.2, 1], [2568, 20.8, 1],
      [2587, 19.3, 1], [2591, 21.3, 1], [2595, 19.3, 1], [2596, 16, 1], [2610, 19.9, 1], [2624, 23.8, 1], [2638, 27.2, 1],
      [2666, 27.2, 1], [2680, 27.2, 1], [2694, 27.2, 1], [2736, 22.1, 1], [2750, 19.7, 1], [2765, 18.9, 1], [2769, 20.9, 1],
      [2773, 18.9, 1], [2778, 16.7, 1], [2792, 20.6, 1], [2806, 24.6, 1], [2820, 26.8, 1], [2825, 28, 1], [2830, 30.6, 1],
      [2835, 28, 1], [2848, 26.8, 1], [2862, 26.8, 1], [2890, 25.8, 1], [2904, 23.4, 1], [2918, 21.1, 1], [2932, 18.7, 1],
      [2943, 18.6, 1], [2947, 20.6, 1], [2951, 18.6, 1], [2960, 17.5, 1], [2974, 21.5, 1], [2988, 25.4, 1], [3003, 27.7, 1],
      [3008, 30.3, 1], [3013, 27.7, 1], [3016, 26.5, 1], [3030, 26.5, 1], [3044, 26.5, 1], [3058, 28.2, 1],
    ],
    items: [],
    spawns: [],
    horde: [],
    ride: {
      runner: "tray",
      time: 110000,
      finish: 3086,
      how: "UP to jump, DOWN to duck, hold space to shoot",
      track: [
        [[0, 30], [36, 30], [94, 20.1]],
        [[104, 18.4], [144, 29.6], [214, 29.6], [272, 19.8]],
        [[282, 18.1], [322, 29.3], [392, 29.3], [450, 19.4]],
        [[460, 17.7], [500, 28.9], [570, 28.9], [628, 19.1]],
        [[638, 17.4], [678, 28.6], [748, 28.6], [806, 18.7]],
        [[816, 17], [856, 28.2], [926, 28.2], [984, 18.3]],
        [[994, 16.6], [1034, 27.8], [1104, 27.8], [1162, 18]],
        [[1172, 16.3], [1212, 27.5], [1282, 27.5], [1340, 17.6]],
        [[1350, 15.9], [1390, 27.1], [1460, 27.1], [1518, 17.3]],
        [[1528, 15.6], [1568, 26.8], [1638, 26.8], [1696, 16.9]],
        [[1706, 15.2], [1746, 26.4], [1816, 26.4], [1874, 16.5]],
        [[1884, 14.8], [1924, 26], [1994, 26], [2052, 16.2]],
        [[2062, 14.5], [2102, 25.7], [2172, 25.7], [2230, 15.8]],
        [[2240, 14.1], [2280, 25.3], [2350, 25.3], [2408, 15.5]],
        [[2418, 13.8], [2458, 25], [2528, 25], [2586, 15.1]],
        [[2596, 13.4], [2636, 24.6], [2706, 24.6], [2764, 14.7]],
        [[2774, 13], [2814, 24.2], [2884, 24.2], [2942, 14.4]],
        [[2952, 12.7], [2992, 23.9], [3052, 23.9], [3076, 30.6]],
      ],
      pots: [[46, 0, 0], [162, 1, 0], [352, 2, 0], [560, 3, 0], [588, 3, 0], [690, 4, 0], [1050, 6, 1], [1420, 8, 0], [1632, 9, 0], [1806, 10, 0], [1834, 10, 0], [2114, 12, 0], [2298, 13, 1], [2488, 14, 0], [2830, 16, 1], [3008, 17, 0]],
      lows: [[206, 214, 32.6, 1], [512, 519, 31.9, 0], [890, 898, 31.2, 1], [1092, 1099, 30.8, 0], [1224, 1231, 30.5, 0], [1582, 1589, 29.8, 0], [1758, 1765, 29.4, 0], [1958, 1966, 29, 1], [2346, 2353, 28.3, 0], [2648, 2655, 27.6, 0], [2872, 2879, 27.2, 0]],
      cooks: [[766, 4], [1296, 7], [2190, 12], [2720, 15]],
      domes: [[52, 0, 7], [168, 1, 7], [358, 2, 7], [566, 3, 7], [696, 4, 7], [716, 4, 0], [912, 5, 6.5], [1056, 6, 6.5], [1252, 7, 6.5], [1426, 8, 7], [1638, 9, 7], [1812, 10, 7], [1980, 11, 6.5], [2120, 12, 7], [2140, 12, 0], [2304, 13, 7], [2340, 13, 0], [2494, 14, 7], [2676, 15, 6.5], [2836, 16, 6.5], [3014, 17, 7]],
      plates: [[74, 0, 2.4], [230, 1, 2.4], [392, 2, 3], [540, 3, 2.4], [730, 4, 3], [928, 5, 2.4], [1119, 6, 5], [1268, 7, 4], [1460, 8, 3], [1656, 9, 4], [1786, 10, 2.4], [1996, 11, 2.4], [2154, 12, 3], [2368, 13, 3], [2528, 14, 3], [2692, 15, 4], [2899, 16, 5], [3032, 17, 2.4]],
      grease: [[324, 390], [858, 924], [1392, 1458], [1926, 1992], [2460, 2526]],
      checks: [298, 654, 1010, 1366, 1722, 2078, 2434, 2790],
    },
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
  // The Midnight Hearse, the Graveyard's BONUS ROUND (see ghoul-hearse.js and ghoul-bonus.js): a ride, not a
  // walk. Planny hijacks a runaway black hearse and tears along the cemetery road at 42 a second, about 64
  // seconds of it, on a flat road with two lanes (the road, and the grass verge, a raised bank beside it)
  // that he switches at thirteen lane gates: open graves, headstones and fallen crosses to jump, low branches
  // and the lychgate arch to duck, grasping hands and carrion crows to shoot, five closed stretches (a fallen
  // oak on the road, a hedge wall on the verge) to go round, lanterns that keep the lamp lit, fog banks that
  // burn it down, and six checkpoints. Five hearts of its own; a heart lost throws a coffin out ahead and a
  // ghoul sits up in it to shoot. The numbers are generated: thirteen sections of four slots between the gates.
  room("hearse", "The Midnight Hearse", "Everyone else is already dead on time", {
    length: 2760,
    ground: [[0, 2760, 9]],
    start: 8,
    key: null,
    door: 2750,
    bonus: true,
    dark: false,
    candy: [
      [124, 11, 3], [124, 17, 3], [141, 17.5, 3], [181, 23.5, 3], [184, 11, 3], [221, 17.5, 3],
      [244, 11, 3], [244, 17, 3], [261, 23.5, 3], [341, 23.5, 3], [364, 11, 3], [364, 17, 3],
      [381, 17.5, 3], [421, 23.5, 3], [424, 11, 3], [461, 17.5, 3], [461, 23.5, 3], [484, 11, 3],
      [484, 17, 3], [541, 23.5, 3], [604, 17, 3], [621, 23.5, 3], [661, 17.5, 3], [664, 17, 3],
      [724, 11, 3], [724, 17, 3], [741, 17.5, 3], [781, 23.5, 3], [784, 11, 3], [821, 17.5, 3],
      [821, 23.5, 3], [844, 11, 3], [844, 17, 3], [861, 23.5, 3], [941, 17.5, 3], [964, 11, 3],
      [1021, 17.5, 3], [1024, 17, 3], [1061, 23.5, 3], [1084, 11, 3], [1084, 17, 3], [1141, 23.5, 3],
      [1144, 11, 3], [1181, 17.5, 3], [1204, 11, 3], [1204, 17, 3], [1221, 23.5, 3], [1261, 17.5, 3],
      [1264, 17, 3], [1324, 11, 3], [1324, 17, 3], [1341, 23.5, 3], [1384, 17, 3], [1421, 23.5, 3],
      [1444, 11, 3], [1444, 17, 3], [1461, 17.5, 3], [1541, 17.5, 3], [1564, 11, 3], [1564, 17, 3],
      [1581, 23.5, 3], [1621, 17.5, 3], [1624, 17, 3], [1661, 17.5, 3], [1661, 23.5, 3], [1684, 11, 3],
      [1684, 17, 3], [1744, 11, 3], [1781, 17.5, 3], [1804, 11, 3], [1821, 23.5, 3], [1861, 17.5, 3],
      [1864, 17, 3], [1924, 11, 3], [1924, 17, 3], [1941, 23.5, 3], [1981, 17.5, 3], [1984, 17, 3],
      [2021, 23.5, 3], [2044, 11, 3], [2044, 17, 3], [2061, 17.5, 3], [2164, 17, 3], [2181, 23.5, 3],
      [2221, 17.5, 3], [2224, 17, 3], [2261, 23.5, 3], [2284, 11, 3], [2284, 17, 3], [2341, 17.5, 3],
      [2344, 17, 3], [2381, 23.5, 3], [2404, 11, 3], [2404, 17, 3], [2421, 17.5, 3], [2461, 17.5, 3],
      [2461, 23.5, 3], [2524, 11, 3], [2524, 17, 3], [2541, 23.5, 3], [2581, 17.5, 3], [2584, 17, 3],
      [2621, 17.5, 3], [2621, 23.5, 3], [2644, 11, 3], [2644, 17, 3],
    ],
    items: [],
    spawns: [],
    horde: [],
    ride: {
      runner: "hearse",
      time: 110000,
      finish: 2690,
      how: "LEFT or RIGHT at a gate: switch lane. UP jump, DOWN duck, SPACE shoot",
      gates: [[100, 116], [300, 316], [500, 516], [700, 716], [900, 916], [1100, 1116], [1300, 1316], [1500, 1516], [1700, 1716], [1900, 1916], [2100, 2116], [2300, 2316], [2500, 2516]],
      graves: [[144, 0], [464, 0], [744, 0], [1184, 0], [1464, 0], [1784, 0], [2464, 0], [2464, 1], [2624, 0], [2624, 1]],
      stones: [[184, 1, 0], [464, 1, 0], [624, 1, 0], [864, 1, 0], [1024, 0, 1], [1144, 1, 0], [1344, 1, 0], [1544, 0, 1], [1664, 1, 0], [1864, 0, 1], [2224, 0, 1], [2384, 1, 0], [2584, 0, 1]],
      lows: [[221, 227, 0, 1], [261, 267, 1, 0], [421, 427, 1, 0], [541, 547, 1, 0], [821, 827, 1, 0], [1421, 1427, 1, 0], [1821, 1827, 1, 0], [2021, 2027, 1, 0], [2261, 2267, 1, 0]],
      hands: [[350, 1], [670, 0], [950, 0], [1070, 1], [1270, 0], [1630, 0], [1990, 0], [2190, 1], [2350, 0]],
      crows: [[401, 0, 2.6], [801, 1, 2.6], [841, 0, 2.6], [1241, 1, 2.6], [1601, 1, 2.6], [1681, 0, 2.6], [1961, 1, 2.6], [2081, 0, 2.6], [2441, 0, 2.6], [2561, 1, 2.6]],
      blocks: [[560, 592, 0], [960, 992, 1], [1360, 1392, 0], [1760, 1792, 1], [2160, 2192, 0]],
      lanterns: [
      [164, 0], [244, 0], [204, 1], [284, 1], [364, 0], [444, 0], [644, 0], [764, 0],
      [844, 0], [804, 1], [884, 1], [964, 0], [1044, 0], [1164, 0], [1244, 0], [1444, 0],
      [1404, 1], [1484, 1], [1564, 0], [1644, 0], [1764, 0], [1844, 0], [1964, 0], [2044, 0],
      [2004, 1], [2084, 1], [2244, 0], [2364, 0], [2444, 0], [2564, 0], [2604, 1],
      ],
      fog: [[560, 700], [1160, 1300], [1760, 1900], [2290, 2430]],
      checks: [480, 880, 1280, 1680, 2080, 2480],
    },
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
  // The Gardener's Revenge, the Grounds' BONUS ROUND (see ghoul-mower.js and ghoul-bonus.js): a ride, not a
  // walk. YOU ride the gardener's rusty ride-on mower down one long straight run through the overgrown
  // lawn, about 65 seconds of it at 32 a second: 8 gnomes, wheelbarrows and flowerpots and 8 thorn hedges
  // to jump, 8 hedge arches and clothes lines of ghostly gloves to duck, 4 ponds and 3 ha-ha ditches to
  // jump, 5 snapping topiary beasts to shoot, and the twist: hold fire and the blades cut the tall grass,
  // the weed patches and the thorn hedges ahead (the blades overheat and jam, so you pulse them). Five
  // checkpoints, then the lawn's end where the door is. Five hearts of its own. The numbers are generated:
  // a slot every 52 units from 80 to 1900 holds one obstacle, the grass and weeds lie between.
  room("mower", "The Gardener's Revenge", "The lawn has not been mowed since 1893", {
    length: 2120,
    ground: [[0, 30, 12], [2000, 2120, 12]],
    start: 8,
    key: null,
    door: 2110,
    bonus: true,
    dark: false,
    candy: [
      [76, 20, 1], [80, 21.5, 1], [84, 20, 1], [100, 13.8, 1], [152, 13.8, 1], [204, 13.8, 1], [232, 20, 1], [236, 21.5, 1],
      [240, 20, 1], [256, 13.8, 1], [288, 20, 1], [308, 13.8, 1], [336, 20, 1], [340, 21.5, 1], [344, 20, 1], [360, 13.8, 1],
      [412, 13.8, 1], [464, 13.8, 1], [492, 20, 1], [496, 21.5, 1], [500, 20, 1], [516, 13.8, 1], [548, 20, 1], [568, 13.8, 1],
      [620, 13.8, 1], [672, 13.8, 1], [700, 20, 1], [704, 21.5, 1], [708, 20, 1], [724, 13.8, 1], [752, 20, 1], [756, 21.5, 1],
      [760, 20, 1], [776, 13.8, 1], [808, 20, 1], [828, 13.8, 1], [880, 13.8, 1], [932, 13.8, 1], [960, 20, 1], [964, 21.5, 1],
      [968, 20, 1], [984, 13.8, 1], [1012, 20, 1], [1016, 21.5, 1], [1020, 20, 1], [1036, 13.8, 1], [1068, 20, 1], [1088, 13.8, 1],
      [1140, 13.8, 1], [1192, 13.8, 1], [1220, 20, 1], [1224, 21.5, 1], [1228, 20, 1], [1244, 13.8, 1], [1276, 20, 1], [1296, 13.8, 1],
      [1324, 20, 1], [1328, 21.5, 1], [1332, 20, 1], [1348, 13.8, 1], [1400, 13.8, 1], [1452, 13.8, 1], [1480, 20, 1], [1484, 21.5, 1],
      [1488, 20, 1], [1504, 13.8, 1], [1536, 20, 1], [1556, 13.8, 1], [1584, 20, 1], [1588, 21.5, 1], [1592, 20, 1], [1608, 13.8, 1],
      [1660, 13.8, 1], [1712, 13.8, 1], [1740, 20, 1], [1744, 21.5, 1], [1748, 20, 1], [1764, 13.8, 1], [1816, 13.8, 1], [1868, 13.8, 1],
      [1900, 20, 1], [1920, 13.8, 1], [1946, 13.8, 1], [1972, 13.8, 1],
    ],
    items: [["rapid", 366, 15.5], ["garlic", 730, 15.5], ["cocoa", 1094, 15.5], ["spread", 1510, 15.5]],
    spawns: [],
    horde: [],
    ride: {
      runner: "mower",
      time: 105000,
      finish: 2000,
      how: "UP to jump, DOWN to duck, hold space to shoot and mow",
      track: [
        [[0, 12], [282.5, 12]], [[293.5, 12], [544, 12]],
        [[552, 12], [802.5, 12]], [[813.5, 12], [1064, 12]],
        [[1072, 12], [1270.5, 12]], [[1281.5, 12], [1532, 12]],
        [[1540, 12], [1894.5, 12]], [[1905.5, 12], [2000, 12]],
      ],
      gaps: [0, 1, 0, 1, 0, 1, 0],
      junk: [[80, 0], [236, 1], [496, 2], [756, 0], [964, 2], [1224, 1], [1484, 0], [1744, 2]],
      lows: [[181, 187, 15, 0], [439, 449, 15, 1], [649, 655, 15, 0], [907, 917, 15, 1], [1169, 1175, 15, 0], [1427, 1437, 15, 1], [1689, 1695, 15, 0], [1791, 1801, 15, 1]],
      hedges: [132, 392, 600, 860, 1120, 1380, 1640, 1848],
      beasts: [340, 704, 1016, 1328, 1588],
      grass: [
        [36, 58], [100, 112], [152, 171], [204, 219], [256, 278], [308, 326],
        [360, 374], [412, 433], [464, 481], [516, 529], [568, 588], [620, 636],
        [672, 684], [724, 743], [776, 791], [828, 850], [880, 898], [932, 946],
        [984, 1005], [1036, 1053], [1088, 1101], [1140, 1160], [1192, 1208], [1244, 1256],
        [1296, 1315], [1348, 1363], [1400, 1422], [1452, 1470], [1504, 1518], [1556, 1577],
        [1608, 1625], [1660, 1673], [1712, 1732], [1764, 1780], [1816, 1828], [1868, 1887],
        [1920, 1935], [1915, 1985],
      ],
      weeds: [144, 248, 352, 456, 560, 664, 768, 872, 976, 1080, 1184, 1288, 1392, 1496, 1600, 1704, 1808, 1912],
      checks: [418, 782, 1146, 1510, 1822],
    },
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
  // Holy Roller, the Chapel's BONUS ROUND (see ghoul-pew.js and ghoul-bonus.js): an endless-runner, seen from
  // behind. YOU surf a runaway church pew down the nave's aisle in three lanes, faster and faster for about 66
  // seconds: change lane, jump the low things, slide under the high ones, shoot the gargoyles (or ring a bell rope
  // to stun them) and gather the wax souls for a combo. The course is written in ghoul-pew-course.js (seconds,
  // laid by the speed ramp) and the whole field is drawn by the Chapel's own pseudo-3D art, so this room's
  // ground is only the floor under the distance run and the door Planny steps to at the finish. Five hearts of its own.
  room("pew", "Holy Roller", "The organist has been waiting for YOU", {
    length: COURSE.finish + 60,
    ground: [[0, COURSE.finish + 60, 12]],
    start: 8,
    key: null,
    door: COURSE.finish + 30,
    bonus: true,
    dark: false,
    candy: [],
    items: [],
    spawns: [],
    horde: [],
    ride: {
      runner: "pew",
      time: 110000,
      finish: COURSE.finish,
      how: "LEFT/RIGHT change lane, UP jump, DOWN slide, hold space to shoot",
      items: COURSE.items,
      souls: COURSE.souls,
      checks: COURSE.checks,
    },
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
  // Code Blue, Blackmoor Sanatorium's BONUS ROUND (see ghoul-gurney.js and ghoul-bonus.js): a ride, not a
  // walk. YOU lie strapped to a runaway hospital gurney that flies down the sanatorium's endless corridors
  // and ramps, about 67 seconds of it at 48 a second: eight corridors joined by seven elevator shafts to jump,
  // 8 wheelchairs (they roll at you) and 7 IV stands to jump, 11 hanging surgical lamps and swinging doors to duck,
  // 11 orderlies who lunge from doorways (jump or shoot), seven checkpoints, and a loading ramp at the end that
  // launches the gurney out of the ambulance doors onto the bay where the door is. Five hearts of its own.
  // The twist is the lights: 6 blackouts, each announced by a flicker and a 3, 2, 1, then pitch black (only the
  // flashlight cone, the dying emergency strips and a faint glow on what is near), unless the buzzing surge lamp
  // hung high before it is shot out from the air (no low hangs in the 80 before a lamp: room to hop). The numbers are generated.
  room("codeblue", "Code Blue", "Please remain calm. The gurney will not", {
    length: 3294,
    ground: [[0, 30, 20.6], [3216, 3294, 10]],
    start: 8,
    key: null,
    door: 3284,
    bonus: true,
    dark: false,
    candy: [],
    items: [],
    spawns: [],
    horde: [],
    ride: {
      runner: "codeblue",
      time: 100000,
      finish: 3216,
      how: "UP to jump, DOWN to duck, hold space to shoot",
      track: [
        [[0, 22], [75, 22], [108, 17], [194, 17], [226, 22], [312, 22], [339, 18], [370, 18]],
        [[382, 16], [476, 16], [508, 12], [639, 12], [673, 18], [745, 18], [762, 18]],
        [[776, 15], [849, 15], [910, 24], [1024, 24], [1078, 17], [1160, 17]],
        [[1173, 13], [1298, 13], [1330, 17], [1407, 17], [1459, 25], [1531, 25], [1561, 25]],
        [[1576, 23], [1696, 23], [1762, 15], [1871, 15], [1898, 19], [1968, 19]],
        [[1980, 16], [2067, 16], [2121, 24], [2250, 24], [2279, 29], [2376, 29]],
        [[2390, 28], [2483, 28], [2539, 20], [2633, 20], [2681, 27], [2770, 27], [2788, 27]],
        [[2804, 22], [2904, 22], [2958, 14], [3048, 14], [3074, 19], [3110, 19], [3180, 11.6], [3206, 18.8]],
      ],
      chairs: [[288, 0], [445, 1], [996, 2], [1227, 3], [1275, 3], [1828, 4], [2454, 6], [3021, 7]],
      stands: [[236, 0], [511, 1], [683, 1], [1103, 2], [1901, 4], [2704, 6], [2856, 7]],
      lows: [[48.8, 55.2, 25, 1], [122, 128.4, 20, 0], [556.6, 563, 15, 0], [620.8, 627.2, 15, 1], [1336.8, 1343.2, 20, 0], [1466.6, 1473, 28, 1], [1502.8, 1509.2, 28, 1], [1673.6, 1680, 26, 1], [2034.8, 2041.2, 19, 1], [2601.4, 2607.8, 23, 0], [3082, 3088.4, 22, 1]],
      orderlies: [[840, 2], [913, 2], [948, 2], [1404, 3], [1628, 4], [1780, 4], [2133, 5], [2212, 5], [2283, 5], [2550, 6], [2966, 7]],
      lamps: [[350, 0], [830, 2], [1310, 3], [1770, 4], [2250, 5], [2730, 6]],
      waves: [[420, 590], [900, 1080], [1380, 1570], [1840, 2040], [2320, 2530], [2800, 3000]],
      checks: [390, 784, 1181, 1584, 1988, 2398, 2812],
    },
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
  // The Torch Mob, Hollow End Village's BONUS ROUND (see ghoul-wagon.js and ghoul-bonus.js): a ride, not a
  // walk. Planny steals a hay wagon and races out of the village down the cobbled road and over the old stone
  // bridge, about 68 seconds of it at 42 a second, a torch-and-pitchfork mob on his heels: 7 barrels and crates
  // to jump, 6 washing lines and inn signs to duck, 4 ditches and the collapsed bridge (off its ramp) to jump,
  // 9 villagers who hurl pitchforks (duck) and torches (jump) from windows and roofs, any of them to shoot, 2
  // spooked horses, seven checkpoints and a lip off the end onto the green. The mob's gap is the twist (the
  // brake and the hits close it, clean riding and shot torches open it). Five hearts of its own. No candy and no pickups.
  room("wagon", "Torch Mob", "Hollow End sends its regards. Loudly", {
    length: 2990,
    ground: [[0, 40, 14], [2880, 2990, 7]],
    start: 34,
    key: null,
    door: 2980,
    bonus: true,
    dark: false,
    candy: [],
    items: [],
    spawns: [],
    horde: [],
    ride: {
      runner: "wagon",
      time: 105000,
      finish: 2880,
      how: "UP to jump, DOWN to duck (it slows you), hold space to shoot",
      bridge: [2236, 2730],
      track: [
        [[0, 16], [376, 16]],
        [[384, 16], [880, 16]],
        [[888, 16], [1370, 16]],
        [[1378, 16], [1940, 16]],
        [[1948, 16], [2236, 16], [2330, 22], [2552, 22], [2576, 29.2]],
        [[2602, 23], [2690, 23], [2760, 16], [2866, 16], [2880, 19.92]],
      ],
      blocks: [[133,0,0], [303,0,1], [673,1,0], [1173,2,1], [1673,3,0], [2153,4,1], [2803,5,0]],
      lows: [[210,216,19,0], [584,590,19,1], [978,984,19,0], [1470,1476,19,1], [1860,1866,19,0], [2652,2658,26,1]],
      throwers: [[520,1,0], [790,1,1], [1290,2,0], [1590,3,1], [2080,4,0], [2330,4,1], [2400,4,0], [2490,4,1], [2730,5,0]],
      horses: [[1100,2], [1790,3]],
      surge: [[2330, 2540, 6]],
      checks: [460, 830, 1230, 1640, 2000, 2270, 2690],
    },
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
  // Gallows Bog: a sunken boardwalk over the mire. Rotting planks with gaps,
  // boards that give way, and mud that grabs you in the dips. The stage's own
  // kinds: lurkers' eyes in the mud, leech swarms in the wet, wisps to lure
  // the dead onto you and bog bodies risen from the muck; Stilt Boots and the
  // Harpoon are placed before what they answer.
  room("boardwalk", "Sunken Boardwalk", "Mind the gaps. Something lives in them", {
    length: 480,
    ground: [[0, 90, 6], [100, 180, 6], [190, 262, 6], [262, 268, 8.5], [268, 320, 11], [330, 402, 6], [410, 480, 6]],
    mud: [[24, 84], [118, 172], [342, 396]],
    shelves: [[40, 56, 11], [140, 156, 15], [200, 216, 15], [236, 252, 24], [240, 248, 15], [344, 360, 15], [372, 388, 15, "crumble"], [420, 436, 15]],
    key: [244, 24],
    door: 470,
    candy: [[18, 8.5, 4], [41, 14, 3], [102, 8.5, 4], [141, 18, 3], [201, 18, 3], [237, 27, 3], [282, 13.5, 4], [345, 18, 3], [412, 8.5, 4], [421, 18, 3]],
    items: [["boots", 20, 6], ["wings", 60, 6], ["harpoon", 128, 6], ["spread", 148, 15], ["garlic", 208, 15], ["rocket", 350, 6]],
    sky: [["crystal", 238, 44], ["crystal", 244, 46], ["crystal", 250, 44]],
    spawns: [["lurker", 40], ["leech", 60], ["lurker", 140], ["leech", 155], ["bogbody", 174], ["wisp", 210, 14], ["door", 214, 2, 1800, "bogbody"], ["bogbody", 290], ["lurker", 356], ["leech", 375], ["wisp", 400, 14]],
    horde: ["leech", "wisp", "bogbody"],
    hordeMs: 2600,
  }),
  // Cypress Hollow: shallow pools of black water beside the mud, moss-veiled
  // boards, a little harder.
  room("hollow", "Cypress Hollow", "The moss is breathing", {
    length: 520,
    ground: [[0, 120, 6], [120, 126, 8.5], [126, 200, 11], [200, 206, 8.5], [206, 300, 6], [310, 404, 6], [404, 410, 8.5], [410, 446, 11], [454, 520, 6]],
    water: [[22, 78], [216, 286]],
    mud: [[90, 114], [322, 396], [460, 510]],
    shelves: [[30, 46, 11], [96, 112, 15], [140, 156, 17], [162, 178, 17, "crumble"], [226, 242, 15], [250, 266, 24], [262, 278, 15], [330, 346, 15], [356, 372, 15], [386, 402, 15, "crumble"], [420, 436, 17], [466, 482, 15]],
    key: [258, 24],
    door: 510,
    candy: [[18, 8.5, 4], [31, 14, 3], [97, 18, 3], [141, 20, 3], [208, 8.5, 4], [227, 18, 3], [251, 27, 3], [331, 18, 3], [357, 18, 3], [412, 13.5, 4], [421, 20, 3], [467, 18, 3]],
    items: [["wings", 40, 6], ["boots", 86, 6], ["lantern", 104, 15], ["spread", 232, 15], ["harpoon", 312, 6], ["hourglass", 428, 17]],
    sky: [["crystal", 252, 44], ["silver", 258, 46], ["crystal", 264, 44]],
    spawns: [["leech", 40], ["lurker", 100], ["wisp", 150, 16], ["bogbody", 200], ["leech", 250], ["door", 336, 3, 1500, "bogbody"], ["lurker", 340], ["wisp", 430, 16], ["bogbody", 470], ["leech", 485]],
    horde: ["leech", "bogbody", "wisp"],
    hordeMs: 2300,
  }),
  // Stilt House: the hag's house on stilts, its floors stacked shelves over
  // the swamp. The hardest of the three.
  room("stilts", "Stilt House", "She has been expecting you", {
    length: 560,
    ground: [[0, 140, 6], [150, 236, 6], [236, 242, 8.5], [242, 248, 11], [248, 254, 13.5], [254, 330, 16], [330, 336, 13.5], [336, 342, 11], [342, 348, 8.5], [348, 430, 6], [438, 560, 6]],
    water: [[160, 230]],
    mud: [[30, 132], [356, 424], [446, 540]],
    shelves: [[20, 36, 11], [56, 72, 15], [100, 116, 15, "crumble"], [160, 176, 15], [196, 212, 15], [266, 282, 22], [292, 308, 24], [358, 374, 15], [400, 416, 15], [462, 478, 15], [500, 516, 17], [520, 536, 17, "crumble"]],
    key: [300, 24],
    door: 550,
    candy: [[18, 8.5, 4], [57, 18, 3], [101, 18, 3], [161, 18, 3], [197, 18, 3], [266, 25, 3], [293, 27, 3], [359, 18, 3], [401, 18, 3], [440, 8.5, 4], [463, 18, 3], [501, 20, 3]],
    items: [["wings", 60, 6], ["rapid", 168, 15], ["dyn", 204, 15], ["boots", 350, 6], ["harpoon", 380, 6], ["garlic", 404, 15], ["rocket", 508, 17]],
    sky: [["crystal", 296, 44], ["crystal", 302, 46], ["crystal", 308, 44]],
    spawns: [["lurker", 70], ["wisp", 140, 16], ["leech", 190], ["bogbody", 240], ["lurker", 390], ["door", 412, 3, 1400, "bogbody"], ["wisp", 460, 16], ["bogbody", 480], ["leech", 500]],
    horde: ["bogbody", "leech"],
    hordeMs: 2000,
  }),
  // The Bog Runner, Gallows Bog's BONUS ROUND: a fan-boat skim over black
  // water with a leech swarm in its wake. A ride, not a walk; the course is
  // from a one-off hash generator (no random draws), the rules are in
  // ghoul-bogboat.js.
  room("bogboat", "The Bog Runner", "Something swims in your wake", {
    length: 2400,
    ground: [[0, 2400, 9]],
    start: 8,
    key: null,
    door: 2390,
    bonus: true,
    dark: false,
    candy: [
      [14, 11.5, 4], [140, 11.6, 3], [144, 11.6, 3], [180, 17.5, 3], [210, 11.6, 3], [216, 10.4, 3], [216, 17.6, 3], [240, 17.6, 3],
      [252, 17.5, 3], [280, 11.6, 3], [344, 10.4, 3], [344, 23.5, 3], [350, 11.6, 3], [380, 10.4, 3], [380, 17.6, 3], [416, 10.4, 3],
      [416, 17.6, 3], [420, 11.6, 3], [450, 17.6, 3], [452, 17.5, 3], [452, 17.6, 3], [490, 11.6, 3], [544, 17.5, 3], [544, 17.6, 3],
      [560, 11.6, 3], [580, 17.5, 3], [580, 17.6, 3], [616, 11.6, 3], [616, 17.6, 3], [630, 11.6, 3], [652, 17.5, 3], [652, 17.6, 3],
      [660, 17.6, 3], [700, 11.6, 3], [744, 17.5, 3], [744, 17.6, 3], [770, 11.6, 3], [780, 11.6, 3], [780, 16.4, 3], [816, 10.4, 3],
      [816, 17.6, 3], [840, 11.6, 3], [852, 10.4, 3], [852, 17.6, 3], [870, 17.6, 3], [910, 11.6, 3], [944, 10.4, 3], [944, 16.4, 3],
      [980, 11.6, 3], [980, 23.5, 3], [980, 11.6, 3], [1016, 10.4, 3], [1016, 16.4, 3], [1050, 11.6, 3], [1052, 17.5, 3], [1052, 17.6, 3],
      [1080, 17.6, 3], [1120, 11.6, 3], [1144, 11.6, 3], [1144, 17.6, 3], [1180, 11.6, 3], [1180, 17.6, 3], [1190, 11.6, 3], [1216, 17.6, 3],
      [1252, 17.5, 3], [1252, 17.6, 3], [1260, 11.6, 3], [1290, 17.6, 3], [1330, 11.6, 3], [1344, 11.6, 3], [1344, 23.5, 3], [1380, 23.5, 3],
      [1400, 11.6, 3], [1416, 17.5, 3], [1416, 23.5, 3], [1452, 10.4, 3], [1452, 16.4, 3], [1470, 11.6, 3], [1500, 17.6, 3], [1540, 11.6, 3],
      [1544, 17.5, 3], [1544, 17.6, 3], [1580, 17.5, 3], [1610, 11.6, 3], [1616, 10.4, 3], [1616, 17.6, 3], [1652, 17.5, 3], [1680, 11.6, 3],
      [1710, 17.6, 3], [1744, 11.6, 3], [1744, 17.6, 3], [1750, 11.6, 3], [1780, 11.6, 3], [1816, 17.5, 3], [1816, 17.6, 3], [1820, 11.6, 3],
      [1852, 10.4, 3], [1852, 17.6, 3], [1890, 11.6, 3], [1920, 17.6, 3], [1944, 17.5, 3], [1944, 17.6, 3], [1960, 11.6, 3], [1980, 17.5, 3],
      [1980, 23.5, 3], [2016, 17.5, 3], [2030, 11.6, 3], [2052, 10.4, 3], [2052, 23.5, 3], [2100, 11.6, 3], [2130, 17.6, 3], [2144, 10.4, 3],
      [2144, 23.5, 3], [2170, 11.6, 3], [2180, 11.6, 3], [2180, 16.4, 3], [2216, 11.6, 3], [2216, 17.6, 3], [2240, 11.6, 3], [2252, 10.4, 3],
      [2252, 23.5, 3], [2330, 11.5, 4],
    ],
    spawns: [],
    horde: [],
    ride: {
      runner: "bogboat",
      how: "LEFT or RIGHT at a bank: switch lane. UP jump, DOWN duck, SPACE shoot",
      time: 100000,
      finish: 2320,
      checks: [480, 960, 1440, 1920],
      banks: [[90, 106], [290, 306], [490, 506], [690, 706], [890, 906], [1090, 1106], [1290, 1306], [1490, 1506], [1690, 1706], [1890, 1906], [2090, 2106]],
      snags: [[180, 0], [452, 0], [580, 0], [744, 0], [980, 1], [1052, 0], [1252, 0], [1344, 1], [1416, 0], [1416, 1], [1580, 0], [1652, 0], [1980, 0], [2052, 1], [2144, 1], [2252, 1]],
      knees: [[252, 0], [344, 1], [544, 0], [652, 0], [1380, 1], [1544, 0], [1816, 0], [1944, 0], [1980, 1], [2016, 0]],
      veils: [[340, 348, 0], [776, 784, 1], [848, 856, 0], [940, 948, 0], [940, 948, 1], [1448, 1456, 0], [1448, 1456, 1], [1848, 1856, 0], [2048, 2056, 0], [2140, 2148, 0], [2176, 2184, 1], [2248, 2256, 0]],
      limbs: [[213, 219, 0], [377, 383, 0], [413, 419, 0], [813, 819, 0], [1013, 1019, 0], [1013, 1019, 1], [1613, 1619, 0]],
      props: [[144, 0, 0], [544, 1, 0], [580, 1, 1], [616, 0, 1], [616, 1, 0], [780, 0, 1], [816, 1, 0], [1052, 1, 0], [1144, 0, 1], [1144, 1, 0], [1180, 0, 1], [1180, 1, 1], [1344, 0, 0], [1744, 0, 1], [1780, 0, 0], [1944, 1, 1]],
      gas: [[216, 1], [380, 1], [416, 1], [452, 1], [652, 1], [744, 1], [852, 1], [980, 0], [1216, 1], [1252, 1], [1544, 1], [1616, 1], [1744, 1], [1816, 1], [1852, 1], [2180, 0], [2216, 0], [2216, 1]],
    },
  }),
  // The Drowning Pool, Gallows Bog's boss room: planks over open black
  // water, the hag's arena. Old Mother Bog's fight lands with the pack's
  // boss rules in Phase 2; `dark` is left to the roll.
  room("drowning", "The Drowning Pool", "Keep to the planks, she owns the water", {
    length: 200,
    ground: [[0, 60, 6], [68, 132, 6], [140, 200, 6]],
    shelves: [[112, 124, 12], [132, 146, 18], [160, 172, 12], [150, 162, 18]],
    key: null,
    door: 194,
    candy: [[18, 8.5, 5], [70, 8.5, 5]],
    items: [["garlic", 24, 6]],
    spawns: [["zombie", 44], ["crawl", 96]],
    boss: "motherbog",
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
  stage("manor", "The Manor", "Where the screaming started", ["foyer", "gallery", "library", "banister", "ballroom"]),
  stage("wing", "The East Wing", "The servants never left", ["kitchen", "conservatory", "attic", "tray", "crypt"]),
  stage("graveyard", "The Graveyard", "Everyone here was buried in a hurry", ["lychgate", "graves", "mausoleums", "hearse", "angel"]),
  stage("grounds", "The Grounds", "The gardener never stopped working", ["maze", "topiary", "gazebo", "mower", "yard"]),
  stage("chapel", "The Chapel", "Service is still in session", ["nave", "tower", "loft", "pew", "choir"]),
  stage("sanatorium", "Blackmoor Sanatorium", "Visiting hours ended in 1912", ["admissions", "baths", "theater", "codeblue", "ward"]),
  stage("village", "Hollow End Village", "Every curtain twitches as you pass", ["street", "inn", "square", "wagon", "green"]),
  stage("mine", "The Deep Seam Mine", "They are still knocking", ["shaft", "tunnels", "collapse", "cart", "seam"]),
  stage("carnival", "The Midnight Carnival", "Every game is rigged in its favor", ["midway", "mirrors", "funhouse", "darkride", "bigtop"]),
  stage("frozen", "The Frozen Lake", "The ice remembers who fell through", ["huts", "lodge", "blackice", "sled", "widow"]),
  stage("bog", "Gallows Bog", "The mud does not like to let go", ["boardwalk", "hollow", "stilts", "bogboat", "drowning"]),
]);
export const stageById = (id) => STAGES.find((s) => s.id === id) || null;
