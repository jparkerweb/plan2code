// Plan2Code Web Console - ghoul: Hollow End Village's own sound effects and music tracks, merged into ghoul-sfx.js; defines only.
//
// Same shape and rules as ghoul-sfx-graveyard.js: `tones` (the stage's
// monsters' and boss's `ghoul<Kind><Act>` sounds) and `music` (a track per
// room, named in ROOM_MUSIC in ghoul.js). A name may be defined only once
// across tones.js and every game's file. No imports.

export const VILLAGE_SFX = {
  tones: {
    // Hollow End Village's monsters, the Beast, the moon and Wolfsbane, picked by ear
    // (prototypes/sounds/ghoul-rush/village.html).
    // Torch Mob Villager: A neighbor with a grudge and a torch; it walks up in a group, lobs fire from afar, and at full moon turns into a leaping wolf-man.
    // Joins the mob: Grumbling crowd.
    ghoulVillagerAppear: {
      layers: [
        { type: "triangle", from: 86, to: 64, seconds: 0.8, attack: 0.25, gain: 0.45, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 1260, to: 810, q: 1 } },
        { type: "sine", from: 171, to: 128, seconds: 0.8, attack: 0.3, gain: 0.15 },
        { type: "pink", seconds: 0.8, attack: 0.3, gain: 0.13, filter: { type: "bandpass", from: 342, to: 257, q: 6 } },
        { type: "sawtooth", from: 124, to: 86, seconds: 0.16, attack: 0.01, gain: 0.9, vibrato: { rate: 5, depth: 0.1 }, filter: { type: "lowpass", from: 1430, to: 1430, q: 1 }, delay: 0.1 },
        { type: "brown", seconds: 0.13, attack: 0.01, gain: 0.6, filter: { type: "lowpass", from: 500, to: 500, q: 1 }, delay: 0.1 },
        { type: "sawtooth", from: 148, to: 103, seconds: 0.16, attack: 0.01, gain: 0.54, vibrato: { rate: 5, depth: 0.1 }, filter: { type: "lowpass", from: 1716, to: 1716, q: 1 }, delay: 0.35 },
        { type: "brown", seconds: 0.13, attack: 0.01, gain: 0.36, filter: { type: "lowpass", from: 600, to: 600, q: 1 }, delay: 0.35 },
      ],
    },
    // Winds up a torch: Rising growl.
    ghoulVillagerWind: {
      layers: [
        { type: "sawtooth", from: 76, to: 119, seconds: 0.5, attack: 0.12, gain: 0.72, vibrato: { rate: 5, depth: 0.07 }, filter: { type: "lowpass", from: 1300, to: 650, q: 5 } },
        { type: "sawtooth", from: 76, to: 118, seconds: 0.5, attack: 0.14, gain: 0.4, filter: { type: "lowpass", from: 1040, to: 520, q: 3 } },
        { type: "brown", seconds: 0.5, attack: 0.1, gain: 0.48, filter: { type: "bandpass", from: 380, to: 285, q: 2 } },
        { type: "noise", seconds: 0.35, attack: 0.06, gain: 0.24, filter: { type: "highpass", from: 2880, to: 6000, q: 1 }, delay: 0.1 },
        { type: "pink", seconds: 0.35, attack: 0.05, gain: 0.15, filter: { type: "bandpass", from: 3840, to: 2640, q: 2 }, delay: 0.1 },
      ],
    },
    // Throws the torch: Spit and sizzle.
    ghoulVillagerThrow: {
      layers: [
        { type: "noise", seconds: 0.1, attack: 0, gain: 0.64, filter: { type: "highpass", from: 1980, to: 1980, q: 1 } },
        { type: "sine", from: 770, to: 165, seconds: 0.16, delay: 0.02, gain: 0.48 },
        { type: "brown", seconds: 0.12, attack: 0, gain: 0.4, filter: { type: "lowpass", from: 462, to: 462, q: 1 } },
        { type: "noise", seconds: 0.5, attack: 0.06, gain: 0.4, filter: { type: "highpass", from: 3360, to: 7000, q: 1 }, delay: 0.05 },
        { type: "pink", seconds: 0.5, attack: 0.05, gain: 0.25, filter: { type: "bandpass", from: 4480, to: 3080, q: 2 }, delay: 0.05 },
      ],
    },
    // Torch lands: Splash of oil.
    ghoulVillagerLand: {
      layers: [
        { type: "noise", seconds: 0.28, attack: 0, gain: 0.63, filter: { type: "lowpass", from: 2340, to: 180, q: 1 } },
        { type: "square", from: 126, to: 36, seconds: 0.16, attack: 0, gain: 0.35, filter: { type: "lowpass", from: 540, to: 540, q: 1 } },
        { type: "sine", from: 810, to: 1170, seconds: 0.05, delay: 0.2, gain: 0.18 },
        { type: "sine", from: 684, to: 990, seconds: 0.05, delay: 0.34, gain: 0.13 },
        { type: "noise", seconds: 0.5, attack: 0.06, gain: 0.4, filter: { type: "highpass", from: 2880, to: 6000, q: 1 }, delay: 0.1 },
        { type: "pink", seconds: 0.5, attack: 0.05, gain: 0.25, filter: { type: "bandpass", from: 3840, to: 2640, q: 2 }, delay: 0.1 },
      ],
    },
    // Turns: Stretching growl.
    ghoulVillagerTurn: {
      layers: [
        { type: "sawtooth", from: 53, to: 83, seconds: 0.8, attack: 0.12, gain: 0.9, vibrato: { rate: 5, depth: 0.07 }, filter: { type: "lowpass", from: 1300, to: 650, q: 5 } },
        { type: "sawtooth", from: 54, to: 83, seconds: 0.8, attack: 0.14, gain: 0.5, filter: { type: "lowpass", from: 1040, to: 520, q: 3 } },
        { type: "brown", seconds: 0.8, attack: 0.1, gain: 0.6, filter: { type: "bandpass", from: 266, to: 200, q: 2 } },
        { type: "sawtooth", from: 182, to: 137, seconds: 0.4, attack: 0.03, gain: 0.63, vibrato: { rate: 7.5, depth: 0.2 }, filter: { type: "bandpass", from: 1026, to: 570, q: 3 }, delay: 0.4 },
        { type: "noise", seconds: 0.36, attack: 0.02, gain: 0.35, filter: { type: "bandpass", from: 1920, to: 840, q: 1.5 }, delay: 0.4 },
        { type: "square", from: 91, to: 80, seconds: 0.4, attack: 0.03, gain: 0.24, filter: { type: "lowpass", from: 600, to: 600, q: 1 }, delay: 0.4 },
      ],
    },
    // Wolf-man leaps: Barking roar.
    ghoulVillagerWolf: {
      layers: [
        { type: "sawtooth", from: 94, to: 120, seconds: 0.18, attack: 0.05, gain: 0.9, vibrato: { rate: 5, depth: 0.1 }, filter: { type: "lowpass", from: 300, to: 2860, q: 4 } },
        { type: "sawtooth", from: 120, to: 73, seconds: 0.35, delay: 0.15, attack: 0.02, gain: 0.9, vibrato: { rate: 5, depth: 0.12 }, filter: { type: "lowpass", from: 2860, to: 260, q: 4 } },
        { type: "sawtooth", from: 52, to: 38, seconds: 0.5, attack: 0.08, gain: 0.6, filter: { type: "lowpass", from: 500, to: 500, q: 1 } },
        { type: "brown", seconds: 0.5, attack: 0.06, gain: 0.8, filter: { type: "lowpass", from: 900, to: 180, q: 1 } },
        { type: "sine", from: 52, to: 37, seconds: 0.5, attack: 0.05, gain: 0.7 },
        { type: "sawtooth", from: 400, to: 240, seconds: 0.2, attack: 0.01, gain: 0.32, vibrato: { rate: 10, depth: 0.03 }, filter: { type: "bandpass", from: 800, to: 640, q: 2 }, delay: 0.1 },
        { type: "sawtooth", from: 360, to: 200, seconds: 0.26, delay: 0.27, attack: 0.01, gain: 0.22, filter: { type: "bandpass", from: 720, to: 480, q: 2 } },
      ],
    },
    // Takes a bolt: Wet thump.
    ghoulVillagerHurt: {
      layers: [
        { type: "brown", seconds: 0.3, attack: 0.01, gain: 0.6, filter: { type: "lowpass", from: 1170, to: 135, q: 1 } },
        { type: "sine", from: 234, to: 54, seconds: 0.22, attack: 0.01, gain: 0.42 },
        { type: "noise", seconds: 0.12, attack: 0.01, gain: 0.24, filter: { type: "bandpass", from: 810, to: 270, q: 3 } },
        { type: "sawtooth", from: 124, to: 86, seconds: 0.16, attack: 0.01, gain: 0.54, vibrato: { rate: 5, depth: 0.1 }, filter: { type: "lowpass", from: 1430, to: 1430, q: 1 }, delay: 0.05 },
        { type: "brown", seconds: 0.13, attack: 0.01, gain: 0.36, filter: { type: "lowpass", from: 500, to: 500, q: 1 }, delay: 0.05 },
      ],
    },
    // Dies: Rattling breath out.
    ghoulVillagerDie: {
      layers: [
        { type: "sine", from: 133, to: 100, seconds: 0.7, attack: 0.05, gain: 0.9, vibrato: { rate: 15, depth: 0.4 } },
        { type: "brown", seconds: 0.7, attack: 0.05, gain: 0.7, filter: { type: "lowpass", from: 700, to: 300, q: 1 } },
        { type: "sine", from: 200, to: 160, seconds: 0.49, delay: 0.11, attack: 0.03, gain: 0.4, vibrato: { rate: 9, depth: 0.5 } },
        { type: "sine", from: 110, to: 40, seconds: 0.25, attack: 0, gain: 0.8, delay: 0.7 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.64, filter: { type: "lowpass", from: 320, to: 320, q: 1 }, delay: 0.7 },
      ],
    },
    // Hanged Man: Sways from a beam on a rope; walk under him and he drops to your head, snaps, and is hauled back up like a yo-yo.
    // Swings into view: Slow creaking rope.
    ghoulHangedAppear: {
      layers: [
        { type: "sine", from: 220, to: 286, seconds: 0.08, attack: 0.01, gain: 0.48, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 264, to: 341, seconds: 0.07, delay: 0.1, attack: 0.01, gain: 0.36, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 200, to: 260, seconds: 0.08, attack: 0.01, gain: 0.4, vibrato: { rate: 40, depth: 0.08 }, delay: 0.35 },
        { type: "sine", from: 240, to: 310, seconds: 0.07, delay: 0.45, attack: 0.01, gain: 0.3, vibrato: { rate: 40, depth: 0.08 } },
        { type: "triangle", from: 49, to: 37, seconds: 0.9, attack: 0.25, gain: 0.36, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 980, to: 630, q: 1 } },
        { type: "sine", from: 98, to: 74, seconds: 0.9, attack: 0.3, gain: 0.12 },
        { type: "pink", seconds: 0.9, attack: 0.3, gain: 0.1, filter: { type: "bandpass", from: 196, to: 147, q: 6 } },
      ],
    },
    // Rope creaks: Gallows groan.
    ghoulHangedWarn: {
      layers: [
        { type: "sawtooth", from: 39, to: 61, seconds: 0.4, attack: 0.12, gain: 0.9, vibrato: { rate: 4, depth: 0.07 }, filter: { type: "lowpass", from: 800, to: 400, q: 5 } },
        { type: "sawtooth", from: 39, to: 61, seconds: 0.4, attack: 0.14, gain: 0.5, filter: { type: "lowpass", from: 640, to: 320, q: 3 } },
        { type: "brown", seconds: 0.4, attack: 0.1, gain: 0.6, filter: { type: "bandpass", from: 196, to: 147, q: 2 } },
        { type: "sine", from: 380, to: 494, seconds: 0.08, attack: 0.01, gain: 0.4, vibrato: { rate: 40, depth: 0.08 }, delay: 0.05 },
        { type: "sine", from: 456, to: 589, seconds: 0.07, delay: 0.15, attack: 0.01, gain: 0.3, vibrato: { rate: 40, depth: 0.08 } },
      ],
    },
    // Drops: Swooping groan.
    ghoulHangedDrop: {
      layers: [
        { type: "sawtooth", from: 600, to: 360, seconds: 0.35, attack: 0.03, gain: 0.4, vibrato: { rate: 12, depth: 0.04 }, filter: { type: "bandpass", from: 1200, to: 1440, q: 4 } },
        { type: "sawtooth", from: 900, to: 540, seconds: 0.32, attack: 0.04, gain: 0.18, filter: { type: "bandpass", from: 1800, to: 1800, q: 5 } },
        { type: "noise", seconds: 0.28, attack: 0.03, gain: 0.15, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
        { type: "sawtooth", from: 62, to: 44, seconds: 0.4, attack: 0.12, gain: 0.54, vibrato: { rate: 4, depth: 0.07 }, filter: { type: "lowpass", from: 800, to: 400, q: 5 } },
        { type: "sawtooth", from: 62, to: 43, seconds: 0.4, attack: 0.14, gain: 0.3, filter: { type: "lowpass", from: 640, to: 320, q: 3 } },
        { type: "brown", seconds: 0.4, attack: 0.1, gain: 0.36, filter: { type: "bandpass", from: 224, to: 168, q: 2 } },
      ],
    },
    // Rope snaps taut: Twang and crack.
    ghoulHangedSnap: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1620, to: 1080, q: 2 } },
        { type: "square", from: 810, to: 270, seconds: 0.05, attack: 0, gain: 0.36 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.63, filter: { type: "bandpass", from: 2340, to: 1620, q: 3 } },
        { type: "sine", from: 320, to: 416, seconds: 0.08, attack: 0.01, gain: 0.4, vibrato: { rate: 40, depth: 0.08 }, delay: 0.04 },
        { type: "sine", from: 384, to: 496, seconds: 0.07, delay: 0.14, attack: 0.01, gain: 0.3, vibrato: { rate: 40, depth: 0.08 } },
      ],
    },
    // Hauled back up: Rope winch.
    ghoulHangedHaul: {
      layers: [
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1488, to: 1190, q: 6 } },
        { type: "square", from: 612, to: 375, seconds: 0.02, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.05, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1717, to: 1374, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.14, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1957, to: 1566, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.2, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1490, to: 1192, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.29, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2094, to: 1675, q: 6 } },
        { type: "square", from: 603, to: 470, seconds: 0.02, delay: 0.29, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.37, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1977, to: 1582, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.48, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1971, to: 1576, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.59, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2392, to: 1914, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.71, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1807, to: 1446, q: 6 } },
        { type: "square", from: 434, to: 392, seconds: 0.02, delay: 0.71, gain: 0.3 },
      ],
    },
    // Takes a bolt: Rope jolt.
    ghoulHangedHurt: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.6, filter: { type: "bandpass", from: 1440, to: 960, q: 2 } },
        { type: "square", from: 720, to: 240, seconds: 0.05, attack: 0, gain: 0.24 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.42, filter: { type: "bandpass", from: 2080, to: 1440, q: 3 } },
        { type: "sawtooth", from: 54, to: 38, seconds: 0.3, attack: 0.12, gain: 0.45, vibrato: { rate: 4, depth: 0.07 }, filter: { type: "lowpass", from: 800, to: 400, q: 5 }, delay: 0.05 },
        { type: "sawtooth", from: 54, to: 38, seconds: 0.3, attack: 0.14, gain: 0.25, filter: { type: "lowpass", from: 640, to: 320, q: 3 }, delay: 0.05 },
        { type: "brown", seconds: 0.3, attack: 0.1, gain: 0.3, filter: { type: "bandpass", from: 196, to: 147, q: 2 }, delay: 0.05 },
      ],
    },
    // Dies: Free at last.
    ghoulHangedDie: {
      layers: [
        { type: "sine", notes: [440, 370, 295, 220], seconds: 0.9, attack: 0.02, gain: 0.36, vibrato: { rate: 7, depth: 0.02 } },
        { type: "triangle", notes: [660, 554, 440, 330], seconds: 0.9, attack: 0.02, gain: 0.15 },
        { type: "triangle", from: 49, to: 37, seconds: 0.8, attack: 0.25, gain: 0.45, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 980, to: 630, q: 1 } },
        { type: "sine", from: 98, to: 74, seconds: 0.8, attack: 0.3, gain: 0.15 },
        { type: "pink", seconds: 0.8, attack: 0.3, gain: 0.13, filter: { type: "bandpass", from: 196, to: 147, q: 6 } },
      ],
    },
    // Shutter Ghoul: Hides behind a window's shutters; they rattle when you come near, then it lunges out at you and pulls back in.
    // Peeks out: Dry giggle.
    ghoulShutterAppear: {
      layers: [
        { type: "sawtooth", from: 600, to: 480, seconds: 0.09, attack: 0.01, gain: 0.35, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 1500, to: 1200, q: 3 } },
        { type: "sawtooth", from: 570, to: 456, seconds: 0.09, delay: 0.1, attack: 0.01, gain: 0.35, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 1425, to: 1140, q: 3 } },
        { type: "sawtooth", from: 540, to: 432, seconds: 0.09, delay: 0.2, attack: 0.01, gain: 0.35, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 1350, to: 1080, q: 3 } },
        { type: "sawtooth", from: 510, to: 408, seconds: 0.09, delay: 0.3, attack: 0.01, gain: 0.35, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 1275, to: 1020, q: 3 } },
        { type: "sine", from: 800, to: 1040, seconds: 0.08, attack: 0.01, gain: 0.24, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 960, to: 1240, seconds: 0.07, delay: 0.1, attack: 0.01, gain: 0.18, vibrato: { rate: 40, depth: 0.08 } },
      ],
    },
    // Shutters rattle: Wooden clatter.
    ghoulShutterRattle: {
      layers: [
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 3281, to: 2625, q: 6 } },
        { type: "square", from: 806, to: 470, seconds: 0.02, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.03, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2290, to: 1832, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.07, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 3128, to: 2503, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.12, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2854, to: 2283, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.16, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2845, to: 2276, q: 6 } },
        { type: "square", from: 788, to: 632, seconds: 0.02, delay: 0.16, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.19, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2307, to: 1846, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.24, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2276, to: 1821, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.28, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2439, to: 1951, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.31, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2291, to: 1833, q: 6 } },
        { type: "square", from: 675, to: 582, seconds: 0.02, delay: 0.31, gain: 0.3 },
      ],
    },
    // Lunges out: Hiss and strike.
    ghoulShutterLunge: {
      layers: [
        { type: "noise", seconds: 0.25, attack: 0.06, gain: 0.56, filter: { type: "highpass", from: 2400, to: 5000, q: 1 } },
        { type: "pink", seconds: 0.25, attack: 0.05, gain: 0.35, filter: { type: "bandpass", from: 3200, to: 2200, q: 2 } },
        { type: "noise", seconds: 0.5, attack: 0, gain: 0.6, filter: { type: "lowpass", from: 5880, to: 210, q: 1 }, delay: 0.12 },
        { type: "sine", from: 224, to: 49, seconds: 0.4, attack: 0, gain: 0.54, delay: 0.12 },
        { type: "brown", seconds: 0.6, attack: 0.01, gain: 0.42, filter: { type: "lowpass", from: 560, to: 560, q: 1 }, delay: 0.12 },
        { type: "sawtooth", from: 900, to: 540, seconds: 0.2, attack: 0.01, gain: 0.24, vibrato: { rate: 10, depth: 0.03 }, filter: { type: "bandpass", from: 1800, to: 1440, q: 2 }, delay: 0.1 },
        { type: "sawtooth", from: 810, to: 450, seconds: 0.26, delay: 0.27, attack: 0.01, gain: 0.17, filter: { type: "bandpass", from: 1620, to: 1080, q: 2 } },
      ],
    },
    // Pulls back in: Sneaky giggle.
    ghoulShutterPull: {
      layers: [
        { type: "sawtooth", from: 600, to: 480, seconds: 0.09, attack: 0.01, gain: 0.35, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 1500, to: 1200, q: 3 } },
        { type: "sawtooth", from: 570, to: 456, seconds: 0.09, delay: 0.09, attack: 0.01, gain: 0.35, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 1425, to: 1140, q: 3 } },
        { type: "sawtooth", from: 540, to: 432, seconds: 0.09, delay: 0.18, attack: 0.01, gain: 0.35, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 1350, to: 1080, q: 3 } },
        { type: "triangle", from: 300, to: 255, seconds: 0.22, attack: 0, gain: 0.54, delay: 0.3 },
        { type: "sine", from: 810, to: 750, seconds: 0.12, attack: 0, gain: 0.21, delay: 0.3 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.3, filter: { type: "bandpass", from: 1200, to: 1200, q: 2 }, delay: 0.3 },
      ],
    },
    // Takes a bolt: Sharp hiss.
    ghoulShutterHurt: {
      layers: [
        { type: "noise", seconds: 0.25, attack: 0.06, gain: 0.56, filter: { type: "highpass", from: 2880, to: 6000, q: 1 } },
        { type: "pink", seconds: 0.25, attack: 0.05, gain: 0.35, filter: { type: "bandpass", from: 3840, to: 2640, q: 2 } },
        { type: "sawtooth", from: 800, to: 480, seconds: 0.2, attack: 0.01, gain: 0.4, vibrato: { rate: 10, depth: 0.03 }, filter: { type: "bandpass", from: 1600, to: 1280, q: 2 }, delay: 0.04 },
        { type: "sawtooth", from: 720, to: 400, seconds: 0.26, delay: 0.21, attack: 0.01, gain: 0.28, filter: { type: "bandpass", from: 1440, to: 960, q: 2 } },
      ],
    },
    // Dies: Shriek and slump.
    ghoulShutterDie: {
      layers: [
        { type: "sawtooth", from: 1000, to: 600, seconds: 0.45, attack: 0.03, gain: 0.48, vibrato: { rate: 12, depth: 0.04 }, filter: { type: "bandpass", from: 2000, to: 2400, q: 4 } },
        { type: "sawtooth", from: 1500, to: 900, seconds: 0.41, attack: 0.04, gain: 0.21, filter: { type: "bandpass", from: 3000, to: 3000, q: 5 } },
        { type: "noise", seconds: 0.36, attack: 0.03, gain: 0.18, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
        { type: "sine", from: 110, to: 40, seconds: 0.25, attack: 0, gain: 0.7, delay: 0.45 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.56, filter: { type: "lowpass", from: 320, to: 320, q: 1 }, delay: 0.45 },
      ],
    },
    // Moonhound: The village's hunting hound, mad with the moon; it growls, leaps, swells at full moon and slinks away from Wolfsbane.
    // Slinks in: Sniff and snort.
    ghoulMoonhoundAppear: {
      layers: [
        { type: "noise", seconds: 0.22, attack: 0.15, gain: 0.7, filter: { type: "bandpass", from: 1320, to: 2880, q: 4 } },
        { type: "sawtooth", from: 264, to: 343, seconds: 0.2, attack: 0.14, gain: 0.25, filter: { type: "lowpass", from: 1680, to: 1680, q: 1 } },
        { type: "noise", seconds: 0.22, attack: 0.15, gain: 0.49, filter: { type: "bandpass", from: 1540, to: 3360, q: 4 }, delay: 0.25 },
        { type: "sawtooth", from: 308, to: 400, seconds: 0.2, attack: 0.14, gain: 0.18, filter: { type: "lowpass", from: 1960, to: 1960, q: 1 }, delay: 0.25 },
        { type: "sawtooth", from: 157, to: 109, seconds: 0.16, attack: 0.01, gain: 0.45, vibrato: { rate: 8, depth: 0.1 }, filter: { type: "lowpass", from: 1936, to: 1936, q: 1 }, delay: 0.5 },
        { type: "brown", seconds: 0.13, attack: 0.01, gain: 0.3, filter: { type: "lowpass", from: 550, to: 550, q: 1 }, delay: 0.5 },
      ],
    },
    // Growls: Building growl.
    ghoulMoonhoundGrowl: {
      layers: [
        { type: "sawtooth", from: 88, to: 138, seconds: 0.6, attack: 0.12, gain: 0.72, vibrato: { rate: 8, depth: 0.07 }, filter: { type: "lowpass", from: 1600, to: 800, q: 5 } },
        { type: "sawtooth", from: 89, to: 137, seconds: 0.6, attack: 0.14, gain: 0.4, filter: { type: "lowpass", from: 1280, to: 640, q: 3 } },
        { type: "brown", seconds: 0.6, attack: 0.1, gain: 0.48, filter: { type: "bandpass", from: 440, to: 330, q: 2 } },
        { type: "sawtooth", from: 176, to: 132, seconds: 0.3, attack: 0.03, gain: 0.54, vibrato: { rate: 12, depth: 0.2 }, filter: { type: "bandpass", from: 990, to: 550, q: 3 }, delay: 0.25 },
        { type: "noise", seconds: 0.27, attack: 0.02, gain: 0.3, filter: { type: "bandpass", from: 1600, to: 700, q: 1.5 }, delay: 0.25 },
        { type: "square", from: 88, to: 77, seconds: 0.3, attack: 0.03, gain: 0.21, filter: { type: "lowpass", from: 500, to: 500, q: 1 }, delay: 0.25 },
      ],
    },
    // Leaps: Gaping roar.
    ghoulMoonhoundLunge: {
      layers: [
        { type: "sawtooth", from: 119, to: 152, seconds: 0.16, attack: 0.05, gain: 0.9, vibrato: { rate: 8, depth: 0.1 }, filter: { type: "lowpass", from: 300, to: 3520, q: 4 } },
        { type: "sawtooth", from: 152, to: 92, seconds: 0.32, delay: 0.14, attack: 0.02, gain: 0.9, vibrato: { rate: 8, depth: 0.12 }, filter: { type: "lowpass", from: 3520, to: 260, q: 4 } },
        { type: "sawtooth", from: 66, to: 48, seconds: 0.45, attack: 0.08, gain: 0.6, filter: { type: "lowpass", from: 500, to: 500, q: 1 } },
        { type: "brown", seconds: 0.45, attack: 0.06, gain: 0.8, filter: { type: "lowpass", from: 900, to: 180, q: 1 } },
        { type: "sine", from: 66, to: 46, seconds: 0.45, attack: 0.05, gain: 0.7 },
        { type: "sine", from: 110, to: 40, seconds: 0.25, attack: 0, gain: 0.5, delay: 0.35 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.4, filter: { type: "lowpass", from: 320, to: 320, q: 1 }, delay: 0.35 },
      ],
    },
    // Grows: Swelling roar.
    ghoulMoonhoundGrow: {
      layers: [
        { type: "sawtooth", from: 69, to: 89, seconds: 0.32, attack: 0.05, gain: 0.72, vibrato: { rate: 8, depth: 0.1 }, filter: { type: "lowpass", from: 300, to: 3520, q: 4 } },
        { type: "sawtooth", from: 89, to: 54, seconds: 0.63, delay: 0.27, attack: 0.02, gain: 0.72, vibrato: { rate: 8, depth: 0.12 }, filter: { type: "lowpass", from: 3520, to: 260, q: 4 } },
        { type: "sawtooth", from: 39, to: 28, seconds: 0.9, attack: 0.08, gain: 0.48, filter: { type: "lowpass", from: 500, to: 500, q: 1 } },
        { type: "brown", seconds: 0.9, attack: 0.06, gain: 0.64, filter: { type: "lowpass", from: 900, to: 180, q: 1 } },
        { type: "sine", from: 39, to: 27, seconds: 0.9, attack: 0.05, gain: 0.56 },
        { type: "brown", seconds: 0.9, attack: 0.08, gain: 0.5, filter: { type: "lowpass", from: 180, to: 70, q: 1 } },
        { type: "sine", from: 48, to: 30, seconds: 0.9, attack: 0.05, gain: 0.4 },
      ],
    },
    // Backs off: Frightened whine.
    ghoulMoonhoundShy: {
      layers: [
        { type: "triangle", from: 220, to: 165, seconds: 0.5, attack: 0.25, gain: 0.54, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 2800, to: 1800, q: 1 } },
        { type: "sine", from: 440, to: 330, seconds: 0.5, attack: 0.3, gain: 0.18 },
        { type: "pink", seconds: 0.5, attack: 0.3, gain: 0.15, filter: { type: "bandpass", from: 880, to: 660, q: 6 } },
        { type: "sawtooth", from: 700, to: 420, seconds: 0.2, attack: 0.01, gain: 0.32, vibrato: { rate: 10, depth: 0.03 }, filter: { type: "bandpass", from: 1400, to: 1120, q: 2 }, delay: 0.1 },
        { type: "sawtooth", from: 630, to: 350, seconds: 0.26, delay: 0.27, attack: 0.01, gain: 0.22, filter: { type: "bandpass", from: 1260, to: 840, q: 2 } },
      ],
    },
    // Takes a bolt: Gnashing bite.
    ghoulMoonhoundHurt: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.6, filter: { type: "bandpass", from: 2520, to: 1680, q: 2 } },
        { type: "square", from: 1260, to: 420, seconds: 0.05, attack: 0, gain: 0.24 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.42, filter: { type: "bandpass", from: 3640, to: 2520, q: 3 } },
        { type: "sawtooth", from: 194, to: 145, seconds: 0.25, attack: 0.03, gain: 0.54, vibrato: { rate: 12, depth: 0.2 }, filter: { type: "bandpass", from: 1089, to: 605, q: 3 }, delay: 0.05 },
        { type: "noise", seconds: 0.23, attack: 0.02, gain: 0.3, filter: { type: "bandpass", from: 1760, to: 770, q: 1.5 }, delay: 0.05 },
        { type: "square", from: 97, to: 85, seconds: 0.25, attack: 0.03, gain: 0.21, filter: { type: "lowpass", from: 550, to: 550, q: 1 }, delay: 0.05 },
      ],
    },
    // Dies: Gurgling snarl.
    ghoulMoonhoundDie: {
      layers: [
        { type: "sawtooth", from: 158, to: 119, seconds: 0.4, attack: 0.03, gain: 0.9, vibrato: { rate: 12, depth: 0.2 }, filter: { type: "bandpass", from: 891, to: 495, q: 3 } },
        { type: "noise", seconds: 0.36, attack: 0.02, gain: 0.5, filter: { type: "bandpass", from: 1440, to: 630, q: 1.5 } },
        { type: "square", from: 79, to: 69, seconds: 0.4, attack: 0.03, gain: 0.35, filter: { type: "lowpass", from: 450, to: 450, q: 1 } },
        { type: "sine", from: 198, to: 149, seconds: 0.6, attack: 0.05, gain: 0.63, vibrato: { rate: 15, depth: 0.4 }, delay: 0.2 },
        { type: "brown", seconds: 0.6, attack: 0.05, gain: 0.49, filter: { type: "lowpass", from: 700, to: 300, q: 1 }, delay: 0.2 },
        { type: "sine", from: 297, to: 238, seconds: 0.42, delay: 0.29, attack: 0.03, gain: 0.28, vibrato: { rate: 9, depth: 0.5 } },
        { type: "sine", from: 110, to: 40, seconds: 0.25, attack: 0, gain: 0.6, delay: 0.8 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.48, filter: { type: "lowpass", from: 320, to: 320, q: 1 }, delay: 0.8 },
      ],
    },
    // The Beast of Hollow End: The thing the village feared at the inn: it bounds up the walls, clings, and pounces where you stand; shoot it while it clings.
    // Wakes: Slow sniff, bellow.
    ghoulBeastWake: {
      layers: [
        { type: "noise", seconds: 0.22, attack: 0.15, gain: 0.7, filter: { type: "bandpass", from: 550, to: 1200, q: 4 } },
        { type: "sawtooth", from: 55, to: 72, seconds: 0.2, attack: 0.14, gain: 0.25, filter: { type: "lowpass", from: 700, to: 700, q: 1 } },
        { type: "sawtooth", from: 31, to: 48, seconds: 0.7, attack: 0.12, gain: 0.9, vibrato: { rate: 4, depth: 0.07 }, filter: { type: "lowpass", from: 1000, to: 500, q: 5 }, delay: 0.2 },
        { type: "sawtooth", from: 31, to: 48, seconds: 0.7, attack: 0.14, gain: 0.5, filter: { type: "lowpass", from: 800, to: 400, q: 3 }, delay: 0.2 },
        { type: "brown", seconds: 0.7, attack: 0.1, gain: 0.6, filter: { type: "bandpass", from: 154, to: 116, q: 2 }, delay: 0.2 },
        { type: "sawtooth", from: 40, to: 51, seconds: 0.18, attack: 0.05, gain: 0.54, vibrato: { rate: 4, depth: 0.1 }, filter: { type: "lowpass", from: 300, to: 2200, q: 4 }, delay: 0.6 },
        { type: "sawtooth", from: 51, to: 31, seconds: 0.35, delay: 0.75, attack: 0.02, gain: 0.54, vibrato: { rate: 4, depth: 0.12 }, filter: { type: "lowpass", from: 2200, to: 260, q: 4 } },
        { type: "sawtooth", from: 22, to: 20, seconds: 0.5, attack: 0.08, gain: 0.36, filter: { type: "lowpass", from: 500, to: 500, q: 1 }, delay: 0.6 },
        { type: "brown", seconds: 0.5, attack: 0.06, gain: 0.48, filter: { type: "lowpass", from: 900, to: 180, q: 1 }, delay: 0.6 },
        { type: "sine", from: 22, to: 20, seconds: 0.5, attack: 0.05, gain: 0.42, delay: 0.6 },
      ],
    },
    // Bounds at the wall: Roaring leap.
    ghoulBeastLeap: {
      layers: [
        { type: "sawtooth", from: 54, to: 70, seconds: 0.18, attack: 0.05, gain: 0.9, vibrato: { rate: 4, depth: 0.1 }, filter: { type: "lowpass", from: 300, to: 2200, q: 4 } },
        { type: "sawtooth", from: 70, to: 42, seconds: 0.35, delay: 0.15, attack: 0.02, gain: 0.9, vibrato: { rate: 4, depth: 0.12 }, filter: { type: "lowpass", from: 2200, to: 260, q: 4 } },
        { type: "sawtooth", from: 30, to: 22, seconds: 0.5, attack: 0.08, gain: 0.6, filter: { type: "lowpass", from: 500, to: 500, q: 1 } },
        { type: "brown", seconds: 0.5, attack: 0.06, gain: 0.8, filter: { type: "lowpass", from: 900, to: 180, q: 1 } },
        { type: "sine", from: 30, to: 21, seconds: 0.5, attack: 0.05, gain: 0.7 },
        { type: "noise", seconds: 0.4, attack: 0.14, gain: 0.4, filter: { type: "bandpass", from: 330, to: 1980, q: 1.5 }, delay: 0.1 },
      ],
    },
    // Claws into the wall: Panting hold.
    ghoulBeastCling: {
      layers: [
        { type: "sine", from: 110, to: 40, seconds: 0.25, attack: 0, gain: 0.7 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.56, filter: { type: "lowpass", from: 320, to: 320, q: 1 } },
        { type: "noise", seconds: 0.35, attack: 0.06, gain: 0.4, filter: { type: "highpass", from: 1680, to: 3500, q: 1 }, delay: 0.1 },
        { type: "pink", seconds: 0.35, attack: 0.05, gain: 0.25, filter: { type: "bandpass", from: 2240, to: 1540, q: 2 }, delay: 0.1 },
        { type: "noise", seconds: 0.35, attack: 0.06, gain: 0.4, filter: { type: "highpass", from: 1680, to: 3500, q: 1 }, delay: 0.45 },
        { type: "pink", seconds: 0.35, attack: 0.05, gain: 0.25, filter: { type: "bandpass", from: 2240, to: 1540, q: 2 }, delay: 0.45 },
      ],
    },
    // Pounces: Bellowing plunge.
    ghoulBeastPounce: {
      layers: [
        { type: "sawtooth", from: 73, to: 51, seconds: 0.6, attack: 0.12, gain: 0.81, vibrato: { rate: 4, depth: 0.07 }, filter: { type: "lowpass", from: 1000, to: 500, q: 5 } },
        { type: "sawtooth", from: 73, to: 51, seconds: 0.6, attack: 0.14, gain: 0.45, filter: { type: "lowpass", from: 800, to: 400, q: 3 } },
        { type: "brown", seconds: 0.6, attack: 0.1, gain: 0.54, filter: { type: "bandpass", from: 264, to: 198, q: 2 } },
        { type: "noise", seconds: 0.5, attack: 0.18, gain: 0.56, filter: { type: "bandpass", from: 450, to: 2700, q: 1.5 }, delay: 0.05 },
        { type: "sawtooth", from: 107, to: 74, seconds: 0.16, attack: 0.01, gain: 0.36, vibrato: { rate: 4, depth: 0.1 }, filter: { type: "lowpass", from: 1650, to: 1650, q: 1 }, delay: 0.1 },
        { type: "brown", seconds: 0.13, attack: 0.01, gain: 0.24, filter: { type: "lowpass", from: 750, to: 750, q: 1 }, delay: 0.1 },
      ],
    },
    // Lands: Earthquake slam.
    ghoulBeastLand: {
      layers: [
        { type: "sine", from: 66, to: 24, seconds: 0.25, attack: 0, gain: 1 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.8, filter: { type: "lowpass", from: 192, to: 192, q: 1 } },
        { type: "brown", seconds: 0.9, attack: 0.08, gain: 0.8, filter: { type: "lowpass", from: 180, to: 70, q: 1 }, delay: 0.03 },
        { type: "sine", from: 48, to: 30, seconds: 0.9, attack: 0.05, gain: 0.64, delay: 0.03 },
      ],
    },
    // Winds up a swipe: Rising growl.
    ghoulBeastSwipeWind: {
      layers: [
        { type: "sawtooth", from: 40, to: 62, seconds: 0.45, attack: 0.12, gain: 0.72, vibrato: { rate: 4, depth: 0.07 }, filter: { type: "lowpass", from: 1000, to: 500, q: 5 } },
        { type: "sawtooth", from: 40, to: 62, seconds: 0.45, attack: 0.14, gain: 0.4, filter: { type: "lowpass", from: 800, to: 400, q: 3 } },
        { type: "brown", seconds: 0.45, attack: 0.1, gain: 0.48, filter: { type: "bandpass", from: 198, to: 149, q: 2 } },
        { type: "noise", seconds: 0.3, attack: 0.06, gain: 0.24, filter: { type: "highpass", from: 1680, to: 3500, q: 1 }, delay: 0.1 },
        { type: "pink", seconds: 0.3, attack: 0.05, gain: 0.15, filter: { type: "bandpass", from: 2240, to: 1540, q: 2 }, delay: 0.1 },
      ],
    },
    // Claw swipe: Roar and rake.
    ghoulBeastSwipe: {
      layers: [
        { type: "sawtooth", from: 50, to: 63, seconds: 0.14, attack: 0.05, gain: 0.72, vibrato: { rate: 4, depth: 0.1 }, filter: { type: "lowpass", from: 300, to: 2200, q: 4 } },
        { type: "sawtooth", from: 63, to: 39, seconds: 0.28, delay: 0.12, attack: 0.02, gain: 0.72, vibrato: { rate: 4, depth: 0.12 }, filter: { type: "lowpass", from: 2200, to: 260, q: 4 } },
        { type: "sawtooth", from: 28, to: 20, seconds: 0.4, attack: 0.08, gain: 0.48, filter: { type: "lowpass", from: 500, to: 500, q: 1 } },
        { type: "brown", seconds: 0.4, attack: 0.06, gain: 0.64, filter: { type: "lowpass", from: 900, to: 180, q: 1 } },
        { type: "sine", from: 28, to: 20, seconds: 0.4, attack: 0.05, gain: 0.56 },
        { type: "noise", seconds: 0.3, attack: 0.11, gain: 0.48, filter: { type: "bandpass", from: 480, to: 2880, q: 1.5 } },
      ],
    },
    // Howls: Anguished wail.
    ghoulBeastHowl: {
      layers: [
        { type: "sine", from: 200, to: 300, seconds: 0.44, attack: 0.15, gain: 0.64, vibrato: { rate: 6, depth: 0.04 } },
        { type: "sine", from: 300, to: 140, seconds: 0.65, delay: 0.4, attack: 0.04, gain: 0.64, vibrato: { rate: 6, depth: 0.05 } },
        { type: "triangle", from: 402, to: 280, seconds: 1.05, attack: 0.3, gain: 0.16 },
        { type: "pink", seconds: 1.05, attack: 0.3, gain: 0.16, filter: { type: "bandpass", from: 400, to: 400, q: 8 } },
        { type: "sawtooth", from: 215, to: 300, seconds: 0.41, attack: 0.1, gain: 0.28, vibrato: { rate: 6, depth: 0.03 }, filter: { type: "bandpass", from: 501, to: 644, q: 3 }, delay: 0.1 },
        { type: "sawtooth", from: 300, to: 186, seconds: 0.54, delay: 0.48, attack: 0.03, gain: 0.28, vibrato: { rate: 6, depth: 0.04 }, filter: { type: "bandpass", from: 644, to: 358, q: 3 } },
        { type: "pink", seconds: 0.9, attack: 0.2, gain: 0.08, filter: { type: "bandpass", from: 572, to: 429, q: 4 }, delay: 0.1 },
      ],
    },
    // Full-moon rage: Furious roar.
    ghoulBeastMoon: {
      layers: [
        { type: "sawtooth", from: 50, to: 63, seconds: 0.39, attack: 0.05, gain: 0.9, vibrato: { rate: 4, depth: 0.1 }, filter: { type: "lowpass", from: 300, to: 2200, q: 4 } },
        { type: "sawtooth", from: 63, to: 39, seconds: 0.77, delay: 0.33, attack: 0.02, gain: 0.9, vibrato: { rate: 4, depth: 0.12 }, filter: { type: "lowpass", from: 2200, to: 260, q: 4 } },
        { type: "sawtooth", from: 28, to: 20, seconds: 1.1, attack: 0.08, gain: 0.6, filter: { type: "lowpass", from: 500, to: 500, q: 1 } },
        { type: "brown", seconds: 1.1, attack: 0.06, gain: 0.8, filter: { type: "lowpass", from: 900, to: 180, q: 1 } },
        { type: "sine", from: 28, to: 20, seconds: 1.1, attack: 0.05, gain: 0.7 },
        { type: "brown", seconds: 1.1, attack: 0.08, gain: 0.6, filter: { type: "lowpass", from: 180, to: 70, q: 1 } },
        { type: "sine", from: 48, to: 30, seconds: 1.1, attack: 0.05, gain: 0.48 },
      ],
    },
    // Takes a bolt: Angry grunt.
    ghoulBeastHurt: {
      layers: [
        { type: "sawtooth", from: 64, to: 45, seconds: 0.16, attack: 0.01, gain: 0.9, vibrato: { rate: 4, depth: 0.1 }, filter: { type: "lowpass", from: 990, to: 990, q: 1 } },
        { type: "brown", seconds: 0.13, attack: 0.01, gain: 0.6, filter: { type: "lowpass", from: 450, to: 450, q: 1 } },
        { type: "sawtooth", from: 70, to: 53, seconds: 0.2, attack: 0.03, gain: 0.36, vibrato: { rate: 6, depth: 0.2 }, filter: { type: "bandpass", from: 396, to: 220, q: 3 }, delay: 0.05 },
        { type: "noise", seconds: 0.18, attack: 0.02, gain: 0.2, filter: { type: "bandpass", from: 1280, to: 560, q: 1.5 }, delay: 0.05 },
        { type: "square", from: 35, to: 31, seconds: 0.2, attack: 0.03, gain: 0.14, filter: { type: "lowpass", from: 400, to: 400, q: 1 }, delay: 0.05 },
      ],
    },
    // Hit while clinging: Whimpering howl.
    ghoulBeastWeak: {
      layers: [
        { type: "sawtooth", from: 248, to: 347, seconds: 0.23, attack: 0.1, gain: 0.42, vibrato: { rate: 6, depth: 0.03 }, filter: { type: "bandpass", from: 578, to: 743, q: 3 } },
        { type: "sawtooth", from: 347, to: 215, seconds: 0.3, delay: 0.21, attack: 0.03, gain: 0.42, vibrato: { rate: 6, depth: 0.04 }, filter: { type: "bandpass", from: 743, to: 413, q: 3 } },
        { type: "pink", seconds: 0.5, attack: 0.2, gain: 0.12, filter: { type: "bandpass", from: 660, to: 495, q: 4 } },
        { type: "sawtooth", from: 600, to: 360, seconds: 0.2, attack: 0.01, gain: 0.4, vibrato: { rate: 10, depth: 0.03 }, filter: { type: "bandpass", from: 1200, to: 960, q: 2 } },
        { type: "sawtooth", from: 540, to: 300, seconds: 0.26, delay: 0.17, attack: 0.01, gain: 0.28, filter: { type: "bandpass", from: 1080, to: 720, q: 2 } },
      ],
    },
    // Dies: Moon sets.
    ghoulBeastDie: {
      layers: [
        { type: "sine", notes: [360, 302, 241, 180], seconds: 1, attack: 0.02, gain: 0.3, vibrato: { rate: 7, depth: 0.02 } },
        { type: "triangle", notes: [540, 454, 360, 270], seconds: 1, attack: 0.02, gain: 0.13 },
        { type: "sawtooth", from: 42, to: 30, seconds: 1, attack: 0.12, gain: 0.72, vibrato: { rate: 4, depth: 0.07 }, filter: { type: "lowpass", from: 1000, to: 500, q: 5 } },
        { type: "sawtooth", from: 43, to: 30, seconds: 1, attack: 0.14, gain: 0.4, filter: { type: "lowpass", from: 800, to: 400, q: 3 } },
        { type: "brown", seconds: 1, attack: 0.1, gain: 0.48, filter: { type: "bandpass", from: 154, to: 116, q: 2 } },
        { type: "sine", from: 66, to: 24, seconds: 0.25, attack: 0, gain: 0.6, delay: 0.9 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.48, filter: { type: "lowpass", from: 192, to: 192, q: 1 }, delay: 0.9 },
      ],
    },
    // The Moon: The moon climbs over each street and, when it comes full, every villager turns and every hound swells.
    // Comes full: Heartbeat and hum.
    ghoulMoonFull: {
      layers: [
        { type: "sine", from: 77, to: 28, seconds: 0.25, attack: 0, gain: 0.9 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.72, filter: { type: "lowpass", from: 224, to: 224, q: 1 } },
        { type: "sine", from: 77, to: 28, seconds: 0.25, attack: 0, gain: 0.7, delay: 0.2 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.56, filter: { type: "lowpass", from: 224, to: 224, q: 1 }, delay: 0.2 },
        { type: "sine", from: 77, to: 28, seconds: 0.25, attack: 0, gain: 0.9, delay: 0.6 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.72, filter: { type: "lowpass", from: 224, to: 224, q: 1 }, delay: 0.6 },
        { type: "sine", from: 77, to: 28, seconds: 0.25, attack: 0, gain: 0.7, delay: 0.8 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.56, filter: { type: "lowpass", from: 224, to: 224, q: 1 }, delay: 0.8 },
        { type: "triangle", from: 108, to: 81, seconds: 1.1, attack: 0.25, gain: 0.45, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 2520, to: 1620, q: 1 } },
        { type: "sine", from: 216, to: 162, seconds: 1.1, attack: 0.3, gain: 0.15 },
        { type: "pink", seconds: 1.1, attack: 0.3, gain: 0.13, filter: { type: "bandpass", from: 432, to: 324, q: 6 } },
      ],
    },
    // Wolfsbane: The power-up: for 10 seconds turned villagers and moonhounds shy away from you, and your bolts hit them and the Beast twice as hard.
    // Picked up: Warding ring.
    ghoulBaneActive: {
      layers: [
        { type: "triangle", from: 1500, to: 1275, seconds: 0.22, attack: 0, gain: 0.72 },
        { type: "sine", from: 4050, to: 3750, seconds: 0.12, attack: 0, gain: 0.28 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.4, filter: { type: "bandpass", from: 6000, to: 6000, q: 2 } },
        { type: "triangle", from: 2000, to: 1700, seconds: 0.22, attack: 0, gain: 0.54, delay: 0.1 },
        { type: "sine", from: 5400, to: 5000, seconds: 0.12, attack: 0, gain: 0.21, delay: 0.1 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.3, filter: { type: "bandpass", from: 8000, to: 8000, q: 2 }, delay: 0.1 },
        { type: "triangle", from: 2500, to: 2125, seconds: 0.22, attack: 0, gain: 0.45, delay: 0.2 },
        { type: "sine", from: 6750, to: 6250, seconds: 0.12, attack: 0, gain: 0.18, delay: 0.2 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.25, filter: { type: "bandpass", from: 10000, to: 10000, q: 2 }, delay: 0.2 },
      ],
    },
  },
  // The Village's rooms: Main Street, the Crooked Inn, the Town Square and
  // the Village Green (the Beast's fight), picked in prototypes/music/ghoul-rush.
  music: {
    // Main Street: folk fiddle reel. A village reel: a bowed fiddle with a
    // sawtooth bite plays the howl call over an oompah bass and off-beat
    // chords. The second section runs fast arpeggios around the chords, and
    // the third lifts the tune an octave. At high dread a hurdy-gurdy drone
    // and a far-off howl join in.
    ghoulStreet: {
      bpm: 128,
      rush: 12,
      voices: {
        fid: { wave: "sawtooth", gain: 0.14, decay: 0.15, sustain: 0.75, vibrato: { rate: 5.5, depth: 0.012, delay: 0.1 } },
        bass: { wave: "triangle", gain: 0.42, decay: 0.1, sustain: 0.5 },
        chord: { wave: "pulse", duty: 0.5, gain: 0.09, decay: 0.08, sustain: 0.1 },
        drum: { kit: true, gain: 0.22 },
        drone: { wave: "sawtooth", gain: 0.045, from: 0.85, decay: 0.3, sustain: 0.95 },
        howl: { wave: "sawtooth", gain: 0.05, from: 0.9, decay: 0.3, sustain: 0.95, vibrato: { rate: 6, depth: 0.012, delay: 0 } },
      },
      patterns: {
        A: {
          bass:
          "G2 - - - . . . . D3 - - - . . . . | Eb2 - - - . . . . Bb2 - - - . . . . | " +
          "F2 - - - . . . . C3 - - - . . . . | D2 - - - . . . . A2 - - - . . . .",
          chord:
          ". . . . G3^037 - - - . . . . G3^037 - - - | . . . . Eb3^047 - - - . . . . Eb3^047 - - - | " +
          ". . . . F3^047 - - - . . . . F3^047 - - - | . . . . D3^047 - - - . . . . D3^047 - - -",
          drum:
          "k . h . s . h . k . h . s . h . | k . h . s . h . k . h . s . h . | " +
          "k . h . s . h . k . h . s . h . | k . h . s . h . k . h . s . h .",
          fid:
          "D5 - - - G5 - - - - - - - F5 - - - | Bb5 - - - - - - - A5 - - - G5 - - - | " +
          "D5 - - - G5 - - - - - - - Bb5 - - - | A5 - - - - - - - F#5 - - - - - - -",
        },
        B: {
          bass:
          "G2 - - - . . . . D3 - - - . . . . | Eb2 - - - . . . . Bb2 - - - . . . . | " +
          "F2 - - - . . . . C3 - - - . . . . | D2 - - - . . . . A2 - - - . . . .",
          chord:
          ". . . . G3^037 - - - . . . . G3^037 - - - | . . . . Eb3^047 - - - . . . . Eb3^047 - - - | " +
          ". . . . F3^047 - - - . . . . F3^047 - - - | . . . . D3^047 - - - . . . . D3^047 - - -",
          drum:
          "k . h . s . h . k . h . s . h . | k . h . s . h . k . h . s . h . | " +
          "k . h . s . h . k . h . s . h . | k . h . s . h . k . h . s . h .",
          fid:
          "G5 Bb5 D6 Bb5 G5 Bb5 D6 Bb5 G5 Bb5 D6 Bb5 G5 Bb5 D6 Bb5 | Eb5 G5 Bb5 G5 Eb5 G5 Bb5 G5 Eb5 G5 Bb5 G5 Eb5 G5 Bb5 G5 | " +
          "F5 A5 C6 A5 F5 A5 C6 A5 F5 A5 C6 A5 F5 A5 C6 A5 | D5 Gb5 A5 Gb5 D5 Gb5 A5 Gb5 D5 Gb5 A5 Gb5 D5 Gb5 A5 Gb5",
        },
        C: {
          bass:
          "G2 - - - . . . . D3 - - - . . . . | Eb2 - - - . . . . Bb2 - - - . . . . | " +
          "F2 - - - . . . . C3 - - - . . . . | D2 - - - . . . . A2 - - - . . . .",
          chord:
          ". . . . G3^037 - - - . . . . G3^037 - - - | . . . . Eb3^047 - - - . . . . Eb3^047 - - - | " +
          ". . . . F3^047 - - - . . . . F3^047 - - - | . . . . D3^047 - - - . . . . D3^047 - - -",
          drum:
          "k . h . s . h . k . h . s . h . | k . h . s . h . k . h . s . h . | " +
          "k . h . s . h . k . h . s . h . | k . h . s . h . k . h . s . h .",
          fid:
          "D6 - - - G6 - - - - - - - F6 - - - | Bb6 - - - - - - - A6 - - - G6 - - - | " +
          "D6 - - - G6 - - - - - - - Bb6 - - - | A6 - - - - - - - Gb6 - - - - - - -",
          drone:
          "G3 - - - - - - - - - - - - - - - | Eb3 - - - - - - - - - - - - - - - | " +
          "F3 - - - - - - - - - - - - - - - | D3 - - - - - - - - - - - - - - -",
        },
        D: {
          bass:
          "G2 - - - . . . . D3 - - - . . . . | Eb2 - - - . . . . Bb2 - - - . . . . | " +
          "F2 - - - . . . . C3 - - - . . . . | D2 - - - . . . . A2 - - - . . . .",
          chord:
          ". . . . G3^037 - - - . . . . G3^037 - - - | . . . . Eb3^047 - - - . . . . Eb3^047 - - - | " +
          ". . . . F3^047 - - - . . . . F3^047 - - - | . . . . D3^047 - - - . . . . D3^047 - - -",
          drum:
          "k . h . s . h . k . h . s . h . | k . h . s . h . k . h . s . h . | " +
          "k . h . s . h . k . h . s . h . | k . h . s . h . k . h . s . h .",
          fid:
          "D6 - - - G6 - - - - - - - F6 - - - | Bb6 - - - - - - - A6 - - - G6 - - - | " +
          "D6 - - - G6 - - - - - - - Bb6 - - - | A6 - - - - - - - Gb6 - - - - - - -",
          drone:
          "G3 - - - - - - - - - - - - - - - | Eb3 - - - - - - - - - - - - - - - | " +
          "F3 - - - - - - - - - - - - - - - | D3 - - - - - - - - - - - - - - -",
          howl:
          "D5 - - - - - - - - - - - - - - - | G5 - - - - - - - - - - - - - - - | " +
          "Bb5 - - - - - - - - - - - - - - - | A5 - - - - - - - F#5 - - - - - - -",
        },
      },
      order: ["A", "B", "A", "C", "B", "D"],
    },
    // The Crooked Inn: bar-room brawl. The tavern erupts: a galloping bass, a
    // double-time kit and a bright pulse lead sawing the howl call, with
    // chord stabs on the off beats. The middle runs fast arpeggios, the last
    // lifts the tune an octave. At high dread chairs smash (a crash on the
    // one) and a howl cuts through the din.
    ghoulInn: {
      bpm: 138,
      rush: 12,
      voices: {
        lead: { wave: "pulse", duty: 0.25, gain: 0.16, decay: 0.1, sustain: 0.7 },
        bass: { wave: "sawtooth", gain: 0.28, decay: 0.08, sustain: 0.6 },
        drum: { kit: true, gain: 0.24 },
        stab: { wave: "pulse", duty: 0.5, gain: 0.09, from: 0.4, decay: 0.08, sustain: 0.2 },
        smash: { kit: true, gain: 0.2, from: 0.85 },
        howl: { wave: "sawtooth", gain: 0.05, from: 0.95, decay: 0.3, sustain: 0.95, vibrato: { rate: 6, depth: 0.012, delay: 0 } },
      },
      patterns: {
        A: {
          bass:
          "G2 - G2 - . . G2 - G2 - G2 - . . G2 - | Eb2 - Eb2 - . . Eb2 - Eb2 - Eb2 - . . Eb2 - | " +
          "F2 - F2 - . . F2 - F2 - F2 - . . F2 - | D2 - D2 - . . D2 - D2 - D2 - . . D2 -",
          drum:
          "k . h h s . h h k . h h s . h o | k . h h s . h h k . h h s . h o | " +
          "k . h h s . h h k . h h s . h o | k . h h s . h h k . h h s . h o",
          stab:
          ". . . . G3^037 - - - . . . . G3^037 - - - | . . . . Eb3^047 - - - . . . . Eb3^047 - - - | " +
          ". . . . F3^047 - - - . . . . F3^047 - - - | . . . . D3^047 - - - . . . . D3^047 - - -",
          lead:
          "D5 - - - G5 - - - - - - - F5 - - - | Bb5 - - - - - - - A5 - - - G5 - - - | " +
          "D5 - - - G5 - - - - - - - Bb5 - - - | A5 - - - - - - - F#5 - - - - - - -",
        },
        B: {
          bass:
          "G2 - G2 - . . G2 - G2 - G2 - . . G2 - | Eb2 - Eb2 - . . Eb2 - Eb2 - Eb2 - . . Eb2 - | " +
          "F2 - F2 - . . F2 - F2 - F2 - . . F2 - | D2 - D2 - . . D2 - D2 - D2 - . . D2 -",
          drum:
          "k . h h s . h h k . h h s . h o | k . h h s . h h k . h h s . h o | " +
          "k . h h s . h h k . h h s . h o | k . h h s . h h k . h h s . h o",
          stab:
          ". . . . G3^037 - - - . . . . G3^037 - - - | . . . . Eb3^047 - - - . . . . Eb3^047 - - - | " +
          ". . . . F3^047 - - - . . . . F3^047 - - - | . . . . D3^047 - - - . . . . D3^047 - - -",
          lead:
          "G5 Bb5 D6 Bb5 G5 Bb5 D6 Bb5 G5 Bb5 D6 Bb5 G5 Bb5 D6 Bb5 | Eb5 G5 Bb5 G5 Eb5 G5 Bb5 G5 Eb5 G5 Bb5 G5 Eb5 G5 Bb5 G5 | " +
          "F5 A5 C6 A5 F5 A5 C6 A5 F5 A5 C6 A5 F5 A5 C6 A5 | D5 Gb5 A5 Gb5 D5 Gb5 A5 Gb5 D5 Gb5 A5 Gb5 D5 Gb5 A5 Gb5",
        },
        C: {
          bass:
          "G2 - G2 - . . G2 - G2 - G2 - . . G2 - | Eb2 - Eb2 - . . Eb2 - Eb2 - Eb2 - . . Eb2 - | " +
          "F2 - F2 - . . F2 - F2 - F2 - . . F2 - | D2 - D2 - . . D2 - D2 - D2 - . . D2 -",
          drum:
          "k . h h s . h h k . h h s . h o | k . h h s . h h k . h h s . h o | " +
          "k . h h s . h h k . h h s . h o | k . h h s . h h k . h h s . h o",
          stab:
          ". . . . G3^037 - - - . . . . G3^037 - - - | . . . . Eb3^047 - - - . . . . Eb3^047 - - - | " +
          ". . . . F3^047 - - - . . . . F3^047 - - - | . . . . D3^047 - - - . . . . D3^047 - - -",
          lead:
          "D6 - - - G6 - - - - - - - F6 - - - | Bb6 - - - - - - - A6 - - - G6 - - - | " +
          "D6 - - - G6 - - - - - - - Bb6 - - - | A6 - - - - - - - Gb6 - - - - - - -",
        },
        D: {
          bass:
          "G2 - G2 - . . G2 - G2 - G2 - . . G2 - | Eb2 - Eb2 - . . Eb2 - Eb2 - Eb2 - . . Eb2 - | " +
          "F2 - F2 - . . F2 - F2 - F2 - . . F2 - | D2 - D2 - . . D2 - D2 - D2 - . . D2 -",
          drum:
          "k . h h s . h h k . h h s . h o | k . h h s . h h k . h h s . h o | " +
          "k . h h s . h h k . h h s . h o | k . h h s . h h k . h h s . h o",
          stab:
          ". . . . G3^037 - - - . . . . G3^037 - - - | . . . . Eb3^047 - - - . . . . Eb3^047 - - - | " +
          ". . . . F3^047 - - - . . . . F3^047 - - - | . . . . D3^047 - - - . . . . D3^047 - - -",
          lead:
          "D6 - - - G6 - - - - - - - F6 - - - | Bb6 - - - - - - - A6 - - - G6 - - - | " +
          "D6 - - - G6 - - - - - - - Bb6 - - - | A6 - - - - - - - Gb6 - - - - - - -",
          smash:
          "o . . . . . . . . . . . . . . . | o . . . . . . . . . . . . . . . | " +
          "o . . . . . . . . . . . . . . . | o . . . . . . . . . . . . . . .",
          howl:
          "D5 - - - - - - - - - - - - - - - | G5 - - - - - - - - - - - - - - - | " +
          "Bb5 - - - - - - - - - - - - - - - | A5 - - - - - - - F#5 - - - - - - -",
        },
      },
      order: ["A", "B", "A", "C", "B", "D"],
    },
    // The Town Square: creaking gallows. Nothing moves but the rope: a long
    // sine creak that bends with the sway, a wooden knock now and then, wind
    // through the planks and a bass that swings from root to fifth and back.
    // A thin pluck sings the howl call, low. Later the chains rattle and, at
    // high dread, a howl comes over the square.
    ghoulSquare: {
      bpm: 88,
      rush: 8,
      voices: {
        creak: { wave: "sine", gain: 0.14, decay: 0.3, sustain: 0.9, vibrato: { rate: 0.7, depth: 0.025, delay: 0 } },
        sway: { wave: "triangle", gain: 0.45, decay: 0.3, sustain: 0.7 },
        knock: { kit: true, gain: 0.22, from: 0.1 },
        wind: { kit: true, gain: 0.06, from: 0.3 },
        pluck: { wave: "pulse", duty: 0.125, gain: 0.17, decay: 0.2, sustain: 0.1 },
        chain: { wave: "pulse", duty: 0.125, gain: 0.07, from: 0.8, decay: 0.05, sustain: 0 },
        howl: { wave: "sawtooth", gain: 0.05, from: 0.95, decay: 0.3, sustain: 0.95, vibrato: { rate: 6, depth: 0.012, delay: 0 } },
      },
      patterns: {
        A: {
          sway:
          "G2 - - - - - - - D3 - - - - - - - | Eb2 - - - - - - - Bb2 - - - - - - - | " +
          "F2 - - - - - - - C3 - - - - - - - | D2 - - - - - - - A2 - - - - - - -",
          knock:
          "k . . . . . . . . . k . . . . . | k . . . . . . . . . k . . . . . | " +
          "k . . . . . . . . . k . . . . . | k . . . . . . . . . k . . . . .",
          wind:
          ". . . . h . . . . . . . h . . . | . . . . h . . . . . . . h . . . | " +
          ". . . . h . . . . . . . h . . . | . . . . h . . . . . . . h . . .",
          creak:
          "G3 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "Bb3 - - - - - - - - - - - - - - - | F#3 - - - - - - - - - - - - - - -",
          pluck:
          "D4 - - - G4 - - - - - - - F4 - - - | Bb4 - - - - - - - A4 - - - G4 - - - | " +
          "D4 - - - G4 - - - - - - - Bb4 - - - | A4 - - - - - - - Gb4 - - - - - - -",
        },
        B: {
          sway:
          "G2 - - - - - - - D3 - - - - - - - | Eb2 - - - - - - - Bb2 - - - - - - - | " +
          "F2 - - - - - - - C3 - - - - - - - | D2 - - - - - - - A2 - - - - - - -",
          knock:
          "k . . . . . . . . . k . . . . . | k . . . . . . . . . k . . . . . | " +
          "k . . . . . . . . . k . . . . . | k . . . . . . . . . k . . . . .",
          wind:
          ". . . . h . . . . . . . h . . . | . . . . h . . . . . . . h . . . | " +
          ". . . . h . . . . . . . h . . . | . . . . h . . . . . . . h . . .",
          creak:
          "D3 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "G3 - - - - - - - - - - - - - - - | F#3 - - - - - - - - - - - - - - -",
          pluck:
          "D5 - - - G5 - - - - - - - F5 - - - | Bb5 - - - - - - - A5 - - - G5 - - - | " +
          "D5 - - - G5 - - - - - - - Bb5 - - - | A5 - - - - - - - F#5 - - - - - - -",
        },
        C: {
          sway:
          "G2 - - - - - - - D3 - - - - - - - | Eb2 - - - - - - - Bb2 - - - - - - - | " +
          "F2 - - - - - - - C3 - - - - - - - | D2 - - - - - - - A2 - - - - - - -",
          knock:
          "k . . . . . . . . . k . . . . . | k . . . . . . . . . k . . . . . | " +
          "k . . . . . . . . . k . . . . . | k . . . . . . . . . k . . . . .",
          wind:
          ". . . . h . . . . . . . h . . . | . . . . h . . . . . . . h . . . | " +
          ". . . . h . . . . . . . h . . . | . . . . h . . . . . . . h . . .",
          creak:
          "G3 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "Bb3 - - - - - - - - - - - - - - - | F#3 - - - - - - - - - - - - - - -",
          pluck:
          "D4 - - - G4 - - - - - - - F4 - - - | Bb4 - - - - - - - A4 - - - G4 - - - | " +
          "D4 - - - G4 - - - - - - - Bb4 - - - | A4 - - - - - - - Gb4 - - - - - - -",
          chain:
          "C7 . . . C7 . . . . . C7 . C7 . . . | . . . . . . . . . . . . . . . . | " +
          "C7 . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
        },
        D: {
          sway:
          "G2 - - - - - - - D3 - - - - - - - | Eb2 - - - - - - - Bb2 - - - - - - - | " +
          "F2 - - - - - - - C3 - - - - - - - | D2 - - - - - - - A2 - - - - - - -",
          knock:
          "k . . . . . . . . . k . . . . . | k . . . . . . . . . k . . . . . | " +
          "k . . . . . . . . . k . . . . . | k . . . . . . . . . k . . . . .",
          wind:
          ". . . . h . . . . . . . h . . . | . . . . h . . . . . . . h . . . | " +
          ". . . . h . . . . . . . h . . . | . . . . h . . . . . . . h . . .",
          creak:
          "D3 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "G3 - - - - - - - - - - - - - - - | F#3 - - - - - - - - - - - - - - -",
          pluck:
          "D5 - - - G5 - - - - - - - F5 - - - | Bb5 - - - - - - - A5 - - - G5 - - - | " +
          "D5 - - - G5 - - - - - - - Bb5 - - - | A5 - - - - - - - F#5 - - - - - - -",
          chain:
          "C7 . . . C7 . . . . . C7 . C7 . . . | . . . . . . . . . . . . . . . . | " +
          "C7 . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          howl:
          "D5 - - - - - - - - - - - - - - - | G5 - - - - - - - - - - - - - - - | " +
          "Bb5 - - - - - - - - - - - - - - - | A5 - - - - - - - F#5 - - - - - - -",
        },
      },
      order: ["A", "B", "C", "D"],
    },
    // The Village Green (the Beast's fight): gothic metal. Castle metal for a
    // werewolf: a palm-muted sawtooth chugs sixteenths on the root, a
    // double-kick kit pounds under it, an organ holds the chords and a square
    // lead cries the howl call. Each turn the lead climbs. At high dread a
    // choir wail and a siren pile on and the F# hangs in the air.
    ghoulGreen: {
      bpm: 144,
      rush: 12,
      voices: {
        chug: { wave: "sawtooth", gain: 0.2, decay: 0.05, sustain: 0.3 },
        drum: { kit: true, gain: 0.26 },
        organ: { wave: "pulse", duty: 0.5, gain: 0.08, from: 0.3, decay: 0.2, sustain: 0.9 },
        lead: { wave: "square", gain: 0.15, decay: 0.15, sustain: 0.8, vibrato: { rate: 5, depth: 0.012, delay: 0.15 } },
        choir: { wave: "sawtooth", gain: 0.06, from: 0.85, decay: 0.3, sustain: 0.95, vibrato: { rate: 6, depth: 0.012, delay: 0 } },
        siren: { wave: "square", gain: 0.05, from: 0.95, decay: 0.2, sustain: 0.8, vibrato: { rate: 6, depth: 0.012, delay: 0 } },
      },
      patterns: {
        A: {
          chug:
          "G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 | Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 | " +
          "F2 F2 F2 F2 F2 F2 F2 F2 F2 F2 F2 F2 F2 F2 F2 F2 | D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2",
          drum:
          "kh . kh h s . kh h kh . kh h s . kh h | kh . kh h s . kh h kh . kh h s . kh h | " +
          "kh . kh h s . kh h kh . kh h s . kh h | kh . kh h s . kh h kh . kh h s . kh h",
          lead:
          "D4 - - - G4 - - - - - - - F4 - - - | Bb4 - - - - - - - A4 - - - G4 - - - | " +
          "D4 - - - G4 - - - - - - - Bb4 - - - | A4 - - - - - - - Gb4 - - - - - - -",
        },
        B: {
          chug:
          "G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 | Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 | " +
          "F2 F2 F2 F2 F2 F2 F2 F2 F2 F2 F2 F2 F2 F2 F2 F2 | D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2",
          drum:
          "kh . kh h s . kh h kh . kh h s . kh h | kh . kh h s . kh h kh . kh h s . kh h | " +
          "kh . kh h s . kh h kh . kh h s . kh h | kh . kh h s . kh h kh . kh h s . kh h",
          lead:
          "D5 - - - G5 - - - - - - - F5 - - - | Bb5 - - - - - - - A5 - - - G5 - - - | " +
          "D5 - - - G5 - - - - - - - Bb5 - - - | A5 - - - - - - - F#5 - - - - - - -",
          organ:
          "G3^037 - - - - - - - - - - - - - - - | Eb3^047 - - - - - - - - - - - - - - - | " +
          "F3^047 - - - - - - - - - - - - - - - | D3^047 - - - - - - - - - - - - - - -",
        },
        C: {
          chug:
          "G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 | Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 | " +
          "F2 F2 F2 F2 F2 F2 F2 F2 F2 F2 F2 F2 F2 F2 F2 F2 | D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2",
          drum:
          "kh . kh h s . kh h kh . kh h s . kh h | kh . kh h s . kh h kh . kh h s . kh h | " +
          "kh . kh h s . kh h kh . kh h s . kh h | kh . kh h s . kh h kh . kh h s . kh h",
          lead:
          "D6 - - - G6 - - - - - - - F6 - - - | Bb6 - - - - - - - A6 - - - G6 - - - | " +
          "D6 - - - G6 - - - - - - - Bb6 - - - | A6 - - - - - - - Gb6 - - - - - - -",
          organ:
          "G3^037 - - - - - - - - - - - - - - - | Eb3^047 - - - - - - - - - - - - - - - | " +
          "F3^047 - - - - - - - - - - - - - - - | D3^047 - - - - - - - - - - - - - - -",
        },
        D: {
          chug:
          "G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 | Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 Eb2 | " +
          "F2 F2 F2 F2 F2 F2 F2 F2 F2 F2 F2 F2 F2 F2 F2 F2 | D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2",
          drum:
          "kh . kh h s . kh h kh . kh h s . kh h | kh . kh h s . kh h kh . kh h s . kh h | " +
          "kh . kh h s . kh h kh . kh h s . kh h | kh . kh h s . kh h kh . kh h s . kh h",
          lead:
          "D6 - - - G6 - - - - - - - F6 - - - | Bb6 - - - - - - - A6 - - - G6 - - - | " +
          "D6 - - - G6 - - - - - - - Bb6 - - - | A6 - - - - - - - Gb6 - - - - - - -",
          organ:
          "G3^037 - - - - - - - - - - - - - - - | Eb3^047 - - - - - - - - - - - - - - - | " +
          "F3^047 - - - - - - - - - - - - - - - | D3^047 - - - - - - - - - - - - - - -",
          choir:
          "D5 - - - - - - - - - - - - - - - | G5 - - - - - - - - - - - - - - - | " +
          "Bb5 - - - - - - - - - - - - - - - | A5 - - - - - - - F#5 - - - - - - -",
          siren:
          "Db5 - - - G5 - - - Db5 - - - G5 - - - | Db5 - - - G5 - - - Db5 - - - G5 - - - | " +
          "Db5 - - - G5 - - - Db5 - - - G5 - - - | Db5 - - - G5 - - - Db5 - - - G5 - - -",
        },
      },
      order: ["A", "B", "C", "B", "C", "D"],
    },
  },
};
