// Plan2Code Web Console - ghoul: Blackmoor Sanatorium's own sound effects and music tracks, merged into ghoul-sfx.js; defines only.
//
// Same shape and rules as ghoul-sfx-graveyard.js: `tones` (the stage's
// monsters' and boss's `ghoul<Kind><Act>` sounds) and `music` (a track per
// room, named in ROOM_MUSIC in ghoul.js). A name may be defined only once
// across tones.js and every game's file. No imports.

export const SANATORIUM_SFX = {
  tones: {
    // The Sanatorium's monsters, the Night Matron, the lamps, the Smelling Salts and
    // the Bone Saw, picked by ear (prototypes/sounds/ghoul-rush/sanatorium.html).
    // Orderly: Huge, slow and polite about it; it reaches, grabs and throws you back the way you came, and never hurts by touch.
    // Lumbers in: Door swing and step.
    ghoulOrderlyAppear: {
      layers: [
        { type: "sine", from: 380, to: 494, seconds: 0.08, attack: 0.01, gain: 0.4, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 456, to: 589, seconds: 0.07, delay: 0.1, attack: 0.01, gain: 0.3, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 110, to: 40, seconds: 0.25, attack: 0, gain: 1, delay: 0.3 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.8, filter: { type: "lowpass", from: 320, to: 320, q: 1 }, delay: 0.3 },
        { type: "sine", from: 110, to: 40, seconds: 0.25, attack: 0, gain: 0.7, delay: 0.6 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.56, filter: { type: "lowpass", from: 320, to: 320, q: 1 }, delay: 0.6 },
      ],
    },
    // Reaches: Sleeve rustle, hum.
    ghoulOrderlyReach: {
      layers: [
        { type: "pink", seconds: 0.4, attack: 0.25, gain: 0.48, filter: { type: "bandpass", from: 560, to: 2080, q: 5 } },
        { type: "noise", seconds: 0.28, delay: 0.16, attack: 0.1, gain: 0.3, filter: { type: "bandpass", from: 2080, to: 720, q: 8 } },
        { type: "triangle", from: 49, to: 37, seconds: 0.5, attack: 0.25, gain: 0.45, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 980, to: 630, q: 1 } },
        { type: "sine", from: 98, to: 74, seconds: 0.5, attack: 0.3, gain: 0.15 },
        { type: "pink", seconds: 0.5, attack: 0.3, gain: 0.13, filter: { type: "bandpass", from: 196, to: 147, q: 6 } },
      ],
    },
    // Grabs: Trap shut.
    ghoulOrderlyGrab: {
      layers: [
        { type: "triangle", from: 160, to: 136, seconds: 0.22, attack: 0, gain: 0.81 },
        { type: "sine", from: 432, to: 400, seconds: 0.12, attack: 0, gain: 0.32 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.45, filter: { type: "bandpass", from: 640, to: 640, q: 2 } },
        { type: "triangle", from: 130, to: 111, seconds: 0.22, attack: 0, gain: 0.63, delay: 0.08 },
        { type: "sine", from: 351, to: 325, seconds: 0.12, attack: 0, gain: 0.24, delay: 0.08 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.35, filter: { type: "bandpass", from: 520, to: 520, q: 2 }, delay: 0.08 },
        { type: "noise", seconds: 0.22, attack: 0.15, gain: 0.28, filter: { type: "bandpass", from: 550, to: 1200, q: 4 }, delay: 0.1 },
        { type: "sawtooth", from: 70, to: 91, seconds: 0.2, attack: 0.14, gain: 0.1, filter: { type: "lowpass", from: 700, to: 700, q: 1 }, delay: 0.1 },
      ],
    },
    // Throws you: Bellow and fling.
    ghoulOrderlyThrow: {
      layers: [
        { type: "sawtooth", from: 50, to: 79, seconds: 0.4, attack: 0.12, gain: 0.9, vibrato: { rate: 5, depth: 0.07 }, filter: { type: "lowpass", from: 600, to: 300, q: 5 } },
        { type: "sawtooth", from: 51, to: 78, seconds: 0.4, attack: 0.14, gain: 0.5, filter: { type: "lowpass", from: 480, to: 240, q: 3 } },
        { type: "brown", seconds: 0.4, attack: 0.1, gain: 0.6, filter: { type: "bandpass", from: 252, to: 189, q: 2 } },
        { type: "noise", seconds: 0.5, attack: 0, gain: 0.4, filter: { type: "lowpass", from: 6300, to: 225, q: 1 }, delay: 0.2 },
        { type: "sine", from: 240, to: 53, seconds: 0.4, attack: 0, gain: 0.36, delay: 0.2 },
        { type: "brown", seconds: 0.6, attack: 0.01, gain: 0.28, filter: { type: "lowpass", from: 600, to: 600, q: 1 }, delay: 0.2 },
      ],
    },
    // Takes a bolt: Hollow clunk.
    ghoulOrderlyHurt: {
      layers: [
        { type: "triangle", from: 200, to: 170, seconds: 0.22, attack: 0, gain: 0.9 },
        { type: "sine", from: 540, to: 500, seconds: 0.12, attack: 0, gain: 0.35 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.5, filter: { type: "bandpass", from: 800, to: 800, q: 2 } },
        { type: "sawtooth", from: 64, to: 44, seconds: 0.16, attack: 0.01, gain: 0.36, vibrato: { rate: 5, depth: 0.1 }, filter: { type: "lowpass", from: 462, to: 462, q: 1 } },
        { type: "brown", seconds: 0.13, attack: 0.01, gain: 0.24, filter: { type: "lowpass", from: 350, to: 350, q: 1 } },
      ],
    },
    // Dies: Long deflating groan.
    ghoulOrderlyDie: {
      layers: [
        { type: "sawtooth", from: 54, to: 38, seconds: 1, attack: 0.12, gain: 0.9, vibrato: { rate: 5, depth: 0.07 }, filter: { type: "lowpass", from: 600, to: 300, q: 5 } },
        { type: "sawtooth", from: 54, to: 38, seconds: 1, attack: 0.14, gain: 0.5, filter: { type: "lowpass", from: 480, to: 240, q: 3 } },
        { type: "brown", seconds: 1, attack: 0.1, gain: 0.6, filter: { type: "bandpass", from: 196, to: 147, q: 2 } },
        { type: "sine", from: 110, to: 40, seconds: 0.25, attack: 0, gain: 0.9, delay: 0.8 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.72, filter: { type: "lowpass", from: 320, to: 320, q: 1 }, delay: 0.8 },
      ],
    },
    // Gurney: A runaway hospital trolley; solid while parked, then it rattles, charges at you and rests.
    // Rolls in: Squeaky wheel.
    ghoulGurneyAppear: {
      layers: [
        { type: "sine", from: 700, to: 910, seconds: 0.08, attack: 0.01, gain: 0.48, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 840, to: 1085, seconds: 0.07, delay: 0.1, attack: 0.01, gain: 0.36, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 640, to: 832, seconds: 0.08, attack: 0.01, gain: 0.4, vibrato: { rate: 40, depth: 0.08 }, delay: 0.25 },
        { type: "sine", from: 768, to: 992, seconds: 0.07, delay: 0.35, attack: 0.01, gain: 0.3, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 110, to: 40, seconds: 0.25, attack: 0, gain: 0.4, delay: 0.5 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.32, filter: { type: "lowpass", from: 320, to: 320, q: 1 }, delay: 0.5 },
      ],
    },
    // Rattles: Tin tray shake.
    ghoulGurneyRattle: {
      layers: [
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 3838, to: 3070, q: 6 } },
        { type: "square", from: 1426, to: 675, seconds: 0.02, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.03, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 3397, to: 2718, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.08, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 4310, to: 3448, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.12, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 4842, to: 3874, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.16, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 3140, to: 2512, q: 6 } },
        { type: "square", from: 1161, to: 880, seconds: 0.02, delay: 0.16, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.19, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 5238, to: 4191, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.24, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 3162, to: 2529, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.27, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 4714, to: 3772, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.3, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 3838, to: 3070, q: 6 } },
        { type: "square", from: 1415, to: 750, seconds: 0.02, delay: 0.3, gain: 0.3 },
      ],
    },
    // Rolls: Roaring charge.
    ghoulGurneyRoll: {
      layers: [
        { type: "sawtooth", from: 119, to: 152, seconds: 0.21, attack: 0.05, gain: 0.9, vibrato: { rate: 6, depth: 0.1 }, filter: { type: "lowpass", from: 300, to: 3960, q: 4 } },
        { type: "sawtooth", from: 152, to: 92, seconds: 0.42, delay: 0.18, attack: 0.02, gain: 0.9, vibrato: { rate: 6, depth: 0.12 }, filter: { type: "lowpass", from: 3960, to: 260, q: 4 } },
        { type: "sawtooth", from: 66, to: 48, seconds: 0.6, attack: 0.08, gain: 0.6, filter: { type: "lowpass", from: 500, to: 500, q: 1 } },
        { type: "brown", seconds: 0.6, attack: 0.06, gain: 0.8, filter: { type: "lowpass", from: 900, to: 180, q: 1 } },
        { type: "sine", from: 66, to: 46, seconds: 0.6, attack: 0.05, gain: 0.7 },
        { type: "brown", seconds: 0.7, attack: 0.08, gain: 0.5, filter: { type: "lowpass", from: 180, to: 70, q: 1 } },
        { type: "sine", from: 48, to: 30, seconds: 0.7, attack: 0.05, gain: 0.4 },
      ],
    },
    // Takes a bolt: Spark scrape.
    ghoulGurneyHurt: {
      layers: [
        { type: "noise", seconds: 0.1, attack: 0, gain: 0.56, filter: { type: "highpass", from: 2880, to: 2880, q: 1 } },
        { type: "sine", from: 1120, to: 240, seconds: 0.16, delay: 0.02, gain: 0.42 },
        { type: "brown", seconds: 0.12, attack: 0, gain: 0.35, filter: { type: "lowpass", from: 672, to: 672, q: 1 } },
        { type: "noise", seconds: 0.15, attack: 0.06, gain: 0.32, filter: { type: "highpass", from: 3840, to: 8000, q: 1 } },
        { type: "pink", seconds: 0.15, attack: 0.05, gain: 0.2, filter: { type: "bandpass", from: 5120, to: 3520, q: 2 } },
      ],
    },
    // Breaks: Tin wreck.
    ghoulGurneyDie: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 1, filter: { type: "bandpass", from: 2340, to: 1560, q: 2 } },
        { type: "square", from: 1170, to: 390, seconds: 0.05, attack: 0, gain: 0.4 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.7, filter: { type: "bandpass", from: 3380, to: 2340, q: 3 } },
        { type: "noise", seconds: 0.04, delay: 0.05, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 3737, to: 2990, q: 6 } },
        { type: "square", from: 1130, to: 724, seconds: 0.02, delay: 0.05, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.1, attack: 0, gain: 0.86, filter: { type: "bandpass", from: 3541, to: 2833, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.15, attack: 0, gain: 0.81, filter: { type: "bandpass", from: 5739, to: 4591, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.18, attack: 0, gain: 0.77, filter: { type: "bandpass", from: 5458, to: 4366, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.23, attack: 0, gain: 0.72, filter: { type: "bandpass", from: 3990, to: 3192, q: 6 } },
        { type: "square", from: 1412, to: 1027, seconds: 0.02, delay: 0.23, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.27, attack: 0, gain: 0.68, filter: { type: "bandpass", from: 5869, to: 4695, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.3, attack: 0, gain: 0.63, filter: { type: "bandpass", from: 5566, to: 4453, q: 6 } },
      ],
    },
    // Flicker: A gaunt patient you can't see, hit or touch until the lights go out; then it shows and lunges.
    // Creeps in: Thin hum.
    ghoulFlickerAppear: {
      layers: [
        { type: "triangle", from: 420, to: 315, seconds: 0.9, attack: 0.25, gain: 0.36, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 1960, to: 1260, q: 1 } },
        { type: "sine", from: 840, to: 630, seconds: 0.9, attack: 0.3, gain: 0.12 },
        { type: "pink", seconds: 0.9, attack: 0.3, gain: 0.1, filter: { type: "bandpass", from: 1680, to: 1260, q: 6 } },
        { type: "noise", seconds: 0.5, attack: 0.06, gain: 0.16, filter: { type: "highpass", from: 3600, to: 7500, q: 1 } },
        { type: "pink", seconds: 0.5, attack: 0.05, gain: 0.1, filter: { type: "bandpass", from: 4800, to: 3300, q: 2 } },
      ],
    },
    // Shows itself: Hiss and gasp.
    ghoulFlickerShow: {
      layers: [
        { type: "noise", seconds: 0.22, attack: 0.15, gain: 0.7, filter: { type: "bandpass", from: 1320, to: 2880, q: 4 } },
        { type: "sawtooth", from: 720, to: 936, seconds: 0.2, attack: 0.14, gain: 0.25, filter: { type: "lowpass", from: 1680, to: 1680, q: 1 } },
        { type: "noise", seconds: 0.4, attack: 0.06, gain: 0.8, filter: { type: "highpass", from: 3360, to: 7000, q: 1 }, delay: 0.1 },
        { type: "pink", seconds: 0.4, attack: 0.05, gain: 0.5, filter: { type: "bandpass", from: 4480, to: 3080, q: 2 }, delay: 0.1 },
      ],
    },
    // Lunges: Screeching dash.
    ghoulFlickerLunge: {
      layers: [
        { type: "sawtooth", from: 1100, to: 660, seconds: 0.45, attack: 0.03, gain: 0.8, vibrato: { rate: 12, depth: 0.04 }, filter: { type: "bandpass", from: 2200, to: 2640, q: 4 } },
        { type: "sawtooth", from: 1650, to: 990, seconds: 0.41, attack: 0.04, gain: 0.35, filter: { type: "bandpass", from: 3300, to: 3300, q: 5 } },
        { type: "noise", seconds: 0.36, attack: 0.03, gain: 0.3, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
        { type: "noise", seconds: 0.4, attack: 0.14, gain: 0.48, filter: { type: "bandpass", from: 450, to: 2700, q: 1.5 } },
      ],
    },
    // Takes a bolt: Cough and flinch.
    ghoulFlickerHurt: {
      layers: [
        { type: "sawtooth", from: 585, to: 405, seconds: 0.16, attack: 0.01, gain: 0.9, vibrato: { rate: 9, depth: 0.1 }, filter: { type: "lowpass", from: 4290, to: 4290, q: 1 } },
        { type: "brown", seconds: 0.13, attack: 0.01, gain: 0.6, filter: { type: "lowpass", from: 750, to: 750, q: 1 } },
        { type: "noise", seconds: 0.22, attack: 0.15, gain: 0.28, filter: { type: "bandpass", from: 1320, to: 2880, q: 4 }, delay: 0.1 },
        { type: "sawtooth", from: 720, to: 936, seconds: 0.2, attack: 0.14, gain: 0.1, filter: { type: "lowpass", from: 1680, to: 1680, q: 1 }, delay: 0.1 },
      ],
    },
    // Dies: Falling chimes.
    ghoulFlickerDie: {
      layers: [
        { type: "sine", notes: [1400, 1176, 938, 700], seconds: 1, attack: 0.02, gain: 0.36, vibrato: { rate: 7, depth: 0.02 } },
        { type: "triangle", notes: [2100, 1764, 1400, 1050], seconds: 1, attack: 0.02, gain: 0.15 },
      ],
    },
    // Specimen Bloater: A bloater in a hospital gown that lobs jars; they shatter into a puddle of formaldehyde.
    // Waddles in: Slosh and sigh.
    ghoulSpecimenAppear: {
      layers: [
        { type: "sine", from: 536, to: 910, seconds: 0.05, delay: 0.12, attack: 0, gain: 0.35 },
        { type: "sine", from: 360, to: 612, seconds: 0.05, delay: 0.23, attack: 0, gain: 0.35 },
        { type: "sine", from: 387, to: 658, seconds: 0.05, delay: 0.32, attack: 0, gain: 0.35 },
        { type: "sine", from: 248, to: 422, seconds: 0.05, delay: 0.02, attack: 0, gain: 0.35 },
        { type: "sine", from: 532, to: 905, seconds: 0.05, delay: 0.42, attack: 0, gain: 0.35 },
        { type: "triangle", from: 130, to: 98, seconds: 0.7, attack: 0.25, gain: 0.45, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 1400, to: 900, q: 1 } },
        { type: "sine", from: 260, to: 195, seconds: 0.7, attack: 0.3, gain: 0.15 },
        { type: "pink", seconds: 0.7, attack: 0.3, gain: 0.13, filter: { type: "bandpass", from: 520, to: 390, q: 6 } },
      ],
    },
    // Winds up: Lid unscrewing.
    ghoulSpecimenWind: {
      layers: [
        { type: "sine", from: 800, to: 1040, seconds: 0.08, attack: 0.01, gain: 0.4, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 960, to: 1240, seconds: 0.07, delay: 0.1, attack: 0.01, gain: 0.3, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 950, to: 1235, seconds: 0.08, attack: 0.01, gain: 0.32, vibrato: { rate: 40, depth: 0.08 }, delay: 0.15 },
        { type: "sine", from: 1140, to: 1473, seconds: 0.07, delay: 0.25, attack: 0.01, gain: 0.24, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 234, to: 176, seconds: 0.3, attack: 0.05, gain: 0.36, vibrato: { rate: 15, depth: 0.4 }, delay: 0.1 },
        { type: "brown", seconds: 0.3, attack: 0.05, gain: 0.28, filter: { type: "lowpass", from: 700, to: 300, q: 1 }, delay: 0.1 },
        { type: "sine", from: 351, to: 281, seconds: 0.21, delay: 0.15, attack: 0.03, gain: 0.16, vibrato: { rate: 9, depth: 0.5 } },
      ],
    },
    // Jar breaks: Pop and hiss.
    ghoulSpecimenJar: {
      layers: [
        { type: "noise", seconds: 0.5, attack: 0, gain: 0.6, filter: { type: "lowpass", from: 6300, to: 225, q: 1 } },
        { type: "sine", from: 240, to: 53, seconds: 0.4, attack: 0, gain: 0.54 },
        { type: "brown", seconds: 0.6, attack: 0.01, gain: 0.42, filter: { type: "lowpass", from: 600, to: 600, q: 1 } },
        { type: "noise", seconds: 0.7, attack: 0.06, gain: 0.4, filter: { type: "highpass", from: 3360, to: 7000, q: 1 }, delay: 0.05 },
        { type: "pink", seconds: 0.7, attack: 0.05, gain: 0.25, filter: { type: "bandpass", from: 4480, to: 3080, q: 2 }, delay: 0.05 },
      ],
    },
    // Takes a bolt: Glass tap.
    ghoulSpecimenHurt: {
      layers: [
        { type: "triangle", from: 1100, to: 935, seconds: 0.22, attack: 0, gain: 0.9 },
        { type: "sine", from: 2970, to: 2750, seconds: 0.12, attack: 0, gain: 0.35 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.5, filter: { type: "bandpass", from: 4400, to: 4400, q: 2 } },
        { type: "noise", seconds: 0.28, attack: 0, gain: 0.27, filter: { type: "lowpass", from: 3900, to: 300, q: 1 } },
        { type: "square", from: 210, to: 60, seconds: 0.16, attack: 0, gain: 0.15, filter: { type: "lowpass", from: 900, to: 900, q: 1 } },
        { type: "sine", from: 1350, to: 1950, seconds: 0.05, delay: 0.2, gain: 0.08 },
        { type: "sine", from: 1140, to: 1650, seconds: 0.05, delay: 0.34, gain: 0.05 },
      ],
    },
    // Dies: Fizzing away.
    ghoulSpecimenDie: {
      layers: [
        { type: "noise", seconds: 0.9, attack: 0.06, gain: 0.48, filter: { type: "highpass", from: 2880, to: 6000, q: 1 } },
        { type: "pink", seconds: 0.9, attack: 0.05, gain: 0.3, filter: { type: "bandpass", from: 3840, to: 2640, q: 2 } },
        { type: "noise", seconds: 0.5, attack: 0, gain: 0.5, filter: { type: "lowpass", from: 5460, to: 195, q: 1 }, delay: 0.02 },
        { type: "sine", from: 208, to: 46, seconds: 0.4, attack: 0, gain: 0.45, delay: 0.02 },
        { type: "brown", seconds: 0.6, attack: 0.01, gain: 0.35, filter: { type: "lowpass", from: 520, to: 520, q: 1 }, delay: 0.02 },
        { type: "sine", notes: [600, 504, 402, 300], seconds: 0.6, attack: 0.02, gain: 0.18, vibrato: { rate: 7, depth: 0.02 }, delay: 0.1 },
        { type: "triangle", notes: [900, 756, 600, 450], seconds: 0.6, attack: 0.02, gain: 0.08, delay: 0.1 },
      ],
    },
    // The Night Matron: She makes her rounds at midnight with a lantern: a sweeping cone of light, thrown syringes and arms through the walls.
    // Wakes: Lamp click, sigh.
    ghoulMatronWake: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.7, filter: { type: "bandpass", from: 2160, to: 1440, q: 2 } },
        { type: "square", from: 1080, to: 360, seconds: 0.05, attack: 0, gain: 0.28 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.49, filter: { type: "bandpass", from: 3120, to: 2160, q: 3 } },
        { type: "noise", seconds: 0.5, attack: 0.06, gain: 0.32, filter: { type: "highpass", from: 1920, to: 4000, q: 1 }, delay: 0.05 },
        { type: "pink", seconds: 0.5, attack: 0.05, gain: 0.2, filter: { type: "bandpass", from: 2560, to: 1760, q: 2 }, delay: 0.05 },
        { type: "sawtooth", from: 220, to: 156, seconds: 0.8, attack: 0.12, gain: 0.54, vibrato: { rate: 5, depth: 0.07 }, filter: { type: "lowpass", from: 1600, to: 800, q: 5 }, delay: 0.2 },
        { type: "sawtooth", from: 221, to: 155, seconds: 0.8, attack: 0.14, gain: 0.3, filter: { type: "lowpass", from: 1280, to: 640, q: 3 }, delay: 0.2 },
        { type: "brown", seconds: 0.8, attack: 0.1, gain: 0.36, filter: { type: "bandpass", from: 800, to: 600, q: 2 }, delay: 0.2 },
      ],
    },
    // Beam sweeps: Low electric buzz.
    ghoulMatronBeam: {
      layers: [
        { type: "sine", from: 650, to: 500, seconds: 0.5, attack: 0.05, gain: 0.45, vibrato: { rate: 9, depth: 0.4 } },
        { type: "brown", seconds: 0.5, attack: 0.05, gain: 0.3, filter: { type: "lowpass", from: 1250, to: 625, q: 1 } },
        { type: "noise", seconds: 0.5, attack: 0.06, gain: 0.16, filter: { type: "highpass", from: 2400, to: 5000, q: 1 } },
        { type: "pink", seconds: 0.5, attack: 0.05, gain: 0.1, filter: { type: "bandpass", from: 3200, to: 2200, q: 2 } },
      ],
    },
    // Planny burns: Frying sizzle.
    ghoulMatronHeat: {
      layers: [
        { type: "noise", seconds: 0.4, attack: 0.06, gain: 0.64, filter: { type: "highpass", from: 3600, to: 7500, q: 1 } },
        { type: "pink", seconds: 0.4, attack: 0.05, gain: 0.4, filter: { type: "bandpass", from: 4800, to: 3300, q: 2 } },
        { type: "sine", from: 1242, to: 2111, seconds: 0.05, delay: 0.17, attack: 0, gain: 0.35 },
        { type: "sine", from: 853, to: 1450, seconds: 0.05, delay: 0.14, attack: 0, gain: 0.35 },
        { type: "sine", from: 1469, to: 2498, seconds: 0.05, delay: 0.15, attack: 0, gain: 0.35 },
        { type: "sine", from: 1089, to: 1852, seconds: 0.05, delay: 0.14, attack: 0, gain: 0.35 },
        { type: "sine", from: 872, to: 1482, seconds: 0.05, delay: 0.24, attack: 0, gain: 0.35 },
      ],
    },
    // Syringes wind up: Cold chuckle.
    ghoulMatronSyringeWind: {
      layers: [
        { type: "sawtooth", from: 640, to: 512, seconds: 0.09, attack: 0.01, gain: 0.42, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 1600, to: 1280, q: 3 } },
        { type: "sawtooth", from: 608, to: 486, seconds: 0.09, delay: 0.14, attack: 0.01, gain: 0.42, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 1520, to: 1216, q: 3 } },
        { type: "sawtooth", from: 576, to: 461, seconds: 0.09, delay: 0.28, attack: 0.01, gain: 0.42, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 1440, to: 1152, q: 3 } },
        { type: "triangle", from: 1600, to: 1360, seconds: 0.22, attack: 0, gain: 0.27, delay: 0.3 },
        { type: "sine", from: 4320, to: 4000, seconds: 0.12, attack: 0, gain: 0.11, delay: 0.3 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.15, filter: { type: "bandpass", from: 6400, to: 6400, q: 2 }, delay: 0.3 },
      ],
    },
    // Syringes fly: Thrown darts.
    ghoulMatronSyringes: {
      layers: [
        { type: "noise", seconds: 0.1, attack: 0, gain: 0.8, filter: { type: "highpass", from: 3240, to: 3240, q: 1 } },
        { type: "sine", from: 1260, to: 270, seconds: 0.16, delay: 0.02, gain: 0.6 },
        { type: "brown", seconds: 0.12, attack: 0, gain: 0.5, filter: { type: "lowpass", from: 756, to: 756, q: 1 } },
        { type: "noise", seconds: 0.1, attack: 0, gain: 0.56, filter: { type: "highpass", from: 3600, to: 3600, q: 1 }, delay: 0.06 },
        { type: "sine", from: 1400, to: 300, seconds: 0.16, delay: 0.08, gain: 0.42 },
        { type: "brown", seconds: 0.12, attack: 0, gain: 0.35, filter: { type: "lowpass", from: 840, to: 840, q: 1 }, delay: 0.06 },
        { type: "noise", seconds: 0.1, attack: 0, gain: 0.56, filter: { type: "highpass", from: 2880, to: 2880, q: 1 }, delay: 0.12 },
        { type: "sine", from: 1120, to: 240, seconds: 0.16, delay: 0.14, gain: 0.42 },
        { type: "brown", seconds: 0.12, attack: 0, gain: 0.35, filter: { type: "lowpass", from: 672, to: 672, q: 1 }, delay: 0.12 },
      ],
    },
    // Cracks of light: Ticking alarm.
    ghoulMatronArmWarn: {
      layers: [
        { type: "triangle", from: 1000, to: 850, seconds: 0.22, attack: 0, gain: 0.54 },
        { type: "sine", from: 2700, to: 2500, seconds: 0.12, attack: 0, gain: 0.21 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.3, filter: { type: "bandpass", from: 4000, to: 4000, q: 2 } },
        { type: "triangle", from: 1000, to: 850, seconds: 0.22, attack: 0, gain: 0.54, delay: 0.2 },
        { type: "sine", from: 2700, to: 2500, seconds: 0.12, attack: 0, gain: 0.21, delay: 0.2 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.3, filter: { type: "bandpass", from: 4000, to: 4000, q: 2 }, delay: 0.2 },
        { type: "triangle", from: 1000, to: 850, seconds: 0.22, attack: 0, gain: 0.54, delay: 0.4 },
        { type: "sine", from: 2700, to: 2500, seconds: 0.12, attack: 0, gain: 0.21, delay: 0.4 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.3, filter: { type: "bandpass", from: 4000, to: 4000, q: 2 }, delay: 0.4 },
        { type: "brown", seconds: 0.7, attack: 0.08, gain: 0.3, filter: { type: "lowpass", from: 180, to: 70, q: 1 } },
        { type: "sine", from: 48, to: 30, seconds: 0.7, attack: 0.05, gain: 0.24 },
      ],
    },
    // Arm shoots out: Shriek through stone.
    ghoulMatronArmReach: {
      layers: [
        { type: "sawtooth", from: 900, to: 540, seconds: 0.5, attack: 0.03, gain: 0.8, vibrato: { rate: 12, depth: 0.04 }, filter: { type: "bandpass", from: 1800, to: 2160, q: 4 } },
        { type: "sawtooth", from: 1350, to: 810, seconds: 0.45, attack: 0.04, gain: 0.35, filter: { type: "bandpass", from: 2700, to: 2700, q: 5 } },
        { type: "noise", seconds: 0.4, attack: 0.03, gain: 0.3, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
        { type: "brown", seconds: 0.6, attack: 0.08, gain: 0.5, filter: { type: "lowpass", from: 180, to: 70, q: 1 } },
        { type: "sine", from: 48, to: 30, seconds: 0.6, attack: 0.05, gain: 0.4 },
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.6, filter: { type: "bandpass", from: 1260, to: 840, q: 2 } },
        { type: "square", from: 630, to: 210, seconds: 0.05, attack: 0, gain: 0.24 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.42, filter: { type: "bandpass", from: 1820, to: 1260, q: 3 } },
      ],
    },
    // Rage: Cackle into scream.
    ghoulMatronRage: {
      layers: [
        { type: "sawtooth", from: 720, to: 576, seconds: 0.09, attack: 0.01, gain: 0.49, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 1800, to: 1440, q: 3 } },
        { type: "sawtooth", from: 684, to: 547, seconds: 0.09, delay: 0.1, attack: 0.01, gain: 0.49, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 1710, to: 1368, q: 3 } },
        { type: "sawtooth", from: 648, to: 518, seconds: 0.09, delay: 0.2, attack: 0.01, gain: 0.49, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 1620, to: 1296, q: 3 } },
        { type: "sawtooth", from: 612, to: 490, seconds: 0.09, delay: 0.3, attack: 0.01, gain: 0.49, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 1530, to: 1224, q: 3 } },
        { type: "sawtooth", from: 576, to: 461, seconds: 0.09, delay: 0.4, attack: 0.01, gain: 0.49, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 1440, to: 1152, q: 3 } },
        { type: "sawtooth", from: 1000, to: 1400, seconds: 0.5, attack: 0.03, gain: 0.8, vibrato: { rate: 12, depth: 0.04 }, filter: { type: "bandpass", from: 2000, to: 2400, q: 4 }, delay: 0.5 },
        { type: "sawtooth", from: 1500, to: 2100, seconds: 0.45, attack: 0.04, gain: 0.35, filter: { type: "bandpass", from: 3000, to: 3000, q: 5 }, delay: 0.5 },
        { type: "noise", seconds: 0.4, attack: 0.03, gain: 0.3, filter: { type: "highpass", from: 3000, to: 3000, q: 1 }, delay: 0.5 },
      ],
    },
    // Takes a hit: Thud on the apron.
    ghoulMatronHurt: {
      layers: [
        { type: "sine", from: 110, to: 40, seconds: 0.25, attack: 0, gain: 0.7 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.56, filter: { type: "lowpass", from: 320, to: 320, q: 1 } },
        { type: "sawtooth", from: 260, to: 180, seconds: 0.16, attack: 0.01, gain: 0.54, vibrato: { rate: 5, depth: 0.1 }, filter: { type: "lowpass", from: 1760, to: 1760, q: 1 }, delay: 0.04 },
        { type: "brown", seconds: 0.13, attack: 0.01, gain: 0.36, filter: { type: "lowpass", from: 500, to: 500, q: 1 }, delay: 0.04 },
      ],
    },
    // Dies: Collapsing groan.
    ghoulMatronDie: {
      layers: [
        { type: "sawtooth", from: 220, to: 156, seconds: 1.2, attack: 0.12, gain: 0.9, vibrato: { rate: 5, depth: 0.07 }, filter: { type: "lowpass", from: 1600, to: 800, q: 5 } },
        { type: "sawtooth", from: 221, to: 155, seconds: 1.2, attack: 0.14, gain: 0.5, filter: { type: "lowpass", from: 1280, to: 640, q: 3 } },
        { type: "brown", seconds: 1.2, attack: 0.1, gain: 0.6, filter: { type: "bandpass", from: 800, to: 600, q: 2 } },
        { type: "sine", from: 110, to: 40, seconds: 0.25, attack: 0, gain: 0.9, delay: 0.9 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.72, filter: { type: "lowpass", from: 320, to: 320, q: 1 }, delay: 0.9 },
      ],
    },
    // The ceiling lamps: The twist: every so often the lamps stutter, go out for a couple of seconds, then buzz back on.
    // Lamps stutter: Failing hum.
    ghoulLightsWarn: {
      layers: [
        { type: "triangle", from: 120, to: 90, seconds: 0.7, attack: 0.25, gain: 0.45, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 1400, to: 900, q: 1 } },
        { type: "sine", from: 240, to: 180, seconds: 0.7, attack: 0.3, gain: 0.15 },
        { type: "pink", seconds: 0.7, attack: 0.3, gain: 0.13, filter: { type: "bandpass", from: 480, to: 360, q: 6 } },
        { type: "sine", from: 780, to: 600, seconds: 0.7, attack: 0.05, gain: 0.36, vibrato: { rate: 9, depth: 0.4 } },
        { type: "brown", seconds: 0.7, attack: 0.05, gain: 0.24, filter: { type: "lowpass", from: 2500, to: 1250, q: 1 } },
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.6, filter: { type: "bandpass", from: 2160, to: 1440, q: 2 }, delay: 0.55 },
        { type: "square", from: 1080, to: 360, seconds: 0.05, attack: 0, gain: 0.24, delay: 0.55 },
        { type: "noise", seconds: 0.04, delay: 0.61, attack: 0, gain: 0.42, filter: { type: "bandpass", from: 3120, to: 2160, q: 3 } },
      ],
    },
    // Lights out: Falling hum.
    ghoulLightsOut: {
      layers: [
        { type: "sawtooth", from: 132, to: 94, seconds: 0.9, attack: 0.12, gain: 0.63, vibrato: { rate: 50, depth: 0.07 }, filter: { type: "lowpass", from: 3000, to: 1500, q: 5 } },
        { type: "sawtooth", from: 133, to: 93, seconds: 0.9, attack: 0.14, gain: 0.35, filter: { type: "lowpass", from: 2400, to: 1200, q: 3 } },
        { type: "brown", seconds: 0.9, attack: 0.1, gain: 0.42, filter: { type: "bandpass", from: 480, to: 360, q: 2 } },
        { type: "noise", seconds: 0.6, attack: 0.06, gain: 0.24, filter: { type: "highpass", from: 1680, to: 3500, q: 1 }, delay: 0.1 },
        { type: "pink", seconds: 0.6, attack: 0.05, gain: 0.15, filter: { type: "bandpass", from: 2240, to: 1540, q: 2 }, delay: 0.1 },
      ],
    },
    // Lights back on: Rising hum.
    ghoulLightsOn: {
      layers: [
        { type: "sawtooth", from: 96, to: 150, seconds: 0.7, attack: 0.12, gain: 0.54, vibrato: { rate: 50, depth: 0.07 }, filter: { type: "lowpass", from: 3000, to: 1500, q: 5 } },
        { type: "sawtooth", from: 97, to: 149, seconds: 0.7, attack: 0.14, gain: 0.3, filter: { type: "lowpass", from: 2400, to: 1200, q: 3 } },
        { type: "brown", seconds: 0.7, attack: 0.1, gain: 0.36, filter: { type: "bandpass", from: 480, to: 360, q: 2 } },
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.5, filter: { type: "bandpass", from: 2160, to: 1440, q: 2 } },
        { type: "square", from: 1080, to: 360, seconds: 0.05, attack: 0, gain: 0.2 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.35, filter: { type: "bandpass", from: 3120, to: 2160, q: 3 } },
      ],
    },
    // Smelling Salts: The power-up: for 10 seconds you break an Orderly's grip at once, and a blackout keeps a wide glow around you.
    // Picked up: Bright bottle ring.
    ghoulSaltsActive: {
      layers: [
        { type: "triangle", from: 2000, to: 1700, seconds: 0.22, attack: 0, gain: 0.72 },
        { type: "sine", from: 5400, to: 5000, seconds: 0.12, attack: 0, gain: 0.28 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.4, filter: { type: "bandpass", from: 8000, to: 8000, q: 2 } },
        { type: "triangle", from: 2600, to: 2210, seconds: 0.22, attack: 0, gain: 0.45, delay: 0.08 },
        { type: "sine", from: 7020, to: 6500, seconds: 0.12, attack: 0, gain: 0.18, delay: 0.08 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.25, filter: { type: "bandpass", from: 10400, to: 10400, q: 2 }, delay: 0.08 },
      ],
    },
    // Breaks a grab: Strap snap.
    ghoulSaltsBreak: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 1, filter: { type: "bandpass", from: 2160, to: 1440, q: 2 } },
        { type: "square", from: 1080, to: 360, seconds: 0.05, attack: 0, gain: 0.4 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.7, filter: { type: "bandpass", from: 3120, to: 2160, q: 3 } },
        { type: "noise", seconds: 0.1, attack: 0, gain: 0.4, filter: { type: "highpass", from: 2700, to: 2700, q: 1 }, delay: 0.04 },
        { type: "sine", from: 1050, to: 225, seconds: 0.16, delay: 0.06, gain: 0.3 },
        { type: "brown", seconds: 0.12, attack: 0, gain: 0.25, filter: { type: "lowpass", from: 630, to: 630, q: 1 }, delay: 0.04 },
        { type: "noise", seconds: 0.25, attack: 0.09, gain: 0.32, filter: { type: "bandpass", from: 480, to: 2880, q: 1.5 }, delay: 0.1 },
      ],
    },
    // Bone Saw: The power-up: for 10 seconds your bolts pierce every monster in a line, and a Gurney breaks in one hit.
    // Picked up: Grind and clink.
    ghoulSawActive: {
      layers: [
        { type: "sine", from: 1300, to: 1690, seconds: 0.08, attack: 0.01, gain: 0.4, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 1560, to: 2015, seconds: 0.07, delay: 0.1, attack: 0.01, gain: 0.3, vibrato: { rate: 40, depth: 0.08 } },
        { type: "noise", seconds: 0.4, attack: 0.06, gain: 0.32, filter: { type: "highpass", from: 4320, to: 9000, q: 1 } },
        { type: "pink", seconds: 0.4, attack: 0.05, gain: 0.2, filter: { type: "bandpass", from: 5760, to: 3960, q: 2 } },
        { type: "triangle", from: 2200, to: 1870, seconds: 0.22, attack: 0, gain: 0.54, delay: 0.2 },
        { type: "sine", from: 5940, to: 5500, seconds: 0.12, attack: 0, gain: 0.21, delay: 0.2 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.3, filter: { type: "bandpass", from: 8800, to: 8800, q: 2 }, delay: 0.2 },
      ],
    },
    // Saw cut: Chunk of metal.
    ghoulSawCut: {
      layers: [
        { type: "triangle", from: 700, to: 595, seconds: 0.22, attack: 0, gain: 0.9 },
        { type: "sine", from: 1890, to: 1750, seconds: 0.12, attack: 0, gain: 0.35 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.5, filter: { type: "bandpass", from: 2800, to: 2800, q: 2 } },
        { type: "noise", seconds: 0.1, attack: 0, gain: 0.48, filter: { type: "highpass", from: 3240, to: 3240, q: 1 } },
        { type: "sine", from: 1260, to: 270, seconds: 0.16, delay: 0.02, gain: 0.36 },
        { type: "brown", seconds: 0.12, attack: 0, gain: 0.3, filter: { type: "lowpass", from: 756, to: 756, q: 1 } },
      ],
    },
  },
  // The Sanatorium's rooms: Admissions, the Hydrotherapy Baths, the Surgical
  // Theater and the Night Ward (the Night Matron's fight), picked in
  // prototypes/music/ghoul-rush.
  music: {
    // Admissions: music box. A wind-up music box plays the lullaby over a
    // soft tick of the ward clock and a faint lamp hum. The second verse adds
    // a thin line in thirds, and at full dread a ghost sings the tune an
    // octave down, bowed and wobbling, until the box slips onto Eb.
    ghoulAdmissions: {
      bpm: 64,
      rush: 8,
      voices: {
        box: { wave: "pulse", duty: 0.125, gain: 0.2, decay: 0.35, sustain: 0.05 },
        bass: { wave: "triangle", gain: 0.5, decay: 0.3, sustain: 0.7 },
        tick: { kit: true, gain: 0.08 },
        hum: { wave: "sawtooth", gain: 0.04, from: 0.3, decay: 0.3, sustain: 0.95 },
        thirds: { wave: "pulse", duty: 0.125, gain: 0.09, from: 0.5, decay: 0.3, sustain: 0.05 },
        ghost: { wave: "sawtooth", gain: 0.05, from: 0.85, decay: 0.4, sustain: 0.9, vibrato: { rate: 5, depth: 0.006, delay: 0.2 } },
      },
      patterns: {
        A: {
          box:
          "D5 - - - F5 - - - E5 - - - D5 - - - | A5 - - - G5 - - - F5 - - - E5 - - - | " +
          "D5 - - - F5 - - - A5 - - - G5 - - - | F5 - - - E5 - - - Eb5 - - - D5 - - -",
          bass:
          "D2 - - - - - - - - - - - - - - - | A1 - - - - - - - - - - - - - - - | " +
          "Bb1 - - - - - - - - - - - - - - - | A1 - - - - - - - D2 - - - - - - -",
          tick:
          "h . . . h . . . h . . . h . . . | h . . . h . . . h . . . h . . . | " +
          "h . . . h . . . h . . . h . . . | h . . . h . . . h . . . h . . .",
          hum:
          "D2 - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - - | " +
          "D2 - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - -",
        },
        B: {
          box:
          "D5 - - - F5 - - - E5 - - - D5 - - - | A5 - - - G5 - - - F5 - - - E5 - - - | " +
          "D5 - - - F5 - - - A5 - - - G5 - - - | F5 - - - E5 - - - Eb5 - - - D5 - - -",
          bass:
          "D2 - - - - - - - - - - - - - - - | A1 - - - - - - - - - - - - - - - | " +
          "Bb1 - - - - - - - - - - - - - - - | A1 - - - - - - - D2 - - - - - - -",
          tick:
          "h . . . h . . . h . . . h . . . | h . . . h . . . h . . . h . . . | " +
          "h . . . h . . . h . . . h . . . | h . . . h . . . h . . . h . . .",
          hum:
          "D2 - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - - | " +
          "D2 - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - -",
          thirds:
          "Bb4 - - - D5 - - - C5 - - - Bb4 - - - | F5 - - - E5 - - - D5 - - - C5 - - - | " +
          "Bb4 - - - D5 - - - F5 - - - E5 - - - | D5 - - - C5 - - - C5 - - - Bb4 - - -",
        },
        C: {
          box:
          "D5 - - - F5 - - - E5 - - - D5 - - - | A5 - - - G5 - - - F5 - - - E5 - - - | " +
          "D5 - - - F5 - - - A5 - - - G5 - - - | F5 - - - E5 - - - Eb5 - - - D5 - - -",
          bass:
          "D2 - - - - - - - - - - - - - - - | A1 - - - - - - - - - - - - - - - | " +
          "Bb1 - - - - - - - - - - - - - - - | A1 - - - - - - - D2 - - - - - - -",
          tick:
          "h . . . h . . . h . . . h . . . | h . . . h . . . h . . . h . . . | " +
          "h . . . h . . . h . . . h . . . | h . . . h . . . h . . . h . . .",
          hum:
          "D2 - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - - | " +
          "D2 - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - -",
          thirds:
          "Bb4 - - - D5 - - - C5 - - - Bb4 - - - | F5 - - - E5 - - - D5 - - - C5 - - - | " +
          "Bb4 - - - D5 - - - F5 - - - E5 - - - | D5 - - - C5 - - - C5 - - - Bb4 - - -",
          ghost:
          "D4 - - - F4 - - - E4 - - - D4 - - - | A4 - - - G4 - - - F4 - - - E4 - - - | " +
          "D4 - - - F4 - - - A4 - - - G4 - - - | F4 - - - E4 - - - Eb4 - - - D4 - - -",
        },
      },
      order: ["A", "B", "C"],
    },
    // The Hydrotherapy Baths: gurgling arpeggios. Bubbling eighth-note runs
    // climb through the chords (Dm, A, Bb, A) over a pulsing bass and a fizz
    // of foam on the off beats. The lullaby floats on top like a toy boat in
    // the second verse, and at full dread a sour held note leans on the
    // bubbles.
    ghoulBaths: {
      bpm: 96,
      rush: 8,
      voices: {
        gurgle: { wave: "pulse", duty: 0.25, gain: 0.12, decay: 0.08, sustain: 0.3 },
        bass: { wave: "sine", gain: 0.5, decay: 0.1, sustain: 0.5 },
        foam: { kit: true, gain: 0.07, from: 0.2 },
        lead: { wave: "triangle", gain: 0.2, decay: 0.2, sustain: 0.6, vibrato: { rate: 4, depth: 0.008, delay: 0.2 } },
        sour: { wave: "sawtooth", gain: 0.05, from: 0.85, decay: 0.4, sustain: 0.9, vibrato: { rate: 5, depth: 0.01, delay: 0.1 } },
      },
      patterns: {
        A: {
          gurgle:
          "D4 - F4 - A4 - D5 - F5 - D5 - A4 - F4 - | A3 - C#4 - E4 - A4 - C#5 - A4 - E4 - C#4 - | " +
          "Bb3 - D4 - F4 - Bb4 - D5 - Bb4 - F4 - D4 - | A3 - C#4 - E4 - A4 - D4 - - - D4 - - -",
          bass:
          "D2 - . . D2 - . . D2 - . . D2 - . . | A1 - . . A1 - . . A1 - . . A1 - . . | " +
          "Bb1 - . . Bb1 - . . Bb1 - . . Bb1 - . . | A1 - . . A1 - . . D2 - . . D2 - . .",
          foam:
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h . | " +
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h .",
        },
        B: {
          gurgle:
          "D4 - F4 - A4 - D5 - F5 - D5 - A4 - F4 - | A3 - C#4 - E4 - A4 - C#5 - A4 - E4 - C#4 - | " +
          "Bb3 - D4 - F4 - Bb4 - D5 - Bb4 - F4 - D4 - | A3 - C#4 - E4 - A4 - D4 - - - D4 - - -",
          bass:
          "D2 - . . D2 - . . D2 - . . D2 - . . | A1 - . . A1 - . . A1 - . . A1 - . . | " +
          "Bb1 - . . Bb1 - . . Bb1 - . . Bb1 - . . | A1 - . . A1 - . . D2 - . . D2 - . .",
          foam:
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h . | " +
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h .",
          lead:
          "D5 - - - F5 - - - E5 - - - D5 - - - | A5 - - - G5 - - - F5 - - - E5 - - - | " +
          "D5 - - - F5 - - - A5 - - - G5 - - - | F5 - - - E5 - - - Eb5 - - - D5 - - -",
        },
        C: {
          gurgle:
          "D4 - F4 - A4 - D5 - F5 - D5 - A4 - F4 - | A3 - C#4 - E4 - A4 - C#5 - A4 - E4 - C#4 - | " +
          "Bb3 - D4 - F4 - Bb4 - D5 - Bb4 - F4 - D4 - | A3 - C#4 - E4 - A4 - D4 - - - D4 - - -",
          bass:
          "D2 - . . D2 - . . D2 - . . D2 - . . | A1 - . . A1 - . . A1 - . . A1 - . . | " +
          "Bb1 - . . Bb1 - . . Bb1 - . . Bb1 - . . | A1 - . . A1 - . . D2 - . . D2 - . .",
          foam:
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h . | " +
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h .",
          lead:
          "D6 - - - F6 - - - E6 - - - D6 - - - | A6 - - - G6 - - - F6 - - - E6 - - - | " +
          "D6 - - - F6 - - - A6 - - - G6 - - - | F6 - - - E6 - - - Eb6 - - - D6 - - -",
          sour:
          "Eb4 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "D4 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -",
        },
      },
      order: ["A", "B", "A", "C"],
    },
    // The Surgical Theater: heart monitor chip. The monitor beeps on every
    // beat while a dry kick and a tick keep the room clinical, with a
    // bouncing bass underneath. The lullaby is picked out staccato like a
    // nurse tapping a vein. The later sections lift it an octave, and at the
    // very end the beep drops out and a single flat tone takes its place.
    ghoulTheater: {
      bpm: 110,
      rush: 10,
      voices: {
        beep: { wave: "square", gain: 0.1, from: 0.1, decay: 0.04, sustain: 0.8 },
        kick: { kit: true, gain: 0.2 },
        tick: { kit: true, gain: 0.08, from: 0.1 },
        bass: { wave: "triangle", gain: 0.5, decay: 0.12, sustain: 0.5 },
        lead: { wave: "pulse", duty: 0.25, gain: 0.16, decay: 0.1, sustain: 0.2 },
        flat: { wave: "sine", gain: 0.07, from: 0.85, decay: 0.3, sustain: 0.95 },
      },
      patterns: {
        A: {
          beep:
          "A6 . . . A6 . . . A6 . . . A6 . . . | A6 . . . A6 . . . A6 . . . A6 . . . | " +
          "A6 . . . A6 . . . A6 . . . A6 . . . | A6 . . . A6 . . . A6 . . . A6 . . .",
          kick:
          "k . . . . . . . k . . . . . . . | k . . . . . . . k . . . . . . . | " +
          "k . . . . . . . k . . . . . . . | k . . . . . . . k . . . . . . .",
          tick:
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h . | " +
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h .",
          bass:
          "D2 - . . D2 - . . D2 - . . D2 - . . | A1 - . . A1 - . . A1 - . . A1 - . . | " +
          "Bb1 - . . Bb1 - . . Bb1 - . . Bb1 - . . | A1 - . . A1 - . . D2 - . . D2 - . .",
          lead:
          "D5 . . . F5 . . . E5 . . . D5 . . . | A5 . . . G5 . . . F5 . . . E5 . . . | " +
          "D5 . . . F5 . . . A5 . . . G5 . . . | F5 . . . E5 . . . Eb5 . . . D5 . . .",
        },
        B: {
          beep:
          "A6 . . . A6 . . . A6 . . . A6 . . . | A6 . . . A6 . . . A6 . . . A6 . . . | " +
          "A6 . . . A6 . . . A6 . . . A6 . . . | A6 . . . A6 . . . A6 . . . A6 . . .",
          kick:
          "k . . . . . . . k . . . . . . . | k . . . . . . . k . . . . . . . | " +
          "k . . . . . . . k . . . . . . . | k . . . . . . . k . . . . . . .",
          tick:
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h . | " +
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h .",
          bass:
          "D2 - . . D2 - . . D2 - . . D2 - . . | A1 - . . A1 - . . A1 - . . A1 - . . | " +
          "Bb1 - . . Bb1 - . . Bb1 - . . Bb1 - . . | A1 - . . A1 - . . D2 - . . D2 - . .",
          lead:
          "D6 . . . F6 . . . E6 . . . D6 . . . | A6 . . . G6 . . . F6 . . . E6 . . . | " +
          "D6 . . . F6 . . . A6 . . . G6 . . . | F6 . . . E6 . . . Eb6 . . . D6 . . .",
        },
        C: {
          beep:
          "A6 . . . A6 . . . A6 . . . A6 . . . | A6 . . . A6 . . . A6 . . . A6 . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          kick:
          "k . . . . . . . k . . . . . . . | k . . . . . . . k . . . . . . . | " +
          "k . . . . . . . k . . . . . . . | k . . . . . . . k . . . . . . .",
          tick:
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h . | " +
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h .",
          bass:
          "D2 - . . D2 - . . D2 - . . D2 - . . | A1 - . . A1 - . . A1 - . . A1 - . . | " +
          "Bb1 - . . Bb1 - . . Bb1 - . . Bb1 - . . | A1 - . . A1 - . . D2 - . . D2 - . .",
          lead:
          "D5 - - - F5 - - - E5 - - - D5 - - - | A5 - - - G5 - - - F5 - - - E5 - - - | " +
          "D5 - - - F5 - - - A5 - - - G5 - - - | F5 - - - E5 - - - Eb5 - - - D5 - - -",
          flat:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          "A6 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -",
        },
      },
      order: ["A", "A", "B", "A", "C"],
    },
    // The Night Ward (the Night Matron fight): midnight toll. A slow funeral
    // march: a thudding kick and snare every other beat, a bass that steps
    // down D, C, Bb, A and the lullaby bowed low on a sawtooth. Then an organ
    // cluster rattles under it (a D chord with an Eb in it), a great bell
    // tolls twelve times, and the last section lifts the tune an octave over
    // a faster, heavier kit as the whole ward screams.
    ghoulWard: {
      bpm: 70,
      rush: 10,
      voices: {
        kit: { kit: true, gain: 0.28 },
        bass: { wave: "sawtooth", gain: 0.3, decay: 0.3, sustain: 0.8 },
        lead: { wave: "sawtooth", gain: 0.14, decay: 0.2, sustain: 0.8, vibrato: { rate: 4.5, depth: 0.01, delay: 0.15 } },
        organ: { wave: "sawtooth", gain: 0.06, from: 0.4, decay: 0.3, sustain: 0.95 },
        bell: { wave: "pulse", duty: 0.125, gain: 0.25, from: 0.3, decay: 0.9, sustain: 0.1 },
        scream: { wave: "sawtooth", gain: 0.06, from: 0.9, decay: 0.3, sustain: 0.95, vibrato: { rate: 6, depth: 0.012, delay: 0 } },
      },
      patterns: {
        A: {
          kit:
          "k . . . . . . . s . . . . . . . | k . . . . . . . s . . . . . . . | " +
          "k . . . . . . . s . . . . . . . | k . . . . . . . s . . . . . . .",
          bass:
          "D2 - - - - - - - - - - - - - - - | C2 - - - - - - - - - - - - - - - | " +
          "Bb1 - - - - - - - - - - - - - - - | A1 - - - - - - - - - - - - - - -",
          lead:
          "D4 - - - F4 - - - E4 - - - D4 - - - | A4 - - - G4 - - - F4 - - - E4 - - - | " +
          "D4 - - - F4 - - - A4 - - - G4 - - - | F4 - - - E4 - - - Eb4 - - - D4 - - -",
        },
        B: {
          kit:
          "k . . . . . . . s . . . . . . . | k . . . . . . . s . . . . . . . | " +
          "k . . . . . . . s . . . . . . . | k . . . . . . . s . . . . . . .",
          bass:
          "D2 - - - - - - - - - - - - - - - | C2 - - - - - - - - - - - - - - - | " +
          "Bb1 - - - - - - - - - - - - - - - | A1 - - - - - - - - - - - - - - -",
          lead:
          "D4 - - - F4 - - - E4 - - - D4 - - - | A4 - - - G4 - - - F4 - - - E4 - - - | " +
          "D4 - - - F4 - - - A4 - - - G4 - - - | F4 - - - E4 - - - Eb4 - - - D4 - - -",
          organ:
          "D3^0137 - - - - - - - - - - - - - - - | C3^0137 - - - - - - - - - - - - - - - | " +
          "Bb2^0137 - - - - - - - - - - - - - - - | A2^0137 - - - - - - - - - - - - - - -",
          bell:
          "D3 - - - - - - - . . . . . . . . | D3 - - - - - - - . . . . . . . . | " +
          "D3 - - - - - - - . . . . . . . . | D3 - - - - - - - . . . . . . . .",
        },
        C: {
          kit:
          "k . k . . . . . s . k . s . . . | k . k . . . . . s . k . s . . . | " +
          "k . k . . . . . s . k . s . . . | k . k . . . . . s . k . s . . .",
          bass:
          "D2 - - - - - - - - - - - - - - - | C2 - - - - - - - - - - - - - - - | " +
          "Bb1 - - - - - - - - - - - - - - - | A1 - - - - - - - - - - - - - - -",
          lead:
          "D5 - - - F5 - - - E5 - - - D5 - - - | A5 - - - G5 - - - F5 - - - E5 - - - | " +
          "D5 - - - F5 - - - A5 - - - G5 - - - | F5 - - - E5 - - - Eb5 - - - D5 - - -",
          organ:
          "D3^0137 - - - - - - - - - - - - - - - | C3^0137 - - - - - - - - - - - - - - - | " +
          "Bb2^0137 - - - - - - - - - - - - - - - | A2^0137 - - - - - - - - - - - - - - -",
          bell:
          "D4 - - - D4 - - - D4 - - - D4 - - - | D4 - - - D4 - - - D4 - - - D4 - - - | " +
          "D4 - - - D4 - - - D4 - - - D4 - - - | . . . . . . . . . . . . . . . .",
          scream:
          "D4 - - - F4 - - - E4 - - - D4 - - - | A4 - - - G4 - - - F4 - - - E4 - - - | " +
          "D4 - - - F4 - - - A4 - - - G4 - - - | F4 - - - E4 - - - Eb4 - - - D4 - - -",
        },
      },
      order: ["A", "B", "C"],
    },
  },
};
