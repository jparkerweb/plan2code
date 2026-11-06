// Plan2Code Web Console - ghoul: The Chapel's own sound effects and music tracks, merged into ghoul-sfx.js; defines only.
//
// Same shape and rules as ghoul-sfx-graveyard.js: `tones` (the stage's
// monsters' and boss's `ghoul<Kind><Act>` sounds) and `music` (a track per
// room, named in ROOM_MUSIC in ghoul.js). A name may be defined only once
// across tones.js and every game's file. No imports.

export const CHAPEL_SFX = {
  tones: {
    // The Chapel's monsters, the Choirmaster, the bell and Holy Water, picked by
    // ear (prototypes/sounds/ghoul-rush/chapel.html).
    // Gargoyle: Stone on a ledge; it cracks awake when you pass under and dives at your chest.
    // Comes in: Grit settling.
    ghoulGargoyleAppear: {
      layers: [
        { type: "brown", seconds: 0.7, attack: 0.08, gain: 0.6, filter: { type: "lowpass", from: 180, to: 70, q: 1 } },
        { type: "sine", from: 48, to: 30, seconds: 0.7, attack: 0.05, gain: 0.48 },
        { type: "noise", seconds: 0.04, delay: 0.1, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2361, to: 1889, q: 6 } },
        { type: "square", from: 576, to: 353, seconds: 0.02, delay: 0.1, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.16, attack: 0, gain: 0.79, filter: { type: "bandpass", from: 2087, to: 1670, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.23, attack: 0, gain: 0.68, filter: { type: "bandpass", from: 1880, to: 1504, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.3, attack: 0, gain: 0.58, filter: { type: "bandpass", from: 1708, to: 1367, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.39, attack: 0, gain: 0.47, filter: { type: "bandpass", from: 2342, to: 1874, q: 6 } },
        { type: "square", from: 542, to: 446, seconds: 0.02, delay: 0.39, gain: 0.3 },
      ],
    },
    // Bolt glances off: Chip and tick.
    ghoulGargoyleGlance: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.8, filter: { type: "bandpass", from: 3240, to: 2160, q: 2 } },
        { type: "square", from: 1620, to: 540, seconds: 0.05, attack: 0, gain: 0.32 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.56, filter: { type: "bandpass", from: 4680, to: 3240, q: 3 } },
        { type: "triangle", from: 2600, to: 2210, seconds: 0.22, attack: 0, gain: 0.36, delay: 0.08 },
        { type: "sine", from: 7020, to: 6500, seconds: 0.12, attack: 0, gain: 0.14, delay: 0.08 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.2, filter: { type: "bandpass", from: 10400, to: 10400, q: 2 }, delay: 0.08 },
      ],
    },
    // Cracks awake: Stone splitting.
    ghoulGargoyleWake: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 1, filter: { type: "bandpass", from: 900, to: 600, q: 2 } },
        { type: "square", from: 450, to: 150, seconds: 0.05, attack: 0, gain: 0.4 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.7, filter: { type: "bandpass", from: 1300, to: 900, q: 3 } },
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.8, filter: { type: "bandpass", from: 720, to: 480, q: 2 }, delay: 0.12 },
        { type: "square", from: 360, to: 120, seconds: 0.05, attack: 0, gain: 0.32, delay: 0.12 },
        { type: "noise", seconds: 0.04, delay: 0.18, attack: 0, gain: 0.56, filter: { type: "bandpass", from: 1040, to: 720, q: 3 } },
        { type: "brown", seconds: 0.6, attack: 0.08, gain: 0.5, filter: { type: "lowpass", from: 180, to: 70, q: 1 } },
        { type: "sine", from: 48, to: 30, seconds: 0.6, attack: 0.05, gain: 0.4 },
      ],
    },
    // Dives: Grinding swoop.
    ghoulGargoyleDive: {
      layers: [
        { type: "sawtooth", from: 58, to: 74, seconds: 0.18, attack: 0.05, gain: 0.9, vibrato: { rate: 8, depth: 0.1 }, filter: { type: "lowpass", from: 300, to: 1540, q: 4 } },
        { type: "sawtooth", from: 74, to: 45, seconds: 0.35, delay: 0.15, attack: 0.02, gain: 0.9, vibrato: { rate: 8, depth: 0.12 }, filter: { type: "lowpass", from: 1540, to: 260, q: 4 } },
        { type: "sawtooth", from: 32, to: 23, seconds: 0.5, attack: 0.08, gain: 0.6, filter: { type: "lowpass", from: 500, to: 500, q: 1 } },
        { type: "brown", seconds: 0.5, attack: 0.06, gain: 0.8, filter: { type: "lowpass", from: 900, to: 180, q: 1 } },
        { type: "sine", from: 32, to: 22, seconds: 0.5, attack: 0.05, gain: 0.7 },
        { type: "noise", seconds: 0.4, attack: 0.06, gain: 0.32, filter: { type: "highpass", from: 1920, to: 4000, q: 1 } },
        { type: "pink", seconds: 0.4, attack: 0.05, gain: 0.2, filter: { type: "bandpass", from: 2560, to: 1760, q: 2 } },
      ],
    },
    // Settles back: Cold sigh into rock.
    ghoulGargoylePerch: {
      layers: [
        { type: "triangle", from: 56, to: 42, seconds: 0.8, attack: 0.25, gain: 0.54, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 980, to: 630, q: 1 } },
        { type: "sine", from: 112, to: 84, seconds: 0.8, attack: 0.3, gain: 0.18 },
        { type: "pink", seconds: 0.8, attack: 0.3, gain: 0.15, filter: { type: "bandpass", from: 224, to: 168, q: 6 } },
        { type: "triangle", from: 130, to: 111, seconds: 0.22, attack: 0, gain: 0.54, delay: 0.5 },
        { type: "sine", from: 351, to: 325, seconds: 0.12, attack: 0, gain: 0.21, delay: 0.5 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.3, filter: { type: "bandpass", from: 520, to: 520, q: 2 }, delay: 0.5 },
      ],
    },
    // Takes a bolt: Grit spray.
    ghoulGargoyleHurt: {
      layers: [
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 3160, to: 2528, q: 6 } },
        { type: "square", from: 867, to: 639, seconds: 0.02, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.04, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 4151, to: 3321, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.07, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 4735, to: 3788, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.1, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2938, to: 2350, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.12, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 5028, to: 4023, q: 6 } },
        { type: "square", from: 979, to: 785, seconds: 0.02, delay: 0.12, gain: 0.3 },
        { type: "noise", seconds: 0.5, attack: 0, gain: 0.4, filter: { type: "lowpass", from: 5460, to: 195, q: 1 } },
        { type: "sine", from: 208, to: 46, seconds: 0.4, attack: 0, gain: 0.36 },
        { type: "brown", seconds: 0.6, attack: 0.01, gain: 0.28, filter: { type: "lowpass", from: 520, to: 520, q: 1 } },
      ],
    },
    // Dies: Crumbling collapse.
    ghoulGargoyleDie: {
      layers: [
        { type: "brown", seconds: 0.8, attack: 0.08, gain: 0.7, filter: { type: "lowpass", from: 180, to: 70, q: 1 } },
        { type: "sine", from: 48, to: 30, seconds: 0.8, attack: 0.05, gain: 0.56 },
        { type: "noise", seconds: 0.04, delay: 0.1, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1511, to: 1209, q: 6 } },
        { type: "square", from: 646, to: 324, seconds: 0.02, delay: 0.1, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.16, attack: 0, gain: 0.84, filter: { type: "bandpass", from: 1465, to: 1172, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.2, attack: 0, gain: 0.78, filter: { type: "bandpass", from: 2333, to: 1866, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.26, attack: 0, gain: 0.72, filter: { type: "bandpass", from: 2391, to: 1912, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.34, attack: 0, gain: 0.66, filter: { type: "bandpass", from: 2084, to: 1667, q: 6 } },
        { type: "square", from: 618, to: 388, seconds: 0.02, delay: 0.34, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.42, attack: 0, gain: 0.6, filter: { type: "bandpass", from: 1606, to: 1285, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.47, attack: 0, gain: 0.54, filter: { type: "bandpass", from: 2321, to: 1857, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.51, attack: 0, gain: 0.48, filter: { type: "bandpass", from: 2430, to: 1944, q: 6 } },
      ],
    },
    // Choir Ghost: A robed ghost that drifts toward you and sings; while it sings, everything near it runs faster.
    // Drifts in: Breathy choir hum.
    ghoulChoristerAppear: {
      layers: [
        { type: "triangle", from: 440, to: 330, seconds: 0.9, attack: 0.25, gain: 0.54, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 1400, to: 900, q: 1 } },
        { type: "sine", from: 880, to: 660, seconds: 0.9, attack: 0.3, gain: 0.18 },
        { type: "pink", seconds: 0.9, attack: 0.3, gain: 0.15, filter: { type: "bandpass", from: 1760, to: 1320, q: 6 } },
        { type: "pink", seconds: 0.6, attack: 0.25, gain: 0.32, filter: { type: "bandpass", from: 1050, to: 3900, q: 5 } },
        { type: "noise", seconds: 0.42, delay: 0.24, attack: 0.1, gain: 0.2, filter: { type: "bandpass", from: 3900, to: 1350, q: 8 } },
      ],
    },
    // Sings: Ghostly choral swell.
    ghoulChoristerSing: {
      layers: [
        { type: "sine", from: 523, to: 785, seconds: 0.42, attack: 0.15, gain: 0.56, vibrato: { rate: 6, depth: 0.04 } },
        { type: "sine", from: 785, to: 366, seconds: 0.62, delay: 0.38, attack: 0.04, gain: 0.56, vibrato: { rate: 6, depth: 0.05 } },
        { type: "triangle", from: 1051, to: 732, seconds: 1, attack: 0.3, gain: 0.14 },
        { type: "pink", seconds: 1, attack: 0.3, gain: 0.14, filter: { type: "bandpass", from: 1046, to: 1046, q: 8 } },
        { type: "sine", from: 659, to: 989, seconds: 0.42, attack: 0.15, gain: 0.4, vibrato: { rate: 6, depth: 0.04 }, delay: 0.05 },
        { type: "sine", from: 989, to: 461, seconds: 0.62, delay: 0.43, attack: 0.04, gain: 0.4, vibrato: { rate: 6, depth: 0.05 } },
        { type: "triangle", from: 1325, to: 923, seconds: 1, attack: 0.3, gain: 0.1, delay: 0.05 },
        { type: "pink", seconds: 1, attack: 0.3, gain: 0.1, filter: { type: "bandpass", from: 1318, to: 1318, q: 8 }, delay: 0.05 },
        { type: "triangle", from: 616, to: 462, seconds: 0.9, attack: 0.25, gain: 0.27, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 1960, to: 1260, q: 1 } },
        { type: "sine", from: 1232, to: 924, seconds: 0.9, attack: 0.3, gain: 0.09 },
        { type: "pink", seconds: 0.9, attack: 0.3, gain: 0.08, filter: { type: "bandpass", from: 2464, to: 1848, q: 6 } },
      ],
    },
    // Falls quiet: Hushed whisper.
    ghoulChoristerHush: {
      layers: [
        { type: "pink", seconds: 0.4, attack: 0.25, gain: 0.48, filter: { type: "bandpass", from: 980, to: 3640, q: 5 } },
        { type: "noise", seconds: 0.28, delay: 0.16, attack: 0.1, gain: 0.3, filter: { type: "bandpass", from: 3640, to: 1260, q: 8 } },
      ],
    },
    // Takes a bolt: Glassy ping.
    ghoulChoristerHurt: {
      layers: [
        { type: "triangle", from: 1500, to: 1275, seconds: 0.22, attack: 0, gain: 0.54 },
        { type: "sine", from: 4050, to: 3750, seconds: 0.12, attack: 0, gain: 0.21 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.3, filter: { type: "bandpass", from: 6000, to: 6000, q: 2 } },
        { type: "sine", from: 800, to: 1200, seconds: 0.11, attack: 0.15, gain: 0.32, vibrato: { rate: 6, depth: 0.04 } },
        { type: "sine", from: 1200, to: 560, seconds: 0.16, delay: 0.1, attack: 0.04, gain: 0.32, vibrato: { rate: 6, depth: 0.05 } },
        { type: "triangle", from: 1608, to: 1120, seconds: 0.25, attack: 0.3, gain: 0.08 },
        { type: "pink", seconds: 0.25, attack: 0.3, gain: 0.08, filter: { type: "bandpass", from: 1600, to: 1600, q: 8 } },
      ],
    },
    // Dies: Spirit pop.
    ghoulChoristerDie: {
      layers: [
        { type: "noise", seconds: 0.5, attack: 0, gain: 0.5, filter: { type: "lowpass", from: 8400, to: 300, q: 1 } },
        { type: "sine", from: 320, to: 70, seconds: 0.4, attack: 0, gain: 0.45 },
        { type: "brown", seconds: 0.6, attack: 0.01, gain: 0.35, filter: { type: "lowpass", from: 800, to: 800, q: 1 } },
        { type: "sine", from: 700, to: 1050, seconds: 0.29, attack: 0.15, gain: 0.4, vibrato: { rate: 6, depth: 0.04 }, delay: 0.05 },
        { type: "sine", from: 1050, to: 490, seconds: 0.43, delay: 0.32, attack: 0.04, gain: 0.4, vibrato: { rate: 6, depth: 0.05 } },
        { type: "triangle", from: 1407, to: 980, seconds: 0.7, attack: 0.3, gain: 0.1, delay: 0.05 },
        { type: "pink", seconds: 0.7, attack: 0.3, gain: 0.1, filter: { type: "bandpass", from: 1400, to: 1400, q: 8 }, delay: 0.05 },
      ],
    },
    // Censer Monk: A hooded monk that walks at you, swinging a smoking censer on a chain.
    // Comes in: Murmured prayer.
    ghoulMonkAppear: {
      layers: [
        { type: "pink", seconds: 0.8, attack: 0.25, gain: 0.56, filter: { type: "bandpass", from: 490, to: 1820, q: 5 } },
        { type: "noise", seconds: 0.56, delay: 0.32, attack: 0.1, gain: 0.35, filter: { type: "bandpass", from: 1820, to: 630, q: 8 } },
        { type: "triangle", from: 120, to: 90, seconds: 0.7, attack: 0.25, gain: 0.27, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 1680, to: 1080, q: 1 }, delay: 0.1 },
        { type: "sine", from: 240, to: 180, seconds: 0.7, attack: 0.3, gain: 0.09, delay: 0.1 },
        { type: "pink", seconds: 0.7, attack: 0.3, gain: 0.08, filter: { type: "bandpass", from: 480, to: 360, q: 6 }, delay: 0.1 },
      ],
    },
    // Swings the censer: Grunt and swing.
    ghoulMonkCenser: {
      layers: [
        { type: "sawtooth", from: 130, to: 90, seconds: 0.16, attack: 0.01, gain: 0.9, vibrato: { rate: 12, depth: 0.1 }, filter: { type: "lowpass", from: 990, to: 990, q: 1 } },
        { type: "brown", seconds: 0.13, attack: 0.01, gain: 0.6, filter: { type: "lowpass", from: 500, to: 500, q: 1 } },
        { type: "noise", seconds: 0.35, attack: 0.12, gain: 0.8, filter: { type: "bandpass", from: 360, to: 2160, q: 1.5 }, delay: 0.08 },
        { type: "triangle", from: 1200, to: 1020, seconds: 0.22, attack: 0, gain: 0.36, delay: 0.25 },
        { type: "sine", from: 3240, to: 3000, seconds: 0.12, attack: 0, gain: 0.14, delay: 0.25 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.2, filter: { type: "bandpass", from: 4800, to: 4800, q: 2 }, delay: 0.25 },
      ],
    },
    // Puffs smoke: Long hiss.
    ghoulMonkSmoke: {
      layers: [
        { type: "noise", seconds: 0.9, attack: 0.06, gain: 0.64, filter: { type: "highpass", from: 1920, to: 4000, q: 1 } },
        { type: "pink", seconds: 0.9, attack: 0.05, gain: 0.4, filter: { type: "bandpass", from: 2560, to: 1760, q: 2 } },
      ],
    },
    // Takes a bolt: Muffled grunt.
    ghoulMonkHurt: {
      layers: [
        { type: "sawtooth", from: 117, to: 81, seconds: 0.16, attack: 0.01, gain: 0.9, vibrato: { rate: 12, depth: 0.1 }, filter: { type: "lowpass", from: 891, to: 891, q: 1 } },
        { type: "brown", seconds: 0.13, attack: 0.01, gain: 0.6, filter: { type: "lowpass", from: 450, to: 450, q: 1 } },
      ],
    },
    // Dies: Heavy fall.
    ghoulMonkDie: {
      layers: [
        { type: "sine", from: 110, to: 40, seconds: 0.25, attack: 0, gain: 1 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.8, filter: { type: "lowpass", from: 320, to: 320, q: 1 } },
        { type: "triangle", from: 300, to: 255, seconds: 0.22, attack: 0, gain: 0.45, delay: 0.15 },
        { type: "sine", from: 810, to: 750, seconds: 0.12, attack: 0, gain: 0.18, delay: 0.15 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.25, filter: { type: "bandpass", from: 1200, to: 1200, q: 2 }, delay: 0.15 },
        { type: "triangle", from: 80, to: 60, seconds: 0.7, attack: 0.25, gain: 0.36, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 1120, to: 720, q: 1 }, delay: 0.2 },
        { type: "sine", from: 160, to: 120, seconds: 0.7, attack: 0.3, gain: 0.12, delay: 0.2 },
        { type: "pink", seconds: 0.7, attack: 0.3, gain: 0.1, filter: { type: "bandpass", from: 320, to: 240, q: 6 }, delay: 0.2 },
      ],
    },
    // Bell Bat: A bat asleep in a bell; when the bell tolls a flock bursts out and swoops at you.
    // Comes in: Sleepy snore-peep.
    ghoulBellbatAppear: {
      layers: [
        { type: "sine", from: 7150, to: 5500, seconds: 0.6, attack: 0.05, gain: 0.36, vibrato: { rate: 9, depth: 0.4 } },
        { type: "brown", seconds: 0.6, attack: 0.05, gain: 0.24, filter: { type: "lowpass", from: 2500, to: 1250, q: 1 } },
        { type: "sine", from: 1300, to: 1690, seconds: 0.08, attack: 0.01, gain: 0.32, vibrato: { rate: 40, depth: 0.08 }, delay: 0.3 },
        { type: "sine", from: 1560, to: 2015, seconds: 0.07, delay: 0.4, attack: 0.01, gain: 0.24, vibrato: { rate: 40, depth: 0.08 } },
      ],
    },
    // Bursts from the bell: Pop and flutter.
    ghoulBellbatBurst: {
      layers: [
        { type: "noise", seconds: 0.5, attack: 0, gain: 0.6, filter: { type: "lowpass", from: 10500, to: 375, q: 1 } },
        { type: "sine", from: 400, to: 88, seconds: 0.4, attack: 0, gain: 0.54 },
        { type: "brown", seconds: 0.6, attack: 0.01, gain: 0.42, filter: { type: "lowpass", from: 1000, to: 1000, q: 1 } },
        { type: "pink", seconds: 0.07, delay: 0.05, attack: 0.01, gain: 0.9, filter: { type: "bandpass", from: 1320, to: 572, q: 1 } },
        { type: "pink", seconds: 0.07, delay: 0.1, attack: 0.01, gain: 0.6, filter: { type: "bandpass", from: 1320, to: 572, q: 1 } },
        { type: "pink", seconds: 0.07, delay: 0.15, attack: 0.01, gain: 0.9, filter: { type: "bandpass", from: 1320, to: 572, q: 1 } },
        { type: "pink", seconds: 0.07, delay: 0.2, attack: 0.01, gain: 0.6, filter: { type: "bandpass", from: 1320, to: 572, q: 1 } },
        { type: "pink", seconds: 0.07, delay: 0.25, attack: 0.01, gain: 0.9, filter: { type: "bandpass", from: 1320, to: 572, q: 1 } },
      ],
    },
    // Takes a hit: Thin yelp.
    ghoulBellbatHurt: {
      layers: [
        { type: "sawtooth", from: 1900, to: 1140, seconds: 0.2, attack: 0.01, gain: 0.48, vibrato: { rate: 10, depth: 0.03 }, filter: { type: "bandpass", from: 3800, to: 3040, q: 2 } },
        { type: "sawtooth", from: 1710, to: 950, seconds: 0.26, delay: 0.17, attack: 0.01, gain: 0.33, filter: { type: "bandpass", from: 3420, to: 2280, q: 2 } },
      ],
    },
    // Dies: Spark fizz.
    ghoulBellbatDie: {
      layers: [
        { type: "noise", seconds: 0.35, attack: 0.06, gain: 0.8, filter: { type: "highpass", from: 3840, to: 8000, q: 1 } },
        { type: "pink", seconds: 0.35, attack: 0.05, gain: 0.5, filter: { type: "bandpass", from: 5120, to: 3520, q: 2 } },
        { type: "noise", seconds: 0.1, attack: 0, gain: 0.4, filter: { type: "highpass", from: 3240, to: 3240, q: 1 }, delay: 0.05 },
        { type: "sine", from: 1260, to: 270, seconds: 0.16, delay: 0.07, gain: 0.3 },
        { type: "brown", seconds: 0.12, attack: 0, gain: 0.25, filter: { type: "lowpass", from: 756, to: 756, q: 1 }, delay: 0.05 },
      ],
    },
    // The Choirmaster: The boss: a conductor at the organ; silence the four pipes one by one, then hit him while he is open.
    // Wakes: Pedal chord and growl.
    ghoulChoirmasterWake: {
      layers: [
        { type: "brown", seconds: 1, attack: 0.08, gain: 0.7, filter: { type: "lowpass", from: 180, to: 70, q: 1 } },
        { type: "sine", from: 48, to: 30, seconds: 1, attack: 0.05, gain: 0.56 },
        { type: "sawtooth", from: 35, to: 45, seconds: 0.28, attack: 0.05, gain: 0.54, vibrato: { rate: 7, depth: 0.1 }, filter: { type: "lowpass", from: 300, to: 2200, q: 4 }, delay: 0.1 },
        { type: "sawtooth", from: 45, to: 27, seconds: 0.56, delay: 0.34, attack: 0.02, gain: 0.54, vibrato: { rate: 7, depth: 0.12 }, filter: { type: "lowpass", from: 2200, to: 260, q: 4 } },
        { type: "sawtooth", from: 20, to: 20, seconds: 0.8, attack: 0.08, gain: 0.36, filter: { type: "lowpass", from: 500, to: 500, q: 1 }, delay: 0.1 },
        { type: "brown", seconds: 0.8, attack: 0.06, gain: 0.48, filter: { type: "lowpass", from: 900, to: 180, q: 1 }, delay: 0.1 },
        { type: "sine", from: 20, to: 20, seconds: 0.8, attack: 0.05, gain: 0.42, delay: 0.1 },
      ],
    },
    // Raises the baton: Three-count taps.
    ghoulChoirmasterCue: {
      layers: [
        { type: "triangle", from: 1000, to: 850, seconds: 0.22, attack: 0, gain: 0.63 },
        { type: "sine", from: 2700, to: 2500, seconds: 0.12, attack: 0, gain: 0.24 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.35, filter: { type: "bandpass", from: 4000, to: 4000, q: 2 } },
        { type: "triangle", from: 1150, to: 978, seconds: 0.22, attack: 0, gain: 0.63, delay: 0.16 },
        { type: "sine", from: 3105, to: 2875, seconds: 0.12, attack: 0, gain: 0.24, delay: 0.16 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.35, filter: { type: "bandpass", from: 4600, to: 4600, q: 2 }, delay: 0.16 },
        { type: "triangle", from: 1300, to: 1105, seconds: 0.22, attack: 0, gain: 0.72, delay: 0.32 },
        { type: "sine", from: 3510, to: 3250, seconds: 0.12, attack: 0, gain: 0.28, delay: 0.32 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.4, filter: { type: "bandpass", from: 5200, to: 5200, q: 2 }, delay: 0.32 },
      ],
    },
    // Notes launch: Low blast and shimmer.
    ghoulChoirmasterNotes: {
      layers: [
        { type: "sawtooth", from: 41, to: 52, seconds: 0.21, attack: 0.05, gain: 0.9, vibrato: { rate: 7, depth: 0.1 }, filter: { type: "lowpass", from: 300, to: 2200, q: 4 } },
        { type: "sawtooth", from: 52, to: 32, seconds: 0.42, delay: 0.18, attack: 0.02, gain: 0.9, vibrato: { rate: 7, depth: 0.12 }, filter: { type: "lowpass", from: 2200, to: 260, q: 4 } },
        { type: "sawtooth", from: 23, to: 20, seconds: 0.6, attack: 0.08, gain: 0.6, filter: { type: "lowpass", from: 500, to: 500, q: 1 } },
        { type: "brown", seconds: 0.6, attack: 0.06, gain: 0.8, filter: { type: "lowpass", from: 900, to: 180, q: 1 } },
        { type: "sine", from: 23, to: 20, seconds: 0.6, attack: 0.05, gain: 0.7 },
        { type: "brown", seconds: 0.8, attack: 0.08, gain: 0.5, filter: { type: "lowpass", from: 180, to: 70, q: 1 } },
        { type: "sine", from: 48, to: 30, seconds: 0.8, attack: 0.05, gain: 0.4 },
        { type: "sine", from: 880, to: 1320, seconds: 0.34, attack: 0.15, gain: 0.24, vibrato: { rate: 6, depth: 0.04 }, delay: 0.05 },
        { type: "sine", from: 1320, to: 616, seconds: 0.5, delay: 0.35, attack: 0.04, gain: 0.24, vibrato: { rate: 6, depth: 0.05 } },
        { type: "triangle", from: 1769, to: 1232, seconds: 0.8, attack: 0.3, gain: 0.06, delay: 0.05 },
        { type: "pink", seconds: 0.8, attack: 0.3, gain: 0.06, filter: { type: "bandpass", from: 1760, to: 1760, q: 8 }, delay: 0.05 },
      ],
    },
    // Pipe spews a ghost: Hollow note and howl.
    ghoulChoirmasterPipeSpew: {
      layers: [
        { type: "sine", notes: [196, 165, 131, 98], seconds: 0.6, attack: 0.02, gain: 0.3, vibrato: { rate: 7, depth: 0.02 } },
        { type: "triangle", notes: [294, 247, 196, 147], seconds: 0.6, attack: 0.02, gain: 0.13 },
        { type: "sawtooth", from: 273, to: 382, seconds: 0.36, attack: 0.1, gain: 0.35, vibrato: { rate: 6, depth: 0.03 }, filter: { type: "bandpass", from: 637, to: 819, q: 3 }, delay: 0.1 },
        { type: "sawtooth", from: 382, to: 237, seconds: 0.48, delay: 0.44, attack: 0.03, gain: 0.35, vibrato: { rate: 6, depth: 0.04 }, filter: { type: "bandpass", from: 819, to: 455, q: 3 } },
        { type: "pink", seconds: 0.8, attack: 0.2, gain: 0.1, filter: { type: "bandpass", from: 728, to: 546, q: 4 }, delay: 0.1 },
      ],
    },
    // Bolt on a pipe: Tin tick.
    ghoulChoirmasterPipeHit: {
      layers: [
        { type: "triangle", from: 2000, to: 1700, seconds: 0.22, attack: 0, gain: 0.63 },
        { type: "sine", from: 5400, to: 5000, seconds: 0.12, attack: 0, gain: 0.24 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.35, filter: { type: "bandpass", from: 8000, to: 8000, q: 2 } },
      ],
    },
    // Pipe goes silent: Choking off.
    ghoulChoirmasterPipeSilence: {
      layers: [
        { type: "sawtooth", from: 107, to: 76, seconds: 0.6, attack: 0.12, gain: 0.9, vibrato: { rate: 7, depth: 0.07 }, filter: { type: "lowpass", from: 1000, to: 500, q: 5 } },
        { type: "sawtooth", from: 108, to: 76, seconds: 0.6, attack: 0.14, gain: 0.5, filter: { type: "lowpass", from: 800, to: 400, q: 3 } },
        { type: "brown", seconds: 0.6, attack: 0.1, gain: 0.6, filter: { type: "bandpass", from: 390, to: 293, q: 2 } },
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.5, filter: { type: "bandpass", from: 1080, to: 720, q: 2 }, delay: 0.4 },
        { type: "square", from: 540, to: 180, seconds: 0.05, attack: 0, gain: 0.2, delay: 0.4 },
        { type: "noise", seconds: 0.04, delay: 0.46, attack: 0, gain: 0.35, filter: { type: "bandpass", from: 1560, to: 1080, q: 3 } },
      ],
    },
    // Pipe sounds again: Roaring back.
    ghoulChoirmasterPipeSound: {
      layers: [
        { type: "sawtooth", from: 47, to: 60, seconds: 0.24, attack: 0.05, gain: 0.9, vibrato: { rate: 7, depth: 0.1 }, filter: { type: "lowpass", from: 300, to: 2200, q: 4 } },
        { type: "sawtooth", from: 60, to: 36, seconds: 0.49, delay: 0.21, attack: 0.02, gain: 0.9, vibrato: { rate: 7, depth: 0.12 }, filter: { type: "lowpass", from: 2200, to: 260, q: 4 } },
        { type: "sawtooth", from: 26, to: 20, seconds: 0.7, attack: 0.08, gain: 0.6, filter: { type: "lowpass", from: 500, to: 500, q: 1 } },
        { type: "brown", seconds: 0.7, attack: 0.06, gain: 0.8, filter: { type: "lowpass", from: 900, to: 180, q: 1 } },
        { type: "sine", from: 26, to: 20, seconds: 0.7, attack: 0.05, gain: 0.7 },
        { type: "sine", notes: [330, 277, 221, 165], seconds: 0.7, attack: 0.02, gain: 0.24, vibrato: { rate: 7, depth: 0.02 } },
        { type: "triangle", notes: [495, 416, 330, 248], seconds: 0.7, attack: 0.02, gain: 0.1 },
      ],
    },
    // He staggers open: Chime of opening.
    ghoulChoirmasterOpen: {
      layers: [
        { type: "sine", notes: [1047, 879, 701, 524], seconds: 0.9, attack: 0.02, gain: 0.3, vibrato: { rate: 7, depth: 0.02 } },
        { type: "triangle", notes: [1571, 1319, 1047, 785], seconds: 0.9, attack: 0.02, gain: 0.13 },
        { type: "sine", notes: [1319, 1108, 884, 660], seconds: 0.9, attack: 0.02, gain: 0.24, vibrato: { rate: 7, depth: 0.02 }, delay: 0.08 },
        { type: "triangle", notes: [1979, 1662, 1319, 989], seconds: 0.9, attack: 0.02, gain: 0.1, delay: 0.08 },
      ],
    },
    // Rage: Pounding pedal run.
    ghoulChoirmasterRage: {
      layers: [
        { type: "sine", from: 110, to: 40, seconds: 0.25, attack: 0, gain: 0.7 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.56, filter: { type: "lowpass", from: 320, to: 320, q: 1 } },
        { type: "sine", from: 110, to: 40, seconds: 0.25, attack: 0, gain: 0.7, delay: 0.15 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.56, filter: { type: "lowpass", from: 320, to: 320, q: 1 }, delay: 0.15 },
        { type: "sine", from: 110, to: 40, seconds: 0.25, attack: 0, gain: 0.8, delay: 0.3 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.64, filter: { type: "lowpass", from: 320, to: 320, q: 1 }, delay: 0.3 },
        { type: "sawtooth", from: 47, to: 60, seconds: 0.24, attack: 0.05, gain: 0.72, vibrato: { rate: 7, depth: 0.1 }, filter: { type: "lowpass", from: 300, to: 2200, q: 4 }, delay: 0.4 },
        { type: "sawtooth", from: 60, to: 36, seconds: 0.49, delay: 0.61, attack: 0.02, gain: 0.72, vibrato: { rate: 7, depth: 0.12 }, filter: { type: "lowpass", from: 2200, to: 260, q: 4 } },
        { type: "sawtooth", from: 26, to: 20, seconds: 0.7, attack: 0.08, gain: 0.48, filter: { type: "lowpass", from: 500, to: 500, q: 1 }, delay: 0.4 },
        { type: "brown", seconds: 0.7, attack: 0.06, gain: 0.64, filter: { type: "lowpass", from: 900, to: 180, q: 1 }, delay: 0.4 },
        { type: "sine", from: 26, to: 20, seconds: 0.7, attack: 0.05, gain: 0.56, delay: 0.4 },
      ],
    },
    // Takes a hit: Off-key yelp.
    ghoulChoirmasterHurt: {
      layers: [
        { type: "sawtooth", from: 300, to: 180, seconds: 0.2, attack: 0.01, gain: 0.56, vibrato: { rate: 10, depth: 0.03 }, filter: { type: "bandpass", from: 600, to: 480, q: 2 } },
        { type: "sawtooth", from: 270, to: 150, seconds: 0.26, delay: 0.17, attack: 0.01, gain: 0.39, filter: { type: "bandpass", from: 540, to: 360, q: 2 } },
        { type: "sine", notes: [233, 196, 156, 117], seconds: 0.3, attack: 0.02, gain: 0.18, vibrato: { rate: 7, depth: 0.02 } },
        { type: "triangle", notes: [350, 294, 233, 175], seconds: 0.3, attack: 0.02, gain: 0.08 },
      ],
    },
    // Dies: Long falling groan.
    ghoulChoirmasterDie: {
      layers: [
        { type: "sawtooth", from: 57, to: 41, seconds: 1.2, attack: 0.12, gain: 0.9, vibrato: { rate: 7, depth: 0.07 }, filter: { type: "lowpass", from: 1000, to: 500, q: 5 } },
        { type: "sawtooth", from: 58, to: 40, seconds: 1.2, attack: 0.14, gain: 0.5, filter: { type: "lowpass", from: 800, to: 400, q: 3 } },
        { type: "brown", seconds: 1.2, attack: 0.1, gain: 0.6, filter: { type: "bandpass", from: 208, to: 156, q: 2 } },
        { type: "sine", from: 110, to: 40, seconds: 0.25, attack: 0, gain: 0.9, delay: 0.9 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.72, filter: { type: "lowpass", from: 320, to: 320, q: 1 }, delay: 0.9 },
      ],
    },
    // The Chapel bell: It swings, then tolls: everything on screen freezes for a second.
    // Swings: Squeaking hinge.
    ghoulBellSwing: {
      layers: [
        { type: "sine", from: 700, to: 910, seconds: 0.08, attack: 0.01, gain: 0.4, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 840, to: 1085, seconds: 0.07, delay: 0.1, attack: 0.01, gain: 0.3, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 620, to: 806, seconds: 0.08, attack: 0.01, gain: 0.4, vibrato: { rate: 40, depth: 0.08 }, delay: 0.4 },
        { type: "sine", from: 744, to: 961, seconds: 0.07, delay: 0.5, attack: 0.01, gain: 0.3, vibrato: { rate: 40, depth: 0.08 } },
        { type: "brown", seconds: 0.9, attack: 0.08, gain: 0.4, filter: { type: "lowpass", from: 180, to: 70, q: 1 } },
        { type: "sine", from: 48, to: 30, seconds: 0.9, attack: 0.05, gain: 0.32 },
      ],
    },
    // Tolls: Freezing resonance.
    ghoulBellToll: {
      layers: [
        { type: "triangle", from: 140, to: 119, seconds: 0.22, attack: 0, gain: 0.9 },
        { type: "sine", from: 378, to: 350, seconds: 0.12, attack: 0, gain: 0.35 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.5, filter: { type: "bandpass", from: 560, to: 560, q: 2 } },
        { type: "sine", notes: [196, 165, 131, 98], seconds: 1.1, attack: 0.02, gain: 0.3, vibrato: { rate: 7, depth: 0.02 } },
        { type: "triangle", notes: [294, 247, 196, 147], seconds: 1.1, attack: 0.02, gain: 0.13 },
        { type: "sawtooth", from: 66, to: 92, seconds: 0.5, attack: 0.1, gain: 0.21, vibrato: { rate: 6, depth: 0.03 }, filter: { type: "bandpass", from: 154, to: 198, q: 3 }, delay: 0.05 },
        { type: "sawtooth", from: 92, to: 57, seconds: 0.66, delay: 0.51, attack: 0.03, gain: 0.21, vibrato: { rate: 6, depth: 0.04 }, filter: { type: "bandpass", from: 198, to: 110, q: 3 } },
        { type: "pink", seconds: 1.1, attack: 0.2, gain: 0.06, filter: { type: "bandpass", from: 176, to: 132, q: 4 }, delay: 0.05 },
      ],
    },
    // Holy Water: The power-up: for 10 seconds your bolts splash nearby monsters, and double up on ghosts.
    // Splash: Droplets.
    ghoulHolySplash: {
      layers: [
        { type: "sine", from: 853, to: 1450, seconds: 0.05, delay: 0.35, attack: 0, gain: 0.35 },
        { type: "sine", from: 640, to: 1089, seconds: 0.05, delay: 0.3, attack: 0, gain: 0.35 },
        { type: "sine", from: 1175, to: 1997, seconds: 0.05, delay: 0.38, attack: 0, gain: 0.35 },
        { type: "sine", from: 1218, to: 2071, seconds: 0.05, delay: 0.21, attack: 0, gain: 0.35 },
        { type: "sine", from: 750, to: 1274, seconds: 0.05, delay: 0.04, attack: 0, gain: 0.35 },
        { type: "triangle", from: 2400, to: 2040, seconds: 0.22, attack: 0, gain: 0.27 },
        { type: "sine", from: 6480, to: 6000, seconds: 0.12, attack: 0, gain: 0.11 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.15, filter: { type: "bandpass", from: 9600, to: 9600, q: 2 } },
      ],
    },
  },
  // The Chapel's rooms: the Nave, the Bell Tower, the Organ Loft and the
  // Choir (the Choirmaster's fight), picked in prototypes/music/ghoul-rush.
  music: {
    // The Nave: murmuring congregation. Whispered syllables (soft noise hats
    // and a hush of rests) fall in an uneven rhythm over a pulsing E bass,
    // while the hymn is plucked in single short notes, as if half remembered.
    // Later a quiet voice sings it straight. The bell tolls the E and the
    // wrong Bb.
    ghoulNave: {
      bpm: 84,
      rush: 6,
      voices: {
        bass: { wave: "triangle", gain: 0.6, decay: 0.08, sustain: 0.5 },
        pizz: { wave: "pulse", duty: 0.125, gain: 0.2, decay: 0.03, sustain: 0.2 },
        murmur: { kit: true, gain: 0.2 },
        murmur2: { kit: true, gain: 0.12, from: 0.4 },
        voice: { wave: "triangle", gain: 0.15, from: 0.5, decay: 0.15, sustain: 0.85, vibrato: { rate: 4.5, depth: 0.006, delay: 0.3 } },
        bell: { wave: "pulse", duty: 0.125, gain: 0.2, from: 0.2, decay: 0.5, sustain: 0.12 },
      },
      patterns: {
        A: {
          bass:
          "E2 - - . E2 . . . E2 - - . E2 . . . | F2 - - . F2 . . . F2 - - . F2 . . . | " +
          "A1 - - . A1 . . . A1 - - . A1 . . . | E2 - - . E2 . . . E2 - - . E2 . . .",
          pizz:
          "E4 . . . G4 . . . A4 . . . G4 . . . | B4 . . . A4 . . . G4 . . . F4 . . . | " +
          "G4 . . . A4 . . . B4 . . . C5 . . . | C5 . . . B4 . . . Bb4 . . . . . . .",
          murmur:
          "h . h h . . h . h . . h h . h . | . h . . h . h h . . h . h . . h | " +
          "h h . h . . h . . h . h h . . h | h . . h . h . . h h . h . . h .",
          bell:
          "E5 - - - - - - - . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          "E5 - - - - - - - . . . . . . . . | . . . . . . . . Bb5 - - - - - - -",
        },
        B: {
          bass:
          "E2 - - . E2 . . . E2 - - . E2 . . . | F2 - - . F2 . . . F2 - - . F2 . . . | " +
          "A1 - - . A1 . . . A1 - - . A1 . . . | E2 - - . E2 . . . E2 - - . E2 . . .",
          pizz:
          "E4 . . . G4 . . . A4 . . . G4 . . . | B4 . . . A4 . . . G4 . . . F4 . . . | " +
          "G4 . . . A4 . . . B4 . . . C5 . . . | C5 . . . B4 . . . Bb4 . . . . . . .",
          murmur:
          "h . h h . . h . h . . h h . h . | . h . . h . h h . . h . h . . h | " +
          "h h . h . . h . . h . h h . . h | h . . h . h . . h h . h . . h .",
          murmur2:
          ". o . . . h . . o . . h . . h . | . . h . . o . . . . h . . o . . | " +
          "o . . h . . . . o . . h . h . . | . . o . . h . . h . . . . o . .",
          voice:
          "E4 - - - G4 - - - A4 - - - G4 - - - | B4 - - - A4 - - - G4 - - - F4 - - - | " +
          "G4 - - - A4 - - - B4 - - - C5 - - - | C5 - - - B4 - - - Bb4 - - - - - - -",
          bell:
          "E5 - - - - - - - . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          "E5 - - - - - - - . . . . . . . . | . . . . . . . . Bb5 - - - - - - -",
        },
        C: {
          bass:
          "E2 - - . E2 . . . E2 - - . E2 . . . | F2 - - . F2 . . . F2 - - . F2 . . . | " +
          "A1 - - . A1 . . . A1 - - . A1 . . . | E2 - - . E2 . . . E2 - - . E2 . . .",
          pizz:
          "E5 . . . G5 . . . A5 . . . G5 . . . | B5 . . . A5 . . . G5 . . . F5 . . . | " +
          "G5 . . . A5 . . . B5 . . . C6 . . . | C6 . . . B5 . . . Bb5 . . . . . . .",
          murmur:
          ". h . . h . h h . . h . h . . h | h . h h . . h . h . . h h . h . | " +
          "h . . h . h . . h h . h . . h . | h h . h . . h . . h . h h . . h",
          murmur2:
          "o . . h . . . . o . . h . h . . | . . o . . h . . h . . . . o . . | " +
          ". o . . . h . . o . . h . . h . | . . h . . o . . . . h . . o . .",
          voice:
          "C4 - - - E4 - - - F4 - - - E4 - - - | G4 - - - F4 - - - E4 - - - D4 - - - | " +
          "E4 - - - F4 - - - G4 - - - A4 - - - | A4 - - - G4 - - - E4 - - - - - - -",
        },
        D: {
          bass:
          "E2 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -",
          pizz:
          "E4 . . . G4 . . . A4 . . . G4 . . . | B4 . . . A4 . . . G4 . . . F4 . . . | " +
          "G4 . . . A4 . . . B4 . . . C5 . . . | C5 . . . B4 . . . Bb4 . . . . . . .",
          murmur:
          "h . h h . . h . h . . h h . h . | . h . . h . h h . . h . h . . h | " +
          "h . . . h . . . . . . h . . . . | . . . . . . . . . . . . . . . .",
          voice:
          "E4 - - - G4 - - - A4 - - - G4 - - - | B4 - - - A4 - - - G4 - - - F4 - - - | " +
          "G4 - - - A4 - - - B4 - - - C5 - - - | C5 - - - B4 - - - Bb4 - - - - - - -",
          bell:
          "E5 - - - - - - - . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          "E5 - - - - - - - . . . . . . . . | . . . . . . . . Bb5 - - - - - - -",
        },
      },
      order: ["A", "B", "C", "D"],
    },
    // The Bell Tower: carillon bells. A carillon of ringing pulse-wave bells
    // plays the hymn high, a great bell tolling E below. Cascades of falling
    // bell runs fill the space between verses, the great bells sway between E
    // and B, and the last verse is rung in two octaves with a Bb bell
    // clanging the wrong note.
    ghoulTower: {
      bpm: 96,
      rush: 10,
      voices: {
        hum: { wave: "sine", gain: 0.35, decay: 0.3, sustain: 0.95 },
        great: { wave: "triangle", gain: 0.6, decay: 0.6, sustain: 0.3 },
        carillon: { wave: "pulse", duty: 0.125, gain: 0.2, decay: 0.15, sustain: 0.1 },
        chime: { wave: "pulse", duty: 0.25, gain: 0.12, from: 0.3, decay: 0.3, sustain: 0.1 },
        rope: { kit: true, gain: 0.14, from: 0.4 },
        wrong: { wave: "pulse", duty: 0.125, gain: 0.15, from: 0.5, decay: 0.5, sustain: 0.12 },
      },
      patterns: {
        A: {
          hum:
          "E2 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -",
          great:
          "E3 - - - - - . . . . . . . . . . | E3 - - - - - . . . . . . . . . . | " +
          "E3 - - - - - . . . . . . . . . . | E3 - - - - - . . . . . . . . . .",
          carillon:
          "E5 - - - G5 - - - A5 - - - G5 - - - | B5 - - - A5 - - - G5 - - - F5 - - - | " +
          "G5 - - - A5 - - - B5 - - - C6 - - - | C6 - - - B5 - - - Bb5 - - - - - - -",
        },
        B: {
          hum:
          "E2 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -",
          great:
          "E3 - - - - - . . . . . . . . . . | E3 - - - - - . . . . . . . . . . | " +
          "E3 - - - - - . . . . . . . . . . | E3 - - - - - . . . . . . . . . .",
          carillon:
          "E6 C6 B5 G5 E6 C6 B5 G5 F6 C6 A5 F5 F6 C6 A5 F5 | B5 G5 E5 B4 G5 E5 B4 G4 C6 A5 F5 C5 A5 F5 C5 A4 | " +
          "E6 C6 B5 G5 E6 C6 B5 G5 F6 C6 A5 F5 F6 C6 A5 F5 | E6 - D6 - C6 - B5 - Bb5 - - - - - - -",
          rope:
          "h . . . h . h . . . h . . . h . | h . . . h . h . . . h . . . h . | " +
          "h . . . h . h . . . h . . . h . | h . . . h . h . . . h . . . h .",
        },
        C: {
          hum:
          "E2 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -",
          great:
          "E3 - - - - - . . . . . . . . . . | E3 - - - - - . . . . . . . . . . | " +
          "E3 - - - - - . . . . . . . . . . | E3 - - - - - . . . . . . . . . .",
          carillon:
          "E5 - - - G5 - - - A5 - - - G5 - - - | B5 - - - A5 - - - G5 - - - F5 - - - | " +
          "G5 - - - A5 - - - B5 - - - C6 - - - | C6 - - - B5 - - - Bb5 - - - - - - -",
          chime:
          "C5 - - - E5 - - - F5 - - - E5 - - - | G5 - - - F5 - - - E5 - - - D5 - - - | " +
          "E5 - - - F5 - - - G5 - - - A5 - - - | A5 - - - G5 - - - E5 - - - - - - -",
          rope:
          "h . . . h . h . . . h . . . h . | h . . . h . h . . . h . . . h . | " +
          "h . . . h . h . . . h . . . h . | h . . . h . h . . . h . . . h .",
        },
        D: {
          hum:
          "E2 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -",
          great:
          "E3 - - - - - - - B2 - - - - - - - | E3 - - - - - - - B2 - - - - - - - | " +
          "E3 - - - - - - - B2 - - - - - - - | E3 - - - - - - - B2 - - - - - - -",
          carillon:
          "B5 G5 E5 B4 G5 E5 B4 G4 C6 A5 F5 C5 A5 F5 C5 A4 | E6 C6 B5 G5 E6 C6 B5 G5 F6 C6 A5 F5 F6 C6 A5 F5 | " +
          "B5 G5 E5 B4 G5 E5 B4 G4 C6 A5 F5 C5 A5 F5 C5 A4 | E6 C6 B5 G5 E6 C6 B5 G5 F6 C6 A5 F5 F6 C6 A5 F5",
          rope:
          "h . . . h . h . . . h . . . h . | h . . . h . h . . . h . . . h . | " +
          "h . . . h . h . . . h . . . h . | h . . . h . h . . . h . . . h .",
        },
        E: {
          hum:
          "E2 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -",
          great:
          "E3 - - - - - . . . . . . . . . . | E3 - - - - - . . . . . . . . . . | " +
          "E3 - - - - - . . . . . . . . . . | E3 - - - - - . . . . . . . . . .",
          carillon:
          "E5 - - - G5 - - - A5 - - - G5 - - - | B5 - - - A5 - - - G5 - - - F5 - - - | " +
          "G5 - - - A5 - - - B5 - - - C6 - - - | C6 - - - B5 - - - Bb5 - - - - - - -",
          chime:
          "E6 - - - G6 - - - A6 - - - G6 - - - | B6 - - - A6 - - - G6 - - - F6 - - - | " +
          "G6 - - - A6 - - - B6 - - - C7 - - - | C7 - - - B6 - - - Bb6 - - - - - - -",
          rope:
          "h . . . h . h . . . h . . . h . | h . . . h . h . . . h . . . h . | " +
          "h . . . h . h . . . h . . . h . | h . . . h . h . . . h . . . h .",
          wrong:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . Bb3 - - - - - - -",
        },
      },
      order: ["A", "B", "C", "D", "E"],
    },
    // The Organ Loft: baroque fugue gone wrong. An organ fugue on a two-bar
    // subject taken from the hymn. The top voice states it, an alto answers
    // an octave down, the pedal takes it at half speed, then a stretto crowds
    // the entries together. The subject ends on Bb every time, and the last
    // page piles the whole organ onto the wrong note.
    ghoulLoft: {
      bpm: 108,
      rush: 8,
      voices: {
        s1: { wave: "pulse", duty: 0.25, gain: 0.16, decay: 0.1, sustain: 0.8 },
        s2: { wave: "square", gain: 0.12, decay: 0.1, sustain: 0.85 },
        s3: { wave: "triangle", gain: 0.6, decay: 0.1, sustain: 0.8 },
        mix: { wave: "pulse", duty: 0.125, gain: 0.08, from: 0.5, decay: 0.2, sustain: 0.8 },
        bell: { wave: "pulse", duty: 0.125, gain: 0.16, from: 0.2, decay: 0.5, sustain: 0.12 },
      },
      patterns: {
        A: {
          s1:
          "E4 - G4 - A4 - G4 - B4 - - - A4 - G4 - | F4 - G4 - A4 - B4 - C5 - B4 - Bb4 - - - | " +
          "B4 C5 B4 A4 G4 A4 G4 F4 E4 F4 E4 D4 E4 G4 B4 E5 | B4 C5 B4 A4 G4 A4 G4 F4 E4 F4 E4 D4 E4 G4 B4 E5",
          s2:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          s3:
          "E2 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -",
        },
        B: {
          s1:
          "B4 C5 B4 A4 G4 A4 G4 F4 E4 F4 E4 D4 E4 G4 B4 E5 | E5 D5 C5 B4 A4 B4 C5 D5 E5 F5 E5 D5 C5 B4 A4 G4 | " +
          "B4 C5 B4 A4 G4 A4 G4 F4 E4 F4 E4 D4 E4 G4 B4 E5 | E5 D5 C5 B4 A4 B4 C5 D5 E5 F5 E5 D5 C5 B4 A4 G4",
          s2:
          "E3 - G3 - A3 - G3 - B3 - - - A3 - G3 - | F3 - G3 - A3 - B3 - C4 - B3 - Bb3 - - - | " +
          "B3 C4 B3 A3 G3 A3 G3 F3 E3 F3 E3 D3 E3 G3 B3 E4 | B3 C4 B3 A3 G3 A3 G3 F3 E3 F3 E3 D3 E3 G3 B3 E4",
          s3:
          "E2 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "B1 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -",
        },
        C: {
          s1:
          "B4 C5 B4 A4 G4 A4 G4 F4 E4 F4 E4 D4 E4 G4 B4 E5 | B4 C5 B4 A4 G4 A4 G4 F4 E4 F4 E4 D4 E4 G4 B4 E5 | " +
          "E5 D5 C5 B4 A4 B4 C5 D5 E5 F5 E5 D5 C5 B4 A4 G4 | E5 D5 C5 B4 A4 B4 C5 D5 E5 F5 E5 D5 C5 B4 A4 G4",
          s2:
          "E4 D4 C4 B3 A3 B3 C4 D4 E4 F4 E4 D4 C4 B3 A3 G3 | E4 D4 C4 B3 A3 B3 C4 D4 E4 F4 E4 D4 C4 B3 A3 G3 | " +
          "E4 D4 C4 B3 A3 B3 C4 D4 E4 F4 E4 D4 C4 B3 A3 G3 | E4 D4 C4 B3 A3 B3 C4 D4 E4 F4 E4 D4 C4 B3 A3 G3",
          s3:
          "E4 - - - G4 - - - A4 - - - G4 - - - | B4 - - - - - - - A4 - - - G4 - - - | " +
          "F4 - - - G4 - - - A4 - - - B4 - - - | C5 - - - B4 - - - Bb4 - - - - - - -",
        },
        D: {
          s1:
          "E4 - G4 - A4 - G4 - B4 - - - A4 - G4 - | F4 - G4 - A4 - B4 - C5 - B4 - Bb4 - - - | " +
          "E4 - G4 - A4 - G4 - B4 - - - A4 - G4 - | F4 - G4 - A4 - B4 - C5 - B4 - Bb4 - - -",
          s2:
          ". . . . . . . . E3 - G3 - A3 - G3 - | B3 - - - A3 - G3 - F3 - G3 - A3 - B3 - | " +
          "C4 - B3 - Bb3 - - - . . . . . . . . | . . . . . . . . . . . . . . . .",
          s3:
          "E2 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -",
          bell:
          "E5 - - - - - - - . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
        },
        E: {
          s1:
          "E4 - G4 - A4 - G4 - B4 - - - A4 - G4 - | F4 - G4 - A4 - B4 - C5 - B4 - Bb4 - - - | " +
          "C5 - - - - - - - B4 - - - - - - - | Bb4 - - - - - - - - - - - - - - -",
          s2:
          "E3 - G3 - A3 - G3 - B3 - - - A3 - G3 - | F3 - G3 - A3 - B3 - C4 - B3 - Bb3 - - - | " +
          "A3 - - - - - - - G3 - - - - - - - | E3 - - - - - - - - - - - - - - -",
          s3:
          "E2 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "F2 - - - - - - - B1 - - - - - - - | E2 - - - - - - - - - - - - - - -",
          mix:
          "E3^037 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "A3^037 - - - - - - - - - - - - - - - | E3^06c - - - - - - - - - - - - - - -",
          bell:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . Bb5 - - - - - - -",
        },
      },
      order: ["A", "B", "C", "D", "E"],
    },
    // The Choir (the Choirmaster fight): gothic metal organ. Cathedral metal:
    // palm-muted sawtooth chugs on E with a heavy backbeat, the hymn blazing
    // out on a bright organ lead, and a held choir chord floating over the
    // guitars as the bell tolls. Listen for the chugs jumping up an octave
    // and the lead climbing in the third section, the cadence on the same
    // wrong Bb, and at full dread the wailing high line, a machine-gun double
    // kick and crash cymbals driving it hard.
    ghoulChoir: {
      bpm: 140,
      rush: 10,
      voices: {
        drone: { wave: "sine", gain: 0.5, decay: 0.3, sustain: 0.95 },
        chug: { wave: "sawtooth", gain: 0.26, decay: 0.03, sustain: 0.35 },
        pad: { wave: "sawtooth", gain: 0.06, from: 0.3, decay: 0.3, sustain: 0.9, vibrato: { rate: 5.5, depth: 0.006, delay: 0.3 } },
        lead: { wave: "pulse", duty: 0.25, gain: 0.15, from: 0.45, decay: 0.1, sustain: 0.8, vibrato: { rate: 5.5, depth: 0.007, delay: 0.2 } },
        drums: { kit: true, gain: 0.45, from: 0.35 },
        hat: { kit: true, gain: 0.14, from: 0.5 },
        bell: { wave: "sine", gain: 0.4, decay: 0.9, sustain: 0.9 },
        crash: { kit: true, gain: 0.3, from: 0.6 },
        wail: { wave: "pulse", duty: 0.125, gain: 0.08, from: 0.9, decay: 0.1, sustain: 0.8, vibrato: { rate: 6.5, depth: 0.01, delay: 0.1 } },
        dbl: { kit: true, gain: 0.3, from: 0.9 },
      },
      patterns: {
        A: {
          drone:
          "E1 - - - - - - - - - - - - - - - | C2 - - - - - - - - - - - - - - - | " +
          "F1 - - - - - - - - - - - - - - - | E1 - - - - - - - - - - - - - - -",
          chug:
          "E2 E2 . E2 E2 . E2 . E2 E2 . E2 E2 . E2 . | C2 C2 . C2 C2 . C2 . C2 C2 . C2 C2 . C2 . | " +
          "F2 F2 . F2 F2 . F2 . F2 F2 . F2 F2 . F2 . | E2 E2 . E2 E2 . E2 . E2 E2 . E2 E2 . A#2 .",
          drums:
          "k . k . ks . k . k . k . ks . k k | k . k . ks . k . k . k . ks . k k | " +
          "k . k . ks . k . k . k . ks . k k | k . k k ks . k k ks ks ks ks ks ks ks ks",
          hat:
          "h . h . h . h . h . h . h . h . | h . h . h . h . h . h . h . h . | " +
          "h . h . h . h . h . h . h . h . | h . h . h . h . h . h . h . h .",
          bell:
          "E3^06 - - - - - - - . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          pad:
          "E4^037 - - - - - - - - - - - - - - - | C4^037 - - - - - - - - - - - - - - - | " +
          "F4^038 - - - - - - - - - - - - - - - | E4^06c - - - - - - - - - - - - - - -",
          crash:
          "o . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
        },
        B: {
          drone:
          "E1 - - - - - - - - - - - - - - - | C2 - - - - - - - - - - - - - - - | " +
          "F1 - - - - - - - - - - - - - - - | E1 - - - - - - - - - - - - - - -",
          chug:
          "E2 E2 . E2 E2 . E2 . E2 E2 . E2 E2 . E2 . | C2 C2 . C2 C2 . C2 . C2 C2 . C2 C2 . C2 . | " +
          "F2 F2 . F2 F2 . F2 . F2 F2 . F2 F2 . F2 . | E2 E2 . E2 E2 . E2 . E2 E2 . E2 E2 . A#2 .",
          drums:
          "k . k . ks . k . k . k . ks . k k | k . k . ks . k . k . k . ks . k k | " +
          "k . k . ks . k . k . k . ks . k k | k . k k ks . k k ks ks ks ks ks ks ks ks",
          hat:
          "h . h . h . h . h . h . h . h . | h . h . h . h . h . h . h . h . | " +
          "h . h . h . h . h . h . h . h . | h . h . h . h . h . h . h . h .",
          pad:
          "E4^037 - - - - - - - - - - - - - - - | C4^037 - - - - - - - - - - - - - - - | " +
          "F4^038 - - - - - - - - - - - - - - - | E4^06c - - - - - - - - - - - - - - -",
          lead:
          "E5 - - - G5 - - - A5 - - - B5 - - - | C6 - - - B5 - - - A5 - - - G5 - - - | " +
          "A5 - - - G5 - - - F5 - - - G5 - - - | F5 - - - G5 - - - A#5 - - - - - - -",
          crash:
          "o . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
        },
        C: {
          drone:
          "E1 - - - - - - - - - - - - - - - | C2 - - - - - - - - - - - - - - - | " +
          "F1 - - - - - - - - - - - - - - - | E1 - - - - - - - - - - - - - - -",
          chug:
          "E3 E3 . E3 E3 . E3 . E3 E3 . E3 E3 . E3 . | C3 C3 . C3 C3 . C3 . C3 C3 . C3 C3 . C3 . | " +
          "F3 F3 . F3 F3 . F3 . F3 F3 . F3 F3 . F3 . | E3 E3 . E3 E3 . E3 . E3 E3 . E3 E3 . A#3 .",
          drums:
          "k . k . ks . k . k . k . ks . k k | k . k . ks . k . k . k . ks . k k | " +
          "k . k . ks . k . k . k . ks . k k | k . k k ks . k k ks ks ks ks ks ks ks ks",
          hat:
          "h . h . h . h . h . h . h . h . | h . h . h . h . h . h . h . h . | " +
          "h . h . h . h . h . h . h . h . | h . h . h . h . h . h . h . h .",
          bell:
          "E3^06 - - - - - - - . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          pad:
          "E4^037 - - - - - - - - - - - - - - - | C4^037 - - - - - - - - - - - - - - - | " +
          "F4^038 - - - - - - - - - - - - - - - | E4^06c - - - - - - - - - - - - - - -",
          lead:
          "E6 - - - G6 - - - A6 - - - B6 - - - | C7 - - - B6 - - - A6 - - - G6 - - - | " +
          "A6 - - - G6 - - - F6 - - - G6 - - - | F6 - - - G6 - - - A#6 - - - - - - -",
          dbl:
          "k k k k k k k k k k k k k k k k | k k k k k k k k k k k k k k k k | " +
          "k k k k k k k k k k k k k k k k | k k k k k k k k k k k k k k k k",
          crash:
          "o . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          wail:
          "E5 - - - - - - - G5 - - - - - - - | C6 - - - - - - - B5 - - - - - - - | " +
          "A5 - - - - - - - F5 - - - - - - - | A#5 - - - - - - - - - - - - - - -",
        },
        D: {
          drone:
          "E1 - - - - - - - - - - - - - - - | C2 - - - - - - - - - - - - - - - | " +
          "F1 - - - - - - - - - - - - - - - | E1 - - - - - - - - - - - - - - -",
          chug:
          "E2 E2 . E2 E2 . E2 . E2 E2 . E2 E2 . E2 . | C2 C2 . C2 C2 . C2 . C2 C2 . C2 C2 . C2 . | " +
          "F2 F2 . F2 F2 . F2 . F2 F2 . F2 F2 . F2 . | E2 E2 . E2 E2 . E2 . E2 E2 . E2 E2 . A#2 .",
          drums:
          "k . k . ks . k . k . k . ks . k k | k . k . ks . k . k . k . ks . k k | " +
          "k . k . ks . k . k . k . ks . k k | k . k k ks . k k ks ks ks ks ks ks ks ks",
          hat:
          "h . h . h . h . h . h . h . h . | h . h . h . h . h . h . h . h . | " +
          "h . h . h . h . h . h . h . h . | h . h . h . h . h . h . h . h .",
          pad:
          "E4^037 - - - - - - - - - - - - - - - | C4^037 - - - - - - - - - - - - - - - | " +
          "F4^038 - - - - - - - - - - - - - - - | E4^06c - - - - - - - - - - - - - - -",
          lead:
          "E5 - - - G5 - - - A5 - - - B5 - - - | C6 - - - B5 - - - A5 - - - G5 - - - | " +
          "A5 - - - G5 - - - F5 - - - G5 - - - | F5 - - - G5 - - - A#5 - - - - - - -",
          dbl:
          "k k k k k k k k k k k k k k k k | k k k k k k k k k k k k k k k k | " +
          "k k k k k k k k k k k k k k k k | k k k k k k k k k k k k k k k k",
          crash:
          "o . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          wail:
          "E5 - - - - - - - G5 - - - - - - - | C6 - - - - - - - B5 - - - - - - - | " +
          "A5 - - - - - - - F5 - - - - - - - | A#5 - - - - - - - - - - - - - - -",
        },
      },
      order: ["A", "B", "A", "B", "C", "D"],
    },
  },
};
