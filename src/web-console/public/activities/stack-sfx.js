// Plan2Code Web Console - stack: its own sound effects, merged into tones.js beside the shared kit; defines only.
//
// `tones` are one-shot sounds played with tone(name, level, pitch); `hums` are
// held sounds kept going with hum(id, name, level, pitch). Both take the shapes
// tones.js documents, as plain objects (tones.js freezes them). A name may be
// defined only once across tones.js and every game's file. No imports.

export default {
  tones: {
    // A block settling onto the tower: a soft body thump with a little click
    // of contact on top. The game pitches it by the tower's style (racks and
    // rockets ring higher, office floors sit lower).
    stackLand: {
      layers: [
        { type: "sine", from: 160, to: 62, seconds: 0.12 },
        { type: "brown", seconds: 0.09, gain: 0.55, filter: { type: "lowpass", from: 650, to: 180 } },
        { type: "noise", seconds: 0.025, gain: 0.3, filter: { type: "bandpass", from: 2600, to: 2200, q: 2 } },
      ],
    },
    // The overhang cut away: a quick "shhk" of a blade through the block.
    stackSlice: {
      layers: [
        { type: "noise", seconds: 0.13, filter: { type: "bandpass", from: 3800, to: 1200, q: 2.5 } },
        { type: "sawtooth", from: 900, to: 320, seconds: 0.08, gain: 0.25, filter: { type: "lowpass", from: 3000, to: 800 } },
      ],
    },
    // The sliced piece landing far below a moment later: a distant rubble
    // clatter, quieter and lower the smaller the piece.
    stackDebris: {
      layers: [
        { type: "brown", seconds: 0.32, filter: { type: "lowpass", from: 800, to: 120 } },
        ...[0, 0.06, 0.13].map((delay) => ({ type: "noise", seconds: 0.03, delay, gain: 0.3, filter: { type: "bandpass", from: 1500, to: 900, q: 2 } })),
      ],
    },
    // A drop a hair off perfect: a tiny falling two-note "so close".
    stackSoClose: { layers: [{ type: "triangle", notes: [784, 698], seconds: 0.16, gain: 0.6 }] },
    // A drop that only just caught the edge: the tower creaks as it sways.
    stackTeeter: {
      layers: [{ type: "sawtooth", from: 150, to: 108, seconds: 0.42, attack: 0.04, gain: 0.45, vibrato: { rate: 9, depth: 0.07 }, filter: { type: "bandpass", from: 800, to: 560, q: 3 } }],
    },
    // The sliding block knocking off a wall and heading back: a soft tap, the
    // game pitches it with the slide's pace.
    stackBump: {
      layers: [
        { type: "triangle", from: 280, to: 200, seconds: 0.045 },
        { type: "noise", seconds: 0.02, gain: 0.25, filter: { type: "bandpass", from: 1800, to: 1500, q: 2 } },
      ],
    },
    // A block changing its mind mid-air (Mixed signals): a quick whip back.
    stackTurn: {
      layers: [
        { type: "pink", seconds: 0.12, gain: 0.7, filter: { type: "bandpass", from: 1900, to: 600, q: 2 } },
        { type: "triangle", from: 640, to: 420, seconds: 0.09, gain: 0.5 },
      ],
    },
    // The next block rolling out of the gantry: a small servo chirp.
    stackSpawn: {
      layers: [
        { type: "sine", from: 420, to: 660, seconds: 0.07, gain: 0.6 },
        { type: "noise", seconds: 0.02, gain: 0.2, filter: { type: "highpass", from: 4000, to: 5000 } },
      ],
    },
    // A lag spike freezing the block: a stuttering digital glitch.
    stackGlitch: {
      layers: [
        { type: "square", notes: [1200, 300, 950, 210, 1500, 380], seconds: 0.15, gain: 0.4, filter: { type: "lowpass", from: 3200, to: 3200 } },
        { type: "noise", seconds: 0.1, gain: 0.2, filter: { type: "highpass", from: 3000, to: 5000 } },
      ],
    },
    // A run of perfects maxing out the multiplier: a bright run up an octave
    // with a shimmer ringing after it.
    stackComboMax: {
      layers: [
        { type: "triangle", notes: [1047, 1319, 1568, 2093], seconds: 0.3, gain: 0.7 },
        { type: "sine", from: 2093, to: 2093, seconds: 0.4, delay: 0.26, gain: 0.35, vibrato: { rate: 9, depth: 0.01 } },
        { type: "noise", seconds: 0.3, delay: 0.2, gain: 0.1, filter: { type: "highpass", from: 7000, to: 9000 } },
      ],
    },
    // The block growing back wider: a stretchy upward sweep.
    stackGrow: {
      layers: [
        { type: "sine", from: 300, to: 900, seconds: 0.26 },
        { type: "pink", seconds: 0.26, attack: 0.08, gain: 0.3, filter: { type: "bandpass", from: 600, to: 3000, q: 2 } },
      ],
    },
    // Every tenth floor: a three-note chime with a soft sparkle after it.
    stackMilestone: {
      layers: [
        { type: "triangle", notes: [784, 1047, 1319], seconds: 0.3 },
        { type: "square", notes: [392, 523, 659], seconds: 0.3, gain: 0.2, filter: { type: "lowpass", from: 2200, to: 2200 } },
        { type: "noise", seconds: 0.25, delay: 0.22, gain: 0.1, filter: { type: "highpass", from: 7000, to: 9000 } },
      ],
    },
    // A round starting: the deploy powering up.
    stackBoot: {
      layers: [
        { type: "sine", from: 220, to: 880, seconds: 0.24, attack: 0.05 },
        { type: "square", notes: [523, 784], seconds: 0.14, delay: 0.2, gain: 0.3, filter: { type: "lowpass", from: 2400, to: 2400 } },
      ],
    },
    // The rockets begin: a low roar swelling up as if lifting off.
    stackLiftoff: {
      layers: [
        { type: "brown", seconds: 1.1, attack: 0.4, filter: { type: "lowpass", from: 200, to: 1100, q: 1 } },
        { type: "sine", from: 50, to: 90, seconds: 1.1, attack: 0.4, gain: 0.5 },
      ],
    },
    // A miss: the tower groans and sways, a long creak over a low rumble.
    stackTopple: {
      layers: [
        { type: "sawtooth", from: 120, to: 68, seconds: 0.75, attack: 0.05, gain: 0.45, vibrato: { rate: 7, depth: 0.08 }, filter: { type: "bandpass", from: 650, to: 380, q: 3 } },
        { type: "brown", seconds: 0.75, attack: 0.2, gain: 0.6, filter: { type: "lowpass", from: 320, to: 120 } },
      ],
    },
    // The missed block hitting the ground: a heavy crash with rubble raining
    // after it.
    stackCollapse: {
      layers: [
        { type: "brown", seconds: 0.9, filter: { type: "lowpass", from: 1400, to: 80 } },
        { type: "sine", from: 95, to: 34, seconds: 0.55, gain: 0.8 },
        ...[0.05, 0.14, 0.22, 0.33, 0.45].map((delay, i) => ({ type: "noise", seconds: 0.04, delay, gain: 0.35 - i * 0.04, filter: { type: "bandpass", from: 1700, to: 900, q: 2 } })),
      ],
    },
  },
  hums: {
    // The gantry carrying the sliding block: a soft trolley motor, pitched by
    // the game with the slide's pace and quiet under everything else.
    stackSlide: { parts: [{ type: "triangle", freq: 110 }, { type: "sine", freq: 220.6, gain: 0.35 }], noise: { color: "pink", gain: 0.12 }, filter: { type: "lowpass", freq: 800, q: 1, follow: 0.8 }, pulse: { rate: 6, depth: 0.15 }, peak: 0.03 },
    // A gold block sliding: a faint twinkling shimmer riding over the motor.
    stackGold: { parts: [{ type: "sine", freq: 1760, gain: 0.5 }, { type: "sine", freq: 2637, gain: 0.3 }], filter: { type: "bandpass", freq: 2000, q: 1, follow: 1 }, pulse: { rate: 7, depth: 0.7 }, peak: 0.015 },
    // The server racks' floors: fans whirring over a low mains hum.
    stackServerFans: { parts: [{ type: "sine", freq: 60, gain: 0.5 }, { type: "sine", freq: 120, gain: 0.25 }], noise: { color: "pink", gain: 1 }, filter: { type: "lowpass", freq: 900, q: 0.7, follow: 0.5 }, pulse: { rate: 0.2, depth: 0.15 }, peak: 0.02 },
    // The rocket floors: the engines idling with a low, rough roar.
    stackThrusters: { parts: [{ type: "sawtooth", freq: 40, gain: 0.3 }], noise: { color: "brown", gain: 1 }, filter: { type: "lowpass", freq: 260, q: 1, follow: 0.8 }, pulse: { rate: 13, depth: 0.25 }, peak: 0.04 },
  },
};
