// Plan2Code Web Console - flock: its own sound effects, merged into tones.js beside the shared kit; defines only.
//
// `tones` are one-shot sounds played with tone(name, level, pitch); `hums` are
// held sounds kept going with hum(id, name, level, pitch). Both take the shapes
// tones.js documents, as plain objects (tones.js freezes them). A name may be
// defined only once across tones.js and every game's file. No imports.

export default {
  // The music: recorded songs, each a name to an mp3 the server serves (listed in
  // SERVABLE), played by music.js one after another in the order flock.js deals them.
  songs: {
    flockSong1: "activities/flock-dash/1.mp3",
    flockSong2: "activities/flock-dash/2.mp3",
    flockSong3: "activities/flock-dash/3.mp3",
    flockSong4: "activities/flock-dash/4.mp3",
    flockSong5: "activities/flock-dash/5.mp3",
  },
  tones: {
    // A stray picked up: a short, bright bird chirp (the game raises its pitch
    // with the combo, so it stays soft and under a tenth of a second).
    flockChirp: {
      layers: [
        { type: "triangle", from: 1800, to: 2600, seconds: 0.07, gain: 0.25 },
        { type: "sine", from: 2400, to: 3200, seconds: 0.05, gain: 0.12 },
      ],
    },
    // A scattered bird picked back up: a softer, lower two-note chirp.
    flockRejoin: {
      layers: [{ type: "triangle", notes: [1047, 1319], seconds: 0.1, gain: 0.22 }],
    },
    // The line snapping: a plucked tone falling away, and a flutter of bandpassed noise.
    flockSnap: {
      layers: [
        { type: "triangle", from: 660, to: 220, seconds: 0.25, gain: 0.45, filter: { type: "lowpass", from: 2400, to: 500 } },
        { type: "noise", seconds: 0.03, gain: 0.3, filter: { type: "bandpass", from: 2500, to: 1800, q: 3 } },
        { type: "noise", seconds: 0.03, delay: 0.05, gain: 0.25, filter: { type: "bandpass", from: 2500, to: 1800, q: 3 } },
        { type: "noise", seconds: 0.03, delay: 0.1, gain: 0.2, filter: { type: "bandpass", from: 2500, to: 1800, q: 3 } },
      ],
    },
    // The leader hit: a thump and a squawk.
    flockHit: {
      layers: [
        { type: "sine", from: 150, to: 50, seconds: 0.15, gain: 0.8 },
        { type: "square", from: 500, to: 220, seconds: 0.15, gain: 0.3, filter: { type: "lowpass", from: 2000, to: 800 } },
      ],
    },
    // A shield soaking a hit: a bright metallic ping over a soft whoosh.
    flockShield: {
      layers: [
        { type: "sine", from: 2400, to: 2400, seconds: 0.35, gain: 0.3 },
        { type: "triangle", from: 3136, to: 3136, seconds: 0.25, delay: 0.02, gain: 0.15 },
        { type: "pink", seconds: 0.3, attack: 0.1, gain: 0.2, filter: { type: "bandpass", from: 700, to: 2600, q: 1.4 } },
      ],
    },
    // A crate opened: a sparkling rise.
    flockPower: {
      layers: [
        { type: "triangle", notes: [1047, 1319, 1568, 2093, 2637], seconds: 0.4, gain: 0.4 },
        { type: "sine", from: 2000, to: 4000, seconds: 0.4, gain: 0.15 },
      ],
    },
    // The gust warning: a rising whoosh of pink noise.
    flockGust: {
      layers: [{ type: "pink", seconds: 0.6, attack: 0.3, gain: 0.5, filter: { type: "bandpass", from: 200, to: 1400, q: 1.2 } }],
    },
    // The storm warning: a low crackle of noise.
    flockThunder: {
      layers: [
        { type: "brown", seconds: 0.5, gain: 0.6, filter: { type: "lowpass", from: 260, to: 140 } },
        { type: "noise", seconds: 0.04, delay: 0.1, gain: 0.3, filter: { type: "bandpass", from: 1200, to: 900, q: 2 } },
        { type: "noise", seconds: 0.04, delay: 0.22, gain: 0.25, filter: { type: "bandpass", from: 1200, to: 900, q: 2 } },
        { type: "noise", seconds: 0.04, delay: 0.32, gain: 0.3, filter: { type: "bandpass", from: 1200, to: 900, q: 2 } },
      ],
    },
    // Lightning striking: a sharp white crack with a low boom under it.
    flockStrike: {
      layers: [
        { type: "noise", seconds: 0.12, gain: 0.6, filter: { type: "highpass", from: 4000, to: 1500 } },
        { type: "sine", from: 90, to: 35, seconds: 0.5, gain: 0.8 },
        { type: "brown", seconds: 0.4, gain: 0.4, filter: { type: "lowpass", from: 300, to: 80 } },
      ],
    },
    // A portal passed: a whooshing shimmer.
    flockPortal: {
      layers: [
        { type: "sine", from: 500, to: 1500, seconds: 0.7, attack: 0.2, gain: 0.3, vibrato: { rate: 14, depth: 0.04 } },
        { type: "pink", seconds: 0.7, attack: 0.2, gain: 0.3, filter: { type: "bandpass", from: 400, to: 3000, q: 2 } },
      ],
    },
    // The V formed: a rising arpeggio of triangle notes.
    flockV: {
      layers: [{ type: "triangle", notes: [523, 659, 784, 1047], seconds: 0.4, gain: 0.5 }],
    },
    // A flawless stage: a bright little fanfare.
    flockFlawless: {
      layers: [
        { type: "triangle", notes: [784, 784, 988, 1319], seconds: 0.44, gain: 0.5 },
        { type: "square", notes: [392, 392, 494, 659], seconds: 0.44, gain: 0.25, filter: { type: "lowpass", from: 2400, to: 2400 } },
      ],
    },
    // A new stage: a clean four-note climb.
    flockStage: {
      layers: [
        { type: "triangle", notes: [523, 659, 784, 1047], seconds: 0.3, gain: 0.45 },
        { type: "square", notes: [262, 330, 392, 523], seconds: 0.3, gain: 0.15, filter: { type: "lowpass", from: 1600, to: 1600 } },
      ],
    },
    // A new best: a short sparkling run.
    flockBest: {
      layers: [
        { type: "triangle", notes: [1568, 2093, 2637, 3136, 2637, 3136], seconds: 0.3, gain: 0.4 },
        { type: "noise", seconds: 0.2, gain: 0.1, filter: { type: "highpass", from: 6000, to: 8000 } },
      ],
    },
    // Game over: a falling run.
    flockOver: {
      layers: [
        { type: "triangle", notes: [523, 466, 392, 330, 262], seconds: 0.6, gain: 0.5 },
        { type: "sawtooth", notes: [262, 233, 196, 165], seconds: 0.6, gain: 0.2, filter: { type: "lowpass", from: 900, to: 500 } },
      ],
    },
    // The run won: a longer, happy fanfare.
    flockWin: {
      layers: [
        { type: "triangle", notes: [523, 659, 784, 659, 784, 1047], seconds: 0.9, gain: 0.5 },
        { type: "square", notes: [262, 330, 392, 330, 392, 523], seconds: 0.9, gain: 0.25, filter: { type: "lowpass", from: 2400, to: 2400 } },
      ],
    },
  },
  hums: {
    // The wind past the flock: soft filtered pink noise; pitch follows flight speed.
    // Kept under the music, so it stays quiet.
    flockWind: {
      noise: { color: "pink", gain: 1 },
      filter: { type: "bandpass", freq: 500, q: 0.8, follow: 1 },
      pulse: { rate: 0.3, depth: 0.3 },
      peak: 0.015,
    },
    // Riding a slipstream: a faster, brighter rush with a light pulse.
    flockStream: {
      noise: { color: "pink", gain: 1 },
      filter: { type: "bandpass", freq: 1400, q: 1.2, follow: 1 },
      pulse: { rate: 6, depth: 0.4 },
      peak: 0.02,
    },
  },
};
