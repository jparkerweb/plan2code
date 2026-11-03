// Plan2Code Web Console - Ghoul Rush's secondary weapons' sounds: the throw of each and what it does when it lands. Dynamite keeps the Mine's own sounds (ghoul-sfx-mine.js).
//
// Merged by ghoul-sfx.js like a stage's. Not picked by ear yet: these are a first
// pass, one a weapon, the way a stage's borrowed tones are until its sound page.

export const ARMS_SFX = Object.freeze({
  tones: {
    // Iron Stake: a heavy spike whistling away.
    ghoulArmStake: {
      layers: [
        { type: "noise", seconds: 0.22, attack: 0.01, gain: 0.5, filter: { type: "bandpass", from: 2400, to: 700, q: 3 } },
        { type: "square", from: 320, to: 140, seconds: 0.12, attack: 0.002, gain: 0.22 },
      ],
    },
    // Bottle Rocket: a rising fizz.
    ghoulArmRocket: {
      layers: [
        { type: "noise", seconds: 0.5, attack: 0.02, gain: 0.42, filter: { type: "highpass", from: 2200, to: 6000, q: 1 } },
        { type: "sine", from: 500, to: 2300, seconds: 0.45, attack: 0.01, gain: 0.26 },
      ],
    },
    // Billiard Ball: a click and a low roll.
    ghoulArmBall: {
      layers: [
        { type: "noise", seconds: 0.03, attack: 0.001, gain: 0.7, filter: { type: "bandpass", from: 3400, to: 3000, q: 4 } },
        { type: "brown", seconds: 0.6, attack: 0.05, gain: 0.5, filter: { type: "lowpass", from: 420, to: 260, q: 1 } },
      ],
    },
    // Custard Pie: a wet slap and a soft spatter.
    ghoulArmSplat: {
      layers: [
        { type: "brown", seconds: 0.18, attack: 0.002, gain: 0.7, filter: { type: "lowpass", from: 900, to: 260, q: 1 } },
        { type: "noise", seconds: 0.3, attack: 0.01, gain: 0.35, filter: { type: "bandpass", from: 1800, to: 500, q: 2 } },
        { type: "sine", from: 420, to: 130, seconds: 0.14, attack: 0.002, gain: 0.3 },
      ],
    },
    ghoulArmBounce: {
      layers: [
        { type: "noise", seconds: 0.03, attack: 0.001, gain: 0.6, filter: { type: "bandpass", from: 2600, to: 2200, q: 4 } },
        { type: "sine", from: 240, to: 120, seconds: 0.08, attack: 0.002, gain: 0.4 },
      ],
    },
    // Cast-Iron Skillet: the swing, and the bong when it connects.
    ghoulArmSkillet: {
      layers: [
        { type: "noise", seconds: 0.18, attack: 0.04, gain: 0.45, filter: { type: "bandpass", from: 500, to: 1700, q: 1.5 } },
      ],
    },
    ghoulArmClang: {
      layers: [
        { type: "triangle", from: 620, to: 590, seconds: 0.5, attack: 0.001, gain: 0.5 },
        { type: "sine", from: 1490, to: 1440, seconds: 0.32, attack: 0.001, gain: 0.26 },
        { type: "noise", seconds: 0.03, attack: 0.001, gain: 0.45, filter: { type: "highpass", from: 2400, to: 2400, q: 1 } },
      ],
    },
    // Grave Salt: a pour, then a long hiss on the floor.
    ghoulArmSalt: {
      layers: [
        { type: "noise", seconds: 0.2, attack: 0.02, gain: 0.3, filter: { type: "highpass", from: 5200, to: 5200, q: 1 } },
      ],
    },
    ghoulArmSaltBurn: {
      layers: [
        { type: "noise", seconds: 1.1, attack: 0.04, gain: 0.34, filter: { type: "highpass", from: 3800, to: 6200, q: 1 } },
        { type: "pink", seconds: 0.8, attack: 0.1, gain: 0.2, filter: { type: "bandpass", from: 1100, to: 600, q: 2 } },
      ],
    },
    // Hedge Sickle: a blade spinning out, and a swish as it turns for home.
    ghoulArmSickle: {
      layers: [
        { type: "noise", seconds: 0.3, attack: 0.03, gain: 0.42, filter: { type: "bandpass", from: 1600, to: 3200, q: 3 } },
        { type: "sine", from: 1900, to: 2600, seconds: 0.16, attack: 0.005, gain: 0.14 },
      ],
    },
    ghoulArmTurn: {
      layers: [
        { type: "noise", seconds: 0.26, attack: 0.04, gain: 0.36, filter: { type: "bandpass", from: 3200, to: 1400, q: 3 } },
      ],
    },
    // Tuning Fork: one wrong, pure note.
    ghoulArmFork: {
      layers: [
        { type: "sine", from: 880, to: 880, seconds: 1, attack: 0.002, gain: 0.5, vibrato: { rate: 6, depth: 0.004 } },
        { type: "sine", from: 932, to: 932, seconds: 0.8, attack: 0.002, gain: 0.26 },
        { type: "sine", from: 2640, to: 2640, seconds: 0.25, attack: 0.001, gain: 0.14 },
      ],
    },
    // Flash Powder: a pop and a white sizzle.
    ghoulArmFlash: {
      layers: [
        { type: "noise", seconds: 0.1, attack: 0.001, gain: 0.8, filter: { type: "highpass", from: 1400, to: 3000, q: 1 } },
        { type: "noise", seconds: 0.5, attack: 0.02, gain: 0.26, filter: { type: "highpass", from: 5200, to: 8000, q: 1 } },
        { type: "sine", from: 180, to: 60, seconds: 0.14, attack: 0.001, gain: 0.5 },
      ],
    },
    ghoulArmToss: {
      layers: [
        { type: "noise", seconds: 0.14, attack: 0.03, gain: 0.36, filter: { type: "bandpass", from: 700, to: 2100, q: 1.5 } },
      ],
    },
    // Silver Bear Trap: set down with a clink, and the snap.
    ghoulArmTrap: {
      layers: [
        { type: "noise", seconds: 0.02, attack: 0.001, gain: 0.5, filter: { type: "bandpass", from: 3800, to: 3800, q: 5 } },
        { type: "noise", seconds: 0.02, attack: 0.001, gain: 0.42, delay: 0.09, filter: { type: "bandpass", from: 4600, to: 4600, q: 5 } },
        { type: "sine", from: 2100, to: 2050, seconds: 0.12, attack: 0.001, gain: 0.12, delay: 0.09 },
      ],
    },
    ghoulArmSnap: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0.001, gain: 0.95, filter: { type: "bandpass", from: 2800, to: 1600, q: 2 } },
        { type: "triangle", from: 1400, to: 1300, seconds: 0.22, attack: 0.001, gain: 0.3 },
        { type: "sine", from: 150, to: 70, seconds: 0.12, attack: 0.001, gain: 0.6 },
      ],
    },
  },
  music: {},
});
