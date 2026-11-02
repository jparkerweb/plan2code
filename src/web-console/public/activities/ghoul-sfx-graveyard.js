// Plan2Code Web Console - ghoul: the Graveyard's own sound effects and music tracks, merged into ghoul-sfx.js; defines only.
//
// Each stage keeps its picked sounds in its own ghoul-sfx-<stage>.js: `tones`
// (its monsters' and boss's `ghoul<Kind><Act>` sounds) and `music` (a track
// per room, named in ROOM_MUSIC in ghoul.js). ghoul-sfx.js merges them after
// its own, so they take the same shapes and the same rule: a name may be
// defined only once across tones.js and every game's file. No imports.

export const GRAVEYARD_SFX = {
  tones: {
    // The Graveyard's monsters and Mother Mourning, picked the same way
    // (prototypes/sounds/ghoul-rush/graveyard.html).
    // Grasping Hands: Gray arms that burst up out of the dirt and grab.
    // Stirs under the dirt: Low earth rumble.
    ghoulHandsAppear: {
      layers: [
        { type: "brown", seconds: 0.7, attack: 0.08, gain: 0.7, filter: { type: "lowpass", from: 180, to: 70, q: 1 } },
        { type: "sine", from: 48, to: 30, seconds: 0.7, attack: 0.05, gain: 0.56 },
      ],
    },
    // Bursts up: Earth cracks open.
    ghoulHandsGrab: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 1, filter: { type: "bandpass", from: 900, to: 600, q: 2 } },
        { type: "square", from: 450, to: 150, seconds: 0.05, attack: 0, gain: 0.4 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.7, filter: { type: "bandpass", from: 1300, to: 900, q: 3 } },
        { type: "sine", from: 110, to: 40, seconds: 0.25, attack: 0, gain: 1, delay: 0.05 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.8, filter: { type: "lowpass", from: 320, to: 320, q: 1 }, delay: 0.05 },
        { type: "sawtooth", from: 77, to: 55, seconds: 0.5, attack: 0.12, gain: 0.54, vibrato: { rate: 18, depth: 0.07 }, filter: { type: "lowpass", from: 700, to: 350, q: 5 }, delay: 0.15 },
        { type: "sawtooth", from: 77, to: 54, seconds: 0.5, attack: 0.14, gain: 0.3, filter: { type: "lowpass", from: 560, to: 280, q: 3 }, delay: 0.15 },
        { type: "brown", seconds: 0.5, attack: 0.1, gain: 0.36, filter: { type: "bandpass", from: 280, to: 210, q: 2 }, delay: 0.15 },
      ],
    },
    // Takes a bolt: Gurgle.
    ghoulHandsHurt: {
      layers: [
        { type: "sine", from: 140, to: 105, seconds: 0.3, attack: 0.05, gain: 0.9, vibrato: { rate: 15, depth: 0.4 } },
        { type: "brown", seconds: 0.3, attack: 0.05, gain: 0.7, filter: { type: "lowpass", from: 700, to: 300, q: 1 } },
        { type: "sine", from: 210, to: 168, seconds: 0.21, delay: 0.05, attack: 0.03, gain: 0.4, vibrato: { rate: 9, depth: 0.5 } },
      ],
    },
    // Dies: Fading gasp.
    ghoulHandsDie: {
      layers: [
        { type: "noise", seconds: 0.22, attack: 0.15, gain: 0.7, filter: { type: "bandpass", from: 770, to: 1680, q: 4 } },
        { type: "sawtooth", from: 98, to: 127, seconds: 0.2, attack: 0.14, gain: 0.25, filter: { type: "lowpass", from: 980, to: 980, q: 1 } },
        { type: "sine", notes: [880, 739, 590, 440], seconds: 0.7, attack: 0.02, gain: 0.6, vibrato: { rate: 7, depth: 0.02 }, delay: 0.2 },
        { type: "triangle", notes: [1320, 1109, 880, 660], seconds: 0.7, attack: 0.02, gain: 0.25, delay: 0.2 },
      ],
    },
    // Mourner: A veiled figure in black lace whose wail slows you.
    // Lifts her veil: Soft sob.
    ghoulMournerAppear: {
      layers: [
        { type: "triangle", from: 363, to: 272, seconds: 0.5, attack: 0.25, gain: 0.54, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 1540, to: 990, q: 1 } },
        { type: "sine", from: 726, to: 545, seconds: 0.5, attack: 0.3, gain: 0.18 },
        { type: "pink", seconds: 0.5, attack: 0.3, gain: 0.15, filter: { type: "bandpass", from: 1452, to: 1089, q: 6 } },
      ],
    },
    // Wails: Falling lament.
    ghoulMournerWail: {
      layers: [
        { type: "triangle", from: 462, to: 346, seconds: 1.1, attack: 0.25, gain: 0.9, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 1960, to: 1260, q: 1 } },
        { type: "sine", from: 924, to: 693, seconds: 1.1, attack: 0.3, gain: 0.3 },
        { type: "pink", seconds: 1.1, attack: 0.3, gain: 0.25, filter: { type: "bandpass", from: 1848, to: 1386, q: 6 } },
      ],
    },
    // Takes a bolt: Short cry.
    ghoulMournerHurt: {
      layers: [
        { type: "sawtooth", from: 620, to: 372, seconds: 0.2, attack: 0.01, gain: 0.8, vibrato: { rate: 10, depth: 0.03 }, filter: { type: "bandpass", from: 1240, to: 992, q: 2 } },
        { type: "sawtooth", from: 558, to: 310, seconds: 0.26, delay: 0.17, attack: 0.01, gain: 0.55, filter: { type: "bandpass", from: 1116, to: 744, q: 2 } },
      ],
    },
    // Dies: Long sigh to nothing.
    ghoulMournerDie: {
      layers: [
        { type: "triangle", from: 363, to: 272, seconds: 1.1, attack: 0.25, gain: 0.9, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 1540, to: 990, q: 1 } },
        { type: "sine", from: 726, to: 545, seconds: 1.1, attack: 0.3, gain: 0.3 },
        { type: "pink", seconds: 1.1, attack: 0.3, gain: 0.25, filter: { type: "bandpass", from: 1452, to: 1089, q: 6 } },
        { type: "sine", notes: [880, 739, 590, 440], seconds: 0.7, attack: 0.02, gain: 0.6, vibrato: { rate: 7, depth: 0.02 }, delay: 0.4 },
        { type: "triangle", notes: [1320, 1109, 880, 660], seconds: 0.7, attack: 0.02, gain: 0.25, delay: 0.4 },
      ],
    },
    // Grave Robber: A ghoul with a shovel who digs in and comes up behind you.
    // Comes in: Low chuckle.
    ghoulRobberAppear: {
      layers: [
        { type: "sawtooth", from: 160, to: 128, seconds: 0.09, attack: 0.01, gain: 0.7, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 400, to: 320, q: 3 } },
        { type: "sawtooth", from: 152, to: 122, seconds: 0.09, delay: 0.12, attack: 0.01, gain: 0.7, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 380, to: 304, q: 3 } },
        { type: "sawtooth", from: 144, to: 115, seconds: 0.09, delay: 0.24, attack: 0.01, gain: 0.7, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 360, to: 288, q: 3 } },
      ],
    },
    // Digs in: Frantic digging.
    ghoulRobberDig: {
      layers: [
        { type: "noise", seconds: 0.15, attack: 0.06, gain: 0.8, filter: { type: "highpass", from: 1440, to: 3000, q: 1 } },
        { type: "pink", seconds: 0.15, attack: 0.05, gain: 0.5, filter: { type: "bandpass", from: 1920, to: 1320, q: 2 } },
        { type: "noise", seconds: 0.15, attack: 0.06, gain: 0.8, filter: { type: "highpass", from: 1440, to: 3000, q: 1 }, delay: 0.2 },
        { type: "pink", seconds: 0.15, attack: 0.05, gain: 0.5, filter: { type: "bandpass", from: 1920, to: 1320, q: 2 }, delay: 0.2 },
        { type: "noise", seconds: 0.15, attack: 0.06, gain: 0.8, filter: { type: "highpass", from: 1440, to: 3000, q: 1 }, delay: 0.4 },
        { type: "pink", seconds: 0.15, attack: 0.05, gain: 0.5, filter: { type: "bandpass", from: 1920, to: 1320, q: 2 }, delay: 0.4 },
      ],
    },
    // Comes up behind you: Boo! cackle.
    ghoulRobberUnearth: {
      layers: [
        { type: "noise", seconds: 0.5, attack: 0, gain: 0.7, filter: { type: "lowpass", from: 2520, to: 90, q: 1 } },
        { type: "sine", from: 96, to: 21, seconds: 0.4, attack: 0, gain: 0.63 },
        { type: "brown", seconds: 0.6, attack: 0.01, gain: 0.49, filter: { type: "lowpass", from: 240, to: 240, q: 1 } },
        { type: "sawtooth", from: 220, to: 176, seconds: 0.09, delay: 0.1, attack: 0.01, gain: 0.7, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 550, to: 440, q: 3 } },
        { type: "sawtooth", from: 209, to: 167, seconds: 0.09, delay: 0.18, attack: 0.01, gain: 0.7, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 523, to: 418, q: 3 } },
        { type: "sawtooth", from: 198, to: 158, seconds: 0.09, delay: 0.26, attack: 0.01, gain: 0.7, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 495, to: 396, q: 3 } },
        { type: "sawtooth", from: 187, to: 150, seconds: 0.09, delay: 0.34, attack: 0.01, gain: 0.7, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 468, to: 374, q: 3 } },
      ],
    },
    // Takes a bolt: Wheeze.
    ghoulRobberHurt: {
      layers: [
        { type: "noise", seconds: 0.22, attack: 0.15, gain: 0.7, filter: { type: "bandpass", from: 990, to: 2160, q: 4 } },
        { type: "sawtooth", from: 198, to: 257, seconds: 0.2, attack: 0.14, gain: 0.25, filter: { type: "lowpass", from: 1260, to: 1260, q: 1 } },
      ],
    },
    // Dies: Last cackle.
    ghoulRobberDie: {
      layers: [
        { type: "sawtooth", from: 180, to: 144, seconds: 0.09, attack: 0.01, gain: 0.7, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 450, to: 360, q: 3 } },
        { type: "sawtooth", from: 171, to: 137, seconds: 0.09, delay: 0.12, attack: 0.01, gain: 0.7, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 428, to: 342, q: 3 } },
        { type: "sawtooth", from: 162, to: 130, seconds: 0.09, delay: 0.24, attack: 0.01, gain: 0.7, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 405, to: 324, q: 3 } },
        { type: "sawtooth", from: 153, to: 122, seconds: 0.09, delay: 0.36, attack: 0.01, gain: 0.7, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 383, to: 306, q: 3 } },
        { type: "sine", notes: [880, 739, 590, 440], seconds: 0.7, attack: 0.02, gain: 0.6, vibrato: { rate: 7, depth: 0.02 }, delay: 0.5 },
        { type: "triangle", notes: [1320, 1109, 880, 660], seconds: 0.7, attack: 0.02, gain: 0.25, delay: 0.5 },
      ],
    },
    // Rotter: A green, thin zombie; shot at the body, its legs walk on.
    // Comes in: Low dirge moan.
    ghoulRotterAppear: {
      layers: [
        { type: "triangle", from: 53, to: 39, seconds: 1, attack: 0.25, gain: 0.9, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 980, to: 630, q: 1 } },
        { type: "sine", from: 105, to: 79, seconds: 1, attack: 0.3, gain: 0.3 },
        { type: "pink", seconds: 1, attack: 0.3, gain: 0.25, filter: { type: "bandpass", from: 210, to: 158, q: 6 } },
      ],
    },
    // Climbs or leaps: Straining.
    ghoulRotterClimb: {
      layers: [
        { type: "sawtooth", from: 60, to: 94, seconds: 0.45, attack: 0.12, gain: 0.9, vibrato: { rate: 24, depth: 0.07 }, filter: { type: "lowpass", from: 800, to: 400, q: 5 } },
        { type: "sawtooth", from: 60, to: 93, seconds: 0.45, attack: 0.14, gain: 0.5, filter: { type: "lowpass", from: 640, to: 320, q: 3 } },
        { type: "brown", seconds: 0.45, attack: 0.1, gain: 0.6, filter: { type: "bandpass", from: 300, to: 225, q: 2 } },
      ],
    },
    // Takes a bolt: Bone crack.
    ghoulRotterHurt: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.7, filter: { type: "bandpass", from: 1440, to: 960, q: 2 } },
        { type: "square", from: 720, to: 240, seconds: 0.05, attack: 0, gain: 0.28 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.49, filter: { type: "bandpass", from: 2080, to: 1440, q: 3 } },
      ],
    },
    // Dies (its legs may walk on): Rattle of bones.
    ghoulRotterDie: {
      layers: [
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2162, to: 1730, q: 6 } },
        { type: "square", from: 729, to: 459, seconds: 0.02, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2891, to: 2313, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.1, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2497, to: 1998, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.15, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2058, to: 1647, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.19, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2133, to: 1707, q: 6 } },
        { type: "square", from: 674, to: 428, seconds: 0.02, delay: 0.19, gain: 0.3 },
        { type: "sine", from: 150, to: 113, seconds: 0.4, attack: 0.05, gain: 0.54, vibrato: { rate: 15, depth: 0.4 }, delay: 0.2 },
        { type: "brown", seconds: 0.4, attack: 0.05, gain: 0.42, filter: { type: "lowpass", from: 700, to: 300, q: 1 }, delay: 0.2 },
        { type: "sine", from: 225, to: 180, seconds: 0.28, delay: 0.26, attack: 0.03, gain: 0.24, vibrato: { rate: 9, depth: 0.5 } },
      ],
    },
    // Rotter's Legs: What is left of a rotter, still walking after you.
    // Keeps walking: Quick footsteps.
    ghoulLegsAppear: {
      layers: [
        { type: "triangle", from: 200, to: 170, seconds: 0.22, attack: 0, gain: 0.54 },
        { type: "sine", from: 540, to: 500, seconds: 0.12, attack: 0, gain: 0.21 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.3, filter: { type: "bandpass", from: 800, to: 800, q: 2 } },
        { type: "triangle", from: 190, to: 162, seconds: 0.22, attack: 0, gain: 0.54, delay: 0.12 },
        { type: "sine", from: 513, to: 475, seconds: 0.12, attack: 0, gain: 0.21, delay: 0.12 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.3, filter: { type: "bandpass", from: 760, to: 760, q: 2 }, delay: 0.12 },
        { type: "triangle", from: 210, to: 179, seconds: 0.22, attack: 0, gain: 0.54, delay: 0.24 },
        { type: "sine", from: 567, to: 525, seconds: 0.12, attack: 0, gain: 0.21, delay: 0.24 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.3, filter: { type: "bandpass", from: 840, to: 840, q: 2 }, delay: 0.24 },
      ],
    },
    // Fall over: Splat.
    ghoulLegsDie: {
      layers: [
        { type: "noise", seconds: 0.28, attack: 0, gain: 0.9, filter: { type: "lowpass", from: 3120, to: 240, q: 1 } },
        { type: "square", from: 168, to: 48, seconds: 0.16, attack: 0, gain: 0.5, filter: { type: "lowpass", from: 720, to: 720, q: 1 } },
        { type: "sine", from: 1080, to: 1560, seconds: 0.05, delay: 0.2, gain: 0.25 },
        { type: "sine", from: 912, to: 1320, seconds: 0.05, delay: 0.34, gain: 0.18 },
      ],
    },
    // Carrion Crow: Waits on a headstone, then dives at you.
    // Caws and takes off: Caw-caw.
    ghoulCrowWake: {
      layers: [
        { type: "sawtooth", from: 680, to: 408, seconds: 0.2, attack: 0.01, gain: 0.8, vibrato: { rate: 10, depth: 0.03 }, filter: { type: "bandpass", from: 1360, to: 1088, q: 2 } },
        { type: "sawtooth", from: 612, to: 340, seconds: 0.26, delay: 0.17, attack: 0.01, gain: 0.55, filter: { type: "bandpass", from: 1224, to: 816, q: 2 } },
        { type: "sawtooth", from: 650, to: 390, seconds: 0.2, attack: 0.01, gain: 0.8, vibrato: { rate: 10, depth: 0.03 }, filter: { type: "bandpass", from: 1300, to: 1040, q: 2 }, delay: 0.24 },
        { type: "sawtooth", from: 585, to: 325, seconds: 0.26, delay: 0.41, attack: 0.01, gain: 0.55, filter: { type: "bandpass", from: 1170, to: 780, q: 2 } },
      ],
    },
    // Dives: Wing rush.
    ghoulCrowDive: {
      layers: [
        { type: "pink", seconds: 0.07, attack: 0.01, gain: 0.9, filter: { type: "bandpass", from: 600, to: 260, q: 1 } },
        { type: "pink", seconds: 0.07, delay: 0.09, attack: 0.01, gain: 0.6, filter: { type: "bandpass", from: 600, to: 260, q: 1 } },
        { type: "pink", seconds: 0.07, delay: 0.18, attack: 0.01, gain: 0.9, filter: { type: "bandpass", from: 600, to: 260, q: 1 } },
        { type: "noise", seconds: 0.35, attack: 0.12, gain: 0.48, filter: { type: "bandpass", from: 390, to: 2340, q: 1.5 }, delay: 0.05 },
      ],
    },
    // Takes a bolt: Screech.
    ghoulCrowHurt: {
      layers: [
        { type: "sawtooth", from: 1300, to: 1820, seconds: 0.15, attack: 0.03, gain: 0.8, vibrato: { rate: 12, depth: 0.04 }, filter: { type: "bandpass", from: 2600, to: 3120, q: 4 } },
        { type: "sawtooth", from: 1950, to: 2730, seconds: 0.14, attack: 0.04, gain: 0.35, filter: { type: "bandpass", from: 3900, to: 3900, q: 5 } },
        { type: "noise", seconds: 0.12, attack: 0.03, gain: 0.3, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
      ],
    },
    // Dies: Croak.
    ghoulCrowDie: {
      layers: [
        { type: "sawtooth", from: 879, to: 608, seconds: 0.3, attack: 0.01, gain: 0.9, vibrato: { rate: 40, depth: 0.1 }, filter: { type: "lowpass", from: 4576, to: 4576, q: 1 } },
        { type: "brown", seconds: 0.24, attack: 0.01, gain: 0.6, filter: { type: "lowpass", from: 650, to: 650, q: 1 } },
      ],
    },
    // Mother Mourning: The boss: a giant weeping angel; move while she weeps, freeze when she looks.
    // Wakes: Rising lament.
    ghoulAngelWake: {
      layers: [
        { type: "sine", from: 300, to: 450, seconds: 0.46, attack: 0.15, gain: 0.8, vibrato: { rate: 6, depth: 0.04 } },
        { type: "sine", from: 450, to: 210, seconds: 0.68, delay: 0.42, attack: 0.04, gain: 0.8, vibrato: { rate: 6, depth: 0.05 } },
        { type: "triangle", from: 603, to: 420, seconds: 1.1, attack: 0.3, gain: 0.2 },
        { type: "pink", seconds: 1.1, attack: 0.3, gain: 0.2, filter: { type: "bandpass", from: 600, to: 600, q: 8 } },
      ],
    },
    // Weeps: Soft weeping.
    ghoulAngelWeep: {
      layers: [
        { type: "triangle", from: 240, to: 180, seconds: 0.8, attack: 0.25, gain: 0.54, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 5600, to: 3600, q: 1 } },
        { type: "sine", from: 480, to: 360, seconds: 0.8, attack: 0.3, gain: 0.18 },
        { type: "pink", seconds: 0.8, attack: 0.3, gain: 0.15, filter: { type: "bandpass", from: 960, to: 720, q: 6 } },
      ],
    },
    // Turns to look: Whispered 'I see you'.
    ghoulAngelWatch: {
      layers: [
        { type: "pink", seconds: 0.7, attack: 0.25, gain: 0.8, filter: { type: "bandpass", from: 840, to: 3120, q: 5 } },
        { type: "noise", seconds: 0.49, delay: 0.28, attack: 0.1, gain: 0.5, filter: { type: "bandpass", from: 3120, to: 1080, q: 8 } },
      ],
    },
    // Sees you move: Wail.
    ghoulAngelSee: {
      layers: [
        { type: "sine", from: 480, to: 720, seconds: 0.25, attack: 0.15, gain: 0.8, vibrato: { rate: 6, depth: 0.04 } },
        { type: "sine", from: 720, to: 336, seconds: 0.37, delay: 0.23, attack: 0.04, gain: 0.8, vibrato: { rate: 6, depth: 0.05 } },
        { type: "triangle", from: 965, to: 672, seconds: 0.6, attack: 0.3, gain: 0.2 },
        { type: "pink", seconds: 0.6, attack: 0.3, gain: 0.2, filter: { type: "bandpass", from: 960, to: 960, q: 8 } },
      ],
    },
    // Stone fist lands: Deep boom.
    ghoulAngelSlam: {
      layers: [
        { type: "sine", from: 44, to: 20, seconds: 0.25, attack: 0, gain: 1 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.8, filter: { type: "lowpass", from: 128, to: 128, q: 1 } },
        { type: "brown", seconds: 1, attack: 0.08, gain: 1, filter: { type: "lowpass", from: 144, to: 56, q: 1 } },
        { type: "sine", from: 38, to: 24, seconds: 1, attack: 0.05, gain: 0.8 },
      ],
    },
    // Spreads her wings: Scream of grief.
    ghoulAngelWings: {
      layers: [
        { type: "sawtooth", from: 450, to: 630, seconds: 1, attack: 0.03, gain: 0.8, vibrato: { rate: 12, depth: 0.04 }, filter: { type: "bandpass", from: 900, to: 1080, q: 4 } },
        { type: "sawtooth", from: 675, to: 945, seconds: 0.9, attack: 0.04, gain: 0.35, filter: { type: "bandpass", from: 1350, to: 1350, q: 5 } },
        { type: "noise", seconds: 0.8, attack: 0.03, gain: 0.3, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
      ],
    },
    // Takes a hit: Crack and hiss.
    ghoulAngelHurt: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 1, filter: { type: "bandpass", from: 1620, to: 1080, q: 2 } },
        { type: "square", from: 810, to: 270, seconds: 0.05, attack: 0, gain: 0.4 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.7, filter: { type: "bandpass", from: 2340, to: 1620, q: 3 } },
        { type: "noise", seconds: 0.2, attack: 0.06, gain: 0.8, filter: { type: "highpass", from: 1920, to: 4000, q: 1 }, delay: 0.05 },
        { type: "pink", seconds: 0.2, attack: 0.05, gain: 0.5, filter: { type: "bandpass", from: 2560, to: 1760, q: 2 }, delay: 0.05 },
      ],
    },
    // Dies: Crumbles to rubble.
    ghoulAngelDie: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 1, filter: { type: "bandpass", from: 900, to: 600, q: 2 } },
        { type: "square", from: 450, to: 150, seconds: 0.05, attack: 0, gain: 0.4 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.7, filter: { type: "bandpass", from: 1300, to: 900, q: 3 } },
        { type: "noise", seconds: 0.04, delay: 0.15, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1690, to: 1352, q: 6 } },
        { type: "square", from: 382, to: 395, seconds: 0.02, delay: 0.15, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.21, attack: 0, gain: 0.82, filter: { type: "bandpass", from: 1351, to: 1081, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.26, attack: 0, gain: 0.75, filter: { type: "bandpass", from: 1782, to: 1426, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.31, attack: 0, gain: 0.67, filter: { type: "bandpass", from: 1749, to: 1399, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.38, attack: 0, gain: 0.59, filter: { type: "bandpass", from: 1999, to: 1599, q: 6 } },
        { type: "square", from: 436, to: 318, seconds: 0.02, delay: 0.38, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.45, attack: 0, gain: 0.51, filter: { type: "bandpass", from: 1703, to: 1363, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.55, attack: 0, gain: 0.44, filter: { type: "bandpass", from: 1343, to: 1075, q: 6 } },
      ],
    },
  },
  // The Graveyard's rooms: the Lychgate, the Open Graves, Mausoleum Row and
  // Angel's Rest (Mother Mourning's), picked in prototypes/music/ghoul-rush.
  music: {
    // The Lychgate: 5/4 funeral limp. A funeral procession in 5/4 that limps:
    // every bar is a long dragging step and a short stumbling one, a
    // pulse-wave figure over a plucked triangle bass. Listen for the hitch on
    // the fourth beat, the slide up to the Neapolitan Gb, and the
    // pallbearers' drums and shrieking arps piling on at full dread.
    ghoulLychgate: {
      bpm: 100,
      rush: 6,
      voices: {
        drone: { wave: "sine", gain: 0.6, decay: 0.3, sustain: 0.95 },
        bass: { wave: "triangle", gain: 0.7, decay: 0.06, sustain: 0.45 },
        ost: { wave: "pulse", duty: 0.25, gain: 0.15, from: 0.2, decay: 0.05, sustain: 0.3 },
        drums: { kit: true, gain: 0.42, from: 0.4 },
        hats: { kit: true, gain: 0.24, from: 0.55 },
        lead: { wave: "triangle", gain: 0.2, from: 0.6, decay: 0.2, sustain: 0.8, vibrato: { rate: 4, depth: 0.008, delay: 0.3 } },
        high: { wave: "pulse", duty: 0.125, gain: 0.07, from: 0.85, decay: 0.1, sustain: 0.6 },
        pound: { kit: true, gain: 0.32, from: 0.85 },
      },
      patterns: {
        A: {
          drone:
          "F1 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - -",
          bass:
          "F2 - . . . . . . C2 . . . Db2 - - . | E2 - - . F2 - . . . . . . C2 . . . | " +
          "Db2 - - . E2 - - . Db2 - . . . . . . | Ab1 . . . Bb1 - - . C2 - - . C2 - . . | " +
          ". . . . G1 . . . Ab1 - - . B1 - - .",
          ost:
          "C4 . Ab3 . F3 . . . G3 . Ab3 . Bb3 . . . | G3 . . . C4 . Ab3 . F3 . . . G3 . Ab3 . | " +
          "Bb3 . . . G3 . . . Ab3 . F3 . Db3 . . . | Eb3 . F3 . Ab3 . . . F3 . . . G3 . E3 . | " +
          "C3 . . . Db3 . E3 . G3 . . . Bb3 . . .",
          drums:
          "k . . . . . . . s . . . k . . . | s . . . k . . . . . . . s . . . | " +
          "k . . . s . . . k . . . . . . . | s . . . k . . . s . . . k . . . | " +
          ". . . . s . . . k . . . s . . .",
          hats:
          "o . h . h . h . h . h . o . h . | h . h . o . h . h . h . h . h . | " +
          "o . h . h . h . o . h . h . h . | h . h . o . h . h . h . o . h . | " +
          "h . h . h . h . o . h . h . h .",
          lead:
          "F4 - - - - - - - - - - - Ab4 - - - | - - - - G4 - - - - - - - - - - - | " +
          "E4 - - - - - - - F4 - - - - - - - | Ab4 - - - Db5 - - - - - - - C5 - - - | " +
          "- - - - - - - - - - - - - - - -",
          high:
          "F5^037 - - - - - - - - - - - - - - - | - - - - F5^037 - - - - - - - - - - - | " +
          "- - - - - - - - Db5^047 - - - - - - - | - - - - - - - - - - - - C5^047 - - - | " +
          "- - - - - - - - - - - - - - - -",
          pound:
          "k . k . k . . . k . s . k . k . | s . s s k . k . k . . . k . s . | " +
          "k . k . s . s s k . k . k . . . | k . s . k . k . s . s s k . k . | " +
          "k . . . k . s . k . k . s . s s",
        },
        B: {
          drone:
          "Gb1 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - Bb1 - - - - - - - | - - - - - - - - - - - - C2 - - - | " +
          "- - - - - - - - - - - - - - - -",
          bass:
          "Gb2 - . . . . . . Db2 . . . Eb2 - - . | F2 - - . Gb2 - . . . . . . Db2 . . . | " +
          "Eb2 - - . F2 - - . Bb1 - . . . . . . | F1 . . . Gb1 - - . A1 - - . C2 - . . | " +
          ". . . . G1 . . . Ab1 - - . B1 - - .",
          ost:
          "Bb3 . Gb3 . Db3 . . . Eb3 . F3 . Gb3 . . . | Db3 . . . Bb3 . Gb3 . Db3 . . . Eb3 . F3 . | " +
          "Gb3 . . . Db3 . . . F3 . Db3 . Bb2 . . . | C3 . Db3 . F3 . . . E3 . . . G3 . E3 . | " +
          "C3 . . . Db3 . E3 . G3 . . . Bb3 . . .",
          drums:
          "k . . . . . . . s . . . k . . . | s . . . k . . . . . . . s . . . | " +
          "k . . . s . . . k . . . . . . . | s . . . k . . . s . . . k . . . | " +
          ". . . . s . . . k . . . s . . .",
          hats:
          "o . h . h . h . h . h . o . h . | h . h . o . h . h . h . h . h . | " +
          "o . h . h . h . o . h . h . h . | h . h . o . h . h . h . o . h . | " +
          "h . h . h . h . o . h . h . h .",
          lead:
          "Bb4 - - - - - - - - - - - Db5 - - - | - - - - Gb5 - - - - - - - - - - - | " +
          "F5 - - - - - - - Db5 - - - - - - - | F5 - - - E5 - - - - - - - E5 - - - | " +
          "- - - - - - - - G4 - - - - - - -",
          high:
          "Gb5^047 - - - - - - - - - - - - - - - | - - - - Gb5^047 - - - - - - - - - - - | " +
          "- - - - - - - - Bb4^037 - - - - - - - | - - - - - - - - - - - - C5^047 - - - | " +
          "- - - - - - - - - - - - - - - -",
          pound:
          "k . k . k . . . k . s . k . k . | s . s s k . k . k . . . k . s . | " +
          "k . k . s . s s k . k . k . . . | k . s . k . k . s . s s k . k . | " +
          "k . . . k . s . k . k . s . s s",
        },
        C: {
          drone:
          "F1 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - -",
          bass:
          "F2 - . . . . . . C2 . . . Db2 - - . | E2 - - . F2 - . . . . . . C2 . . . | " +
          "Db2 - - . E2 - - . Db2 - . . . . . . | Ab1 . . . Bb1 - - . C2 - - . C2 - . . | " +
          ". . . . G1 . . . Ab1 - - . B1 - - .",
          ost:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . .",
          drums:
          "k . . . . . . . . . . . . . . . | . . . . k . . . . . . . . . . . | " +
          ". . . . . . . . k . . . . . . . | . . . . . . . . . . . . k . . . | " +
          ". . . . . . . . . . . . . . . .",
          hats:
          "o . h . h . h . h . h . o . h . | h . h . o . h . h . h . h . h . | " +
          "o . h . h . h . o . h . h . h . | h . h . o . h . h . h . o . h . | " +
          "h . h . h . h . o . h . h . h .",
          lead:
          "C5 - - - - - - - - - - - Db5 - - - | - - - - C5 - - - - - - - - - - - | " +
          "Ab4 - - - - - - - Ab4 - - - - - - - | G4 - - - F4 - - - - - - - E4 - - - | " +
          "- - - - - - - - - - - - - - - -",
          high:
          "F5^037 - - - - - - - - - - - - - - - | - - - - F5^037 - - - - - - - - - - - | " +
          "- - - - - - - - Db5^047 - - - - - - - | - - - - - - - - - - - - C5^047 - - - | " +
          "- - - - - - - - - - - - - - - -",
          pound:
          "k . k . k . . . k . s . k . k . | s . s s k . k . k . . . k . s . | " +
          "k . k . s . s s k . k . k . . . | k . s . k . k . s . s s k . k . | " +
          "k . . . k . s . k . k . s . s s",
        },
      },
      order: ["A", "B", "A", "C"],
    },
    // Open Graves: gravedigger's work song. A night-shift work song: a
    // pulse-wave caller and a low triangle crew trade lines in F minor blues
    // while shovel strikes and scraping dirt keep the backbeat. Listen for
    // the bass walking up chromatically into each bar, the move to Bb minor,
    // and a nervous half-step trill over pounding kicks at full dread.
    ghoulGraves: {
      bpm: 92,
      rush: 6,
      voices: {
        drone: { wave: "sine", gain: 0.55, decay: 0.3, sustain: 0.95 },
        bass: { wave: "triangle", gain: 0.72, decay: 0.08, sustain: 0.5 },
        dig: { kit: true, gain: 0.34, from: 0.2 },
        kick: { kit: true, gain: 0.44, from: 0.4 },
        call: { wave: "pulse", duty: 0.25, gain: 0.17, from: 0.6, decay: 0.08, sustain: 0.6, vibrato: { rate: 5, depth: 0.01, delay: 0.2 } },
        answer: { wave: "triangle", gain: 0.22, from: 0.3, decay: 0.1, sustain: 0.7 },
        hats: { kit: true, gain: 0.22, from: 0.55 },
        trill: { wave: "square", gain: 0.06, from: 0.85, decay: 0.03, sustain: 0.4 },
        pound: { kit: true, gain: 0.3, from: 0.85 },
      },
      patterns: {
        A: {
          drone:
          "F1 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -",
          bass:
          "F2 - - . . . . . F2 . Ab2 . Bb2 . B2 . | C3 - - . . . . . Eb2 . C2 . Eb2 . E2 . | " +
          "F2 - - . . . . . F2 . Ab2 . Bb2 . B2 . | C3 - - . . . . . Eb2 . C2 . Eb2 . E2 .",
          dig:
          ". . . . s . . . . . . . s . o . | . . . . s . . . . . . . s . o . | " +
          ". . . . s . . . . . . . s . o . | . . . . s . . . . . . . s . o .",
          kick:
          "k . . . . . k . . . k . . . . . | k . . . . . k . . . k . . . . . | " +
          "k . . . . . k . . . k . . . . . | k . . . . . k . . . k . . . . .",
          call:
          "C5 - C5 - Eb5 - - - C5 - Bb4 - Ab4 - - - | F4 - - - Ab4 - F4 - . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          answer:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          "Ab3 - Bb3 - C4 - - - Bb3 - Ab3 - F3 - - - | Eb3 - E3 - F3 - - - - - - - . . . .",
          hats:
          "h . . h h . . h h . . h h . h h | h . . h h . . h h . . h h . h h | " +
          "h . . h h . . h h . . h h . h h | h . . h h . . h h . . h h . h h",
          trill:
          "C5 Db5 C5 Db5 C5 Db5 C5 Db5 C5 Db5 C5 Db5 C5 Db5 C5 Db5 | C5 B4 C5 B4 C5 B4 C5 B4 C5 B4 C5 B4 C5 B4 C5 B4 | " +
          "C5 Db5 C5 Db5 C5 Db5 C5 Db5 C5 Db5 C5 Db5 C5 Db5 C5 Db5 | C5 B4 C5 B4 C5 B4 C5 B4 C5 B4 C5 B4 C5 B4 C5 B4",
          pound:
          "k . k . k . k . k . k . k . k k | k . k . k . k . k . k . k . k k | " +
          "k . k . k . k . k . k . k . k k | k . k . k . k . k . k . k . k k",
        },
        B: {
          drone:
          "F1 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -",
          bass:
          "Bb2 - - . . . . . Bb2 . Db3 . Eb3 . E3 . | F3 - - . . . . . Ab2 . F2 . Ab2 . A2 . | " +
          "Bb2 - - . . . . . Bb2 . Db3 . Eb3 . E3 . | F3 - - . . . . . Ab2 . F2 . Ab2 . A2 .",
          dig:
          ". . . . s . . . . . . . s . o . | . . . . s . . . . . . . s . o . | " +
          ". . . . s . . . . . . . s . o . | . . . . s . . . . . . . s . o .",
          kick:
          "k . . . . . k . . . k . . . . . | k . . . . . k . . . k . . . . . | " +
          "k . . . . . k . . . k . . . . . | k . . . . . k . . . k . . . . .",
          call:
          "F5 - F5 - Ab5 - - - F5 - Eb5 - Db5 - - - | Bb4 - - - Db5 - Bb4 - . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          answer:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          "Db4 - Eb4 - F4 - - - Eb4 - Db4 - Bb3 - - - | Ab3 - A3 - Bb3 - - - - - - - . . . .",
          hats:
          "h . . h h . . h h . . h h . h h | h . . h h . . h h . . h h . h h | " +
          "h . . h h . . h h . . h h . h h | h . . h h . . h h . . h h . h h",
          trill:
          "F5 Gb5 F5 Gb5 F5 Gb5 F5 Gb5 F5 Gb5 F5 Gb5 F5 Gb5 F5 Gb5 | F5 E5 F5 E5 F5 E5 F5 E5 F5 E5 F5 E5 F5 E5 F5 E5 | " +
          "F5 Gb5 F5 Gb5 F5 Gb5 F5 Gb5 F5 Gb5 F5 Gb5 F5 Gb5 F5 Gb5 | F5 E5 F5 E5 F5 E5 F5 E5 F5 E5 F5 E5 F5 E5 F5 E5",
          pound:
          "k . k . k . k . k . k . k . k k | k . k . k . k . k . k . k . k k | " +
          "k . k . k . k . k . k . k . k k | k . k . k . k . k . k . k . k k",
        },
        C: {
          drone:
          "F1 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -",
          bass:
          "Db2 - - . . . . . Db2 . Eb2 . E2 . E2 . | C2 - - . . . . . C2 . Bb1 . G1 . E1 . | " +
          "Db2 - - . . . . . Db2 . Eb2 . E2 . E2 . | C2 - - . . . . . C2 . E2 . G2 . B2 .",
          dig:
          ". . . . s . . . . . . . s . o . | . . . . s . . . . . . . s . o . | " +
          ". . . . s . . . . . . . s . o . | . . . . s . . . . . . . s . o .",
          kick:
          "k . . . . . k . . . k . . . . . | k . . . . . k . . . k . . . . . | " +
          "k . . . . . k . . . k . . . . . | k . . . . . k . . . k . . . . .",
          call:
          "Db5 - - - C5 - - - Bb4 - - - Ab4 - - - | G4 - - - E4 - - - C4 - - - - - - - | " +
          "Db5 - - - C5 - - - Bb4 - - - Ab4 - - - | G4 - - - - - - - . . . . . . . .",
          answer:
          ". . . . . . . . . . . . . . . . | Bb3 - G3 - E3 - - - . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | E3 - G3 - Bb3 - - - C4 - - - - - - -",
          hats:
          "h . . h h . . h h . . h h . h h | h . . h h . . h h . . h h . h h | " +
          "h . . h h . . h h . . h h . h h | h . . h h . . h h . . h h . h h",
          trill:
          "Db5 D5 Db5 D5 Db5 D5 Db5 D5 Db5 D5 Db5 D5 Db5 D5 Db5 D5 | C5 Db5 C5 Db5 C5 Db5 C5 Db5 C5 Db5 C5 Db5 C5 Db5 C5 Db5 | " +
          "Db5 D5 Db5 D5 Db5 D5 Db5 D5 Db5 D5 Db5 D5 Db5 D5 Db5 D5 | C5 Db5 C5 Db5 C5 Db5 C5 Db5 C5 Db5 C5 Db5 C5 Db5 C5 Db5",
          pound:
          "k . k . k . k . k . k . k . k k | k . k . k . k . k . k . k . k k | " +
          "k . k . k . k . k . k . k . k k | k . k . k . k . k . k . k . k k",
        },
      },
      order: ["A", "A", "B", "A", "C"],
    },
    // Mausoleum Row: chamber organ fugue. A small chapel organ playing a
    // fugue for the family inside: the subject enters alone, a second voice
    // answers it in C, then a third takes it in the low register. Listen for
    // the episode where the subject's head sinks down the lament (F, Eb, Db,
    // C), stone footsteps under it, and shimmering chord arps on top at full
    // dread.
    ghoulMausoleums: {
      bpm: 100,
      rush: 6,
      voices: {
        drone: { wave: "sine", gain: 0.55, decay: 0.3, sustain: 0.95 },
        bass: { wave: "triangle", gain: 0.65, decay: 0.2, sustain: 0.75 },
        v1: { wave: "square", gain: 0.12, from: 0.2, decay: 0.05, sustain: 0.5 },
        v2: { wave: "pulse", duty: 0.25, gain: 0.12, from: 0.4, decay: 0.05, sustain: 0.5 },
        drums: { kit: true, gain: 0.36, from: 0.45 },
        v3: { wave: "sawtooth", gain: 0.09, from: 0.6, decay: 0.05, sustain: 0.5 },
        high: { wave: "pulse", duty: 0.125, gain: 0.06, from: 0.85, decay: 0.1, sustain: 0.6 },
        pound: { kit: true, gain: 0.3, from: 0.85 },
      },
      patterns: {
        A: {
          drone:
          "F1 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -",
          bass:
          "F2 - - - - - - - - - - - - - - - | C2 - - - - - - - - - - - - - - - | " +
          "C2 - - - - - - - - - - - - - - - | G1 - - - - - - - - - - - - - - - | " +
          "F2 - - - - - - - - - - - - - - - | C2 - - - - - - - - - - - - - - - | " +
          "Db2 - - - - - - - C2 - - - - - - - | F2 - - - - - - - - - - - - - - -",
          v1:
          "F4 . C5 . Ab4 . F4 . E4 . F4 . G4 . C4 . | Db5 . C5 . Bb4 . Ab4 . G4 . F4 . E4 . G4 . | " +
          "Ab4 - - - G4 - - - F4 - - - Eb4 - - - | F4 - - - G4 - - - Ab4 - - - B4 - - - | " +
          "C5 - - - - - - - Bb4 - - - - - - - | Ab4 - - - - - - - G4 - - - - - - - | " +
          "Ab4 - - - - - - - G4 - - - - - - - | F4 - - - - - - - - - - - - - - -",
          v2:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          "C5 . G5 . Eb5 . C5 . B4 . C5 . D5 . G4 . | Ab5 . G5 . F5 . Eb5 . D5 . C5 . B4 . D5 . | " +
          "Eb5 - - - - - - - Db5 - - - - - - - | C5 - - - - - - - B4 - - - - - - - | " +
          "Db5 - - - - - - - B4 - - - - - - - | C5 - - - - - - - - - - - - - - -",
          drums:
          "k . . . h . . . k . . . h . . . | k . . . h . . . k . . . h . . . | " +
          "k . . . h . . . k . . . h . . . | k . . . h . . . k . . . h . . . | " +
          "k . . . h . . . k . . . h . . . | k . . . h . . . k . . . h . . . | " +
          "k . . . h . . . k . . . h . . . | k . . . h . . . k . . . h . . .",
          v3:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          "F3 . C4 . Ab3 . F3 . E3 . F3 . G3 . C3 . | Db4 . C4 . Bb3 . Ab3 . G3 . F3 . E3 . G3 . | " +
          "F3 - - - - - - - G3 - - - - - - - | Ab3 - - - - - - - - - - - - - - -",
          high:
          "F5^037 - - - - - - - - - - - - - - - | F5^037 - - - - - - - - - - - - - - - | " +
          "C5^037 - - - - - - - - - - - - - - - | C5^047 - - - - - - - - - - - - - - - | " +
          "F5^037 - - - - - - - - - - - - - - - | F5^037 - - - - - - - - - - - - - - - | " +
          "Db5^047 - - - - - - - C5^047 - - - - - - - | F5^037 - - - - - - - - - - - - - - -",
          pound:
          "k . k . ks . k . k . k . ks . k . | k . k . ks . k . k . k . ks . k . | " +
          "k . k . ks . k . k . k . ks . k . | k . k . ks . k . k . k . ks . k . | " +
          "k . k . ks . k . k . k . ks . k . | k . k . ks . k . k . k . ks . k . | " +
          "k . k . ks . k . k . k . ks . k . | k . k . ks . k . k . k . ks . k .",
        },
        B: {
          drone:
          "F1 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -",
          bass:
          "F2 - - - - - - - - - - - - - - - | Eb2 - - - - - - - - - - - - - - - | " +
          "Db2 - - - - - - - - - - - - - - - | C2 - - - - - - - - - - - - - - -",
          v1:
          "F4 . C5 . Ab4 . F4 . E4 . F4 . G4 . C4 . | Eb4 . Bb4 . Gb4 . Eb4 . D4 . Eb4 . F4 . Bb3 . | " +
          "Db4 . Ab4 . E4 . Db4 . C4 . Db4 . Eb4 . Ab3 . | C4 . G4 . Eb4 . C4 . B3 . C4 . D4 . G3 .",
          v2:
          "Ab4 - - - - - - - - - - - - - - - | Gb4 - - - - - - - - - - - - - - - | " +
          "E4 - - - - - - - - - - - - - - - | E4 - - - - - - - - - - - - - - -",
          drums:
          "k . . . h . . . k . . . h . . . | k . . . h . . . k . . . h . . . | " +
          "k . . . h . . . k . . . h . . . | k . . . h . . . k . . . h . . .",
          v3:
          "C4 - - - - - - - - - - - - - - - | Bb3 - - - - - - - - - - - - - - - | " +
          "Ab3 - - - - - - - - - - - - - - - | G3 - - - - - - - - - - - - - - -",
          high:
          "F5^037 - - - - - - - - - - - - - - - | Eb5^037 - - - - - - - - - - - - - - - | " +
          "Db5^037 - - - - - - - - - - - - - - - | C5^047 - - - - - - - - - - - - - - -",
          pound:
          "k . k . ks . k . k . k . ks . k . | k . k . ks . k . k . k . ks . k . | " +
          "k . k . ks . k . k . k . ks . k . | k . k . ks . k . k . k . ks . k .",
        },
      },
      order: ["A", "B", "A"],
    },
    // Angel's Rest (Mother Mourning's fight): weeping organ boss. Mother
    // Mourning's lament as a boss fight: an octave-pumping bass and square
    // organ chords walk down Fm, Eb, Db, C while the lead weeps in falling
    // chromatic half steps. Listen for the Neapolitan Gb climax, the weeping
    // line jumping an octave on the last pass, and a shrieking arpeggio wall
    // over driving double kicks at full dread.
    ghoulAngel: {
      bpm: 132,
      rush: 10,
      voices: {
        drone: { wave: "sine", gain: 0.6, decay: 0.3, sustain: 0.95 },
        bass: { wave: "square", gain: 0.5, decay: 0.05, sustain: 0.35 },
        organ: { wave: "square", gain: 0.1, from: 0.2, decay: 0.2, sustain: 0.85 },
        drums: { kit: true, gain: 0.45, from: 0.4 },
        choir: { wave: "sawtooth", gain: 0.09, from: 0.3, decay: 0.4, sustain: 0.9, vibrato: { rate: 5.5, depth: 0.006, delay: 0.2 } },
        hats: { kit: true, gain: 0.25, from: 0.55 },
        lead: { wave: "pulse", duty: 0.25, gain: 0.17, from: 0.6, decay: 0.08, sustain: 0.7, vibrato: { rate: 5.5, depth: 0.01, delay: 0.15 } },
        shriek: { wave: "pulse", duty: 0.125, gain: 0.07, from: 0.85, decay: 0.04, sustain: 0.5 },
        pound: { kit: true, gain: 0.34, from: 0.85 },
      },
      patterns: {
        A: {
          drone:
          "F1 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -",
          bass:
          "F2 . F2 . F3 . F2 . F2 . F3 . F2 . F3 . | Eb2 . Eb2 . Eb3 . Eb2 . Eb2 . Eb3 . Eb2 . Eb3 . | " +
          "Db2 . Db2 . Db3 . Db2 . Db2 . Db3 . Db2 . Db3 . | C2 . C2 . C3 . C2 . C2 . C3 . C2 . C3 .",
          organ:
          "F3^037 - - - - - - - - - - - - - - - | Eb3^047 - - - - - - - - - - - - - - - | " +
          "Db3^047 - - - - - - - - - - - - - - - | C3^047 - - - - - - - - - - - - - - -",
          drums:
          "k . . . s . . . k . k . s . . . | k . . . s . . . k . k . s . . . | " +
          "k . . . s . . . k . k . s . . . | k . . . s . . . k . k . s . . .",
          choir:
          "Ab4 - - - - - - - - - - - - - - - | G4 - - - - - - - - - - - - - - - | " +
          "F4 - - - - - - - - - - - - - - - | E4 - - - - - - - - - - - - - - -",
          hats:
          "h . h . o . h . h . h . o . h h | h . h . o . h . h . h . o . h h | " +
          "h . h . o . h . h . h . o . h h | h . h . o . h . h . h . o . h h",
          lead:
          "C5 - - - B4 - Bb4 - A4 - Ab4 - G4 - - - | Bb4 - - - A4 - Ab4 - G4 - Gb4 - Eb4 - - - | " +
          "Ab4 - - - G4 - Gb4 - F4 - - - - - - - | E4 - - - F4 - G4 - C5 - - - - - - -",
          shriek:
          "F5^037c F5^037c F5^037c F5^037c F5^037c F5^037c F5^037c F5^037c F5^037c F5^037c F5^037c F5^037c F5^037c F5^037c F5^037c F5^037c | Eb5^047c Eb5^047c Eb5^047c Eb5^047c Eb5^047c Eb5^047c Eb5^047c Eb5^047c Eb5^047c Eb5^047c Eb5^047c Eb5^047c Eb5^047c Eb5^047c Eb5^047c Eb5^047c | " +
          "Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c | C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c",
          pound:
          "k k ks k k k ks k k k ks k k k ks ks | k k ks k k k ks k k k ks k k k ks ks | " +
          "k k ks k k k ks k k k ks k k k ks ks | k k ks k k k ks k k k ks k k k ks ks",
        },
        B: {
          drone:
          "Gb1 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "Bb1 - - - - - - - - - - - - - - - | C2 - - - - - - - - - - - - - - -",
          bass:
          "Gb2 . Gb2 . Gb3 . Gb2 . Gb2 . Gb3 . Gb2 . Gb3 . | Db2 . Db2 . Db3 . Db2 . Db2 . Db3 . Db2 . Db3 . | " +
          "Bb1 . Bb1 . Bb2 . Bb1 . Bb1 . Bb2 . Bb1 . Bb2 . | C2 . C2 . C3 . C2 . C2 . C3 . C2 . C3 .",
          organ:
          "Gb3^047 - - - - - - - - - - - - - - - | Db3^047 - - - - - - - - - - - - - - - | " +
          "Bb2^037 - - - - - - - - - - - - - - - | C3^047 - - - - - - - - - - - - - - -",
          drums:
          "k . . . s . . . k . k . s . . . | k . . . s . . . k . k . s . . . | " +
          "k . . . s . . . k . k . s . . . | k . . . s . . . k . k . s . . .",
          choir:
          "Bb4 - - - - - - - - - - - - - - - | Ab4 - - - - - - - - - - - - - - - | " +
          "F4 - - - - - - - - - - - - - - - | E4 - - - - - - - - - - - - - - -",
          hats:
          "h . h . o . h . h . h . o . h h | h . h . o . h . h . h . o . h h | " +
          "h . h . o . h . h . h . o . h h | h . h . o . h . h . h . o . h h",
          lead:
          "Db5 - - - C5 - Bb4 - Gb4 - - - - - - - | F5 - - - E5 - Eb5 - Db5 - - - - - - - | " +
          "Db5 - - - C5 - B4 - Bb4 - - - - - - - | Bb4 - - - G4 - - - E4 - - - C4 - - -",
          shriek:
          "Gb5^047c Gb5^047c Gb5^047c Gb5^047c Gb5^047c Gb5^047c Gb5^047c Gb5^047c Gb5^047c Gb5^047c Gb5^047c Gb5^047c Gb5^047c Gb5^047c Gb5^047c Gb5^047c | Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c | " +
          "Bb4^037c Bb4^037c Bb4^037c Bb4^037c Bb4^037c Bb4^037c Bb4^037c Bb4^037c Bb4^037c Bb4^037c Bb4^037c Bb4^037c Bb4^037c Bb4^037c Bb4^037c Bb4^037c | C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c",
          pound:
          "k k ks k k k ks k k k ks k k k ks ks | k k ks k k k ks k k k ks k k k ks ks | " +
          "k k ks k k k ks k k k ks k k k ks ks | k k ks k k k ks k k k ks k k k ks ks",
        },
        C: {
          drone:
          "F1 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -",
          bass:
          "F2 . F2 . F3 . F2 . F2 . F3 . F2 . F3 . | Eb2 . Eb2 . Eb3 . Eb2 . Eb2 . Eb3 . Eb2 . Eb3 . | " +
          "Db2 . Db2 . Db3 . Db2 . Db2 . Db3 . Db2 . Db3 . | C2 . C2 . C3 . C2 . C2 . C3 . C2 . C3 .",
          organ:
          "F3^037 - - - - - - - - - - - - - - - | Eb3^047 - - - - - - - - - - - - - - - | " +
          "Db3^047 - - - - - - - - - - - - - - - | C3^047 - - - - - - - - - - - - - - -",
          drums:
          "k . . . s . . . k . k . s . . . | k . . . s . . . k . k . s . . . | " +
          "k . . . s . . . k . k . s . . . | k . k . s . k . s s s s s s s s",
          choir:
          "C5 - - - - - - - - - - - - - - - | Bb4 - - - - - - - - - - - - - - - | " +
          "Ab4 - - - - - - - - - - - - - - - | G4 - - - - - - - - - - - - - - -",
          hats:
          "h . h . o . h . h . h . o . h h | h . h . o . h . h . h . o . h h | " +
          "h . h . o . h . h . h . o . h h | h . h . o . h . h . h . o . h h",
          lead:
          "C6 - - - B5 - Bb5 - A5 - Ab5 - G5 - - - | Bb5 - - - A5 - Ab5 - G5 - Gb5 - Eb5 - - - | " +
          "Ab5 - - - G5 - Gb5 - F5 - - - - - - - | E5 - - - F5 - G5 - C6 - - - - - - -",
          shriek:
          "F5^037c F5^037c F5^037c F5^037c F5^037c F5^037c F5^037c F5^037c F5^037c F5^037c F5^037c F5^037c F5^037c F5^037c F5^037c F5^037c | Eb5^047c Eb5^047c Eb5^047c Eb5^047c Eb5^047c Eb5^047c Eb5^047c Eb5^047c Eb5^047c Eb5^047c Eb5^047c Eb5^047c Eb5^047c Eb5^047c Eb5^047c Eb5^047c | " +
          "Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c Db5^047c | C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c C5^047c",
          pound:
          "k k ks k k k ks k k k ks k k k ks ks | k k ks k k k ks k k k ks k k k ks ks | " +
          "k k ks k k k ks k k k ks k k k ks ks | k k ks k k k ks k k k ks k k k ks ks",
        },
      },
      order: ["A", "A", "B", "B", "A", "C"],
    },
  },
};
