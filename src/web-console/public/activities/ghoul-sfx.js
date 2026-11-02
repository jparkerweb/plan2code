// Plan2Code Web Console - ghoul: its own sound effects, merged into tones.js beside the shared kit; defines only.
//
// `tones` are one-shot sounds played with tone(name, level, pitch); `hums` are
// held sounds kept going with hum(id, name, level, pitch). Both take the shapes
// tones.js documents, as plain objects (tones.js freezes them). A name may be
// defined only once across tones.js and every game's file.
//
// This file holds the house's sounds and tracks (the hall, the Manor, the East
// Wing). Each stage with its own picked sounds and music keeps them in its own
// ghoul-sfx-<stage>.js (the Graveyard's in ghoul-sfx-graveyard.js), merged in
// below after the house's, the way ghoul.js merges its stage PACKS. Those are
// the only imports.

import { GRAVEYARD_SFX } from "./ghoul-sfx-graveyard.js";
import { GROUNDS_SFX } from "./ghoul-sfx-grounds.js";
import { CHAPEL_SFX } from "./ghoul-sfx-chapel.js";
import { SANATORIUM_SFX } from "./ghoul-sfx-sanatorium.js";
import { VILLAGE_SFX } from "./ghoul-sfx-village.js";
import { MINE_SFX } from "./ghoul-sfx-mine.js";
import { CARNIVAL_SFX } from "./ghoul-sfx-carnival.js";
import { FROZEN_SFX } from "./ghoul-sfx-frozen.js";
import { SLED_SFX } from "./ghoul-sfx-sled.js";
import { ARMS_SFX } from "./ghoul-sfx-arms.js";
import { RIDE_SFX } from "./ghoul-sfx-ride.js";

// Each stage's sounds and tracks, by stage: `tones`, `hums` and `music` as
// below, any of them left out.
const STAGE_SFX = Object.freeze([GRAVEYARD_SFX, GROUNDS_SFX, CHAPEL_SFX, SANATORIUM_SFX, VILLAGE_SFX, MINE_SFX, CARNIVAL_SFX, FROZEN_SFX,SLED_SFX, ARMS_SFX, RIDE_SFX]);
const fromStages = (key) => Object.assign({}, ...STAGE_SFX.map((st) => st[key] || {}));

// One second of the laugh track (part 0, 1 or 2): every event is placed on the
// whole 3.2 s clock, slowing as it goes, and the part keeps those that fall in
// its second.
function laughPart(part) {
  const at = (t) => t - part;
  const inPart = (t) => at(t) >= 0 && at(t) < 1;
  const sag = 1 - part * 0.07;
  const layers = [
    { type: "square", from: 52 * (1 - part * 0.18), to: 52 * (1 - part * 0.18 - 0.17), seconds: 1.1, gain: 0.12, filter: { type: "lowpass", from: 420, to: 160 } },
    { type: "pink", seconds: 1.1, attack: part ? 0.02 : 0.4, gain: 0.16 * (1 - part * 0.3), filter: { type: "bandpass", from: 3200 - part * 700, to: 2400 - part * 700, q: 0.8 } },
  ];
  for (let k = 0, t = 0; t < 3.2; k++) {
    if (inPart(t)) layers.push({ type: "noise", seconds: 0.014, delay: at(t), gain: 0.3, filter: { type: "highpass", from: 3000, to: 3000 } });
    t += 0.045 + k * 0.0045;
  }
  for (const [lag, hz, mul] of [[0, 330, 1], [0.04, 392, 1.25], [0.09, 262, 0.8]]) {
    for (let k = 0; k < 9; k++) {
      const t = lag + 0.25 + k * 0.2 * (1 + k * 0.09);
      if (!inPart(t)) continue;
      const f = hz * (1 - k * 0.035) * (k % 2 ? 0.94 : 1);
      layers.push({ type: "square", from: f, to: f * 0.78, seconds: 0.11 + k * 0.012, delay: at(t), attack: 0.006, gain: 0.3 * mul * (1 - k * 0.07) * sag, vibrato: { rate: 34, depth: 0.05 }, filter: { type: "bandpass", from: f * 2.8, to: f * 1.8, q: 3 } });
    }
  }
  return layers;
}

const HOUSE = {
  tones: {
    // Planny's footstep on old floorboards: a dull knock of wood with a
    // little give (the game pitches it up a touch on a shelf, alternates
    // feet, and keeps it quiet, since it plays a few times a second).
    ghoulStep: {
      layers: [
        { type: "triangle", from: 150, to: 95, seconds: 0.06, gain: 0.7 },
        { type: "brown", seconds: 0.07, gain: 0.8, filter: { type: "lowpass", from: 700, to: 220 } },
        { type: "noise", seconds: 0.02, gain: 0.2, filter: { type: "bandpass", from: 1800, to: 1400, q: 2 } },
      ],
    },
    // A bat's leathery wings: quick pink-noise flaps through a bandpass.
    ghoulFlap: {
      layers: [0, 0.06, 0.12, 0.18].map((delay, i) => ({ type: "pink", seconds: 0.05, delay, gain: 0.9 - i * 0.15, filter: { type: "bandpass", from: 1400, to: 700, q: 1.6 } })),
    },
    // A headshot: a sharp crack over a short knock of bone.
    ghoulHeadshot: {
      layers: [
        { type: "noise", seconds: 0.05, filter: { type: "highpass", from: 2600, to: 1800 } },
        { type: "square", from: 900, to: 300, seconds: 0.07, gain: 0.4, filter: { type: "lowpass", from: 3000, to: 800 } },
        { type: "triangle", notes: [1175, 1568], seconds: 0.14, delay: 0.04, gain: 0.35 },
      ],
    },
    // The acid burning where it lands: a hiss that fizzes out.
    ghoulSizzle: {
      layers: [
        { type: "noise", seconds: 0.45, attack: 0.02, gain: 0.7, filter: { type: "highpass", from: 2800, to: 5200 } },
        { type: "noise", seconds: 0.3, gain: 0.3, filter: { type: "bandpass", from: 1200, to: 2400, q: 3 } },
      ],
    },
    // The key picked up: a small ring of old iron keys.
    ghoulKey: {
      layers: [
        { type: "triangle", notes: [2093, 2637, 2349, 3136], seconds: 0.3, gain: 0.5 },
        { type: "noise", seconds: 0.03, gain: 0.35, filter: { type: "bandpass", from: 5200, to: 4600, q: 3 } },
        { type: "noise", seconds: 0.03, delay: 0.09, gain: 0.25, filter: { type: "bandpass", from: 4800, to: 4200, q: 3 } },
      ],
    },
    // A chandelier's crystals shattering across the floor.
    ghoulGlass: {
      layers: [
        { type: "noise", seconds: 0.5, filter: { type: "highpass", from: 5000, to: 2500 } },
        ...[0.02, 0.09, 0.15, 0.24, 0.33].map((delay, i) => ({ type: "triangle", from: 3200 - i * 260, to: 3000 - i * 260, seconds: 0.12, delay, gain: 0.35 })),
      ],
    },
    // A cracked church bell tolling once: the hurry, and the end of a run.
    ghoulToll: {
      layers: [
        { type: "sine", from: 196, to: 194, seconds: 1.15, gain: 0.8 },
        { type: "sine", from: 466, to: 462, seconds: 0.9, gain: 0.35 },
        { type: "triangle", from: 587, to: 581, seconds: 0.7, gain: 0.2 },
        { type: "noise", seconds: 0.04, gain: 0.3, filter: { type: "bandpass", from: 1800, to: 1200, q: 2 } },
      ],
    },
    // A Lucky die saving Planny: a bell tolling twice, then a bright
    // little sting climbing out of it.
    ghoulLuckySave: {
      layers: [
        { type: "sine", from: 196, to: 194, seconds: 0.55, gain: 0.7 },
        { type: "triangle", from: 587, to: 581, seconds: 0.35, gain: 0.2 },
        { type: "sine", from: 247, to: 245, seconds: 0.45, delay: 0.25, gain: 0.6 },
        { type: "triangle", notes: [784, 988, 1175, 1568], seconds: 0.45, delay: 0.5, gain: 0.45 },
        { type: "sine", notes: [1568, 2093], seconds: 0.35, delay: 0.8, gain: 0.3 },
        { type: "noise", seconds: 0.25, delay: 0.5, gain: 0.15, filter: { type: "highpass", from: 5000, to: 8000 } },
      ],
    },
    // A Lucky die's 1: a wind-up toy laughing at you, a ratchet clicking before
    // each buzzy "ha", running down as its spring does.
    ghoulDiceLaugh: {
      layers: [
        { type: "square", from: 58, to: 44, seconds: 1.15, gain: 0.16, filter: { type: "lowpass", from: 500, to: 260 } },
        ...[[0, 392], [0.15, 370], [0.3, 349], [0.46, 330], [0.64, 294], [0.85, 247]].flatMap(([delay, hz]) => [
          { type: "noise", seconds: 0.015, delay, gain: 0.4, filter: { type: "highpass", from: 3500, to: 3500 } },
          { type: "square", from: hz, to: hz * 0.84, seconds: 0.1, delay: delay + 0.015, attack: 0.005, gain: 0.5, vibrato: { rate: 38, depth: 0.04 }, filter: { type: "bandpass", from: hz * 2.6, to: hz * 2, q: 3 } },
        ]),
      ],
    },
    // The game over's mechanical laugh track, in three one-second parts the
    // game plays a second apart (a tone may not run past 1.2 s): a cranked
    // ratchet clicking under rounds of buzzy square-wave "ha ha ha" from three
    // pseudo-voices at staggered pitches, a hiss of applause beneath, the lot
    // slowing and sagging as its spring runs down (about 3.2 s in all).
    ...Object.fromEntries([0, 1, 2].map((part) => [part ? `ghoulLaughTrack${part + 1}` : "ghoulLaughTrack", { layers: laughPart(part) }])),
    // A horror stinger: a minor chord stabbed on low saws, the fight on.
    ghoulStinger: {
      layers: [
        { type: "sawtooth", from: 110, to: 108, seconds: 0.7, gain: 0.45, filter: { type: "lowpass", from: 2400, to: 500 } },
        { type: "sawtooth", from: 131, to: 129, seconds: 0.7, gain: 0.4, filter: { type: "lowpass", from: 2400, to: 500 } },
        { type: "sawtooth", from: 156, to: 154, seconds: 0.7, gain: 0.4, filter: { type: "lowpass", from: 2400, to: 500 } },
        { type: "brown", seconds: 0.4, gain: 0.6, filter: { type: "lowpass", from: 400, to: 120 } },
      ],
    },
    // Down a pit: a falling cry dropping away into a dull thump far below.
    ghoulPitFall: {
      layers: [
        { type: "triangle", from: 880, to: 110, seconds: 0.8, gain: 0.6, vibrato: { rate: 7, depth: 0.04 } },
        { type: "pink", seconds: 0.8, gain: 0.35, filter: { type: "bandpass", from: 2000, to: 300, q: 1.2 } },
        { type: "sine", from: 90, to: 40, seconds: 0.25, delay: 0.85, gain: 0.7 },
      ],
    },
    // A new room: the door shutting behind you, a deep boom with a hollow
    // ring (the game pitches it per room).
    ghoulRoomIn: {
      layers: [
        { type: "sine", from: 90, to: 38, seconds: 0.5 },
        { type: "brown", seconds: 0.3, gain: 0.7, filter: { type: "lowpass", from: 600, to: 120 } },
        { type: "triangle", from: 220, to: 216, seconds: 0.9, delay: 0.05, gain: 0.2 },
      ],
    },
    // A monster fading away as its boss falls: a soft breath of smoke.
    ghoulPoof: {
      layers: [{ type: "pink", seconds: 0.22, attack: 0.03, filter: { type: "bandpass", from: 1800, to: 600, q: 1.2 } }],
    },
    // Old Rattlebones' shockwave tearing along the floor.
    ghoulShock: {
      layers: [
        { type: "brown", seconds: 0.6, attack: 0.05, filter: { type: "lowpass", from: 1200, to: 160 } },
        { type: "sawtooth", from: 80, to: 40, seconds: 0.5, gain: 0.45, filter: { type: "lowpass", from: 500, to: 150 } },
        { type: "noise", seconds: 0.45, attack: 0.05, gain: 0.2, filter: { type: "bandpass", from: 900, to: 300, q: 1 } },
      ],
    },
    // The garlic shield bursting as it takes a hit: a bright pop and a
    // shimmer scattering out.
    ghoulGarlicPop: {
      layers: [
        { type: "sine", from: 1600, to: 400, seconds: 0.2, gain: 0.6 },
        { type: "triangle", notes: [1568, 1319, 1047, 784], seconds: 0.3, delay: 0.04, gain: 0.35 },
        { type: "noise", seconds: 0.2, gain: 0.3, filter: { type: "highpass", from: 4000, to: 7000 } },
      ],
    },
    // A bone clattering onto the floor.
    ghoulBoneDrop: {
      layers: [
        { type: "triangle", notes: [1100, 820, 980], seconds: 0.12, gain: 0.5 },
        { type: "noise", seconds: 0.04, gain: 0.35, filter: { type: "bandpass", from: 2600, to: 2000, q: 2 } },
      ],
    },
    // Lightning's crack, before the thunder rolls in.
    ghoulCrack: {
      layers: [
        { type: "noise", seconds: 0.18, filter: { type: "highpass", from: 3000, to: 900 } },
        { type: "brown", seconds: 0.35, delay: 0.03, gain: 0.8, filter: { type: "lowpass", from: 1400, to: 200 } },
      ],
    },
    // Each monster's own voice, one sound per thing it does (picked by ear
    // from five candidates each in prototypes/sounds/ghoul-rush): ghoul, the
    // kind, then the act. ghoul-draw.js plays them from VOICES.
    // Zombie: shambles along, mismatched eyes, ragged shirt.
    // Comes in: Wet gurgling moan.
    ghoulZombieAppear: {
      layers: [
        { type: "sine", from: 153, to: 115, seconds: 0.6, attack: 0.05, gain: 0.9, vibrato: { rate: 15, depth: 0.4 } },
        { type: "brown", seconds: 0.6, attack: 0.05, gain: 0.7, filter: { type: "lowpass", from: 700, to: 300 } },
        { type: "sine", from: 230, to: 184, seconds: 0.42, delay: 0.09, attack: 0.03, gain: 0.4, vibrato: { rate: 9, depth: 0.5 } },
        { type: "sawtooth", from: 75, to: 53, seconds: 0.6, delay: 0.1, attack: 0.12, gain: 0.45, vibrato: { rate: 22, depth: 0.07 }, filter: { type: "lowpass", from: 900, to: 450, q: 5 } },
        { type: "sawtooth", from: 75, to: 53, seconds: 0.6, delay: 0.1, attack: 0.14, gain: 0.25, filter: { type: "lowpass", from: 720, to: 360, q: 3 } },
        { type: "brown", seconds: 0.6, delay: 0.1, attack: 0.1, gain: 0.3, filter: { type: "bandpass", from: 272, to: 204, q: 2 } },
      ],
    },
    // Climbs or leaps up: Snarl and scrape.
    ghoulZombieClimb: {
      layers: [
        { type: "sawtooth", from: 95, to: 71, seconds: 0.45, attack: 0.03, gain: 0.9, vibrato: { rate: 33, depth: 0.2 }, filter: { type: "bandpass", from: 535, to: 297, q: 3 } },
        { type: "noise", seconds: 0.41, attack: 0.02, gain: 0.5, filter: { type: "bandpass", from: 1120, to: 490, q: 1.5 } },
        { type: "square", from: 48, to: 42, seconds: 0.45, attack: 0.03, gain: 0.35, filter: { type: "lowpass", from: 350, to: 350 } },
        { type: "noise", seconds: 0.35, attack: 0.12, gain: 0.4, filter: { type: "bandpass", from: 180, to: 1080, q: 1.5 } },
      ],
    },
    // Takes a bolt: Choked gurgle.
    ghoulZombieHurt: {
      layers: [
        { type: "sine", from: 170, to: 128, seconds: 0.3, attack: 0.05, gain: 0.9, vibrato: { rate: 15, depth: 0.4 } },
        { type: "brown", seconds: 0.3, attack: 0.05, gain: 0.7, filter: { type: "lowpass", from: 700, to: 300 } },
        { type: "sine", from: 255, to: 204, seconds: 0.21, delay: 0.05, attack: 0.03, gain: 0.4, vibrato: { rate: 9, depth: 0.5 } },
      ],
    },
    // Dies: Splat and gurgle.
    ghoulZombieDie: {
      layers: [
        { type: "noise", seconds: 0.28, attack: 0, gain: 0.9, filter: { type: "lowpass", from: 2600, to: 200 } },
        { type: "square", from: 140, to: 40, seconds: 0.16, attack: 0, gain: 0.5, filter: { type: "lowpass", from: 600, to: 600 } },
        { type: "sine", from: 900, to: 1300, seconds: 0.05, delay: 0.2, gain: 0.25 },
        { type: "sine", from: 760, to: 1100, seconds: 0.05, delay: 0.34, gain: 0.18 },
        { type: "sine", from: 136, to: 102, seconds: 0.6, delay: 0.12, attack: 0.05, gain: 0.9, vibrato: { rate: 15, depth: 0.4 } },
        { type: "brown", seconds: 0.6, delay: 0.12, attack: 0.05, gain: 0.7, filter: { type: "lowpass", from: 700, to: 300 } },
        { type: "sine", from: 204, to: 163, seconds: 0.42, delay: 0.21, attack: 0.03, gain: 0.4, vibrato: { rate: 9, depth: 0.5 } },
      ],
    },
    // Runner: a fast zombie, down in one bolt, shrieks as it comes.
    // Shrieks on the way: Gurgling war cry.
    ghoulRunnerWarn: {
      layers: [
        { type: "sawtooth", from: 520, to: 728, seconds: 0.6, attack: 0.03, gain: 0.8, vibrato: { rate: 12, depth: 0.04 }, filter: { type: "bandpass", from: 1040, to: 1248, q: 4 } },
        { type: "sawtooth", from: 780, to: 1092, seconds: 0.54, attack: 0.04, gain: 0.35, filter: { type: "bandpass", from: 1560, to: 1560, q: 5 } },
        { type: "noise", seconds: 0.48, attack: 0.03, gain: 0.3, filter: { type: "highpass", from: 3000, to: 3000 } },
        { type: "sine", from: 280, to: 210, seconds: 0.6, attack: 0.05, gain: 0.54, vibrato: { rate: 15, depth: 0.4 } },
        { type: "brown", seconds: 0.6, attack: 0.05, gain: 0.42, filter: { type: "lowpass", from: 700, to: 300 } },
        { type: "sine", from: 420, to: 336, seconds: 0.42, delay: 0.09, attack: 0.03, gain: 0.24, vibrato: { rate: 9, depth: 0.5 } },
      ],
    },
    // Leaps up: Yip.
    ghoulRunnerClimb: {
      layers: [
        { type: "sawtooth", from: 520, to: 312, seconds: 0.2, attack: 0.01, gain: 0.8, vibrato: { rate: 10, depth: 0.03 }, filter: { type: "bandpass", from: 1040, to: 832, q: 2 } },
        { type: "sawtooth", from: 468, to: 260, seconds: 0.26, delay: 0.17, attack: 0.01, gain: 0.55, filter: { type: "bandpass", from: 936, to: 624, q: 2 } },
      ],
    },
    // Dies: Cut-off scream.
    ghoulRunnerDie: {
      layers: [
        { type: "sawtooth", from: 900, to: 540, seconds: 0.25, attack: 0.03, gain: 0.8, vibrato: { rate: 12, depth: 0.04 }, filter: { type: "bandpass", from: 1800, to: 2160, q: 4 } },
        { type: "sawtooth", from: 1350, to: 810, seconds: 0.23, attack: 0.04, gain: 0.35, filter: { type: "bandpass", from: 2700, to: 2700, q: 5 } },
        { type: "noise", seconds: 0.2, attack: 0.03, gain: 0.3, filter: { type: "highpass", from: 3000, to: 3000 } },
        { type: "noise", seconds: 0.28, delay: 0.2, attack: 0, gain: 0.54, filter: { type: "lowpass", from: 2600, to: 200 } },
        { type: "square", from: 140, to: 40, seconds: 0.16, delay: 0.2, attack: 0, gain: 0.3, filter: { type: "lowpass", from: 600, to: 600 } },
        { type: "sine", from: 900, to: 1300, seconds: 0.05, delay: 0.4, gain: 0.15 },
        { type: "sine", from: 760, to: 1100, seconds: 0.05, delay: 0.54, gain: 0.11 },
      ],
    },
    // Glutton: huge and slow, fifteen bolts to bring down.
    // Comes in: Belly-deep groan.
    ghoulGluttonAppear: {
      layers: [
        { type: "sawtooth", from: 64, to: 45, seconds: 1.1, attack: 0.12, gain: 0.9, vibrato: { rate: 14, depth: 0.07 }, filter: { type: "lowpass", from: 600, to: 300, q: 5 } },
        { type: "sawtooth", from: 64, to: 45, seconds: 1.1, attack: 0.14, gain: 0.5, filter: { type: "lowpass", from: 480, to: 240, q: 3 } },
        { type: "brown", seconds: 1.1, attack: 0.1, gain: 0.6, filter: { type: "bandpass", from: 232, to: 174, q: 2 } },
      ],
    },
    // Takes a bolt: Annoyed grumble.
    ghoulGluttonHurt: {
      layers: [
        { type: "sine", from: 113, to: 87, seconds: 0.25, attack: 0.05, gain: 0.9, vibrato: { rate: 9, depth: 0.4 } },
        { type: "brown", seconds: 0.25, attack: 0.05, gain: 0.6, filter: { type: "lowpass", from: 750, to: 375 } },
      ],
    },
    // Dies: Final belch.
    ghoulGluttonDie: {
      layers: [
        { type: "sine", from: 106, to: 81, seconds: 0.5, attack: 0.05, gain: 0.9, vibrato: { rate: 9, depth: 0.4 } },
        { type: "brown", seconds: 0.5, attack: 0.05, gain: 0.6, filter: { type: "lowpass", from: 700, to: 350 } },
        { type: "sawtooth", from: 51, to: 36, seconds: 0.7, delay: 0.4, attack: 0.12, gain: 0.9, vibrato: { rate: 14, depth: 0.07 }, filter: { type: "lowpass", from: 600, to: 300, q: 5 } },
        { type: "sawtooth", from: 51, to: 36, seconds: 0.7, delay: 0.4, attack: 0.14, gain: 0.5, filter: { type: "lowpass", from: 480, to: 240, q: 3 } },
        { type: "brown", seconds: 0.7, delay: 0.4, attack: 0.1, gain: 0.6, filter: { type: "bandpass", from: 186, to: 139, q: 2 } },
      ],
    },
    // Crawler: a hand through the boards, then the rest of it.
    // Comes up through the boards: Low rattling growl.
    ghoulCrawlerAppear: {
      layers: [
        { type: "sawtooth", from: 133, to: 94, seconds: 0.7, attack: 0.12, gain: 0.9, vibrato: { rate: 40, depth: 0.07 }, filter: { type: "lowpass", from: 1400, to: 700, q: 5 } },
        { type: "sawtooth", from: 134, to: 94, seconds: 0.7, attack: 0.14, gain: 0.5, filter: { type: "lowpass", from: 1120, to: 560, q: 3 } },
        { type: "brown", seconds: 0.7, attack: 0.1, gain: 0.6, filter: { type: "bandpass", from: 484, to: 363, q: 2 } },
      ],
    },
    // Climbs up: Scratching hiss.
    ghoulCrawlerClimb: {
      layers: [
        { type: "noise", seconds: 0.3, attack: 0.06, gain: 0.8, filter: { type: "highpass", from: 2400, to: 5000 } },
        { type: "pink", seconds: 0.3, attack: 0.05, gain: 0.5, filter: { type: "bandpass", from: 3200, to: 2200, q: 2 } },
        { type: "square", from: 304, to: 213, seconds: 0.03, gain: 0.5, filter: { type: "bandpass", from: 457, to: 304, q: 4 } },
        { type: "square", from: 223, to: 156, seconds: 0.03, delay: 0.03, gain: 0.5, filter: { type: "bandpass", from: 335, to: 223, q: 4 } },
        { type: "square", from: 331, to: 232, seconds: 0.03, delay: 0.06, gain: 0.5, filter: { type: "bandpass", from: 497, to: 331, q: 4 } },
        { type: "square", from: 266, to: 186, seconds: 0.03, delay: 0.09, gain: 0.5, filter: { type: "bandpass", from: 398, to: 266, q: 4 } },
      ],
    },
    // Takes a bolt: Chatter.
    ghoulCrawlerHurt: {
      layers: [
        { type: "square", from: 545, to: 382, seconds: 0.03, gain: 0.5, filter: { type: "bandpass", from: 818, to: 545, q: 4 } },
        { type: "square", from: 695, to: 487, seconds: 0.03, delay: 0.03, gain: 0.5, filter: { type: "bandpass", from: 1043, to: 695, q: 4 } },
        { type: "square", from: 658, to: 461, seconds: 0.03, delay: 0.06, gain: 0.5, filter: { type: "bandpass", from: 987, to: 658, q: 4 } },
        { type: "square", from: 629, to: 440, seconds: 0.03, delay: 0.09, gain: 0.5, filter: { type: "bandpass", from: 943, to: 629, q: 4 } },
        { type: "square", from: 652, to: 456, seconds: 0.03, delay: 0.12, gain: 0.5, filter: { type: "bandpass", from: 978, to: 652, q: 4 } },
      ],
    },
    // Dies: Splat into the boards.
    ghoulCrawlerDie: {
      layers: [
        { type: "noise", seconds: 0.28, attack: 0, gain: 0.9, filter: { type: "lowpass", from: 2600, to: 200 } },
        { type: "square", from: 140, to: 40, seconds: 0.16, attack: 0, gain: 0.5, filter: { type: "lowpass", from: 600, to: 600 } },
        { type: "sine", from: 900, to: 1300, seconds: 0.05, delay: 0.2, gain: 0.25 },
        { type: "sine", from: 760, to: 1100, seconds: 0.05, delay: 0.34, gain: 0.18 },
        { type: "sine", from: 154, to: 56, seconds: 0.25, delay: 0.05, attack: 0, gain: 0.6 },
        { type: "brown", seconds: 0.2, delay: 0.05, attack: 0, gain: 0.48, filter: { type: "lowpass", from: 448, to: 448 } },
      ],
    },
    // Bat: roosts, then swoops at your chest.
    // Wakes and swoops: Chittering squeaks.
    ghoulBatWake: {
      layers: [
        { type: "sine", from: 1900, to: 2470, seconds: 0.08, attack: 0.01, gain: 0.8, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 2280, to: 2945, seconds: 0.07, delay: 0.1, attack: 0.01, gain: 0.6, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 2185, to: 2841, seconds: 0.08, delay: 0.18, attack: 0.01, gain: 0.8, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 2622, to: 3387, seconds: 0.07, delay: 0.28, attack: 0.01, gain: 0.6, vibrato: { rate: 40, depth: 0.08 } },
        { type: "pink", seconds: 0.07, delay: 0.3, attack: 0.01, gain: 0.9, filter: { type: "bandpass", from: 600, to: 260 } },
        { type: "pink", seconds: 0.07, delay: 0.39, attack: 0.01, gain: 0.6, filter: { type: "bandpass", from: 600, to: 260 } },
      ],
    },
    // Takes a bolt: Squeak.
    ghoulBatHurt: {
      layers: [
        { type: "sine", from: 2280, to: 2964, seconds: 0.08, attack: 0.01, gain: 0.8, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 2736, to: 3534, seconds: 0.07, delay: 0.1, attack: 0.01, gain: 0.6, vibrato: { rate: 40, depth: 0.08 } },
      ],
    },
    // Dies: Falling squeal.
    ghoulBatDie: {
      layers: [
        { type: "sawtooth", from: 2000, to: 1200, seconds: 0.45, attack: 0.03, gain: 0.8, vibrato: { rate: 12, depth: 0.04 }, filter: { type: "bandpass", from: 4000, to: 4800, q: 4 } },
        { type: "sawtooth", from: 3000, to: 1800, seconds: 0.41, attack: 0.04, gain: 0.35, filter: { type: "bandpass", from: 6000, to: 6000, q: 5 } },
        { type: "noise", seconds: 0.36, attack: 0.03, gain: 0.3, filter: { type: "highpass", from: 3000, to: 3000 } },
      ],
    },
    // Ghost: a sheet ghost fading in and out, only hit while solid.
    // Fades in: Rising wail.
    ghoulGhostAppear: {
      layers: [
        { type: "sine", from: 440, to: 660, seconds: 0.46, attack: 0.15, gain: 0.8, vibrato: { rate: 6, depth: 0.04 } },
        { type: "sine", from: 660, to: 308, seconds: 0.68, delay: 0.42, attack: 0.04, gain: 0.8, vibrato: { rate: 6, depth: 0.05 } },
        { type: "triangle", from: 884, to: 616, seconds: 1.1, attack: 0.3, gain: 0.2 },
        { type: "pink", seconds: 1.1, attack: 0.3, gain: 0.2, filter: { type: "bandpass", from: 880, to: 880, q: 8 } },
      ],
    },
    // Takes a bolt: Ooh-ooh.
    ghoulGhostHurt: {
      layers: [
        { type: "sine", from: 600, to: 900, seconds: 0.15, attack: 0.15, gain: 0.8, vibrato: { rate: 6, depth: 0.04 } },
        { type: "sine", from: 900, to: 420, seconds: 0.22, delay: 0.13, attack: 0.04, gain: 0.8, vibrato: { rate: 6, depth: 0.05 } },
        { type: "triangle", from: 1206, to: 840, seconds: 0.35, attack: 0.3, gain: 0.2 },
        { type: "pink", seconds: 0.35, attack: 0.3, gain: 0.2, filter: { type: "bandpass", from: 1200, to: 1200, q: 8 } },
      ],
    },
    // Banished: Descending chime.
    ghoulGhostDie: {
      layers: [
        { type: "sine", notes: [880, 739, 590, 440], seconds: 0.8, attack: 0.02, gain: 0.6, vibrato: { rate: 7, depth: 0.02 } },
        { type: "triangle", notes: [1320, 1109, 880, 660], seconds: 0.8, attack: 0.02, gain: 0.25 },
      ],
    },
    // Wraith: a hooded shade that hovers, shrieks, then dives.
    // Sees you: Deep breathy hiss.
    ghoulWraithNotice: {
      layers: [
        { type: "noise", seconds: 0.8, attack: 0.3, gain: 0.8, filter: { type: "highpass", from: 1440, to: 3000 } },
        { type: "pink", seconds: 0.8, attack: 0.05, gain: 0.5, filter: { type: "bandpass", from: 1920, to: 1320, q: 2 } },
        { type: "triangle", from: 105, to: 79, seconds: 1, attack: 0.25, gain: 0.45, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 980, to: 630 } },
        { type: "sine", from: 210, to: 158, seconds: 1, attack: 0.3, gain: 0.15 },
        { type: "pink", seconds: 1, attack: 0.3, gain: 0.13, filter: { type: "bandpass", from: 420, to: 315, q: 6 } },
      ],
    },
    // Shrieks: Demonic howl.
    ghoulWraithShriek: {
      layers: [
        { type: "sawtooth", from: 585, to: 819, seconds: 0.36, attack: 0.1, gain: 0.7, vibrato: { rate: 6, depth: 0.03 }, filter: { type: "bandpass", from: 1365, to: 1755, q: 3 } },
        { type: "sawtooth", from: 819, to: 507, seconds: 0.48, delay: 0.34, attack: 0.03, gain: 0.7, vibrato: { rate: 6, depth: 0.04 }, filter: { type: "bandpass", from: 1755, to: 975, q: 3 } },
        { type: "pink", seconds: 0.8, attack: 0.2, gain: 0.2, filter: { type: "bandpass", from: 1560, to: 1170, q: 4 } },
      ],
    },
    // Dives: Ghost-train swoop.
    ghoulWraithDive: {
      layers: [
        { type: "sine", from: 400, to: 600, seconds: 0.25, attack: 0.15, gain: 0.8, vibrato: { rate: 6, depth: 0.04 } },
        { type: "sine", from: 600, to: 280, seconds: 0.37, delay: 0.23, attack: 0.04, gain: 0.8, vibrato: { rate: 6, depth: 0.05 } },
        { type: "triangle", from: 804, to: 560, seconds: 0.6, attack: 0.3, gain: 0.2 },
        { type: "pink", seconds: 0.6, attack: 0.3, gain: 0.2, filter: { type: "bandpass", from: 800, to: 800, q: 8 } },
        { type: "noise", seconds: 0.5, attack: 0.18, gain: 0.56, filter: { type: "bandpass", from: 300, to: 1800, q: 1.5 } },
      ],
    },
    // Takes a bolt: Gasp.
    ghoulWraithHurt: {
      layers: [
        { type: "noise", seconds: 0.22, attack: 0.15, gain: 0.7, filter: { type: "bandpass", from: 1320, to: 2880, q: 4 } },
        { type: "sawtooth", from: 360, to: 468, seconds: 0.2, attack: 0.14, gain: 0.25, filter: { type: "lowpass", from: 1680, to: 1680 } },
      ],
    },
    // Destroyed: Hiss into nothing.
    ghoulWraithDie: {
      layers: [
        { type: "noise", seconds: 1, attack: 0.06, gain: 0.8, filter: { type: "highpass", from: 1680, to: 3500 } },
        { type: "pink", seconds: 1, attack: 0.05, gain: 0.5, filter: { type: "bandpass", from: 2240, to: 1540, q: 2 } },
        { type: "sine", notes: [500, 420, 335, 250], seconds: 0.9, attack: 0.02, gain: 0.36, vibrato: { rate: 7, depth: 0.02 } },
        { type: "triangle", notes: [750, 630, 500, 375], seconds: 0.9, attack: 0.02, gain: 0.15 },
      ],
    },
    // Skeleton: stands its ground and lobs bones.
    // Comes in: Hollow cackle.
    ghoulSkeletonAppear: {
      layers: [
        { type: "sawtooth", from: 520, to: 416, seconds: 0.09, attack: 0.01, gain: 0.7, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 1300, to: 1040, q: 3 } },
        { type: "sawtooth", from: 494, to: 395, seconds: 0.09, delay: 0.12, attack: 0.01, gain: 0.7, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 1235, to: 988, q: 3 } },
        { type: "sawtooth", from: 468, to: 374, seconds: 0.09, delay: 0.24, attack: 0.01, gain: 0.7, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 1170, to: 936, q: 3 } },
        { type: "sawtooth", from: 442, to: 354, seconds: 0.09, delay: 0.36, attack: 0.01, gain: 0.7, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 1105, to: 884, q: 3 } },
        { type: "sawtooth", from: 416, to: 333, seconds: 0.09, delay: 0.48, attack: 0.01, gain: 0.7, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 1040, to: 832, q: 3 } },
      ],
    },
    // Throws a bone: Arm creak and whoosh.
    ghoulSkeletonThrow: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.6, filter: { type: "bandpass", from: 1080, to: 720, q: 2 } },
        { type: "square", from: 540, to: 180, seconds: 0.05, attack: 0, gain: 0.24 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.42, filter: { type: "bandpass", from: 1560, to: 1080, q: 3 } },
        { type: "noise", seconds: 0.35, delay: 0.05, attack: 0.12, gain: 0.8, filter: { type: "bandpass", from: 360, to: 2160, q: 1.5 } },
      ],
    },
    // Takes a bolt: Rattle shake.
    ghoulSkeletonHurt: {
      layers: [
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2693, to: 2154, q: 6 } },
        { type: "square", from: 727, to: 723, seconds: 0.02, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.03, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 4164, to: 3332, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2447, to: 1958, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.09, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2834, to: 2267, q: 6 } },
      ],
    },
    // Falls apart: Xylophone tumble.
    ghoulSkeletonDie: {
      layers: [
        { type: "sine", notes: [1200, 1008, 804, 600], seconds: 0.5, attack: 0.02, gain: 0.6, vibrato: { rate: 7, depth: 0.02 } },
        { type: "triangle", notes: [1800, 1512, 1200, 900], seconds: 0.5, attack: 0.02, gain: 0.25 },
        { type: "noise", seconds: 0.05, delay: 0.4, attack: 0, filter: { type: "bandpass", from: 1080, to: 720, q: 2 } },
        { type: "square", from: 540, to: 180, seconds: 0.05, delay: 0.4, attack: 0, gain: 0.4 },
        { type: "noise", seconds: 0.04, delay: 0.46, attack: 0, gain: 0.7, filter: { type: "bandpass", from: 1560, to: 1080, q: 3 } },
      ],
    },
    // Gourdling: a little gourd the Rotting Gourd shakes loose.
    // Pops out: Tiny cackle.
    ghoulGourdlingAppear: {
      layers: [
        { type: "sawtooth", from: 700, to: 560, seconds: 0.09, attack: 0.01, gain: 0.7, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 1750, to: 1400, q: 3 } },
        { type: "sawtooth", from: 665, to: 532, seconds: 0.09, delay: 0.08, attack: 0.01, gain: 0.7, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 1663, to: 1330, q: 3 } },
        { type: "sawtooth", from: 630, to: 504, seconds: 0.09, delay: 0.16, attack: 0.01, gain: 0.7, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 1575, to: 1260, q: 3 } },
        { type: "sawtooth", from: 595, to: 476, seconds: 0.09, delay: 0.24, attack: 0.01, gain: 0.7, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 1488, to: 1190, q: 3 } },
      ],
    },
    // Hops up: Wee squeak.
    ghoulGourdlingHop: {
      layers: [
        { type: "sine", from: 900, to: 1170, seconds: 0.08, attack: 0.01, gain: 0.8, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 1080, to: 1395, seconds: 0.07, delay: 0.1, attack: 0.01, gain: 0.6, vibrato: { rate: 40, depth: 0.08 } },
      ],
    },
    // Dies: Tiny scream.
    ghoulGourdlingDie: {
      layers: [
        { type: "sawtooth", from: 1300, to: 780, seconds: 0.25, attack: 0.03, gain: 0.8, vibrato: { rate: 12, depth: 0.04 }, filter: { type: "bandpass", from: 2600, to: 3120, q: 4 } },
        { type: "sawtooth", from: 1950, to: 1170, seconds: 0.23, attack: 0.04, gain: 0.35, filter: { type: "bandpass", from: 3900, to: 3900, q: 5 } },
        { type: "noise", seconds: 0.2, attack: 0.03, gain: 0.3, filter: { type: "highpass", from: 3000, to: 3000 } },
      ],
    },
    // Hellhound: prowls low, growls, then lunges.
    // Comes in: Rumbling growl.
    ghoulHoundAppear: {
      layers: [
        { type: "sawtooth", from: 115, to: 82, seconds: 0.9, attack: 0.12, gain: 0.9, vibrato: { rate: 30, depth: 0.07 }, filter: { type: "lowpass", from: 1400, to: 700, q: 5 } },
        { type: "sawtooth", from: 116, to: 81, seconds: 0.9, attack: 0.14, gain: 0.5, filter: { type: "lowpass", from: 1120, to: 560, q: 3 } },
        { type: "brown", seconds: 0.9, attack: 0.1, gain: 0.6, filter: { type: "bandpass", from: 418, to: 314, q: 2 } },
      ],
    },
    // Growls: Snarl.
    ghoulHoundGrowl: {
      layers: [
        { type: "sawtooth", from: 152, to: 114, seconds: 0.5, attack: 0.03, gain: 0.9, vibrato: { rate: 45, depth: 0.2 }, filter: { type: "bandpass", from: 855, to: 475, q: 3 } },
        { type: "noise", seconds: 0.45, attack: 0.02, gain: 0.5, filter: { type: "bandpass", from: 1600, to: 700, q: 1.5 } },
        { type: "square", from: 76, to: 67, seconds: 0.5, attack: 0.03, gain: 0.35, filter: { type: "lowpass", from: 500, to: 500 } },
      ],
    },
    // Lunges: Roaring leap.
    ghoulHoundLunge: {
      layers: [
        { type: "sawtooth", from: 111, to: 142, seconds: 0.18, attack: 0.05, gain: 0.9, vibrato: { rate: 30, depth: 0.1 }, filter: { type: "lowpass", from: 300, to: 3080, q: 4 } },
        { type: "sawtooth", from: 142, to: 86, seconds: 0.35, delay: 0.15, attack: 0.02, gain: 0.9, vibrato: { rate: 30, depth: 0.12 }, filter: { type: "lowpass", from: 3080, to: 260, q: 4 } },
        { type: "sawtooth", from: 62, to: 44, seconds: 0.5, attack: 0.08, gain: 0.6, filter: { type: "lowpass", from: 500, to: 500 } },
        { type: "brown", seconds: 0.5, attack: 0.06, gain: 0.8, filter: { type: "lowpass", from: 900, to: 180 } },
        { type: "sine", from: 62, to: 43, seconds: 0.5, attack: 0.05, gain: 0.7 },
      ],
    },
    // Takes a bolt: Grunt.
    ghoulHoundHurt: {
      layers: [
        { type: "sawtooth", from: 124, to: 86, seconds: 0.16, attack: 0.01, gain: 0.9, vibrato: { rate: 30, depth: 0.1 }, filter: { type: "lowpass", from: 1540, to: 1540 } },
        { type: "brown", seconds: 0.13, attack: 0.01, gain: 0.6, filter: { type: "lowpass", from: 500, to: 500 } },
      ],
    },
    // Dies: Dying howl.
    ghoulHoundDie: {
      layers: [
        { type: "sawtooth", from: 257, to: 359, seconds: 0.45, attack: 0.1, gain: 0.7, vibrato: { rate: 6, depth: 0.03 }, filter: { type: "bandpass", from: 599, to: 770, q: 3 } },
        { type: "sawtooth", from: 359, to: 222, seconds: 0.6, delay: 0.42, attack: 0.03, gain: 0.7, vibrato: { rate: 6, depth: 0.04 }, filter: { type: "bandpass", from: 770, to: 428, q: 3 } },
        { type: "pink", seconds: 1, attack: 0.2, gain: 0.2, filter: { type: "bandpass", from: 684, to: 513, q: 4 } },
      ],
    },
    // Widow: hangs from the ceiling, drops when you pass under.
    // Drops down: Skittering legs.
    ghoulWidowAppear: {
      layers: [
        { type: "square", from: 3600, to: 2520, seconds: 0.03, gain: 0.5, filter: { type: "bandpass", from: 5400, to: 3600, q: 4 } },
        { type: "square", from: 2992, to: 2095, seconds: 0.03, delay: 0.03, gain: 0.5, filter: { type: "bandpass", from: 4488, to: 2992, q: 4 } },
        { type: "square", from: 3080, to: 2156, seconds: 0.03, delay: 0.05, gain: 0.5, filter: { type: "bandpass", from: 4620, to: 3080, q: 4 } },
        { type: "square", from: 3580, to: 2506, seconds: 0.03, delay: 0.08, gain: 0.5, filter: { type: "bandpass", from: 5371, to: 3580, q: 4 } },
        { type: "square", from: 3921, to: 2745, seconds: 0.03, delay: 0.1, gain: 0.5, filter: { type: "bandpass", from: 5881, to: 3921, q: 4 } },
        { type: "square", from: 3222, to: 2256, seconds: 0.03, delay: 0.13, gain: 0.5, filter: { type: "bandpass", from: 4833, to: 3222, q: 4 } },
        { type: "square", from: 3283, to: 2298, seconds: 0.03, delay: 0.15, gain: 0.5, filter: { type: "bandpass", from: 4924, to: 3283, q: 4 } },
        { type: "square", from: 3176, to: 2223, seconds: 0.03, delay: 0.18, gain: 0.5, filter: { type: "bandpass", from: 4764, to: 3176, q: 4 } },
        { type: "square", from: 3596, to: 2517, seconds: 0.03, delay: 0.2, gain: 0.5, filter: { type: "bandpass", from: 5393, to: 3596, q: 4 } },
        { type: "square", from: 4139, to: 2897, seconds: 0.03, delay: 0.23, gain: 0.5, filter: { type: "bandpass", from: 6209, to: 4139, q: 4 } },
        { type: "square", from: 3230, to: 2261, seconds: 0.03, delay: 0.25, gain: 0.5, filter: { type: "bandpass", from: 4845, to: 3230, q: 4 } },
        { type: "square", from: 3105, to: 2173, seconds: 0.03, delay: 0.28, gain: 0.5, filter: { type: "bandpass", from: 4657, to: 3105, q: 4 } },
      ],
    },
    // Takes a bolt: Squeak-hiss.
    ghoulWidowHurt: {
      layers: [
        { type: "noise", seconds: 0.15, attack: 0.01, gain: 0.8, filter: { type: "highpass", from: 2400, to: 5000 } },
        { type: "pink", seconds: 0.15, attack: 0.05, gain: 0.5, filter: { type: "bandpass", from: 3200, to: 2200, q: 2 } },
        { type: "sine", from: 1400, to: 1820, seconds: 0.08, attack: 0.01, gain: 0.4, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 1680, to: 2170, seconds: 0.07, delay: 0.1, attack: 0.01, gain: 0.3, vibrato: { rate: 40, depth: 0.08 } },
      ],
    },
    // Dies: Thin squeal.
    ghoulWidowDie: {
      layers: [
        { type: "sawtooth", from: 2200, to: 1320, seconds: 0.35, attack: 0.03, gain: 0.8, vibrato: { rate: 12, depth: 0.04 }, filter: { type: "bandpass", from: 4400, to: 5280, q: 4 } },
        { type: "sawtooth", from: 3300, to: 1980, seconds: 0.32, attack: 0.04, gain: 0.35, filter: { type: "bandpass", from: 6600, to: 6600, q: 5 } },
        { type: "noise", seconds: 0.28, attack: 0.03, gain: 0.3, filter: { type: "highpass", from: 3000, to: 3000 } },
      ],
    },
    // Huntsman: a big floor spider that crouches and springs.
    // Comes in: Heavy skitter.
    ghoulHuntsmanAppear: {
      layers: [
        { type: "square", from: 850, to: 595, seconds: 0.03, gain: 0.5, filter: { type: "bandpass", from: 1275, to: 850, q: 4 } },
        { type: "square", from: 846, to: 592, seconds: 0.03, delay: 0.04, gain: 0.5, filter: { type: "bandpass", from: 1269, to: 846, q: 4 } },
        { type: "square", from: 800, to: 560, seconds: 0.03, delay: 0.07, gain: 0.5, filter: { type: "bandpass", from: 1200, to: 800, q: 4 } },
        { type: "square", from: 705, to: 494, seconds: 0.03, delay: 0.11, gain: 0.5, filter: { type: "bandpass", from: 1058, to: 705, q: 4 } },
        { type: "square", from: 579, to: 405, seconds: 0.03, delay: 0.14, gain: 0.5, filter: { type: "bandpass", from: 868, to: 579, q: 4 } },
        { type: "square", from: 848, to: 594, seconds: 0.03, delay: 0.18, gain: 0.5, filter: { type: "bandpass", from: 1272, to: 848, q: 4 } },
        { type: "square", from: 559, to: 392, seconds: 0.03, delay: 0.21, gain: 0.5, filter: { type: "bandpass", from: 839, to: 559, q: 4 } },
        { type: "square", from: 804, to: 563, seconds: 0.03, delay: 0.25, gain: 0.5, filter: { type: "bandpass", from: 1206, to: 804, q: 4 } },
        { type: "square", from: 646, to: 452, seconds: 0.03, delay: 0.28, gain: 0.5, filter: { type: "bandpass", from: 969, to: 646, q: 4 } },
        { type: "square", from: 838, to: 586, seconds: 0.03, delay: 0.32, gain: 0.5, filter: { type: "bandpass", from: 1257, to: 838, q: 4 } },
        { type: "square", from: 554, to: 388, seconds: 0.03, delay: 0.35, gain: 0.5, filter: { type: "bandpass", from: 831, to: 554, q: 4 } },
        { type: "square", from: 658, to: 461, seconds: 0.03, delay: 0.39, gain: 0.5, filter: { type: "bandpass", from: 987, to: 658, q: 4 } },
      ],
    },
    // Crouches: Rattle.
    ghoulHuntsmanGrowl: {
      layers: [
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1324, to: 1060, q: 6 } },
        { type: "square", from: 325, to: 295, seconds: 0.02, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.07, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1098, to: 879, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.13, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1271, to: 1017, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.18, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1530, to: 1224, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.24, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1482, to: 1185, q: 6 } },
        { type: "square", from: 419, to: 317, seconds: 0.02, delay: 0.24, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.3, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1106, to: 885, q: 6 } },
      ],
    },
    // Springs: Snapping jaws.
    ghoulHuntsmanLunge: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, filter: { type: "bandpass", from: 1080, to: 720, q: 2 } },
        { type: "square", from: 540, to: 180, seconds: 0.05, attack: 0, gain: 0.4 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.7, filter: { type: "bandpass", from: 1560, to: 1080, q: 3 } },
        { type: "noise", seconds: 0.05, delay: 0.15, attack: 0, filter: { type: "bandpass", from: 1260, to: 840, q: 2 } },
        { type: "square", from: 630, to: 210, seconds: 0.05, delay: 0.15, attack: 0, gain: 0.4 },
        { type: "noise", seconds: 0.04, delay: 0.21, attack: 0, gain: 0.7, filter: { type: "bandpass", from: 1820, to: 1260, q: 3 } },
        { type: "noise", seconds: 0.35, attack: 0.12, gain: 0.4, filter: { type: "bandpass", from: 300, to: 1800, q: 1.5 } },
      ],
    },
    // Takes a bolt: Squeal.
    ghoulHuntsmanHurt: {
      layers: [
        { type: "sawtooth", from: 1600, to: 2240, seconds: 0.14, attack: 0.03, gain: 0.8, vibrato: { rate: 12, depth: 0.04 }, filter: { type: "bandpass", from: 3200, to: 3840, q: 4 } },
        { type: "sawtooth", from: 2400, to: 3360, seconds: 0.13, attack: 0.04, gain: 0.35, filter: { type: "bandpass", from: 4800, to: 4800, q: 5 } },
        { type: "noise", seconds: 0.11, attack: 0.03, gain: 0.3, filter: { type: "highpass", from: 3000, to: 3000 } },
      ],
    },
    // Dies: Death screech.
    ghoulHuntsmanDie: {
      layers: [
        { type: "sawtooth", from: 1500, to: 900, seconds: 0.8, attack: 0.03, gain: 0.8, vibrato: { rate: 12, depth: 0.04 }, filter: { type: "bandpass", from: 3000, to: 3600, q: 4 } },
        { type: "sawtooth", from: 2250, to: 1350, seconds: 0.72, attack: 0.04, gain: 0.35, filter: { type: "bandpass", from: 4500, to: 4500, q: 5 } },
        { type: "noise", seconds: 0.64, attack: 0.03, gain: 0.3, filter: { type: "highpass", from: 3000, to: 3000 } },
      ],
    },
    // Bloater: swollen with acid, spits it, bursts when it dies.
    // Comes in: Bubbling gut.
    ghoulBloaterAppear: {
      layers: [
        { type: "sine", from: 91, to: 70, seconds: 0.7, attack: 0.05, gain: 0.9, vibrato: { rate: 9, depth: 0.4 } },
        { type: "brown", seconds: 0.7, attack: 0.05, gain: 0.6, filter: { type: "lowpass", from: 500, to: 250 } },
        { type: "sine", from: 804, to: 1367, seconds: 0.05, delay: 0.48, attack: 0, gain: 0.35 },
        { type: "sine", from: 669, to: 1138, seconds: 0.05, delay: 0.13, attack: 0, gain: 0.35 },
        { type: "sine", from: 378, to: 642, seconds: 0.05, delay: 0.15, attack: 0, gain: 0.35 },
        { type: "sine", from: 564, to: 959, seconds: 0.05, delay: 0.04, attack: 0, gain: 0.35 },
        { type: "sine", from: 872, to: 1483, seconds: 0.05, delay: 0.33, attack: 0, gain: 0.35 },
        { type: "sine", from: 693, to: 1178, seconds: 0.05, delay: 0.43, attack: 0, gain: 0.35 },
      ],
    },
    // Spits acid: Bubbling hurl.
    ghoulBloaterSpit: {
      layers: [
        { type: "sine", from: 797, to: 1355, seconds: 0.05, delay: 0.06, attack: 0, gain: 0.35 },
        { type: "sine", from: 311, to: 529, seconds: 0.05, delay: 0.17, attack: 0, gain: 0.35 },
        { type: "sine", from: 692, to: 1176, seconds: 0.05, delay: 0.14, attack: 0, gain: 0.35 },
        { type: "sine", from: 408, to: 693, seconds: 0.05, delay: 0.19, attack: 0, gain: 0.35 },
        { type: "noise", seconds: 0.1, delay: 0.2, attack: 0, gain: 0.8, filter: { type: "highpass", from: 1260, to: 1260 } },
        { type: "sine", from: 490, to: 105, seconds: 0.16, delay: 0.22, gain: 0.6 },
        { type: "brown", seconds: 0.12, delay: 0.2, attack: 0, gain: 0.5, filter: { type: "lowpass", from: 294, to: 294 } },
      ],
    },
    // Takes a bolt: Fizz.
    ghoulBloaterHurt: {
      layers: [
        { type: "noise", seconds: 0.2, attack: 0.06, gain: 0.8, filter: { type: "highpass", from: 2160, to: 4500 } },
        { type: "pink", seconds: 0.2, attack: 0.05, gain: 0.5, filter: { type: "bandpass", from: 2880, to: 1980, q: 2 } },
        { type: "sine", from: 738, to: 1255, seconds: 0.05, delay: 0.07, attack: 0, gain: 0.35 },
        { type: "sine", from: 437, to: 744, seconds: 0.05, delay: 0.04, attack: 0, gain: 0.35 },
        { type: "sine", from: 307, to: 522, seconds: 0.05, delay: 0.02, attack: 0, gain: 0.35 },
      ],
    },
    // Bursts: Balloon pop and sizzle.
    ghoulBloaterDie: {
      layers: [
        { type: "noise", seconds: 0.5, attack: 0, filter: { type: "lowpass", from: 5880, to: 210 } },
        { type: "sine", from: 224, to: 49, seconds: 0.4, attack: 0, gain: 0.9 },
        { type: "brown", seconds: 0.6, attack: 0.01, gain: 0.7, filter: { type: "lowpass", from: 560, to: 560 } },
        { type: "noise", seconds: 0.8, delay: 0.12, attack: 0.06, gain: 0.48, filter: { type: "highpass", from: 1920, to: 4000 } },
        { type: "pink", seconds: 0.8, delay: 0.12, attack: 0.05, gain: 0.3, filter: { type: "bandpass", from: 2560, to: 1760, q: 2 } },
      ],
    },
    // The Rotting Gourd: ballroom boss: hops onto you, spits acid, quakes the floor.
    // Wakes up: Evil belly laugh.
    ghoulGourdWake: {
      layers: [
        { type: "sawtooth", from: 140, to: 112, seconds: 0.09, attack: 0.01, gain: 0.7, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 350, to: 280, q: 3 } },
        { type: "sawtooth", from: 133, to: 106, seconds: 0.09, delay: 0.15, attack: 0.01, gain: 0.7, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 333, to: 266, q: 3 } },
        { type: "sawtooth", from: 126, to: 101, seconds: 0.09, delay: 0.3, attack: 0.01, gain: 0.7, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 315, to: 252, q: 3 } },
        { type: "sawtooth", from: 119, to: 95, seconds: 0.09, delay: 0.45, attack: 0.01, gain: 0.7, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 298, to: 238, q: 3 } },
        { type: "sawtooth", from: 112, to: 90, seconds: 0.09, delay: 0.6, attack: 0.01, gain: 0.7, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 280, to: 224, q: 3 } },
        { type: "sawtooth", from: 105, to: 84, seconds: 0.09, delay: 0.75, attack: 0.01, gain: 0.7, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 263, to: 210, q: 3 } },
        { type: "brown", seconds: 1.1, attack: 0.08, gain: 0.5, filter: { type: "lowpass", from: 180, to: 70 } },
        { type: "sine", from: 48, to: 30, seconds: 1.1, attack: 0.05, gain: 0.4 },
      ],
    },
    // Hops: Snarl.
    ghoulGourdHop: {
      layers: [
        { type: "sawtooth", from: 100, to: 75, seconds: 0.4, attack: 0.03, gain: 0.9, vibrato: { rate: 27, depth: 0.2 }, filter: { type: "bandpass", from: 562, to: 312, q: 3 } },
        { type: "noise", seconds: 0.36, attack: 0.02, gain: 0.5, filter: { type: "bandpass", from: 2080, to: 910, q: 1.5 } },
        { type: "square", from: 50, to: 44, seconds: 0.4, attack: 0.03, gain: 0.35, filter: { type: "lowpass", from: 650, to: 650 } },
      ],
    },
    // Lands / quakes: Splat-boom.
    ghoulGourdSlam: {
      layers: [
        { type: "sine", from: 66, to: 24, seconds: 0.25, attack: 0 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.8, filter: { type: "lowpass", from: 192, to: 192 } },
        { type: "noise", seconds: 0.28, attack: 0, gain: 0.9, filter: { type: "lowpass", from: 1300, to: 100 } },
        { type: "square", from: 70, to: 20, seconds: 0.16, attack: 0, gain: 0.5, filter: { type: "lowpass", from: 300, to: 300 } },
        { type: "sine", from: 450, to: 650, seconds: 0.05, delay: 0.2, gain: 0.25 },
        { type: "sine", from: 380, to: 550, seconds: 0.05, delay: 0.34, gain: 0.18 },
        { type: "brown", seconds: 0.6, attack: 0.08, gain: 0.6, filter: { type: "lowpass", from: 180, to: 70 } },
        { type: "sine", from: 48, to: 30, seconds: 0.6, attack: 0.05, gain: 0.48 },
      ],
    },
    // Spits acid: Big hock and spit.
    ghoulGourdSpit: {
      layers: [
        { type: "sine", from: 154, to: 115, seconds: 0.35, attack: 0.05, gain: 0.9, vibrato: { rate: 15, depth: 0.4 } },
        { type: "brown", seconds: 0.35, attack: 0.05, gain: 0.7, filter: { type: "lowpass", from: 700, to: 300 } },
        { type: "sine", from: 230, to: 184, seconds: 0.24, delay: 0.05, attack: 0.03, gain: 0.4, vibrato: { rate: 9, depth: 0.5 } },
        { type: "noise", seconds: 0.1, delay: 0.3, attack: 0, gain: 0.8, filter: { type: "highpass", from: 1080, to: 1080 } },
        { type: "sine", from: 420, to: 90, seconds: 0.16, delay: 0.32, gain: 0.6 },
        { type: "brown", seconds: 0.12, delay: 0.3, attack: 0, gain: 0.5, filter: { type: "lowpass", from: 252, to: 252 } },
      ],
    },
    // Takes a hit: Snarl.
    ghoulGourdHurt: {
      layers: [
        { type: "sawtooth", from: 115, to: 86, seconds: 0.25, attack: 0.03, gain: 0.9, vibrato: { rate: 27, depth: 0.2 }, filter: { type: "bandpass", from: 648, to: 360, q: 3 } },
        { type: "noise", seconds: 0.23, attack: 0.02, gain: 0.5, filter: { type: "bandpass", from: 2400, to: 1050, q: 1.5 } },
        { type: "square", from: 58, to: 50, seconds: 0.25, attack: 0.03, gain: 0.35, filter: { type: "lowpass", from: 750, to: 750 } },
      ],
    },
    // Dies: Long dying roar.
    ghoulGourdDie: {
      layers: [
        { type: "sawtooth", from: 39, to: 50, seconds: 0.42, attack: 0.05, gain: 0.9, vibrato: { rate: 18, depth: 0.1 }, filter: { type: "lowpass", from: 300, to: 1144, q: 4 } },
        { type: "sawtooth", from: 50, to: 30, seconds: 0.84, delay: 0.36, attack: 0.02, gain: 0.9, vibrato: { rate: 18, depth: 0.12 }, filter: { type: "lowpass", from: 1144, to: 260, q: 4 } },
        { type: "sawtooth", from: 22, to: 20, seconds: 1.2, attack: 0.08, gain: 0.6, filter: { type: "lowpass", from: 500, to: 500 } },
        { type: "brown", seconds: 1.2, attack: 0.06, gain: 0.8, filter: { type: "lowpass", from: 900, to: 180 } },
        { type: "sine", from: 22, to: 20, seconds: 1.2, attack: 0.05, gain: 0.7 },
      ],
    },
    // Old Rattlebones: crypt boss: bone volleys, shockwave slams, aim for the skull.
    // Wakes up: Groaning awakening.
    ghoulBonesWake: {
      layers: [
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 3091, to: 2473, q: 6 } },
        { type: "square", from: 970, to: 573, seconds: 0.02, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.04, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 3321, to: 2657, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.1, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 3127, to: 2502, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.17, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2508, to: 2007, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.26, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2504, to: 2003, q: 6 } },
        { type: "square", from: 1185, to: 617, seconds: 0.02, delay: 0.26, gain: 0.3 },
        { type: "sawtooth", from: 68, to: 48, seconds: 0.85, delay: 0.3, attack: 0.12, gain: 0.9, vibrato: { rate: 24, depth: 0.07 }, filter: { type: "lowpass", from: 800, to: 400, q: 5 } },
        { type: "sawtooth", from: 69, to: 48, seconds: 0.85, delay: 0.3, attack: 0.14, gain: 0.5, filter: { type: "lowpass", from: 640, to: 320, q: 3 } },
        { type: "brown", seconds: 0.85, delay: 0.3, attack: 0.1, gain: 0.6, filter: { type: "bandpass", from: 248, to: 186, q: 2 } },
      ],
    },
    // Winds up: Rattle shake.
    ghoulBonesWindup: {
      layers: [
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2222, to: 1778, q: 6 } },
        { type: "square", from: 589, to: 418, seconds: 0.02, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.03, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2012, to: 1610, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.08, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1643, to: 1314, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.12, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1745, to: 1396, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.16, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1756, to: 1405, q: 6 } },
        { type: "square", from: 558, to: 419, seconds: 0.02, delay: 0.16, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.21, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1994, to: 1595, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.25, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2329, to: 1863, q: 6 } },
      ],
    },
    // Throws a volley: Triple whoosh.
    ghoulBonesThrow: {
      layers: [
        { type: "noise", seconds: 0.18, attack: 0.06, gain: 0.8, filter: { type: "bandpass", from: 420, to: 2520, q: 1.5 } },
        { type: "noise", seconds: 0.18, delay: 0.1, attack: 0.06, gain: 0.8, filter: { type: "bandpass", from: 450, to: 2700, q: 1.5 } },
        { type: "noise", seconds: 0.18, delay: 0.2, attack: 0.06, gain: 0.8, filter: { type: "bandpass", from: 480, to: 2880, q: 1.5 } },
      ],
    },
    // Slams: Bone-crunching boom.
    ghoulBonesSlam: {
      layers: [
        { type: "sine", from: 55, to: 20, seconds: 0.25, attack: 0 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.8, filter: { type: "lowpass", from: 160, to: 160 } },
        { type: "noise", seconds: 0.05, attack: 0, filter: { type: "bandpass", from: 720, to: 480, q: 2 } },
        { type: "square", from: 360, to: 120, seconds: 0.05, attack: 0, gain: 0.4 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.7, filter: { type: "bandpass", from: 1040, to: 720, q: 3 } },
        { type: "brown", seconds: 0.8, attack: 0.08, filter: { type: "lowpass", from: 180, to: 70 } },
        { type: "sine", from: 48, to: 30, seconds: 0.8, attack: 0.05, gain: 0.8 },
      ],
    },
    // Takes a hit: Rattle jolt.
    ghoulBonesHurt: {
      layers: [
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2212, to: 1770, q: 6 } },
        { type: "square", from: 719, to: 551, seconds: 0.02, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.02, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2601, to: 2081, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.05, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2431, to: 1945, q: 6 } },
      ],
    },
    // Dies: Crumble to dust.
    ghoulBonesDie: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, filter: { type: "bandpass", from: 900, to: 600, q: 2 } },
        { type: "square", from: 450, to: 150, seconds: 0.05, attack: 0, gain: 0.4 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.7, filter: { type: "bandpass", from: 1300, to: 900, q: 3 } },
        { type: "noise", seconds: 0.04, delay: 0.1, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 3710, to: 2968, q: 6 } },
        { type: "square", from: 1123, to: 648, seconds: 0.02, delay: 0.1, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.13, attack: 0, gain: 0.79, filter: { type: "bandpass", from: 3316, to: 2653, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.17, attack: 0, gain: 0.68, filter: { type: "bandpass", from: 4184, to: 3347, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.22, attack: 0, gain: 0.58, filter: { type: "bandpass", from: 2514, to: 2011, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.3, attack: 0, gain: 0.47, filter: { type: "bandpass", from: 3048, to: 2438, q: 6 } },
        { type: "square", from: 716, to: 602, seconds: 0.02, delay: 0.3, gain: 0.3 },
        { type: "noise", seconds: 0.79, delay: 0.4, attack: 0.2, gain: 0.8, filter: { type: "highpass", from: 960, to: 2000 } },
        { type: "pink", seconds: 0.79, delay: 0.4, attack: 0.05, gain: 0.5, filter: { type: "bandpass", from: 1280, to: 880, q: 2 } },
      ],
    },
  },
  hums: {
    // A zombie close by: a low, wet moan swelling and fading, pitched a
    // little per zombie and louder the closer it shambles.
    ghoulMoan: { parts: [{ type: "sawtooth", freq: 92 }, { type: "sawtooth", freq: 93.5, gain: 0.6 }], noise: { color: "pink", gain: 0.25 }, filter: { type: "bandpass", freq: 420, q: 2.5, follow: 0.8 }, pulse: { rate: 0.7, depth: 0.7 }, peak: 0.035 },
    // Bat wings flapping near: a soft, fast flutter of noise.
    ghoulFlutter: { noise: { color: "pink", gain: 1 }, filter: { type: "bandpass", freq: 1100, q: 1.4, follow: 1 }, pulse: { rate: 14, depth: 0.85 }, peak: 0.03 },
    // A ghost or a wraith near: a thin, wavering whistle.
    ghoulSpecter: { parts: [{ type: "sine", freq: 620 }, { type: "sine", freq: 627, gain: 0.7 }, { type: "triangle", freq: 930, gain: 0.15 }], filter: { type: "lowpass", freq: 1800, q: 1, follow: 1 }, pulse: { rate: 0.9, depth: 0.6 }, peak: 0.02 },
    // A hellhound or a widow near: a low growl's rasp.
    ghoulSnarl: { parts: [{ type: "sawtooth", freq: 62 }, { type: "square", freq: 31, gain: 0.4 }], noise: { color: "brown", gain: 0.4 }, filter: { type: "lowpass", freq: 380, q: 3, follow: 0.8 }, pulse: { rate: 9, depth: 0.5 }, peak: 0.035 },
    // A boss in the arena: a deep, heaving breath of a drone (the game
    // pitches it up as the boss's hp runs down).
    ghoulBoss: { parts: [{ type: "sawtooth", freq: 41 }, { type: "sawtooth", freq: 41.6, gain: 0.8 }, { type: "sine", freq: 61.7, gain: 0.5 }], noise: { color: "brown", gain: 0.3 }, filter: { type: "lowpass", freq: 260, q: 4, follow: 0.9 }, pulse: { rate: 0.6, depth: 0.55 }, peak: 0.05 },
    // A chandelier shaking loose: its chains and crystals jingling.
    ghoulChains: { parts: [{ type: "triangle", freq: 2600, gain: 0.3 }], noise: { color: "noise", gain: 1 }, filter: { type: "bandpass", freq: 3800, q: 3, follow: 1 }, pulse: { rate: 17, depth: 0.9 }, peak: 0.03 },
    // The blaster running hot: a fizzing whine that climbs with the heat.
    ghoulHeat: { parts: [{ type: "triangle", freq: 440, gain: 0.4 }], noise: { color: "noise", gain: 0.6 }, filter: { type: "bandpass", freq: 2400, q: 2, follow: 1 }, pulse: { rate: 11, depth: 0.4 }, peak: 0.02 },
    // The garlic shield held: a faint, glassy shimmer around Planny, kept low
    // (pure tones this high carry far louder than a noisy hum at the same peak).
    ghoulGarlic: { parts: [{ type: "sine", freq: 1319 }, { type: "sine", freq: 1325, gain: 0.8 }, { type: "sine", freq: 1976, gain: 0.3 }], filter: { type: "lowpass", freq: 3000, q: 0.7, follow: 0 }, pulse: { rate: 3, depth: 0.5 }, peak: 0.004 },
  },
  // The music: a track for each room, picked in prototypes/music/ghoul-rush.
  // Each builds with the dread: the drone and bass alone in a quiet stretch,
  // then the rest as the monsters close in, all of it in a boss fight.
  music: {
    // The Foyer: haunted music box. A slow, slightly warped music box in A
    // minor over a low A drone that never lets go; listen for the heartbeat
    // kick, the chromatic sawtooth creeping down underneath, and the sparse
    // Neapolitan B-flat turn in the middle.
    ghoulFoyer: {
      bpm: 72,
      rush: 6,
      voices: {
        drone: { wave: "sine", gain: 0.6, decay: 0.3, sustain: 0.9 },
        bass: { wave: "triangle", gain: 0.7, decay: 0.15, sustain: 0.55 },
        box: { wave: "triangle", gain: 0.22, from: 0.25, decay: 0.03, sustain: 0.15, vibrato: { rate: 0.6, depth: 0.007, delay: 0 } },
        heart: { kit: true, gain: 0.45, from: 0.4 },
        lead: { wave: "pulse", duty: 0.25, gain: 0.18, from: 0.6, decay: 0.1, sustain: 0.6, vibrato: { rate: 4.5, depth: 0.01, delay: 0.25 } },
        creep: { wave: "sawtooth", gain: 0.13, from: 0.85, decay: 0.2, sustain: 0.8 },
      },
      patterns: {
        A: {
          drone:
          "A1 - - - - - - - - - - - - - - - | A1 - - - - - - - - - - - - - - - | " +
          "A1 - - - - - - - - - - - - - - - | A1 - - - - - - - - - - - - - - -",
          bass:
          "A2 - - - - - - - E2 - - - - - - - | D2 - - - - - - - A2 - - - - - - - | " +
          "A2 - - - - - - - E2 - - - - - - - | E2 - - - - - - - G#2 - - - - - - -",
          box:
          "A4 . C5 . E5 . C5 . B4 . C5 . E5 . C5 . | A4 . D5 . F5 . D5 . E5 . D5 . F5 . D5 . | " +
          "A4 . C5 . E5 . C5 . B4 . C5 . E5 . C5 . | G#4 . B4 . D5 . B4 . F5 . B4 . D5 . B4 .",
          heart:
          "k . . k . . . . . . . . . . . . | k . . k . . . . . . . . . . . . | " +
          "k . . k . . . . . . . . . . . . | k . . k . . . . . . . . . . . .",
          lead:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          "E4 - - - - - F4 - E4 - - - C4 - - - | B3 - - - - - - - G#3 - - - . . . .",
          creep:
          "A3 - - - - - - - - - - - - - - - | Ab3 - - - - - - - - - - - - - - - | " +
          "G3 - - - - - - - - - - - - - - - | F#3 - - - - - - - F3 - - - - - - -",
        },
        B: {
          drone:
          "A1 - - - - - - - - - - - - - - - | A1 - - - - - - - - - - - - - - - | " +
          "A1 - - - - - - - - - - - - - - - | A1 - - - - - - - - - - - - - - -",
          bass:
          "A2 - - - - - A2 - E2 - - - - - - - | F2 - - - - - F2 - C3 - - - - - - - | " +
          "D2 - - - - - D2 - A2 - - - - - - - | E2 - - - - - E2 - B2 - - - G#2 - - -",
          box:
          "A4 . E5 . C5 . B4 . A4 . E5 . C5 . E5 . | A4 . F5 . C5 . E5 . A4 . F5 . C5 . F5 . | " +
          "A4 . F5 . D5 . E5 . A4 . F5 . D5 . F5 . | G#4 . D5 . B4 . F5 . G#4 . D5 . B4 . D5 .",
          heart:
          "k . . k . . . . . . . . k . . . | k . . k . . . . . . . . k . . . | " +
          "k . . k . . . . . . . . k . . . | k . . k . . . . . . . . k . . .",
          lead:
          "A4 - - - - - G#4 - A4 - - - C5 - - - | B4 - - - - - - - A4 - - - F4 - - - | " +
          "D4 - - - - - E4 - F4 - - - A4 - - - | G#4 - - - - - - - - - - - . . . .",
          creep:
          "E3 - - - - - - - - - - - - - - - | F3 - - - - - - - - - - - - - - - | " +
          "F3 - - - - - - - E3 - - - - - - - | D#3 - - - - - - - D3 - - - - - - -",
        },
        C: {
          drone:
          "C2 - - - - - - - - - - - - - - - | B1 - - - - - - - - - - - - - - - | " +
          "Bb1 - - - - - - - - - - - - - - - | E1 - - - - - - - - - - - - - - -",
          bass:
          "C3 - - - - - - - G2 - - - - - - - | B1 - - - - - - - F2 - - - - - - - | " +
          "Bb1 - - - - - - - F2 - - - - - - - | E2 - - - - - - - E1 - - - - - - -",
          box:
          "G4 . C5 . E5 . C5 . D5 . C5 . E5 . C5 . | F4 . B4 . D5 . B4 . Ab4 . B4 . D5 . B4 . | " +
          "F4 . Bb4 . D5 . Bb4 . F5 . Bb4 . D5 . Bb4 . | G#4 . B4 . D5 . B4 . F5 . B4 . D5 . B4 .",
          heart:
          "k . . k . . . . h . . . . . . . | k . . k . . . . h . . . . . . . | " +
          "k . . k . . . . h . . . . . . . | k . . k . . . . h . . . . . . .",
          lead:
          "E4 - - - G4 - - - C5 - - - - - - - | D5 - - - B4 - - - F4 - - - - - - - | " +
          "F4 - - - D4 - - - Bb3 - - - - - - - | G#3 - - - - - - - - - - - - - - -",
          creep:
          "G3 - - - - - - - - - - - - - - - | F#3 - - - - - - - - - - - - - - - | " +
          "F3 - - - - - - - - - - - - - - - | E3 - - - - - - - - - - - - - - -",
        },
        D: {
          drone:
          "A1 - - - - - - - - - - - - - - - | A1 - - - - - - - - - - - - - - - | " +
          "A1 - - - - - - - - - - - - - - - | A1 - - - - - - - - - - - - - - -",
          bass:
          "A2 - - - - - - - - - - - - - - - | A2 - - - - - - - - - - - - - - - | " +
          "F2 - - - - - - - - - - - - - - - | E2 - - - - - - - - - - - - - - -",
          box:
          "A4 - . . . . . . E5 - . . . . . . | C5 - . . . . . . B4 - . . . . . . | " +
          "A4 - . . . . . . F5 - . . . . . . | G#4 - . . . . . . . . . . . . . .",
          heart:
          "k . . k . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          "k . . k . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          lead:
          ". . . . . . . . . . . . . . . . | E4 - - - D4 - - - C4 - - - B3 - - - | " +
          "A3 - - - - - - - - - - - . . . . | G#3 - - - - - - - . . . . . . . .",
          creep:
          "A3 - - - - - - - - - - - - - - - | G#3 - - - - - - - - - - - - - - - | " +
          "G3 - - - - - - - - - - - - - - - | F#3 - - - - - - - F3 - - - - - - -",
        },
      },
      order: ["A", "B", "C", "D", "B"],
    },
    // The Portrait Gallery: varnish cracks in 9/8. A square-wave ostinato in
    // 9/8 (2+2+2+3) rocking on the E-F half step, E Phrygian dominant, over a
    // sine drone and eighth-note bass; listen for the long last beat of each
    // bar, the move up to F, the tritone Bb, and a sawtooth drone rubbing a
    // half step above at full dread.
    ghoulGallery: {
      bpm: 118,
      rush: 6,
      voices: {
        drone: { wave: "sine", gain: 0.65, decay: 0.3, sustain: 0.95 },
        bass: { wave: "triangle", gain: 0.72, decay: 0.05, sustain: 0.4 },
        ost: { wave: "pulse", duty: 0.5, gain: 0.16, from: 0.2, decay: 0.05, sustain: 0.3 },
        drums: { kit: true, gain: 0.44, from: 0.4 },
        hats: { kit: true, gain: 0.26, from: 0.55 },
        counter: { wave: "triangle", gain: 0.16, from: 0.6, decay: 0.3, sustain: 0.9 },
        rub: { wave: "sawtooth", gain: 0.1, from: 0.85, decay: 0.4, sustain: 0.9 },
      },
      patterns: {
        A: {
          drone:
          "E2 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - -",
          bass:
          "E2 . E2 . E2 . E2 . E2 . E2 . E2 . E2 . | E2 . E2 . E2 . E2 . E2 . E2 . E2 . E2 . | " +
          "E2 . E2 . E2 . E2 . E2 . E2 . E2 . E2 . | E2 . E2 . E2 . E2 . E2 . E2 . E2 . E2 . | " +
          "E2 . E2 . E2 . F2 . E2 . E2 . E2 . E2 . | E2 . E2 . E2 . E2 . E2 . E2 . E2 . E2 . | " +
          "E2 . E2 . E2 . E2 . E2 . E2 . E2 . E2 . | E2 . E2 . E2 . E2 . E2 . E2 . E2 . E2 . | " +
          "E2 . E2 . E2 . E2 . E2 . E2 . E2 . F2 .",
          ost:
          "E3 . F3 . E3 . Ab3 . E3 . F3 . B3 . A3 . | Ab3 . E3 . F3 . E3 . Ab3 . E3 . F3 . B3 . | " +
          "A3 . Ab3 . E3 . F3 . E3 . Ab3 . E3 . F3 . | B3 . A3 . Ab3 . E3 . F3 . E3 . Ab3 . E3 . | " +
          "F3 . B3 . A3 . Ab3 . E3 . F3 . E3 . Ab3 . | E3 . F3 . B3 . A3 . Ab3 . E3 . F3 . E3 . | " +
          "Ab3 . E3 . F3 . B3 . A3 . Ab3 . E3 . F3 . | E3 . Ab3 . E3 . F3 . B3 . A3 . Ab3 . E3 . | " +
          "F3 . E3 . Ab3 . E3 . F3 . B3 . A3 . Ab3 .",
          drums:
          "k . . . . . . . . . . . . . . . | . . k . . . . . . . . . . . k . | " +
          ". . . . k . . . . . . . . . . . | . . . . . . k . . . . . . . . . | " +
          ". . k . . . . . k . . . . . . . | . . . . . . . . . . k . . . . . | " +
          ". . . . . . k . . . . . k . . . | . . . . . . . . . . . . . . k . | " +
          ". . . . . . . . . . k . . . . .",
          hats:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . .",
          counter:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . G#2 - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - A2 - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - -",
          rub:
          "F2 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - -",
        },
        B: {
          drone:
          "F2 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - Bb1 - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - -",
          bass:
          "F2 . F2 . F2 . F2 . F2 . F2 . F2 . F2 . | F2 . F2 . F2 . F2 . F2 . F2 . F2 . F2 . | " +
          "F2 . F2 . F2 . F2 . F2 . F2 . F2 . F2 . | F2 . F2 . F2 . F2 . F2 . F2 . F2 . F2 . | " +
          "F2 . F2 . F2 . Gb2 . Bb1 . Bb1 . Bb1 . Bb1 . | Bb1 . Bb1 . Bb1 . Bb1 . Bb1 . Bb1 . Bb1 . Bb1 . | " +
          "Bb1 . Bb1 . Bb1 . Bb1 . Bb1 . Bb1 . Bb1 . Bb1 . | Bb1 . Bb1 . Bb1 . Bb1 . Bb1 . Bb1 . Bb1 . Bb1 . | " +
          "Bb1 . Bb1 . Bb1 . Bb1 . Bb1 . Bb1 . Bb1 . B1 .",
          ost:
          "F3 . Gb3 . F3 . A3 . F3 . Gb3 . C4 . Bb3 . | A3 . F3 . Gb3 . F3 . A3 . F3 . Gb3 . C4 . | " +
          "Bb3 . A3 . F3 . Gb3 . F3 . A3 . F3 . Gb3 . | C4 . Bb3 . A3 . F3 . Gb3 . F3 . A3 . F3 . | " +
          "Gb3 . C4 . Bb3 . A3 . Bb2 . B2 . Bb2 . D3 . | Bb2 . B2 . F3 . Eb3 . D3 . Bb2 . B2 . Bb2 . | " +
          "D3 . Bb2 . B2 . F3 . Eb3 . D3 . Bb2 . B2 . | Bb2 . D3 . Bb2 . B2 . F3 . Eb3 . D3 . Bb2 . | " +
          "B2 . Bb2 . D3 . Bb2 . B2 . F3 . Eb3 . D3 .",
          drums:
          "k . . . . . . . . . . . . . . . | . . k . . . . . . . . . . . k . | " +
          ". . . . k . . . . . . . . . . . | . . . . . . k . . . . . . . . . | " +
          ". . k . . . . . k . . . . . . . | . . . . . . . . . . k . . . . . | " +
          ". . . . . . k . . . . . k . . . | . . . . . . . . . . . . . . k . | " +
          ". . . . . . . . . . k . . . . .",
          hats:
          ". . . . . . . . . . . . . . . . | . . . . . . . . h . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . h . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          "h . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . h . . . . . . . . . . .",
          counter:
          "A2 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - E3 - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - -",
          rub:
          "Gb2 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - B1 - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - -",
        },
        C: {
          drone:
          "E2 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - -",
          bass:
          "E2 . . . E2 . . . E2 . . . E2 . . . | . . E2 . . . E2 . . . E2 . . . E2 . | " +
          ". . . . E2 . . . E2 . . . E2 . . . | E2 . . . . . E2 . . . E2 . . . E2 . | " +
          ". . E2 . . . . . E2 . . . E2 . . . | E2 . . . E2 . . . . . E2 . . . E2 . | " +
          ". . E2 . . . E2 . . . . . E2 . . . | E2 . . . E2 . . . E2 . . . . . E2 . | " +
          ". . E2 . . . E2 . . . E2 . . . . .",
          ost:
          "E3 . . . E3 . . . E3 . . . B3 . . . | . . E3 . . . E3 . . . E3 . . . B3 . | " +
          ". . . . E3 . . . E3 . . . E3 . . . | B3 . . . . . E3 . . . E3 . . . E3 . | " +
          ". . B3 . . . . . E3 . . . E3 . . . | E3 . . . B3 . . . . . E3 . . . E3 . | " +
          ". . E3 . . . B3 . . . . . E3 . . . | E3 . . . E3 . . . B3 . . . . . E3 . | " +
          ". . E3 . . . E3 . . . B3 . . . . .",
          drums:
          "k . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . k . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . .",
          hats:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . .",
          counter:
          "F3 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . .",
          rub:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . .",
        },
      },
      order: ["A", "B", "C"],
    },
    // The Library: creeping pizzicato. Plucked string notes tiptoe through G
    // harmonic minor over a low drone, pausing as if listening; a slow bowed
    // line joins at higher dread. Listen for the diminished creep over a C#
    // pedal and the near-silent breakdown.
    ghoulLibrary: {
      bpm: 104,
      rush: 6,
      voices: {
        drone: { wave: "triangle", gain: 0.7, decay: 0.5, sustain: 0.9 },
        pizz: { wave: "pulse", duty: 0.25, gain: 0.26, from: 0.25, decay: 0.02, sustain: 0.05 },
        drums: { kit: true, gain: 0.4, from: 0.4 },
        viola: { wave: "sawtooth", gain: 0.15, from: 0.6, decay: 0.2, sustain: 0.7, vibrato: { rate: 5, depth: 0.01, delay: 0.15 } },
        high: { wave: "triangle", gain: 0.1, from: 0.85, decay: 0.02, sustain: 0.05 },
      },
      patterns: {
        A: {
          drone:
          "G1 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "Eb2 - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - -",
          pizz:
          "G3 . Bb3 . D4 . . . C#4 . D4 . . . Bb3 . | A3 . Bb3 . G3 . . . F#3 . G3 . D3 . . . | " +
          "Eb3 . G3 . Bb3 . . . A3 . Bb3 . . . G3 . | D3 . F#3 . A3 . C4 . Eb4 . . . D4 . . .",
          drums:
          "k . . . . . . . . . . . . . . . | k . . . . . . . . . . . . . . . | " +
          "k . . . . . . . . . . . . . . . | k . . . . . . . . . . . . . . .",
        },
        B: {
          drone:
          "G1 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "Eb2 - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - - | " +
          "G1 - - - - - - - - - - - - - - - | C2 - - - - - - - - - - - - - - - | " +
          "Ab1 - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - -",
          pizz:
          "G3 . Bb3 . D4 . . . C#4 . D4 . . . Bb3 . | A3 . Bb3 . G3 . . . F#3 . G3 . D3 . . . | " +
          "Eb3 . G3 . Bb3 . . . A3 . Bb3 . . . G3 . | D3 . F#3 . A3 . C4 . Eb4 . . . D4 . . . | " +
          "G3 . D4 . G4 . . . F#4 . G4 . . . D4 . | C4 . Eb4 . G4 . . . F#4 . Eb4 . C4 . . . | " +
          "Ab3 . C4 . Eb4 . . . D4 . C4 . . . Ab3 . | D3 . F#3 . A3 . C4 . F#4 . Eb4 . D4 . . .",
          drums:
          "k . . . . . h . k . . . . . h . | k . . . . . h . k . . . . . h . | " +
          "k . . . . . h . k . . . . . h . | k . . . . . h . k . . . . . h . | " +
          "k . . . . . h . k . . . . . h . | k . . . . . h . k . . . . . h . | " +
          "k . . . . . h . k . . . . . h . | k . . . . . h . k . . . . . h .",
          viola:
          "D4 - - - - - - - - - - - - - . . | Eb4 - - - - - - - D4 - - - - - . . | " +
          "Bb3 - - - - - - - - - - - - - . . | A3 - - - - - - - C4 - - - - - . . | " +
          "D4 - - - - - - - - - - - - - . . | Eb4 - - - - - - - - - - - - - . . | " +
          "C4 - - - - - - - Eb4 - - - - - . . | F#3 - - - - - - - - - - - - - . .",
          high:
          ". G4 . Bb4 . D5 . . . C#5 . D5 . . . Bb4 | . A4 . Bb4 . G4 . . . F#4 . G4 . D4 . . | " +
          ". Eb4 . G4 . Bb4 . . . A4 . Bb4 . . . G4 | . D4 . F#4 . A4 . C5 . Eb5 . . . D5 . . | " +
          ". G4 . D5 . G5 . . . F#5 . G5 . . . D5 | . C5 . Eb5 . G5 . . . F#5 . Eb5 . C5 . . | " +
          ". G#4 . C5 . Eb5 . . . D5 . C5 . . . G#4 | . D4 . F#4 . A4 . C5 . F#5 . Eb5 . D5 . .",
        },
        C: {
          drone:
          "C#2 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "C2 - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - -",
          pizz:
          "C#3 . E3 . G3 . Bb3 . . . G3 . E3 . . . | D3 . F3 . Ab3 . B3 . . . Ab3 . F3 . . . | " +
          "Eb3 . G3 . C4 . . . B3 . C4 . . . G3 . | D3 . . . D3 . . . D3 . Eb3 . D3 . C#3 .",
          drums:
          "k . . . . . . . k . . . . . . . | k . . . . . . . k . . . . . . . | " +
          "k . . . . . . . k . . . . . . . | k . . . . . . . k . . . . . . .",
          viola:
          "E4 - - - - - - - - - - - - - - . | F4 - - - - - - - - - - - - - - . | " +
          "Eb4 - - - - - - - - - - - - - - . | C#4 - - - - - - - D4 - - - - - - -",
          high:
          ". C#4 . E4 . G4 . Bb4 . . . G4 . E4 . . | . D4 . F4 . G#4 . B4 . . . G#4 . F4 . . | " +
          ". Eb4 . G4 . C5 . . . B4 . C5 . . . G4 | . D4 . . . D4 . . . D4 . Eb4 . D4 . C#4",
        },
        D: {
          drone:
          "G1 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -",
          pizz:
          "G3 . . . . . . . D3 . . . . . . . | G3 . . . . . Ab3 . . . . . . . . . | " +
          "G3 . . . . . . . F#3 . . . . . . . | G3 . . . . . . . . . . . . . . .",
        },
      },
      order: ["A", "B", "C", "B", "D"],
    },
    // The Ballroom (the Rotting Gourd's fight): gothic organ boss. A gothic C
    // minor organ theme: at low dread only the deep pedal and its reed hum fill
    // the empty hall; organ chords, timpani-like kicks and a stately lead build
    // the fight, with pounding octave pedal notes at the worst. Listen for the
    // Neapolitan Db swell and a brief hint of the Dies Irae chant.
    ghoulBallroom: {
      bpm: 96,
      rush: 8,
      voices: {
        pedal: { wave: "triangle", gain: 0.85, decay: 0.3, sustain: 0.85 },
        reed: { wave: "square", gain: 0.12, decay: 0.3, sustain: 0.8 },
        chords: { wave: "square", gain: 0.09, from: 0.25, decay: 0.2, sustain: 0.85, vibrato: { rate: 5.5, depth: 0.004, delay: 0 } },
        drums: { kit: true, gain: 0.55, from: 0.4 },
        lead: { wave: "pulse", duty: 0.5, gain: 0.22, from: 0.6, decay: 0.1, sustain: 0.8, vibrato: { rate: 5, depth: 0.008, delay: 0.2 } },
        pound: { wave: "triangle", gain: 0.55, from: 0.85, decay: 0.05, sustain: 0.4 },
      },
      patterns: {
        A: {
          pedal:
          "C2 - - - - - - - - - - - - - - - | C2 - - - - - - - - - - - - - - - | " +
          "Ab1 - - - - - - - - - - - - - - - | G1 - - - - - - - - - - - - - - -",
          reed:
          "C3 - - - - - - - - - - - - - - - | C3 - - - - - - - - - - - - - - - | " +
          "G#2 - - - - - - - - - - - - - - - | G2 - - - - - - - - - - - - - - -",
          chords:
          "C3^037c - - - - - - - - - - - - - - - | C3^037c - - - - - - - - - - - - - - - | " +
          "Ab2^047c - - - - - - - - - - - - - - - | G2^047c - - - - - - - - - - - - - - -",
          drums:
          "k . . . . . . . k . . . . . . . | k . . . . . . . k . . . . . . . | " +
          "k . . . . . . . k . . . . . . . | k . . . . . . . k . . . . . . .",
          lead:
          "G4 - - - - - - - Ab4 - - - G4 - - - | Eb4 - - - - - - - - - - - D4 - - - | " +
          "C4 - - - - - - - Eb4 - - - - - - - | D4 - - - - - - - B3 - - - - - - -",
        },
        B: {
          pedal:
          "C2 - - - - - - - - - - - - - - - | F1 - - - - - - - - - - - - - - - | " +
          "C2 - - - - - - - - - - - - - - - | G1 - - - - - - - - - - - - - - - | " +
          "Ab1 - - - - - - - - - - - - - - - | F1 - - - - - - - - - - - - - - - | " +
          "D2 - - - - - - - - - - - - - - - | G1 - - - - - - - - - - - - - - -",
          reed:
          "C3 - - - - - - - - - - - - - - - | F2 - - - - - - - - - - - - - - - | " +
          "C3 - - - - - - - - - - - - - - - | G2 - - - - - - - - - - - - - - - | " +
          "G#2 - - - - - - - - - - - - - - - | F2 - - - - - - - - - - - - - - - | " +
          "D3 - - - - - - - - - - - - - - - | G2 - - - - - - - - - - - - - - -",
          chords:
          "C3^037c - - - - - - - - - - - - - - - | F3^037c - - - - - - - - - - - - - - - | " +
          "C3^037c - - - - - - - - - - - - - - - | G2^047c - - - - - - - - - - - - - - - | " +
          "Ab2^047c - - - - - - - - - - - - - - - | F3^037c - - - - - - - - - - - - - - - | " +
          "D3^036c - - - - - - - - - - - - - - - | G2^047c - - - - - - - - - - - - - - -",
          drums:
          "k . . . k . . . k . . . k . k . | k . . . k . . . k . . . k . k . | " +
          "k . . . k . . . k . . . k . k . | k . . . k . . . k . . . k . k . | " +
          "k . . . k . . . k . . . k . k . | k . . . k . . . k . . . k . k . | " +
          "k . . . k . . . k . . . k . k . | k . . . k . . . s . s . s s s s",
          lead:
          "C5 - - - - - B4 - C5 - - - G4 - - - | Ab4 - - - - - - - F4 - - - Ab4 - - - | " +
          "G4 - - - - - F4 - Eb4 - - - C4 - - - | D4 - - - - - - - B3 - - - D4 - - - | " +
          "Eb4 - - - - - - - C4 - - - Ab4 - - - | C5 - - - - - - - Ab4 - - - - - - - | " +
          "F4 - - - - - Ab4 - B4 - - - - - - - | D5 - - - - - - - B4 - - - G4 - - -",
          pound:
          "C2 . C3 . C2 . C3 . C2 . C3 . C2 . C3 . | F1 . F2 . F1 . F2 . F1 . F2 . F1 . F2 . | " +
          "C2 . C3 . C2 . C3 . C2 . C3 . C2 . C3 . | G1 . G2 . G1 . G2 . G1 . G2 . G1 . G2 . | " +
          "Ab1 . G#2 . Ab1 . G#2 . Ab1 . G#2 . Ab1 . G#2 . | F1 . F2 . F1 . F2 . F1 . F2 . F1 . F2 . | " +
          "D2 . D3 . D2 . D3 . D2 . D3 . D2 . D3 . | G1 . G2 . G1 . G2 . G1 . G2 . G1 . G2 .",
        },
        C: {
          pedal:
          "Db2 - - - - - - - - - - - - - - - | Db2 - - - - - - - - - - - - - - - | " +
          "F#1 - - - - - - - - - - - - - - - | G1 - - - - - - - - - - - - - - -",
          reed:
          "C#3 - - - - - - - - - - - - - - - | C#3 - - - - - - - - - - - - - - - | " +
          "F#2 - - - - - - - - - - - - - - - | G2 - - - - - - - - - - - - - - -",
          chords:
          "Db3^047c - - - - - - - - - - - - - - - | Db3^047c - - - - - - - - - - - - - - - | " +
          "C3^037c - - - - - - - - - - - - - - - | G2^047c - - - - - - - - - - - - - - -",
          drums:
          "k . . k . . k . k . . k . . k . | k . . k . . k . k . . k . . k . | " +
          "k . . k . . k . k . . k . . k . | k . . k . . k . k . . k . . k .",
          lead:
          "F4 - - - - - - - Ab4 - - - - - - - | Db5 - - - - - - - - - - - C5 - - - | " +
          "Eb4 - - - - - - - C4 - - - - - - - | B3 - - - - - - - D4 - - - F4 - - -",
          pound:
          "Db2 . C#3 . Db2 . C#3 . Db2 . C#3 . Db2 . C#3 . | Db2 . C#3 . Db2 . C#3 . Db2 . C#3 . Db2 . C#3 . | " +
          "F#1 . F#2 . F#1 . F#2 . F#1 . F#2 . F#1 . F#2 . | G1 . G2 . G1 . G2 . G1 . G2 . G1 . G2 .",
        },
        D: {
          pedal:
          "C2 - - - - - - - - - - - - - - - | C2 - - - - - - - - - - - - - - - | " +
          "Ab1 - - - - - - - - - - - - - - - | G1 - - - - - - - - - - - - - - -",
          reed:
          "C3 - - - - - - - - - - - - - - - | C3 - - - - - - - - - - - - - - - | " +
          "G#2 - - - - - - - - - - - - - - - | G2 - - - - - - - - - - - - - - -",
          chords:
          "C3^037c - - - - - - - - - - - - - - - | C3^037c - - - - - - - - - - - - - - - | " +
          "Ab2^047c - - - - - - - - - - - - - - - | G2^047c - - - - - - - - - - - - - - -",
          drums:
          "k . . . k . . . k . . . k . . . | k . . . k . . . k . . . k . . . | " +
          "k . . . k . . . k . . . k . . . | k . k . k . k . s s s s s s s s",
          lead:
          "C5 - - - B4 - - - C5 - - - Ab4 - - - | Bb4 - - - G4 - - - Ab4 - - - - - - - | " +
          "Ab4 - - - G4 - - - F4 - - - Eb4 - - - | D4 - - - - - - - G4 - - - - - - -",
          pound:
          "C2 . C3 . C2 . C3 . C2 . C3 . C2 . C3 . | C2 . C3 . C2 . C3 . C2 . C3 . C2 . C3 . | " +
          "Ab1 . G#2 . Ab1 . G#2 . Ab1 . G#2 . Ab1 . G#2 . | G1 . G2 . G1 . G2 . G1 . G2 . G1 . G2 .",
        },
      },
      order: ["A", "B", "C", "D"],
    },
    // The Kitchen: cauldron swing. A creeping D minor swing (each bar is a
    // triplet grid) with a walking bass full of chromatic slips, organ stabs on
    // the offbeats and brushed snare; listen for the sly low lead and the Bb7
    // to A7 tritone shuffle in the middle.
    ghoulKitchen: {
      bpm: 66,
      rush: 4,
      voices: {
        bass: { wave: "triangle", gain: 0.8, decay: 0.08, sustain: 0.6 },
        growl: { wave: "sawtooth", gain: 0.1, from: 0.85, decay: 0.3, sustain: 0.6 },
        stabs: { wave: "pulse", duty: 0.25, gain: 0.13, from: 0.25, decay: 0.04, sustain: 0.3 },
        drums: { kit: true, gain: 0.32, from: 0.4 },
        lead: { wave: "pulse", duty: 0.5, gain: 0.22, from: 0.6, decay: 0.1, sustain: 0.65, vibrato: { rate: 4.5, depth: 0.01, delay: 0.2 } },
        cackle: { wave: "sawtooth", gain: 0.09, from: 0.85, decay: 0.05, sustain: 0.4 },
      },
      patterns: {
        A: {
          bass:
          "D2 - . F2 - . A2 - . F2 - . | D2 - . A1 - . C2 - . F#2 - . | " +
          "G1 - . Bb1 - . D2 - . Bb1 - . | A1 - . C#2 - . Eb2 - . C#2 - .",
          stabs:
          ". . . . . D3^037 . . . . . D3^037 | . . . . . D3^037 . . . . . D3^037 | " +
          ". . . . . G3^037 . . . . . G3^037 | . . . . . A2^047a . . . . . A2^047a",
          drums:
          "k . . s . . . . . s . h | k . . s . . . . . s . h | " +
          "k . . s . . . . . s . h | k . . s . . . . . s s s",
        },
        B: {
          bass:
          "D2 - . E2 - . F2 - . Ab2 - . | A2 - . Ab2 - . G2 - . F#2 - . | " +
          "G1 - . A1 - . Bb1 - . B1 - . | A1 - . Eb2 - . G2 - . C#2 - .",
          growl:
          "D2 - - - - - - - - - - - | D2 - - - - - - - - - - - | " +
          "G1 - - - - - - - - - - - | A1 - - - - - - - - - - -",
          stabs:
          ". . . . . D3^037 . . . . . D3^037 | . . . . . D3^037 . . . . . D3^037 | " +
          ". . . . . G3^037 . . . . . G3^037 | . . . . . A2^047a . . . . . A2^047a",
          drums:
          "k . h s . h . . h s . h | k . h s . h . . h s . h | " +
          "k . h s . h . . h s . h | k . h s . h . . h s . h",
          lead:
          ". . . . . A3 D4 - . F4 - E4 | D4 - - - - - . . A3 C#4 - D4 | " +
          "Bb3 - . G3 - . D4 - C#4 D4 - Bb3 | A3 - - - - - . . E3 G3 - Bb3",
          cackle:
          ". . . . . . . . . . . . | . . . . . . . . . D4 C#4 C4 | " +
          ". . . . . . . . . . . . | . . . . . . . . . Bb3 A3 Ab3",
        },
        C: {
          bass:
          "Bb1 - . D2 - . F2 - . Ab2 - . | A1 - . G2 - . E2 - . C#2 - . | " +
          "Bb1 - . F2 - . D2 - . Ab1 - . | A1 - . C#2 - . E2 - . A2 - .",
          growl:
          "Bb1 - - - - - - - - - - - | A1 - - - - - - - - - - - | " +
          "Bb1 - - - - - - - - - - - | A1 - - - - - - - - - - -",
          stabs:
          ". . . . . Bb2^047a . . . . . Bb2^047a | . . . . . A2^047a . . . . . A2^047a | " +
          ". . . . . Bb2^047a . . . . . Bb2^047a | . . . . . A2^047a . . . . . A2^047a",
          drums:
          "k . h s . h . . h s . h | k . h s . h . . h s . h | " +
          "k . h s . h . . h s . h | k . h s . h s . h s s s",
          lead:
          "D4 - - - - - Ab3 - - - - - | C#4 - - - - - G3 - - - - - | " +
          "F4 - . D4 - . Ab3 - . Bb3 - . | A3 - - - - - . . . . . .",
          cackle:
          ". . . . . . . . . . . . | . . . . . . . . . Ab3 G3 Gb3 | " +
          ". . . . . . . . . . . . | . . . . . . . . . G3 Gb3 F3",
        },
        B2: {
          bass:
          "D2 - . F2 - . Ab2 - . A2 - . | D2 - . C2 - . B1 - . Bb1 - . | " +
          "G1 - . Bb1 - . D2 - . G#1 - . | A1 - . C#2 - . G2 - . C#2 - .",
          growl:
          "D2 - - - - - - - - - - - | D2 - - - - - - - - - - - | " +
          "G1 - - - - - - - - - - - | A1 - - - - - - - - - - -",
          stabs:
          ". . . . . D3^037 . . . . . D3^037 | . . . . . D3^037 . . . . . D3^037 | " +
          ". . . . . G3^037 . . . . . G3^037 | . . . . . A2^047a . . . . . A2^047a",
          drums:
          "k . h s . h . . h s . h | k . h s . h . . h s . h | " +
          "k . h s . h . . h s . h | k . h s . h . . h s . h",
          lead:
          ". . . . . A3 D4 - . F4 - E4 | D4 - . A4 - Ab4 G4 - . F4 - E4 | " +
          "F4 - . E4 - . Eb4 - . D4 - . | C#4 - - - - - A3 - - D3 - -",
          cackle:
          ". . . . . . . . . . . . | . . . . . . . . . D4 C#4 C4 | " +
          ". . . . . . . . . . . . | . . . . . . . . . . . .",
        },
        D: {
          bass:
          "D2 - . . . . . . . . . . | D2 - . . . . . . . Ab1 - . | " +
          "D2 - . . . . . . . . . . | D2 - . . . . A1 - . C#2 - .",
          drums:
          "k . . . . . . . . . . . | k . . . . . . . . . . . | " +
          "k . . . . . . . . . . . | k . . . . . . . . s . s",
          lead:
          ". . . . . . F4 - E4 Eb4 - D4 | - - - - - - . . . . . . | " +
          ". . . . . . Bb3 - A3 Ab3 - G3 | - - - - - - . . . . . .",
        },
      },
      order: ["A", "B", "C", "B2", "D"],
    },
    // The Conservatory: strangler fig in 5/4. A 5/4 (3+3+2+2) pulse-wave
    // ostinato in G Phrygian that creeps in over a heavy bass, then tightens
    // its grip; listen for it climbing a half step to Ab, the bass sliding back
    // to G underneath it so they grind, a breath on the tritone Db, and the
    // vine closing in again.
    ghoulConservatory: {
      bpm: 110,
      rush: 6,
      voices: {
        drone: { wave: "triangle", gain: 0.6, decay: 0.3, sustain: 0.95 },
        bass: { wave: "triangle", gain: 0.75, decay: 0.05, sustain: 0.4 },
        ost: { wave: "pulse", duty: 0.25, gain: 0.18, from: 0.2, decay: 0.05, sustain: 0.3 },
        drums: { kit: true, gain: 0.45, from: 0.4 },
        hats: { kit: true, gain: 0.2, from: 0.5 },
        counter: { wave: "sawtooth", gain: 0.12, from: 0.6, decay: 0.4, sustain: 0.7, vibrato: { rate: 3.5, depth: 0.008, delay: 0.5 } },
        top: { wave: "square", gain: 0.1, from: 0.85, decay: 0.3, sustain: 0.9 },
      },
      patterns: {
        A1: {
          drone:
          "G1 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - -",
          bass:
          "G1 . G2 . G2 . G1 . G2 . G2 . G1 . G2 . | G1 . G2 . G1 . G2 . G2 . G1 . G2 . G2 . | " +
          "G1 . G2 . G1 . G2 . G1 . G2 . G2 . G1 . | G2 . G2 . G1 . G2 . G1 . G2 . G1 . G2 . | " +
          "G2 . G1 . G2 . G2 . G1 . G2 . G1 . G2 .",
          ost:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . G3 . D4 . Eb4 . G3 . | D4 . Ab3 . G3 . Bb3 . G3 . Ab3 . G3 . D4 . | " +
          "Eb4 . G3 . D4 . Ab3 . G3 . Bb3 . G3 . Ab3 .",
          drums:
          "k . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . k . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . .",
          hats:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . .",
          counter:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . .",
          top:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . .",
        },
        A2: {
          drone:
          "G1 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - -",
          bass:
          "G1 . G2 . G2 . G1 . G2 . G2 . G1 . G2 . | G1 . G2 . G1 . G2 . G2 . G1 . G2 . G2 . | " +
          "G1 . G2 . G1 . G2 . G1 . G2 . G2 . G1 . | G2 . G2 . G1 . G2 . G1 . G2 . G1 . G2 . | " +
          "G2 . G1 . G2 . G2 . G1 . G2 . G1 . G2 .",
          ost:
          "G3 . D4 . Eb4 . G3 . D4 . Ab3 . G3 . Bb3 . | G3 . Ab3 . G3 . D4 . Eb4 . G3 . D4 . Ab3 . | " +
          "G3 . Bb3 . G3 . Ab3 . G3 . D4 . Eb4 . G3 . | D4 . Ab3 . G3 . Bb3 . G3 . Ab3 . G3 . D4 . | " +
          "Eb4 . G3 . D4 . Ab3 . G3 . Bb3 . G3 . Ab3 .",
          drums:
          "k . . . . . . . . . . . k . . . | . . . . k . . . . . . . . . . . | " +
          "k . . . . . . . k . . . . . . . | . . . . k . . . . . . . k . . . | " +
          ". . . . . . . . k . . . . . . .",
          hats:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . h . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . h . . .",
          counter:
          "Bb3 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - Ab3 - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - -",
          top:
          "Db3 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - -",
        },
        B: {
          drone:
          "Ab1 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - -",
          bass:
          "Ab1 . Ab2 . Ab2 . Ab1 . Ab2 . Ab2 . Ab1 . Ab2 . | Ab1 . Ab2 . Ab1 . Ab2 . Ab2 . Ab1 . Ab2 . Ab2 . | " +
          "Ab1 . Ab2 . Ab1 . Ab2 . Ab1 . Ab2 . Ab2 . Ab1 . | Ab2 . Ab2 . Ab1 . Ab2 . Ab1 . Ab2 . Ab1 . Ab2 . | " +
          "Ab2 . Ab1 . Ab2 . Ab2 . Ab1 . Ab2 . Ab1 . Ab2 .",
          ost:
          "Ab3 . Eb4 . E4 . Ab3 . Eb4 . A3 . Ab3 . B3 . | Ab3 . A3 . Ab3 . Eb4 . E4 . Ab3 . Eb4 . A3 . | " +
          "Ab3 . B3 . Ab3 . A3 . Ab3 . Eb4 . E4 . Ab3 . | Eb4 . A3 . Ab3 . B3 . Ab3 . A3 . Ab3 . Eb4 . | " +
          "E4 . Ab3 . Eb4 . A3 . Ab3 . B3 . Ab3 . A3 .",
          drums:
          "k . . . . . . . . . . . k . . . | . . . . k . . . . . . . . . . . | " +
          "k . . . . . . . k . . . . . . . | . . . . k . . . . . . . k . . . | " +
          ". . . . . . . . k . . . . . . .",
          hats:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . h . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . h . . .",
          counter:
          "B3 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - A3 - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - -",
          top:
          "D3 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - -",
        },
        B2: {
          drone:
          "G1 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - -",
          bass:
          "G1 . G2 . G2 . G1 . G2 . G2 . G1 . G2 . | G1 . G2 . G1 . G2 . G2 . G1 . G2 . G2 . | " +
          "G1 . G2 . G1 . G2 . G1 . G2 . G2 . G1 . | G2 . G2 . G1 . G2 . G1 . G2 . G1 . G2 . | " +
          "G2 . G1 . G2 . G2 . G1 . G2 . G1 . G2 .",
          ost:
          "Ab3 . Eb4 . E4 . Ab3 . Eb4 . A3 . Ab3 . B3 . | Ab3 . A3 . Ab3 . Eb4 . E4 . Ab3 . Eb4 . A3 . | " +
          "Ab3 . B3 . Ab3 . A3 . Ab3 . Eb4 . E4 . Ab3 . | Eb4 . A3 . Ab3 . B3 . Ab3 . A3 . Ab3 . Eb4 . | " +
          "E4 . Ab3 . Eb4 . A3 . Ab3 . B3 . Ab3 . A3 .",
          drums:
          "k . . . . . . . . . . . k . . . | . . . . k . . . . . . . . . . . | " +
          "k . . . . . . . k . . . . . . . | . . . . k . . . . . . . k . . . | " +
          ". . . . . . . . k . . . . . . .",
          hats:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . h . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . h . . .",
          counter:
          "Bb3 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - -",
          top:
          "D3 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - -",
        },
        C: {
          drone:
          "Db2 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - -",
          bass:
          "Db2 . . . . . . . . . . . . . . . | . . . . Db2 . . . . . . . . . . . | " +
          ". . . . . . . . Db2 . . . . . . . | . . . . . . . . . . . . Db2 . . . | " +
          ". . . . . . . . . . . . . . . .",
          ost:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . .",
          drums:
          "k . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . .",
          hats:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . .",
          counter:
          "Ab3 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - G3 - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - -",
          top:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . .",
        },
      },
      order: ["A1", "A2", "B", "B2", "C", "A2"],
    },
    // The Attic: phonograph foxtrot. A minor-key 1920s foxtrot heard through
    // the floorboards: oom-pah tuba, offbeat banjo chords and a warbling
    // trumpet; listen for the D7 flat-nine turns and the last section where the
    // tune climbs closer and the clarinet creeps in underneath.
    ghoulAttic: {
      bpm: 108,
      rush: 6,
      voices: {
        hum: { wave: "sine", gain: 0.4, decay: 0.3, sustain: 0.9 },
        tuba: { wave: "triangle", gain: 0.8, decay: 0.08, sustain: 0.5 },
        banjo: { wave: "pulse", duty: 0.25, gain: 0.16, from: 0.25, decay: 0.04, sustain: 0.2 },
        brush: { kit: true, gain: 0.3, from: 0.4 },
        horn: { wave: "pulse", duty: 0.5, gain: 0.22, from: 0.6, decay: 0.06, sustain: 0.7, vibrato: { rate: 4.5, depth: 0.022, delay: 0 } },
        clarinet: { wave: "square", gain: 0.12, from: 0.85, decay: 0.08, sustain: 0.6, vibrato: { rate: 5, depth: 0.01, delay: 0.1 } },
      },
      patterns: {
        I: {
          hum:
          "G2 - - - - - - - - - - - - - - - | Eb2 - - - - - - - - - - - - - - - | " +
          "A2 - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - -",
          tuba:
          "G2 - - . . . . . D2 - - . . . . . | Eb2 - - . . . . . Bb1 - - . . . . . | " +
          "A2 - - . . . . . Eb2 - - . . . . . | D2 - - . . . . . A1 - - . . . . .",
          banjo:
          ". . . . G3^037 - . . . . . . G3^037 - . . | . . . . Eb3^047a - . . . . . . Eb3^047a - . . | " +
          ". . . . A3^036a - . . . . . . A3^036a - . . | . . . . D3^047a - . . . . . . D3^047a - . .",
        },
        A: {
          hum:
          "G2 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "D2 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "C2 - - - - - - - - - - - - - - - | G2 - - - - - - - - - - - - - - - | " +
          "Eb2 - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - -",
          tuba:
          "G2 - - . . . . . D2 - - . . . . . | G2 - - . . . . . Bb1 - - . . . . . | " +
          "D2 - - . . . . . A1 - - . . . . . | D2 - - . . . . . F#2 - - . . . . . | " +
          "C2 - - . . . . . G1 - - . . . . . | G2 - - . . . . . D2 - - . . . . . | " +
          "Eb2 - - . . . . . Bb1 - - . . . . . | D2 - - . . . . . A1 - - . . . . .",
          banjo:
          ". . . . G3^037 - . . . . . . G3^037 - . . | . . . . G3^037 - . . . . . . G3^037 - . . | " +
          ". . . . D3^047a - . . . . . . D3^047a - . . | . . . . D3^047a - . . . . . . D3^047a - . . | " +
          ". . . . C4^037 - . . . . . . C4^037 - . . | . . . . G3^037 - . . . . . . G3^037 - . . | " +
          ". . . . Eb3^047a - . . . . . . Eb3^047a - . . | . . . . D3^047a - . . . . . . D3^047a - . .",
          brush:
          "h . . . hs . . . h . . . hs . . . | h . . . hs . . . h . . . hs . . . | " +
          "h . . . hs . . . h . . . hs . . . | h . . . hs . . . h . . . hs . . . | " +
          "h . . . hs . . . h . . . hs . . . | h . . . hs . . . h . . . hs . . . | " +
          "h . . . hs . . . h . . . hs . . . | h . . . hs . . . h . . . hs . . .",
          horn:
          "D5 - - - - - Eb5 - D5 - - - Bb4 - - - | A4 - - Bb4 D5 - - - G4 - - - - - - - | " +
          "F#4 - - - - - G4 - A4 - - - C5 - - - | Eb5 - - - - - D5 - C5 - - - A4 - - - | " +
          "G4 - - - C5 - - - Eb5 - - - D5 - C5 - | Bb4 - - - - - - - . . G4 - A4 - Bb4 - | " +
          "Db5 - - - - - C5 - Bb4 - - - G4 - - - | F#4 - - - - - - - - - - - . . . .",
          clarinet:
          ". . . . . . . . Bb3 - - - D4 - - - | . . . . . . . . D4 - - - Bb3 - - - | " +
          ". . . . . . . . C4 - - - A3 - - - | . . . . . . . . F#3 - - - A3 - - - | " +
          ". . . . . . . . Eb4 - - - C4 - - - | . . . . . . . . D4 - - - G3 - - - | " +
          ". . . . . . . . G3 - - - Bb3 - - - | C4 - - - Bb3 - - - A3 - - - F#3 - - -",
        },
        B: {
          hum:
          "Eb2 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "C2 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "A2 - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - - | " +
          "G2 - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - -",
          tuba:
          "Eb2 - - . . . . . Bb1 - - . . . . . | Eb2 - - . . . . . G2 - - . . . . . | " +
          "C2 - - . . . . . G1 - - . . . . . | C2 - - . . . . . Eb2 - - . . . . . | " +
          "A1 - - . . . . . Eb2 - - . . . . . | D2 - - . . . . . A1 - - . . . . . | " +
          "G2 - - . . . . . D2 - - . . . . . | D2 - - . . . . . A1 - - . . . . .",
          banjo:
          ". . . . Eb3^047 - . . . . . . Eb3^047 - . . | . . . . Eb3^047 - . . . . . . Eb3^047 - . . | " +
          ". . . . C4^037 - . . . . . . C4^037 - . . | . . . . C4^037 - . . . . . . C4^037 - . . | " +
          ". . . . A3^036a - . . . . . . A3^036a - . . | . . . . D3^047a - . . . . . . D3^047a - . . | " +
          ". . . . G3^037 - . . . . . . G3^037 - . . | . . . . D3^047a - . . . . . . D3^047a - . .",
          brush:
          "h . . . . . . . hs . . . . . . . | h . . . . . . . hs . . . . . . . | " +
          "h . . . . . . . hs . . . . . . . | h . . . . . . . hs . . . . . . . | " +
          "h . . . . . . . hs . . . . . . . | h . . . . . . . hs . . . . . . . | " +
          "h . . . . . . . hs . . . . . . . | h . . . hs . . . h . . . hs . s .",
          horn:
          "G4 - - - - - - - Bb4 - - - Eb5 - - - | D5 - - - - - - - - - - - . . . . | " +
          "C5 - - - - - Eb5 - G5 - - - F5 - - - | Eb5 - - - - - - - - - - - . . . . | " +
          "Eb5 - - - C5 - - - A4 - - - G4 - - - | F#4 - - - - - - - A4 - - - C5 - - - | " +
          "Bb4 - - - - - A4 - G4 - - - - - - - | A4 - - - C5 - - - Eb5 - - - D5 - - -",
          clarinet:
          "Bb3 - - - - - - - - - - - - - - - | G3 - - - - - - - - - - - - - - - | " +
          "G3 - - - - - - - - - - - - - - - | G3 - - - - - - - - - - - - - - - | " +
          "G3 - - - - - - - - - - - - - - - | F#3 - - - - - - - - - - - - - - - | " +
          "G3 - - - - - - - - - - - - - - - | F#3 - - - - - - - - - - - - - - -",
        },
        C: {
          hum:
          "G2 - - - - - - - - - - - - - - - | Eb2 - - - - - - - - - - - - - - - | " +
          "A2 - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - -",
          tuba:
          "G2 - - . . . . . D2 - - . . . . . | Eb2 - - . . . . . Bb1 - - . . . . . | " +
          "A1 - - . . . . . Eb2 - - . . . . . | D2 - - . F#2 - - . A2 - - . C3 - - .",
          banjo:
          ". . . . G3^037 - . . . . . . G3^037 - . . | . . . . Eb3^047a - . . . . . . Eb3^047a - . . | " +
          ". . . . A3^036a - . . . . . . A3^036a - . . | . . . . D3^047a - . . . . . . D3^047a - . .",
          brush:
          "h . . . hs . . . h . . . hs . . . | h . . . hs . . . h . . . hs . . . | " +
          "h . . . hs . . . h . . . hs . . . | h . . . hs . . . hs . . . s . s .",
          horn:
          "G5 - - - - - F#5 - G5 - - - D5 - - - | Db5 - - - - - C5 - Bb4 - - - G4 - - - | " +
          "Eb5 - - - C5 - - - A4 - - - G4 - - - | F#4 - - - A4 - - - C5 - - - Eb5 - - -",
          clarinet:
          "Bb3 - - - - - - - A3 - - - - - - - | G3 - - - - - - - Bb3 - - - - - - - | " +
          "C4 - - - - - - - Eb4 - - - - - - - | D4 - - - - - - - C4 - - - - - - -",
        },
      },
      order: ["I", "A", "B", "C"],
    },
    // The Crypt (Bones' fight): dark-synth final boss. The last fight, in B
    // minor with a grinding Neapolitan C: a cold organ and sub at low dread,
    // then a creeping ostinato, a galloping bass and a pounding beat; at full
    // dread a shrieking arpeggio layer makes it the most intense track in the
    // game, but it stays sinister rather than heroic.
    ghoulCrypt: {
      bpm: 138,
      rush: 10,
      voices: {
        organ: { wave: "sawtooth", gain: 0.28, decay: 0.4, sustain: 0.9, vibrato: { rate: 0.5, depth: 0.006, delay: 0 } },
        sub: { wave: "triangle", gain: 0.75, decay: 0.3, sustain: 0.9 },
        ost: { wave: "pulse", duty: 0.25, gain: 0.2, from: 0.2, decay: 0.05, sustain: 0.3 },
        bass: { wave: "pulse", duty: 0.5, gain: 0.45, from: 0.35, decay: 0.04, sustain: 0.4 },
        drums: { kit: true, gain: 0.6, from: 0.45 },
        lead: { wave: "sawtooth", gain: 0.2, from: 0.6, decay: 0.1, sustain: 0.65, vibrato: { rate: 5.5, depth: 0.01, delay: 0.18 } },
        shriek: { wave: "pulse", duty: 0.125, gain: 0.11, from: 0.8, decay: 0.03, sustain: 0.25 },
      },
      patterns: {
        I: {
          organ:
          "B2 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "C3 - - - - - - - - - - - - - - - | F#2 - - - - - - - - - - - - - - -",
          sub:
          "B1 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "C2 - - - - - - - - - - - - - - - | F#1 - - - - - - - - - - - - - - -",
          ost:
          "B2 . F#3 . G3 . F#3 . B2 . F#3 . G3 . F#3 . | B2 . F#3 . G3 . F#3 . B2 . F#3 . G3 . F#3 . | " +
          "C3 . G3 . G#3 . G3 . C3 . G3 . G#3 . G3 . | F#2 . C#3 . D3 . C#3 . F#2 . C#3 . D3 . C#3 .",
        },
        A: {
          organ:
          "B2 - - - - - - - - - - - - - - - | B2 - - - - - - - - - - - - - - - | " +
          "C3 - - - - - - - - - - - - - - - | C3 - - - - - - - - - - - - - - - | " +
          "B2 - - - - - - - - - - - - - - - | B2 - - - - - - - - - - - - - - - | " +
          "F#2 - - - - - - - - - - - - - - - | F#2 - - - - - - - - - - - - - - -",
          sub:
          "B1 - - - - - - - - - - - - - - - | B1 - - - - - - - - - - - - - - - | " +
          "C2 - - - - - - - - - - - - - - - | C2 - - - - - - - - - - - - - - - | " +
          "B1 - - - - - - - - - - - - - - - | B1 - - - - - - - - - - - - - - - | " +
          "F#1 - - - - - - - - - - - - - - - | F#1 - - - - - - - - - - - - - - -",
          ost:
          "B2 . F#3 . G3 . F#3 . B2 . F#3 . G3 . F#3 . | B2 . F#3 . G3 . F#3 . B2 . F#3 . G3 . F#3 . | " +
          "C3 . G3 . G#3 . G3 . C3 . G3 . G#3 . G3 . | C3 . G3 . G#3 . G3 . C3 . G3 . G#3 . G3 . | " +
          "B2 . F#3 . G3 . F#3 . B2 . F#3 . G3 . F#3 . | B2 . F#3 . G3 . F#3 . B2 . F#3 . G3 . F#3 . | " +
          "F#2 . C#3 . D3 . C#3 . F#2 . C#3 . D3 . C#3 . | F#2 . C#3 . D3 . C#3 . F#2 . C#3 . D3 . C#3 .",
          bass:
          "B1 . B1 B1 B1 . B1 B1 B1 . B1 B1 B1 . B2 B1 | B1 . B1 B1 B1 . B1 B1 B1 . B1 B1 B1 . B2 B1 | " +
          "C2 . C2 C2 C2 . C2 C2 C2 . C2 C2 C2 . C3 C2 | C2 . C2 C2 C2 . C2 C2 C2 . C2 C2 C2 . C3 C2 | " +
          "B1 . B1 B1 B1 . B1 B1 B1 . B1 B1 B1 . B2 B1 | B1 . B1 B1 B1 . B1 B1 B1 . B1 B1 B1 . B2 B1 | " +
          "F#2 . F#2 F#2 F#2 . F#2 F#2 F#2 . F#2 F#2 F#2 . F#3 F#2 | F#2 . F#2 F#2 F#2 . F#2 F#2 F#2 . F#2 F#2 F#2 . F#3 F#2",
          drums:
          "k . h . s . h k k . h . s . h . | k . h . s . h k k . h . s . h . | " +
          "k . h . s . h k k . h . s . h . | k . h . s . h k k . h . s . h . | " +
          "k . h . s . h k k . h . s . h . | k . h . s . h k k . h . s . h . | " +
          "k . h . s . h k k . h . s . h . | k . s . k . s . ks . s . ks . s s",
          lead:
          "B4 - - - - - - - C5 - - - B4 - - - | F#4 - - - - - - - - - - - . . . . | " +
          "G4 - - - - - F#4 - E4 - - - C5 - - - | B4 - - - - - - - - - - - . . . . | " +
          "D5 - - - - - - - C#5 - - - B4 - - - | F#5 - - - - - - - E5 - - - D5 - - - | " +
          "C#5 - - - - - - - A#4 - - - - - - - | F#4 - - - - - - - - - - - - - - -",
        },
        B: {
          organ:
          "G2 - - - - - - - - - - - - - - - | G2 - - - - - - - - - - - - - - - | " +
          "E2 - - - - - - - - - - - - - - - | E2 - - - - - - - - - - - - - - - | " +
          "C3 - - - - - - - - - - - - - - - | C3 - - - - - - - - - - - - - - - | " +
          "F#2 - - - - - - - - - - - - - - - | F#2 - - - - - - - - - - - - - - -",
          sub:
          "G1 - - - - - - - - - - - - - - - | G1 - - - - - - - - - - - - - - - | " +
          "E1 - - - - - - - - - - - - - - - | E1 - - - - - - - - - - - - - - - | " +
          "C2 - - - - - - - - - - - - - - - | C2 - - - - - - - - - - - - - - - | " +
          "F#1 - - - - - - - - - - - - - - - | F#1 - - - - - - - - - - - - - - -",
          ost:
          "G2 . D3 . Eb3 . D3 . G2 . D3 . Eb3 . D3 . | G2 . D3 . Eb3 . D3 . G2 . D3 . Eb3 . D3 . | " +
          "E2 . B2 . C3 . B2 . E2 . B2 . C3 . B2 . | E2 . B2 . C3 . B2 . E2 . B2 . C3 . B2 . | " +
          "C3 . G3 . G#3 . G3 . C3 . G3 . G#3 . G3 . | C3 . G3 . G#3 . G3 . C3 . G3 . G#3 . G3 . | " +
          "F#2 . C#3 . D3 . C#3 . F#2 . C#3 . D3 . C#3 . | F#2 . C#3 . D3 . C#3 . F#2 . C#3 . D3 . C#3 .",
          bass:
          "G2 . G2 G2 G2 . G2 G2 G2 . G2 G2 G2 . G3 G2 | G2 . G2 G2 G2 . G2 G2 G2 . G2 G2 G2 . G3 G2 | " +
          "E2 . E2 E2 E2 . E2 E2 E2 . E2 E2 E2 . E3 E2 | E2 . E2 E2 E2 . E2 E2 E2 . E2 E2 E2 . E3 E2 | " +
          "C2 . C2 C2 C2 . C2 C2 C2 . C2 C2 C2 . C3 C2 | C2 . C2 C2 C2 . C2 C2 C2 . C2 C2 C2 . C3 C2 | " +
          "F#2 . F#2 F#2 F#2 . F#2 F#2 F#2 . F#2 F#2 F#2 . F#3 F#2 | F#2 . F#2 F#2 F#2 . F#2 F#2 F#2 . F#2 F#2 F#2 . F#3 F#2",
          drums:
          "k . h . s . h k k . h . s . h . | k . h . s . h k k . h . s . h . | " +
          "k . h . s . h k k . h . s . h . | k . h . s . h k k . h . s . h . | " +
          "k . h . s . h k k . h . s . h . | k . h . s . h k k . h . s . h . | " +
          "k . h . s . h k k . h . s . h . | k . s . k . s . ks . s . ks . s s",
          lead:
          "D5 - - - - - E5 - D5 - - - B4 - - - | G4 - - - - - - - - - - - . . . . | " +
          "E5 - - - - - F#5 - G5 - - - E5 - - - | B4 - - - - - - - - - - - . . . . | " +
          "C5 - - - - - B4 - G4 - - - E4 - - - | E5 - - - - - - - D5 - - - C5 - - - | " +
          "C#5 - - - - - D5 - C#5 - - - A#4 - - - | F#4 - - - - - - - - - - - . . . .",
          shriek:
          "G3 B3 D4 G4 G3 B3 D4 G4 G3 B3 D4 G4 G3 B3 D4 G4 | G3 B3 D4 G4 G3 B3 D4 G4 G3 B3 D4 G4 G3 B3 D4 G4 | " +
          "E4 G4 B4 G4 E4 G4 B4 G4 E4 G4 B4 G4 E4 G4 B4 G4 | E4 G4 B4 G4 E4 G4 B4 G4 E4 G4 B4 G4 E4 G4 B4 G4 | " +
          "C4 E4 G4 C5 C4 E4 G4 C5 C4 E4 G4 C5 C4 E4 G4 C5 | C4 E4 G4 C5 C4 E4 G4 C5 C4 E4 G4 C5 C4 E4 G4 C5 | " +
          "F#3 A#3 C#4 F#4 F#3 A#3 C#4 F#4 F#3 A#3 C#4 F#4 F#3 A#3 C#4 F#4 | F#3 A#3 C#4 F#4 F#3 A#3 C#4 F#4 F#3 A#3 C#4 F#4 F#3 A#3 C#4 F#4",
        },
        C: {
          organ:
          "B2 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "C3 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -",
          sub:
          "B1 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -",
          ost:
          "B2 . F#3 . G3 . F#3 . B2 . F#3 . G3 . F#3 . | B2 . F#3 . G3 . F#3 . B2 . F#3 . G3 . F#3 . | " +
          "C3 . G3 . G#3 . G3 . C3 . G3 . G#3 . G3 . | C3 . G3 . G#3 . G3 . C3 . G3 . G#3 . G3 .",
          drums:
          "k . . k . . . . . . . . . . . . | k . . k . . . . . . . . . . . . | " +
          "k . . k . . . . . . . . . . . . | k . k . s . s . ks . s . ks . ks .",
          lead:
          ". . . . . . . . . . . . . . . . | F#4 - - - - - - - - - - - - - - - | " +
          ". . . . . . . . . . . . . . . . | G4 - - - - - - - - - - - F#4 - - -",
        },
        D: {
          organ:
          "B2 - - - - - - - - - - - - - - - | C3 - - - - - - - - - - - - - - - | " +
          "B2 - - - - - - - - - - - - - - - | C3 - - - - - - - - - - - - - - - | " +
          "G2 - - - - - - - - - - - - - - - | F#2 - - - - - - - - - - - - - - - | " +
          "E2 - - - - - - - - - - - - - - - | F#2 - - - - - - - - - - - - - - -",
          sub:
          "B1 - - - - - - - - - - - - - - - | C2 - - - - - - - - - - - - - - - | " +
          "B1 - - - - - - - - - - - - - - - | C2 - - - - - - - - - - - - - - - | " +
          "G1 - - - - - - - - - - - - - - - | F#1 - - - - - - - - - - - - - - - | " +
          "E1 - - - - - - - - - - - - - - - | F#1 - - - - - - - - - - - - - - -",
          ost:
          "B2 . F#3 . G3 . F#3 . B2 . F#3 . G3 . F#3 . | C3 . G3 . G#3 . G3 . C3 . G3 . G#3 . G3 . | " +
          "B2 . F#3 . G3 . F#3 . B2 . F#3 . G3 . F#3 . | C3 . G3 . G#3 . G3 . C3 . G3 . G#3 . G3 . | " +
          "G2 . D3 . Eb3 . D3 . G2 . D3 . Eb3 . D3 . | F#2 . C#3 . D3 . C#3 . F#2 . C#3 . D3 . C#3 . | " +
          "E2 . B2 . C3 . B2 . E2 . B2 . C3 . B2 . | F#2 . C#3 . D3 . C#3 . F#2 . C#3 . D3 . C#3 .",
          bass:
          "B1 . B1 B1 B1 . B1 B1 B1 . B1 B1 B1 . B2 B1 | C2 . C2 C2 C2 . C2 C2 C2 . C2 C2 C2 . C3 C2 | " +
          "B1 . B1 B1 B1 . B1 B1 B1 . B1 B1 B1 . B2 B1 | C2 . C2 C2 C2 . C2 C2 C2 . C2 C2 C2 . C3 C2 | " +
          "G2 . G2 G2 G2 . G2 G2 G2 . G2 G2 G2 . G3 G2 | F#2 . F#2 F#2 F#2 . F#2 F#2 F#2 . F#2 F#2 F#2 . F#3 F#2 | " +
          "E2 . E2 E2 E2 . E2 E2 E2 . E2 E2 E2 . E3 E2 | F#2 . F#2 F#2 F#2 . F#2 F#2 F#2 . F#2 F#2 F#2 . F#3 F#2",
          drums:
          "k . h . s . h k k . h k s . s s | k . h . s . h k k . h k s . s s | " +
          "k . h . s . h k k . h k s . s s | k . h . s . h k k . h k s . s s | " +
          "k . h . s . h k k . h k s . s s | k . h . s . h k k . h k s . s s | " +
          "k . h . s . h k k . h k s . s s | ks . s . ks . s . ks . s . ks s ks s",
          lead:
          "F#5 - - - - - - - G5 - - - F#5 - - - | E5 - - - - - - - C5 - - - - - - - | " +
          "D5 - - - - - C#5 - B4 - - - - - - - | C5 - - - B4 - - - G4 - - - E4 - - - | " +
          "D5 - - - - - - - B4 - - - - - - - | C#5 - - - - - - - A#4 - - - - - - - | " +
          "B4 - - - - - C5 - B4 - - - G4 - - - | A#4 - - - C#5 - - - E5 - - - F#5 - - -",
          shriek:
          "B3 D4 F#4 B4 B3 D4 F#4 B4 B3 D4 F#4 B4 B3 D4 F#4 B4 | C4 E4 G4 C5 C4 E4 G4 C5 C4 E4 G4 C5 C4 E4 G4 C5 | " +
          "B3 D4 F#4 B4 B3 D4 F#4 B4 B3 D4 F#4 B4 B3 D4 F#4 B4 | C4 E4 G4 C5 C4 E4 G4 C5 C4 E4 G4 C5 C4 E4 G4 C5 | " +
          "G3 B3 D4 G4 G3 B3 D4 G4 G3 B3 D4 G4 G3 B3 D4 G4 | F#3 A#3 C#4 F#4 F#3 A#3 C#4 F#4 F#3 A#3 C#4 F#4 F#3 A#3 C#4 F#4 | " +
          "E4 G4 B4 G4 E4 G4 B4 G4 E4 G4 B4 G4 E4 G4 B4 G4 | F#3 A#3 C#4 F#4 F#3 A#3 C#4 F#4 F#3 A#3 C#4 F#4 F#3 A#3 C#4 F#4",
        },
      },
      order: ["I", "A", "B", "C", "D"],
    },
    // The Long Hall: 80s horror synth in 7/8. An original 80s horror-synth
    // ostinato in 7/8 (grouped 3+2+2) over pulsing eighth-note bass in E
    // Phrygian; listen for it lurching from E to C to the dreaded F, then
    // thinning out to almost nothing. Its lead now sits an octave lower,
    // under the ostinato's top.
    ghoulHall: {
      bpm: 100,
      rush: 8,
      voices: {
        drone: { wave: "triangle", gain: 0.55, decay: 0.3, sustain: 0.95 },
        bass: { wave: "triangle", gain: 0.75, decay: 0.05, sustain: 0.4 },
        ost: { wave: "pulse", duty: 0.25, gain: 0.2, from: 0.25, decay: 0.05, sustain: 0.3 },
        drums: { kit: true, gain: 0.45, from: 0.4 },
        lead: { wave: "sawtooth", gain: 0.15, from: 0.6, decay: 0.2, sustain: 0.8, vibrato: { rate: 5, depth: 0.008, delay: 0.3 } },
        choir: { wave: "square", gain: 0.11, from: 0.85, decay: 0.3, sustain: 0.9 },
      },
      patterns: {
        A: {
          drone:
          "E1 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - -",
          bass:
          "E2 . E2 . E2 . E2 . E2 . E2 . E2 . E2 . | E2 . E2 . E2 . E2 . E2 . E2 . E2 . E2 . | " +
          "E2 . E2 . E2 . E2 . E2 . E2 . E2 . E2 . | E2 . E2 . E2 . E2 . E2 . E2 . E2 . E2 . | " +
          "E2 . E2 . E2 . E2 . E2 . E2 . E2 . E2 . | E2 . E2 . E2 . E2 . E2 . E2 . E2 . E2 . | " +
          "E2 . E2 . E2 . E2 . E2 . E2 . E2 . E2 .",
          ost:
          "E3 . B3 . C4 . E3 . C4 . E3 . B3 . E3 . | B3 . C4 . E3 . C4 . E3 . B3 . E3 . B3 . | " +
          "C4 . E3 . C4 . E3 . B3 . E3 . B3 . C4 . | E3 . C4 . E3 . B3 . E3 . B3 . C4 . E3 . | " +
          "C4 . E3 . B3 . E3 . B3 . C4 . E3 . C4 . | E3 . B3 . E3 . B3 . C4 . E3 . C4 . E3 . | " +
          "B3 . E3 . B3 . C4 . E3 . C4 . E3 . B3 .",
          drums:
          "k . . . . . k . . . . . . . k . | . . . . k . . . . . . . k . . . | " +
          ". . k . . . . . . . k . . . . . | k . . . . . . . k . . . . . k . | " +
          ". . . . . . k . . . . . k . . . | . . . . k . . . . . k . . . . . | " +
          ". . k . . . . . k . . . . . . .",
          lead:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . E3 - - - - - - - | " +
          "- - - - - - - - - - - - - F3 - - | - - - - E3 - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - -",
          choir:
          "Bb3 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - A3 - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - -",
        },
        B: {
          drone:
          "C2 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - -",
          bass:
          "C2 . C2 . C2 . C2 . C2 . C2 . C2 . C2 . | C2 . C2 . C2 . C2 . C2 . C2 . C2 . C2 . | " +
          "C2 . C2 . C2 . C2 . C2 . C2 . C2 . C2 . | C2 . C2 . C2 . C2 . C2 . C2 . C2 . C2 . | " +
          "C2 . C2 . C2 . C2 . C2 . C2 . C2 . C2 . | C2 . C2 . C2 . C2 . C2 . C2 . C2 . C2 . | " +
          "C2 . C2 . C2 . C2 . C2 . C2 . C2 . C2 .",
          ost:
          "C3 . G3 . G#3 . C3 . G#3 . C3 . G3 . C3 . | G3 . G#3 . C3 . G#3 . C3 . G3 . C3 . G3 . | " +
          "G#3 . C3 . G#3 . C3 . G3 . C3 . G3 . G#3 . | C3 . G#3 . C3 . G3 . C3 . G3 . G#3 . C3 . | " +
          "G#3 . C3 . G3 . C3 . G3 . G#3 . C3 . G#3 . | C3 . G3 . C3 . G3 . G#3 . C3 . G#3 . C3 . | " +
          "G3 . C3 . G3 . G#3 . C3 . G#3 . C3 . G3 .",
          drums:
          "k . . . . . k . . . h . . . k . | . . . . k . . . h . . . k . . . | " +
          ". . k . . . h . . . k . . . . . | k . . . h . . . k . . . . . k . | " +
          ". . h . . . k . . . . . k . . . | h . . . k . . . . . k . . . h . | " +
          ". . k . . . . . k . . . h . . .",
          lead:
          "G3 - - - - - - - - - - - - - - - | - - - - - - - - - - - - Ab3 - - - | " +
          "- - - - - - - - - - G3 - - - - - | - - - - - - - - F3 - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - Db3 - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - -",
          choir:
          "Gb3 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - F3 - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - -",
        },
        C: {
          drone:
          "F1 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - -",
          bass:
          "F2 . F2 . F2 . F2 . F2 . F2 . F2 . F2 . | F2 . F2 . F2 . F2 . F2 . F2 . F2 . F2 . | " +
          "F2 . F2 . F2 . F2 . F2 . F2 . F2 . F2 . | F2 . F2 . F2 . F2 . F2 . F2 . F2 . F2 . | " +
          "F2 . F2 . F2 . F2 . F2 . F2 . F2 . F2 . | F2 . F2 . F2 . F2 . F2 . F2 . F2 . F2 . | " +
          "F2 . F2 . F2 . F2 . F2 . F2 . F2 . F2 .",
          ost:
          "F3 . C4 . C#4 . F3 . Eb4 . F3 . F#3 . F3 . | C4 . C#4 . F3 . Eb4 . F3 . F#3 . F3 . C4 . | " +
          "C#4 . F3 . Eb4 . F3 . F#3 . F3 . C4 . C#4 . | F3 . Eb4 . F3 . F#3 . F3 . C4 . C#4 . F3 . | " +
          "Eb4 . F3 . F#3 . F3 . C4 . C#4 . F3 . Eb4 . | F3 . F#3 . F3 . C4 . C#4 . F3 . Eb4 . F3 . | " +
          "F#3 . F3 . C4 . C#4 . F3 . Eb4 . F3 . F#3 .",
          drums:
          "k . . . . . k . . . k . . . k . | . . . . k . . . k . . . k . . . | " +
          ". . k . . . k . . . k . . . . . | k . . . k . . . k . . . . . k . | " +
          ". . k . . . k . . . . . k . . . | k . . . k . . . . . k . . . k . | " +
          ". . k . . . . . k . . . k . . .",
          lead:
          "C3 - - - - - - - - - - - - - - - | - - - - - - - - - - - - Db3 - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - C3 - - - - - - - | " +
          "- - - - - - Bb2 - - - - - - - - - | - - - - Ab2 - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - -",
          choir:
          "B3 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - C4 - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - -",
        },
        D: {
          drone:
          "E1 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - -",
          bass:
          "E2 . . . . . E2 . . . E2 . . . E2 . | . . . . E2 . . . E2 . . . E2 . . . | " +
          ". . E2 . . . E2 . . . E2 . . . . . | E2 . . . E2 . . . E2 . . . . . E2 . | " +
          ". . E2 . . . E2 . . . . . E2 . . . | E2 . . . E2 . . . . . E2 . . . E2 . | " +
          ". . E2 . . . . . E2 . . . E2 . . .",
          ost:
          "E3 . . . . . E3 . . . F3 . . . E3 . | . . . . E3 . . . F3 . . . E3 . . . | " +
          ". . E3 . . . F3 . . . E3 . . . . . | E3 . . . F3 . . . E3 . . . . . E3 . | " +
          ". . F3 . . . E3 . . . . . E3 . . . | F3 . . . E3 . . . . . E3 . . . F3 . | " +
          ". . E3 . . . . . E3 . . . F3 . . .",
          drums:
          "k . . . . . . . . . . . . . k . | . . . . . . . . . . . . k . . . | " +
          ". . . . . . . . . . k . . . . . | . . . . . . . . k . . . . . . . | " +
          ". . . . . . k . . . . . . . . . | . . . . k . . . . . . . . . . . | " +
          ". . k . . . . . . . . . . . . .",
          lead:
          "E3 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - . . . . . . | . . . . . . . . F3 - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - . . . . . . . . . . . . . .",
          choir:
          "Bb3 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - -",
        },
      },
      order: ["A", "B", "C", "D"],
    },
  },
};

export default {
  tones: { ...HOUSE.tones, ...fromStages("tones") },
  hums: { ...HOUSE.hums, ...fromStages("hums") },
  music: { ...HOUSE.music, ...fromStages("music") },
};
