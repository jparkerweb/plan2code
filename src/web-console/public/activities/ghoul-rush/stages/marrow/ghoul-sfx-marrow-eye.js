// Plan2Code Web Console - ghoul: the sounds for the finale's second kill, Marrow, Every Room at Once (the Eye), merged into sfx/ghoul-sfx.js; defines only.
//
// Same shape and rules as ghoul-sfx-marrow.js: `tones` (the Eye's `ghoulEye<Act>` and its
// shades' `ghoulEyeShade<Act>` sounds, none over 1.2 s with its delay). `music` holds
// ghoulMarrowRooms, the user's pick (Carousel off its axis), named in ROOM_MUSIC. The House is still wood and
// pipes, now from the inside: floorboards, a lamp's buzz, wet paper tearing, a music box
// gone wrong; its shades are breath and cold glass. The user's picks from the sound vote
// (prototypes/sounds/ghoul-rush/eye.html). A name may be defined only once
// across tones.js and every game's file. No imports.

export const EYE_SFX = {
  tones: {
    // Marrow, Every Room at Once: The House with its front torn off, a dollhouse of nine rooms: a lamp flares, the wallpaper splits and the Eye stares out; it lurches the whole house, calls up shades of the keepers YOU beat, and dies in a heap of peeled paper and cracked floors.
    // Wakes: Timbers and a music box.
    ghoulEyeWake: {
      layers: [
        { type: "sawtooth", from: 75, to: 55, seconds: 1.1, attack: 0.03, gain: 0.6, filter: { type: "bandpass", from: 400, to: 300, q: 6 }, vibrato: { rate: 16, depth: 0.1 } },
        { type: "brown", seconds: 1.1, attack: 0.05, gain: 0.3, filter: { type: "lowpass", from: 120, to: 70, q: 1 } },
        { type: "triangle", from: 1568, to: 1537, seconds: 0.22, attack: 0.003, gain: 0.3, delay: 0.1 },
        { type: "triangle", from: 1319, to: 1293, seconds: 0.22, attack: 0.003, gain: 0.3, delay: 0.34 },
        { type: "triangle", from: 1047, to: 1026, seconds: 0.22, attack: 0.003, gain: 0.3, delay: 0.58 },
      ],
    },
    // Hit in the Eye: Wet tick.
    ghoulEyeHurt: {
      layers: [
        { type: "sine", from: 900, to: 520, seconds: 0.07, attack: 0.003, gain: 0.6 },
        { type: "noise", seconds: 0.06, attack: 0.003, gain: 0.4, filter: { type: "bandpass", from: 1800, to: 900, q: 2 } },
      ],
    },
    // Dies: Hinge shriek, timber.
    ghoulEyeDie: {
      layers: [
        { type: "sawtooth", from: 700, to: 420, seconds: 0.8, attack: 0.03, gain: 0.4, vibrato: { rate: 12, depth: 0.04 }, filter: { type: "bandpass", from: 1400, to: 1680, q: 4 } },
        { type: "sawtooth", from: 1050, to: 630, seconds: 0.72, attack: 0.04, gain: 0.18, filter: { type: "bandpass", from: 2100, to: 2100, q: 5 } },
        { type: "noise", seconds: 0.64, attack: 0.03, gain: 0.15, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
        { type: "sawtooth", from: 75, to: 55, seconds: 1, attack: 0.03, gain: 0.6, delay: 0.1, filter: { type: "bandpass", from: 400, to: 300, q: 6 }, vibrato: { rate: 16, depth: 0.1 } },
        { type: "brown", seconds: 1, attack: 0.05, gain: 0.3, delay: 0.1, filter: { type: "lowpass", from: 120, to: 70, q: 1 } },
        { type: "sine", from: 66, to: 24, seconds: 0.25, attack: 0, gain: 1, delay: 0.4 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.8, filter: { type: "lowpass", from: 192, to: 192, q: 1 }, delay: 0.4 },
      ],
    },
    // A lamp flares: Swelling buzz.
    ghoulEyeFlare: {
      layers: [
        { type: "sawtooth", from: 120, to: 120, seconds: 0.7, attack: 0.27999999999999997, gain: 0.4, filter: { type: "bandpass", from: 900, to: 2200, q: 4 }, vibrato: { rate: 30, depth: 0.03 } },
        { type: "sine", from: 1800, to: 2600, seconds: 0.56, attack: 0.21, gain: 0.15, delay: 0.05 },
      ],
    },
    // The flare's second step: Buzz jump, creak.
    ghoulEyeFlareStep: {
      layers: [
        { type: "square", from: 240, to: 250, seconds: 0.25, attack: 0.003, gain: 0.4, filter: { type: "bandpass", from: 1400, to: 1800, q: 6 } },
        { type: "sawtooth", from: 180, to: 132, seconds: 0.3, attack: 0.03, gain: 0.36, filter: { type: "bandpass", from: 960, to: 720, q: 6 }, vibrato: { rate: 16, depth: 0.1 } },
        { type: "brown", seconds: 0.3, attack: 0.05, gain: 0.18, filter: { type: "lowpass", from: 288, to: 168, q: 1 } },
      ],
    },
    // The Eye opens: Moist pop.
    ghoulEyeOpen: {
      layers: [
        { type: "noise", seconds: 0.5, attack: 0, gain: 0.5, filter: { type: "lowpass", from: 6720, to: 240, q: 1 } },
        { type: "sine", from: 256, to: 56, seconds: 0.4, attack: 0, gain: 0.45 },
        { type: "brown", seconds: 0.6, attack: 0.01, gain: 0.35, filter: { type: "lowpass", from: 640, to: 640, q: 1 } },
        { type: "sine", from: 200, to: 380, seconds: 0.2, attack: 0.003, gain: 0.4, delay: 0.1 },
      ],
    },
    // The Eye shuts: Click shut.
    ghoulEyeShut: {
      layers: [
        { type: "triangle", from: 260, to: 221, seconds: 0.22, attack: 0, gain: 0.45 },
        { type: "sine", from: 702, to: 650, seconds: 0.12, attack: 0, gain: 0.18 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.25, filter: { type: "bandpass", from: 1040, to: 1040, q: 2 } },
      ],
    },
    // A false lamp pops: Pop.
    ghoulEyeDud: {
      layers: [
        { type: "noise", seconds: 0.1, attack: 0, gain: 0.4, filter: { type: "highpass", from: 2520, to: 2520, q: 1 } },
        { type: "sine", from: 980, to: 210, seconds: 0.16, delay: 0.02, gain: 0.3 },
        { type: "brown", seconds: 0.12, attack: 0, gain: 0.25, filter: { type: "lowpass", from: 588, to: 588, q: 1 } },
      ],
    },
    // A door opens: Long creak.
    ghoulEyeDoor: {
      layers: [
        { type: "sawtooth", from: 300, to: 420, seconds: 0.6, attack: 0.03, gain: 0.6, filter: { type: "bandpass", from: 1600, to: 1200, q: 6 }, vibrato: { rate: 26, depth: 0.1 } },
        { type: "brown", seconds: 0.6, attack: 0.05, gain: 0.3, filter: { type: "lowpass", from: 480, to: 280, q: 1 } },
        { type: "sawtooth", from: 180, to: 132, seconds: 0.4, attack: 0.03, gain: 0.3, delay: 0.4, filter: { type: "bandpass", from: 960, to: 720, q: 6 }, vibrato: { rate: 16, depth: 0.1 } },
        { type: "brown", seconds: 0.4, attack: 0.05, gain: 0.15, delay: 0.4, filter: { type: "lowpass", from: 288, to: 168, q: 1 } },
      ],
    },
    // The house creaks: Long timber groan.
    ghoulEyeCreak: {
      layers: [
        { type: "sawtooth", from: 90, to: 66, seconds: 1, attack: 0.03, gain: 0.6, filter: { type: "bandpass", from: 480, to: 360, q: 6 }, vibrato: { rate: 9, depth: 0.1 } },
        { type: "brown", seconds: 1, attack: 0.05, gain: 0.3, filter: { type: "lowpass", from: 144, to: 84, q: 1 } },
        { type: "sawtooth", from: 135, to: 99, seconds: 0.8, attack: 0.03, gain: 0.3, delay: 0.2, filter: { type: "bandpass", from: 720, to: 540, q: 6 }, vibrato: { rate: 16, depth: 0.1 } },
        { type: "brown", seconds: 0.8, attack: 0.05, gain: 0.15, delay: 0.2, filter: { type: "lowpass", from: 216, to: 126, q: 1 } },
      ],
    },
    // The creak's second step: Joist crack.
    ghoulEyeCreakStep: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 1, filter: { type: "bandpass", from: 1080, to: 720, q: 2 } },
        { type: "square", from: 540, to: 180, seconds: 0.05, attack: 0, gain: 0.4 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.7, filter: { type: "bandpass", from: 1560, to: 1080, q: 3 } },
        { type: "sawtooth", from: 105, to: 77, seconds: 0.45, attack: 0.03, gain: 0.6, delay: 0.03, filter: { type: "bandpass", from: 560, to: 420, q: 6 }, vibrato: { rate: 16, depth: 0.1 } },
        { type: "brown", seconds: 0.45, attack: 0.05, gain: 0.3, delay: 0.03, filter: { type: "lowpass", from: 168, to: 98, q: 1 } },
      ],
    },
    // It lurches: Deep shift.
    ghoulEyeLurch: {
      layers: [
        { type: "sine", from: 70, to: 38, seconds: 0.7, attack: 0.003, gain: 0.8 },
        { type: "brown", seconds: 1.1, attack: 0.003, gain: 0.6, filter: { type: "lowpass", from: 600, to: 120, q: 1 } },
        { type: "noise", seconds: 0.9, attack: 0.1, gain: 0.25, delay: 0.1, filter: { type: "bandpass", from: 500, to: 1200, q: 2 } },
      ],
    },
    // A dresser hits the wall: Wood crash.
    ghoulEyeCrash: {
      layers: [
        { type: "noise", seconds: 0.25, attack: 0.003, gain: 0.6, filter: { type: "lowpass", from: 2400, to: 500, q: 1 } },
        { type: "sine", from: 132, to: 48, seconds: 0.25, attack: 0, gain: 1 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.8, filter: { type: "lowpass", from: 384, to: 384, q: 1 } },
      ],
    },
    // A dresser shot apart: Splinters and tinkle.
    ghoulEyeSmash: {
      layers: [
        { type: "noise", seconds: 0.3, attack: 0.003, gain: 0.6, filter: { type: "bandpass", from: 1600, to: 600, q: 1.5 } },
        { type: "sine", from: 3100, to: 2900, seconds: 0.25, attack: 0.003, gain: 0.15, delay: 0.05 },
        { type: "sine", from: 4300, to: 4000, seconds: 0.18, attack: 0.003, gain: 0.11, delay: 0.1 },
        { type: "noise", seconds: 0.2, attack: 0.003, gain: 0.24, delay: 0.05, filter: { type: "highpass", from: 4000, to: 2400, q: 1 } },
        { type: "sine", from: 120, to: 70, seconds: 0.25, attack: 0.003, gain: 0.45 },
      ],
    },
    // The Eye bursts: Big wet pop.
    ghoulEyeBurst: {
      layers: [
        { type: "noise", seconds: 0.5, attack: 0, gain: 1, filter: { type: "lowpass", from: 3780, to: 135, q: 1 } },
        { type: "sine", from: 144, to: 32, seconds: 0.4, attack: 0, gain: 0.9 },
        { type: "brown", seconds: 0.6, attack: 0.01, gain: 0.7, filter: { type: "lowpass", from: 360, to: 360, q: 1 } },
        { type: "noise", seconds: 0.28, attack: 0, gain: 0.54, filter: { type: "lowpass", from: 1820, to: 140, q: 1 }, delay: 0.05 },
        { type: "square", from: 98, to: 28, seconds: 0.16, attack: 0, gain: 0.3, filter: { type: "lowpass", from: 420, to: 420, q: 1 }, delay: 0.05 },
        { type: "sine", from: 630, to: 910, seconds: 0.05, delay: 0.25, gain: 0.15 },
        { type: "sine", from: 532, to: 770, seconds: 0.05, delay: 0.39, gain: 0.11 },
      ],
    },
    // The paper peels: Long tearing.
    ghoulEyePeel: {
      layers: [
        { type: "noise", seconds: 1, attack: 0.01, gain: 0.48, filter: { type: "bandpass", from: 3000, to: 900, q: 1.5 } },
        { type: "pink", seconds: 0.8, attack: 0.02, gain: 0.24, delay: 0.04, filter: { type: "bandpass", from: 1600, to: 700, q: 3 } },
        { type: "noise", seconds: 0.9, attack: 0.01, gain: 0.3, delay: 0.15, filter: { type: "bandpass", from: 2100, to: 630, q: 1.5 } },
        { type: "pink", seconds: 0.72, attack: 0.02, gain: 0.15, delay: 0.19, filter: { type: "bandpass", from: 1120, to: 490, q: 3 } },
      ],
    },
    // A floor cracks: Crack and rumble.
    ghoulEyeCrack: {
      layers: [
        { type: "noise", seconds: 0.12, attack: 0.003, gain: 0.7, filter: { type: "bandpass", from: 2200, to: 1000, q: 2 } },
        { type: "sine", from: 120, to: 45, seconds: 0.5, attack: 0.003, gain: 0.6 },
        { type: "brown", seconds: 0.7, attack: 0.003, gain: 0.45, delay: 0.05, filter: { type: "lowpass", from: 500, to: 100, q: 1 } },
      ],
    },
    // The wet gasp: Breath through pipes.
    ghoulEyeGasp: {
      layers: [
        { type: "pink", seconds: 1, attack: 0.25, gain: 0.55, filter: { type: "bandpass", from: 300, to: 900, q: 3 } },
        { type: "sawtooth", from: 85, to: 55, seconds: 1, attack: 0.2, gain: 0.3, delay: 0.1, filter: { type: "lowpass", from: 500, to: 250, q: 3 }, vibrato: { rate: 7, depth: 0.12 } },
      ],
    },
    // It sinks: Long rumble.
    ghoulEyeSink: {
      layers: [
        { type: "brown", seconds: 1.15, attack: 0.08, gain: 1, filter: { type: "lowpass", from: 180, to: 70, q: 1 } },
        { type: "sine", from: 48, to: 30, seconds: 1.15, attack: 0.05, gain: 0.8 },
        { type: "sawtooth", from: 70, to: 42, seconds: 1, attack: 0.2, gain: 0.25, delay: 0.1, filter: { type: "lowpass", from: 300, to: 150, q: 2 }, vibrato: { rate: 5, depth: 0.08 } },
      ],
    },
    // Gone: the stair of bones: Bone steps, hollow knock.
    ghoulEyeGone: {
      layers: [
        { type: "triangle", from: 520, to: 442, seconds: 0.22, attack: 0, gain: 0.36 },
        { type: "sine", from: 1404, to: 1300, seconds: 0.12, attack: 0, gain: 0.14 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.2, filter: { type: "bandpass", from: 2080, to: 2080, q: 2 } },
        { type: "triangle", from: 470, to: 400, seconds: 0.22, attack: 0, gain: 0.36, delay: 0.12 },
        { type: "sine", from: 1269, to: 1175, seconds: 0.12, attack: 0, gain: 0.14, delay: 0.12 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.2, filter: { type: "bandpass", from: 1880, to: 1880, q: 2 }, delay: 0.12 },
        { type: "triangle", from: 420, to: 357, seconds: 0.22, attack: 0, gain: 0.36, delay: 0.24 },
        { type: "sine", from: 1134, to: 1050, seconds: 0.12, attack: 0, gain: 0.14, delay: 0.24 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.2, filter: { type: "bandpass", from: 1680, to: 1680, q: 2 }, delay: 0.24 },
        { type: "sine", from: 98, to: 92, seconds: 0.8, attack: 0.05, gain: 0.45, delay: 0.35 },
      ],
    },
    // Shades of the keepers: Pale, see-through ghosts of the bosses YOU beat this run step out of the house's doors, each with one move of its own (a hop, a skull, a scythe, a note, a dash, a leap, knocks, a hoop, icicles, mud).
    // Steps out: Cold breath, hum.
    ghoulEyeShadeIn: {
      layers: [
        { type: "pink", seconds: 0.6, attack: 0.25, gain: 0.8, filter: { type: "bandpass", from: 560, to: 2080, q: 5 } },
        { type: "noise", seconds: 0.42, delay: 0.24, attack: 0.1, gain: 0.5, filter: { type: "bandpass", from: 2080, to: 720, q: 8 } },
        { type: "sine", from: 330, to: 311, seconds: 0.7, attack: 0.2, gain: 0.3, delay: 0.1, vibrato: { rate: 5, depth: 0.03 } },
      ],
    },
    // Fades away: Falling tone.
    ghoulEyeShadeOut: {
      layers: [
        { type: "sine", from: 311, to: 220, seconds: 0.5, attack: 0.05, gain: 0.4 },
        { type: "pink", seconds: 0.4, attack: 0.05, gain: 0.3, filter: { type: "bandpass", from: 900, to: 400, q: 3 } },
      ],
    },
    // Winds up: Rising inhale.
    ghoulEyeShadeWind: {
      layers: [
        { type: "pink", seconds: 0.7, attack: 0.4, gain: 0.5, filter: { type: "bandpass", from: 500, to: 1800, q: 4 } },
        { type: "sine", from: 260, to: 520, seconds: 0.7, attack: 0.4, gain: 0.3 },
      ],
    },
    // Hit: Hiss through glass.
    ghoulEyeShadeHurt: {
      layers: [
        { type: "noise", seconds: 0.08, attack: 0.003, gain: 0.4, filter: { type: "highpass", from: 3000, to: 2000, q: 1 } },
        { type: "sine", from: 1200, to: 900, seconds: 0.1, attack: 0.003, gain: 0.3 },
      ],
    },
    // Laid to rest: Sigh rising away.
    ghoulEyeShadeDie: {
      layers: [
        { type: "sine", from: 400, to: 1200, seconds: 0.6, attack: 0.02, gain: 0.4, vibrato: { rate: 6, depth: 0.04 } },
        { type: "pink", seconds: 0.6, attack: 0.05, gain: 0.3, filter: { type: "bandpass", from: 800, to: 2400, q: 2 } },
      ],
    },
    // Gourd lands: Hollow thump.
    ghoulEyeShadeSlam: {
      layers: [
        { type: "sine", from: 154, to: 56, seconds: 0.25, attack: 0, gain: 1 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.8, filter: { type: "lowpass", from: 448, to: 448, q: 1 } },
        { type: "noise", seconds: 0.1, attack: 0.003, gain: 0.3, filter: { type: "lowpass", from: 900, to: 400, q: 1 } },
      ],
    },
    // Skull thrown: Whirr.
    ghoulEyeShadeThrow: {
      layers: [
        { type: "noise", seconds: 0.35, attack: 0.03, gain: 0.4, filter: { type: "bandpass", from: 1400, to: 2200, q: 6 } },
      ],
    },
    // Angel moves: Stone grind.
    ghoulEyeShadeGrind: {
      layers: [
        { type: "brown", seconds: 0.5, attack: 0.05, gain: 0.5, filter: { type: "bandpass", from: 300, to: 500, q: 3 } },
        { type: "noise", seconds: 0.4, attack: 0.05, gain: 0.2, filter: { type: "bandpass", from: 900, to: 700, q: 4 } },
      ],
    },
    // Scythe sweeps: Long swish.
    ghoulEyeShadeScythe: {
      layers: [
        { type: "noise", seconds: 0.35, attack: 0.05, gain: 0.5, filter: { type: "bandpass", from: 800, to: 3200, q: 3 } },
        { type: "sine", from: 2400, to: 1600, seconds: 0.2, attack: 0.003, gain: 0.12, delay: 0.15 },
      ],
    },
    // A note fired: Pure choir tone.
    ghoulEyeShadeNote: {
      layers: [
        { type: "sine", from: 523, to: 523, seconds: 0.5, attack: 0.05, gain: 0.4, vibrato: { rate: 6, depth: 0.02 } },
        { type: "triangle", from: 1046, to: 1046, seconds: 0.4, attack: 0.05, gain: 0.15 },
      ],
    },
    // Matron dashes: Swoosh and glint.
    ghoulEyeShadeDash: {
      layers: [
        { type: "noise", seconds: 0.3, attack: 0.02, gain: 0.5, filter: { type: "bandpass", from: 2000, to: 600, q: 3 } },
        { type: "sine", from: 3500, to: 3300, seconds: 0.12, attack: 0.003, gain: 0.2 },
      ],
    },
    // Beast leaps: Snarl.
    ghoulEyeShadeLeap: {
      layers: [
        { type: "sawtooth", from: 140, to: 220, seconds: 0.35, attack: 0.02, gain: 0.4, filter: { type: "lowpass", from: 900, to: 1400, q: 3 }, vibrato: { rate: 30, depth: 0.12 } },
        { type: "noise", seconds: 0.3, attack: 0.03, gain: 0.3, filter: { type: "bandpass", from: 800, to: 1200, q: 3 } },
      ],
    },
    // Beast lands: Thump.
    ghoulEyeShadePounce: {
      layers: [
        { type: "sine", from: 121, to: 44, seconds: 0.25, attack: 0, gain: 1 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.8, filter: { type: "lowpass", from: 352, to: 352, q: 1 } },
        { type: "noise", seconds: 0.15, attack: 0.003, gain: 0.4, filter: { type: "lowpass", from: 1200, to: 400, q: 1 } },
      ],
    },
    // Knocks: Wall knock.
    ghoulEyeShadeKnock: {
      layers: [
        { type: "sine", from: 200, to: 120, seconds: 0.12, attack: 0.003, gain: 0.6 },
        { type: "noise", seconds: 0.05, attack: 0.003, gain: 0.3, filter: { type: "bandpass", from: 1200, to: 800, q: 3 } },
      ],
    },
    // A rock lands: Rock thud.
    ghoulEyeShadeRock: {
      layers: [
        { type: "noise", seconds: 0.18, attack: 0.003, gain: 0.5, filter: { type: "lowpass", from: 1600, to: 400, q: 1 } },
        { type: "sine", from: 110, to: 60, seconds: 0.22, attack: 0.003, gain: 0.5 },
      ],
    },
    // Hoop rolled: Rattling spin.
    ghoulEyeShadeHoop: {
      layers: [
        { type: "square", from: 400, to: 380, seconds: 0.04, attack: 0.003, gain: 0.25, filter: { type: "bandpass", from: 1200, to: 1100, q: 4 } },
        { type: "square", from: 420, to: 400, seconds: 0.04, attack: 0.003, gain: 0.25, delay: 0.09, filter: { type: "bandpass", from: 1250, to: 1150, q: 4 } },
        { type: "square", from: 440, to: 420, seconds: 0.04, attack: 0.003, gain: 0.25, delay: 0.18, filter: { type: "bandpass", from: 1300, to: 1200, q: 4 } },
        { type: "triangle", from: 660, to: 700, seconds: 0.3, attack: 0.02, gain: 0.2 },
      ],
    },
    // Icicle shatters: Ice shatter.
    ghoulEyeShadeIcicle: {
      layers: [
        { type: "sine", from: 2790, to: 2610, seconds: 0.25, attack: 0.003, gain: 0.25 },
        { type: "sine", from: 3870, to: 3600, seconds: 0.18, attack: 0.003, gain: 0.18, delay: 0.05 },
        { type: "noise", seconds: 0.2, attack: 0.003, gain: 0.4, filter: { type: "highpass", from: 3600, to: 2160, q: 1 } },
      ],
    },
    // Mud wave: Gloop.
    ghoulEyeShadeMud: {
      layers: [
        { type: "sine", from: 240, to: 60, seconds: 0.45, attack: 0.02, gain: 0.55 },
        { type: "brown", seconds: 0.5, attack: 0.04, gain: 0.5, filter: { type: "lowpass", from: 700, to: 110, q: 1 } },
      ],
    },
  },
  music: {
    // Every Room at Once: carousel off its axis. The most driving one: a wobbling calliope races the stages' tunes
    // round a carousel (carnival, howl, lullaby, frozen lake, hymn, the bog's toll and the mine's figure), wrong
    // notes and all, over an oom-pah of bass and chord stabs. The kick plays the heartbeat on every bar, two thumps
    // before the snare. A steam whistle doubles the tune at 90%, cymbals near full dread.
    ghoulMarrowRooms: {
      bpm: 120,
      rush: 16,
      voices: {
        calliope: { wave: "pulse", duty: 0.25, gain: 0.07, decay: 0.05, sustain: 0.7, vibrato: { rate: 7, depth: 0.025, delay: 0 } },
        oom: { wave: "triangle", gain: 0.3, decay: 0.04, sustain: 0.4 },
        pah: { wave: "square", gain: 0.03, decay: 0.03, sustain: 0.3 },
        kit: { kit: true, gain: 0.2 },
        whistle: { wave: "sine", gain: 0.06, decay: 0.1, sustain: 0.8, from: 0.9, vibrato: { rate: 8, depth: 0.015, delay: 0 } },
        cym: { kit: true, gain: 0.12, from: 0.95 },
      },
      patterns: {
        C: {
          calliope:
          "D5 - - - F5 - - - A5 - - - - - - - | Bb5 - - - A5 - - - G#5 - - - G#5 - - - | " +
          "G5 - - - F5 - . . D5 - - - - - - - | Eb5 - - - - - - - - - - - . . . .",
          oom:
          "D2 . . . A2 . . . D2 . . . A2 . . . | Bb2 . . . F2 . . . Bb2 . . . F2 . . . | " +
          "G2 . . . D2 . . . G2 . . . D2 . . . | A2 . . . E2 . . . A2 . . . E2 . . .",
          pah:
          ". . D3^037 . . . D3^037 . . . D3^037 . . . D3^037 . | . . Bb3^047 . . . Bb3^047 . . . Bb3^047 . . . Bb3^047 . | " +
          ". . G3^037 . . . G3^037 . . . G3^037 . . . G3^037 . | . . A3^047 . . . A3^047 . . . A3^047 . . . A3^047 .",
          kit:
          "k . k . s . . . . . . . s . . . | k . k . s . . . . . . . s . . . | " +
          "k . k . s . . . . . . . s . . . | k . k . s . . . . . . . s . . .",
          whistle:
          "D6 - - - F6 - - - A6 - - - - - - - | Bb6 - - - A6 - - - Ab6 - - - Ab6 - - - | " +
          "G6 - - - F6 - . . D6 - - - - - - - | Eb6 - - - - - - - - - - - . . . .",
          cym:
          "o . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
        },
        V: {
          calliope:
          "A4 - - - D5 - - - C5 - - - - - - - | F5 - - - E5 - - - D5 - - - . . . . | " +
          "A4 - - - D5 - - - F#5 - - - - - - - | E5 - - - C5 - - - . . . . . . . .",
          oom:
          "D2 . . . A2 . . . D2 . . . A2 . . . | Bb2 . . . F2 . . . Bb2 . . . F2 . . . | " +
          "D2 . . . A2 . . . D2 . . . A2 . . . | A2 . . . E2 . . . A2 . . . E2 . . .",
          pah:
          ". . D3^037 . . . D3^037 . . . D3^037 . . . D3^037 . | . . Bb3^047 . . . Bb3^047 . . . Bb3^047 . . . Bb3^047 . | " +
          ". . D3^037 . . . D3^037 . . . D3^037 . . . D3^037 . | . . A3^047 . . . A3^047 . . . A3^047 . . . A3^047 .",
          kit:
          "k . k . s . . . . . . . s . . . | k . k . s . . . . . . . s . . . | " +
          "k . k . s . . . . . . . s . . . | k . k . s . . . . . . . s . . .",
          whistle:
          "A5 - - - D6 - - - C6 - - - - - - - | F6 - - - E6 - - - D6 - - - . . . . | " +
          "A5 - - - D6 - - - Gb6 - - - - - - - | E6 - - - C6 - - - . . . . . . . .",
          cym:
          "o . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
        },
        S: {
          calliope:
          "D5 - - - F5 - - - E5 - - - D5 - - - | A5 - - - G5 - - - F5 - - - E5 - - - | " +
          "D5 - - - F5 - - - A5 - - - G5 - - - | F5 - - - E5 - - - Eb5 - - - D5 - - -",
          oom:
          "D2 . . . A2 . . . D2 . . . A2 . . . | A2 . . . E2 . . . A2 . . . E2 . . . | " +
          "D2 . . . A2 . . . D2 . . . A2 . . . | A2 . . . E2 . . . A2 . . . E2 . . .",
          pah:
          ". . D3^037 . . . D3^037 . . . D3^037 . . . D3^037 . | . . A3^047 . . . A3^047 . . . A3^047 . . . A3^047 . | " +
          ". . D3^037 . . . D3^037 . . . D3^037 . . . D3^037 . | . . A3^047 . . . A3^047 . . . A3^047 . . . A3^047 .",
          kit:
          "k . k . s . . . . . . . s . . . | k . k . s . . . . . . . s . . . | " +
          "k . k . s . . . . . . . s . . . | k . k . s . . . . . . . s . . .",
          whistle:
          "D6 - - - F6 - - - E6 - - - D6 - - - | A6 - - - G6 - - - F6 - - - E6 - - - | " +
          "D6 - - - F6 - - - A6 - - - G6 - - - | F6 - - - E6 - - - Eb6 - - - D6 - - -",
          cym:
          "o . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
        },
        F: {
          calliope:
          "D5 - - - F5 - - - A5 - - - - - - - | G5 - - - Gb5 - - - E5 - - - - - - - | " +
          "F5 - - - D5 - - - B4 - - - - - - - | C5 - - - - - - - Db5 - - - - - - -",
          oom:
          "D2 . . . A2 . . . D2 . . . A2 . . . | C2 . . . G2 . . . C2 . . . G2 . . . | " +
          "Bb2 . . . F2 . . . Bb2 . . . F2 . . . | A2 . . . E2 . . . A2 . . . E2 . . .",
          pah:
          ". . D3^037 . . . D3^037 . . . D3^037 . . . D3^037 . | . . C3^047 . . . C3^047 . . . C3^047 . . . C3^047 . | " +
          ". . Bb3^047 . . . Bb3^047 . . . Bb3^047 . . . Bb3^047 . | . . A3^047 . . . A3^047 . . . A3^047 . . . A3^047 .",
          kit:
          "k . k . s . . . . . . . s . . . | k . k . s . . . . . . . s . . . | " +
          "k . k . s . . . . . . . s . . . | k . k . s . . . . . . . s . . .",
          whistle:
          "D6 - - - F6 - - - A6 - - - - - - - | G6 - - - Gb6 - - - E6 - - - - - - - | " +
          "F6 - - - D6 - - - B5 - - - - - - - | C6 - - - - - - - Db6 - - - - - - -",
          cym:
          "o . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
        },
        P: {
          calliope:
          "D5 - - - F5 - - - G5 - - - F5 - - - | A5 - - - G5 - - - F5 - - - Eb5 - - - | " +
          "F5 - - - G5 - - - A5 - - - Bb5 - - - | Bb5 - - - A5 - - - Ab5 - - - - - - -",
          oom:
          "D2 . . . A2 . . . D2 . . . A2 . . . | Eb2 . . . Bb2 . . . Eb2 . . . Bb2 . . . | " +
          "Bb2 . . . F2 . . . Bb2 . . . F2 . . . | A2 . . . E2 . . . A2 . . . E2 . . .",
          pah:
          ". . D3^037 . . . D3^037 . . . D3^037 . . . D3^037 . | . . Eb3^047 . . . Eb3^047 . . . Eb3^047 . . . Eb3^047 . | " +
          ". . Bb3^047 . . . Bb3^047 . . . Bb3^047 . . . Bb3^047 . | . . A3^047 . . . A3^047 . . . A3^047 . . . A3^047 .",
          kit:
          "k . k . s . . . . . . . s . . . | k . k . s . . . . . . . s . . . | " +
          "k . k . s . . . . . . . s . . . | k . k . s . . . . . . . s . . .",
          whistle:
          "D6 - - - F6 - - - G6 - - - F6 - - - | A6 - - - G6 - - - F6 - - - Eb6 - - - | " +
          "F6 - - - G6 - - - A6 - - - Bb6 - - - | Bb6 - - - A6 - - - Ab6 - - - - - - -",
          cym:
          "o . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
        },
        B: {
          calliope:
          "D5 - - - - - - - - - - - - - - - | A5 - - - F5 - - - D5 - - - Eb5 - - -",
          oom:
          "D2 . . . A2 . . . D2 . . . A2 . . . | D2 . . . A2 . . . D2 . . . A2 . . .",
          pah:
          ". . D3^037 . . . D3^037 . . . D3^037 . . . D3^037 . | . . D3^037 . . . D3^037 . . . D3^037 . . . D3^037 .",
          kit:
          "k . k . s . . . . . . . s . . . | k . k . s . . . . . . . s . . .",
          whistle:
          "D6 - - - - - - - - - - - - - - - | A6 - - - F6 - - - D6 - - - Eb6 - - -",
          cym:
          "o . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
        },
        M: {
          calliope:
          "D4 . D4 . . . D4 . . . . . . . . . | D5 - - - F5 - - - E5 - - - A4 - - -",
          oom:
          "D2 . . . A2 . . . D2 . . . A2 . . . | D2 . . . A2 . . . D2 . . . A2 . . .",
          pah:
          ". . D3^037 . . . D3^037 . . . D3^037 . . . D3^037 . | . . D3^037 . . . D3^037 . . . D3^037 . . . D3^037 .",
          kit:
          "k . k . s . . . . . . . s . . . | k . k . s . . . . . . . s . . .",
          whistle:
          "D5 . D5 . . . D5 . . . . . . . . . | D6 - - - F6 - - - E6 - - - A5 - - -",
          cym:
          "o . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
        },
      },
      order: ["C", "V", "S", "B", "F", "P", "M"],
    },
  },
};
