// Plan2Code Web Console - ghoul: The Midnight Carnival's own sound effects and music tracks, merged into ghoul-sfx.js; defines only.
//
// Same shape and rules as ghoul-sfx-mine.js: `tones` (the stage's monsters' and
// boss's `ghoul<Kind><Act>` sounds) and `music` (a track per room, named in
// ROOM_MUSIC in ghoul.js). Both are empty until the sounds and music are picked
// by ear: the rooms play existing tracks and the art's VOICES borrow older
// tones. A name may be defined only once across tones.js and every game's file.
// No imports.

export const CARNIVAL_SFX = {
  tones: {
    // The Midnight Carnival's monsters, the Ringmaster, Cotton Candy and the Custard Pie,
    // picked by ear (prototypes/sounds/ghoul-rush/carnival.html).
    // Grinner: A clown with a painted grin and a bulb horn: it walks at you, honks, and a balloon is born that drifts after you.
    // Shambles in: Bicycle horn and giggle.
    ghoulGrinnerAppear: {
      layers: [
        { type: "square", from: 380, to: 323, seconds: 0.18, attack: 0.012, gain: 0.42, filter: { type: "bandpass", from: 1140, to: 912, q: 2 } },
        { type: "sawtooth", from: 388, to: 329, seconds: 0.18, attack: 0.015, gain: 0.35, filter: { type: "lowpass", from: 1900, to: 1140, q: 1 } },
        { type: "sawtooth", from: 900, to: 720, seconds: 0.09, delay: 0.22, attack: 0.01, gain: 0.42, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 2250, to: 1800, q: 3 } },
        { type: "sawtooth", from: 855, to: 684, seconds: 0.09, delay: 0.32, attack: 0.01, gain: 0.42, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 2138, to: 1710, q: 3 } },
        { type: "sawtooth", from: 810, to: 648, seconds: 0.09, delay: 0.42, attack: 0.01, gain: 0.42, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 2025, to: 1620, q: 3 } },
      ],
    },
    // Honks: Big bulb horn, twice.
    ghoulGrinnerHonk: {
      layers: [
        { type: "square", from: 300, to: 210, seconds: 0.25, attack: 0.012, gain: 0.6, filter: { type: "bandpass", from: 900, to: 720, q: 2 } },
        { type: "sawtooth", from: 306, to: 214, seconds: 0.25, attack: 0.015, gain: 0.5, filter: { type: "lowpass", from: 1500, to: 900, q: 1 } },
        { type: "square", from: 360, to: 288, seconds: 0.3, attack: 0.012, gain: 0.6, delay: 0.3, filter: { type: "bandpass", from: 1080, to: 864, q: 2 } },
        { type: "sawtooth", from: 367, to: 294, seconds: 0.3, attack: 0.015, gain: 0.5, delay: 0.3, filter: { type: "lowpass", from: 1800, to: 1080, q: 1 } },
      ],
    },
    // Takes a bolt: Squeaky pinch.
    ghoulGrinnerHurt: {
      layers: [
        { type: "sine", from: 1700, to: 3060, seconds: 0.09, attack: 0.004, gain: 0.56, vibrato: { rate: 38, depth: 0.06 } },
        { type: "sine", from: 3230, to: 2040, seconds: 0.1, attack: 0.004, gain: 0.4, delay: 0.08, vibrato: { rate: 38, depth: 0.06 } },
        { type: "sawtooth", from: 372, to: 257, seconds: 0.16, attack: 0.01, gain: 0.45, vibrato: { rate: 6, depth: 0.1 }, filter: { type: "lowpass", from: 3718, to: 3718, q: 1 }, delay: 0.05 },
        { type: "brown", seconds: 0.13, attack: 0.01, gain: 0.3, filter: { type: "lowpass", from: 650, to: 650, q: 1 }, delay: 0.05 },
      ],
    },
    // Dies: Calliope winds down.
    ghoulGrinnerDie: {
      layers: [
        { type: "square", seconds: 0.9, attack: 0.01, gain: 0.4, notes: [523, 440, 349, 262, 196], filter: { type: "lowpass", from: 3200, to: 2600, q: 1 }, vibrato: { rate: 5.5, depth: 0.03 } },
        { type: "triangle", seconds: 0.9, attack: 0.01, gain: 0.24, notes: [1049, 882, 700, 525, 393] },
        { type: "pink", seconds: 0.72, attack: 0.04, gain: 0.1, filter: { type: "bandpass", from: 3000, to: 3000, q: 2 } },
      ],
    },
    // Balloon: A fat red balloon the Grinner honks out: it drifts at you, bobbing, and when it pops it drips acid that lies on the floor.
    // Floats out: Music-box drift.
    ghoulBalloonAppear: {
      layers: [
        { type: "sine", from: 1500, to: 1485, seconds: 0.4, attack: 0.003, gain: 0.36 },
        { type: "sine", from: 4140, to: 4050, seconds: 0.24, attack: 0.003, gain: 0.18 },
        { type: "sine", from: 8100, to: 7950, seconds: 0.12, attack: 0.003, gain: 0.09 },
        { type: "sine", from: 1800, to: 1782, seconds: 0.4, attack: 0.003, gain: 0.36, delay: 0.2 },
        { type: "sine", from: 4968, to: 4860, seconds: 0.24, attack: 0.003, gain: 0.18, delay: 0.2 },
        { type: "sine", from: 9720, to: 9540, seconds: 0.12, attack: 0.003, gain: 0.09, delay: 0.2 },
        { type: "sine", from: 1350, to: 1337, seconds: 0.5, attack: 0.003, gain: 0.3, delay: 0.4 },
        { type: "sine", from: 3726, to: 3645, seconds: 0.3, attack: 0.003, gain: 0.15, delay: 0.4 },
        { type: "sine", from: 7290, to: 7155, seconds: 0.15, attack: 0.003, gain: 0.08, delay: 0.4 },
      ],
    },
    // Pops, acid splashes: Bang and drip.
    ghoulBalloonDie: {
      layers: [
        { type: "noise", seconds: 0.5, attack: 0, gain: 0.8, filter: { type: "lowpass", from: 7560, to: 270, q: 1 } },
        { type: "sine", from: 288, to: 63, seconds: 0.4, attack: 0, gain: 0.72 },
        { type: "brown", seconds: 0.6, attack: 0.01, gain: 0.56, filter: { type: "lowpass", from: 720, to: 720, q: 1 } },
        { type: "sine", from: 900, to: 1300, seconds: 0.05, attack: 0.003, gain: 0.4, delay: 0.3 },
        { type: "sine", from: 760, to: 1100, seconds: 0.05, attack: 0.003, gain: 0.3, delay: 0.45 },
      ],
    },
    // Marionette: A wooden puppet hanging from the rafters on a string: it jerks when you pass under, drops, and dances at you on its own strings.
    // Hangs: Tiny music box.
    ghoulMarionetteAppear: {
      layers: [
        { type: "sine", from: 1320, to: 1307, seconds: 0.4, attack: 0.003, gain: 0.36 },
        { type: "sine", from: 3643, to: 3564, seconds: 0.24, attack: 0.003, gain: 0.18 },
        { type: "sine", from: 7128, to: 6996, seconds: 0.12, attack: 0.003, gain: 0.09 },
        { type: "sine", from: 1100, to: 1089, seconds: 0.4, attack: 0.003, gain: 0.36, delay: 0.25 },
        { type: "sine", from: 3036, to: 2970, seconds: 0.24, attack: 0.003, gain: 0.18, delay: 0.25 },
        { type: "sine", from: 5940, to: 5830, seconds: 0.12, attack: 0.003, gain: 0.09, delay: 0.25 },
        { type: "sine", from: 990, to: 980, seconds: 0.5, attack: 0.003, gain: 0.3, delay: 0.5 },
        { type: "sine", from: 2732, to: 2673, seconds: 0.3, attack: 0.003, gain: 0.15, delay: 0.5 },
        { type: "sine", from: 5346, to: 5247, seconds: 0.15, attack: 0.003, gain: 0.08, delay: 0.5 },
      ],
    },
    // String jerks: String yank.
    ghoulMarionetteJerk: {
      layers: [
        { type: "triangle", from: 582, to: 520, seconds: 0.3, attack: 0.002, gain: 0.64, vibrato: { rate: 32, depth: 0.03 } },
        { type: "sine", from: 1045, to: 1040, seconds: 0.18, attack: 0.002, gain: 0.24 },
        { type: "noise", seconds: 0.02, attack: 0.001, gain: 0.32, filter: { type: "bandpass", from: 3000, to: 3000, q: 2 } },
        { type: "triangle", from: 1080, to: 456, seconds: 0.06, attack: 0.001, gain: 0.4, delay: 0.05 },
        { type: "noise", seconds: 0.03, attack: 0.001, gain: 0.3, delay: 0.05, filter: { type: "bandpass", from: 2640, to: 2160, q: 2 } },
      ],
    },
    // Drops: Falling squeal.
    ghoulMarionetteDrop: {
      layers: [
        { type: "sine", from: 1500, to: 300, seconds: 0.45, attack: 0.02, gain: 0.6, vibrato: { rate: 6, depth: 0.02 } },
        { type: "noise", seconds: 0.4, attack: 0.14, gain: 0.32, filter: { type: "bandpass", from: 300, to: 1800, q: 1.5 } },
      ],
    },
    // Lands and dances: Crash and giggle.
    ghoulMarionetteLand: {
      layers: [
        { type: "sine", from: 132, to: 48, seconds: 0.25, attack: 0, gain: 0.8 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.64, filter: { type: "lowpass", from: 384, to: 384, q: 1 } },
        { type: "sawtooth", from: 1000, to: 800, seconds: 0.09, delay: 0.2, attack: 0.01, gain: 0.35, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 2500, to: 2000, q: 3 } },
        { type: "sawtooth", from: 950, to: 760, seconds: 0.09, delay: 0.29, attack: 0.01, gain: 0.35, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 2375, to: 1900, q: 3 } },
        { type: "sawtooth", from: 900, to: 720, seconds: 0.09, delay: 0.38, attack: 0.01, gain: 0.35, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 2250, to: 1800, q: 3 } },
      ],
    },
    // String cut: Harp string breaking.
    ghoulMarionetteCut: {
      layers: [
        { type: "triangle", from: 784, to: 700, seconds: 0.5, attack: 0.002, gain: 0.64, vibrato: { rate: 32, depth: 0.03 } },
        { type: "sine", from: 1407, to: 1400, seconds: 0.3, attack: 0.002, gain: 0.24 },
        { type: "noise", seconds: 0.02, attack: 0.001, gain: 0.32, filter: { type: "bandpass", from: 3000, to: 3000, q: 2 } },
        { type: "triangle", from: 392, to: 350, seconds: 0.5, attack: 0.002, gain: 0.4, delay: 0.05, vibrato: { rate: 32, depth: 0.03 } },
        { type: "sine", from: 703, to: 700, seconds: 0.3, attack: 0.002, gain: 0.15, delay: 0.05 },
        { type: "noise", seconds: 0.02, attack: 0.001, gain: 0.2, delay: 0.05, filter: { type: "bandpass", from: 3000, to: 3000, q: 2 } },
      ],
    },
    // Takes a bolt: Jaw clack, grunt.
    ghoulMarionetteHurt: {
      layers: [
        { type: "triangle", from: 720, to: 304, seconds: 0.06, attack: 0.001, gain: 0.72 },
        { type: "noise", seconds: 0.03, attack: 0.001, gain: 0.54, filter: { type: "bandpass", from: 1760, to: 1440, q: 2 } },
        { type: "sawtooth", from: 686, to: 475, seconds: 0.16, attack: 0.01, gain: 0.45, vibrato: { rate: 8, depth: 0.1 }, filter: { type: "lowpass", from: 3872, to: 3872, q: 1 }, delay: 0.03 },
        { type: "brown", seconds: 0.13, attack: 0.01, gain: 0.3, filter: { type: "lowpass", from: 800, to: 800, q: 1 }, delay: 0.03 },
      ],
    },
    // Dies: Music box winds down.
    ghoulMarionetteDie: {
      layers: [
        { type: "sine", from: 1320, to: 1307, seconds: 0.3, attack: 0.003, gain: 0.36 },
        { type: "sine", from: 3643, to: 3564, seconds: 0.18, attack: 0.003, gain: 0.18 },
        { type: "sine", from: 7128, to: 6996, seconds: 0.09, attack: 0.003, gain: 0.09 },
        { type: "sine", from: 1100, to: 1089, seconds: 0.3, attack: 0.003, gain: 0.36, delay: 0.3 },
        { type: "sine", from: 3036, to: 2970, seconds: 0.18, attack: 0.003, gain: 0.18, delay: 0.3 },
        { type: "sine", from: 5940, to: 5830, seconds: 0.09, attack: 0.003, gain: 0.09, delay: 0.3 },
        { type: "sine", from: 880, to: 871, seconds: 0.4, attack: 0.003, gain: 0.3, delay: 0.7 },
        { type: "sine", from: 2429, to: 2376, seconds: 0.24, attack: 0.003, gain: 0.15, delay: 0.7 },
        { type: "sine", from: 4752, to: 4664, seconds: 0.12, attack: 0.003, gain: 0.08, delay: 0.7 },
        { type: "sine", from: 660, to: 653, seconds: 0.2, attack: 0.003, gain: 0.24, delay: 1 },
        { type: "sine", from: 1822, to: 1782, seconds: 0.12, attack: 0.003, gain: 0.12, delay: 1 },
        { type: "sine", from: 3564, to: 3498, seconds: 0.06, attack: 0.003, gain: 0.06, delay: 1 },
      ],
    },
    // Mirror You: Your own reflection stepping out of the glass: it copies your moves half a second late and fires back whenever you fire.
    // Appears: Glass ripple.
    ghoulMirrorAppear: {
      layers: [
        { type: "sine", from: 2400, to: 2376, seconds: 0.6, attack: 0.003, gain: 0.3 },
        { type: "sine", from: 6624, to: 6480, seconds: 0.36, attack: 0.003, gain: 0.15 },
        { type: "sine", from: 12960, to: 12720, seconds: 0.18, attack: 0.003, gain: 0.08 },
        { type: "sine", from: 3100, to: 3069, seconds: 0.5, attack: 0.003, gain: 0.24, delay: 0.1 },
        { type: "sine", from: 8556, to: 8370, seconds: 0.3, attack: 0.003, gain: 0.12, delay: 0.1 },
        { type: "sine", from: 16740, to: 16430, seconds: 0.15, attack: 0.003, gain: 0.06, delay: 0.1 },
        { type: "pink", seconds: 0.6, attack: 0.25, gain: 0.24, filter: { type: "bandpass", from: 1050, to: 3900, q: 5 } },
        { type: "noise", seconds: 0.42, delay: 0.24, attack: 0.1, gain: 0.15, filter: { type: "bandpass", from: 3900, to: 1350, q: 8 } },
      ],
    },
    // Steps out: Shimmer pop.
    ghoulMirrorStep: {
      layers: [
        { type: "sine", from: 1800, to: 1782, seconds: 0.3, attack: 0.003, gain: 0.3 },
        { type: "sine", from: 4968, to: 4860, seconds: 0.18, attack: 0.003, gain: 0.15 },
        { type: "sine", from: 9720, to: 9540, seconds: 0.09, attack: 0.003, gain: 0.08 },
        { type: "sine", from: 2400, to: 2376, seconds: 0.3, attack: 0.003, gain: 0.3, delay: 0.06 },
        { type: "sine", from: 6624, to: 6480, seconds: 0.18, attack: 0.003, gain: 0.15, delay: 0.06 },
        { type: "sine", from: 12960, to: 12720, seconds: 0.09, attack: 0.003, gain: 0.08, delay: 0.06 },
        { type: "sine", from: 3000, to: 2970, seconds: 0.3, attack: 0.003, gain: 0.3, delay: 0.12 },
        { type: "sine", from: 8280, to: 8100, seconds: 0.18, attack: 0.003, gain: 0.15, delay: 0.12 },
        { type: "sine", from: 16200, to: 15900, seconds: 0.09, attack: 0.003, gain: 0.08, delay: 0.12 },
        { type: "noise", seconds: 0.5, attack: 0, gain: 0.3, filter: { type: "lowpass", from: 8400, to: 300, q: 1 }, delay: 0.2 },
        { type: "sine", from: 320, to: 70, seconds: 0.4, attack: 0, gain: 0.27, delay: 0.2 },
        { type: "brown", seconds: 0.6, attack: 0.01, gain: 0.21, filter: { type: "lowpass", from: 800, to: 800, q: 1 }, delay: 0.2 },
      ],
    },
    // Fires back: Twang bolt.
    ghoulMirrorShot: {
      layers: [
        { type: "triangle", from: 896, to: 800, seconds: 0.25, attack: 0.002, gain: 0.64, vibrato: { rate: 32, depth: 0.03 } },
        { type: "sine", from: 1608, to: 1600, seconds: 0.15, attack: 0.002, gain: 0.24 },
        { type: "noise", seconds: 0.02, attack: 0.001, gain: 0.32, filter: { type: "bandpass", from: 3000, to: 3000, q: 2 } },
        { type: "noise", seconds: 0.2, attack: 0.07, gain: 0.32, filter: { type: "bandpass", from: 480, to: 2880, q: 1.5 } },
      ],
    },
    // Bolts cancel: Two notes clash.
    ghoulMirrorCancel: {
      layers: [
        { type: "sine", from: 1500, to: 1500, seconds: 0.3, attack: 0.003, gain: 0.5 },
        { type: "sine", from: 1590, to: 1590, seconds: 0.3, attack: 0.003, gain: 0.5 },
        { type: "noise", seconds: 0.5, attack: 0, gain: 0.3, filter: { type: "lowpass", from: 10500, to: 375, q: 1 } },
        { type: "sine", from: 400, to: 88, seconds: 0.4, attack: 0, gain: 0.27 },
        { type: "brown", seconds: 0.6, attack: 0.01, gain: 0.21, filter: { type: "lowpass", from: 1000, to: 1000, q: 1 } },
      ],
    },
    // Shatters: Big glass smash.
    ghoulMirrorShatter: {
      layers: [
        { type: "noise", seconds: 0.3, attack: 0.001, gain: 0.7, filter: { type: "highpass", from: 4500, to: 7000, q: 1 } },
        { type: "sine", from: 3150, to: 3056, seconds: 0.22, attack: 0.002, gain: 0.35, delay: 0.01 },
        { type: "sine", from: 4200, to: 4074, seconds: 0.3, attack: 0.002, gain: 0.35, delay: 0.05 },
        { type: "sine", from: 5300, to: 5141, seconds: 0.38, attack: 0.002, gain: 0.35, delay: 0.08 },
        { type: "sine", from: 3700, to: 3589, seconds: 0.22, attack: 0.002, gain: 0.35, delay: 0.12 },
        { type: "sine", from: 6100, to: 5917, seconds: 0.3, attack: 0.002, gain: 0.35, delay: 0.15 },
        { type: "sine", from: 4800, to: 4656, seconds: 0.38, attack: 0.002, gain: 0.35, delay: 0.19 },
        { type: "sine", from: 165, to: 60, seconds: 0.25, attack: 0, gain: 0.4 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.32, filter: { type: "lowpass", from: 480, to: 480, q: 1 } },
      ],
    },
    // Takes a bolt: Glass chip.
    ghoulMirrorHurt: {
      layers: [
        { type: "noise", seconds: 0.08, attack: 0.001, gain: 0.56, filter: { type: "highpass", from: 4500, to: 7000, q: 1 } },
        { type: "sine", from: 3150, to: 3056, seconds: 0.22, attack: 0.002, gain: 0.28, delay: 0.01 },
        { type: "sawtooth", from: 1144, to: 792, seconds: 0.16, attack: 0.01, gain: 0.27, vibrato: { rate: 5, depth: 0.1 }, filter: { type: "lowpass", from: 8800, to: 8800, q: 1 }, delay: 0.02 },
        { type: "brown", seconds: 0.13, attack: 0.01, gain: 0.18, filter: { type: "lowpass", from: 1000, to: 1000, q: 1 }, delay: 0.02 },
      ],
    },
    // Dies: Voice drains away.
    ghoulMirrorDie: {
      layers: [
        { type: "sine", notes: [1400, 1176, 938, 700], seconds: 0.8, attack: 0.02, gain: 0.42, vibrato: { rate: 7, depth: 0.02 } },
        { type: "triangle", notes: [2100, 1764, 1400, 1050], seconds: 0.8, attack: 0.02, gain: 0.18 },
        { type: "pink", seconds: 0.6, attack: 0.25, gain: 0.24, filter: { type: "bandpass", from: 700, to: 2600, q: 5 } },
        { type: "noise", seconds: 0.42, delay: 0.24, attack: 0.1, gain: 0.15, filter: { type: "bandpass", from: 2600, to: 900, q: 8 } },
      ],
    },
    // Strongman: A giant in leopard-print tights with a handlebar moustache: slow and heavy, it lobs barbells at you in an arc.
    // Lumbers in: Tuba oom-pah.
    ghoulStrongmanAppear: {
      layers: [
        { type: "sawtooth", from: 98, to: 98, seconds: 0.35, attack: 0.03, gain: 0.72, filter: { type: "lowpass", from: 490, to: 245, q: 1 } },
        { type: "sine", from: 49, to: 49, seconds: 0.35, attack: 0.03, gain: 0.54 },
        { type: "sawtooth", from: 130, to: 130, seconds: 0.3, attack: 0.03, gain: 0.64, delay: 0.4, filter: { type: "lowpass", from: 650, to: 325, q: 1 } },
        { type: "sine", from: 65, to: 65, seconds: 0.3, attack: 0.03, gain: 0.48, delay: 0.4 },
        { type: "sine", from: 88, to: 32, seconds: 0.25, attack: 0, gain: 0.5 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.4, filter: { type: "lowpass", from: 256, to: 256, q: 1 } },
      ],
    },
    // Winds up: Drum roll.
    ghoulStrongmanWind: {
      layers: [
        { type: "noise", seconds: 0.04, attack: 0.001, gain: 0.32, filter: { type: "bandpass", from: 630, to: 840, q: 1.5 } },
        { type: "noise", seconds: 0.04, attack: 0.001, gain: 0.37, delay: 0.06, filter: { type: "bandpass", from: 630, to: 840, q: 1.5 } },
        { type: "noise", seconds: 0.04, attack: 0.001, gain: 0.42, delay: 0.12, filter: { type: "bandpass", from: 630, to: 840, q: 1.5 } },
        { type: "noise", seconds: 0.04, attack: 0.001, gain: 0.47, delay: 0.18, filter: { type: "bandpass", from: 630, to: 840, q: 1.5 } },
        { type: "noise", seconds: 0.04, attack: 0.001, gain: 0.52, delay: 0.24, filter: { type: "bandpass", from: 630, to: 840, q: 1.5 } },
        { type: "noise", seconds: 0.04, attack: 0.001, gain: 0.57, delay: 0.3, filter: { type: "bandpass", from: 630, to: 840, q: 1.5 } },
        { type: "noise", seconds: 0.04, attack: 0.001, gain: 0.62, delay: 0.36, filter: { type: "bandpass", from: 630, to: 840, q: 1.5 } },
        { type: "noise", seconds: 0.04, attack: 0.001, gain: 0.67, delay: 0.42, filter: { type: "bandpass", from: 630, to: 840, q: 1.5 } },
        { type: "sawtooth", from: 72, to: 113, seconds: 0.6, attack: 0.12, gain: 0.45, vibrato: { rate: 4, depth: 0.07 }, filter: { type: "lowpass", from: 900, to: 450, q: 5 } },
        { type: "sawtooth", from: 72, to: 112, seconds: 0.6, attack: 0.14, gain: 0.25, filter: { type: "lowpass", from: 720, to: 360, q: 3 } },
        { type: "brown", seconds: 0.6, attack: 0.1, gain: 0.3, filter: { type: "bandpass", from: 360, to: 270, q: 2 } },
      ],
    },
    // Throws the barbell: Whoosh and bellow.
    ghoulStrongmanThrow: {
      layers: [
        { type: "noise", seconds: 0.5, attack: 0.18, gain: 0.64, filter: { type: "bandpass", from: 240, to: 1440, q: 1.5 } },
        { type: "sawtooth", from: 97, to: 124, seconds: 0.14, attack: 0.05, gain: 0.54, vibrato: { rate: 4, depth: 0.1 }, filter: { type: "lowpass", from: 300, to: 1980, q: 4 } },
        { type: "sawtooth", from: 124, to: 76, seconds: 0.28, delay: 0.12, attack: 0.02, gain: 0.54, vibrato: { rate: 4, depth: 0.12 }, filter: { type: "lowpass", from: 1980, to: 260, q: 4 } },
        { type: "sawtooth", from: 54, to: 39, seconds: 0.4, attack: 0.08, gain: 0.36, filter: { type: "lowpass", from: 500, to: 500, q: 1 } },
        { type: "brown", seconds: 0.4, attack: 0.06, gain: 0.48, filter: { type: "lowpass", from: 900, to: 180, q: 1 } },
        { type: "sine", from: 54, to: 38, seconds: 0.4, attack: 0.05, gain: 0.42 },
      ],
    },
    // Barbell lands: Dumbbell bounce.
    ghoulStrongmanLand: {
      layers: [
        { type: "sine", from: 400, to: 396, seconds: 0.3, attack: 0.003, gain: 0.42 },
        { type: "sine", from: 1104, to: 1080, seconds: 0.18, attack: 0.003, gain: 0.21 },
        { type: "sine", from: 2160, to: 2120, seconds: 0.09, attack: 0.003, gain: 0.11 },
        { type: "sine", from: 400, to: 396, seconds: 0.25, attack: 0.003, gain: 0.3, delay: 0.2 },
        { type: "sine", from: 1104, to: 1080, seconds: 0.15, attack: 0.003, gain: 0.15, delay: 0.2 },
        { type: "sine", from: 2160, to: 2120, seconds: 0.08, attack: 0.003, gain: 0.08, delay: 0.2 },
        { type: "sine", from: 400, to: 396, seconds: 0.2, attack: 0.003, gain: 0.21, delay: 0.35 },
        { type: "sine", from: 1104, to: 1080, seconds: 0.12, attack: 0.003, gain: 0.11, delay: 0.35 },
        { type: "sine", from: 2160, to: 2120, seconds: 0.06, attack: 0.003, gain: 0.05, delay: 0.35 },
        { type: "sine", from: 88, to: 32, seconds: 0.25, attack: 0, gain: 0.7 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.56, filter: { type: "lowpass", from: 256, to: 256, q: 1 } },
      ],
    },
    // Takes a bolt: Bar clang on the skull.
    ghoulStrongmanHurt: {
      layers: [
        { type: "sine", from: 450, to: 446, seconds: 0.35, attack: 0.003, gain: 0.42 },
        { type: "sine", from: 1242, to: 1215, seconds: 0.21, attack: 0.003, gain: 0.21 },
        { type: "sine", from: 2430, to: 2385, seconds: 0.11, attack: 0.003, gain: 0.11 },
        { type: "sawtooth", from: 140, to: 97, seconds: 0.16, attack: 0.01, gain: 0.54, vibrato: { rate: 4, depth: 0.1 }, filter: { type: "lowpass", from: 1188, to: 1188, q: 1 }, delay: 0.03 },
        { type: "brown", seconds: 0.13, attack: 0.01, gain: 0.36, filter: { type: "lowpass", from: 600, to: 600, q: 1 }, delay: 0.03 },
      ],
    },
    // Dies: Groan and boom.
    ghoulStrongmanDie: {
      layers: [
        { type: "sawtooth", from: 99, to: 70, seconds: 0.7, attack: 0.12, gain: 0.72, vibrato: { rate: 4, depth: 0.07 }, filter: { type: "lowpass", from: 900, to: 450, q: 5 } },
        { type: "sawtooth", from: 100, to: 70, seconds: 0.7, attack: 0.14, gain: 0.4, filter: { type: "lowpass", from: 720, to: 360, q: 3 } },
        { type: "brown", seconds: 0.7, attack: 0.1, gain: 0.48, filter: { type: "bandpass", from: 360, to: 270, q: 2 } },
        { type: "sine", from: 90, to: 33, seconds: 0.25, attack: 0.002, gain: 0.9, delay: 0.6 },
        { type: "noise", seconds: 0.08, attack: 0.001, gain: 0.45, delay: 0.6, filter: { type: "lowpass", from: 1500, to: 300, q: 1 } },
      ],
    },
    // Circus Hound: A lean performing dog with a ruff and a hoop of fire: it crouches, then leaps at you through the flames.
    // Trots in: Squeaky chew toy.
    ghoulCircusHoundAppear: {
      layers: [
        { type: "sine", from: 1100, to: 1980, seconds: 0.09, attack: 0.004, gain: 0.49, vibrato: { rate: 38, depth: 0.06 } },
        { type: "sine", from: 2090, to: 1320, seconds: 0.1, attack: 0.004, gain: 0.35, delay: 0.08, vibrato: { rate: 38, depth: 0.06 } },
        { type: "sine", from: 1200, to: 2160, seconds: 0.09, attack: 0.004, gain: 0.49, delay: 0.2, vibrato: { rate: 38, depth: 0.06 } },
        { type: "sine", from: 2280, to: 1440, seconds: 0.1, attack: 0.004, gain: 0.35, delay: 0.28, vibrato: { rate: 38, depth: 0.06 } },
        { type: "sawtooth", from: 146, to: 109, seconds: 0.3, attack: 0.03, gain: 0.45, vibrato: { rate: 15, depth: 0.2 }, filter: { type: "bandpass", from: 819, to: 455, q: 3 }, delay: 0.35 },
        { type: "noise", seconds: 0.27, attack: 0.02, gain: 0.25, filter: { type: "bandpass", from: 1120, to: 490, q: 1.5 }, delay: 0.35 },
        { type: "square", from: 73, to: 64, seconds: 0.3, attack: 0.03, gain: 0.18, filter: { type: "lowpass", from: 350, to: 350, q: 1 }, delay: 0.35 },
      ],
    },
    // Crouches: Panting squeak.
    ghoulCircusHoundCrouch: {
      layers: [
        { type: "noise", seconds: 0.22, attack: 0.15, gain: 0.42, filter: { type: "bandpass", from: 1650, to: 3600, q: 4 } },
        { type: "sawtooth", from: 390, to: 507, seconds: 0.2, attack: 0.14, gain: 0.15, filter: { type: "lowpass", from: 2100, to: 2100, q: 1 } },
        { type: "noise", seconds: 0.22, attack: 0.15, gain: 0.42, filter: { type: "bandpass", from: 1650, to: 3600, q: 4 }, delay: 0.2 },
        { type: "sawtooth", from: 390, to: 507, seconds: 0.2, attack: 0.14, gain: 0.15, filter: { type: "lowpass", from: 2100, to: 2100, q: 1 }, delay: 0.2 },
        { type: "sine", from: 1600, to: 2880, seconds: 0.09, attack: 0.004, gain: 0.28, delay: 0.3, vibrato: { rate: 38, depth: 0.06 } },
        { type: "sine", from: 3040, to: 1920, seconds: 0.1, attack: 0.004, gain: 0.2, delay: 0.38, vibrato: { rate: 38, depth: 0.06 } },
      ],
    },
    // Leaps: Slide whistle leap.
    ghoulCircusHoundLeap: {
      layers: [
        { type: "sine", from: 300, to: 1400, seconds: 0.4, attack: 0.02, gain: 0.6, vibrato: { rate: 6, depth: 0.02 } },
        { type: "sawtooth", from: 208, to: 156, seconds: 0.3, attack: 0.03, gain: 0.54, vibrato: { rate: 15, depth: 0.2 }, filter: { type: "bandpass", from: 1170, to: 650, q: 3 }, delay: 0.1 },
        { type: "noise", seconds: 0.27, attack: 0.02, gain: 0.3, filter: { type: "bandpass", from: 1600, to: 700, q: 1.5 }, delay: 0.1 },
        { type: "square", from: 104, to: 91, seconds: 0.3, attack: 0.03, gain: 0.21, filter: { type: "lowpass", from: 500, to: 500, q: 1 }, delay: 0.1 },
      ],
    },
    // Lands: Thud and claws.
    ghoulCircusHoundLand: {
      layers: [
        { type: "sine", from: 132, to: 48, seconds: 0.25, attack: 0, gain: 0.8 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.64, filter: { type: "lowpass", from: 384, to: 384, q: 1 } },
        { type: "noise", seconds: 0.04, delay: 0.05, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 3075, to: 2460, q: 6 } },
        { type: "square", from: 1295, to: 611, seconds: 0.02, delay: 0.05, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.08, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 4125, to: 3300, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.11, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 4584, to: 3667, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.14, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 3568, to: 2854, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.16, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 3797, to: 3038, q: 6 } },
        { type: "square", from: 940, to: 601, seconds: 0.02, delay: 0.16, gain: 0.3 },
      ],
    },
    // Takes a bolt: Squeaky yip.
    ghoulCircusHoundHurt: {
      layers: [
        { type: "sine", from: 1500, to: 2700, seconds: 0.09, attack: 0.004, gain: 0.49, vibrato: { rate: 38, depth: 0.06 } },
        { type: "sine", from: 2850, to: 1800, seconds: 0.1, attack: 0.004, gain: 0.35, delay: 0.08, vibrato: { rate: 38, depth: 0.06 } },
        { type: "sawtooth", from: 900, to: 540, seconds: 0.2, attack: 0.01, gain: 0.4, vibrato: { rate: 10, depth: 0.03 }, filter: { type: "bandpass", from: 1800, to: 1440, q: 2 }, delay: 0.03 },
        { type: "sawtooth", from: 810, to: 450, seconds: 0.26, delay: 0.2, attack: 0.01, gain: 0.28, filter: { type: "bandpass", from: 1620, to: 1080, q: 2 } },
      ],
    },
    // Dies: Slide whistle sinks.
    ghoulCircusHoundDie: {
      layers: [
        { type: "sine", from: 1200, to: 150, seconds: 0.7, attack: 0.02, gain: 0.6, vibrato: { rate: 6, depth: 0.02 } },
        { type: "sine", from: 121, to: 44, seconds: 0.25, attack: 0, gain: 0.6, delay: 0.7 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.48, filter: { type: "lowpass", from: 352, to: 352, q: 1 }, delay: 0.7 },
      ],
    },
    // The Ringmaster: A gaunt master of ceremonies in a red coat and a tall hat: from his gantry he works a giant puppet on three strings and cracks his whip; cut the strings and he is open; at half health he lets the hounds out.
    // Wakes: Top hat laugh.
    ghoulRingmasterWake: {
      layers: [
        { type: "sawtooth", from: 220, to: 176, seconds: 0.09, attack: 0.01, gain: 0.56, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 550, to: 440, q: 3 } },
        { type: "sawtooth", from: 209, to: 167, seconds: 0.09, delay: 0.14, attack: 0.01, gain: 0.56, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 523, to: 418, q: 3 } },
        { type: "sawtooth", from: 198, to: 158, seconds: 0.09, delay: 0.28, attack: 0.01, gain: 0.56, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 495, to: 396, q: 3 } },
        { type: "sawtooth", from: 187, to: 150, seconds: 0.09, delay: 0.42, attack: 0.01, gain: 0.56, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 468, to: 374, q: 3 } },
        { type: "sawtooth", from: 90, to: 67, seconds: 0.5, attack: 0.03, gain: 0.72, vibrato: { rate: 4.5, depth: 0.2 }, filter: { type: "bandpass", from: 504, to: 280, q: 3 }, delay: 0.5 },
        { type: "noise", seconds: 0.45, attack: 0.02, gain: 0.4, filter: { type: "bandpass", from: 1280, to: 560, q: 1.5 }, delay: 0.5 },
        { type: "square", from: 45, to: 39, seconds: 0.5, attack: 0.03, gain: 0.28, filter: { type: "lowpass", from: 400, to: 400, q: 1 }, delay: 0.5 },
      ],
    },
    // Puppet lifts its foot: Strings tighten.
    ghoulRingmasterPuppetWind: {
      layers: [
        { type: "triangle", from: 168, to: 150, seconds: 0.3, attack: 0.002, gain: 0.56, vibrato: { rate: 32, depth: 0.03 } },
        { type: "sine", from: 301, to: 300, seconds: 0.18, attack: 0.002, gain: 0.21 },
        { type: "noise", seconds: 0.02, attack: 0.001, gain: 0.28, filter: { type: "bandpass", from: 3000, to: 3000, q: 2 } },
        { type: "triangle", from: 224, to: 200, seconds: 0.3, attack: 0.002, gain: 0.56, delay: 0.2, vibrato: { rate: 32, depth: 0.03 } },
        { type: "sine", from: 402, to: 400, seconds: 0.18, attack: 0.002, gain: 0.21, delay: 0.2 },
        { type: "noise", seconds: 0.02, attack: 0.001, gain: 0.28, delay: 0.2, filter: { type: "bandpass", from: 3000, to: 3000, q: 2 } },
        { type: "triangle", from: 291, to: 260, seconds: 0.3, attack: 0.002, gain: 0.56, delay: 0.4, vibrato: { rate: 32, depth: 0.03 } },
        { type: "sine", from: 523, to: 520, seconds: 0.18, attack: 0.002, gain: 0.21, delay: 0.4 },
        { type: "noise", seconds: 0.02, attack: 0.001, gain: 0.28, delay: 0.4, filter: { type: "bandpass", from: 3000, to: 3000, q: 2 } },
        { type: "sawtooth", from: 45, to: 70, seconds: 0.7, attack: 0.12, gain: 0.36, vibrato: { rate: 3, depth: 0.07 }, filter: { type: "lowpass", from: 800, to: 400, q: 5 } },
        { type: "sawtooth", from: 45, to: 70, seconds: 0.7, attack: 0.14, gain: 0.2, filter: { type: "lowpass", from: 640, to: 320, q: 3 } },
        { type: "brown", seconds: 0.7, attack: 0.1, gain: 0.24, filter: { type: "bandpass", from: 224, to: 168, q: 2 } },
      ],
    },
    // Puppet stomp: Bass drum, tent shakes.
    ghoulRingmasterStomp: {
      layers: [
        { type: "sine", from: 75, to: 28, seconds: 0.25, attack: 0.002, gain: 1 },
        { type: "noise", seconds: 0.08, attack: 0.001, gain: 0.5, filter: { type: "lowpass", from: 1500, to: 300, q: 1 } },
        { type: "brown", seconds: 1, attack: 0.08, gain: 0.6, filter: { type: "lowpass", from: 180, to: 70, q: 1 }, delay: 0.05 },
        { type: "sine", from: 48, to: 30, seconds: 1, attack: 0.05, gain: 0.48, delay: 0.05 },
        { type: "sawtooth", from: 80, to: 100, seconds: 0.7, attack: 0.05, gain: 0.2, delay: 0.2, filter: { type: "bandpass", from: 320, to: 480, q: 8 }, vibrato: { rate: 9, depth: 0.18 } },
        { type: "pink", seconds: 0.7, attack: 0.06, gain: 0.1, delay: 0.2, filter: { type: "bandpass", from: 400, to: 240, q: 6 } },
      ],
    },
    // Puppet collapses: Slack-string trombone.
    ghoulRingmasterDown: {
      layers: [
        { type: "sawtooth", from: 400, to: 90, seconds: 0.7, attack: 0.03, gain: 0.56, filter: { type: "lowpass", from: 1400, to: 700, q: 1 }, vibrato: { rate: 5, depth: 0.02 } },
        { type: "noise", seconds: 0.04, delay: 0.4, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1446, to: 1157, q: 6 } },
        { type: "square", from: 548, to: 369, seconds: 0.02, delay: 0.4, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.48, attack: 0, gain: 0.79, filter: { type: "bandpass", from: 2098, to: 1679, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.54, attack: 0, gain: 0.68, filter: { type: "bandpass", from: 1874, to: 1499, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.6, attack: 0, gain: 0.58, filter: { type: "bandpass", from: 1838, to: 1471, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.69, attack: 0, gain: 0.47, filter: { type: "bandpass", from: 2140, to: 1712, q: 6 } },
        { type: "square", from: 717, to: 363, seconds: 0.02, delay: 0.69, gain: 0.3 },
        { type: "sine", from: 55, to: 20, seconds: 0.25, attack: 0, gain: 0.8, delay: 0.6 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.64, filter: { type: "lowpass", from: 160, to: 160, q: 1 }, delay: 0.6 },
      ],
    },
    // Drops, open: Dazed ring.
    ghoulRingmasterOpen: {
      layers: [
        { type: "sine", from: 700, to: 693, seconds: 0.9, attack: 0.003, gain: 0.36 },
        { type: "sine", from: 1932, to: 1890, seconds: 0.54, attack: 0.003, gain: 0.18 },
        { type: "sine", from: 3780, to: 3710, seconds: 0.27, attack: 0.003, gain: 0.09 },
        { type: "sawtooth", from: 77, to: 55, seconds: 0.7, attack: 0.12, gain: 0.63, vibrato: { rate: 3, depth: 0.07 }, filter: { type: "lowpass", from: 800, to: 400, q: 5 }, delay: 0.1 },
        { type: "sawtooth", from: 77, to: 54, seconds: 0.7, attack: 0.14, gain: 0.35, filter: { type: "lowpass", from: 640, to: 320, q: 3 }, delay: 0.1 },
        { type: "brown", seconds: 0.7, attack: 0.1, gain: 0.42, filter: { type: "bandpass", from: 280, to: 210, q: 2 }, delay: 0.1 },
      ],
    },
    // Climbs back: Ladder rungs.
    ghoulRingmasterClimb: {
      layers: [
        { type: "triangle", from: 720, to: 304, seconds: 0.06, attack: 0.001, gain: 0.64 },
        { type: "noise", seconds: 0.03, attack: 0.001, gain: 0.48, filter: { type: "bandpass", from: 1760, to: 1440, q: 2 } },
        { type: "triangle", from: 810, to: 342, seconds: 0.06, attack: 0.001, gain: 0.64, delay: 0.15 },
        { type: "noise", seconds: 0.03, attack: 0.001, gain: 0.48, delay: 0.15, filter: { type: "bandpass", from: 1980, to: 1620, q: 2 } },
        { type: "triangle", from: 900, to: 380, seconds: 0.06, attack: 0.001, gain: 0.64, delay: 0.3 },
        { type: "noise", seconds: 0.03, attack: 0.001, gain: 0.48, delay: 0.3, filter: { type: "bandpass", from: 2200, to: 1800, q: 2 } },
        { type: "triangle", from: 990, to: 418, seconds: 0.06, attack: 0.001, gain: 0.64, delay: 0.45 },
        { type: "noise", seconds: 0.03, attack: 0.001, gain: 0.48, delay: 0.45, filter: { type: "bandpass", from: 2420, to: 1980, q: 2 } },
        { type: "sawtooth", from: 120, to: 150, seconds: 0.6, attack: 0.05, gain: 0.2, filter: { type: "bandpass", from: 480, to: 720, q: 8 }, vibrato: { rate: 9, depth: 0.18 } },
        { type: "pink", seconds: 0.6, attack: 0.06, gain: 0.1, filter: { type: "bandpass", from: 600, to: 360, q: 6 } },
      ],
    },
    // Re-strings the puppet: Three taut twangs.
    ghoulRingmasterTie: {
      layers: [
        { type: "triangle", from: 246, to: 220, seconds: 0.3, attack: 0.002, gain: 0.64, vibrato: { rate: 32, depth: 0.03 } },
        { type: "sine", from: 442, to: 440, seconds: 0.18, attack: 0.002, gain: 0.24 },
        { type: "noise", seconds: 0.02, attack: 0.001, gain: 0.32, filter: { type: "bandpass", from: 3000, to: 3000, q: 2 } },
        { type: "triangle", from: 314, to: 280, seconds: 0.3, attack: 0.002, gain: 0.64, delay: 0.2, vibrato: { rate: 32, depth: 0.03 } },
        { type: "sine", from: 563, to: 560, seconds: 0.18, attack: 0.002, gain: 0.24, delay: 0.2 },
        { type: "noise", seconds: 0.02, attack: 0.001, gain: 0.32, delay: 0.2, filter: { type: "bandpass", from: 3000, to: 3000, q: 2 } },
        { type: "triangle", from: 381, to: 340, seconds: 0.3, attack: 0.002, gain: 0.64, delay: 0.4, vibrato: { rate: 32, depth: 0.03 } },
        { type: "sine", from: 683, to: 680, seconds: 0.18, attack: 0.002, gain: 0.24, delay: 0.4 },
        { type: "noise", seconds: 0.02, attack: 0.001, gain: 0.32, delay: 0.4, filter: { type: "bandpass", from: 3000, to: 3000, q: 2 } },
      ],
    },
    // Whip wind-up: Whip drags the boards.
    ghoulRingmasterLashWind: {
      layers: [
        { type: "noise", seconds: 0.7, attack: 0.3, gain: 0.6, filter: { type: "bandpass", from: 1500, to: 600, q: 3 } },
        { type: "noise", seconds: 0.6, attack: 0.06, gain: 0.32, filter: { type: "highpass", from: 1920, to: 4000, q: 1 }, delay: 0.1 },
        { type: "pink", seconds: 0.6, attack: 0.05, gain: 0.2, filter: { type: "bandpass", from: 2560, to: 1760, q: 2 }, delay: 0.1 },
      ],
    },
    // Whip crack: Crack and cymbal.
    ghoulRingmasterCrack: {
      layers: [
        { type: "noise", seconds: 0.04, attack: 0.001, gain: 0.9, filter: { type: "highpass", from: 3500, to: 6000, q: 1 } },
        { type: "square", from: 2400, to: 180, seconds: 0.06, attack: 0.001, gain: 0.5 },
        { type: "noise", seconds: 0.05, attack: 0.002, gain: 0.6, delay: 0.07, filter: { type: "bandpass", from: 2800, to: 1800, q: 3 } },
        { type: "noise", seconds: 0.5, attack: 0.003, gain: 0.35, delay: 0.03, filter: { type: "highpass", from: 5500, to: 7000, q: 1 } },
        { type: "pink", seconds: 0.4, attack: 0.005, gain: 0.18, delay: 0.03, filter: { type: "bandpass", from: 8000, to: 6000, q: 3 } },
      ],
    },
    // Bolt hits a string: Fray zip.
    ghoulRingmasterStringHit: {
      layers: [
        { type: "noise", seconds: 0.08, attack: 0.003, gain: 0.6, filter: { type: "bandpass", from: 3500, to: 1500, q: 3 } },
        { type: "triangle", from: 560, to: 500, seconds: 0.15, attack: 0.002, gain: 0.4, delay: 0.03, vibrato: { rate: 32, depth: 0.03 } },
        { type: "sine", from: 1005, to: 1000, seconds: 0.09, attack: 0.002, gain: 0.15, delay: 0.03 },
        { type: "noise", seconds: 0.02, attack: 0.001, gain: 0.2, delay: 0.03, filter: { type: "bandpass", from: 3000, to: 3000, q: 2 } },
      ],
    },
    // A string is cut: Loud snap and twang.
    ghoulRingmasterStringCut: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2160, to: 1440, q: 2 } },
        { type: "square", from: 1080, to: 360, seconds: 0.05, attack: 0, gain: 0.36 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.63, filter: { type: "bandpass", from: 3120, to: 2160, q: 3 } },
        { type: "triangle", from: 280, to: 250, seconds: 0.5, attack: 0.002, gain: 0.64, delay: 0.02, vibrato: { rate: 32, depth: 0.03 } },
        { type: "sine", from: 502, to: 500, seconds: 0.3, attack: 0.002, gain: 0.24, delay: 0.02 },
        { type: "noise", seconds: 0.02, attack: 0.001, gain: 0.32, delay: 0.02, filter: { type: "bandpass", from: 3000, to: 3000, q: 2 } },
      ],
    },
    // Cages burst open: Bars clank, barking.
    ghoulRingmasterCage: {
      layers: [
        { type: "sine", from: 350, to: 347, seconds: 0.4, attack: 0.003, gain: 0.42 },
        { type: "sine", from: 966, to: 945, seconds: 0.24, attack: 0.003, gain: 0.21 },
        { type: "sine", from: 1890, to: 1855, seconds: 0.12, attack: 0.003, gain: 0.11 },
        { type: "sawtooth", from: 500, to: 300, seconds: 0.2, attack: 0.01, gain: 0.56, vibrato: { rate: 10, depth: 0.03 }, filter: { type: "bandpass", from: 1000, to: 800, q: 2 }, delay: 0.15 },
        { type: "sawtooth", from: 450, to: 250, seconds: 0.26, delay: 0.32, attack: 0.01, gain: 0.39, filter: { type: "bandpass", from: 900, to: 600, q: 2 } },
        { type: "sawtooth", from: 112, to: 84, seconds: 0.4, attack: 0.03, gain: 0.54, vibrato: { rate: 4.5, depth: 0.2 }, filter: { type: "bandpass", from: 630, to: 350, q: 3 }, delay: 0.3 },
        { type: "noise", seconds: 0.36, attack: 0.02, gain: 0.3, filter: { type: "bandpass", from: 1600, to: 700, q: 1.5 }, delay: 0.3 },
        { type: "square", from: 56, to: 49, seconds: 0.4, attack: 0.03, gain: 0.21, filter: { type: "lowpass", from: 500, to: 500, q: 1 }, delay: 0.3 },
      ],
    },
    // Rages: Calliope shrieks.
    ghoulRingmasterRage: {
      layers: [
        { type: "square", seconds: 0.9, attack: 0.01, gain: 0.4, notes: [698, 740, 698, 622, 698], filter: { type: "lowpass", from: 3200, to: 2600, q: 1 }, vibrato: { rate: 5.5, depth: 0.05 } },
        { type: "triangle", seconds: 0.9, attack: 0.01, gain: 0.24, notes: [1399, 1484, 1399, 1247, 1399] },
        { type: "pink", seconds: 0.72, attack: 0.04, gain: 0.1, filter: { type: "bandpass", from: 3000, to: 3000, q: 2 } },
        { type: "sawtooth", from: 1500, to: 2100, seconds: 0.8, attack: 0.03, gain: 0.32, vibrato: { rate: 12, depth: 0.04 }, filter: { type: "bandpass", from: 3000, to: 3600, q: 4 }, delay: 0.1 },
        { type: "sawtooth", from: 2250, to: 3150, seconds: 0.72, attack: 0.04, gain: 0.14, filter: { type: "bandpass", from: 4500, to: 4500, q: 5 }, delay: 0.1 },
        { type: "noise", seconds: 0.64, attack: 0.03, gain: 0.12, filter: { type: "highpass", from: 3000, to: 3000, q: 1 }, delay: 0.1 },
      ],
    },
    // Takes a bolt: Honk of pain.
    ghoulRingmasterHurt: {
      layers: [
        { type: "square", from: 220, to: 132, seconds: 0.2, attack: 0.012, gain: 0.48, filter: { type: "bandpass", from: 660, to: 528, q: 2 } },
        { type: "sawtooth", from: 224, to: 135, seconds: 0.2, attack: 0.015, gain: 0.4, filter: { type: "lowpass", from: 1100, to: 660, q: 1 } },
        { type: "sawtooth", from: 118, to: 82, seconds: 0.16, attack: 0.01, gain: 0.36, vibrato: { rate: 3, depth: 0.1 }, filter: { type: "lowpass", from: 1144, to: 1144, q: 1 }, delay: 0.03 },
        { type: "brown", seconds: 0.13, attack: 0.01, gain: 0.24, filter: { type: "lowpass", from: 650, to: 650, q: 1 }, delay: 0.03 },
      ],
    },
    // Dies: Strings snap, curtain falls.
    ghoulRingmasterDie: {
      layers: [
        { type: "triangle", from: 336, to: 300, seconds: 0.3, attack: 0.002, gain: 0.64, vibrato: { rate: 32, depth: 0.03 } },
        { type: "sine", from: 603, to: 600, seconds: 0.18, attack: 0.002, gain: 0.24 },
        { type: "noise", seconds: 0.02, attack: 0.001, gain: 0.32, filter: { type: "bandpass", from: 3000, to: 3000, q: 2 } },
        { type: "triangle", from: 224, to: 200, seconds: 0.3, attack: 0.002, gain: 0.56, delay: 0.15, vibrato: { rate: 32, depth: 0.03 } },
        { type: "sine", from: 402, to: 400, seconds: 0.18, attack: 0.002, gain: 0.21, delay: 0.15 },
        { type: "noise", seconds: 0.02, attack: 0.001, gain: 0.28, delay: 0.15, filter: { type: "bandpass", from: 3000, to: 3000, q: 2 } },
        { type: "triangle", from: 157, to: 140, seconds: 0.4, attack: 0.002, gain: 0.56, delay: 0.3, vibrato: { rate: 32, depth: 0.03 } },
        { type: "sine", from: 281, to: 280, seconds: 0.24, attack: 0.002, gain: 0.21, delay: 0.3 },
        { type: "noise", seconds: 0.02, attack: 0.001, gain: 0.28, delay: 0.3, filter: { type: "bandpass", from: 3000, to: 3000, q: 2 } },
        { type: "brown", seconds: 0.7, attack: 0.08, gain: 0.6, filter: { type: "lowpass", from: 180, to: 70, q: 1 }, delay: 0.3 },
        { type: "sine", from: 48, to: 30, seconds: 0.7, attack: 0.05, gain: 0.48, delay: 0.3 },
        { type: "sawtooth", from: 62, to: 44, seconds: 0.6, attack: 0.12, gain: 0.45, vibrato: { rate: 3, depth: 0.07 }, filter: { type: "lowpass", from: 800, to: 400, q: 5 }, delay: 0.4 },
      ],
    },
    // Cotton Candy: The stage power-up: for 10 seconds your bolts are sticky and slow whatever they hit to half speed for 3 s.
    // Picked up: Sugar sparkle.
    ghoulFlossActive: {
      layers: [
        { type: "sine", from: 1568, to: 1552, seconds: 0.3, attack: 0.003, gain: 0.3 },
        { type: "sine", from: 4328, to: 4234, seconds: 0.18, attack: 0.003, gain: 0.15 },
        { type: "sine", from: 8467, to: 8310, seconds: 0.09, attack: 0.003, gain: 0.08 },
        { type: "sine", from: 1976, to: 1956, seconds: 0.3, attack: 0.003, gain: 0.3, delay: 0.08 },
        { type: "sine", from: 5454, to: 5335, seconds: 0.18, attack: 0.003, gain: 0.15, delay: 0.08 },
        { type: "sine", from: 10670, to: 10473, seconds: 0.09, attack: 0.003, gain: 0.08, delay: 0.08 },
        { type: "sine", from: 2349, to: 2326, seconds: 0.5, attack: 0.003, gain: 0.3, delay: 0.16 },
        { type: "sine", from: 6483, to: 6342, seconds: 0.3, attack: 0.003, gain: 0.15, delay: 0.16 },
        { type: "sine", from: 12685, to: 12450, seconds: 0.15, attack: 0.003, gain: 0.08, delay: 0.16 },
        { type: "noise", seconds: 0.3, attack: 0.11, gain: 0.24, filter: { type: "bandpass", from: 480, to: 2880, q: 1.5 } },
      ],
    },
    // Bolt sticks: Glue bubbles.
    ghoulFlossStick: {
      layers: [
        { type: "sine", from: 577, to: 981, seconds: 0.05, delay: 0.25, attack: 0, gain: 0.32 },
        { type: "sine", from: 342, to: 582, seconds: 0.05, delay: 0.1, attack: 0, gain: 0.32 },
        { type: "sine", from: 356, to: 605, seconds: 0.05, delay: 0.12, attack: 0, gain: 0.32 },
        { type: "sine", from: 630, to: 1070, seconds: 0.05, attack: 0, gain: 0.32 },
        { type: "sine", from: 688, to: 1170, seconds: 0.05, delay: 0.03, attack: 0, gain: 0.32 },
        { type: "noise", seconds: 0.1, attack: 0, gain: 0.4, filter: { type: "highpass", from: 2520, to: 2520, q: 1 } },
        { type: "sine", from: 980, to: 210, seconds: 0.16, delay: 0.02, gain: 0.3 },
        { type: "brown", seconds: 0.12, attack: 0, gain: 0.25, filter: { type: "lowpass", from: 588, to: 588, q: 1 } },
      ],
    },
    // Custard Pie: The stage weapon (tap twice): a foil tin of custard thrown in an arc; it splats where it lands and stuns a group, and a pied Mirror You stops copying.
    // Throw: Lob and whistle.
    ghoulPieThrow: {
      layers: [
        { type: "sawtooth", from: 585, to: 405, seconds: 0.12, attack: 0.01, gain: 0.36, vibrato: { rate: 6, depth: 0.1 }, filter: { type: "lowpass", from: 2970, to: 2970, q: 1 } },
        { type: "brown", seconds: 0.1, attack: 0.01, gain: 0.24, filter: { type: "lowpass", from: 750, to: 750, q: 1 } },
        { type: "sine", from: 500, to: 900, seconds: 0.4, attack: 0.02, gain: 0.4, delay: 0.05, vibrato: { rate: 6, depth: 0.02 } },
        { type: "noise", seconds: 0.4, attack: 0.14, gain: 0.48, filter: { type: "bandpass", from: 270, to: 1620, q: 1.5 }, delay: 0.05 },
      ],
    },
    // Splat: Squelch and giggle.
    ghoulPieSplat: {
      layers: [
        { type: "brown", seconds: 0.3, attack: 0.01, gain: 0.8, filter: { type: "lowpass", from: 1430, to: 165, q: 1 } },
        { type: "sine", from: 286, to: 66, seconds: 0.22, attack: 0.01, gain: 0.56 },
        { type: "noise", seconds: 0.12, attack: 0.01, gain: 0.32, filter: { type: "bandpass", from: 990, to: 330, q: 3 } },
        { type: "sawtooth", from: 1100, to: 880, seconds: 0.09, delay: 0.2, attack: 0.01, gain: 0.35, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 2750, to: 2200, q: 3 } },
        { type: "sawtooth", from: 1045, to: 836, seconds: 0.09, delay: 0.29, attack: 0.01, gain: 0.35, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 2613, to: 2090, q: 3 } },
        { type: "sawtooth", from: 990, to: 792, seconds: 0.09, delay: 0.38, attack: 0.01, gain: 0.35, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 2475, to: 1980, q: 3 } },
      ],
    },
  },
  music: {
    // The Midway: warped calliope waltz. A band-organ waltz in G minor that
    // has been left in the sun: a thin calliope plays the three-note figure
    // with a drifting twin under it that never stays in tune, a tuba goes oom
    // and a chord goes pah, and now and then the pah arrives a hair late. The
    // second section answers an octave higher, the third turns to Cm, Gm, Ab,
    // D, and the break is one note a bar. At high dread a bellows wheezes
    // under it and a steam whistle cries over the top.
    ghoulMidway: {
      bpm: 96,
      rush: 8,
      voices: {
        call: { wave: "pulse", duty: 0.25, gain: 0.16, decay: 0.1, sustain: 0.75, vibrato: { rate: 5.2, depth: 0.012, delay: 0.12 } },
        wob: { wave: "sine", gain: 0.1, decay: 0.2, sustain: 0.8, vibrato: { rate: 0.8, depth: 0.035, delay: 0 } },
        tuba: { wave: "triangle", gain: 0.42, decay: 0.12, sustain: 0.45 },
        pah: { wave: "pulse", duty: 0.125, gain: 0.07, decay: 0.05, sustain: 0.3 },
        brush: { kit: true, gain: 0.12, from: 0.4 },
        wheeze: { wave: "sawtooth", gain: 0.035, decay: 0.4, sustain: 1, from: 0.6, vibrato: { rate: 0.45, depth: 0.03, delay: 0 } },
        whistle: { wave: "sine", gain: 0.07, decay: 0.5, sustain: 0.9, from: 0.85, vibrato: { rate: 6, depth: 0.015, delay: 0.1 } },
      },
      patterns: {
        A: {
          call:
          "G4 - - - Bb4 - - - D5 - - - | Eb5 - - - D5 - - - C#5 - - - | " +
          "C5 - - - Bb4 - - - G4 - - - | A4 - - - - - - - . . . .",
          wob:
          "G4 - - - Bb4 - - - D5 - - - | Eb5 - - - D5 - - - C#5 - - - | " +
          "C5 - - - Bb4 - - - G4 - - - | A4 - - - - - - - . . . .",
          tuba:
          "G2 - - . . . . . . . . . | Eb2 - - . . . . . . . . . | " +
          "C2 - - . . . . . . . . . | D2 - - . . . . . . . . .",
          pah:
          ". . . . G3^037 - . . G3^037 - . . | . . . . Eb3^047 - . . Eb3^047 - . . | " +
          ". . . . C3^037 - . . C3^037 - . . | . . . . D3^047 - . . D3^047 - . .",
          brush:
          ". . . . h . . . h . . . | . . . . h . . . h . . . | " +
          ". . . . h . . . h . . . | . . . . h . . . h . . .",
          wheeze:
          "G3 - - - - - - - - - - - | Eb3 - - - - - - - - - - - | " +
          "C3 - - - - - - - - - - - | D3 - - - - - - - - - - -",
          whistle:
          ". . . . . . . . . . . . | . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . | D6 - - - - - - - - - - -",
        },
        A2: {
          call:
          "D5 - - - G5 - - - F5 - - - | Eb5 - - - - - D5 - - Bb4 - - | " +
          "C5 - - - Eb5 - - - D5 - - - | C#5 - - - - - - - A4 - - -",
          wob:
          "D5 - - - G5 - - - F5 - - - | Eb5 - - - - - D5 - - Bb4 - - | " +
          "C5 - - - Eb5 - - - D5 - - - | C#5 - - - - - - - A4 - - -",
          tuba:
          "G2 - - . . . . . . . . . | Eb2 - - . . . . . . . . . | " +
          "C2 - - . . . . . . . . . | D2 - - . . . . . . . . .",
          pah:
          ". . . . G3^037 - . . G3^037 - . . | . . . . Eb3^047 - . . . Eb3^047 - . | " +
          ". . . . C3^037 - . . C3^037 - . . | . . . . D3^047 - . . . D3^047 - .",
          brush:
          ". . . . h . . . h . . . | . . . . h . . . h . . . | " +
          ". . . . h . . . h . . . | . . . . h . . . h . . .",
          wheeze:
          "G3 - - - - - - - - - - - | Eb3 - - - - - - - - - - - | " +
          "C3 - - - - - - - - - - - | D3 - - - - - - - - - - -",
          whistle:
          ". . . . . . . . . . . . | G6 - - - - - - - - - - - | " +
          ". . . . . . . . . . . . | . . . . . . . . . . . .",
        },
        B: {
          call:
          "Eb5 - - - D5 - - - C5 - - - | Bb4 - - - D5 - - - G5 - - - | " +
          "Ab5 - - - - - G5 - - Eb5 - - | F#5 - - - C#5 - - - A4 - - -",
          wob:
          "E5 - - - D#5 - - - C#5 - - - | B4 - - - D#5 - - - G#5 - - - | " +
          "A5 - - - - - G#5 - - E5 - - | G5 - - - D5 - - - A#4 - - -",
          tuba:
          "C2 - - . . . . . . . . . | G2 - - . . . . . . . . . | " +
          "Ab2 - - . . . . . . . . . | D2 - - . . . . . . . . .",
          pah:
          ". . . . C3^037 - . . C3^037 - . . | . . . . G3^037 - . . . G3^037 - . | " +
          ". . . . Ab3^047 - . . Ab3^047 - . . | . . . . D3^047 - . . . D3^047 - .",
          brush:
          ". . . . h . . . h . . . | . . . . h . . . h . . . | " +
          ". . . . h . . . h . . . | . . . . h . . . h . . .",
          wheeze:
          "C3 - - - - - - - - - - - | G3 - - - - - - - - - - - | " +
          "Ab3 - - - - - - - - - - - | D3 - - - - - - - - - - -",
          whistle:
          ". . . . . . . . . . . . | . . . . . . . . . . . . | " +
          "Ab6 - - - - - - - - - - - | . . . . . . . . . . . .",
        },
        C: {
          call:
          "G4 - - - - - - - - - - - | Eb5 - - - - - - - - - - - | " +
          "C5 - - - - - - - - - - - | A4 - - - - - - - - - - -",
          wob:
          ". . . . G4 - - - - - - - | - - - - Eb5 - - - - - - - | " +
          "- - - - C5 - - - - - - - | - - - - A4 - - - - - - -",
          tuba:
          "G2 - - - - - - - - - - - | . . . . . . . . . . . . | " +
          "C2 - - - - - - - - - - - | . . . . . . . . . . . .",
          pah:
          ". . . . . . . . . . . . | . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . | . . . . . . . . . . . .",
          brush:
          ". . . . . . . . . . . . | . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . | o . . . . . . . . . . .",
          wheeze:
          "G3 - - - - - - - - - - - | Eb3 - - - - - - - - - - - | " +
          "C3 - - - - - - - - - - - | D3 - - - - - - - - - - -",
          whistle:
          ". . . . . . . . . . . . | . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . | G5^037 - - - - - - - - - - -",
        },
      },
      order: ["A", "A2", "B", "A", "C"],
    },
    // The Hall of Mirrors: glass harmonica and cracked glass. Wet fingers on
    // wine glass in a long cold waltz: the figure sings in slow sine tones
    // with a higher twin that follows a beat later, and every so often a pane
    // cracks with a tiny high click somewhere in the room. A deep sine holds
    // the chords. The last section is bare: three notes and glass breaking in
    // the dark. At high dread a thin saw whine rubs against the glass.
    ghoulMirrors: {
      bpm: 70,
      rush: 8,
      voices: {
        glass: { wave: "sine", gain: 0.14, decay: 0.6, sustain: 0.7, vibrato: { rate: 5, depth: 0.008, delay: 0.2 } },
        glass2: { wave: "sine", gain: 0.07, decay: 0.6, sustain: 0.6, vibrato: { rate: 4.2, depth: 0.012, delay: 0.4 } },
        crack: { wave: "pulse", duty: 0.125, gain: 0.1, decay: 0.02, sustain: 0.05 },
        bass: { wave: "sine", gain: 0.3, decay: 0.4, sustain: 0.9 },
        pad: { wave: "triangle", gain: 0.09, decay: 0.5, sustain: 1 },
        shard: { kit: true, gain: 0.12, from: 0.3 },
        whine: { wave: "sawtooth", gain: 0.03, decay: 0.4, sustain: 1, from: 0.85, vibrato: { rate: 6, depth: 0.02, delay: 0 } },
      },
      patterns: {
        A: {
          glass:
          "G4 - - - Bb4 - - - D5 - - - | Eb5 - - - D5 - - - C#5 - - - | " +
          "C5 - - - Bb4 - - - G4 - - - | A4 - - - - - - - . . . .",
          glass2:
          ". . . . G5 - - - A#5 - - - | D6 - - - D#6 - - - D6 - - - | " +
          "C#6 - - - C6 - - - A#5 - - - | G5 - - - A5 - - - - - - -",
          crack:
          ". . . . . . . . . . A6 . | . . . . . . . . . . . F#6 | " +
          ". . . . . . . . . . . . | . . . . . D7 . . . . . .",
          bass:
          "G2 - - - - - - - - - - - | Eb2 - - - - - - - - - - - | " +
          "C2 - - - - - - - - - - - | D2 - - - - - - - - - - -",
          pad:
          "G3 - - - - - - - - - - - | Eb3 - - - - - - - - - - - | " +
          "C3 - - - - - - - - - - - | D3 - - - - - - - - - - -",
          shard:
          ". . . . . . . . . . h . | . . . . . . . . . . h . | " +
          ". . . . . . . . . . h . | . . . . . . . . . . h .",
          whine:
          ". . . . . . . . . . . . | . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . | . . . . . . . . . . . .",
        },
        B: {
          glass:
          "D5 - - - G5 - - - F5 - - - | Eb5 - - - - - D5 - - Bb4 - - | " +
          "C5 - - - Eb5 - - - D5 - - - | C#5 - - - - - - - A4 - - -",
          glass2:
          ". . . . A#5 - - - F5 - - - | G5 - - - A5 - - - - - A#5 - | " +
          "- D6 - - C6 - - - A5 - - - | A#5 - - - B5 - - - - - - -",
          crack:
          ". . . . . . . C#7 . . . . | . . . . . . . . . . . . | " +
          ". . . . . . A6 . . . . . | . . . . . . . . E7 . . .",
          bass:
          "G2 - - - - - - - - - - - | Eb2 - - - - - - - - - - - | " +
          "C2 - - - - - - - - - - - | D2 - - - - - - - - - - -",
          pad:
          "G3 - - - - - - - - - - - | Eb3 - - - - - - - - - - - | " +
          "C3 - - - - - - - - - - - | D3 - - - - - - - - - - -",
          shard:
          ". . h . . . . . . . . . | . . h . . . . . . . . . | " +
          ". . h . . . . . . . . . | . . h . . . . . . . . .",
          whine:
          ". . . . . . . . . . . . | . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . | A5 - - - - - - - - - - -",
        },
        C: {
          glass:
          "Eb5 - - - D5 - - - C5 - - - | Bb4 - - - D5 - - - G5 - - - | " +
          "Ab5 - - - - - G5 - - Eb5 - - | F#5 - - - C#5 - - - A4 - - -",
          glass2:
          ". . . . D#6 - - - D6 - - - | C6 - - - A#5 - - - D6 - - - | " +
          "G6 - - - G#6 - - - - - G6 - | - D#6 - - F#6 - - - C#6 - - -",
          crack:
          ". . G7 G7 . . . . . . . . | . . . . . . . . . . . . | " +
          ". . . Ab6 . . . . . . . . | . . . . . . . . . . . A6",
          bass:
          "C2 - - - - - - - - - - - | G2 - - - - - - - - - - - | " +
          "Ab2 - - - - - - - - - - - | D2 - - - - - - - - - - -",
          pad:
          "C3 - - - - - - - - - - - | G3 - - - - - - - - - - - | " +
          "Ab3 - - - - - - - - - - - | D3 - - - - - - - - - - -",
          shard:
          ". . . . h . . . . . . . | . . . . h . . . . . . . | " +
          ". . . . h . . . . . . . | . . . . h . . . . . . .",
          whine:
          ". . . . . . . . . . . . | . . . . . . . . . . . . | " +
          "Ab5 - - - - - - - - - - - | . . . . . . . . . . . .",
        },
        D: {
          glass:
          "G5 - - - - - - - - - - - | . . . . . . . . . . . . | " +
          "Eb6 - - - - - - - - - - - | A5 - - - - - - - - - - -",
          glass2:
          ". . . . . . . . . . . . | . . . . . . . . . . . . | " +
          ". . . . . . C#6 - - - - - | . . . . . . . . . . . .",
          crack:
          ". . . . . D7 . . . . . D7 | . . . . . . . Bb6 . . . . | " +
          ". . . . . . . . . F7 F7 . | . . . . . . . . . . A6 .",
          bass:
          "G1 - - - - - - - - - - - | - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - | - - - - - - - - - - - -",
          pad:
          "D3 - - - - - - - - - - - | - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - | - - - - - - - - - - - -",
          shard:
          ". . . . . . . . . . . . | . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . | . . . . . . . . . . . .",
          whine:
          "D5 - - - - - - - - - - - | - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - | - - - - - - - - - - - -",
        },
      },
      order: ["A", "B", "C", "D"],
    },
    // The Funhouse: laughing brass, wall to wall. A slowed march with a laugh
    // in it: the tuba and the chord go oom-pah, and at the end of every bar
    // the laugh (ha ha ha ha) gets passed from one wall to another, low,
    // high, and a guffaw from the other side of the room, each a different
    // brass. A slow bowed saw keeps the figure going under it. In the third
    // section the whole crowd laughs at once. At high dread a cymbal crashes
    // on the downbeat.
    ghoulFunhouse: {
      bpm: 100,
      rush: 10,
      voices: {
        ha1: { wave: "pulse", duty: 0.25, gain: 0.14, decay: 0.05, sustain: 0.4, vibrato: { rate: 9, depth: 0.02, delay: 0 } },
        ha2: { wave: "pulse", duty: 0.125, gain: 0.12, decay: 0.04, sustain: 0.3, vibrato: { rate: 9, depth: 0.02, delay: 0 } },
        ha3: { wave: "sawtooth", gain: 0.07, decay: 0.06, sustain: 0.4 },
        moan: { wave: "sawtooth", gain: 0.045, decay: 0.3, sustain: 1, from: 0.3, vibrato: { rate: 5, depth: 0.015, delay: 0.2 } },
        tuba: { wave: "triangle", gain: 0.4, decay: 0.14, sustain: 0.45 },
        pah: { wave: "pulse", duty: 0.25, gain: 0.06, decay: 0.05, sustain: 0.3 },
        drum: { kit: true, gain: 0.26 },
        crash: { kit: true, gain: 0.2, from: 0.8 },
      },
      patterns: {
        A: {
          ha1:
          "D5 . D5 . Bb4 . Bb4 . . . . . . . . . | Bb4 . Bb4 . G4 . G4 . . . . . . . . . | " +
          "G4 . G4 . Eb4 . Eb4 . . . . . . . . . | A4 . A4 . F#4 . F#4 . . . . . . . . .",
          ha2:
          ". . . . . . . . D6 D6 A#5 A#5 . . . . | . . . . . . . . A#5 A#5 G5 G5 . . . . | " +
          ". . . . . . . . G5 G5 D#5 D#5 . . . . | . . . . . . . . A5 A5 F#5 F#5 . . . .",
          ha3:
          ". . . . . . . . . . . . D4 . A#3 . | . . . . . . . . . . . . A#3 . G3 . | " +
          ". . . . . . . . . . . . G3 . D#3 . | . . . . . . . . . . . . A3 . F#3 .",
          moan:
          "G4 - - - Bb4 - - - D5 - - - . . . . | Eb5 - - - D5 - - - C#5 - - - . . . . | " +
          "C5 - - - Bb4 - - - G4 - - - . . . . | A4 - - - - - - - . . . . . . . .",
          tuba:
          "G2 - - . . . . . D3 - - . . . . . | Eb2 - - . . . . . A#2 - - . . . . . | " +
          "C2 - - . . . . . G2 - - . . . . . | D2 - - . . . . . A2 - - . . . . .",
          pah:
          ". . . . G3^037 - . . . . . . G3^037 - . . | . . . . Eb3^047 - . . . . . . Eb3^047 - . . | " +
          ". . . . C3^037 - . . . . . . C3^037 - . . | . . . . D3^047 - . . . . . . D3^047 - . .",
          drum:
          "k . . . s . . . k . . . s . . . | k . . . s . . . k . . . s . . . | " +
          "k . . . s . . . k . . . s . . . | k . . . s . . . k . . . s . . .",
          crash:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
        },
        B: {
          ha1:
          "G4 . G4 . Eb4 . Eb4 . . . . . . . . . | D5 . D5 . Bb4 . Bb4 . . . . . . . . . | " +
          "Eb5 . Eb5 . C5 . C5 . . . . . . . . . | A4 . A4 . F#4 . F#4 . . . . . . . . .",
          ha2:
          ". . . . . . . . G5 G5 D#5 D#5 . . . . | . . . . . . . . D6 D6 A#5 A#5 . . . . | " +
          ". . . . . . . . D#6 D#6 C6 C6 . . . . | . . . . . . . . A5 A5 F#5 F#5 . . . .",
          ha3:
          ". . . . . . . . . . . . G3 . D#3 . | . . . . . . . . . . . . D4 . A#3 . | " +
          ". . . . . . . . . . . . D#4 . C4 . | . . . . . . . . . . . . A3 . F#3 .",
          moan:
          "Eb5 - - - D5 - - - C5 - - - . . . . | Bb4 - - - D5 - - - G5 - - - . . . . | " +
          "Ab5 - - - - - G5 - - Eb5 - - . . . . | F#5 - - - C#5 - - - A4 - - - . . . .",
          tuba:
          "C2 - - . . . . . G2 - - . . . . . | G2 - - . . . . . D3 - - . . . . . | " +
          "Ab2 - - . . . . . D#3 - - . . . . . | D2 - - . . . . . A2 - - . . . . .",
          pah:
          ". . . . . C3^037 - . . . . . . C3^037 - . | . . . . . G3^037 - . . . . . . G3^037 - . | " +
          ". . . . . Ab3^047 - . . . . . . Ab3^047 - . | . . . . . D3^047 - . . . . . . D3^047 - .",
          drum:
          "k . . . . s . . k . . . . s . . | k . . . . s . . k . . . . s . . | " +
          "k . . . . s . . k . . . . s . . | k . . . . s . . k . . . . s . .",
          crash:
          "o . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
        },
        C: {
          ha1:
          "D5 . D5 . Bb4 . Bb4 . . . . . . . . . | Bb4 . Bb4 . G4 . G4 . . . . . . . . . | " +
          "G4 . G4 . Eb4 . Eb4 . . . . . . . . . | A4 . A4 . F#4 . F#4 . . . . . . . . .",
          ha2:
          ". . . . . . . . D6 D6 A#5 A#5 . D6 A#5 A#5 | . . . . . . . . A#5 A#5 G5 G5 . A#5 G5 G5 | " +
          ". . . . . . . . G5 G5 D#5 D#5 . G5 D#5 D#5 | . . . . . . . . A5 A5 F#5 F#5 . A5 F#5 F#5",
          ha3:
          ". . . . . . . . . . . . D4 . A#3 . | . . . . . . . . . . . . A#3 . G3 . | " +
          ". . . . . . . . . . . . G3 . D#3 . | . . . . . . . . . . . . A3 . F#3 .",
          moan:
          "D5 - - - G5 - - - F5 - - - . . . . | Eb5 - - - - - D5 - - Bb4 - - . . . . | " +
          "C5 - - - Eb5 - - - D5 - - - . . . . | C#5 - - - - - - - A4 - - - . . . .",
          tuba:
          "G2 - - . . . . . D3 - - . . . . . | Eb2 - - . . . . . A#2 - - . . . . . | " +
          "C2 - - . . . . . G2 - - . . . . . | D2 - - . . . . . A2 - - . . . . .",
          pah:
          ". . . . G3^037 - . . . . . . G3^037 - . . | . . . . Eb3^047 - . . . . . . Eb3^047 - . . | " +
          ". . . . C3^037 - . . . . . . C3^037 - . . | . . . . D3^047 - . . . . . . D3^047 - . .",
          drum:
          "k . . . s . . . k . . . s . . . | k . . . s . . . k . . . s . . . | " +
          "k . . . s . . . k . . . s . . . | k . . . s . . . k . . . s . . .",
          crash:
          "o . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
        },
      },
      order: ["A", "B", "A", "C"],
    },
    // The Big Top (the Ringmaster's fight): circus waltz of the damned. The
    // whole calliope at last: the figure on two chip stops an octave apart
    // and a drifting sine twin, a tuba oom and a chord pah, a kick on the one
    // and a snare on the three. The oom-pah goes a hair late in the answer
    // section, the Cm, Gm, Ab, D turn lifts to a fifth, and in the last
    // section the melody is doubled a major third up while the snare runs. At
    // high dread the stomps land on every beat, a steam whistle cries, a
    // scream holds over it and the kick doubles.
    ghoulBigTop: {
      bpm: 120,
      rush: 20,
      voices: {
        call: { wave: "pulse", duty: 0.25, gain: 0.15, decay: 0.1, sustain: 0.75, vibrato: { rate: 5.2, depth: 0.012, delay: 0.12 } },
        call2: { wave: "pulse", duty: 0.125, gain: 0.1, decay: 0.08, sustain: 0.7, from: 0.5, vibrato: { rate: 5.8, depth: 0.012, delay: 0.1 } },
        wob: { wave: "sine", gain: 0.1, decay: 0.2, sustain: 0.8, vibrato: { rate: 0.8, depth: 0.04, delay: 0 } },
        tuba: { wave: "triangle", gain: 0.45, decay: 0.12, sustain: 0.45 },
        pah: { wave: "pulse", duty: 0.125, gain: 0.08, decay: 0.05, sustain: 0.3 },
        drum: { kit: true, gain: 0.3 },
        wheeze: { wave: "sawtooth", gain: 0.04, decay: 0.4, sustain: 1, from: 0.5, vibrato: { rate: 0.45, depth: 0.03, delay: 0 } },
        stomp: { kit: true, gain: 0.3, from: 0.6 },
        whistle: { wave: "sine", gain: 0.09, decay: 0.5, sustain: 0.9, from: 0.8, vibrato: { rate: 6, depth: 0.015, delay: 0.1 } },
        scream: { wave: "sawtooth", gain: 0.04, decay: 0.3, sustain: 1, from: 0.9, vibrato: { rate: 7, depth: 0.03, delay: 0 } },
        dk: { kit: true, gain: 0.22, from: 0.9 },
      },
      patterns: {
        A: {
          call:
          "G4 - - - Bb4 - - - D5 - - - | Eb5 - - - D5 - - - C#5 - - - | " +
          "C5 - - - Bb4 - - - G4 - - - | A4 - - - - - - - . . . .",
          call2:
          "G5 - - - A#5 - - - D6 - - - | D#6 - - - D6 - - - C#6 - - - | " +
          "C6 - - - A#5 - - - G5 - - - | A5 - - - - - - - . . . .",
          wob:
          "G4 - - - A#4 - - - D5 - - - | D#5 - - - D5 - - - C#5 - - - | " +
          "C5 - - - A#4 - - - G4 - - - | A4 - - - - - - - . . . .",
          tuba:
          "G2 - - . . . D3 - - . . . | Eb2 - - . . . A#2 - - . . . | " +
          "C2 - - . . . G2 - - . . . | D2 - - . . . A2 - - . . .",
          pah:
          ". . . . G3^037 - . . G3^037 - . . | . . . . Eb3^047 - . . Eb3^047 - . . | " +
          ". . . . C3^037 - . . C3^037 - . . | . . . . D3^047 - . . D3^047 - . .",
          drum:
          "k . . . h . . . s . . . | k . . . h . . . s . . . | " +
          "k . . . h . . . s . . . | k . . . h . . . s . . .",
          wheeze:
          "G2 - - - - - - - - - - - | Eb2 - - - - - - - - - - - | " +
          "C2 - - - - - - - - - - - | D2 - - - - - - - - - - -",
          stomp:
          "k . . . k . . . k . . . | k . . . k . . . k . . . | " +
          "k . . . k . . . k . . . | k . . . k . . . k . . .",
          whistle:
          ". . . . . . . . . . . . | . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . | D6 - - - - - - - - - - -",
          scream:
          ". . . . . . . . . . . . | . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . | . . . . . . . . . . . .",
          dk:
          "k . k . k . k . k . k . | k . k . k . k . k . k . | " +
          "k . k . k . k . k . k . | k . k . k . k . k . k .",
        },
        B: {
          call:
          "D5 - - - G5 - - - F5 - - - | Eb5 - - - - - D5 - - Bb4 - - | " +
          "C5 - - - Eb5 - - - D5 - - - | C#5 - - - - - - - A4 - - -",
          call2:
          "D6 - - - G6 - - - F6 - - - | D#6 - - - - - D6 - - A#5 - - | " +
          "C6 - - - D#6 - - - D6 - - - | C#6 - - - - - - - A5 - - -",
          wob:
          "D5 - - - G5 - - - F5 - - - | D#5 - - - - - D5 - - A#4 - - | " +
          "C5 - - - D#5 - - - D5 - - - | C#5 - - - - - - - A4 - - -",
          tuba:
          "G2 - - . . . D3 - - . . . | Eb2 - - . . . A#2 - - . . . | " +
          "C2 - - . . . G2 - - . . . | D2 - - . . . A2 - - . . .",
          pah:
          ". . . . G3^037 - . . . G3^037 - . | . . . . Eb3^047 - . . . Eb3^047 - . | " +
          ". . . . C3^037 - . . . C3^037 - . | . . . . D3^047 - . . . D3^047 - .",
          drum:
          "k . . . h . . . s . . . | k . . . h . . . s . . . | " +
          "k . . . h . . . s . . . | k . . . h . . . s . . .",
          wheeze:
          "G2 - - - - - - - - - - - | Eb2 - - - - - - - - - - - | " +
          "C2 - - - - - - - - - - - | D2 - - - - - - - - - - -",
          stomp:
          "k . . . k . . . k . . . | k . . . k . . . k . . . | " +
          "k . . . k . . . k . . . | k . . . k . . . k . . .",
          whistle:
          ". . . . . . . . . . . . | G6 - - - - - - - - - - - | " +
          ". . . . . . . . . . . . | . . . . . . . . . . . .",
          scream:
          ". . . . . . . . . . . . | . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . | . . . . . . . . . . . .",
          dk:
          "k . k . k . k . k . k . | k . k . k . k . k . k . | " +
          "k . k . k . k . k . k . | k . k . k . k . k . k .",
        },
        C: {
          call:
          "Eb5 - - - D5 - - - C5 - - - | Bb4 - - - D5 - - - G5 - - - | " +
          "Ab5 - - - - - G5 - - Eb5 - - | F#5 - - - C#5 - - - A4 - - -",
          call2:
          "A#5 - - - A5 - - - G5 - - - | F5 - - - A5 - - - D6 - - - | " +
          "D#6 - - - - - D6 - - A#5 - - | C#6 - - - G#5 - - - E5 - - -",
          wob:
          "E5 - - - D#5 - - - C#5 - - - | B4 - - - D#5 - - - G#5 - - - | " +
          "A5 - - - - - G#5 - - E5 - - | G5 - - - D5 - - - A#4 - - -",
          tuba:
          "C2 - - . . . G2 - - . . . | G2 - - . . . D3 - - . . . | " +
          "Ab2 - - . . . D#3 - - . . . | D2 - - . . . A2 - - . . .",
          pah:
          ". . . . C3^037 - . . C3^037 - . . | . . . . G3^037 - . . G3^037 - . . | " +
          ". . . . Ab3^047 - . . Ab3^047 - . . | . . . . D3^047 - . . D3^047 - . .",
          drum:
          "k . . . h . . . s . . . | k . . . h . . . s . . . | " +
          "k . . . h . . . s . . . | k . . . h . . . s . . .",
          wheeze:
          "C2 - - - - - - - - - - - | G2 - - - - - - - - - - - | " +
          "Ab2 - - - - - - - - - - - | D2 - - - - - - - - - - -",
          stomp:
          "k . . . k . . . k . . . | k . . . k . . . k . . . | " +
          "k . . . k . . . k . . . | k . . . k . . . k . . .",
          whistle:
          ". . . . . . . . . . . . | . . . . . . . . . . . . | " +
          "Ab6 - - - - - - - - - - - | . . . . . . . . . . . .",
          scream:
          "A5 - - - - - - - - - - - | - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - | - - - - - - - - - - - -",
          dk:
          "k . k . k . k . k . k . | k . k . k . k . k . k . | " +
          "k . k . k . k . k . k . | k . k . k . k . k . k .",
        },
        D: {
          call:
          "G4 - - - Bb4 - - - D5 - - - | Eb5 - - - D5 - - - C#5 - - - | " +
          "C5 - - - Bb4 - - - G4 - - - | A4 - - - - - - - . . . .",
          call2:
          "B4 - - - D5 - - - F#5 - - - | G5 - - - F#5 - - - F5 - - - | " +
          "E5 - - - D5 - - - B4 - - - | C#5 - - - - - - - . . . .",
          wob:
          "G#4 - - - B4 - - - D#5 - - - | E5 - - - D#5 - - - D5 - - - | " +
          "C#5 - - - B4 - - - G#4 - - - | A#4 - - - - - - - . . . .",
          tuba:
          "G2 - - . . . D3 - - . . . | Eb2 - - . . . A#2 - - . . . | " +
          "C2 - - . . . G2 - - . . . | D2 - - . . . A2 - - . . .",
          pah:
          ". . . . G3^037 - . . G3^037 - . . | . . . . Eb3^047 - . . Eb3^047 - . . | " +
          ". . . . C3^037 - . . C3^037 - . . | . . . . D3^047 - . . D3^047 - . .",
          drum:
          "k . . . h . . . s . s . | k . . . h . . . s . s . | " +
          "k . . . h . . . s . s . | k . k . s . s . s s s s",
          wheeze:
          "G2 - - - - - - - - - - - | Eb2 - - - - - - - - - - - | " +
          "C2 - - - - - - - - - - - | D2 - - - - - - - - - - -",
          stomp:
          "k . . . k . . . k . . . | k . . . k . . . k . . . | " +
          "k . . . k . . . k . . . | k . . . k . . . k . . .",
          whistle:
          "G6 - - - - - - - - - - - | . . . . . . . . . . . . | " +
          "Eb7 - - - - - - - - - - - | D7 - - - - - - - - - - -",
          scream:
          "D5 - - - - - - - - - - - | - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - | - - - - - - - - - - - -",
          dk:
          "k . k . k . k . k . k . | k . k . k . k . k . k . | " +
          "k . k . k . k . k . k . | k . k . k . k . k . k .",
        },
      },
      order: ["A", "B", "C", "A", "B", "D"],
    },
  },
};
