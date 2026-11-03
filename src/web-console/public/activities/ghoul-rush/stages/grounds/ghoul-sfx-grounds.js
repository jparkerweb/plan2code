// Plan2Code Web Console - ghoul: The Grounds' own sound effects and music tracks, merged into ghoul-sfx.js; defines only.
//
// Same shape and rules as ghoul-sfx-graveyard.js: `tones` (the stage's
// monsters' and boss's `ghoul<Kind><Act>` sounds) and `music` (a track per
// room, named in ROOM_MUSIC in ghoul.js). A name may be defined only once
// across tones.js and every game's file. No imports.

export const GROUNDS_SFX = {
  tones: {
    // The Grounds' monsters, the Groundskeeper and the Hedge shears, picked by
    // ear (prototypes/sounds/ghoul-rush/grounds.html).
    // Topiary Beast: A hedge clipped into an animal; it creeps only when your back is turned.
    // Comes in: Creaking twigs.
    ghoulTopiaryAppear: {
      layers: [
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2299, to: 1839, q: 6 } },
        { type: "square", from: 709, to: 476, seconds: 0.02, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.08, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1769, to: 1415, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.15, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2226, to: 1781, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.23, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1900, to: 1520, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.31, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1508, to: 1206, q: 6 } },
        { type: "square", from: 702, to: 330, seconds: 0.02, delay: 0.31, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.38, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2492, to: 1993, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.46, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2125, to: 1700, q: 6 } },
        { type: "triangle", from: 54, to: 41, seconds: 0.7, attack: 0.25, gain: 0.36, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 840, to: 540, q: 1 } },
        { type: "sine", from: 108, to: 81, seconds: 0.7, attack: 0.3, gain: 0.12 },
        { type: "pink", seconds: 0.7, attack: 0.3, gain: 0.1, filter: { type: "bandpass", from: 216, to: 162, q: 6 } },
      ],
    },
    // Starts creeping: Dry brush scrabble.
    ghoulTopiaryRustle: {
      layers: [
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 5164, to: 4132, q: 6 } },
        { type: "square", from: 1136, to: 965, seconds: 0.02, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.03, attack: 0, gain: 0.84, filter: { type: "bandpass", from: 5384, to: 4307, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.78, filter: { type: "bandpass", from: 4984, to: 3987, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.09, attack: 0, gain: 0.72, filter: { type: "bandpass", from: 3596, to: 2877, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.12, attack: 0, gain: 0.66, filter: { type: "bandpass", from: 5278, to: 4223, q: 6 } },
        { type: "square", from: 1147, to: 726, seconds: 0.02, delay: 0.12, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.14, attack: 0, gain: 0.6, filter: { type: "bandpass", from: 5421, to: 4337, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.17, attack: 0, gain: 0.54, filter: { type: "bandpass", from: 3640, to: 2912, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.21, attack: 0, gain: 0.48, filter: { type: "bandpass", from: 5332, to: 4266, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.24, attack: 0, gain: 0.42, filter: { type: "bandpass", from: 3972, to: 3178, q: 6 } },
        { type: "square", from: 1531, to: 857, seconds: 0.02, delay: 0.24, gain: 0.3 },
      ],
    },
    // Freezes: Squeak and stop.
    ghoulTopiaryFreeze: {
      layers: [
        { type: "sine", from: 700, to: 910, seconds: 0.08, attack: 0.01, gain: 0.48, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 840, to: 1085, seconds: 0.07, delay: 0.1, attack: 0.01, gain: 0.36, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 110, to: 40, seconds: 0.25, attack: 0, gain: 0.5, delay: 0.1 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.4, filter: { type: "lowpass", from: 320, to: 320, q: 1 }, delay: 0.1 },
      ],
    },
    // Takes a bolt: Angry hiss.
    ghoulTopiaryHurt: {
      layers: [
        { type: "noise", seconds: 0.25, attack: 0.06, gain: 0.8, filter: { type: "highpass", from: 1680, to: 3500, q: 1 } },
        { type: "pink", seconds: 0.25, attack: 0.05, gain: 0.5, filter: { type: "bandpass", from: 2240, to: 1540, q: 2 } },
        { type: "sawtooth", from: 144, to: 108, seconds: 0.2, attack: 0.03, gain: 0.45, vibrato: { rate: 21, depth: 0.2 }, filter: { type: "bandpass", from: 810, to: 450, q: 3 } },
        { type: "noise", seconds: 0.18, attack: 0.02, gain: 0.25, filter: { type: "bandpass", from: 1600, to: 700, q: 1.5 } },
        { type: "square", from: 72, to: 63, seconds: 0.2, attack: 0.03, gain: 0.18, filter: { type: "lowpass", from: 500, to: 500, q: 1 } },
      ],
    },
    // Dies: Sigh of leaves.
    ghoulTopiaryDie: {
      layers: [
        { type: "triangle", from: 63, to: 47, seconds: 0.9, attack: 0.25, gain: 0.45, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 980, to: 630, q: 1 } },
        { type: "sine", from: 126, to: 94, seconds: 0.9, attack: 0.3, gain: 0.15 },
        { type: "pink", seconds: 0.9, attack: 0.3, gain: 0.13, filter: { type: "bandpass", from: 252, to: 189, q: 6 } },
        { type: "noise", seconds: 0.9, attack: 0.32, gain: 0.8, filter: { type: "bandpass", from: 390, to: 2340, q: 1.5 } },
      ],
    },
    // Rootling: A root that cracks the lawn under you and bursts up.
    // Comes in: Slow wooden creak.
    ghoulRootlingAppear: {
      layers: [
        { type: "sawtooth", from: 36, to: 26, seconds: 1, attack: 0.12, gain: 0.9, vibrato: { rate: 10, depth: 0.07 }, filter: { type: "lowpass", from: 600, to: 300, q: 5 } },
        { type: "sawtooth", from: 37, to: 26, seconds: 1, attack: 0.14, gain: 0.5, filter: { type: "lowpass", from: 480, to: 240, q: 3 } },
        { type: "brown", seconds: 1, attack: 0.1, gain: 0.6, filter: { type: "bandpass", from: 132, to: 99, q: 2 } },
      ],
    },
    // Ground cracks: Tense knocking.
    ghoulRootlingWarn: {
      layers: [
        { type: "triangle", from: 160, to: 136, seconds: 0.22, attack: 0, gain: 0.72 },
        { type: "sine", from: 432, to: 400, seconds: 0.12, attack: 0, gain: 0.28 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.4, filter: { type: "bandpass", from: 640, to: 640, q: 2 } },
        { type: "triangle", from: 190, to: 162, seconds: 0.22, attack: 0, gain: 0.72, delay: 0.14 },
        { type: "sine", from: 513, to: 475, seconds: 0.12, attack: 0, gain: 0.28, delay: 0.14 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.4, filter: { type: "bandpass", from: 760, to: 760, q: 2 }, delay: 0.14 },
        { type: "triangle", from: 230, to: 196, seconds: 0.22, attack: 0, gain: 0.72, delay: 0.26 },
        { type: "sine", from: 621, to: 575, seconds: 0.12, attack: 0, gain: 0.28, delay: 0.26 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.4, filter: { type: "bandpass", from: 920, to: 920, q: 2 }, delay: 0.26 },
      ],
    },
    // Bursts out: Dirt explosion.
    ghoulRootlingUp: {
      layers: [
        { type: "noise", seconds: 0.5, attack: 0, gain: 1, filter: { type: "lowpass", from: 2940, to: 105, q: 1 } },
        { type: "sine", from: 112, to: 25, seconds: 0.4, attack: 0, gain: 0.9 },
        { type: "brown", seconds: 0.6, attack: 0.01, gain: 0.7, filter: { type: "lowpass", from: 280, to: 280, q: 1 } },
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.5, filter: { type: "bandpass", from: 900, to: 600, q: 2 } },
        { type: "square", from: 450, to: 150, seconds: 0.05, attack: 0, gain: 0.2 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.35, filter: { type: "bandpass", from: 1300, to: 900, q: 3 } },
      ],
    },
    // Takes a hit: Woody crack.
    ghoulRootlingHurt: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 1, filter: { type: "bandpass", from: 1080, to: 720, q: 2 } },
        { type: "square", from: 540, to: 180, seconds: 0.05, attack: 0, gain: 0.4 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.7, filter: { type: "bandpass", from: 1560, to: 1080, q: 3 } },
      ],
    },
    // Dies: Withering groan.
    ghoulRootlingDie: {
      layers: [
        { type: "sawtooth", from: 48, to: 34, seconds: 1, attack: 0.12, gain: 0.9, vibrato: { rate: 10, depth: 0.07 }, filter: { type: "lowpass", from: 600, to: 300, q: 5 } },
        { type: "sawtooth", from: 49, to: 34, seconds: 1, attack: 0.14, gain: 0.5, filter: { type: "lowpass", from: 480, to: 240, q: 3 } },
        { type: "brown", seconds: 1, attack: 0.1, gain: 0.6, filter: { type: "bandpass", from: 176, to: 132, q: 2 } },
        { type: "sine", notes: [200, 168, 134, 100], seconds: 0.7, attack: 0.02, gain: 0.18, vibrato: { rate: 7, depth: 0.02 }, delay: 0.2 },
        { type: "triangle", notes: [300, 252, 200, 150], seconds: 0.7, attack: 0.02, gain: 0.08, delay: 0.2 },
      ],
    },
    // Lantern Moth: A big pale moth with a glowing belly that flutters at you.
    // Flutters in: Buzzing hum.
    ghoulMothAppear: {
      layers: [
        { type: "sine", from: 7020, to: 5400, seconds: 0.6, attack: 0.05, gain: 0.36, vibrato: { rate: 9, depth: 0.4 } },
        { type: "brown", seconds: 0.6, attack: 0.05, gain: 0.24, filter: { type: "lowpass", from: 3000, to: 1500, q: 1 } },
        { type: "pink", seconds: 0.07, attack: 0.01, gain: 0.9, filter: { type: "bandpass", from: 960, to: 416, q: 1 } },
        { type: "pink", seconds: 0.07, delay: 0.08, attack: 0.01, gain: 0.6, filter: { type: "bandpass", from: 960, to: 416, q: 1 } },
        { type: "pink", seconds: 0.07, delay: 0.16, attack: 0.01, gain: 0.9, filter: { type: "bandpass", from: 960, to: 416, q: 1 } },
        { type: "pink", seconds: 0.07, delay: 0.24, attack: 0.01, gain: 0.6, filter: { type: "bandpass", from: 960, to: 416, q: 1 } },
      ],
    },
    // Takes a hit: Tiny squeak.
    ghoulMothHurt: {
      layers: [
        { type: "sine", from: 1400, to: 1820, seconds: 0.08, attack: 0.01, gain: 0.8, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 1680, to: 2170, seconds: 0.07, delay: 0.1, attack: 0.01, gain: 0.6, vibrato: { rate: 40, depth: 0.08 } },
      ],
    },
    // Dies: Falling spark.
    ghoulMothDie: {
      layers: [
        { type: "sine", notes: [2400, 2016, 1608, 1200], seconds: 0.5, attack: 0.02, gain: 0.36, vibrato: { rate: 7, depth: 0.02 } },
        { type: "triangle", notes: [3600, 3024, 2400, 1800], seconds: 0.5, attack: 0.02, gain: 0.15 },
        { type: "noise", seconds: 0.2, attack: 0.06, gain: 0.24, filter: { type: "highpass", from: 4320, to: 9000, q: 1 } },
        { type: "pink", seconds: 0.2, attack: 0.05, gain: 0.15, filter: { type: "bandpass", from: 5760, to: 3960, q: 2 } },
      ],
    },
    // Mulch Crawler: A heap of rotting leaves that bursts out and crawls at you.
    // Comes in: Damp mutter.
    ghoulMulchAppear: {
      layers: [
        { type: "sine", from: 152, to: 117, seconds: 0.7, attack: 0.05, gain: 0.9, vibrato: { rate: 9, depth: 0.4 } },
        { type: "brown", seconds: 0.7, attack: 0.05, gain: 0.6, filter: { type: "lowpass", from: 450, to: 225, q: 1 } },
        { type: "sine", from: 555, to: 943, seconds: 0.05, delay: 0.5, attack: 0, gain: 0.35 },
        { type: "sine", from: 558, to: 949, seconds: 0.05, delay: 0.46, attack: 0, gain: 0.35 },
        { type: "sine", from: 752, to: 1278, seconds: 0.05, delay: 0.42, attack: 0, gain: 0.35 },
        { type: "sine", from: 892, to: 1516, seconds: 0.05, delay: 0.1, attack: 0, gain: 0.35 },
      ],
    },
    // Bursts out: Growl from the heap.
    ghoulMulchLeaves: {
      layers: [
        { type: "sawtooth", from: 129, to: 164, seconds: 0.18, attack: 0.05, gain: 0.9, vibrato: { rate: 28, depth: 0.1 }, filter: { type: "lowpass", from: 300, to: 2860, q: 4 } },
        { type: "sawtooth", from: 164, to: 100, seconds: 0.35, delay: 0.15, attack: 0.02, gain: 0.9, vibrato: { rate: 28, depth: 0.12 }, filter: { type: "lowpass", from: 2860, to: 260, q: 4 } },
        { type: "sawtooth", from: 72, to: 51, seconds: 0.5, attack: 0.08, gain: 0.6, filter: { type: "lowpass", from: 500, to: 500, q: 1 } },
        { type: "brown", seconds: 0.5, attack: 0.06, gain: 0.8, filter: { type: "lowpass", from: 900, to: 180, q: 1 } },
        { type: "sine", from: 72, to: 50, seconds: 0.5, attack: 0.05, gain: 0.7 },
        { type: "noise", seconds: 0.4, attack: 0.14, gain: 0.4, filter: { type: "bandpass", from: 540, to: 3240, q: 1.5 } },
      ],
    },
    // Takes a hit: Gurgle.
    ghoulMulchHurt: {
      layers: [
        { type: "sine", from: 286, to: 215, seconds: 0.25, attack: 0.05, gain: 0.9, vibrato: { rate: 15, depth: 0.4 } },
        { type: "brown", seconds: 0.25, attack: 0.05, gain: 0.7, filter: { type: "lowpass", from: 700, to: 300, q: 1 } },
        { type: "sine", from: 429, to: 343, seconds: 0.18, delay: 0.04, attack: 0.03, gain: 0.4, vibrato: { rate: 9, depth: 0.5 } },
      ],
    },
    // Dies: Rotten squelch and sigh.
    ghoulMulchDie: {
      layers: [
        { type: "brown", seconds: 0.3, attack: 0.01, gain: 1, filter: { type: "lowpass", from: 1300, to: 150, q: 1 } },
        { type: "sine", from: 260, to: 60, seconds: 0.22, attack: 0.01, gain: 0.7 },
        { type: "noise", seconds: 0.12, attack: 0.01, gain: 0.4, filter: { type: "bandpass", from: 900, to: 300, q: 3 } },
        { type: "triangle", from: 130, to: 98, seconds: 0.7, attack: 0.25, gain: 0.45, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 1400, to: 900, q: 1 }, delay: 0.1 },
        { type: "sine", from: 260, to: 195, seconds: 0.7, attack: 0.3, gain: 0.15, delay: 0.1 },
        { type: "pink", seconds: 0.7, attack: 0.3, gain: 0.13, filter: { type: "bandpass", from: 520, to: 390, q: 6 }, delay: 0.1 },
      ],
    },
    // The Groundskeeper: The boss: a gardener with a scythe, a lantern and a rusted mower; jump the scythe, shoot the lantern.
    // Wakes: Slow deep groan.
    ghoulKeeperWake: {
      layers: [
        { type: "sawtooth", from: 62, to: 44, seconds: 1.1, attack: 0.12, gain: 0.9, vibrato: { rate: 9, depth: 0.07 }, filter: { type: "lowpass", from: 800, to: 400, q: 5 } },
        { type: "sawtooth", from: 62, to: 43, seconds: 1.1, attack: 0.14, gain: 0.5, filter: { type: "lowpass", from: 640, to: 320, q: 3 } },
        { type: "brown", seconds: 1.1, attack: 0.1, gain: 0.6, filter: { type: "bandpass", from: 224, to: 168, q: 2 } },
      ],
    },
    // Scythe winds up: Honing stone.
    ghoulKeeperScytheWind: {
      layers: [
        { type: "noise", seconds: 0.15, attack: 0.06, gain: 0.8, filter: { type: "highpass", from: 3360, to: 7000, q: 1 } },
        { type: "pink", seconds: 0.15, attack: 0.05, gain: 0.5, filter: { type: "bandpass", from: 4480, to: 3080, q: 2 } },
        { type: "noise", seconds: 0.15, attack: 0.06, gain: 0.8, filter: { type: "highpass", from: 3840, to: 8000, q: 1 }, delay: 0.2 },
        { type: "pink", seconds: 0.15, attack: 0.05, gain: 0.5, filter: { type: "bandpass", from: 5120, to: 3520, q: 2 }, delay: 0.2 },
        { type: "noise", seconds: 0.15, attack: 0.06, gain: 0.8, filter: { type: "highpass", from: 4320, to: 9000, q: 1 }, delay: 0.4 },
        { type: "pink", seconds: 0.15, attack: 0.05, gain: 0.5, filter: { type: "bandpass", from: 5760, to: 3960, q: 2 }, delay: 0.4 },
      ],
    },
    // Scythe sweeps: Rolling sweep.
    ghoulKeeperScytheSweep: {
      layers: [
        { type: "noise", seconds: 0.7, attack: 0.24, gain: 0.8, filter: { type: "bandpass", from: 210, to: 1260, q: 1.5 } },
        { type: "brown", seconds: 0.6, attack: 0.08, gain: 0.5, filter: { type: "lowpass", from: 180, to: 70, q: 1 } },
        { type: "sine", from: 48, to: 30, seconds: 0.6, attack: 0.05, gain: 0.4 },
      ],
    },
    // Lantern winds up: Chain swing.
    ghoulKeeperLanternWind: {
      layers: [
        { type: "triangle", from: 700, to: 595, seconds: 0.22, attack: 0, gain: 0.45 },
        { type: "sine", from: 1890, to: 1750, seconds: 0.12, attack: 0, gain: 0.18 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.25, filter: { type: "bandpass", from: 2800, to: 2800, q: 2 } },
        { type: "triangle", from: 800, to: 680, seconds: 0.22, attack: 0, gain: 0.45, delay: 0.15 },
        { type: "sine", from: 2160, to: 2000, seconds: 0.12, attack: 0, gain: 0.18, delay: 0.15 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.25, filter: { type: "bandpass", from: 3200, to: 3200, q: 2 }, delay: 0.15 },
        { type: "noise", seconds: 0.4, attack: 0.14, gain: 0.4, filter: { type: "bandpass", from: 300, to: 1800, q: 1.5 }, delay: 0.2 },
      ],
    },
    // Lantern thrown: Spinning flame.
    ghoulKeeperLanternThrow: {
      layers: [
        { type: "noise", seconds: 0.5, attack: 0.18, gain: 0.8, filter: { type: "bandpass", from: 480, to: 2880, q: 1.5 } },
        { type: "noise", seconds: 0.4, attack: 0.06, gain: 0.32, filter: { type: "highpass", from: 2880, to: 6000, q: 1 } },
        { type: "pink", seconds: 0.4, attack: 0.05, gain: 0.2, filter: { type: "bandpass", from: 3840, to: 2640, q: 2 } },
      ],
    },
    // The patch catches: Oil splat and sizzle.
    ghoulKeeperFire: {
      layers: [
        { type: "noise", seconds: 0.28, attack: 0, gain: 0.9, filter: { type: "lowpass", from: 2860, to: 220, q: 1 } },
        { type: "square", from: 154, to: 44, seconds: 0.16, attack: 0, gain: 0.5, filter: { type: "lowpass", from: 660, to: 660, q: 1 } },
        { type: "sine", from: 990, to: 1430, seconds: 0.05, delay: 0.2, gain: 0.25 },
        { type: "sine", from: 836, to: 1210, seconds: 0.05, delay: 0.34, gain: 0.18 },
        { type: "noise", seconds: 0.7, attack: 0.06, gain: 0.8, filter: { type: "highpass", from: 2400, to: 5000, q: 1 }, delay: 0.1 },
        { type: "pink", seconds: 0.7, attack: 0.05, gain: 0.5, filter: { type: "bandpass", from: 3200, to: 2200, q: 2 }, delay: 0.1 },
      ],
    },
    // Lantern opens: Latch click and hum.
    ghoulKeeperLanternOpen: {
      layers: [
        { type: "triangle", from: 1500, to: 1275, seconds: 0.22, attack: 0, gain: 0.54 },
        { type: "sine", from: 4050, to: 3750, seconds: 0.12, attack: 0, gain: 0.21 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.3, filter: { type: "bandpass", from: 6000, to: 6000, q: 2 } },
        { type: "sine", from: 182, to: 140, seconds: 0.5, attack: 0.05, gain: 0.36, vibrato: { rate: 9, depth: 0.4 }, delay: 0.05 },
        { type: "brown", seconds: 0.5, attack: 0.05, gain: 0.24, filter: { type: "lowpass", from: 1000, to: 500, q: 1 }, delay: 0.05 },
      ],
    },
    // Climbs on the mower: Sputter, sputter, roar.
    ghoulKeeperMower: {
      layers: [
        { type: "sine", from: 110, to: 40, seconds: 0.25, attack: 0, gain: 0.7 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.56, filter: { type: "lowpass", from: 320, to: 320, q: 1 } },
        { type: "sine", from: 110, to: 40, seconds: 0.25, attack: 0, gain: 0.7, delay: 0.18 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.56, filter: { type: "lowpass", from: 320, to: 320, q: 1 }, delay: 0.18 },
        { type: "sine", from: 110, to: 40, seconds: 0.25, attack: 0, gain: 0.8, delay: 0.32 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.64, filter: { type: "lowpass", from: 320, to: 320, q: 1 }, delay: 0.32 },
        { type: "sawtooth", from: 38, to: 48, seconds: 0.24, attack: 0.05, gain: 0.72, vibrato: { rate: 9, depth: 0.1 }, filter: { type: "lowpass", from: 300, to: 1760, q: 4 }, delay: 0.45 },
        { type: "sawtooth", from: 48, to: 29, seconds: 0.49, delay: 0.66, attack: 0.02, gain: 0.72, vibrato: { rate: 9, depth: 0.12 }, filter: { type: "lowpass", from: 1760, to: 260, q: 4 } },
        { type: "sawtooth", from: 21, to: 20, seconds: 0.7, attack: 0.08, gain: 0.48, filter: { type: "lowpass", from: 500, to: 500, q: 1 }, delay: 0.45 },
        { type: "brown", seconds: 0.7, attack: 0.06, gain: 0.64, filter: { type: "lowpass", from: 900, to: 180, q: 1 }, delay: 0.45 },
        { type: "sine", from: 21, to: 20, seconds: 0.7, attack: 0.05, gain: 0.56, delay: 0.45 },
      ],
    },
    // Revs: Stuttering rev.
    ghoulKeeperRev: {
      layers: [
        { type: "sawtooth", from: 90, to: 67, seconds: 0.2, attack: 0.03, gain: 0.9, vibrato: { rate: 13.5, depth: 0.2 }, filter: { type: "bandpass", from: 504, to: 280, q: 3 } },
        { type: "noise", seconds: 0.18, attack: 0.02, gain: 0.5, filter: { type: "bandpass", from: 1280, to: 560, q: 1.5 } },
        { type: "square", from: 45, to: 39, seconds: 0.2, attack: 0.03, gain: 0.35, filter: { type: "lowpass", from: 400, to: 400, q: 1 } },
        { type: "sawtooth", from: 112, to: 84, seconds: 0.2, attack: 0.03, gain: 0.9, vibrato: { rate: 13.5, depth: 0.2 }, filter: { type: "bandpass", from: 630, to: 350, q: 3 }, delay: 0.22 },
        { type: "noise", seconds: 0.18, attack: 0.02, gain: 0.5, filter: { type: "bandpass", from: 1600, to: 700, q: 1.5 }, delay: 0.22 },
        { type: "square", from: 56, to: 49, seconds: 0.2, attack: 0.03, gain: 0.35, filter: { type: "lowpass", from: 500, to: 500, q: 1 }, delay: 0.22 },
        { type: "sawtooth", from: 146, to: 109, seconds: 0.3, attack: 0.03, gain: 0.9, vibrato: { rate: 13.5, depth: 0.2 }, filter: { type: "bandpass", from: 819, to: 455, q: 3 }, delay: 0.44 },
        { type: "noise", seconds: 0.27, attack: 0.02, gain: 0.5, filter: { type: "bandpass", from: 2080, to: 910, q: 1.5 }, delay: 0.44 },
        { type: "square", from: 73, to: 64, seconds: 0.3, attack: 0.03, gain: 0.35, filter: { type: "lowpass", from: 650, to: 650, q: 1 }, delay: 0.44 },
      ],
    },
    // Charges: Grinding roar.
    ghoulKeeperCharge: {
      layers: [
        { type: "sawtooth", from: 78, to: 59, seconds: 0.5, attack: 0.03, gain: 0.9, vibrato: { rate: 13.5, depth: 0.2 }, filter: { type: "bandpass", from: 441, to: 245, q: 3 } },
        { type: "noise", seconds: 0.45, attack: 0.02, gain: 0.5, filter: { type: "bandpass", from: 1120, to: 490, q: 1.5 } },
        { type: "square", from: 39, to: 34, seconds: 0.5, attack: 0.03, gain: 0.35, filter: { type: "lowpass", from: 350, to: 350, q: 1 } },
        { type: "sawtooth", from: 50, to: 64, seconds: 0.28, attack: 0.05, gain: 0.63, vibrato: { rate: 9, depth: 0.1 }, filter: { type: "lowpass", from: 300, to: 1760, q: 4 }, delay: 0.1 },
        { type: "sawtooth", from: 64, to: 39, seconds: 0.56, delay: 0.34, attack: 0.02, gain: 0.63, vibrato: { rate: 9, depth: 0.12 }, filter: { type: "lowpass", from: 1760, to: 260, q: 4 } },
        { type: "sawtooth", from: 28, to: 20, seconds: 0.8, attack: 0.08, gain: 0.42, filter: { type: "lowpass", from: 500, to: 500, q: 1 }, delay: 0.1 },
        { type: "brown", seconds: 0.8, attack: 0.06, gain: 0.56, filter: { type: "lowpass", from: 900, to: 180, q: 1 }, delay: 0.1 },
        { type: "sine", from: 28, to: 20, seconds: 0.8, attack: 0.05, gain: 0.49, delay: 0.1 },
      ],
    },
    // Stalls: Deflating engine.
    ghoulKeeperStall: {
      layers: [
        { type: "triangle", from: 84, to: 63, seconds: 1, attack: 0.25, gain: 0.72, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 1680, to: 1080, q: 1 } },
        { type: "sine", from: 168, to: 126, seconds: 1, attack: 0.3, gain: 0.24 },
        { type: "pink", seconds: 1, attack: 0.3, gain: 0.2, filter: { type: "bandpass", from: 336, to: 252, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.3, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1656, to: 1325, q: 6 } },
        { type: "square", from: 497, to: 302, seconds: 0.02, delay: 0.3, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.41, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1560, to: 1248, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.5, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2030, to: 1624, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.61, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2049, to: 1639, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.75, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2334, to: 1867, q: 6 } },
        { type: "square", from: 450, to: 326, seconds: 0.02, delay: 0.75, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.96, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1504, to: 1203, q: 6 } },
      ],
    },
    // Takes a hit: Wheezing curse.
    ghoulKeeperHurt: {
      layers: [
        { type: "noise", seconds: 0.22, attack: 0.15, gain: 0.7, filter: { type: "bandpass", from: 660, to: 1440, q: 4 } },
        { type: "sawtooth", from: 84, to: 109, seconds: 0.2, attack: 0.14, gain: 0.25, filter: { type: "lowpass", from: 840, to: 840, q: 1 } },
        { type: "pink", seconds: 0.3, attack: 0.25, gain: 0.4, filter: { type: "bandpass", from: 420, to: 1560, q: 5 }, delay: 0.1 },
        { type: "noise", seconds: 0.21, delay: 0.22, attack: 0.1, gain: 0.25, filter: { type: "bandpass", from: 1560, to: 540, q: 8 } },
      ],
    },
    // Lantern hit: Sparkling pop.
    ghoulKeeperWeak: {
      layers: [
        { type: "noise", seconds: 0.5, attack: 0, gain: 0.5, filter: { type: "lowpass", from: 8400, to: 300, q: 1 } },
        { type: "sine", from: 320, to: 70, seconds: 0.4, attack: 0, gain: 0.45 },
        { type: "brown", seconds: 0.6, attack: 0.01, gain: 0.35, filter: { type: "lowpass", from: 800, to: 800, q: 1 } },
        { type: "sine", notes: [2200, 1848, 1474, 1100], seconds: 0.6, attack: 0.02, gain: 0.24, vibrato: { rate: 7, depth: 0.02 }, delay: 0.05 },
        { type: "triangle", notes: [3300, 2772, 2200, 1650], seconds: 0.6, attack: 0.02, gain: 0.1, delay: 0.05 },
      ],
    },
    // Dies: Lantern fizzles out.
    ghoulKeeperDie: {
      layers: [
        { type: "sawtooth", from: 73, to: 50, seconds: 0.16, attack: 0.01, gain: 0.9, vibrato: { rate: 9, depth: 0.1 }, filter: { type: "lowpass", from: 704, to: 704, q: 1 } },
        { type: "brown", seconds: 0.13, attack: 0.01, gain: 0.6, filter: { type: "lowpass", from: 400, to: 400, q: 1 } },
        { type: "noise", seconds: 0.8, attack: 0.06, gain: 0.8, filter: { type: "highpass", from: 2400, to: 5000, q: 1 }, delay: 0.1 },
        { type: "pink", seconds: 0.8, attack: 0.05, gain: 0.5, filter: { type: "bandpass", from: 3200, to: 2200, q: 2 }, delay: 0.1 },
        { type: "sine", notes: [600, 504, 402, 300], seconds: 0.9, attack: 0.02, gain: 0.18, vibrato: { rate: 7, depth: 0.02 }, delay: 0.2 },
        { type: "triangle", notes: [900, 756, 600, 450], seconds: 0.9, attack: 0.02, gain: 0.08, delay: 0.2 },
      ],
    },
    // Hedge Shears: The power-up: for 10 seconds your shots snip hedge animals and roots in one.
    // Snip: Scissor shing.
    ghoulShearsSnip: {
      layers: [
        { type: "noise", seconds: 0.15, attack: 0.05, gain: 0.8, filter: { type: "bandpass", from: 600, to: 3600, q: 1.5 } },
        { type: "noise", seconds: 0.05, attack: 0, gain: 1, filter: { type: "bandpass", from: 3240, to: 2160, q: 2 }, delay: 0.1 },
        { type: "square", from: 1620, to: 540, seconds: 0.05, attack: 0, gain: 0.4, delay: 0.1 },
        { type: "noise", seconds: 0.04, delay: 0.16, attack: 0, gain: 0.7, filter: { type: "bandpass", from: 4680, to: 3240, q: 3 } },
        { type: "sine", notes: [2600, 2184, 1742, 1300], seconds: 0.3, attack: 0.02, gain: 0.12, vibrato: { rate: 7, depth: 0.02 }, delay: 0.1 },
        { type: "triangle", notes: [3900, 3276, 2600, 1950], seconds: 0.3, attack: 0.02, gain: 0.05, delay: 0.1 },
      ],
    },
  },
  // The Grounds' rooms: the Hedge Maze, the Topiary Walk, the Gazebo and the
  // Groundskeeper's Yard (his fight), picked in prototypes/music/ghoul-rush.
  music: {
    // The Hedge Maze: slow harpsichord, going in circles. A slow harpsichord
    // arpeggio that turns back on itself every six notes while the chords
    // fall (Dm, C, Bb, A), so the music seems to go somewhere and arrive
    // nowhere. The second section lands on a bright D major chord that feels
    // wrong, and the third bends the party tune slowly through Eb and G#. A
    // clock-like tick of shears runs underneath.
    ghoulMaze: {
      bpm: 78,
      rush: 6,
      voices: {
        drone: { wave: "sine", gain: 0.5, decay: 0.3, sustain: 0.95 },
        bass: { wave: "triangle", gain: 0.7, decay: 0.08, sustain: 0.55 },
        harp: { wave: "pulse", duty: 0.125, gain: 0.17, decay: 0.03, sustain: 0.18, from: 0.2 },
        mel: { wave: "triangle", gain: 0.24, decay: 0.12, sustain: 0.7, from: 0.4, vibrato: { rate: 5, depth: 0.008, delay: 0.3 } },
        tick: { kit: true, gain: 0.22, from: 0.25 },
      },
      patterns: {
        A: {
          drone:
          "D1 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -",
          bass:
          "D2 - - - - - - - - - - - . . . . | C2 - - - - - - - - - - - . . . . | " +
          "Bb1 - - - - - - - - - - - . . . . | A1 - - - - - - - - - - - . . . .",
          harp:
          "D3 F3 A3 D4 A3 F3 D3 F3 A3 D4 A3 F3 D3 F3 A3 D4 | G3 E3 C3 E3 G3 C4 G3 E3 C3 E3 G3 C4 G3 E3 C3 E3 | " +
          "F3 Bb3 F3 D3 Bb2 D3 F3 Bb3 F3 D3 Bb2 D3 F3 Bb3 F3 D3 | A2 C#3 E3 A3 E3 C#3 A2 C#3 E3 A3 E3 C#3 A2 C#3 E3 A3",
          mel:
          "A4 - - - - - - - F4 - - - A4 - - - | G4 - - - - - - - E4 - - - G4 - - - | " +
          "F4 - - - - - - - D4 - - - F4 - - - | E4 - - - C#5 - - - A4 - - - - - - -",
          tick:
          "h . . . h . . . h . . . h . . . | h . . . h . . . h . . . h . . . | " +
          "h . . . h . . . h . . . h . . . | h . . . h . h h h . . . o . . .",
        },
        B: {
          drone:
          "D1 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -",
          bass:
          "G1 - - - - - - - - - - - . . . . | Eb2 - - - - - - - - - - - . . . . | " +
          "A1 - - - - - - - - - - - . . . . | D2 - - - - - - - - - - - . . . .",
          harp:
          "G2 Bb2 D3 G3 D3 Bb2 G2 Bb2 D3 G3 D3 Bb2 G2 Bb2 D3 G3 | Bb3 G3 Eb3 G3 Bb3 Eb4 Bb3 G3 Eb3 G3 Bb3 Eb4 Bb3 G3 Eb3 G3 | " +
          "E3 A3 E3 C#3 A2 C#3 E3 A3 E3 C#3 A2 C#3 E3 A3 E3 C#3 | D3 F#3 A3 D4 A3 F#3 D3 F#3 A3 D4 A3 F#3 D3 F#3 A3 D4",
          mel:
          "D5 - - - F5 - - - A5 - - - - - - - | G5 - - - Bb5 - - - G5 - - - - - - - | " +
          "E5 - - - A5 - - - C#6 - - - - - - - | D6 - - - Bb5 - - - Eb5 - - - - - - -",
          tick:
          "h . . . h . . . h . . . h . . . | h . . . h . . . h . . . h . . . | " +
          "h . . . h . . . h . . . h . . . | h . . . h . h h h . . . o . . .",
        },
        C: {
          drone:
          "D1 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -",
          bass:
          "D2 - - - - - - - - - - - . . . . | Eb2 - - - - - - - - - - - . . . . | " +
          "A1 - - - - - - - - - - - . . . . | D2 - - - - - - - - - - - . . . .",
          harp:
          "D3 F3 A3 D4 A3 F3 D3 F3 A3 D4 A3 F3 D3 F3 A3 D4 | Bb3 G3 Eb3 G3 Bb3 Eb4 Bb3 G3 Eb3 G3 Bb3 Eb4 Bb3 G3 Eb3 G3 | " +
          "E3 A3 E3 C#3 A2 C#3 E3 A3 E3 C#3 A2 C#3 E3 A3 E3 C#3 | D3 F#3 A3 D4 A3 F#3 D3 F#3 A3 D4 A3 F#3 D3 F#3 A3 D4",
          mel:
          "D5 - - - F#5 - - - A5 - - - - - - - | G5 - - - F#5 - - - E5 - - - - - - - | " +
          "D5 - - - F#5 - - - A5 - - - - - - - | Eb5 - - - G#5 - - - A5 - - - - - - -",
          tick:
          "h . . . h . . . h . . . h . . . | h . . . h . . . h . . . h . . . | " +
          "h . . . h . . . h . . . h . . . | h . . . h . h h h . . . o . . .",
        },
      },
      order: ["A", "B", "A", "C"],
    },
    // The Topiary Walk: music-box waltz, out of true. A music box tinkles the
    // lopsided party waltz (D, F#, A, then the spoiled Eb and G#) with a
    // sparkle an octave up and, at higher dread, a twin that follows a step
    // behind and a semitone off, like a shape clipped almost right. Clippers
    // snip between the bars. The tune never quite sits still.
    ghoulTopiary: {
      bpm: 126,
      rush: 8,
      voices: {
        drone: { wave: "sine", gain: 0.5, decay: 0.3, sustain: 0.95 },
        bass: { wave: "triangle", gain: 0.66, decay: 0.08, sustain: 0.5 },
        pah: { wave: "pulse", duty: 0.5, gain: 0.08, decay: 0.03, sustain: 0.3, from: 0.2 },
        snip: { kit: true, gain: 0.26, from: 0.25 },
        box: { wave: "pulse", duty: 0.125, gain: 0.19, decay: 0.03, sustain: 0.2, from: 0.1 },
        sparkle: { wave: "triangle", gain: 0.14, decay: 0.05, sustain: 0.25, from: 0.4 },
        twin: { wave: "pulse", duty: 0.125, gain: 0.07, decay: 0.03, sustain: 0.2, from: 0.6 },
      },
      patterns: {
        A: {
          drone:
          "D1 - - - - - - - - - - - | - - - - - - - - - - - - | " +
          "- - - - - - - - | - - - - - - - - - - - - - - - -",
          bass:
          "D2 - . . . . . . . . . . | G2 - . . . . . . . . . . | " +
          "A2 - . . . . . . | Bb2 - . . . . . . . . . . . . . .",
          pah:
          ". . . . D4^047 . . . D4^047 . . . | . . . . G3^047 . . . G3^047 . . . | " +
          ". . . . A3^047a . . . | . . . . Bb3^047 . . . Bb3^047 . . . Bb3^047 . . .",
          snip:
          ". . . h h . . h h . . . | . . . h h . . h h . . . | " +
          ". . . h h . . . | . . . h h . . h h . . . o . . .",
          box:
          "D5 - - . F#5 - - . A5 - - - | G5 - - . F#5 - - . E5 - - - | " +
          "D5 - . . F#5 - - - | Eb5 - - . G#5 - - . A5 - - . . . . .",
          sparkle:
          ". . D6 - - . F#6 - - . A6 - | - - G6 - - . F#6 - - . E6 - | " +
          "- - D6 - . . F#6 - | - - D#6 - - . G#6 - - . A6 - - . . .",
          twin:
          ". D#5 - - . G5 - - . A#5 - - | - G#5 - - . G5 - - . F5 - - | " +
          "- D#5 - . . G5 - - | - E5 - - . A5 - - . A#5 - - . . . .",
        },
        B: {
          drone:
          "D1 - - - - - - - - - - - | - - - - - - - - - - - - | " +
          "- - - - - - - - | - - - - - - - - - - - - - - - -",
          bass:
          "D2 - . . . . . . . . . . | Bb1 - . . . . . . . . . . | " +
          "G2 - . . . . . . | A2 - . . . . . . . . . . . . . .",
          pah:
          ". . . . D4^037 . . . D4^037 . . . | . . . . Bb3^047 . . . Bb3^047 . . . | " +
          ". . . . G3^037 . . . | . . . . A3^047 . . . A3^047 . . . A3^047 . . .",
          snip:
          ". . . h h . . h h . . . | . . . h h . . h h . . . | " +
          ". . . h h . . . | . . . h h . . h h . . . o . . .",
          box:
          "A5 - - . Bb5 - - . A5 - - - | F5 - - . E5 - - . D5 - - - | " +
          "C#5 - . . E5 - - - | F5 - - . Ab5 - - . G5 - - . . . . .",
          sparkle:
          ". . A6 - - . A#6 - - . A6 - | - - F6 - - . E6 - - . D6 - | " +
          "- - C#6 - . . E6 - | - - F6 - - . G#6 - - . G6 - - . . .",
          twin:
          ". A#5 - - . B5 - - . A#5 - - | - F#5 - - . F5 - - . D#5 - - | " +
          "- D5 - . . F5 - - | - F#5 - - . A5 - - . G#5 - - . . . .",
        },
        C: {
          drone:
          "D1 - - - - - - - - - - - | - - - - - - - - - - - - | " +
          "- - - - - - - - | - - - - - - - - - - - - - - - -",
          bass:
          "D2 - . . . . . . . . . . | Eb2 - . . . . . . . . . . | " +
          "A1 - . . . . . . | D2 - . . . . . . . . . . . . . .",
          pah:
          ". . . . D4^037 . . . D4^037 . . . | . . . . Eb4^047 . . . Eb4^047 . . . | " +
          ". . . . A3^047a . . . | . . . . D4^037 . . . D4^037 . . . D4^037 . . .",
          snip:
          ". . . h h . . h h . . . | . . . h h . . h h . . . | " +
          ". . . h h . . . | . . . h h . . h h . . . o . . .",
          box:
          "D5 - - . F5 - - . A5 - - - | G5 - - . F5 - - . E5 - - - | " +
          "D5 - . . C5 - - - | Bb4 - - . A4 - - . D4 - - - . . . .",
          sparkle:
          ". . D6 - - . F6 - - . A6 - | - - G6 - - . F6 - - . E6 - | " +
          "- - D6 - . . C6 - | - - A#5 - - . A5 - - . D5 - - - . .",
          twin:
          ". D#5 - - . F#5 - - . A#5 - - | - G#5 - - . F#5 - - . F5 - - | " +
          "- D#5 - . . C#5 - - | - B4 - - . A#4 - - . D#4 - - - . . .",
        },
      },
      order: ["A", "A", "B", "A", "C", "A", "B", "C"],
    },
    // The Gazebo: last reel by the fiddle. The last dance of the night: a
    // sawtooth drone, a stamping foot and clapping shears under a fiddle jig
    // in 6/8 that goes round and round. In the second section the jig turns
    // sour (Bb, a stray B natural and Eb) and in the third the fiddle drops
    // out and a tin whistle plays the party waltz alone against the stamp.
    ghoulGazebo: {
      bpm: 132,
      rush: 8,
      voices: {
        drone: { wave: "sawtooth", gain: 0.16, decay: 0.3, sustain: 0.95 },
        fifth: { wave: "sawtooth", gain: 0.11, decay: 0.3, sustain: 0.95 },
        walk: { wave: "triangle", gain: 0.55, decay: 0.06, sustain: 0.5, from: 0.1 },
        stomp: { kit: true, gain: 0.34, from: 0.35 },
        clap: { kit: true, gain: 0.24, from: 0.3 },
        fiddle: { wave: "pulse", duty: 0.25, gain: 0.15, decay: 0.08, sustain: 0.7, from: 0.15, vibrato: { rate: 6, depth: 0.014, delay: 0.1 } },
        whistle: { wave: "pulse", duty: 0.125, gain: 0.1, decay: 0.1, sustain: 0.6, from: 0.5, vibrato: { rate: 5, depth: 0.008, delay: 0.2 } },
      },
      patterns: {
        A: {
          drone:
          "D2 - - - - - - - - - - - | - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - | - - - - - - - - - - - -",
          fifth:
          "A2 - - - - - - - - - - - | - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - | - - - - - - - - - - - -",
          walk:
          "D2 . . . A2 . D2 . . . A2 . | D2 . . . A2 . D2 . . . A2 . | " +
          "D2 . . . A2 . D2 . . . A2 . | D2 . . . A2 . D2 . . . A2 .",
          stomp:
          "k . . . . . k . . . . . | k . . . . . k . . . . . | " +
          "k . . . . . k . . . . . | k . . . . . k . . . . .",
          clap:
          ". . h h . . . . h h . . | . . h h . . . . h h . . | " +
          ". . h h . . . . h h . . | . . h h . . . . h h . .",
          fiddle:
          "D5 - A4 - D5 - F5 - E5 - D5 - | C5 - A4 - C5 - E5 - D5 - . . | " +
          "D5 - A4 - D5 - F5 - A5 - G5 - | F5 - E5 - D5 - C5 - D5 - . .",
          whistle:
          ". . . . . . . . . . . . | . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . | . . . . . . . . . . . .",
        },
        B: {
          drone:
          "D2 - - - - - - - - - - - | - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - | - - - - - - - - - - - -",
          fifth:
          "A2 - - - - - - - - - - - | - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - | - - - - - - - - - - - -",
          walk:
          "D2 . . . A2 . D2 . . . A2 . | D2 . . . A2 . D2 . . . A2 . | " +
          "D2 . . . A2 . D2 . . . A2 . | D2 . . . A2 . D2 . . . A2 .",
          stomp:
          "k . . . . . k . . . . . | k . . . . . k . . . . . | " +
          "k . . . . . k . . . . . | k . . . . . k . . . . .",
          clap:
          ". . h h . . . . h h . . | . . h h . . . . h h . . | " +
          ". . h h . . . . h h . . | . . h h . . . . h h . .",
          fiddle:
          "A5 - F5 - A5 - Bb5 - A5 - F5 - | G5 - E5 - G5 - B5 - A5 - . . | " +
          "A5 - F5 - A5 - Bb5 - A5 - F5 - | G5 - Eb5 - D5 - C#5 - D5 - . .",
          whistle:
          ". . . . . . . . . . . . | . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . | . . . . . . . . . . . .",
        },
        C: {
          drone:
          "D2 - - - - - - - - - - - | - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - | - - - - - - - - - - - -",
          fifth:
          "A2 - - - - - - - - - - - | - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - | - - - - - - - - - - - -",
          walk:
          "D2 . . . A2 . D2 . . . A2 . | D2 . . . A2 . D2 . . . A2 . | " +
          "D2 . . . A2 . D2 . . . A2 . | D2 . . . A2 . D2 . . . A2 .",
          stomp:
          "k . . . . . k . . . . . | k . . . . . k . . . . . | " +
          "k . . . . . k . . . . . | k . . . . . k . . . . .",
          clap:
          ". . h h . . . . h h . . | . . h h . . . . h h . . | " +
          ". . h h . . . . h h . . | . . h h . . . . h h . .",
          fiddle:
          ". . . . . . . . . . . . | . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . | . . . . . . . . . . . .",
          whistle:
          "D5 - - . F5 - - . A5 - - - | Bb5 - - . A5 - - . G5 - - - | " +
          "F5 - - . E5 - - . D5 - - - | Eb5 - - . C#5 - - . D5 - - -",
        },
      },
      order: ["A", "B", "A", "C", "A", "B", "A", "C"],
    },
    // The Groundskeeper Yard (the Groundskeeper fight): harvest dance gone
    // wrong. A village harvest dance, stamped out in 6/8: a hurdy-gurdy drone
    // of open fifths, heavy foot stomps on each half bar, hand claps off the
    // beat and the shears clipping, with a square pipe playing the sour tune
    // in slow dotted steps. Listen for the pipe lifting to G, then an octave,
    // and a second pipe a tritone away (the worst interval) with pounding
    // double stomps joining at full dread.
    ghoulYard: {
      bpm: 126,
      rush: 10,
      voices: {
        drone: { wave: "sine", gain: 0.55, decay: 0.3, sustain: 0.95 },
        gurdy: { wave: "sawtooth", gain: 0.1, from: 0.15, decay: 0.2, sustain: 0.9, vibrato: { rate: 4, depth: 0.004, delay: 0.3 } },
        stomp: { kit: true, gain: 0.5, from: 0.2 },
        clap: { kit: true, gain: 0.3, from: 0.45 },
        clip: { kit: true, gain: 0.2, from: 0.55 },
        lead: { wave: "pulse", duty: 0.5, gain: 0.15, from: 0.5, decay: 0.08, sustain: 0.75, vibrato: { rate: 5, depth: 0.008, delay: 0.2 } },
        sour: { wave: "pulse", duty: 0.25, gain: 0.08, from: 0.85, decay: 0.06, sustain: 0.7 },
        pound: { kit: true, gain: 0.36, from: 0.9 },
      },
      patterns: {
        A: {
          drone:
          "D1 - - - - - - - - - - - | D1 - - - - - - - - - - - | " +
          "Bb1 - - - - - - - - - - - | A1 - - - - - - - - - - -",
          gurdy:
          "D3^07 - - - - - - - - - - - | D3^07 - - - - - - - - - - - | " +
          "Bb2^07 - - - - - - - - - - - | A2^07 - - - - - - - - - - -",
          stomp:
          "k . . . . . ks . . . . . | k . . . . . ks . . . . . | " +
          "k . . . . . ks . . . . . | k . . . k . k . k . ks ks",
          clap:
          ". . . s . . . . . s . . | . . . s . . . . . s . . | " +
          ". . . s . . . . . s . . | . . . s . . . . . s . .",
          clip:
          "h . h . . h . h . . h . | h . h . . h . h . . h . | " +
          "h . h . . h . h . . h . | h . h . . h . h . . h .",
          pound:
          "k . k . k . ks . k . ks . | k . k . k . ks . k . ks . | " +
          "k . k . k . ks . k . ks . | k k ks k ks k ks ks ks ks ks ks",
          lead:
          "A4 - - - - - D5 - - F#5 - - | A5 - - - - - G#5 - - A5 - - | " +
          "F5 - - - - - E5 - - D5 - - | Eb5 - - - - - D5 - - - - -",
          sour:
          "D#5 - - - - - G#5 - - C6 - - | D#6 - - - - - D6 - - D#6 - - | " +
          "B5 - - - - - A#5 - - G#5 - - | A5 - - - - - G#5 - - - - -",
        },
        B: {
          drone:
          "G1 - - - - - - - - - - - | Eb1 - - - - - - - - - - - | " +
          "Bb1 - - - - - - - - - - - | A1 - - - - - - - - - - -",
          gurdy:
          "G2^07 - - - - - - - - - - - | Eb3^07 - - - - - - - - - - - | " +
          "Bb2^07 - - - - - - - - - - - | A2^07 - - - - - - - - - - -",
          stomp:
          "k . . . . . ks . . . . . | k . . . . . ks . . . . . | " +
          "k . . . . . ks . . . . . | k . . . k . k . k . ks ks",
          clap:
          ". . . s . . . . . s . . | . . . s . . . . . s . . | " +
          ". . . s . . . . . s . . | . . . s . . . . . s . .",
          clip:
          "h . h . . h . h . . h . | h . h . . h . h . . h . | " +
          "h . h . . h . h . . h . | h . h . . h . h . . h .",
          pound:
          "k . k . k . ks . k . ks . | k . k . k . ks . k . ks . | " +
          "k . k . k . ks . k . ks . | k k ks k ks k ks ks ks ks ks ks",
          lead:
          "D5 - - - - - G5 - - B5 - - | D6 - - - - - C#6 - - D6 - - | " +
          "A#5 - - - - - A5 - - G5 - - | G#5 - - - - - G5 - - - - -",
          sour:
          "G#5 - - - - - C#6 - - F6 - - | G#6 - - - - - G6 - - G#6 - - | " +
          "E6 - - - - - D#6 - - C#6 - - | D6 - - - - - C#6 - - - - -",
        },
        C: {
          drone:
          "D1 - - - - - - - - - - - | Bb1 - - - - - - - - - - - | " +
          "C#1 - - - - - - - - - - - | A1 - - - - - - - - - - -",
          gurdy:
          "D3^07 - - - - - - - - - - - | Bb2^07 - - - - - - - - - - - | " +
          "C#3^07 - - - - - - - - - - - | A2^07 - - - - - - - - - - -",
          stomp:
          "k . . . . . ks . . . . . | k . . . . . ks . . . . . | " +
          "k . . . . . ks . . . . . | k . . . k . k . k . ks ks",
          clap:
          ". . . s . . . . . s . . | . . . s . . . . . s . . | " +
          ". . . s . . . . . s . . | . . . s . . . . . s . .",
          clip:
          "h . h . . h . h . . h . | h . h . . h . h . . h . | " +
          "h . h . . h . h . . h . | h . h . . h . h . . h .",
          pound:
          "k . k . k . ks . k . ks . | k . k . k . ks . k . ks . | " +
          "k . k . k . ks . k . ks . | k k ks k ks k ks ks ks ks ks ks",
          lead:
          "A5 - - - - - D6 - - F#6 - - | A6 - - - - - G#6 - - A6 - - | " +
          "F6 - - - - - E6 - - D6 - - | D#6 - - - - - D6 - - - - -",
          sour:
          "D#6 - - - - - G#6 - - C7 - - | D#7 - - - - - D7 - - D#7 - - | " +
          "B6 - - - - - A#6 - - G#6 - - | A6 - - - - - G#6 - - - - -",
        },
      },
      order: ["A", "A", "B", "A", "C", "B", "C"],
    },
  },
};
