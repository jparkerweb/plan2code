// Plan2Code Web Console - rapids: its own sound effects, merged into tones.js beside the shared kit; defines only.
//
// `tones` are one-shot sounds played with tone(name, level, pitch); `hums` are
// held sounds kept going with hum(id, name, level, pitch). Both take the shapes
// tones.js documents, as plain objects (tones.js freezes them). A name may be
// defined only once across tones.js and every game's file. No imports.

export default {
  tones: {
    // A skiff or a darter sunk: a wet crack, a hull going under (a falling
    // sine) and the gurgle of bubbles after it.
    rapidsSink: {
      layers: [
        { type: "noise", seconds: 0.22, filter: { type: "bandpass", from: 2200, to: 600, q: 1.2 } },
        { type: "sine", from: 260, to: 70, seconds: 0.32, gain: 0.6 },
        { type: "sine", notes: [420, 560, 380, 640, 470], seconds: 0.3, delay: 0.14, gain: 0.3 },
      ],
    },
    // A bob mine going up: a column of water thrown into the air and falling
    // back as spray.
    rapidsGeyser: {
      layers: [
        { type: "brown", seconds: 0.5, filter: { type: "lowpass", from: 1600, to: 160 } },
        { type: "noise", seconds: 0.6, delay: 0.1, gain: 0.45, attack: 0.08, filter: { type: "bandpass", from: 4000, to: 1200, q: 0.8 } },
        { type: "sine", from: 120, to: 40, seconds: 0.3, gain: 0.7 },
      ],
    },
    // A gull drone shot down: its little rotor cut off (a whine falling away)
    // and a puff of feathers.
    rapidsDroneDown: {
      layers: [
        { type: "sawtooth", from: 900, to: 140, seconds: 0.3, gain: 0.35, filter: { type: "lowpass", from: 3000, to: 500 } },
        { type: "pink", seconds: 0.2, gain: 0.5, filter: { type: "highpass", from: 2400, to: 1200 } },
      ],
    },
    // A bank sentry's gun: a short, dull cannon pop from the shore.
    rapidsCannon: {
      layers: [
        { type: "brown", seconds: 0.14, filter: { type: "lowpass", from: 1400, to: 200 } },
        { type: "square", from: 150, to: 70, seconds: 0.08, gain: 0.35, filter: { type: "lowpass", from: 900, to: 300 } },
      ],
    },
    // A charge buoy taken: a bright electric zip climbing into a chord (the
    // game pitches it with how full the battery now is).
    rapidsChargeUp: {
      layers: [
        { type: "triangle", notes: [523, 784, 1047, 1568], seconds: 0.24, gain: 0.55 },
        { type: "noise", seconds: 0.16, gain: 0.25, filter: { type: "bandpass", from: 2500, to: 6000, q: 4 } },
      ],
    },
    // Surge: the battery filled at once, a whine winding all the way up.
    rapidsSurge: {
      layers: [
        { type: "sawtooth", from: 180, to: 1400, seconds: 0.5, gain: 0.35, filter: { type: "lowpass", from: 500, to: 3600, q: 3 } },
        { type: "sine", from: 360, to: 2100, seconds: 0.5, gain: 0.5 },
      ],
    },
    // The motor dying as the battery runs flat: a sputter (a sawtooth that
    // stutters on its vibrato) winding down to nothing.
    rapidsSputter: {
      layers: [
        { type: "sawtooth", from: 150, to: 38, seconds: 0.9, gain: 0.5, vibrato: { rate: 9, depth: 0.25 }, filter: { type: "lowpass", from: 900, to: 160 } },
        { type: "brown", seconds: 0.6, gain: 0.4, filter: { type: "lowpass", from: 500, to: 120 } },
      ],
    },
    // The motor pulled into life at the start and after a restart: two
    // coughs, then it catches.
    rapidsPullStart: {
      layers: [
        { type: "sawtooth", from: 70, to: 50, seconds: 0.08, gain: 0.45, filter: { type: "lowpass", from: 600, to: 300 } },
        { type: "sawtooth", from: 75, to: 52, seconds: 0.08, delay: 0.16, gain: 0.5, filter: { type: "lowpass", from: 600, to: 300 } },
        { type: "sawtooth", from: 60, to: 120, seconds: 0.36, delay: 0.32, gain: 0.5, filter: { type: "lowpass", from: 400, to: 1100 } },
        { type: "brown", seconds: 0.36, delay: 0.32, gain: 0.3, filter: { type: "lowpass", from: 500, to: 300 } },
      ],
    },
    // The throttle opened: the motor's pitch flaring up for a moment.
    rapidsRevUp: {
      layers: [
        { type: "sawtooth", from: 90, to: 210, seconds: 0.3, gain: 0.35, filter: { type: "lowpass", from: 500, to: 1400, q: 2 } },
        { type: "pink", seconds: 0.3, gain: 0.3, attack: 0.05, filter: { type: "bandpass", from: 600, to: 1800, q: 1.2 } },
      ],
    },
    // A sharp turn carved into the water: a soft, wet swish.
    rapidsCarve: {
      layers: [{ type: "pink", seconds: 0.2, attack: 0.04, filter: { type: "bandpass", from: 2400, to: 900, q: 1.6 } }],
    },
    // A river horn: two low, reedy notes together, for a dam coming into
    // view (and, pitched down, for a mini-boss steaming in).
    rapidsFoghorn: {
      layers: [
        { type: "sawtooth", from: 147, to: 145, seconds: 0.9, attack: 0.08, gain: 0.45, filter: { type: "lowpass", from: 700, to: 500 } },
        { type: "sawtooth", from: 175, to: 173, seconds: 0.9, attack: 0.08, gain: 0.35, filter: { type: "lowpass", from: 700, to: 500 } },
      ],
    },
    // The dam groaning once it is nearly through: timber and stone straining.
    rapidsDamGroan: {
      layers: [
        { type: "sawtooth", from: 110, to: 80, seconds: 0.5, gain: 0.45, vibrato: { rate: 17, depth: 0.08 }, filter: { type: "bandpass", from: 600, to: 400, q: 3 } },
        { type: "brown", seconds: 0.4, gain: 0.4, filter: { type: "lowpass", from: 600, to: 200 } },
      ],
    },
    // The water held behind a dam let go: a long rushing roar that rises and
    // then settles.
    rapidsFlood: {
      layers: [
        { type: "brown", seconds: 1.1, attack: 0.15, filter: { type: "lowpass", from: 500, to: 1400 } },
        { type: "noise", seconds: 1, delay: 0.1, attack: 0.25, gain: 0.35, filter: { type: "bandpass", from: 1200, to: 3000, q: 0.7 } },
      ],
    },
    // A mini-boss sunk: a great hull breaking up and going down with a
    // long gurgle.
    rapidsBossSink: {
      layers: [
        { type: "sawtooth", from: 90, to: 30, seconds: 1, gain: 0.45, vibrato: { rate: 7, depth: 0.1 }, filter: { type: "lowpass", from: 700, to: 150 } },
        { type: "sine", notes: [300, 380, 260, 420, 330, 280, 360, 240], seconds: 0.9, delay: 0.25, gain: 0.35 },
        { type: "noise", seconds: 0.6, delay: 0.1, gain: 0.3, filter: { type: "bandpass", from: 2000, to: 500, q: 1 } },
      ],
    },
    // A mini-boss roaring as it takes its half: a deep growl on the horn.
    rapidsBossRoar: {
      layers: [
        { type: "sawtooth", from: 82, to: 62, seconds: 0.7, attack: 0.08, gain: 0.55, vibrato: { rate: 11, depth: 0.06 }, filter: { type: "lowpass", from: 800, to: 400, q: 2 } },
        { type: "brown", seconds: 0.6, gain: 0.45, filter: { type: "lowpass", from: 400, to: 160 } },
      ],
    },
  },
  hums: {
    // Spray off the hull while skimming a bank: bright, hissing water, the
    // filter opening with speed.
    rapidsSpray: { noise: { color: "noise", gain: 1 }, filter: { type: "bandpass", freq: 3200, q: 0.9, follow: 1 }, pulse: { rate: 7, depth: 0.35 }, peak: 0.03 },
    // A whirlpool turning nearby: a low swirling slosh that pulses slowly.
    rapidsWhirl: { parts: [{ type: "sine", freq: 70, gain: 0.4 }], noise: { color: "brown", gain: 1 }, filter: { type: "bandpass", freq: 420, q: 2.5, follow: 1 }, pulse: { rate: 1.6, depth: 0.7 }, peak: 0.05 },
    // A gull drone's little rotor: a thin buzz, pitched up as it closes.
    rapidsRotor: { parts: [{ type: "triangle", freq: 210 }, { type: "triangle", freq: 213, gain: 0.6 }], filter: { type: "lowpass", freq: 1400, q: 1, follow: 1 }, pulse: { rate: 34, depth: 0.5 }, peak: 0.02 },
    // A mini-boss's heavy engines: deep, slow strokes under a churn of water.
    rapidsBossEngine: { parts: [{ type: "sawtooth", freq: 33 }, { type: "sawtooth", freq: 33.4, gain: 0.7 }], noise: { color: "brown", gain: 0.5 }, filter: { type: "lowpass", freq: 240, q: 3, follow: 0.8 }, pulse: { rate: 4, depth: 0.6 }, peak: 0.055 },
  },
};
