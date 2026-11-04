// Plan2Code Web Console - the tones: short synthesized blips for the activities, silent when Play sounds is off; defines only.

import { looks } from "./looks.js";
import snakeSfx from "./activities/snake-sfx.js";
import golfSfx from "./activities/golf-sfx.js";
import trailsSfx from "./activities/trails-sfx.js";
import bugsSfx from "./activities/bugs-sfx.js";
import driveSfx from "./activities/drive-sfx.js";
import stackSfx from "./activities/stack-sfx.js";
import bumperSfx from "./activities/bumper-sfx.js";
import rapidsSfx from "./activities/rapids-sfx.js";
import fuseSfx from "./activities/fuse-sfx.js";
import hopSfx from "./activities/hop-sfx.js";
import bounceSfx from "./activities/bounce-sfx.js";
import ghoulSfx from "./activities/ghoul-rush/sfx/ghoul-sfx.js";

/* ------------------------------------------------------------- tones

   Blips made in the browser, so there is no audio file to fetch. They are
   not the main sounds in sound.js: the master Play sounds switch gates them,
   and they have no switch of their own and no queue. A browser will not
   make noise before the person has touched the page, so unlockTones() runs
   from the click that opens Activities. A tone asked for before that stays
   silent rather than throwing.

   Every sound here is short (a quarter second at most) and quiet, so a cue
   never outlasts the moment it belongs to. A tone either sweeps from one
   pitch to another, or plays `notes` one after another in its time. */
const BLIPS = Object.freeze({
  eat: Object.freeze({ type: "triangle", from: 660, to: 880, seconds: 0.12 }),
  crash: Object.freeze({ type: "sawtooth", from: 220, to: 80, seconds: 0.2 }),
  // The 3, 2, 1 before a round starts or plays on: a tick per number, then a
  // higher one as play begins.
  count: Object.freeze({ type: "sine", from: 440, to: 440, seconds: 0.08 }),
  go: Object.freeze({ type: "sine", from: 880, to: 880, seconds: 0.14 }),
  // Mini golf: the club on the ball, the ball off a wall or a bumper, into
  // the cup, a hole in one (a little three-note rise), and into the water.
  putt: Object.freeze({ type: "triangle", from: 520, to: 400, seconds: 0.06 }),
  wall: Object.freeze({ type: "triangle", from: 300, to: 200, seconds: 0.07 }),
  bump: Object.freeze({ type: "sine", from: 700, to: 1000, seconds: 0.09 }),
  cup: Object.freeze({ type: "triangle", from: 520, to: 1040, seconds: 0.16 }),
  ace: Object.freeze({ type: "triangle", notes: Object.freeze([523, 659, 784]), seconds: 0.24 }),
  splash: Object.freeze({ type: "sine", from: 420, to: 120, seconds: 0.2 }),
  // Mini golf's gags: a power-up grabbed (a sparkly rise), a tunnel's whoosh,
  // a cannonball putt, the ball into lava, and the ball down the pit.
  power: Object.freeze({ type: "square", notes: Object.freeze([784, 988, 1319]), seconds: 0.18 }),
  tunnel: Object.freeze({ type: "sine", from: 200, to: 900, seconds: 0.16 }),
  boom: Object.freeze({ type: "sawtooth", from: 160, to: 45, seconds: 0.22 }),
  sizzle: Object.freeze({ type: "sawtooth", from: 900, to: 300, seconds: 0.2 }),
  fall: Object.freeze({ type: "sine", from: 700, to: 60, seconds: 0.25 }),
  // Mini golf's swing: the meter starting, a putt caught in the MAX band (a
  // bright two-note hit), and an overswing's sour buzz.
  swing: Object.freeze({ type: "square", from: 620, to: 660, seconds: 0.04 }),
  max: Object.freeze({ type: "square", notes: Object.freeze([880, 1320]), seconds: 0.16 }),
  shank: Object.freeze({ type: "sawtooth", from: 240, to: 110, seconds: 0.18 }),
  // Snake's extras: a combo's quick chirp, a coin, a mystery box opening, a
  // new level (a four-note climb), a shield taking a hit, a comet cutting
  // the tail, and a new best mid-round. A grabbed power-up uses `power`, a
  // smashed rock `boom` and a portal `tunnel`.
  combo: Object.freeze({ type: "square", from: 880, to: 1320, seconds: 0.07 }),
  coin: Object.freeze({ type: "square", notes: Object.freeze([988, 1319]), seconds: 0.1 }),
  mystery: Object.freeze({ type: "triangle", notes: Object.freeze([392, 523, 466, 698]), seconds: 0.24 }),
  levelup: Object.freeze({ type: "square", notes: Object.freeze([523, 659, 784, 1047]), seconds: 0.25 }),
  shield: Object.freeze({ type: "sine", from: 1200, to: 500, seconds: 0.14 }),
  zap: Object.freeze({ type: "sawtooth", from: 1400, to: 200, seconds: 0.15 }),
  best: Object.freeze({ type: "triangle", notes: Object.freeze([784, 988, 1175, 1568]), seconds: 0.25 }),
  // Stack Deploy: a block landing (a low thunk), the overhang sliced off,
  // and a perfect drop's chime. The game pitches the thunk and the chime up
  // a step of a scale for each perfect in a row.
  thunk: Object.freeze({ type: "triangle", from: 240, to: 110, seconds: 0.1 }),
  slice: Object.freeze({ type: "square", from: 560, to: 280, seconds: 0.06 }),
  perfect: Object.freeze({ type: "triangle", notes: Object.freeze([660, 990]), seconds: 0.14 }),
  // Bumper Ring: two cars meeting (a short thud the game pitches up and
  // makes louder the harder the hit) and a rival revving up a dash.
  ram: Object.freeze({ type: "square", from: 190, to: 70, seconds: 0.09 }),
  rev: Object.freeze({ type: "sawtooth", from: 90, to: 260, seconds: 0.18 }),
  // Hot Potato: the fuse's tick (the game ticks it quicker and pitches it
  // up as the fuse burns down) and the pop of the bomb changing hands.
  tick: Object.freeze({ type: "square", from: 1500, to: 1100, seconds: 0.03 }),
  pop: Object.freeze({ type: "sine", from: 480, to: 1400, seconds: 0.07 }),
  // Crossing Rush: a hop (the game pitches it up a step for each quick hop
  // forward in a row), the boing of being sent back, a crossing's bell while
  // a train is coming, and the Horn.
  hop: Object.freeze({ type: "triangle", from: 520, to: 780, seconds: 0.05 }),
  boing: Object.freeze({ type: "sine", from: 260, to: 720, seconds: 0.2 }),
  bell: Object.freeze({ type: "triangle", notes: Object.freeze([1320, 990]), seconds: 0.16 }),
  horn: Object.freeze({ type: "square", notes: Object.freeze([370, 466]), seconds: 0.22 }),
  // Bounce Road: the engine's hum (a soft, low blip the game plays every few
  // frames while you pick up speed, pitched up with your speed: a triangle,
  // since a sawtooth blipped that often is a buzz), a jump's spring (pitched
  // with your speed) and a rival flattened under your wheels (pitched up a
  // step for each in a chain); all soft triangles, never a buzz. A low
  // thump rumbles while your wheels run on the verge.
  beat: Object.freeze({ type: "sine", from: 95, to: 55, seconds: 0.11 }),
  engine: Object.freeze({ type: "triangle", from: 82, to: 90, seconds: 0.08 }),
  spring: Object.freeze({ type: "triangle", from: 330, to: 990, seconds: 0.14 }),
  squash: Object.freeze({ type: "triangle", from: 620, to: 150, seconds: 0.13 }),
  // Rapids Run: a shot (a short, soft triangle, since it repeats about seven
  // times a second while fire is held, and the game plays it quietly), a
  // charge buoy taken (a rising sine), the low battery's two-note beep (the
  // game beeps quicker the lower it runs), a dam bursting open (a low
  // triangle rumble) and a bank skimmed at speed (a quick sine whoosh the
  // game pitches up the more you have skimmed); all soft triangles and
  // sines, never a buzz.
  pew: Object.freeze({ type: "triangle", from: 1320, to: 880, seconds: 0.04 }),
  charge: Object.freeze({ type: "sine", from: 440, to: 1320, seconds: 0.14 }),
  lowcell: Object.freeze({ type: "sine", notes: Object.freeze([660, 440]), seconds: 0.16 }),
  dambreak: Object.freeze({ type: "triangle", from: 300, to: 60, seconds: 0.25 }),
  skim: Object.freeze({ type: "sine", from: 1500, to: 1800, seconds: 0.05 }),
  // Ghoul Rush: the flashlight blaster's bolt (a short, soft triangle, since
  // it repeats every 100 ms while fire is held; the game nudges its pitch a
  // little each time), a ghoul torn apart (pitched up a step for each kill
  // in the chain), a stomp's crunch, a ghost's moan, a boss's low roar, a
  // soul's thin whisper (pitched up for souls taken in quick succession), a
  // zombie groaning behind a wall door, a bat's screech, the key turning
  // (a minor rise), the door through to the next room (a falling minor
  // run), a board creaking (a crawler coming up, a chandelier or a crumbling
  // board about to go), a hellhound's growl, a wraith's shriek, a widow's
  // skitter, a bloater's wet spit, and thunder rolling outside.
  ghoulBlast: Object.freeze({ type: "triangle", from: 980, to: 620, seconds: 0.05 }),
  ghoulStomp: Object.freeze({ type: "sawtooth", from: 220, to: 70, seconds: 0.09 }),
  ghoulBoo: Object.freeze({ type: "sine", from: 330, to: 196, seconds: 0.25 }),
  ghoulRoar: Object.freeze({ type: "sawtooth", from: 120, to: 48, seconds: 0.25 }),
  ghoulCandy: Object.freeze({ type: "sine", from: 1480, to: 1760, seconds: 0.09 }),
  zombiePop: Object.freeze({ type: "sawtooth", from: 260, to: 60, seconds: 0.12 }),
  zombieGroan: Object.freeze({ type: "sawtooth", from: 110, to: 72, seconds: 0.25 }),
  batSwoop: Object.freeze({ type: "square", from: 2200, to: 1400, seconds: 0.08 }),
  doorUnlock: Object.freeze({ type: "triangle", notes: Object.freeze([494, 587, 740]), seconds: 0.2 }),
  doorThrough: Object.freeze({ type: "triangle", notes: Object.freeze([659, 587, 494, 440]), seconds: 0.25 }),
  creakBoard: Object.freeze({ type: "triangle", from: 180, to: 120, seconds: 0.18 }),
  ghoulGrowl: Object.freeze({ type: "sawtooth", from: 95, to: 70, seconds: 0.22 }),
  ghoulShriek: Object.freeze({ type: "sawtooth", from: 1900, to: 2600, seconds: 0.2 }),
  ghoulSkitter: Object.freeze({ type: "square", notes: Object.freeze([2400, 2100, 2500, 2200]), seconds: 0.1 }),
  ghoulSpit: Object.freeze({ type: "square", from: 340, to: 110, seconds: 0.1 }),
  ghoulThunder: Object.freeze({ type: "sawtooth", from: 70, to: 30, seconds: 0.25 }),
});

/* --------------------------------------------------------- rich tones

   The shared sound kit every game may borrow, richer than a single blip:
   a spec here may be `layers`, parts that play together (each its own
   `delay` and `gain`), and a part may be noise ("noise" is white, "pink"
   and "brown" darker) shaped by a `filter` ({ type, from, to, q }) that
   sweeps its cutoff, wobble with `vibrato` ({ rate, depth }, depth a share
   of the pitch) or swell in over `attack` seconds. Noise is what makes a
   crash, a splash, a skid or an explosion sound like one rather than like
   a beep. These run up to a second, still quiet, and a game's own extras
   live in its `activities/<id>-sfx.js` (merged in below). */
const part = (spec) => Object.freeze({ ...spec, ...(spec.notes ? { notes: Object.freeze(spec.notes) } : {}), ...(spec.filter ? { filter: Object.freeze(spec.filter) } : {}), ...(spec.vibrato ? { vibrato: Object.freeze(spec.vibrato) } : {}) });
const layered = (...parts) => Object.freeze({ layers: Object.freeze(parts.map(part)) });

const RICH = Object.freeze({
  // Hits, crashes and explosions.
  explode: layered(
    { type: "brown", seconds: 0.8, filter: { type: "lowpass", from: 2400, to: 90, q: 0.7 } },
    { type: "sine", from: 140, to: 32, seconds: 0.55, gain: 0.9 },
    { type: "noise", seconds: 0.12, gain: 0.35, filter: { type: "highpass", from: 3000, to: 1500 } },
  ),
  blast: layered(
    { type: "brown", seconds: 0.38, filter: { type: "lowpass", from: 1800, to: 140 } },
    { type: "sine", from: 110, to: 40, seconds: 0.26, gain: 0.8 },
  ),
  smash: layered(
    { type: "noise", seconds: 0.36, filter: { type: "bandpass", from: 1800, to: 500, q: 1.1 } },
    { type: "square", from: 180, to: 55, seconds: 0.2, gain: 0.45, filter: { type: "lowpass", from: 1400, to: 300 } },
    { type: "noise", seconds: 0.28, delay: 0.04, gain: 0.25, filter: { type: "highpass", from: 5000, to: 3000 } },
  ),
  thud: layered(
    { type: "sine", from: 130, to: 48, seconds: 0.14 },
    { type: "brown", seconds: 0.09, gain: 0.6, filter: { type: "lowpass", from: 500, to: 150 } },
  ),
  clank: layered(
    { type: "square", from: 820, to: 790, seconds: 0.08, gain: 0.45, filter: { type: "lowpass", from: 3000, to: 1500 } },
    { type: "triangle", from: 1230, to: 1210, seconds: 0.22, gain: 0.5 },
    { type: "noise", seconds: 0.04, gain: 0.4, filter: { type: "bandpass", from: 3200, to: 2600, q: 2 } },
  ),
  crunch: layered(
    { type: "noise", seconds: 0.18, filter: { type: "bandpass", from: 900, to: 280, q: 1.8 } },
    { type: "sawtooth", from: 150, to: 60, seconds: 0.12, gain: 0.4, filter: { type: "lowpass", from: 900, to: 200 } },
  ),
  squish: layered(
    { type: "noise", seconds: 0.13, filter: { type: "lowpass", from: 1600, to: 200, q: 3 } },
    { type: "sine", from: 420, to: 110, seconds: 0.11, gain: 0.6 },
  ),
  splat: layered(
    { type: "pink", seconds: 0.16, filter: { type: "bandpass", from: 1300, to: 380, q: 1.4 } },
    { type: "sine", from: 300, to: 85, seconds: 0.12, gain: 0.6 },
  ),
  hit: layered(
    { type: "square", from: 320, to: 120, seconds: 0.07, gain: 0.6, filter: { type: "lowpass", from: 2400, to: 600 } },
    { type: "noise", seconds: 0.05, gain: 0.5, filter: { type: "bandpass", from: 2200, to: 1400, q: 1.5 } },
  ),
  // Movement: air, tires and landings.
  whoosh: layered({ type: "pink", seconds: 0.3, attack: 0.08, filter: { type: "bandpass", from: 400, to: 2600, q: 1.4 } }),
  swoosh: layered({ type: "pink", seconds: 0.26, attack: 0.04, filter: { type: "bandpass", from: 2600, to: 450, q: 1.4 } }),
  skid: layered(
    { type: "noise", seconds: 0.38, attack: 0.02, filter: { type: "bandpass", from: 2300, to: 1700, q: 7 } },
    { type: "triangle", from: 1500, to: 1280, seconds: 0.34, gain: 0.25, vibrato: { rate: 31, depth: 0.02 } },
  ),
  brake: layered({ type: "noise", seconds: 0.3, attack: 0.03, filter: { type: "bandpass", from: 3100, to: 2500, q: 10 } }),
  zoom: layered(
    { type: "sawtooth", from: 240, to: 130, seconds: 0.5, attack: 0.2, gain: 0.5, filter: { type: "lowpass", from: 1100, to: 380 } },
    { type: "pink", seconds: 0.5, attack: 0.2, gain: 0.6, filter: { type: "bandpass", from: 900, to: 380, q: 1.2 } },
  ),
  jump: layered(
    { type: "triangle", from: 300, to: 760, seconds: 0.13 },
    { type: "pink", seconds: 0.12, gain: 0.3, filter: { type: "highpass", from: 1400, to: 2600 } },
  ),
  land: layered(
    { type: "sine", from: 170, to: 60, seconds: 0.1 },
    { type: "brown", seconds: 0.1, gain: 0.6, filter: { type: "lowpass", from: 700, to: 200 } },
  ),
  shift: layered(
    { type: "noise", seconds: 0.035, gain: 0.5, filter: { type: "bandpass", from: 2400, to: 2000, q: 3 } },
    { type: "square", from: 160, to: 140, seconds: 0.05, gain: 0.4, filter: { type: "lowpass", from: 900, to: 500 } },
  ),
  boost: layered(
    { type: "sawtooth", from: 110, to: 460, seconds: 0.48, gain: 0.6, filter: { type: "lowpass", from: 400, to: 3200, q: 4 } },
    { type: "pink", seconds: 0.48, gain: 0.45, filter: { type: "highpass", from: 1200, to: 4200 } },
  ),
  riser: layered(
    { type: "sawtooth", from: 200, to: 1200, seconds: 0.62, attack: 0.3, gain: 0.5, filter: { type: "lowpass", from: 600, to: 4200 } },
    { type: "noise", seconds: 0.62, attack: 0.3, gain: 0.35, filter: { type: "bandpass", from: 500, to: 4000, q: 1 } },
  ),
  honk: layered(
    { type: "square", from: 392, to: 388, seconds: 0.24, gain: 0.55, filter: { type: "lowpass", from: 1600, to: 1400 } },
    { type: "square", from: 494, to: 490, seconds: 0.24, gain: 0.55, filter: { type: "lowpass", from: 1600, to: 1400 } },
  ),
  trainHorn: layered(
    { type: "sawtooth", from: 311, to: 305, seconds: 0.85, attack: 0.05, gain: 0.4, filter: { type: "lowpass", from: 1500, to: 1200 } },
    { type: "sawtooth", from: 370, to: 364, seconds: 0.85, attack: 0.05, gain: 0.4, filter: { type: "lowpass", from: 1500, to: 1200 } },
    { type: "sawtooth", from: 466, to: 458, seconds: 0.85, attack: 0.05, gain: 0.3, filter: { type: "lowpass", from: 1500, to: 1200 } },
  ),
  rumble: layered({ type: "brown", seconds: 0.06, filter: { type: "lowpass", from: 320, to: 200 } }),
  rumbleLong: layered(
    { type: "brown", seconds: 1, attack: 0.2, filter: { type: "lowpass", from: 420, to: 160 } },
    { type: "sine", from: 52, to: 44, seconds: 1, attack: 0.2, gain: 0.6 },
  ),
  // Water.
  splashBig: layered(
    { type: "noise", seconds: 0.42, filter: { type: "bandpass", from: 3200, to: 700, q: 0.7 } },
    { type: "sine", from: 380, to: 95, seconds: 0.16, gain: 0.45 },
    { type: "pink", seconds: 0.3, delay: 0.08, gain: 0.35, filter: { type: "highpass", from: 2500, to: 1500 } },
  ),
  bubble: layered({ type: "sine", from: 300, to: 950, seconds: 0.06 }),
  slap: layered({ type: "pink", seconds: 0.15, filter: { type: "bandpass", from: 950, to: 480, q: 1.5 } }),
  // Rewards and the round.
  coinUp: layered(
    { type: "square", notes: [988, 1319], seconds: 0.11, gain: 0.55, filter: { type: "lowpass", from: 5000, to: 5000 } },
    { type: "triangle", from: 2637, to: 2637, seconds: 0.26, delay: 0.05, gain: 0.3 },
  ),
  sparkle: layered(
    { type: "triangle", notes: [1568, 2093, 2637, 3136], seconds: 0.22, gain: 0.5 },
    { type: "noise", seconds: 0.22, gain: 0.15, filter: { type: "highpass", from: 6000, to: 8000 } },
  ),
  powerUp: layered(
    { type: "square", notes: [523, 659, 784, 1047, 1319], seconds: 0.36, gain: 0.45, filter: { type: "lowpass", from: 3000, to: 3000 } },
    { type: "triangle", notes: [262, 330, 392, 523, 659], seconds: 0.36, gain: 0.6 },
  ),
  powerDown: layered(
    { type: "square", notes: [784, 659, 523, 392], seconds: 0.36, gain: 0.45, filter: { type: "lowpass", from: 2400, to: 1200 } },
  ),
  extraLife: layered(
    { type: "triangle", notes: [659, 784, 1319, 1047, 1175, 1568], seconds: 0.48 },
    { type: "square", notes: [330, 392, 659, 523, 587, 784], seconds: 0.48, gain: 0.25, filter: { type: "lowpass", from: 2000, to: 2000 } },
  ),
  fanfare: layered(
    { type: "square", notes: [523, 523, 523, 659, 784, 784], seconds: 0.6, gain: 0.4, filter: { type: "lowpass", from: 2600, to: 2600 } },
    { type: "triangle", notes: [262, 262, 262, 330, 392, 392], seconds: 0.6, gain: 0.7 },
  ),
  victory: layered(
    { type: "triangle", notes: [784, 988, 1175, 1568], seconds: 0.44 },
    { type: "square", notes: [392, 494, 587, 784], seconds: 0.44, gain: 0.3, filter: { type: "lowpass", from: 2400, to: 2400 } },
    { type: "noise", seconds: 0.3, delay: 0.3, gain: 0.12, filter: { type: "highpass", from: 7000, to: 9000 } },
  ),
  gameOver: layered(
    { type: "triangle", notes: [392, 370, 349, 330], seconds: 0.9 },
    { type: "sawtooth", notes: [196, 185, 175, 165], seconds: 0.9, gain: 0.35, filter: { type: "lowpass", from: 900, to: 500 } },
  ),
  lifeLost: layered(
    { type: "square", from: 520, to: 120, seconds: 0.42, gain: 0.6, vibrato: { rate: 12, depth: 0.04 }, filter: { type: "lowpass", from: 2000, to: 600 } },
  ),
  click: layered({ type: "square", from: 1200, to: 1150, seconds: 0.02, gain: 0.4 }),
  tickSoft: layered({ type: "noise", seconds: 0.025, filter: { type: "bandpass", from: 4200, to: 3800, q: 4 } }),
  warn: layered(
    { type: "square", notes: [880, 660, 880, 660], seconds: 0.42, gain: 0.5, filter: { type: "lowpass", from: 2000, to: 2000 } },
  ),
  // Sci-fi and combat.
  laser: layered(
    { type: "square", from: 1800, to: 280, seconds: 0.12, gain: 0.5, filter: { type: "lowpass", from: 4500, to: 1200 } },
    { type: "sawtooth", from: 900, to: 140, seconds: 0.12, gain: 0.3, filter: { type: "lowpass", from: 3000, to: 800 } },
  ),
  zapBig: layered(
    { type: "sawtooth", from: 2400, to: 80, seconds: 0.26, gain: 0.55, filter: { type: "lowpass", from: 5000, to: 600 } },
    { type: "noise", seconds: 0.2, gain: 0.4, filter: { type: "bandpass", from: 3000, to: 500, q: 1 } },
  ),
  shieldUp: layered(
    { type: "sine", from: 300, to: 1200, seconds: 0.32, vibrato: { rate: 18, depth: 0.05 } },
    { type: "triangle", from: 600, to: 2400, seconds: 0.32, gain: 0.3 },
  ),
  warp: layered(
    { type: "sine", from: 400, to: 1600, seconds: 0.34, vibrato: { rate: 24, depth: 0.08 } },
    { type: "pink", seconds: 0.34, gain: 0.3, filter: { type: "bandpass", from: 600, to: 3600, q: 3 } },
  ),
  bossIntro: layered(
    { type: "sawtooth", from: 55, to: 52, seconds: 1, attack: 0.25, gain: 0.6, filter: { type: "lowpass", from: 300, to: 900, q: 3 } },
    { type: "brown", seconds: 1, attack: 0.25, gain: 0.6, filter: { type: "lowpass", from: 220, to: 160 } },
    { type: "square", notes: [110, 104, 98], seconds: 1, gain: 0.3, filter: { type: "lowpass", from: 600, to: 600 } },
  ),
  // Spooky.
  doorCreak: layered(
    { type: "sawtooth", from: 150, to: 92, seconds: 0.62, attack: 0.05, gain: 0.5, vibrato: { rate: 23, depth: 0.09 }, filter: { type: "bandpass", from: 900, to: 700, q: 3 } },
  ),
  gust: layered({ type: "pink", seconds: 0.9, attack: 0.35, filter: { type: "bandpass", from: 300, to: 850, q: 1.2 } }),
  heartbeat: layered(
    { type: "sine", from: 72, to: 45, seconds: 0.1 },
    { type: "sine", from: 66, to: 42, seconds: 0.11, delay: 0.18, gain: 0.8 },
  ),
  wail: layered({ type: "sine", from: 560, to: 880, seconds: 0.65, attack: 0.15, vibrato: { rate: 6, depth: 0.03 } }),
  // Crowds and wood.
  rattle: layered(
    { type: "triangle", notes: [1200, 900, 1100, 820], seconds: 0.16, gain: 0.6 },
    { type: "noise", seconds: 0.12, gain: 0.3, filter: { type: "bandpass", from: 3200, to: 2400, q: 2 } },
  ),
  cheer: layered(
    { type: "pink", seconds: 1, attack: 0.25, filter: { type: "bandpass", from: 900, to: 1400, q: 0.8 } },
    { type: "noise", seconds: 1, attack: 0.25, gain: 0.2, filter: { type: "highpass", from: 3000, to: 3500 } },
  ),
  aww: layered({ type: "pink", seconds: 0.85, attack: 0.1, filter: { type: "bandpass", from: 950, to: 480, q: 1.3 } }),
  applause: layered(
    ...[0, 0.05, 0.11, 0.14, 0.2, 0.27, 0.31, 0.38, 0.43, 0.5].map((delay, i) => ({ type: "noise", seconds: 0.035, delay, gain: 0.6 + (i % 3) * 0.15, filter: { type: "bandpass", from: 1400 + (i % 4) * 300, to: 1200, q: 1.5 } })),
  ),
  knock: layered(
    { type: "triangle", from: 600, to: 560, seconds: 0.06 },
    { type: "noise", seconds: 0.03, gain: 0.5, filter: { type: "bandpass", from: 1800, to: 1500, q: 2 } },
  ),
  crumble: layered(
    { type: "brown", seconds: 0.55, filter: { type: "lowpass", from: 900, to: 100 } },
    ...[0, 0.07, 0.15, 0.24].map((delay) => ({ type: "noise", seconds: 0.04, delay, gain: 0.35, filter: { type: "bandpass", from: 1600, to: 900, q: 2 } })),
  ),
  hiss: layered({ type: "noise", seconds: 0.4, attack: 0.03, gain: 0.6, filter: { type: "highpass", from: 3000, to: 5200 } }),
  squeak: layered({ type: "sine", from: 1800, to: 2400, seconds: 0.05 }),
});

/* --------------------------------------------------------------- hums

   A hum is a sound that runs for as long as a game keeps asking for it: a
   car's engine, a boat's outboard, the river, a light cycle, a fuse's hiss.
   A game calls hum(id, name, level, pitch) every frame it wants it, `id`
   telling one voice from another (your car and a rival's), and pitch
   following its speed. A hum not asked for again within HUM_HOLD_MS fades
   out by itself, so a paused, closed or finished game falls quiet without
   saying so; hushTones() quiets them all at once. Each hum is oscillators
   (`parts`, each its own frequency and gain) and noise (`noise`) through one
   filter whose cutoff follows the pitch by `follow` (1 tracks it exactly, 0
   holds still), pulsed by `pulse` ({ rate, depth }, the rate following the
   pitch): an engine's firing strokes or a train's clatter. */
const hums = (table) => Object.freeze(Object.fromEntries(Object.entries(table).map(([k, v]) => [k, Object.freeze(v)])));

const HUMS = hums({
  car: { parts: [{ type: "sawtooth", freq: 46 }, { type: "sawtooth", freq: 46.5, gain: 0.7 }, { type: "square", freq: 23, gain: 0.5 }], noise: { color: "brown", gain: 0.2 }, filter: { type: "lowpass", freq: 360, q: 4, follow: 0.9 }, pulse: { rate: 11, depth: 0.45 }, peak: 0.06 },
  toycar: { parts: [{ type: "square", freq: 90 }, { type: "square", freq: 90.8, gain: 0.5 }], filter: { type: "lowpass", freq: 850, q: 2, follow: 1 }, pulse: { rate: 20, depth: 0.5 }, peak: 0.04 },
  electric: { parts: [{ type: "sawtooth", freq: 60 }, { type: "sine", freq: 120, gain: 0.5 }, { type: "sine", freq: 620, gain: 0.12 }], filter: { type: "lowpass", freq: 520, q: 2, follow: 0.8 }, peak: 0.045 },
  outboard: { parts: [{ type: "sawtooth", freq: 38 }, { type: "square", freq: 76, gain: 0.4 }], noise: { color: "brown", gain: 0.35 }, filter: { type: "lowpass", freq: 430, q: 3, follow: 0.9 }, pulse: { rate: 16, depth: 0.6 }, peak: 0.06 },
  river: { noise: { color: "brown", gain: 1 }, filter: { type: "lowpass", freq: 650, q: 0.5, follow: 1 }, pulse: { rate: 0.4, depth: 0.3 }, peak: 0.05 },
  wind: { noise: { color: "pink", gain: 1 }, filter: { type: "bandpass", freq: 600, q: 0.8, follow: 1 }, pulse: { rate: 0.3, depth: 0.4 }, peak: 0.04 },
  cycle: { parts: [{ type: "sawtooth", freq: 98 }, { type: "sawtooth", freq: 98.6 }, { type: "sawtooth", freq: 196.3, gain: 0.3 }], filter: { type: "lowpass", freq: 1100, q: 6, follow: 0.8 }, peak: 0.03 },
  fuse: { noise: { color: "noise", gain: 1 }, filter: { type: "highpass", freq: 3500, q: 0.7, follow: 0.5 }, pulse: { rate: 23, depth: 0.55 }, peak: 0.03 },
  haunt: { parts: [{ type: "sine", freq: 55 }, { type: "sine", freq: 55.8 }, { type: "triangle", freq: 82.4, gain: 0.3 }], filter: { type: "lowpass", freq: 400, q: 1, follow: 0.5 }, pulse: { rate: 0.3, depth: 0.5 }, peak: 0.045 },
  squeal: { parts: [{ type: "triangle", freq: 1450, gain: 0.2 }], noise: { color: "noise", gain: 1 }, filter: { type: "bandpass", freq: 1900, q: 9, follow: 1 }, peak: 0.035 },
  meter: { parts: [{ type: "triangle", freq: 220 }, { type: "square", freq: 220.5, gain: 0.25 }], filter: { type: "lowpass", freq: 1200, q: 1, follow: 1 }, peak: 0.025 },
  swarm: { parts: [{ type: "sawtooth", freq: 180 }, { type: "sawtooth", freq: 183 }, { type: "sawtooth", freq: 177 }], filter: { type: "bandpass", freq: 900, q: 2, follow: 1 }, pulse: { rate: 30, depth: 0.5 }, peak: 0.02 },
  train: { parts: [{ type: "square", freq: 60, gain: 0.4 }], noise: { color: "brown", gain: 1 }, filter: { type: "lowpass", freq: 520, q: 1, follow: 0.7 }, pulse: { rate: 4, depth: 0.7 }, peak: 0.05 },
  crowd: { noise: { color: "pink", gain: 1 }, filter: { type: "bandpass", freq: 1100, q: 0.6, follow: 0.6 }, pulse: { rate: 0.5, depth: 0.4 }, peak: 0.02 },
});

// Every game's own extras, merged after the shared kit; a name may be
// defined only once across them all (the activities suite checks).
const GAME_SFX = Object.freeze([snakeSfx, golfSfx, trailsSfx, bugsSfx, driveSfx, stackSfx, bumperSfx, rapidsSfx, fuseSfx, hopSfx, bounceSfx, ghoulSfx]);

// A game file holds plain objects; they are frozen here, all the way down.
const deepFreeze = (o) => {
  if (o && typeof o === "object") Object.values(o).forEach(deepFreeze);
  return Object.freeze(o);
};

export const TONE_TABLES = Object.freeze([BLIPS, RICH, ...GAME_SFX.map((s) => deepFreeze(s.tones || {}))]);
export const HUM_TABLES = Object.freeze([HUMS, ...GAME_SFX.map((s) => deepFreeze(s.hums || {}))]);
// And each game's chiptune tracks, which music.js plays.
export const MUSIC_TABLES = Object.freeze(GAME_SFX.map((s) => deepFreeze(s.music || {})));

const TONES = Object.freeze(Object.assign({}, ...TONE_TABLES));
const ALL_HUMS = Object.freeze(Object.assign({}, ...HUM_TABLES));

export const toneNames = () => Object.keys(TONES);
export const humNames = () => Object.keys(ALL_HUMS);

// Peak gain, kept modest so a blip sits under the page rather than over it.
const PEAK = 0.08;

// A quick attack avoids a click at the start; the decay is exponential, which
// needs a non-zero floor, so the envelope stops at a tiny value, not zero.
const ATTACK = 0.01;
const FLOOR = 0.0001;

// At most this many parts of rich tones sounding at once: a frantic moment
// drops one rather than piling up enough voices to stutter the page.
const MAX_VOICES = 48;

let ctx = null;

let bus = null;

const noiseBuffers = new Map();

let voiceEnds = [];

// Made on first use, not at load, so importing this file in Node is harmless.
// A missing AudioContext or a constructor that throws both give null.
function audioContext() {
  if (ctx) return ctx;
  if (typeof globalThis.AudioContext === "undefined") return null;
  try {
    ctx = new globalThis.AudioContext();
  } catch {
    ctx = null;
  }
  return ctx;
}

// Everything plays through one gentle compressor, so an explosion over an
// engine over a shot never clips; a context without one plays straight out.
function out(c) {
  if (bus) return bus;
  if (typeof c.createDynamicsCompressor !== "function") return c.destination;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.knee.value = 12;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.2;
  comp.connect(c.destination);
  bus = comp;
  return bus;
}

// Two seconds of noise per color, made once and looped from a random point.
function noiseBuffer(c, color) {
  if (noiseBuffers.has(color)) return noiseBuffers.get(color);
  const length = Math.floor(c.sampleRate * 2);
  const buf = c.createBuffer(1, length, c.sampleRate);
  const data = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, last = 0;
  for (let i = 0; i < length; i++) {
    const w = Math.random() * 2 - 1;
    if (color === "pink") {
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      data[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    } else if (color === "brown") {
      last = (last + 0.02 * w) / 1.02;
      data[i] = last * 3.5;
    } else data[i] = w;
  }
  noiseBuffers.set(color, buf);
  return buf;
}

const NOISES = new Set(["noise", "pink", "brown"]);

// Room for `n` more parts that end at `end`, or false while the page is busy.
function room(c, n, end) {
  const now = c.currentTime;
  voiceEnds = voiceEnds.filter((t) => t > now);
  if (voiceEnds.length + n > MAX_VOICES) return false;
  for (let i = 0; i < n; i++) voiceEnds.push(end);
  return true;
}

// The running context, its output and its noise, for music.js, which plays
// through the same compressor; null while audio cannot play.
export function audioOut() {
  try {
    const c = audioContext();
    if (!c || c.state !== "running") return null;
    return { c, out: out(c), noise: (color) => noiseBuffer(c, color) };
  } catch {
    return null;
  }
}

// Called from the click that opens Activities. A browser keeps a new context
// suspended until a gesture, and a rejected resume is not an error the page
// can act on, so every failure is swallowed.
export function unlockTones() {
  try {
    const c = audioContext();
    if (c) Promise.resolve(c.resume()).catch(() => {});
  } catch {}
}

// One oscillator from t0 for `seconds`, sweeping from one pitch to another.
function blip(c, type, from, to, t0, seconds, peak) {
  const end = t0 + seconds;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(to, end);
  // Silent from the start: a gain node is 1 until its first scheduled value,
  // which made a part that starts later click.
  gain.gain.value = FLOOR;
  gain.gain.setValueAtTime(FLOOR, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + ATTACK);
  gain.gain.exponentialRampToValueAtTime(FLOOR, end);
  osc.connect(gain);
  gain.connect(out(c));
  osc.start(t0);
  osc.stop(end);
}

// One part of a rich tone from t0: an oscillator (sweeping, or stepping
// through `notes`) or a noise, through its filter if it has one, under an
// envelope that swells in over `attack` and dies away by its end.
function voice(c, p, t0, peak, k) {
  const end = t0 + p.seconds;
  const gain = c.createGain();
  const top = Math.max(FLOOR * 10, peak * (p.gain ?? 1));
  // Silent from the start (see blip): no click before a delayed part begins.
  gain.gain.value = FLOOR;
  gain.gain.setValueAtTime(FLOOR, t0);
  gain.gain.exponentialRampToValueAtTime(top, t0 + Math.min(p.attack ?? ATTACK, p.seconds * 0.8));
  gain.gain.exponentialRampToValueAtTime(FLOOR, end);
  let src;
  if (NOISES.has(p.type)) {
    src = c.createBufferSource();
    src.buffer = noiseBuffer(c, p.type);
    src.loop = true;
  } else {
    src = c.createOscillator();
    src.type = p.type;
    if (p.notes) {
      const each = p.seconds / p.notes.length;
      p.notes.forEach((f, i) => src.frequency.setValueAtTime(f * k, t0 + i * each));
    } else {
      src.frequency.setValueAtTime(p.from * k, t0);
      src.frequency.exponentialRampToValueAtTime(p.to * k, end);
    }
    if (p.vibrato) {
      const lfo = c.createOscillator();
      const depth = c.createGain();
      lfo.frequency.value = p.vibrato.rate;
      depth.gain.value = (p.notes ? p.notes[0] : p.from) * k * p.vibrato.depth;
      lfo.connect(depth);
      depth.connect(src.frequency);
      lfo.start(t0);
      lfo.stop(end);
    }
  }
  let head = src;
  if (p.filter) {
    const f = c.createBiquadFilter();
    f.type = p.filter.type;
    f.Q.value = p.filter.q ?? 1;
    f.frequency.setValueAtTime(Math.min(20000, p.filter.from * k), t0);
    f.frequency.exponentialRampToValueAtTime(Math.min(20000, (p.filter.to ?? p.filter.from) * k), end);
    head.connect(f);
    head = f;
  }
  head.connect(gain);
  gain.connect(out(c));
  if (NOISES.has(p.type)) src.start(t0, Math.random() * 1.5);
  else src.start(t0);
  src.stop(end);
}

// Plays one named blip, at `level` (0 to 1) of the usual loudness: a soft
// putt sounds soft. `pitch` scales every frequency (2 is an octave up, kept
// between two octaves down and two up), so a game can climb a scale on one
// blip. An unknown name, Play sounds off, or a context that is missing,
// suspended or closed all mean silence, not an error.
export function tone(name, level = 1, pitch = 1) {
  try {
    const spec = Object.hasOwn(TONES, name) ? TONES[name] : null;
    if (!spec || !looks.sound) return;
    const c = audioContext();
    if (!c || c.state !== "running") return;
    const peak = Math.max(FLOOR * 10, PEAK * Math.min(1, Number(level) || 0));
    const t0 = c.currentTime;
    const k = Math.min(4, Math.max(0.25, Number(pitch) || 1));
    if (spec.layers) {
      const last = Math.max(...spec.layers.map((p) => (p.delay || 0) + p.seconds));
      if (!room(c, spec.layers.length, t0 + last)) return;
      return spec.layers.forEach((p) => voice(c, p, t0 + (p.delay || 0), peak, k));
    }
    if (!spec.notes) return blip(c, spec.type, spec.from * k, spec.to * k, t0, spec.seconds, peak);
    const each = spec.seconds / spec.notes.length;
    spec.notes.forEach((f, i) => blip(c, spec.type, f * k, f * k, t0 + i * each, each, peak));
  } catch {}
}

/* ------------------------------------------------------ the hum voices */

// A hum not asked for again within this long fades out by itself.
const HUM_HOLD_MS = 150;

// At most this many hums at once; a new one past it is not started.
const MAX_HUMS = 6;

// How quickly a hum's pitch and loudness follow what the game asks, in
// seconds: quick enough to rev, slow enough never to zipper.
const GLIDE = 0.05;

const live = new Map();

let watchdog = null;

function startHum(c, spec) {
  const amp = c.createGain();
  const level = c.createGain();
  level.gain.value = 0;
  amp.connect(level);
  level.connect(out(c));
  let head = amp;
  let filter = null;
  if (spec.filter) {
    filter = c.createBiquadFilter();
    filter.type = spec.filter.type;
    filter.Q.value = spec.filter.q ?? 1;
    filter.frequency.value = spec.filter.freq;
    filter.connect(amp);
    head = filter;
  }
  const oscs = (spec.parts || []).map((p) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = p.type;
    o.frequency.value = p.freq;
    g.gain.value = p.gain ?? 1;
    o.connect(g);
    g.connect(head);
    o.start();
    return o;
  });
  const sources = [...oscs];
  if (spec.noise) {
    const n = c.createBufferSource();
    const g = c.createGain();
    n.buffer = noiseBuffer(c, spec.noise.color);
    n.loop = true;
    g.gain.value = spec.noise.gain ?? 1;
    n.connect(g);
    g.connect(head);
    n.start(0, Math.random() * 1.5);
    sources.push(n);
  }
  let lfo = null;
  if (spec.pulse) {
    lfo = c.createOscillator();
    const depth = c.createGain();
    lfo.frequency.value = spec.pulse.rate;
    depth.gain.value = spec.pulse.depth / 2;
    amp.gain.value = 1 - spec.pulse.depth / 2;
    lfo.connect(depth);
    depth.connect(amp.gain);
    lfo.start();
    sources.push(lfo);
  }
  return { spec, level, filter, oscs, lfo, sources, seen: 0 };
}

function stopHum(c, id, v) {
  live.delete(id);
  try {
    const t = c.currentTime;
    v.level.gain.cancelScheduledValues(t);
    v.level.gain.setTargetAtTime(0, t, 0.06);
    v.sources.forEach((s) => s.stop(t + 0.5));
  } catch {}
}

function watch() {
  if (watchdog) return;
  watchdog = setInterval(() => {
    const now = performance.now();
    for (const [id, v] of live) if (!looks.sound || now - v.seen > HUM_HOLD_MS) stopHum(ctx, id, v);
    if (!live.size) {
      clearInterval(watchdog);
      watchdog = null;
    }
  }, 50);
}

// Keeps the hum `id` sounding as `name` for another moment, at `level` (0 to
// 1) of its loudness and `pitch` (1 is its own, kept between 0.25 and 4).
// Asking under a different name restarts it as that one. Like tone(), it is
// silence, never an error, while Play sounds is off or the audio is not
// running.
export function hum(id, name, level = 1, pitch = 1) {
  try {
    const spec = Object.hasOwn(ALL_HUMS, name) ? ALL_HUMS[name] : null;
    const c = audioContext();
    if (!spec || !looks.sound || !c || c.state !== "running") return;
    let v = live.get(id);
    if (v && v.spec !== spec) {
      stopHum(c, id, v);
      v = null;
    }
    if (!v) {
      if (live.size >= MAX_HUMS) return;
      v = startHum(c, spec);
      live.set(id, v);
      watch();
    }
    v.seen = performance.now();
    const t = c.currentTime;
    const k = Math.min(4, Math.max(0.25, Number(pitch) || 1));
    const loud = spec.peak * Math.min(1, Math.max(0, Number(level) || 0));
    v.level.gain.setTargetAtTime(loud, t, GLIDE);
    v.oscs.forEach((o, i) => o.frequency.setTargetAtTime(spec.parts[i].freq * k, t, GLIDE));
    if (v.filter) v.filter.frequency.setTargetAtTime(Math.min(18000, spec.filter.freq * k ** (spec.filter.follow ?? 1)), t, GLIDE);
    if (v.lfo) v.lfo.frequency.setTargetAtTime(spec.pulse.rate * k, t, GLIDE);
  } catch {}
}

// Quiets every hum at once: the window stopped ticking a game.
export function hushTones() {
  if (!ctx) return;
  for (const [id, v] of live) stopHum(ctx, id, v);
}
