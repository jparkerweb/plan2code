// Plan2Code Web Console - fuse: its own sound effects, merged into tones.js beside the shared kit; defines only.
//
// `tones` are one-shot sounds played with tone(name, level, pitch); `hums` are
// held sounds kept going with hum(id, name, level, pitch). Both take the shapes
// tones.js documents, as plain objects (tones.js freezes them). A name may be
// defined only once across tones.js and every game's file. No imports.

export default {
  tones: {
    // A bomb lit: a match struck (a scratch of bright noise), then the fuse
    // catching with a hiss that swells.
    fuseStrike: {
      layers: [
        { type: "noise", seconds: 0.07, gain: 0.8, filter: { type: "bandpass", from: 4200, to: 2600, q: 2 } },
        { type: "pink", seconds: 0.4, delay: 0.05, attack: 0.06, gain: 0.6, filter: { type: "highpass", from: 2400, to: 5200 } },
        { type: "sine", from: 260, to: 520, seconds: 0.18, delay: 0.04, gain: 0.25 },
      ],
    },
    // The go: a referee's whistle, a trilling high sine with a breath of air.
    fuseWhistle: {
      layers: [
        { type: "sine", from: 2550, to: 2650, seconds: 0.34, attack: 0.02, gain: 0.55, vibrato: { rate: 34, depth: 0.04 } },
        { type: "noise", seconds: 0.34, attack: 0.02, gain: 0.15, filter: { type: "bandpass", from: 2600, to: 2600, q: 3 } },
      ],
    },
    // A footstep: a soft scuff and a little low knock. The game plays it a
    // stride apart while you run, quicker the faster, and nudges its pitch.
    fuseStep: {
      layers: [
        { type: "pink", seconds: 0.05, gain: 0.5, filter: { type: "lowpass", from: 1400, to: 300 } },
        { type: "sine", from: 150, to: 85, seconds: 0.045, gain: 0.45 },
      ],
    },
    // Onto ice: a skate's swish, bright noise sweeping down.
    fuseSkate: {
      layers: [{ type: "noise", seconds: 0.22, attack: 0.03, gain: 0.55, filter: { type: "bandpass", from: 3400, to: 1700, q: 2.5 } }],
    },
    // Your dash: a burst of air and a low kick off the floor.
    fuseDash: {
      layers: [
        { type: "pink", seconds: 0.18, attack: 0.02, filter: { type: "bandpass", from: 600, to: 2600, q: 1.2 } },
        { type: "sine", from: 120, to: 60, seconds: 0.08, gain: 0.5 },
      ],
    },
    // The bomb thrown on: a short rising whoosh under the pop.
    fuseToss: {
      layers: [{ type: "pink", seconds: 0.15, attack: 0.03, filter: { type: "bandpass", from: 700, to: 2600, q: 1.4 } }],
    },
    // The bomb landing in your hands: a heavy, dull thud and a rattle.
    fuseCatch: {
      layers: [
        { type: "sine", from: 190, to: 70, seconds: 0.13 },
        { type: "brown", seconds: 0.1, gain: 0.7, filter: { type: "lowpass", from: 900, to: 180 } },
        { type: "triangle", notes: [520, 440, 500], seconds: 0.09, delay: 0.03, gain: 0.2 },
      ],
    },
    // A rival blown out: a drooping four-note stinger.
    fuseOut: {
      layers: [
        { type: "triangle", notes: [523, 440, 349, 262], seconds: 0.48, delay: 0.12, gain: 0.55 },
        { type: "sawtooth", from: 196, to: 98, seconds: 0.45, delay: 0.12, gain: 0.15, filter: { type: "lowpass", from: 900, to: 300 } },
      ],
    },
    // The crowd's sharp "oh!": an intake of breath swelling up.
    fuseGasp: {
      layers: [
        { type: "pink", seconds: 0.4, attack: 0.08, filter: { type: "bandpass", from: 650, to: 1500, q: 1.1 } },
        { type: "noise", seconds: 0.3, attack: 0.08, gain: 0.15, filter: { type: "highpass", from: 2800, to: 3400 } },
      ],
    },
    // Off the roof: a slide whistle all the way down, then the bump below.
    fuseRoofFall: {
      layers: [
        { type: "sine", from: 1500, to: 170, seconds: 0.62, gain: 0.6, vibrato: { rate: 7, depth: 0.03 } },
        { type: "sine", from: 95, to: 40, seconds: 0.2, delay: 0.66 },
        { type: "brown", seconds: 0.2, delay: 0.66, gain: 0.8, filter: { type: "lowpass", from: 700, to: 120 } },
      ],
    },
    // Freeze taken: icicles tinkling down and a cold shimmer.
    fuseFreeze: {
      layers: [
        { type: "triangle", notes: [2093, 1760, 1568, 1319, 1047], seconds: 0.42, gain: 0.5 },
        { type: "noise", seconds: 0.45, attack: 0.04, gain: 0.2, filter: { type: "highpass", from: 6000, to: 4000 } },
      ],
    },
    // Freeze over: the fuses catch again, a hiss rising back in.
    fuseThaw: {
      layers: [
        { type: "noise", seconds: 0.32, attack: 0.12, gain: 0.5, filter: { type: "highpass", from: 2000, to: 5600 } },
        { type: "sine", from: 300, to: 900, seconds: 0.22, gain: 0.2 },
      ],
    },
    // Sneakers on: a quick squeaky run up.
    fuseSneakers: {
      layers: [
        { type: "sine", notes: [880, 1175, 1480, 1760], seconds: 0.2, gain: 0.6 },
        { type: "sine", from: 1900, to: 2500, seconds: 0.05, delay: 0.2, gain: 0.4 },
      ],
    },
    // Extra Fuse: a longer hiss and a chime climbing an octave.
    fuseExtra: {
      layers: [
        { type: "noise", seconds: 0.3, attack: 0.05, gain: 0.3, filter: { type: "highpass", from: 3800, to: 4800 } },
        { type: "triangle", from: 523, to: 1047, seconds: 0.3, gain: 0.6 },
      ],
    },
    // A pickup turning up on the floor: a soft two-note twinkle.
    fusePickup: {
      layers: [{ type: "sine", notes: [1319, 1760], seconds: 0.14, gain: 0.5 }],
    },
    // A dash filled back up: a small bright click up.
    fuseRecharge: {
      layers: [{ type: "triangle", from: 700, to: 1050, seconds: 0.07, gain: 0.5 }],
    },
    // A heartbeat for the bomb in your hands near its end: a deep lub-dub.
    fusePulse: {
      layers: [
        { type: "sine", from: 80, to: 46, seconds: 0.11 },
        { type: "sine", from: 72, to: 42, seconds: 0.12, delay: 0.16, gain: 0.75 },
        { type: "brown", seconds: 0.08, gain: 0.3, filter: { type: "lowpass", from: 300, to: 120 } },
      ],
    },
    // The venues' odd noises, now and then: the Break Room's vending machine
    // dropping a can, the Open Plan's desk phone, the Server Room's beeps,
    // the Ice Machine dropping cubes and the Blackout's dying lights.
    fuseVend: {
      layers: [
        { type: "brown", seconds: 0.14, filter: { type: "lowpass", from: 900, to: 150 } },
        { type: "triangle", from: 900, to: 760, seconds: 0.1, delay: 0.12, gain: 0.25 },
      ],
    },
    fusePhone: {
      layers: [
        { type: "sine", notes: [1180, 1480, 1180, 1480, 1180, 1480], seconds: 0.36, gain: 0.35 },
        { type: "sine", notes: [1180, 1480, 1180, 1480, 1180, 1480], seconds: 0.36, delay: 0.5, gain: 0.3 },
      ],
    },
    fuseBeep: {
      layers: [
        { type: "sine", from: 1760, to: 1760, seconds: 0.06, gain: 0.4 },
        { type: "sine", from: 2349, to: 2349, seconds: 0.06, delay: 0.12, gain: 0.35 },
      ],
    },
    fuseCubes: {
      layers: [0, 0.06, 0.1, 0.17, 0.25].map((delay, i) => ({ type: "triangle", from: 2600 - i * 180, to: 2200 - i * 150, seconds: 0.04, delay, gain: 0.35 + (i % 2) * 0.15 })),
    },
    fuseFlicker: {
      layers: [0, 0.07, 0.19, 0.24].map((delay) => ({ type: "square", from: 120, to: 120, seconds: 0.05, delay, gain: 0.3, filter: { type: "bandpass", from: 1200, to: 1000, q: 2 } })),
    },
  },
  hums: {
    // Each venue's room tone under the play. The Break Room: a fridge's low
    // electric hum.
    fuseFridge: { parts: [{ type: "sine", freq: 60 }, { type: "sine", freq: 120, gain: 0.4 }, { type: "triangle", freq: 180, gain: 0.1 }], noise: { color: "pink", gain: 0.1 }, filter: { type: "lowpass", freq: 420, q: 1, follow: 0.5 }, pulse: { rate: 0.2, depth: 0.2 }, peak: 0.025 },
    // The Open Plan: office murmur over the air conditioning.
    fuseOffice: { parts: [{ type: "sine", freq: 98, gain: 0.25 }], noise: { color: "pink", gain: 1 }, filter: { type: "bandpass", freq: 900, q: 0.7, follow: 0.6 }, pulse: { rate: 0.6, depth: 0.45 }, peak: 0.02 },
    // The Server Room: fans whirring with a mains buzz under them.
    fuseServers: { parts: [{ type: "sawtooth", freq: 120, gain: 0.12 }, { type: "sine", freq: 240, gain: 0.1 }], noise: { color: "pink", gain: 1 }, filter: { type: "bandpass", freq: 1700, q: 1.4, follow: 0.7 }, pulse: { rate: 7, depth: 0.15 }, peak: 0.03 },
    // The Ice Machine: a compressor chugging low.
    fuseCompressor: { parts: [{ type: "sawtooth", freq: 50 }, { type: "sawtooth", freq: 50.6, gain: 0.7 }], noise: { color: "brown", gain: 0.3 }, filter: { type: "lowpass", freq: 230, q: 2, follow: 0.6 }, pulse: { rate: 3, depth: 0.3 }, peak: 0.035 },
    // The Conveyor Hall: the belts' motors and rollers clattering.
    fuseConveyor: { parts: [{ type: "square", freq: 45, gain: 0.4 }, { type: "sawtooth", freq: 90.5, gain: 0.2 }], noise: { color: "brown", gain: 1 }, filter: { type: "lowpass", freq: 520, q: 1, follow: 0.7 }, pulse: { rate: 5, depth: 0.55 }, peak: 0.045 },
    // The Blackout: a dead building's low, uneasy drone.
    fuseDark: { parts: [{ type: "sine", freq: 50 }, { type: "sine", freq: 50.7 }, { type: "triangle", freq: 75, gain: 0.3 }], filter: { type: "lowpass", freq: 320, q: 1, follow: 0.5 }, pulse: { rate: 0.25, depth: 0.6 }, peak: 0.04 },
    // Feet sliding on ice: a soft hiss the game turns up with your speed.
    fuseSlide: { noise: { color: "noise", gain: 1 }, filter: { type: "bandpass", freq: 2400, q: 2, follow: 1 }, peak: 0.025 },
    // Every fuse frozen: a cold, glassy shimmer while the Freeze holds.
    fuseChill: { parts: [{ type: "sine", freq: 1568, gain: 0.3 }, { type: "sine", freq: 2093, gain: 0.2 }], noise: { color: "noise", gain: 0.3 }, filter: { type: "highpass", freq: 1200, q: 0.7, follow: 1 }, pulse: { rate: 6, depth: 0.5 }, peak: 0.022 },
  },
};
