// Plan2Code Web Console - bounce: its own sound effects, merged into tones.js beside the shared kit; defines only.
//
// `tones` are one-shot sounds played with tone(name, level, pitch); `hums` are
// held sounds kept going with hum(id, name, level, pitch). Both take the shapes
// tones.js documents, as plain objects (tones.js freezes them). A name may be
// defined only once across tones.js and every game's file. No imports.

export default {
  tones: {
    // A landing on plastic wheels: a soft body thump, the knock of the
    // chassis and the toy suspension's little rattle. The game makes it
    // louder and lower the longer the fall.
    bounceLand: {
      layers: [
        { type: "sine", from: 150, to: 52, seconds: 0.14 },
        { type: "brown", seconds: 0.1, gain: 0.7, filter: { type: "lowpass", from: 900, to: 220 } },
        { type: "noise", seconds: 0.03, gain: 0.35, filter: { type: "bandpass", from: 1900, to: 1500, q: 2 } },
        { type: "triangle", from: 880, to: 700, seconds: 0.12, delay: 0.03, gain: 0.18, vibrato: { rate: 34, depth: 0.05 } },
      ],
    },
    // A Spring power-up jump or a ramp's launch: a coiled spring's sproing.
    bounceSproing: {
      layers: [
        { type: "triangle", from: 190, to: 640, seconds: 0.34, vibrato: { rate: 26, depth: 0.07 } },
        { type: "sine", from: 380, to: 1280, seconds: 0.2, gain: 0.3 },
      ],
    },
    // A toy car flattened under you: crumpling tin and a plastic crack.
    bounceTinCrush: {
      layers: [
        { type: "noise", seconds: 0.2, filter: { type: "bandpass", from: 2400, to: 700, q: 1.6 } },
        { type: "square", from: 240, to: 70, seconds: 0.14, gain: 0.4, filter: { type: "lowpass", from: 1600, to: 300 } },
        { type: "triangle", from: 1400, to: 1300, seconds: 0.12, delay: 0.03, gain: 0.25 },
      ],
    },
    // Your wheels slamming the Monster truck's roof: a deep boom and a
    // ringing steel panel.
    bounceRoofSlam: {
      layers: [
        { type: "brown", seconds: 0.32, filter: { type: "lowpass", from: 1200, to: 120 } },
        { type: "sine", from: 95, to: 38, seconds: 0.3, gain: 0.9 },
        { type: "square", from: 330, to: 318, seconds: 0.3, delay: 0.02, gain: 0.25, filter: { type: "lowpass", from: 1800, to: 700 } },
        { type: "triangle", from: 660, to: 640, seconds: 0.4, delay: 0.02, gain: 0.2 },
      ],
    },
    // The Monster truck rolling in: a big engine revving up through its
    // gears with a growl of exhaust.
    bounceMonsterRev: {
      layers: [
        { type: "sawtooth", from: 42, to: 120, seconds: 0.75, attack: 0.1, gain: 0.7, vibrato: { rate: 14, depth: 0.08 }, filter: { type: "lowpass", from: 260, to: 1100, q: 4 } },
        { type: "brown", seconds: 0.75, attack: 0.1, gain: 0.6, filter: { type: "lowpass", from: 300, to: 700 } },
      ],
    },
    // The Monster flattened at last: a crash of metal, the engine dying away
    // and a bright run on top.
    bounceMonsterDown: {
      layers: [
        { type: "noise", seconds: 0.45, filter: { type: "bandpass", from: 2000, to: 400, q: 1 } },
        { type: "sawtooth", from: 110, to: 28, seconds: 0.9, gain: 0.5, vibrato: { rate: 9, depth: 0.1 }, filter: { type: "lowpass", from: 900, to: 150 } },
        { type: "triangle", notes: [523, 659, 784, 1047, 1319], seconds: 0.5, delay: 0.45, gain: 0.6 },
      ],
    },
    // A cop on your tail: a toy siren's two notes, wobbling.
    bounceSiren: {
      layers: [
        { type: "square", notes: [740, 988, 740, 988], seconds: 0.9, gain: 0.35, vibrato: { rate: 7, depth: 0.02 }, filter: { type: "lowpass", from: 2200, to: 2200 } },
        { type: "sine", notes: [740, 988, 740, 988], seconds: 0.9, gain: 0.5 },
      ],
    },
    // The cop giving up: the siren winding down.
    bounceSirenOff: {
      layers: [{ type: "sine", from: 900, to: 380, seconds: 0.45, gain: 0.5, vibrato: { rate: 7, depth: 0.02 } }],
    },
    // A level crossing's bell before a train: three dings with a clapper's tick.
    bounceCrossing: {
      layers: [
        { type: "triangle", notes: [1245, 1245, 1245], seconds: 0.6, gain: 0.6 },
        { type: "square", notes: [2490, 2490, 2490], seconds: 0.6, gain: 0.08, filter: { type: "lowpass", from: 4000, to: 4000 } },
      ],
    },
    // Something falling from above: a cartoon whistle sliding down.
    bounceDropWhistle: {
      layers: [{ type: "sine", from: 1900, to: 520, seconds: 0.9, attack: 0.05, gain: 0.5, vibrato: { rate: 5, depth: 0.01 } }],
    },
    // Down a hole: a long, wobbling fall away.
    bounceFallAway: {
      layers: [
        { type: "square", from: 1100, to: 140, seconds: 1, gain: 0.35, vibrato: { rate: 10, depth: 0.04 }, filter: { type: "lowpass", from: 2400, to: 500 } },
        { type: "pink", seconds: 0.8, attack: 0.2, gain: 0.3, filter: { type: "bandpass", from: 1600, to: 400, q: 1.4 } },
      ],
    },
    // A sprinkler's jet across your car: a wet hiss with a patter.
    bounceSpray: {
      layers: [
        { type: "noise", seconds: 0.3, attack: 0.02, filter: { type: "bandpass", from: 4200, to: 2600, q: 1.2 } },
        { type: "pink", seconds: 0.22, delay: 0.05, gain: 0.4, filter: { type: "highpass", from: 2000, to: 1400 } },
      ],
    },
    // A toy horn's "beep beep" as a stage line goes by.
    bounceBeepBeep: {
      layers: [
        { type: "square", notes: [587, 587], seconds: 0.26, gain: 0.45, filter: { type: "lowpass", from: 1800, to: 1800 } },
        { type: "square", notes: [740, 740], seconds: 0.26, gain: 0.35, filter: { type: "lowpass", from: 1800, to: 1800 } },
      ],
    },
  },
  hums: {
    // Your toy car's motor: a buzzy little electric motor with a hint of
    // gear whine, pitched by your speed.
    bounceMotor: { parts: [{ type: "square", freq: 104 }, { type: "square", freq: 104.9, gain: 0.5 }, { type: "sawtooth", freq: 312, gain: 0.12 }], noise: { color: "brown", gain: 0.12 }, filter: { type: "lowpass", freq: 900, q: 2.5, follow: 1 }, pulse: { rate: 22, depth: 0.35 }, peak: 0.035 },
    // The Monster truck's big engine: a low, lumpy V8 burble.
    bounceMonster: { parts: [{ type: "sawtooth", freq: 40 }, { type: "sawtooth", freq: 40.6, gain: 0.7 }, { type: "square", freq: 20, gain: 0.6 }], noise: { color: "brown", gain: 0.3 }, filter: { type: "lowpass", freq: 300, q: 5, follow: 0.9 }, pulse: { rate: 8, depth: 0.55 }, peak: 0.06 },
    // Crumbling road falling away behind you: a low, gritty rumble.
    bounceCrumbling: { noise: { color: "brown", gain: 1 }, parts: [{ type: "sine", freq: 48, gain: 0.4 }], filter: { type: "lowpass", freq: 380, q: 1, follow: 0.6 }, pulse: { rate: 7, depth: 0.6 }, peak: 0.045 },
    // A sprinkler nearby: a soft, ticking hiss of water.
    bounceSprinkler: { noise: { color: "noise", gain: 1 }, filter: { type: "bandpass", freq: 3600, q: 1.2, follow: 0.5 }, pulse: { rate: 9, depth: 0.5 }, peak: 0.02 },
  },
};
