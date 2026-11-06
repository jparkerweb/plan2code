// Plan2Code Web Console - bugs: its own sound effects, merged into tones.js beside the shared kit; defines only.
//
// `tones` are one-shot sounds played with tone(name, level, pitch); `hums` are
// held sounds kept going with hum(id, name, level, pitch). Both take the shapes
// tones.js documents, as plain objects (tones.js freezes them). A name may be
// defined only once across tones.js and every game's file. No imports.

export default {
  tones: {
    // Your blaster: a soft, short triangle chirp with a breath of air, since
    // it repeats up to twelve times a second while fire is held.
    bugsShot: {
      layers: [
        { type: "triangle", from: 1500, to: 720, seconds: 0.05, gain: 0.6 },
        { type: "noise", seconds: 0.03, gain: 0.18, filter: { type: "highpass", from: 5200, to: 4200 } },
      ],
    },
    // A beetle's shell cracking open: a dry snap over a low thunk.
    bugsCrackShell: {
      layers: [
        { type: "noise", seconds: 0.09, filter: { type: "bandpass", from: 2600, to: 900, q: 2 } },
        { type: "square", from: 260, to: 90, seconds: 0.12, gain: 0.4, filter: { type: "lowpass", from: 1400, to: 300 } },
        { type: "brown", seconds: 0.1, delay: 0.02, gain: 0.5, filter: { type: "lowpass", from: 600, to: 180 } },
      ],
    },
    // A race condition popped mid-buzz: its wings' whine dropping away.
    bugsBuzzPop: {
      layers: [
        { type: "sawtooth", from: 900, to: 180, seconds: 0.16, gain: 0.45, vibrato: { rate: 42, depth: 0.08 }, filter: { type: "lowpass", from: 3200, to: 600 } },
        { type: "pink", seconds: 0.1, gain: 0.5, filter: { type: "bandpass", from: 1600, to: 500, q: 1.5 } },
      ],
    },
    // A null pointer dereferenced: a glitchy stutter of bits.
    bugsGlitch: {
      layers: [
        { type: "square", notes: [1800, 600, 2400, 300], seconds: 0.12, gain: 0.35, filter: { type: "lowpass", from: 4000, to: 2000 } },
        { type: "noise", seconds: 0.05, delay: 0.06, gain: 0.3, filter: { type: "bandpass", from: 3000, to: 1200, q: 2 } },
      ],
    },
    // A firewall coming down: bricks crashing, a deep thump, a ring of metal.
    bugsWallBreak: {
      layers: [
        { type: "noise", seconds: 0.3, filter: { type: "bandpass", from: 1400, to: 280, q: 1 } },
        { type: "square", from: 140, to: 50, seconds: 0.22, gain: 0.5, filter: { type: "lowpass", from: 900, to: 200 } },
        { type: "triangle", from: 940, to: 900, seconds: 0.2, delay: 0.03, gain: 0.25 },
      ],
    },
    // A shot glancing off armor that holds (a beetle, an exception): a tink.
    bugsDent: {
      layers: [
        { type: "triangle", from: 720, to: 520, seconds: 0.06, gain: 0.6 },
        { type: "noise", seconds: 0.03, gain: 0.35, filter: { type: "bandpass", from: 2800, to: 2400, q: 3 } },
      ],
    },
    // A beetle splitting in two: a crack, then two little chirps flying apart.
    bugsSplit: {
      layers: [
        { type: "noise", seconds: 0.08, filter: { type: "bandpass", from: 1800, to: 600, q: 1.6 } },
        { type: "triangle", from: 600, to: 1200, seconds: 0.06, delay: 0.04, gain: 0.5 },
        { type: "triangle", from: 760, to: 1500, seconds: 0.06, delay: 0.1, gain: 0.5 },
      ],
    },
    // A shot ricocheting off a shielded boss: a bright, wobbly ping.
    bugsRicochet: {
      layers: [
        { type: "triangle", from: 2300, to: 3200, seconds: 0.12, gain: 0.5, vibrato: { rate: 30, depth: 0.03 } },
        { type: "square", from: 1800, to: 1750, seconds: 0.04, gain: 0.25, filter: { type: "lowpass", from: 4000, to: 2500 } },
      ],
    },
    // A bug peeling off the formation to dive: the classic warbling cry.
    bugsDiveCry: {
      layers: [
        { type: "square", from: 1250, to: 480, seconds: 0.32, gain: 0.3, vibrato: { rate: 14, depth: 0.06 }, filter: { type: "lowpass", from: 2600, to: 1200 } },
        { type: "triangle", from: 1250, to: 480, seconds: 0.32, gain: 0.45, vibrato: { rate: 14, depth: 0.06 } },
      ],
    },
    // A bug spitting a bomb: a wet little "ptoo".
    bugsSpit: {
      layers: [
        { type: "pink", seconds: 0.08, filter: { type: "bandpass", from: 900, to: 2200, q: 3 } },
        { type: "sine", from: 520, to: 220, seconds: 0.08, gain: 0.5 },
      ],
    },
    // A boss lobbing its volley: a heavy, low gloop.
    bugsBossSpit: {
      layers: [
        { type: "brown", seconds: 0.18, filter: { type: "lowpass", from: 700, to: 200 } },
        { type: "sawtooth", from: 170, to: 80, seconds: 0.16, gain: 0.4, filter: { type: "lowpass", from: 900, to: 300 } },
      ],
    },
    // A boss arriving at its post: a growling roar over the floor shaking.
    bugsBossRoar: {
      layers: [
        { type: "sawtooth", from: 95, to: 60, seconds: 0.75, attack: 0.08, gain: 0.6, vibrato: { rate: 9, depth: 0.1 }, filter: { type: "lowpass", from: 900, to: 300, q: 2 } },
        { type: "square", from: 47, to: 40, seconds: 0.75, gain: 0.35, filter: { type: "lowpass", from: 400, to: 250 } },
        { type: "brown", seconds: 0.65, attack: 0.05, gain: 0.6, filter: { type: "lowpass", from: 500, to: 140 } },
      ],
    },
    // A shot landing on a boss: a meaty thwack, pitched up as it weakens.
    bugsBossHit: {
      layers: [
        { type: "square", from: 240, to: 150, seconds: 0.07, gain: 0.45, filter: { type: "lowpass", from: 1600, to: 400 } },
        { type: "brown", seconds: 0.08, gain: 0.5, filter: { type: "lowpass", from: 900, to: 250 } },
      ],
    },
    // A shield soaking a hit: a springy bounce off the bubble.
    bugsShieldBounce: {
      layers: [
        { type: "triangle", from: 400, to: 1600, seconds: 0.18, gain: 0.6, vibrato: { rate: 22, depth: 0.04 } },
        { type: "noise", seconds: 0.1, gain: 0.25, filter: { type: "bandpass", from: 3000, to: 4500, q: 2 } },
      ],
    },
    // Slow-mo taken: the world winding down like a tape slowing.
    bugsSlowDown: {
      layers: [
        { type: "sawtooth", from: 620, to: 150, seconds: 0.6, gain: 0.35, filter: { type: "lowpass", from: 2400, to: 500 } },
        { type: "sine", from: 820, to: 200, seconds: 0.6, gain: 0.5, vibrato: { rate: 6, depth: 0.04 } },
      ],
    },
    // Magnet taken: a rising, humming charge-up.
    bugsMagnetOn: {
      layers: [
        { type: "sine", from: 200, to: 820, seconds: 0.32, vibrato: { rate: 30, depth: 0.08 } },
        { type: "square", from: 100, to: 410, seconds: 0.32, gain: 0.25, filter: { type: "lowpass", from: 900, to: 1800 } },
      ],
    },
    // A timed power-up about to run out: a soft two-note tick (the game
    // pitches it up for each of the last three).
    bugsExpiring: { type: "triangle", notes: [1047, 784], seconds: 0.1 },
    // A new wave flying in: a bright five-note climb.
    bugsWaveIn: {
      layers: [
        { type: "triangle", notes: [392, 523, 659, 784, 1047], seconds: 0.4, gain: 0.8 },
        { type: "square", notes: [196, 262, 330, 392, 523], seconds: 0.4, gain: 0.25, filter: { type: "lowpass", from: 1800, to: 1800 } },
      ],
    },
    // A wave bringing a kind of bug never seen before: a curious sting.
    bugsNewBug: {
      layers: [
        { type: "square", notes: [659, 622, 659, 988], seconds: 0.36, gain: 0.3, filter: { type: "lowpass", from: 2400, to: 2400 } },
        { type: "triangle", notes: [330, 311, 330, 494], seconds: 0.36, gain: 0.6 },
      ],
    },
    // Your ship warping back in after a hit.
    bugsRespawn: {
      layers: [
        { type: "sine", from: 200, to: 1000, seconds: 0.3, vibrato: { rate: 20, depth: 0.05 } },
        { type: "pink", seconds: 0.3, gain: 0.3, filter: { type: "bandpass", from: 500, to: 3000, q: 2 } },
      ],
    },
    // A power-up dropped by a squashed bug: a little twinkle to look for it.
    bugsDrop: {
      layers: [
        { type: "triangle", notes: [1319, 1760], seconds: 0.12, gain: 0.5 },
        { type: "noise", seconds: 0.1, delay: 0.04, gain: 0.1, filter: { type: "highpass", from: 7000, to: 8000 } },
      ],
    },
    // A kill in a combo: a chime the game climbs a step per combo.
    bugsComboChime: {
      layers: [
        { type: "triangle", notes: [880, 1320], seconds: 0.09, gain: 0.6 },
        { type: "sine", from: 2640, to: 2640, seconds: 0.14, delay: 0.04, gain: 0.25 },
      ],
    },
    // A Spaghetti Monster tentacle snipped off: two quick scissor blades.
    bugsSnip: {
      layers: [
        { type: "noise", seconds: 0.035, filter: { type: "bandpass", from: 4200, to: 3600, q: 4 } },
        { type: "noise", seconds: 0.035, delay: 0.06, filter: { type: "bandpass", from: 4600, to: 4000, q: 4 } },
        { type: "square", from: 2000, to: 1200, seconds: 0.05, delay: 0.06, gain: 0.25, filter: { type: "lowpass", from: 3000, to: 1500 } },
      ],
    },
  },
  hums: {
    // Your ship's thruster: soft air over a low hum; the game swells and
    // raises it while you steer.
    bugsThruster: { parts: [{ type: "sine", freq: 70, gain: 0.5 }, { type: "triangle", freq: 140, gain: 0.2 }], noise: { color: "pink", gain: 0.7 }, filter: { type: "lowpass", freq: 700, q: 1, follow: 1 }, pulse: { rate: 18, depth: 0.25 }, peak: 0.022 },
    // The nearest diving bug's falling whistle: pitched down as it drops
    // and louder the closer it comes to you.
    bugsDiveWhine: { parts: [{ type: "triangle", freq: 700 }, { type: "sine", freq: 704, gain: 0.6 }], filter: { type: "lowpass", freq: 2000, q: 1, follow: 1 }, pulse: { rate: 9, depth: 0.3 }, peak: 0.02 },
    // The Memory Leak: a slow, wet gurgle that sinks as it swells.
    bugsBossLeak: { parts: [{ type: "sine", freq: 60 }, { type: "triangle", freq: 90.5, gain: 0.4 }], noise: { color: "brown", gain: 0.6 }, filter: { type: "lowpass", freq: 320, q: 6, follow: 1 }, pulse: { rate: 3, depth: 0.6 }, peak: 0.045 },
    // The Spaghetti Monster: a tangled, slithering low drone.
    bugsBossTangle: { parts: [{ type: "sawtooth", freq: 73 }, { type: "sawtooth", freq: 73.6, gain: 0.8 }], filter: { type: "lowpass", freq: 480, q: 3, follow: 0.8 }, pulse: { rate: 5, depth: 0.4 }, peak: 0.035 },
    // The Heisenbug: two beating tones flickering in and out of being.
    bugsBossFlicker: { parts: [{ type: "sine", freq: 220 }, { type: "sine", freq: 233 }, { type: "square", freq: 110, gain: 0.2 }], filter: { type: "bandpass", freq: 600, q: 2, follow: 1 }, pulse: { rate: 7, depth: 0.7 }, peak: 0.03 },
    // Slow-mo running: a slow, deep wobble under everything.
    bugsSlowmo: { parts: [{ type: "sine", freq: 110 }, { type: "sine", freq: 111.5, gain: 0.8 }], filter: { type: "lowpass", freq: 400, q: 1, follow: 1 }, pulse: { rate: 1.2, depth: 0.5 }, peak: 0.025 },
    // Magnet running: a faint electric field buzz.
    bugsMagnetField: { parts: [{ type: "sine", freq: 330 }, { type: "square", freq: 660, gain: 0.15 }], filter: { type: "lowpass", freq: 900, q: 1, follow: 1 }, pulse: { rate: 9, depth: 0.3 }, peak: 0.018 },
  },
};
