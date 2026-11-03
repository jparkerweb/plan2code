// Plan2Code Web Console - ghoul: The Deep Seam Mine's own sound effects and music tracks, merged into ghoul-sfx.js; defines only.
//
// Same shape and rules as ghoul-sfx-graveyard.js: `tones` (the stage's
// monsters' and boss's `ghoul<Kind><Act>` sounds) and `music` (a track per
// room, named in ROOM_MUSIC in ghoul.js). A name may be defined only once
// across tones.js and every game's file. No imports.

export const MINE_SFX = {
  tones: {
    // The Deep Seam Mine's monsters, the Tommyknocker, the rockfall, the wading and
    // the power-ups, picked by ear (prototypes/sounds/ghoul-rush/mine.html).
    // Knocker Imp: A tiny thing of the mine that knocks on the timbers; it skitters at you, steals your light instead of a life, and runs off giggling with the spark.
    // Skitters in: Pebble scatter.
    ghoulImpAppear: {
      layers: [
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 3373, to: 2698, q: 6 } },
        { type: "square", from: 1048, to: 853, seconds: 0.02, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.04, attack: 0, gain: 0.82, filter: { type: "bandpass", from: 3171, to: 2537, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.08, attack: 0, gain: 0.75, filter: { type: "bandpass", from: 4769, to: 3815, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.11, attack: 0, gain: 0.67, filter: { type: "bandpass", from: 4223, to: 3378, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.14, attack: 0, gain: 0.59, filter: { type: "bandpass", from: 5300, to: 4240, q: 6 } },
        { type: "square", from: 1009, to: 998, seconds: 0.02, delay: 0.14, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.18, attack: 0, gain: 0.51, filter: { type: "bandpass", from: 4526, to: 3621, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.21, attack: 0, gain: 0.44, filter: { type: "bandpass", from: 4380, to: 3504, q: 6 } },
        { type: "sine", from: 1400, to: 1820, seconds: 0.08, attack: 0.01, gain: 0.4, vibrato: { rate: 40, depth: 0.08 }, delay: 0.1 },
        { type: "sine", from: 1680, to: 2170, seconds: 0.07, delay: 0.2, attack: 0.01, gain: 0.3, vibrato: { rate: 40, depth: 0.08 } },
      ],
    },
    // Steals your light: Gulp of light.
    ghoulImpSteal: {
      layers: [
        { type: "noise", seconds: 0.22, attack: 0.15, gain: 0.49, filter: { type: "bandpass", from: 1760, to: 3840, q: 4 } },
        { type: "sawtooth", from: 1056, to: 1373, seconds: 0.2, attack: 0.14, gain: 0.18, filter: { type: "lowpass", from: 2240, to: 2240, q: 1 } },
        { type: "sine", from: 858, to: 660, seconds: 0.35, attack: 0.05, gain: 0.45, vibrato: { rate: 9, depth: 0.4 }, delay: 0.15 },
        { type: "brown", seconds: 0.35, attack: 0.05, gain: 0.3, filter: { type: "lowpass", from: 1000, to: 500, q: 1 }, delay: 0.15 },
        { type: "sawtooth", from: 1400, to: 1120, seconds: 0.09, delay: 0.45, attack: 0.01, gain: 0.42, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 3500, to: 2800, q: 3 } },
        { type: "sawtooth", from: 1330, to: 1064, seconds: 0.09, delay: 0.57, attack: 0.01, gain: 0.42, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 3325, to: 2660, q: 3 } },
      ],
    },
    // Light comes back: Twinkle run.
    ghoulImpDrop: {
      layers: [
        { type: "triangle", from: 1500, to: 1275, seconds: 0.22, attack: 0, gain: 0.54 },
        { type: "sine", from: 4050, to: 3750, seconds: 0.12, attack: 0, gain: 0.21 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.3, filter: { type: "bandpass", from: 6000, to: 6000, q: 2 } },
        { type: "triangle", from: 1900, to: 1615, seconds: 0.22, attack: 0, gain: 0.54, delay: 0.08 },
        { type: "sine", from: 5130, to: 4750, seconds: 0.12, attack: 0, gain: 0.21, delay: 0.08 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.3, filter: { type: "bandpass", from: 7600, to: 7600, q: 2 }, delay: 0.08 },
        { type: "triangle", from: 2400, to: 2040, seconds: 0.22, attack: 0, gain: 0.54, delay: 0.16 },
        { type: "sine", from: 6480, to: 6000, seconds: 0.12, attack: 0, gain: 0.21, delay: 0.16 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.3, filter: { type: "bandpass", from: 9600, to: 9600, q: 2 }, delay: 0.16 },
        { type: "sine", notes: [2200, 1848, 1474, 1100], seconds: 0.5, attack: 0.02, gain: 0.18, vibrato: { rate: 7, depth: 0.02 }, delay: 0.2 },
        { type: "triangle", notes: [3300, 2772, 2200, 1650], seconds: 0.5, attack: 0.02, gain: 0.08, delay: 0.2 },
      ],
    },
    // Takes a bolt: Angry chitter.
    ghoulImpHurt: {
      layers: [
        { type: "square", from: 732, to: 513, seconds: 0.03, gain: 0.35, filter: { type: "bandpass", from: 1099, to: 732, q: 4 } },
        { type: "square", from: 790, to: 553, seconds: 0.03, delay: 0.03, gain: 0.35, filter: { type: "bandpass", from: 1186, to: 790, q: 4 } },
        { type: "square", from: 726, to: 508, seconds: 0.03, delay: 0.06, gain: 0.35, filter: { type: "bandpass", from: 1089, to: 726, q: 4 } },
        { type: "square", from: 767, to: 537, seconds: 0.03, delay: 0.09, gain: 0.35, filter: { type: "bandpass", from: 1150, to: 767, q: 4 } },
        { type: "square", from: 556, to: 389, seconds: 0.03, delay: 0.12, gain: 0.35, filter: { type: "bandpass", from: 834, to: 556, q: 4 } },
        { type: "square", from: 543, to: 380, seconds: 0.03, delay: 0.15, gain: 0.35, filter: { type: "bandpass", from: 814, to: 543, q: 4 } },
        { type: "noise", seconds: 0.2, attack: 0.06, gain: 0.32, filter: { type: "highpass", from: 3360, to: 7000, q: 1 } },
        { type: "pink", seconds: 0.2, attack: 0.05, gain: 0.2, filter: { type: "bandpass", from: 4480, to: 3080, q: 2 } },
      ],
    },
    // Dies: Last knock.
    ghoulImpDie: {
      layers: [
        { type: "triangle", from: 460, to: 391, seconds: 0.22, attack: 0, gain: 0.72 },
        { type: "sine", from: 1242, to: 1150, seconds: 0.12, attack: 0, gain: 0.28 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.4, filter: { type: "bandpass", from: 1840, to: 1840, q: 2 } },
        { type: "triangle", from: 380, to: 323, seconds: 0.22, attack: 0, gain: 0.63, delay: 0.2 },
        { type: "sine", from: 1026, to: 950, seconds: 0.12, attack: 0, gain: 0.24, delay: 0.2 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.35, filter: { type: "bandpass", from: 1520, to: 1520, q: 2 }, delay: 0.2 },
        { type: "triangle", from: 300, to: 255, seconds: 0.22, attack: 0, gain: 0.54, delay: 0.45 },
        { type: "sine", from: 810, to: 750, seconds: 0.12, attack: 0, gain: 0.21, delay: 0.45 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.3, filter: { type: "bandpass", from: 1200, to: 1200, q: 2 }, delay: 0.45 },
        { type: "triangle", from: 990, to: 743, seconds: 0.5, attack: 0.25, gain: 0.27, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 4200, to: 2700, q: 1 }, delay: 0.1 },
        { type: "sine", from: 1980, to: 1485, seconds: 0.5, attack: 0.3, gain: 0.09, delay: 0.1 },
        { type: "pink", seconds: 0.5, attack: 0.3, gain: 0.08, filter: { type: "bandpass", from: 3960, to: 2970, q: 6 }, delay: 0.1 },
      ],
    },
    // Canary Ghost: A pale ghostly bird that flits along the ceiling; it is harmless to touch, but near you it screams, and 900 ms later rocks fall around you.
    // Flits in: Ghostly twitter.
    ghoulCanaryAppear: {
      layers: [
        { type: "sine", from: 1500, to: 1950, seconds: 0.08, attack: 0.01, gain: 0.48, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 1800, to: 2325, seconds: 0.07, delay: 0.1, attack: 0.01, gain: 0.36, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 1800, to: 2340, seconds: 0.08, attack: 0.01, gain: 0.4, vibrato: { rate: 40, depth: 0.08 }, delay: 0.15 },
        { type: "sine", from: 2160, to: 2790, seconds: 0.07, delay: 0.25, attack: 0.01, gain: 0.3, vibrato: { rate: 40, depth: 0.08 } },
        { type: "pink", seconds: 0.6, attack: 0.25, gain: 0.32, filter: { type: "bandpass", from: 1120, to: 4160, q: 5 } },
        { type: "noise", seconds: 0.42, delay: 0.24, attack: 0.1, gain: 0.2, filter: { type: "bandpass", from: 4160, to: 1440, q: 8 } },
      ],
    },
    // Screams: Warning trill.
    ghoulCanaryScream: {
      layers: [
        { type: "sawtooth", from: 2300, to: 1840, seconds: 0.09, attack: 0.01, gain: 0.49, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 5750, to: 4600, q: 3 } },
        { type: "sawtooth", from: 2185, to: 1748, seconds: 0.09, delay: 0.07, attack: 0.01, gain: 0.49, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 5463, to: 4370, q: 3 } },
        { type: "sawtooth", from: 2070, to: 1656, seconds: 0.09, delay: 0.14, attack: 0.01, gain: 0.49, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 5175, to: 4140, q: 3 } },
        { type: "sawtooth", from: 1955, to: 1564, seconds: 0.09, delay: 0.21, attack: 0.01, gain: 0.49, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 4888, to: 3910, q: 3 } },
        { type: "sawtooth", from: 1840, to: 1472, seconds: 0.09, delay: 0.28, attack: 0.01, gain: 0.49, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 4600, to: 3680, q: 3 } },
        { type: "sawtooth", from: 1725, to: 1380, seconds: 0.09, delay: 0.35, attack: 0.01, gain: 0.49, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 4313, to: 3450, q: 3 } },
        { type: "sawtooth", from: 2600, to: 3640, seconds: 0.4, attack: 0.03, gain: 0.48, vibrato: { rate: 12, depth: 0.04 }, filter: { type: "bandpass", from: 5200, to: 6240, q: 4 }, delay: 0.4 },
        { type: "sawtooth", from: 3900, to: 5460, seconds: 0.36, attack: 0.04, gain: 0.21, filter: { type: "bandpass", from: 7800, to: 7800, q: 5 }, delay: 0.4 },
        { type: "noise", seconds: 0.32, attack: 0.03, gain: 0.18, filter: { type: "highpass", from: 3000, to: 3000, q: 1 }, delay: 0.4 },
      ],
    },
    // Takes a bolt: Cracked chirp.
    ghoulCanaryHurt: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.5, filter: { type: "bandpass", from: 3240, to: 2160, q: 2 } },
        { type: "square", from: 1620, to: 540, seconds: 0.05, attack: 0, gain: 0.2 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.35, filter: { type: "bandpass", from: 4680, to: 3240, q: 3 } },
        { type: "sine", from: 2000, to: 2600, seconds: 0.08, attack: 0.01, gain: 0.48, vibrato: { rate: 40, depth: 0.08 }, delay: 0.04 },
        { type: "sine", from: 2400, to: 3100, seconds: 0.07, delay: 0.14, attack: 0.01, gain: 0.36, vibrato: { rate: 40, depth: 0.08 } },
      ],
    },
    // Dies: Drop to the floor.
    ghoulCanaryDie: {
      layers: [
        { type: "sawtooth", from: 2600, to: 1560, seconds: 0.4, attack: 0.03, gain: 0.48, vibrato: { rate: 12, depth: 0.04 }, filter: { type: "bandpass", from: 5200, to: 6240, q: 4 } },
        { type: "sawtooth", from: 3900, to: 2340, seconds: 0.36, attack: 0.04, gain: 0.21, filter: { type: "bandpass", from: 7800, to: 7800, q: 5 } },
        { type: "noise", seconds: 0.32, attack: 0.03, gain: 0.18, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
        { type: "triangle", from: 500, to: 425, seconds: 0.22, attack: 0, gain: 0.45, delay: 0.4 },
        { type: "sine", from: 1350, to: 1250, seconds: 0.12, attack: 0, gain: 0.18, delay: 0.4 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.25, filter: { type: "bandpass", from: 2000, to: 2000, q: 2 }, delay: 0.4 },
        { type: "triangle", from: 400, to: 340, seconds: 0.22, attack: 0, gain: 0.36, delay: 0.55 },
        { type: "sine", from: 1080, to: 1000, seconds: 0.12, attack: 0, gain: 0.14, delay: 0.55 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.2, filter: { type: "bandpass", from: 1600, to: 1600, q: 2 }, delay: 0.55 },
      ],
    },
    // Dead Miner: A zombie in a hard hat, its helmet lamp still lit; it bursts out of the back wall in a spray of rubble, walks at you and swings its pickaxe.
    // Shambles in: Helmet rattle.
    ghoulMinerAppear: {
      layers: [
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2095, to: 1676, q: 6 } },
        { type: "square", from: 683, to: 340, seconds: 0.02, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.05, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2125, to: 1700, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.1, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2181, to: 1745, q: 6 } },
        { type: "sine", from: 600, to: 588, seconds: 0.4, attack: 0.003, gain: 0.3, delay: 0.1 },
        { type: "sine", from: 1656, to: 1620, seconds: 0.24, attack: 0.003, gain: 0.15, delay: 0.1 },
        { type: "noise", seconds: 0.03, attack: 0.003, gain: 0.25, delay: 0.1, filter: { type: "bandpass", from: 1800, to: 1800, q: 2 } },
        { type: "sawtooth", from: 79, to: 56, seconds: 0.7, attack: 0.12, gain: 0.54, vibrato: { rate: 4, depth: 0.07 }, filter: { type: "lowpass", from: 900, to: 450, q: 5 }, delay: 0.2 },
        { type: "sawtooth", from: 80, to: 56, seconds: 0.7, attack: 0.14, gain: 0.3, filter: { type: "lowpass", from: 720, to: 360, q: 3 }, delay: 0.2 },
        { type: "brown", seconds: 0.7, attack: 0.1, gain: 0.36, filter: { type: "bandpass", from: 288, to: 216, q: 2 }, delay: 0.2 },
      ],
    },
    // Bursts out of the wall: Rumbling breakthrough.
    ghoulMinerDig: {
      layers: [
        { type: "brown", seconds: 0.8, attack: 0.08, gain: 0.8, filter: { type: "lowpass", from: 180, to: 70, q: 1 } },
        { type: "sine", from: 48, to: 30, seconds: 0.8, attack: 0.05, gain: 0.64 },
        { type: "pink", seconds: 0.6, attack: 0.05, gain: 0.49, delay: 0.3, filter: { type: "bandpass", from: 1200, to: 500, q: 1.5 } },
        { type: "noise", seconds: 0.42, attack: 0.05, gain: 0.28, delay: 0.34, filter: { type: "highpass", from: 2400, to: 3500, q: 1 } },
        { type: "sawtooth", from: 94, to: 65, seconds: 0.16, attack: 0.01, gain: 0.54, vibrato: { rate: 4, depth: 0.1 }, filter: { type: "lowpass", from: 792, to: 792, q: 1 }, delay: 0.5 },
        { type: "brown", seconds: 0.13, attack: 0.01, gain: 0.36, filter: { type: "lowpass", from: 400, to: 400, q: 1 }, delay: 0.5 },
      ],
    },
    // Winds up the pickaxe: Rising whoosh.
    ghoulMinerWind: {
      layers: [
        { type: "noise", seconds: 0.4, attack: 0.14, gain: 0.56, filter: { type: "bandpass", from: 210, to: 1260, q: 1.5 } },
        { type: "sawtooth", from: 140, to: 97, seconds: 0.16, attack: 0.01, gain: 0.54, vibrato: { rate: 4, depth: 0.1 }, filter: { type: "lowpass", from: 1188, to: 1188, q: 1 }, delay: 0.2 },
        { type: "brown", seconds: 0.13, attack: 0.01, gain: 0.36, filter: { type: "lowpass", from: 600, to: 600, q: 1 }, delay: 0.2 },
      ],
    },
    // Swings the pickaxe: Iron clang.
    ghoulMinerSwing: {
      layers: [
        { type: "noise", seconds: 0.25, attack: 0.09, gain: 0.48, filter: { type: "bandpass", from: 300, to: 1800, q: 1.5 } },
        { type: "sine", from: 800, to: 784, seconds: 0.4, attack: 0.003, gain: 0.54, delay: 0.12 },
        { type: "sine", from: 2208, to: 2160, seconds: 0.24, attack: 0.003, gain: 0.27, delay: 0.12 },
        { type: "noise", seconds: 0.03, attack: 0.003, gain: 0.45, delay: 0.12, filter: { type: "bandpass", from: 2400, to: 2400, q: 2 } },
      ],
    },
    // Takes a bolt: Snarl.
    ghoulMinerHurt: {
      layers: [
        { type: "sawtooth", from: 130, to: 97, seconds: 0.3, attack: 0.03, gain: 0.9, vibrato: { rate: 6, depth: 0.2 }, filter: { type: "bandpass", from: 729, to: 405, q: 3 } },
        { type: "noise", seconds: 0.27, attack: 0.02, gain: 0.5, filter: { type: "bandpass", from: 1440, to: 630, q: 1.5 } },
        { type: "square", from: 65, to: 57, seconds: 0.3, attack: 0.03, gain: 0.35, filter: { type: "lowpass", from: 450, to: 450, q: 1 } },
      ],
    },
    // Dies: Rattling last breath.
    ghoulMinerDie: {
      layers: [
        { type: "sine", from: 126, to: 94, seconds: 0.7, attack: 0.05, gain: 0.9, vibrato: { rate: 15, depth: 0.4 } },
        { type: "brown", seconds: 0.7, attack: 0.05, gain: 0.7, filter: { type: "lowpass", from: 700, to: 300, q: 1 } },
        { type: "sine", from: 189, to: 151, seconds: 0.49, delay: 0.11, attack: 0.03, gain: 0.4, vibrato: { rate: 9, depth: 0.5 } },
        { type: "sine", from: 110, to: 40, seconds: 0.25, attack: 0, gain: 0.7, delay: 0.7 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.56, filter: { type: "lowpass", from: 320, to: 320, q: 1 }, delay: 0.7 },
      ],
    },
    // Blind Crawler: A pale eyeless crawler that hunts by sound; it homes in while you run, jump or shoot, and loses you when you stand still.
    // Crawls in: Blind sniffing.
    ghoulBlindAppear: {
      layers: [
        { type: "noise", seconds: 0.22, attack: 0.15, gain: 0.42, filter: { type: "bandpass", from: 990, to: 2160, q: 4 } },
        { type: "sawtooth", from: 216, to: 281, seconds: 0.2, attack: 0.14, gain: 0.15, filter: { type: "lowpass", from: 1260, to: 1260, q: 1 } },
        { type: "noise", seconds: 0.22, attack: 0.15, gain: 0.42, filter: { type: "bandpass", from: 1100, to: 2400, q: 4 }, delay: 0.25 },
        { type: "sawtooth", from: 240, to: 312, seconds: 0.2, attack: 0.14, gain: 0.15, filter: { type: "lowpass", from: 1400, to: 1400, q: 1 }, delay: 0.25 },
        { type: "noise", seconds: 0.22, attack: 0.15, gain: 0.35, filter: { type: "bandpass", from: 935, to: 2040, q: 4 }, delay: 0.5 },
        { type: "sawtooth", from: 204, to: 265, seconds: 0.2, attack: 0.14, gain: 0.13, filter: { type: "lowpass", from: 1190, to: 1190, q: 1 }, delay: 0.5 },
        { type: "sine", from: 168, to: 126, seconds: 0.4, attack: 0.05, gain: 0.36, vibrato: { rate: 15, depth: 0.4 }, delay: 0.4 },
        { type: "brown", seconds: 0.4, attack: 0.05, gain: 0.28, filter: { type: "lowpass", from: 700, to: 300, q: 1 }, delay: 0.4 },
        { type: "sine", from: 252, to: 202, seconds: 0.28, delay: 0.46, attack: 0.03, gain: 0.16, vibrato: { rate: 9, depth: 0.5 } },
      ],
    },
    // Loses you: Questioning click.
    ghoulBlindLost: {
      layers: [
        { type: "triangle", from: 500, to: 425, seconds: 0.22, attack: 0, gain: 0.54 },
        { type: "sine", from: 1350, to: 1250, seconds: 0.12, attack: 0, gain: 0.21 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.3, filter: { type: "bandpass", from: 2000, to: 2000, q: 2 } },
        { type: "triangle", from: 450, to: 383, seconds: 0.22, attack: 0, gain: 0.45, delay: 0.3 },
        { type: "sine", from: 1215, to: 1125, seconds: 0.12, attack: 0, gain: 0.18, delay: 0.3 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.25, filter: { type: "bandpass", from: 1800, to: 1800, q: 2 }, delay: 0.3 },
        { type: "sine", from: 340, to: 442, seconds: 0.08, attack: 0.01, gain: 0.32, vibrato: { rate: 40, depth: 0.08 }, delay: 0.55 },
        { type: "sine", from: 408, to: 527, seconds: 0.07, delay: 0.65, attack: 0.01, gain: 0.24, vibrato: { rate: 40, depth: 0.08 } },
      ],
    },
    // Hears you: Fast clicking scuttle.
    ghoulBlindHear: {
      layers: [
        { type: "square", from: 152, to: 107, seconds: 0.03, gain: 0.3, filter: { type: "bandpass", from: 229, to: 152, q: 4 } },
        { type: "square", from: 203, to: 142, seconds: 0.03, delay: 0.03, gain: 0.3, filter: { type: "bandpass", from: 305, to: 203, q: 4 } },
        { type: "square", from: 170, to: 119, seconds: 0.03, delay: 0.06, gain: 0.3, filter: { type: "bandpass", from: 254, to: 170, q: 4 } },
        { type: "square", from: 203, to: 142, seconds: 0.03, delay: 0.09, gain: 0.3, filter: { type: "bandpass", from: 305, to: 203, q: 4 } },
        { type: "square", from: 179, to: 125, seconds: 0.03, delay: 0.12, gain: 0.3, filter: { type: "bandpass", from: 269, to: 179, q: 4 } },
        { type: "square", from: 206, to: 144, seconds: 0.03, delay: 0.15, gain: 0.3, filter: { type: "bandpass", from: 309, to: 206, q: 4 } },
        { type: "square", from: 159, to: 112, seconds: 0.03, delay: 0.18, gain: 0.3, filter: { type: "bandpass", from: 239, to: 159, q: 4 } },
        { type: "square", from: 155, to: 109, seconds: 0.03, delay: 0.21, gain: 0.3, filter: { type: "bandpass", from: 233, to: 155, q: 4 } },
        { type: "square", from: 190, to: 133, seconds: 0.03, delay: 0.24, gain: 0.3, filter: { type: "bandpass", from: 286, to: 190, q: 4 } },
        { type: "square", from: 179, to: 125, seconds: 0.03, delay: 0.27, gain: 0.3, filter: { type: "bandpass", from: 268, to: 179, q: 4 } },
        { type: "noise", seconds: 0.4, attack: 0.06, gain: 0.32, filter: { type: "highpass", from: 1920, to: 4000, q: 1 }, delay: 0.1 },
        { type: "pink", seconds: 0.4, attack: 0.05, gain: 0.2, filter: { type: "bandpass", from: 2560, to: 1760, q: 2 }, delay: 0.1 },
      ],
    },
    // Takes a bolt: Shell crack.
    ghoulBlindHurt: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.8, filter: { type: "bandpass", from: 1260, to: 840, q: 2 } },
        { type: "square", from: 630, to: 210, seconds: 0.05, attack: 0, gain: 0.32 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.56, filter: { type: "bandpass", from: 1820, to: 1260, q: 3 } },
        { type: "sawtooth", from: 500, to: 300, seconds: 0.2, attack: 0.01, gain: 0.32, vibrato: { rate: 10, depth: 0.03 }, filter: { type: "bandpass", from: 1000, to: 800, q: 2 }, delay: 0.05 },
        { type: "sawtooth", from: 450, to: 250, seconds: 0.26, delay: 0.22, attack: 0.01, gain: 0.22, filter: { type: "bandpass", from: 900, to: 600, q: 2 } },
      ],
    },
    // Dies: Pale husk crumbles.
    ghoulBlindDie: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.7, filter: { type: "bandpass", from: 1080, to: 720, q: 2 } },
        { type: "square", from: 540, to: 180, seconds: 0.05, attack: 0, gain: 0.28 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.49, filter: { type: "bandpass", from: 1560, to: 1080, q: 3 } },
        { type: "sawtooth", from: 145, to: 103, seconds: 0.6, attack: 0.12, gain: 0.45, vibrato: { rate: 6, depth: 0.07 }, filter: { type: "lowpass", from: 700, to: 350, q: 5 }, delay: 0.05 },
        { type: "sawtooth", from: 146, to: 102, seconds: 0.6, attack: 0.14, gain: 0.25, filter: { type: "lowpass", from: 560, to: 280, q: 3 }, delay: 0.05 },
        { type: "brown", seconds: 0.6, attack: 0.1, gain: 0.3, filter: { type: "bandpass", from: 528, to: 396, q: 2 }, delay: 0.05 },
        { type: "pink", seconds: 0.6, attack: 0.05, gain: 0.28, delay: 0.3, filter: { type: "bandpass", from: 960, to: 400, q: 1.5 } },
        { type: "noise", seconds: 0.42, attack: 0.05, gain: 0.16, delay: 0.34, filter: { type: "highpass", from: 1920, to: 2800, q: 1 } },
      ],
    },
    // The Cage Lift: A platform that rides slowly up and down its own track on a chain; it is safe to stand on and never hurts.
    // Rides along: Rolling wheels.
    ghoulCageAppear: {
      layers: [
        { type: "brown", seconds: 1, attack: 0.08, gain: 0.6, filter: { type: "lowpass", from: 270, to: 105, q: 1 } },
        { type: "sine", from: 72, to: 45, seconds: 1, attack: 0.05, gain: 0.48 },
        { type: "sine", from: 600, to: 780, seconds: 0.08, attack: 0.01, gain: 0.32, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 720, to: 930, seconds: 0.07, delay: 0.1, attack: 0.01, gain: 0.24, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 640, to: 832, seconds: 0.08, attack: 0.01, gain: 0.32, vibrato: { rate: 40, depth: 0.08 }, delay: 0.45 },
        { type: "sine", from: 768, to: 992, seconds: 0.07, delay: 0.55, attack: 0.01, gain: 0.24, vibrato: { rate: 40, depth: 0.08 } },
        { type: "triangle", from: 300, to: 255, seconds: 0.22, attack: 0, gain: 0.36, delay: 0.7 },
        { type: "sine", from: 810, to: 750, seconds: 0.12, attack: 0, gain: 0.14, delay: 0.7 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.2, filter: { type: "bandpass", from: 1200, to: 1200, q: 2 }, delay: 0.7 },
      ],
    },
    // Clears away: Bell-like wobble.
    ghoulCageDie: {
      layers: [
        { type: "sine", from: 400, to: 392, seconds: 0.9, attack: 0.003, gain: 0.48 },
        { type: "sine", from: 1104, to: 1080, seconds: 0.54, attack: 0.003, gain: 0.24 },
        { type: "noise", seconds: 0.03, attack: 0.003, gain: 0.4, filter: { type: "bandpass", from: 1200, to: 1200, q: 2 } },
        { type: "sine", from: 430, to: 421, seconds: 0.8, attack: 0.003, gain: 0.3, delay: 0.2 },
        { type: "sine", from: 1187, to: 1161, seconds: 0.48, attack: 0.003, gain: 0.15, delay: 0.2 },
        { type: "noise", seconds: 0.03, attack: 0.003, gain: 0.25, delay: 0.2, filter: { type: "bandpass", from: 1290, to: 1290, q: 2 } },
        { type: "brown", seconds: 0.7, attack: 0.08, gain: 0.3, filter: { type: "lowpass", from: 180, to: 70, q: 1 }, delay: 0.1 },
        { type: "sine", from: 48, to: 30, seconds: 0.7, attack: 0.05, gain: 0.24, delay: 0.1 },
      ],
    },
    // The Tommyknocker: A hulking miner-giant half grown into the rock, a lantern hanging from his helmet and a sledgehammer the size of a door; he knocks, sweeps, blows out the lamps and bursts out of the seam.
    // Wakes: Slow heartbeat in the wall.
    ghoulTommyWake: {
      layers: [
        { type: "sine", from: 66, to: 24, seconds: 0.25, attack: 0, gain: 1 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.8, filter: { type: "lowpass", from: 192, to: 192, q: 1 } },
        { type: "sine", from: 66, to: 24, seconds: 0.25, attack: 0, gain: 0.8, delay: 0.2 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.64, filter: { type: "lowpass", from: 192, to: 192, q: 1 }, delay: 0.2 },
        { type: "sine", from: 66, to: 24, seconds: 0.25, attack: 0, gain: 1, delay: 0.65 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.8, filter: { type: "lowpass", from: 192, to: 192, q: 1 }, delay: 0.65 },
        { type: "sine", from: 66, to: 24, seconds: 0.25, attack: 0, gain: 0.8, delay: 0.85 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.64, filter: { type: "lowpass", from: 192, to: 192, q: 1 }, delay: 0.85 },
        { type: "triangle", from: 55, to: 41, seconds: 1, attack: 0.25, gain: 0.45, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 1400, to: 900, q: 1 } },
        { type: "sine", from: 110, to: 83, seconds: 1, attack: 0.3, gain: 0.15 },
        { type: "pink", seconds: 1, attack: 0.3, gain: 0.13, filter: { type: "bandpass", from: 220, to: 165, q: 6 } },
      ],
    },
    // Knocks: Three heavy rock blows.
    ghoulTommyKnock: {
      layers: [
        { type: "sine", from: 90, to: 32, seconds: 0.45, attack: 0.003, gain: 1 },
        { type: "brown", seconds: 0.5, attack: 0.003, gain: 0.9, filter: { type: "lowpass", from: 500, to: 90, q: 1 } },
        { type: "noise", seconds: 0.07, attack: 0.003, gain: 0.6, filter: { type: "bandpass", from: 1500, to: 800, q: 2 } },
        { type: "sine", from: 90, to: 32, seconds: 0.45, attack: 0.003, gain: 1, delay: 0.38 },
        { type: "brown", seconds: 0.5, attack: 0.003, gain: 0.9, delay: 0.38, filter: { type: "lowpass", from: 500, to: 90, q: 1 } },
        { type: "noise", seconds: 0.07, attack: 0.003, gain: 0.6, delay: 0.38, filter: { type: "bandpass", from: 1500, to: 800, q: 2 } },
        { type: "sine", from: 90, to: 32, seconds: 0.43, attack: 0.003, gain: 1, delay: 0.76 },
        { type: "brown", seconds: 0.43, attack: 0.003, gain: 0.9, delay: 0.76, filter: { type: "lowpass", from: 500, to: 90, q: 1 } },
        { type: "noise", seconds: 0.07, attack: 0.003, gain: 0.6, delay: 0.76, filter: { type: "bandpass", from: 1500, to: 800, q: 2 } },
      ],
    },
    // Winds up the hammer: Deep inhale.
    ghoulTommySweepWind: {
      layers: [
        { type: "noise", seconds: 0.22, attack: 0.15, gain: 0.56, filter: { type: "bandpass", from: 550, to: 1200, q: 4 } },
        { type: "sawtooth", from: 55, to: 72, seconds: 0.2, attack: 0.14, gain: 0.2, filter: { type: "lowpass", from: 700, to: 700, q: 1 } },
        { type: "brown", seconds: 0.5, attack: 0.08, gain: 0.5, filter: { type: "lowpass", from: 180, to: 70, q: 1 } },
        { type: "sine", from: 48, to: 30, seconds: 0.5, attack: 0.05, gain: 0.4 },
        { type: "triangle", from: 66, to: 86, seconds: 0.5, attack: 0.25, gain: 0.36, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 1680, to: 1080, q: 1 }, delay: 0.1 },
        { type: "sine", from: 132, to: 172, seconds: 0.5, attack: 0.3, gain: 0.12, delay: 0.1 },
        { type: "pink", seconds: 0.5, attack: 0.3, gain: 0.1, filter: { type: "bandpass", from: 264, to: 198, q: 6 }, delay: 0.1 },
      ],
    },
    // Sweeps the hammer: Hammer rakes the floor.
    ghoulTommySweep: {
      layers: [
        { type: "noise", seconds: 0.3, attack: 0.11, gain: 0.64, filter: { type: "bandpass", from: 240, to: 1440, q: 1.5 } },
        { type: "pink", seconds: 0.7, attack: 0.05, gain: 0.63, delay: 0.1, filter: { type: "bandpass", from: 960, to: 400, q: 1.5 } },
        { type: "noise", seconds: 0.49, attack: 0.05, gain: 0.36, delay: 0.14, filter: { type: "highpass", from: 1920, to: 2800, q: 1 } },
        { type: "brown", seconds: 0.7, attack: 0.08, gain: 0.5, filter: { type: "lowpass", from: 180, to: 70, q: 1 }, delay: 0.1 },
        { type: "sine", from: 48, to: 30, seconds: 0.7, attack: 0.05, gain: 0.4, delay: 0.1 },
      ],
    },
    // Lights out: Giant breath, hiss.
    ghoulTommyDark: {
      layers: [
        { type: "noise", seconds: 0.6, attack: 0.21, gain: 0.72, filter: { type: "bandpass", from: 180, to: 1080, q: 1.5 } },
        { type: "noise", seconds: 0.7, attack: 0.02, gain: 0.56, filter: { type: "highpass", from: 1680, to: 3500, q: 1 }, delay: 0.1 },
        { type: "pink", seconds: 0.7, attack: 0.05, gain: 0.35, filter: { type: "bandpass", from: 2240, to: 1540, q: 2 }, delay: 0.1 },
        { type: "sine", notes: [400, 336, 268, 200], seconds: 0.7, attack: 0.02, gain: 0.18, vibrato: { rate: 7, depth: 0.02 }, delay: 0.2 },
        { type: "triangle", notes: [600, 504, 400, 300], seconds: 0.7, attack: 0.02, gain: 0.08, delay: 0.2 },
      ],
    },
    // Sinks into the seam: Tunnelling scratch.
    ghoulTommySink: {
      layers: [
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2442, to: 1954, q: 6 } },
        { type: "square", from: 441, to: 450, seconds: 0.02, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.1, attack: 0, gain: 0.82, filter: { type: "bandpass", from: 2149, to: 1719, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.2, attack: 0, gain: 0.75, filter: { type: "bandpass", from: 2171, to: 1737, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.33, attack: 0, gain: 0.67, filter: { type: "bandpass", from: 1791, to: 1433, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.46, attack: 0, gain: 0.59, filter: { type: "bandpass", from: 1986, to: 1589, q: 6 } },
        { type: "square", from: 441, to: 374, seconds: 0.02, delay: 0.46, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.62, attack: 0, gain: 0.51, filter: { type: "bandpass", from: 2369, to: 1895, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.77, attack: 0, gain: 0.44, filter: { type: "bandpass", from: 1488, to: 1191, q: 6 } },
        { type: "brown", seconds: 0.9, attack: 0.1, gain: 0.6, filter: { type: "lowpass", from: 400, to: 100, q: 1 } },
      ],
    },
    // Knocking in the dark: Far-off thump.
    ghoulTommyKnockDark: {
      layers: [
        { type: "sine", from: 77, to: 28, seconds: 0.25, attack: 0, gain: 0.5 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.4, filter: { type: "lowpass", from: 224, to: 224, q: 1 } },
        { type: "brown", seconds: 0.35, attack: 0.08, gain: 0.15, filter: { type: "lowpass", from: 180, to: 70, q: 1 } },
        { type: "sine", from: 48, to: 30, seconds: 0.35, attack: 0.05, gain: 0.12 },
      ],
    },
    // Bursts out: Boom and falling grit.
    ghoulTommyBurst: {
      layers: [
        { type: "sine", from: 80, to: 30, seconds: 0.6, attack: 0.003, gain: 1 },
        { type: "noise", seconds: 0.5, attack: 0, gain: 0.7, filter: { type: "lowpass", from: 2100, to: 75, q: 1 } },
        { type: "sine", from: 80, to: 20, seconds: 0.4, attack: 0, gain: 0.63 },
        { type: "brown", seconds: 0.6, attack: 0.01, gain: 0.49, filter: { type: "lowpass", from: 200, to: 200, q: 1 } },
        { type: "pink", seconds: 0.9, attack: 0.05, gain: 0.56, delay: 0.2, filter: { type: "bandpass", from: 1080, to: 450, q: 1.5 } },
        { type: "noise", seconds: 0.63, attack: 0.05, gain: 0.32, delay: 0.24, filter: { type: "highpass", from: 2160, to: 3150, q: 1 } },
      ],
    },
    // Rages: Furious bellow.
    ghoulTommyRage: {
      layers: [
        { type: "sawtooth", from: 35, to: 44, seconds: 0.32, attack: 0.05, gain: 0.81, vibrato: { rate: 3, depth: 0.1 }, filter: { type: "lowpass", from: 300, to: 1320, q: 4 } },
        { type: "sawtooth", from: 44, to: 27, seconds: 0.63, delay: 0.27, attack: 0.02, gain: 0.81, vibrato: { rate: 3, depth: 0.12 }, filter: { type: "lowpass", from: 1320, to: 260, q: 4 } },
        { type: "sawtooth", from: 20, to: 20, seconds: 0.9, attack: 0.08, gain: 0.54, filter: { type: "lowpass", from: 500, to: 500, q: 1 } },
        { type: "brown", seconds: 0.9, attack: 0.06, gain: 0.72, filter: { type: "lowpass", from: 900, to: 180, q: 1 } },
        { type: "sine", from: 20, to: 20, seconds: 0.9, attack: 0.05, gain: 0.63 },
        { type: "brown", seconds: 1, attack: 0.08, gain: 0.6, filter: { type: "lowpass", from: 180, to: 70, q: 1 } },
        { type: "sine", from: 48, to: 30, seconds: 1, attack: 0.05, gain: 0.48 },
      ],
    },
    // Takes a bolt: Stone chip.
    ghoulTommyHurt: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0.003, gain: 0.72, filter: { type: "bandpass", from: 2080, to: 1200, q: 3 } },
        { type: "triangle", from: 1120, to: 560, seconds: 0.09, attack: 0.003, gain: 0.4 },
        { type: "sine", from: 128, to: 56, seconds: 0.12, attack: 0.003, gain: 0.48 },
        { type: "sawtooth", from: 50, to: 35, seconds: 0.16, attack: 0.01, gain: 0.54, vibrato: { rate: 3, depth: 0.1 }, filter: { type: "lowpass", from: 462, to: 462, q: 1 }, delay: 0.05 },
        { type: "brown", seconds: 0.13, attack: 0.01, gain: 0.36, filter: { type: "lowpass", from: 350, to: 350, q: 1 }, delay: 0.05 },
      ],
    },
    // Hit while dazed: Wobbling howl.
    ghoulTommyWeak: {
      layers: [
        { type: "sawtooth", from: 83, to: 116, seconds: 0.41, attack: 0.1, gain: 0.49, vibrato: { rate: 6, depth: 0.03 }, filter: { type: "bandpass", from: 193, to: 248, q: 3 } },
        { type: "sawtooth", from: 116, to: 72, seconds: 0.54, delay: 0.38, attack: 0.03, gain: 0.49, vibrato: { rate: 6, depth: 0.04 }, filter: { type: "bandpass", from: 248, to: 138, q: 3 } },
        { type: "pink", seconds: 0.9, attack: 0.2, gain: 0.14, filter: { type: "bandpass", from: 220, to: 165, q: 4 } },
        { type: "sine", from: 66, to: 24, seconds: 0.25, attack: 0, gain: 0.7 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.56, filter: { type: "lowpass", from: 192, to: 192, q: 1 } },
      ],
    },
    // Dies: Long groan, cave-in.
    ghoulTommyDie: {
      layers: [
        { type: "sawtooth", from: 36, to: 26, seconds: 1, attack: 0.12, gain: 0.72, vibrato: { rate: 3, depth: 0.07 }, filter: { type: "lowpass", from: 600, to: 300, q: 5 } },
        { type: "sawtooth", from: 37, to: 26, seconds: 1, attack: 0.14, gain: 0.4, filter: { type: "lowpass", from: 480, to: 240, q: 3 } },
        { type: "brown", seconds: 1, attack: 0.1, gain: 0.48, filter: { type: "bandpass", from: 132, to: 99, q: 2 } },
        { type: "sine", from: 72, to: 26, seconds: 0.45, attack: 0.003, gain: 0.9, delay: 0.6 },
        { type: "brown", seconds: 0.5, attack: 0.003, gain: 0.81, delay: 0.6, filter: { type: "lowpass", from: 400, to: 72, q: 1 } },
        { type: "noise", seconds: 0.07, attack: 0.003, gain: 0.54, delay: 0.6, filter: { type: "bandpass", from: 1200, to: 640, q: 2 } },
        { type: "pink", seconds: 0.5, attack: 0.05, gain: 0.42, delay: 0.7, filter: { type: "bandpass", from: 1200, to: 500, q: 1.5 } },
        { type: "noise", seconds: 0.35, attack: 0.05, gain: 0.24, delay: 0.74, filter: { type: "highpass", from: 2400, to: 3500, q: 1 } },
      ],
    },
    // The Rockfall: Dust trickles from the cracked ceiling, then a rock drops like a chandelier; it crushes monsters and costs you a life, then lies as rubble (a Hard Hat bounces it off).
    // Dust trickles: Cracking overhead.
    ghoulRockWarn: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.6, filter: { type: "bandpass", from: 1260, to: 840, q: 2 } },
        { type: "square", from: 630, to: 210, seconds: 0.05, attack: 0, gain: 0.24 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.42, filter: { type: "bandpass", from: 1820, to: 1260, q: 3 } },
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.6, filter: { type: "bandpass", from: 1080, to: 720, q: 2 }, delay: 0.3 },
        { type: "square", from: 540, to: 180, seconds: 0.05, attack: 0, gain: 0.24, delay: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.36, attack: 0, gain: 0.42, filter: { type: "bandpass", from: 1560, to: 1080, q: 3 } },
        { type: "pink", seconds: 0.5, attack: 0.05, gain: 0.35, delay: 0.2, filter: { type: "bandpass", from: 1440, to: 600, q: 1.5 } },
        { type: "noise", seconds: 0.35, attack: 0.05, gain: 0.2, delay: 0.24, filter: { type: "highpass", from: 2880, to: 4200, q: 1 } },
      ],
    },
    // Rock drops: Boom and rumble.
    ghoulRockFall: {
      layers: [
        { type: "sine", from: 85, to: 28, seconds: 0.6, attack: 0.003, gain: 1 },
        { type: "brown", seconds: 0.9, attack: 0.08, gain: 0.7, filter: { type: "lowpass", from: 180, to: 70, q: 1 } },
        { type: "sine", from: 48, to: 30, seconds: 0.9, attack: 0.05, gain: 0.56 },
        { type: "noise", seconds: 0.2, attack: 0.003, gain: 0.6, filter: { type: "bandpass", from: 1200, to: 500, q: 2 } },
      ],
    },
    // Rubble settles: Rolling pebbles.
    ghoulRockLand: {
      layers: [
        { type: "sine", from: 77, to: 28, seconds: 0.25, attack: 0, gain: 0.7 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.56, filter: { type: "lowpass", from: 224, to: 224, q: 1 } },
        { type: "noise", seconds: 0.04, delay: 0.1, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2141, to: 1713, q: 6 } },
        { type: "square", from: 659, to: 433, seconds: 0.02, delay: 0.1, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.15, attack: 0, gain: 0.83, filter: { type: "bandpass", from: 2245, to: 1796, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.21, attack: 0, gain: 0.77, filter: { type: "bandpass", from: 1941, to: 1553, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.3, attack: 0, gain: 0.7, filter: { type: "bandpass", from: 2424, to: 1939, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.42, attack: 0, gain: 0.63, filter: { type: "bandpass", from: 2171, to: 1737, q: 6 } },
        { type: "square", from: 605, to: 514, seconds: 0.02, delay: 0.42, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.53, attack: 0, gain: 0.56, filter: { type: "bandpass", from: 2708, to: 2167, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.65, attack: 0, gain: 0.5, filter: { type: "bandpass", from: 1857, to: 1486, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.76, attack: 0, gain: 0.43, filter: { type: "bandpass", from: 2072, to: 1657, q: 6 } },
      ],
    },
    // Bounces off the Hard Hat: Iron clang.
    ghoulRockBounce: {
      layers: [
        { type: "sine", from: 750, to: 735, seconds: 0.5, attack: 0.003, gain: 0.6 },
        { type: "sine", from: 2070, to: 2025, seconds: 0.3, attack: 0.003, gain: 0.3 },
        { type: "noise", seconds: 0.03, attack: 0.003, gain: 0.5, filter: { type: "bandpass", from: 2250, to: 2250, q: 2 } },
        { type: "sine", from: 132, to: 48, seconds: 0.25, attack: 0, gain: 0.4 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.32, filter: { type: "lowpass", from: 384, to: 384, q: 1 } },
      ],
    },
    // Wading: Knee-deep water in the Flooded Tunnels: a splash every few steps (and the blind crawlers hear it); it plays often, so keep it quiet.
    // Wading splash: Drip and plop.
    ghoulWaterWade: {
      layers: [
        { type: "sine", from: 630, to: 1350, seconds: 0.07, attack: 0.004, gain: 0.56 },
        { type: "sine", from: 1350, to: 1170, seconds: 0.12, attack: 0.003, gain: 0.2, delay: 0.07 },
        { type: "noise", seconds: 0.15, attack: 0.01, gain: 0.32, delay: 0.1, filter: { type: "bandpass", from: 700, to: 2600, q: 1.2 } },
        { type: "pink", seconds: 0.2, attack: 0.03, gain: 0.2, delay: 0.14, filter: { type: "highpass", from: 1800, to: 3000, q: 1 } },
        { type: "sine", from: 300, to: 120, seconds: 0.12, attack: 0.003, gain: 0.16, delay: 0.1 },
      ],
    },
    // Hard Hat: The power-up: for 12 seconds rocks bounce off you and imps cannot steal your light.
    // Picked up: Armor-up ring.
    ghoulHatActive: {
      layers: [
        { type: "sine", from: 520, to: 510, seconds: 0.3, attack: 0.003, gain: 0.42 },
        { type: "sine", from: 1435, to: 1404, seconds: 0.18, attack: 0.003, gain: 0.21 },
        { type: "noise", seconds: 0.03, attack: 0.003, gain: 0.35, filter: { type: "bandpass", from: 1560, to: 1560, q: 2 } },
        { type: "sine", from: 780, to: 764, seconds: 0.3, attack: 0.003, gain: 0.42, delay: 0.1 },
        { type: "sine", from: 2153, to: 2106, seconds: 0.18, attack: 0.003, gain: 0.21, delay: 0.1 },
        { type: "noise", seconds: 0.03, attack: 0.003, gain: 0.35, delay: 0.1, filter: { type: "bandpass", from: 2340, to: 2340, q: 2 } },
        { type: "sine", from: 1040, to: 1019, seconds: 0.6, attack: 0.003, gain: 0.42, delay: 0.2 },
        { type: "sine", from: 2870, to: 2808, seconds: 0.36, attack: 0.003, gain: 0.21, delay: 0.2 },
        { type: "noise", seconds: 0.03, attack: 0.003, gain: 0.35, delay: 0.2, filter: { type: "bandpass", from: 3120, to: 3120, q: 2 } },
      ],
    },
    // Dynamite: The power-up: three sticks; fire throws a lit stick in an arc that blows up after a second in a wide blast.
    // Picked up: Red alert.
    ghoulDynActive: {
      layers: [
        { type: "sine", from: 1000, to: 1300, seconds: 0.08, attack: 0.01, gain: 0.48, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 1200, to: 1550, seconds: 0.07, delay: 0.1, attack: 0.01, gain: 0.36, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 1200, to: 1560, seconds: 0.08, attack: 0.01, gain: 0.48, vibrato: { rate: 40, depth: 0.08 }, delay: 0.12 },
        { type: "sine", from: 1440, to: 1860, seconds: 0.07, delay: 0.22, attack: 0.01, gain: 0.36, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 1400, to: 1820, seconds: 0.08, attack: 0.01, gain: 0.48, vibrato: { rate: 40, depth: 0.08 }, delay: 0.24 },
        { type: "sine", from: 1680, to: 2170, seconds: 0.07, delay: 0.34, attack: 0.01, gain: 0.36, vibrato: { rate: 40, depth: 0.08 } },
        { type: "noise", seconds: 0.4, attack: 0.05, gain: 0.24, delay: 0.3, filter: { type: "highpass", from: 3200, to: 4600, q: 1 } },
        { type: "noise", seconds: 0.02, attack: 0.003, gain: 0.28, delay: 0.36, filter: { type: "bandpass", from: 4500, to: 3500, q: 4 } },
        { type: "noise", seconds: 0.02, attack: 0.003, gain: 0.28, delay: 0.44, filter: { type: "bandpass", from: 4500, to: 3500, q: 4 } },
        { type: "noise", seconds: 0.02, attack: 0.003, gain: 0.28, delay: 0.52, filter: { type: "bandpass", from: 4500, to: 3500, q: 4 } },
        { type: "noise", seconds: 0.02, attack: 0.003, gain: 0.28, delay: 0.6, filter: { type: "bandpass", from: 4500, to: 3500, q: 4 } },
      ],
    },
    // Throws a stick: Lob and fizz.
    ghoulDynThrow: {
      layers: [
        { type: "noise", seconds: 0.45, attack: 0.16, gain: 0.56, filter: { type: "bandpass", from: 300, to: 1800, q: 1.5 } },
        { type: "noise", seconds: 0.6, attack: 0.06, gain: 0.4, filter: { type: "highpass", from: 3360, to: 7000, q: 1 }, delay: 0.05 },
        { type: "pink", seconds: 0.6, attack: 0.05, gain: 0.25, filter: { type: "bandpass", from: 4480, to: 3080, q: 2 }, delay: 0.05 },
      ],
    },
    // Blast: Thunder in the shaft.
    ghoulDynBlast: {
      layers: [
        { type: "noise", seconds: 0.9, attack: 0.01, gain: 0.9, filter: { type: "lowpass", from: 3000, to: 100, q: 1 } },
        { type: "sine", from: 70, to: 25, seconds: 0.9, attack: 0.003, gain: 0.9 },
        { type: "brown", seconds: 1, attack: 0.08, gain: 0.6, filter: { type: "lowpass", from: 180, to: 70, q: 1 } },
        { type: "sine", from: 48, to: 30, seconds: 1, attack: 0.05, gain: 0.48 },
      ],
    },
  },
  music: {
    // The Mine Shaft: winch and chain drone. A slow industrial drone: a low
    // sawtooth pedal on the chords, a cage-winch clank (a hollow two-note
    // rattle) that speeds up as the cage drops, and a heavy kit that lands
    // one hit and then waits. The figure is played long and low. At high
    // dread a rusty squeal rises above and a sub pulse starts under the
    // floor.
    ghoulShaft: {
      bpm: 66,
      rush: 10,
      voices: {
        drone: { wave: "sawtooth", gain: 0.07, decay: 0.4, sustain: 1 },
        bass: { wave: "triangle", gain: 0.42, decay: 0.1, sustain: 0.6 },
        clank: { wave: "pulse", duty: 0.125, gain: 0.16, decay: 0.03, sustain: 0.02 },
        drum: { kit: true, gain: 0.28 },
        lead: { wave: "pulse", duty: 0.25, gain: 0.12, decay: 0.3, sustain: 0.5, vibrato: { rate: 4, depth: 0.006, delay: 0.3 } },
        knock: { wave: "triangle", gain: 0.36, decay: 0.03, sustain: 0.02, from: 0.3 },
        squeal: { wave: "sawtooth", gain: 0.04, decay: 0.4, sustain: 0.9, from: 0.8, vibrato: { rate: 5, depth: 0.02, delay: 0.2 } },
        sub: { wave: "sine", gain: 0.3, decay: 0.1, sustain: 0.8, from: 0.9 },
      },
      patterns: {
        A: {
          drone:
          "D2 - - - - - - - - - - - - - - - | Bb2 - - - - - - - - - - - - - - - | " +
          "G2 - - - - - - - - - - - - - - - | A2 - - - - - - - - - - - - - - -",
          bass:
          "D2 - - - - - - - - - - - - - - - | Bb2 - - - - - - - - - - - - - - - | " +
          "G2 - - - - - - - - - - - - - - - | A2 - - - - - - - - - - - - - - -",
          clank:
          ". . . . . . . . . . . . D4^06 . D4^06 . | . . . . . . . . . . . . D4^06 . D4^06 . | " +
          ". . . . . . . . . . . . D4^06 . D4^06 . | . . . . . . . . D4^06 . D4^06 . D4^06 . D4^06 .",
          drum:
          "k . . . . . . . s . . . . . . . | k . . . . . . . s . . . . . . . | " +
          "k . . . . . . . s . . . . . . . | k . . . . . . . s . . . s . s .",
          lead:
          "D4 - - - - - F4 - E4 - - - A3 - - - | Bb3 - - - - - - - . . . . . . . . | " +
          "G3 - - - - - Bb3 - A3 - - - D3 - - - | A3 - - - - - - - . . . . . . . .",
          knock:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | D3 . D3 . . . D3 . . . . . . . . .",
          squeal:
          ". . . . . . . . A5 - - - - - - - | . . . . . . . . Bb5 - - - - - - - | " +
          ". . . . . . . . D6 - - - - - - - | E6 - - - - - - - - - - - - - - -",
          sub:
          "D2 - . . D2 - . . D2 - . . D2 - . . | D2 - . . D2 - . . D2 - . . D2 - . . | " +
          "D2 - . . D2 - . . D2 - . . D2 - . . | D2 - . . D2 - . . D2 - . . D2 - . .",
        },
        B: {
          drone:
          "D2 - - - - - - - - - - - - - - - | Bb2 - - - - - - - - - - - - - - - | " +
          "G2 - - - - - - - - - - - - - - - | A2 - - - - - - - - - - - - - - -",
          bass:
          "D2 . . . D2 . . . D2 . . . D2 . . . | Bb2 . . . Bb2 . . . Bb2 . . . Bb2 . . . | " +
          "G2 . . . G2 . . . G2 . . . G2 . . . | A2 . . . A2 . . . A2 . . . A2 . . .",
          clank:
          "D4^06 . . . D4^06 . . . D4^06 . . . D4^06 . . . | D4^06 . . . D4^06 . . . D4^06 . . . D4^06 . . . | " +
          "D4^06 . . . D4^06 . . . D4^06 . . . D4^06 . . . | D4^06 . . . D4^06 . . . D4^06 . . . D4^06 . . .",
          drum:
          "k . . . o . . . s . . . o . . . | k . . . o . . . s . . . o . . . | " +
          "k . . . o . . . s . . . o . . . | k . . . o . . . s . . . o . . .",
          lead:
          "D4 - - - - - F4 - E4 - - - A3 - - - | Bb3 - - - D4 - - - F4 - - - D4 - - - | " +
          "D5 - - - - - F5 - E5 - - - A4 - - - | A4 - - - - - - - - - - - . . . .",
          knock:
          "D3 . D3 . . . D3 . . . . . . . . . | D3 . D3 . . . D3 . . . . . . . . . | " +
          "D3 . D3 . . . D3 . . . . . . . . . | D3 . D3 . . . D3 . . . . . . . . .",
          squeal:
          "A5 - - - - - - - - - - - - - - - | Bb5 - - - - - - - - - - - - - - - | " +
          "A5 - - - - - - - - - - - - - - - | E6 - - - - - - - - - - - - - - -",
          sub:
          "D2 - . . D2 - . . D2 - . . D2 - . . | D2 - . . D2 - . . D2 - . . D2 - . . | " +
          "D2 - . . D2 - . . D2 - . . D2 - . . | D2 - . . D2 - . . D2 - . . D2 - . .",
        },
        C: {
          drone:
          "D2 - - - - - - - - - - - - - - - | Bb2 - - - - - - - - - - - - - - - | " +
          "G2 - - - - - - - - - - - - - - - | A2 - - - - - - - - - - - - - - -",
          bass:
          "D2 - - - - - - - - - - - - - - - | Bb2 - - - - - - - - - - - - - - - | " +
          "G2 - - - - - - - - - - - - - - - | A2 - - - - - - - - - - - - - - -",
          clank:
          "D4^06 . . . . . . . D4^06 . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          drum:
          "k . . . . . . . . . . . . . . . | k . . . . . . . . . . . . . . . | " +
          "k . . . . . . . . . . . . . . . | k . . . . . . . . . . . . . . .",
          lead:
          "D4 - - - - - F4 - E4 - - - A3 - - - | . . . . . . . . . . . . . . . . | " +
          "D4 - - - - - F4 - E4 - - - A3 - - - | A3 - - - - - - - - - - - - - - -",
          knock:
          "D3 . D3 . . . D3 . . . . . . . . . | D3 . D3 . . . D3 . . . . . . . . . | " +
          "D3 . D3 . . . D3 . . . . . . . . . | D3 . D3 . . . D3 . . . . . . . . .",
          squeal:
          "D6 - - - - - - - - - - - - - - - | D6 - - - - - - - - - - - - - - - | " +
          "D6 - - - - - - - - - - - - - - - | D6 - - - - - - - - - - - - - - -",
          sub:
          "D2 - . . D2 - . . D2 - . . D2 - . . | D2 - . . D2 - . . D2 - . . D2 - . . | " +
          "D2 - . . D2 - . . D2 - . . D2 - . . | D2 - . . D2 - . . D2 - . . D2 - . .",
        },
      },
      order: ["A", "B", "C"],
    },
    // The Flooded Tunnels: music box lullaby. A music box left running in the
    // wet: a plucked box tune carries the figure over a soft sine arpeggio, a
    // slow bass and a ticking clockwork. The second part sings an octave up,
    // the bridge slows to the figure alone. At high dread a second box, a
    // half step flat, joins the first, and the canary ghosts begin to tweet.
    ghoulTunnels: {
      bpm: 92,
      rush: 8,
      voices: {
        box: { wave: "pulse", duty: 0.125, gain: 0.13, decay: 0.12, sustain: 0.02 },
        box2: { wave: "pulse", duty: 0.125, gain: 0.07, decay: 0.12, sustain: 0.02, from: 0.8 },
        acc: { wave: "sine", gain: 0.11, decay: 0.15, sustain: 0.2 },
        bass: { wave: "triangle", gain: 0.32, decay: 0.1, sustain: 0.5 },
        tick: { kit: true, gain: 0.07 },
        knock: { wave: "sine", gain: 0.34, decay: 0.05, sustain: 0.02, from: 0.3 },
        canary: { wave: "pulse", duty: 0.125, gain: 0.06, decay: 0.03, sustain: 0.3, from: 0.85 },
      },
      patterns: {
        A: {
          box:
          "D5 - F5 - E5 - - - A4 - - - . . . . | Bb4 - D5 - F5 - - - D5 - - - . . . . | " +
          "G4 - Bb4 - D5 - - - C5 - Bb4 - A4 - - - | A4 - - - E5 - - - D5 - E5 - A4 - - -",
          box2:
          "C#5 - E5 - D#5 - - - G#4 - - - . . . . | A4 - C#5 - E5 - - - C#5 - - - . . . . | " +
          "F#4 - A4 - C#5 - - - B4 - A4 - G#4 - - - | G#4 - - - D#5 - - - C#5 - D#5 - G#4 - - -",
          acc:
          "D4 - F4 - A4 - F4 - D4 - F4 - A4 - F4 - | Bb3 - D4 - F4 - D4 - Bb3 - D4 - F4 - D4 - | " +
          "G3 - Bb3 - D4 - Bb3 - G3 - Bb3 - D4 - Bb3 - | A3 - E4 - A4 - E4 - A3 - E4 - A4 - E4 -",
          bass:
          "D2 - - - - - - - . . . . . . . . | Bb2 - - - - - - - . . . . . . . . | " +
          "G2 - - - - - - - . . . . . . . . | A2 - - - - - - - . . . . . . . .",
          tick:
          "h . . . . . . . h . . . . . . . | h . . . . . . . h . . . . . . . | " +
          "h . . . . . . . h . . . . . . . | h . . . . . . . h . . . . . . .",
          knock:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | D3 . D3 . . . D3 . . . . . . . . .",
          canary:
          ". . . . . . . . . . A6 B6 A6 B6 A6 B6 | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
        },
        B: {
          box:
          "D6 - F6 - E6 - - - A5 - - - . . . . | A#5 - D6 - F6 - - - D6 - - - . . . . | " +
          "G5 - A#5 - D6 - - - C6 - A#5 - A5 - - - | A5 - - - E6 - - - D6 - E6 - A5 - - -",
          box2:
          "C#6 - E6 - D#6 - - - G#5 - - - . . . . | A5 - C#6 - E6 - - - C#6 - - - . . . . | " +
          "F#5 - A5 - C#6 - - - B5 - A5 - G#5 - - - | G#5 - - - D#6 - - - C#6 - D#6 - G#5 - - -",
          acc:
          "D4 - F4 - A4 - F4 - D4 - F4 - A4 - F4 - | Bb3 - D4 - F4 - D4 - Bb3 - D4 - F4 - D4 - | " +
          "G3 - Bb3 - D4 - Bb3 - G3 - Bb3 - D4 - Bb3 - | A3 - E4 - A4 - E4 - A3 - E4 - A4 - E4 -",
          bass:
          "D2 - - - - - - - . . . . . . . . | Bb2 - - - - - - - . . . . . . . . | " +
          "G2 - - - - - - - . . . . . . . . | A2 - - - - - - - . . . . . . . .",
          tick:
          "h . . . . . . . h . . . . . . . | h . . . . . . . h . . . . . . . | " +
          "h . . . . . . . h . . . . . . . | h . . . . . . . h . . . . . . .",
          knock:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | D3 . D3 . . . D3 . . . . . . . . .",
          canary:
          ". . . . . . . . . . A6 B6 A6 B6 A6 B6 | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
        },
        C: {
          box:
          "D5 - F5 - E5 - - - A4 - - - - - - - | . . . . . . . . . . . . . . . . | " +
          "D5 - F5 - E5 - - - A4 - - - - - - - | . . . . . . . . . . . . . . . .",
          box2:
          "C#5 - E5 - D#5 - - - G#4 - - - - - - - | . . . . . . . . . . . . . . . . | " +
          "C#5 - E5 - D#5 - - - G#4 - - - - - - - | . . . . . . . . . . . . . . . .",
          acc:
          "D4 - F4 - A4 - F4 - D4 - F4 - A4 - F4 - | Bb3 - D4 - F4 - D4 - Bb3 - D4 - F4 - D4 - | " +
          "G3 - Bb3 - D4 - Bb3 - G3 - Bb3 - D4 - Bb3 - | A3 - E4 - A4 - E4 - A3 - E4 - A4 - E4 -",
          bass:
          "D2 - - - - - - - . . . . . . . . | Bb2 - - - - - - - . . . . . . . . | " +
          "G2 - - - - - - - . . . . . . . . | A2 - - - - - - - . . . . . . . .",
          tick:
          "h . . . . . . . h . . . . . . . | h . . . . . . . h . . . . . . . | " +
          "h . . . . . . . h . . . . . . . | h . . . . . . . h . . . . . . .",
          knock:
          "D3 . D3 . . . D3 . . . . . . . . . | D3 . D3 . . . D3 . . . . . . . . . | " +
          "D3 . D3 . . . D3 . . . . . . . . . | D3 . D3 . . . D3 . . . . . . . . .",
          canary:
          ". . . . . . . . . . A6 B6 A6 B6 A6 B6 | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
        },
      },
      order: ["A", "B", "A", "C"],
    },
    // The Collapse: rubble industrial. The roof is coming in and the track is
    // a machine: a sawtooth bass chugs eighth notes, the kit stomps, an anvil
    // clangs off the beat and the lead hammers the figure twice a bar. The
    // second section lifts the riff an octave over a four-square kick, the
    // break drops to a kick and knocks. At high dread falling shards of
    // glass-bright notes scatter over everything and a scream tears across
    // the top.
    ghoulCollapse: {
      bpm: 138,
      rush: 12,
      voices: {
        lead: { wave: "pulse", duty: 0.25, gain: 0.14, decay: 0.06, sustain: 0.6 },
        bass: { wave: "sawtooth", gain: 0.18, decay: 0.06, sustain: 0.55 },
        drum: { kit: true, gain: 0.27 },
        anvil: { wave: "pulse", duty: 0.125, gain: 0.1, decay: 0.04, sustain: 0.03 },
        stab: { wave: "pulse", duty: 0.5, gain: 0.08, decay: 0.05, sustain: 0.1 },
        knock: { wave: "triangle", gain: 0.4, decay: 0.03, sustain: 0.02, from: 0.3 },
        shard: { wave: "pulse", duty: 0.125, gain: 0.07, decay: 0.03, sustain: 0.1, from: 0.85 },
        scream: { wave: "sawtooth", gain: 0.05, decay: 0.2, sustain: 0.9, from: 0.9, vibrato: { rate: 8, depth: 0.03, delay: 0 } },
      },
      patterns: {
        A: {
          lead:
          "D4 - F4 - E4 - A3 - D4 - F4 - E4 - A3 - | Bb3 - D4 - C4 - F3 - Bb3 - D4 - C4 - F3 - | " +
          "G3 - Bb3 - A3 - D3 - G3 - Bb3 - A3 - D3 - | A3 - E4 - D4 - A3 - A3 - E4 - D4 - A3 -",
          bass:
          "D2 - D2 - D2 - D2 - D2 - D2 - D2 - D2 - | Bb2 - Bb2 - Bb2 - Bb2 - Bb2 - Bb2 - Bb2 - Bb2 - | " +
          "G2 - G2 - G2 - G2 - G2 - G2 - G2 - G2 - | A2 - A2 - A2 - A2 - A2 - A2 - A2 - A2 -",
          drum:
          "k . . . s . . . k . k . s . . . | k . . . s . . . k . k . s . . . | " +
          "k . . . s . . . k . k . s . . . | k . . . s . . . k . . . s s s s",
          anvil:
          ". . A6 - . . E6 - . . A6 - . . E6 - | . . A6 - . . E6 - . . A6 - . . E6 - | " +
          ". . A6 - . . E6 - . . A6 - . . E6 - | . . A6 - . . E6 - . . A6 - . . E6 -",
          stab:
          "D3^037 . . . D3^037 . . . D3^037 . . . D3^037 . . . | Bb2^047 . . . Bb2^047 . . . Bb2^047 . . . Bb2^047 . . . | " +
          "G3^037 . . . G3^037 . . . G3^037 . . . G3^037 . . . | A3^07 . . . A3^07 . . . A3^07 . . . A3^07 . . .",
          knock:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | D3 . D3 . . . D3 . . . . . . . . .",
          shard:
          "A6 F6 D6 A5 . . . . A6 F6 D6 A5 . . . . | A6 F6 D6 A5 . . . . A6 F6 D6 A5 . . . . | " +
          "A6 F6 D6 A5 . . . . A6 F6 D6 A5 . . . . | A6 F6 D6 A5 . . . . A6 F6 D6 A5 . . . .",
          scream:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
        },
        B: {
          lead:
          "D5 - F5 - E5 - A4 - D5 - F5 - E5 - A4 - | A#4 - D5 - C5 - F4 - A#4 - D5 - C5 - F4 - | " +
          "G4 - A#4 - A4 - D4 - G4 - A#4 - A4 - D4 - | A4 - E5 - D5 - A4 - A4 - E5 - D5 - A4 -",
          bass:
          "D2 - D2 - D2 - D2 - D2 - D2 - D2 - D2 - | Bb2 - Bb2 - Bb2 - Bb2 - Bb2 - Bb2 - Bb2 - Bb2 - | " +
          "G2 - G2 - G2 - G2 - G2 - G2 - G2 - G2 - | A2 - A2 - A2 - A2 - A2 - A2 - A2 - A2 -",
          drum:
          "k . h . k . h . s . h . k . h . | k . h . k . h . s . h . k . h . | " +
          "k . h . k . h . s . h . k . h . | k . h . k . h . s . h . k . h .",
          anvil:
          ". . A6 - . . E6 - . . A6 - . . E6 - | . . A6 - . . E6 - . . A6 - . . E6 - | " +
          ". . A6 - . . E6 - . . A6 - . . E6 - | . . A6 - . . E6 - . . A6 - . . E6 -",
          stab:
          "D3^037 . . . D3^037 . . . D3^037 . . . D3^037 . . . | Bb2^047 . . . Bb2^047 . . . Bb2^047 . . . Bb2^047 . . . | " +
          "G3^037 . . . G3^037 . . . G3^037 . . . G3^037 . . . | A3^07 . . . A3^07 . . . A3^07 . . . A3^07 . . .",
          knock:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | D3 . D3 . . . D3 . . . . . . . . .",
          shard:
          "A6 F6 D6 A5 . . . . A6 F6 D6 A5 . . . . | A6 F6 D6 A5 . . . . A6 F6 D6 A5 . . . . | " +
          "A6 F6 D6 A5 . . . . A6 F6 D6 A5 . . . . | A6 F6 D6 A5 . . . . A6 F6 D6 A5 . . . .",
          scream:
          "A5 - - - - - - - - - - - - - - - | A5 - - - - - - - - - - - - - - - | " +
          "A5 - - - - - - - - - - - - - - - | E6 - - - - - - - - - - - - - - -",
        },
        C: {
          lead:
          ". . . . . . . . . . . . . . . . | D4 - F4 - E4 - - - A3 - - - - - - - | " +
          "D4 - F4 - E4 - - - A3 - - - - - - - | . . . . . . . . . . . . . . . .",
          bass:
          "D2 - - - . . . . D2 - - - . . . . | Bb2 - - - . . . . Bb2 - - - . . . . | " +
          "G2 - - - . . . . G2 - - - . . . . | A2 - - - . . . . A2 - - - . . . .",
          drum:
          "k . . . . . . . k . . . . . . . | k . . . . . . . k . . . . . . . | " +
          "k . . . . . . . k . . . . . . . | k . . . . . . . k . . . . . . .",
          anvil:
          ". . A6 - . . E6 - . . A6 - . . E6 - | . . A6 - . . E6 - . . A6 - . . E6 - | " +
          ". . A6 - . . E6 - . . A6 - . . E6 - | . . A6 - . . E6 - . . A6 - . . E6 -",
          stab:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          knock:
          "D3 . D3 . . . D3 . . . . . . . . . | D3 . D3 . . . D3 . . . . . . . . . | " +
          "D3 . D3 . . . D3 . . . . . . . . . | D3 . D3 . . . D3 . . . . . . . . .",
          shard:
          "A6 F6 D6 A5 . . . . A6 F6 D6 A5 . . . . | A6 F6 D6 A5 . . . . A6 F6 D6 A5 . . . . | " +
          "A6 F6 D6 A5 . . . . A6 F6 D6 A5 . . . . | A6 F6 D6 A5 . . . . A6 F6 D6 A5 . . . .",
          scream:
          "A5 - - - - - - - - - - - - - - - | A5 - - - - - - - - - - - - - - - | " +
          "A5 - - - - - - - - - - - - - - - | E6 - - - - - - - - - - - - - - -",
        },
      },
      order: ["A", "B", "A", "C", "B", "A"],
    },
    // The Mother Seam (the Tommyknocker's fight): miners' requiem. A funeral
    // for the whole shift: low saw voices hold the chords, the horn grieves
    // over the figure, a timpani walks slow and a bell tolls every bar, with
    // the knocks cracking through. The second part sings an octave up and the
    // timpani strikes twice. The last is the bell and the knocking alone. At
    // high dread a high choir and a second bell, out of time with the first,
    // answer the horn.
    ghoulSeam: {
      bpm: 72,
      rush: 10,
      voices: {
        choir: { wave: "sawtooth", gain: 0.09, decay: 0.3, sustain: 1, vibrato: { rate: 4.5, depth: 0.01, delay: 0.3 } },
        choirHi: { wave: "sawtooth", gain: 0.06, decay: 0.3, sustain: 1, vibrato: { rate: 5, depth: 0.01, delay: 0.3 } },
        bell: { wave: "sine", gain: 0.18, decay: 0.9, sustain: 0.3 },
        timp: { kit: true, gain: 0.36 },
        bass: { wave: "triangle", gain: 0.4, decay: 0.1, sustain: 0.6 },
        horn: { wave: "sawtooth", gain: 0.1, decay: 0.2, sustain: 0.75, vibrato: { rate: 4.5, depth: 0.008, delay: 0.25 } },
        knock: { wave: "triangle", gain: 0.44, decay: 0.03, sustain: 0.02, from: 0.3 },
        choirOct: { wave: "sawtooth", gain: 0.05, decay: 0.3, sustain: 1, from: 0.8, vibrato: { rate: 5.5, depth: 0.014, delay: 0.3 } },
        toll2: { wave: "sine", gain: 0.14, decay: 0.9, sustain: 0.3, from: 0.9 },
      },
      patterns: {
        A: {
          choir:
          "D3 - - - - - - - - - - - - - - - | A#3 - - - - - - - - - - - - - - - | " +
          "G3 - - - - - - - - - - - - - - - | A3 - - - - - - - - - - - - - - -",
          choirHi:
          "F4 - - - - - - - - - - - - - - - | D4 - - - - - - - - - - - - - - - | " +
          "Bb3 - - - - - - - - - - - - - - - | E4 - - - - - - - - - - - - - - -",
          bell:
          "D3 - - - . . . . . . . . . . . . | A#3 - - - . . . . . . . . . . . . | " +
          "G3 - - - . . . . . . . . . . . . | A3 - - - . . . . . . . . . . . .",
          timp:
          "k . . . . . . . k . k . . . . . | k . . . . . . . k . k . . . . . | " +
          "k . . . . . . . k . k . . . . . | k . . . . . . . k . k . . . . .",
          bass:
          "D2 - - - - - - - - - - - - - - - | Bb2 - - - - - - - - - - - - - - - | " +
          "G2 - - - - - - - - - - - - - - - | A2 - - - - - - - - - - - - - - -",
          horn:
          "D4 - - - - - F4 - E4 - - - A3 - - - | Bb3 - - - - - - - D4 - - - - - - - | " +
          "G3 - - - - - Bb3 - A3 - - - D3 - - - | A3 - - - - - - - - - - - - - - -",
          knock:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | D3 . D3 . . . D3 . . . . . . . . .",
          choirOct:
          "D4 - - - - - - - - - - - - - - - | A#4 - - - - - - - - - - - - - - - | " +
          "G4 - - - - - - - - - - - - - - - | A4 - - - - - - - - - - - - - - -",
          toll2:
          ". . . . D3 - - - . . . . . . . . | . . . . A#3 - - - . . . . . . . . | " +
          ". . . . G3 - - - . . . . . . . . | . . . . A3 - - - . . . . . . . .",
        },
        B: {
          choir:
          "D3 - - - - - - - - - - - - - - - | A#3 - - - - - - - - - - - - - - - | " +
          "G3 - - - - - - - - - - - - - - - | A3 - - - - - - - - - - - - - - -",
          choirHi:
          "F4 - - - - - - - - - - - - - - - | D4 - - - - - - - - - - - - - - - | " +
          "Bb3 - - - - - - - - - - - - - - - | E4 - - - - - - - - - - - - - - -",
          bell:
          "D3 - - - . . . . . . . . . . . . | A#3 - - - . . . . . . . . . . . . | " +
          "G3 - - - . . . . . . . . . . . . | A3 - - - . . . . . . . . . . . .",
          timp:
          "k . . . s . . . k . k . s . . . | k . . . s . . . k . k . s . . . | " +
          "k . . . s . . . k . k . s . . . | k . . . s . . . k . k . s . . .",
          bass:
          "D2 - - - - - - - - - - - - - - - | Bb2 - - - - - - - - - - - - - - - | " +
          "G2 - - - - - - - - - - - - - - - | A2 - - - - - - - - - - - - - - -",
          horn:
          "D5 - - - - - F5 - E5 - - - A4 - - - | A#4 - - - - - - - D5 - - - - - - - | " +
          "G4 - - - - - A#4 - A4 - - - D4 - - - | A4 - - - - - - - - - - - - - - -",
          knock:
          "D3 . D3 . . . D3 . . . . . . . . . | D3 . D3 . . . D3 . . . . . . . . . | " +
          "D3 . D3 . . . D3 . . . . . . . . . | D3 . D3 . . . D3 . . . . . . . . .",
          choirOct:
          "D4 - - - - - - - - - - - - - - - | A#4 - - - - - - - - - - - - - - - | " +
          "G4 - - - - - - - - - - - - - - - | A4 - - - - - - - - - - - - - - -",
          toll2:
          ". . . . D3 - - - . . . . . . . . | . . . . A#3 - - - . . . . . . . . | " +
          ". . . . G3 - - - . . . . . . . . | . . . . A3 - - - . . . . . . . .",
        },
        C: {
          choir:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          choirHi:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          bell:
          "D3 - - - . . . . . . . . . . . . | A#3 - - - . . . . . . . . . . . . | " +
          "G3 - - - . . . . . . . . . . . . | A3 - - - . . . . . . . . . . . .",
          timp:
          "k . . . . . . . k . k . . . . . | k . . . . . . . k . k . . . . . | " +
          "k . . . . . . . k . k . . . . . | k . . . . . . . k . k . . . . .",
          bass:
          "D2 - - - - - - - - - - - - - - - | Bb2 - - - - - - - - - - - - - - - | " +
          "G2 - - - - - - - - - - - - - - - | A2 - - - - - - - - - - - - - - -",
          horn:
          "D4 - - - F4 - - - E4 - - - A3 - - - | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          knock:
          "D3 . D3 . . . D3 . . . . . . . . . | D3 . D3 . . . D3 . . . . . . . . . | " +
          "D3 . D3 . . . D3 . . . . . . . . . | D3 . D3 . . . D3 . . . . . . . . .",
          choirOct:
          "D4 - - - - - - - - - - - - - - - | A#4 - - - - - - - - - - - - - - - | " +
          "G4 - - - - - - - - - - - - - - - | A4 - - - - - - - - - - - - - - -",
          toll2:
          ". . . . D3 - - - . . . . . . . . | . . . . A#3 - - - . . . . . . . . | " +
          ". . . . G3 - - - . . . . . . . . | . . . . A3 - - - . . . . . . . .",
        },
      },
      order: ["A", "B", "C"],
    },
    // The Runaway Cart: panic chip run. Run, do not look up: sixteenth-note
    // bass drives a frantic kit while the lead tumbles the figure four times
    // a bar, as fast as feet. The second section leaps an octave over
    // off-beat chord stabs, the break shrinks to a held bass, a racing kick
    // and one figure. At high dread glassy shards rain down and a scream rips
    // across the top.
    ghoulCart: {
      bpm: 156,
      rush: 12,
      voices: {
        lead: { wave: "pulse", duty: 0.25, gain: 0.13, decay: 0.04, sustain: 0.6 },
        bass: { wave: "triangle", gain: 0.4, decay: 0.1, sustain: 0.55 },
        drum: { kit: true, gain: 0.24 },
        stab: { wave: "pulse", duty: 0.5, gain: 0.07, decay: 0.04, sustain: 0.1 },
        knock: { wave: "triangle", gain: 0.4, decay: 0.03, sustain: 0.02, from: 0.3 },
        shard: { wave: "pulse", duty: 0.125, gain: 0.07, decay: 0.03, sustain: 0.1, from: 0.85 },
        scream: { wave: "sawtooth", gain: 0.05, decay: 0.2, sustain: 0.9, from: 0.9, vibrato: { rate: 8, depth: 0.03, delay: 0 } },
      },
      patterns: {
        A: {
          lead:
          "D5 F5 E5 A4 D5 F5 E5 A4 D5 F5 E5 A4 D5 F5 E5 A4 | Bb4 D5 C5 F4 Bb4 D5 C5 F4 Bb4 D5 C5 F4 Bb4 D5 C5 F4 | " +
          "G4 Bb4 A4 D4 G4 Bb4 A4 D4 G4 Bb4 A4 D4 G4 Bb4 A4 D4 | A4 E5 D5 A4 A4 E5 D5 A4 A4 E5 D5 A4 A4 E5 D5 A4",
          bass:
          "D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 | Bb2 Bb2 Bb2 Bb2 Bb2 Bb2 Bb2 Bb2 Bb2 Bb2 Bb2 Bb2 Bb2 Bb2 Bb2 Bb2 | " +
          "G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 | A2 A2 A2 A2 A2 A2 A2 A2 A2 A2 A2 A2 A2 A2 A2 A2",
          drum:
          "k . k . s . k . k . k . s . s s | k . k . s . k . k . k . s . s s | " +
          "k . k . s . k . k . k . s . s s | k . k . s . k . k . k . s . s s",
          stab:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          knock:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | D3 . D3 . . . D3 . . . . . . . . .",
          shard:
          "A6 F6 D6 A5 . . . . A6 F6 D6 A5 . . . . | A6 F6 D6 A5 . . . . A6 F6 D6 A5 . . . . | " +
          "A6 F6 D6 A5 . . . . A6 F6 D6 A5 . . . . | A6 F6 D6 A5 . . . . A6 F6 D6 A5 . . . .",
          scream:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
        },
        B: {
          lead:
          "D6 F6 E6 A5 D6 F6 E6 A5 D6 F6 E6 A5 D6 F6 E6 A5 | A#5 D6 C6 F5 A#5 D6 C6 F5 A#5 D6 C6 F5 A#5 D6 C6 F5 | " +
          "G5 A#5 A5 D5 G5 A#5 A5 D5 G5 A#5 A5 D5 G5 A#5 A5 D5 | A5 E6 D6 A5 A5 E6 D6 A5 A5 E6 D6 A5 A5 E6 D6 A5",
          bass:
          "D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 D2 | Bb2 Bb2 Bb2 Bb2 Bb2 Bb2 Bb2 Bb2 Bb2 Bb2 Bb2 Bb2 Bb2 Bb2 Bb2 Bb2 | " +
          "G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 | A2 A2 A2 A2 A2 A2 A2 A2 A2 A2 A2 A2 A2 A2 A2 A2",
          drum:
          "k . k . s . k . k . k . s . s s | k . k . s . k . k . k . s . s s | " +
          "k . k . s . k . k . k . s . s s | k . k . s . k . k . k . s . s s",
          stab:
          "D3^037 . . . D3^037 . . . D3^037 . . . D3^037 . . . | Bb2^047 . . . Bb2^047 . . . Bb2^047 . . . Bb2^047 . . . | " +
          "G3^037 . . . G3^037 . . . G3^037 . . . G3^037 . . . | A3^07 . . . A3^07 . . . A3^07 . . . A3^07 . . .",
          knock:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | D3 . D3 . . . D3 . . . . . . . . .",
          shard:
          "A6 F6 D6 A5 . . . . A6 F6 D6 A5 . . . . | A6 F6 D6 A5 . . . . A6 F6 D6 A5 . . . . | " +
          "A6 F6 D6 A5 . . . . A6 F6 D6 A5 . . . . | A6 F6 D6 A5 . . . . A6 F6 D6 A5 . . . .",
          scream:
          "A5 - - - - - - - - - - - - - - - | A5 - - - - - - - - - - - - - - - | " +
          "A5 - - - - - - - - - - - - - - - | E6 - - - - - - - - - - - - - - -",
        },
        C: {
          lead:
          "D5 F5 E5 A4 . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          "D5 F5 E5 A4 . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          bass:
          "D2 - D2 - D2 - D2 - D2 - D2 - D2 - D2 - | Bb2 - Bb2 - Bb2 - Bb2 - Bb2 - Bb2 - Bb2 - Bb2 - | " +
          "G2 - G2 - G2 - G2 - G2 - G2 - G2 - G2 - | A2 - A2 - A2 - A2 - A2 - A2 - A2 - A2 -",
          drum:
          "k . k . k . k . k . k . k . k . | k . k . k . k . k . k . k . k . | " +
          "k . k . k . k . k . k . k . k . | k . k . k . k . k . k . k . k .",
          stab:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          knock:
          "D3 . D3 . . . D3 . . . . . . . . . | D3 . D3 . . . D3 . . . . . . . . . | " +
          "D3 . D3 . . . D3 . . . . . . . . . | D3 . D3 . . . D3 . . . . . . . . .",
          shard:
          "A6 F6 D6 A5 . . . . A6 F6 D6 A5 . . . . | A6 F6 D6 A5 . . . . A6 F6 D6 A5 . . . . | " +
          "A6 F6 D6 A5 . . . . A6 F6 D6 A5 . . . . | A6 F6 D6 A5 . . . . A6 F6 D6 A5 . . . .",
          scream:
          "A5 - - - - - - - - - - - - - - - | A5 - - - - - - - - - - - - - - - | " +
          "A5 - - - - - - - - - - - - - - - | E6 - - - - - - - - - - - - - - -",
        },
      },
      order: ["A", "B", "A", "C", "B", "A"],
    },
  },
};
