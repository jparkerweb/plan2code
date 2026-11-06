// Plan2Code Web Console - hop: its own sound effects, merged into tones.js beside the shared kit; defines only.
//
// `tones` are one-shot sounds played with tone(name, level, pitch); `hums` are
// held sounds kept going with hum(id, name, level, pitch). Both take the shapes
// tones.js documents, as plain objects (tones.js freezes them). A name may be
// defined only once across tones.js and every game's file. No imports.

export default {
  tones: {
    // Feet down on a log: a hollow wooden knock.
    hopLogLand: {
      layers: [
        { type: "triangle", from: 190, to: 140, seconds: 0.09 },
        { type: "triangle", from: 380, to: 350, seconds: 0.05, gain: 0.4 },
        { type: "brown", seconds: 0.06, gain: 0.6, filter: { type: "bandpass", from: 800, to: 450, q: 1.5 } },
      ],
    },
    // Feet down on a turtle's wet shell: a soft slap and a drip.
    hopTurtleLand: {
      layers: [
        { type: "pink", seconds: 0.12, filter: { type: "bandpass", from: 1200, to: 500, q: 1.5 } },
        { type: "sine", from: 260, to: 130, seconds: 0.08, gain: 0.5 },
        { type: "sine", from: 700, to: 1400, seconds: 0.05, delay: 0.07, gain: 0.25 },
      ],
    },
    // Feet down on grass or the pavement: a quiet rustle under the hop blip.
    hopGrassStep: { layers: [{ type: "noise", seconds: 0.05, gain: 0.5, filter: { type: "bandpass", from: 3200, to: 2000, q: 1 } }] },
    // You under a car's wheels: a cartoon squash, wet crunch and a low thump.
    hopSquash: {
      layers: [
        { type: "noise", seconds: 0.16, filter: { type: "lowpass", from: 2000, to: 220, q: 2 } },
        { type: "sawtooth", from: 320, to: 70, seconds: 0.16, gain: 0.4, filter: { type: "lowpass", from: 1400, to: 300 } },
        { type: "sine", from: 95, to: 40, seconds: 0.18, gain: 0.8 },
      ],
    },
    // A rival into the water: a small plop, quieter than your splash.
    hopPlop: {
      layers: [
        { type: "pink", seconds: 0.18, filter: { type: "bandpass", from: 2000, to: 600, q: 1.2 } },
        { type: "sine", from: 620, to: 200, seconds: 0.08, gain: 0.5 },
      ],
    },
    // Landing dazed: little birds tweeting round your head.
    hopDazed: {
      layers: [
        { type: "triangle", notes: [2093, 2637, 2349, 2794], seconds: 0.44, gain: 0.45, vibrato: { rate: 22, depth: 0.03 } },
        { type: "triangle", notes: [2794, 2349, 2637], seconds: 0.33, delay: 0.12, gain: 0.3 },
      ],
    },
    // The daze worn off: a quick two-note "ready" chirp.
    hopUnDaze: { type: "sine", notes: [660, 990], seconds: 0.1 },
    // An icy lane sliding you on a cell: a skate's hiss on ice.
    hopIceSlide: {
      layers: [
        { type: "noise", seconds: 0.16, attack: 0.02, filter: { type: "bandpass", from: 5200, to: 3400, q: 4 } },
        { type: "triangle", from: 1900, to: 1650, seconds: 0.14, gain: 0.15 },
      ],
    },
    // A car flashing past right behind you: a doppler whoosh with its engine
    // dropping in pitch as it goes.
    hopNearMiss: {
      layers: [
        { type: "pink", seconds: 0.32, attack: 0.05, filter: { type: "bandpass", from: 2400, to: 500, q: 2 } },
        { type: "sawtooth", from: 230, to: 150, seconds: 0.3, attack: 0.04, gain: 0.35, filter: { type: "lowpass", from: 900, to: 300 } },
      ],
    },
    // A train rushing through the crossing: a wall of low rumble and the
    // rails' hiss behind it.
    hopTrainRush: {
      layers: [
        { type: "brown", seconds: 0.8, attack: 0.1, filter: { type: "lowpass", from: 300, to: 1000 } },
        { type: "noise", seconds: 0.5, delay: 0.2, gain: 0.25, filter: { type: "highpass", from: 3500, to: 2500 } },
        { type: "square", notes: [70, 64, 70, 64], seconds: 0.6, gain: 0.25, filter: { type: "lowpass", from: 400, to: 400 } },
      ],
    },
    // A diving turtle starting to sink under your feet: bubbles rising.
    hopTurtleSink: {
      layers: [
        { type: "sine", from: 300, to: 900, seconds: 0.06 },
        { type: "sine", from: 420, to: 1150, seconds: 0.05, delay: 0.09, gain: 0.8 },
        { type: "sine", from: 260, to: 820, seconds: 0.06, delay: 0.18, gain: 0.7 },
        { type: "pink", seconds: 0.25, gain: 0.25, filter: { type: "bandpass", from: 900, to: 500, q: 2 } },
      ],
    },
    // A Rapids lane turning round near you: the water churning.
    hopRapidsTurn: {
      layers: [
        { type: "brown", seconds: 0.5, attack: 0.15, filter: { type: "bandpass", from: 400, to: 1200, q: 1 } },
        { type: "pink", seconds: 0.4, delay: 0.1, gain: 0.5, filter: { type: "bandpass", from: 1500, to: 600, q: 1.2 } },
      ],
    },
    // A Shield turning a car or a train aside: a bright glassy ting.
    hopShieldBlock: {
      layers: [
        { type: "triangle", from: 2200, to: 2100, seconds: 0.25, gain: 0.6 },
        { type: "sine", from: 900, to: 1800, seconds: 0.1, gain: 0.5 },
        { type: "noise", seconds: 0.05, gain: 0.3, filter: { type: "highpass", from: 4000, to: 5000 } },
      ],
    },
    // The Shield running out: a soft tick, quicker toward the end.
    hopShieldTick: { type: "sine", from: 1600, to: 1500, seconds: 0.04 },
    // First to the top: a bright arpeggio over a bass line, a sparkle on top.
    hopHeatWin: {
      layers: [
        { type: "square", notes: [523, 659, 784, 1047, 784, 1047], seconds: 0.54, gain: 0.4, filter: { type: "lowpass", from: 2800, to: 2800 } },
        { type: "triangle", notes: [262, 330, 392, 523, 392, 523], seconds: 0.54, gain: 0.7 },
        { type: "noise", seconds: 0.3, delay: 0.45, gain: 0.12, filter: { type: "highpass", from: 7000, to: 9000 } },
      ],
    },
    // Beaten to the top with lives to spare: a sad trombone, wah wah wah,
    // the last note wobbling down.
    hopLoseSting: {
      layers: [
        { type: "sawtooth", notes: [392, 370, 349], seconds: 0.6, gain: 0.55, filter: { type: "lowpass", from: 1200, to: 1000 } },
        { type: "sawtooth", from: 330, to: 290, seconds: 0.55, delay: 0.6, gain: 0.55, vibrato: { rate: 7, depth: 0.04 }, filter: { type: "lowpass", from: 1100, to: 500 } },
      ],
    },
  },
  hums: {
    // A truck's diesel: lower and slower than a car, a deep chug.
    hopTruck: { parts: [{ type: "sawtooth", freq: 34 }, { type: "sawtooth", freq: 34.4, gain: 0.6 }, { type: "square", freq: 17, gain: 0.6 }], noise: { color: "brown", gain: 0.3 }, filter: { type: "lowpass", freq: 300, q: 3, follow: 0.9 }, pulse: { rate: 8, depth: 0.5 }, peak: 0.055 },
    // A Shield up: a soft shimmering bubble round you.
    hopShield: { parts: [{ type: "sine", freq: 660 }, { type: "sine", freq: 664, gain: 0.7 }, { type: "triangle", freq: 1320, gain: 0.2 }], filter: { type: "lowpass", freq: 2000, q: 1, follow: 1 }, pulse: { rate: 5, depth: 0.4 }, peak: 0.02 },
  },
};

