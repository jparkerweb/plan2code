// Plan2Code Web Console - bumper: its own sound effects, merged into tones.js beside the shared kit; defines only.
//
// `tones` are one-shot sounds played with tone(name, level, pitch); `hums` are
// held sounds kept going with hum(id, name, level, pitch). Both take the shapes
// tones.js documents, as plain objects (tones.js freezes them). A name may be
// defined only once across tones.js and every game's file. No imports.

export default {
  tones: {
    // The arena's starting buzzer as the heat goes: two detuned squares
    // through a lowpass, the fairground horn over the rink.
    bumperBuzzer: {
      layers: [
        { type: "square", from: 233, to: 230, seconds: 0.42, gain: 0.5, filter: { type: "lowpass", from: 1400, to: 900 } },
        { type: "square", from: 236, to: 233, seconds: 0.42, gain: 0.45, filter: { type: "lowpass", from: 1400, to: 900 } },
        { type: "sawtooth", from: 117, to: 116, seconds: 0.42, gain: 0.3, filter: { type: "lowpass", from: 600, to: 400 } },
      ],
    },
    // Rubber on rubber: a soft low thump with a little boing in the bumper
    // skirt, laid under `ram` on every hit (the game pitches it with the hit).
    bumperBonk: {
      layers: [
        { type: "sine", from: 150, to: 62, seconds: 0.16 },
        { type: "brown", seconds: 0.1, gain: 0.55, filter: { type: "lowpass", from: 700, to: 180 } },
        { type: "triangle", from: 310, to: 240, seconds: 0.12, gain: 0.25, vibrato: { rate: 28, depth: 0.04 } },
      ],
    },
    // A pinball bumper firing a car off it: a bright electric ding and a
    // click of the solenoid.
    bumperPing: {
      layers: [
        { type: "triangle", from: 1568, to: 1560, seconds: 0.22, gain: 0.55 },
        { type: "sine", from: 2093, to: 2090, seconds: 0.16, gain: 0.3 },
        { type: "noise", seconds: 0.03, gain: 0.4, filter: { type: "bandpass", from: 2600, to: 2200, q: 2 } },
      ],
    },
    // A dash charge banked: a capacitor whining up to full.
    bumperCharge: {
      layers: [
        { type: "sine", from: 500, to: 2000, seconds: 0.24, gain: 0.6 },
        { type: "triangle", from: 1000, to: 4000, seconds: 0.24, gain: 0.2 },
      ],
    },
    // A rival winding up a dash: its motor's whine climbing, wobbling as it
    // strains, so you hear the charge coming.
    bumperWindup: {
      layers: [
        { type: "sawtooth", from: 70, to: 240, seconds: 0.4, attack: 0.05, gain: 0.5, vibrato: { rate: 14, depth: 0.03 }, filter: { type: "lowpass", from: 300, to: 1600, q: 3 } },
        { type: "sine", from: 500, to: 1400, seconds: 0.4, attack: 0.1, gain: 0.25 },
      ],
    },
    // A car flying off the edge: the rush of air as it goes over, then a
    // distant thud as it lands somewhere below the rink.
    bumperOffEdge: {
      layers: [
        { type: "pink", seconds: 0.36, attack: 0.04, filter: { type: "bandpass", from: 2200, to: 500, q: 1.4 } },
        { type: "sine", from: 600, to: 180, seconds: 0.36, gain: 0.25 },
        { type: "brown", seconds: 0.22, delay: 0.42, gain: 0.7, filter: { type: "lowpass", from: 420, to: 120 } },
        { type: "sine", from: 90, to: 42, seconds: 0.18, delay: 0.42, gain: 0.6 },
      ],
    },
    // A car down an open hole: a falling cartoon whistle, then a muffled
    // bump from far below.
    bumperHoleDrop: {
      layers: [
        { type: "sine", from: 1100, to: 180, seconds: 0.55, gain: 0.5, vibrato: { rate: 9, depth: 0.025 } },
        { type: "brown", seconds: 0.18, delay: 0.62, gain: 0.6, filter: { type: "lowpass", from: 300, to: 90 } },
        { type: "sine", from: 70, to: 40, seconds: 0.15, delay: 0.62, gain: 0.5 },
      ],
    },
    // A trapdoor in the floor dropping open: a latch's clunk and the air
    // falling out under it.
    bumperTrapdoor: {
      layers: [
        { type: "square", from: 140, to: 70, seconds: 0.1, gain: 0.45, filter: { type: "lowpass", from: 900, to: 300 } },
        { type: "noise", seconds: 0.03, gain: 0.35, filter: { type: "bandpass", from: 1800, to: 1400, q: 2 } },
        { type: "pink", seconds: 0.32, delay: 0.04, gain: 0.45, filter: { type: "lowpass", from: 900, to: 160 } },
      ],
    },
    // The crowd's sharp intake of breath as a car teeters on the edge.
    bumperGasp: {
      layers: [{ type: "pink", seconds: 0.42, attack: 0.05, gain: 0.8, filter: { type: "bandpass", from: 700, to: 1700, q: 1.1 } }],
    },
    // A new arena announced: a bright fairground sting over a bass step.
    bumperArena: {
      layers: [
        { type: "triangle", notes: [523, 659, 784, 659, 1047], seconds: 0.6, gain: 0.7 },
        { type: "square", notes: [262, 330, 392, 330, 523], seconds: 0.6, gain: 0.25, filter: { type: "lowpass", from: 2200, to: 2200 } },
        { type: "sine", notes: [131, 131, 196, 196, 262], seconds: 0.6, gain: 0.5 },
      ],
    },
    // The magnet flipping between pull and push: a deep electric vwoom.
    bumperMagnet: {
      layers: [
        { type: "sawtooth", from: 55, to: 110, seconds: 0.45, attack: 0.05, gain: 0.5, vibrato: { rate: 7, depth: 0.08 }, filter: { type: "lowpass", from: 300, to: 1200, q: 4 } },
        { type: "sine", from: 110, to: 55, seconds: 0.45, gain: 0.5 },
      ],
    },
    // Heavy taken: a weight dropping into the chassis.
    bumperHeavy: {
      layers: [
        { type: "square", from: 110, to: 55, seconds: 0.2, gain: 0.45, filter: { type: "lowpass", from: 700, to: 200 } },
        { type: "brown", seconds: 0.16, gain: 0.6, filter: { type: "lowpass", from: 500, to: 120 } },
        { type: "triangle", from: 880, to: 860, seconds: 0.12, delay: 0.05, gain: 0.2 },
      ],
    },
    // Grow taken: the car inflating, a wobbly rise.
    bumperGrow: {
      layers: [
        { type: "triangle", from: 180, to: 720, seconds: 0.42, vibrato: { rate: 12, depth: 0.05 } },
        { type: "pink", seconds: 0.36, attack: 0.1, gain: 0.25, filter: { type: "bandpass", from: 500, to: 1500, q: 2 } },
      ],
    },
    // Slick taken: an oily squelch.
    bumperSlick: {
      layers: [
        { type: "pink", seconds: 0.24, gain: 0.7, filter: { type: "lowpass", from: 2200, to: 300, q: 6 } },
        { type: "sine", from: 520, to: 180, seconds: 0.2, gain: 0.45, vibrato: { rate: 18, depth: 0.06 } },
      ],
    },
  },
  hums: {
    // Your bumper car's motor: a buzzy electric drone with the pole's whine
    // on top, pitched up with your speed.
    bumperMotor: { parts: [{ type: "sawtooth", freq: 55 }, { type: "sawtooth", freq: 55.4, gain: 0.6 }, { type: "sine", freq: 110, gain: 0.45 }, { type: "sine", freq: 880, gain: 0.06 }], filter: { type: "lowpass", freq: 620, q: 2, follow: 0.8 }, pulse: { rate: 7, depth: 0.12 }, peak: 0.045 },
    // The nearest rival's motor: lower and grittier than yours, louder as it
    // closes in, its whine climbing while it winds up a dash.
    bumperRival: { parts: [{ type: "sawtooth", freq: 47 }, { type: "square", freq: 70.5, gain: 0.3 }, { type: "sine", freq: 640, gain: 0.07 }], filter: { type: "lowpass", freq: 480, q: 3, follow: 0.8 }, pulse: { rate: 5, depth: 0.2 }, peak: 0.035 },
    // The ring's magnet under the floor: a slow electric throb, higher while
    // it pushes than while it pulls.
    bumperField: { parts: [{ type: "sine", freq: 50 }, { type: "sine", freq: 50.7 }, { type: "triangle", freq: 100, gain: 0.3 }], filter: { type: "lowpass", freq: 320, q: 1, follow: 0.6 }, pulse: { rate: 2, depth: 0.5 }, peak: 0.03 },
  },
};
