// Plan2Code Web Console - trails: its own sound effects and songs, merged into tones.js beside the shared kit; defines only.
//
// `tones` are one-shot sounds played with tone(name, level, pitch); `hums` are
// held sounds kept going with hum(id, name, level, pitch). Both take the shapes
// tones.js documents, as plain objects (tones.js freezes them). A name may be
// defined only once across tones.js and every game's file. No imports.

export default {
  // The music: recorded songs, each a name to an mp3 the server serves
  // (listed in SERVABLE), played by music.js one after another in the order
  // trails.js deals them.
  songs: {
    trailsSong1: "activities/light-trails/1.mp3",
    trailsSong2: "activities/light-trails/2.mp3",
    trailsSong3: "activities/light-trails/3.mp3",
    trailsSong4: "activities/light-trails/4.mp3",
    trailsSong5: "activities/light-trails/5.mp3",
  },
  tones: {
    // A turn taken: a short, bright synth chirp (the game nudges its pitch a
    // little each time, so steering never sounds like one repeated beep).
    trailsTurn: {
      layers: [
        { type: "square", from: 1100, to: 1500, seconds: 0.045, gain: 0.35, filter: { type: "lowpass", from: 3000, to: 2000 } },
        { type: "sine", from: 2200, to: 2600, seconds: 0.03, gain: 0.25 },
      ],
    },
    // The light cycle firing up as a heat starts: two detuned saws revving
    // through an opening filter, with a hiss of air on top.
    trailsIgnite: {
      layers: [
        { type: "sawtooth", from: 70, to: 220, seconds: 0.5, attack: 0.1, gain: 0.5, filter: { type: "lowpass", from: 300, to: 2400, q: 6 } },
        { type: "sawtooth", from: 71, to: 223, seconds: 0.5, attack: 0.1, gain: 0.4, filter: { type: "lowpass", from: 300, to: 2400, q: 6 } },
        { type: "pink", seconds: 0.45, attack: 0.15, gain: 0.3, filter: { type: "highpass", from: 1200, to: 4000 } },
      ],
    },
    // A boost running out: the whine winding back down.
    trailsBoostOut: {
      layers: [
        { type: "sawtooth", from: 400, to: 140, seconds: 0.35, gain: 0.5, filter: { type: "lowpass", from: 2400, to: 400 } },
        { type: "pink", seconds: 0.3, gain: 0.3, filter: { type: "bandpass", from: 2000, to: 500, q: 1.2 } },
      ],
    },
    // A rival derezzing: a glassy run falling apart over a zap and a spray of
    // bright grit.
    trailsDerez: {
      layers: [
        { type: "triangle", notes: [1760, 1319, 1047, 784, 523], seconds: 0.4, gain: 0.5 },
        { type: "square", from: 880, to: 110, seconds: 0.3, gain: 0.3, filter: { type: "lowpass", from: 3000, to: 300 } },
        { type: "noise", seconds: 0.35, gain: 0.35, filter: { type: "highpass", from: 6000, to: 2500 } },
      ],
    },
    // A rival ran into your own trail: a quick two-note reward on top.
    trailsCutOff: {
      layers: [
        { type: "triangle", notes: [1047, 1568], seconds: 0.16 },
        { type: "square", notes: [523, 784], seconds: 0.16, gain: 0.25, filter: { type: "lowpass", from: 2400, to: 2400 } },
      ],
    },
    // Your cycle shattering: a dark boom, a crack, the motor dying and the
    // pieces tinkling down.
    trailsShatter: {
      layers: [
        { type: "brown", seconds: 0.9, filter: { type: "lowpass", from: 3000, to: 80, q: 0.7 } },
        { type: "noise", seconds: 0.45, gain: 0.5, filter: { type: "bandpass", from: 5000, to: 1200, q: 0.8 } },
        { type: "sawtooth", from: 300, to: 40, seconds: 0.6, gain: 0.6, filter: { type: "lowpass", from: 1500, to: 100 } },
        { type: "triangle", notes: [1568, 1175, 880, 659, 440, 330], seconds: 0.7, delay: 0.05, gain: 0.3 },
      ],
    },
    // A Boost pad: a charge whining up, then a little three-note ding.
    trailsCharge: {
      layers: [
        { type: "sawtooth", from: 220, to: 880, seconds: 0.3, gain: 0.5, filter: { type: "lowpass", from: 800, to: 4000, q: 5 } },
        { type: "triangle", notes: [880, 1175, 1568], seconds: 0.24, delay: 0.08, gain: 0.4 },
      ],
    },
    // Phase taking hold and wearing off: a wobbling shimmer up, and back down.
    trailsPhaseIn: {
      layers: [
        { type: "sine", from: 300, to: 1400, seconds: 0.4, vibrato: { rate: 20, depth: 0.06 } },
        { type: "triangle", from: 450, to: 2100, seconds: 0.4, gain: 0.3 },
        { type: "pink", seconds: 0.4, gain: 0.25, filter: { type: "bandpass", from: 500, to: 4000, q: 4 } },
      ],
    },
    trailsPhaseOut: {
      layers: [
        { type: "sine", from: 1400, to: 300, seconds: 0.35, vibrato: { rate: 20, depth: 0.06 } },
        { type: "triangle", from: 2100, to: 450, seconds: 0.35, gain: 0.3 },
        { type: "pink", seconds: 0.35, gain: 0.25, filter: { type: "bandpass", from: 4000, to: 500, q: 4 } },
      ],
    },
    // Slow-mo: a tape grinding to a crawl, and spinning back up when it ends.
    trailsSlowmo: {
      layers: [
        { type: "sawtooth", from: 660, to: 90, seconds: 0.6, gain: 0.5, filter: { type: "lowpass", from: 2400, to: 300 } },
        { type: "sine", from: 330, to: 45, seconds: 0.6, gain: 0.6 },
      ],
    },
    trailsSlowEnd: {
      layers: [
        { type: "sawtooth", from: 90, to: 660, seconds: 0.45, attack: 0.1, gain: 0.5, filter: { type: "lowpass", from: 300, to: 2400 } },
        { type: "sine", from: 45, to: 330, seconds: 0.45, attack: 0.1, gain: 0.5 },
      ],
    },
    // A rival grabbed a pad first: a sour falling pair.
    trailsSnatch: {
      layers: [{ type: "square", notes: [622, 466], seconds: 0.16, gain: 0.45, filter: { type: "lowpass", from: 1600, to: 1600 } }],
    },
    // A pad appearing on the board: a soft high ping.
    trailsPadSpawn: {
      layers: [
        { type: "triangle", notes: [1319, 1976], seconds: 0.14, gain: 0.5 },
        { type: "sine", from: 2637, to: 2637, seconds: 0.25, delay: 0.06, gain: 0.2 },
      ],
    },
    // A ring of wall slamming shut: a heavy low thud, a crack, and the rumble.
    trailsSlam: {
      layers: [
        { type: "brown", seconds: 0.7, filter: { type: "lowpass", from: 600, to: 80 } },
        { type: "square", from: 70, to: 40, seconds: 0.35, gain: 0.5, filter: { type: "lowpass", from: 400, to: 150 } },
        { type: "noise", seconds: 0.12, gain: 0.35, filter: { type: "bandpass", from: 1800, to: 600, q: 1.5 } },
      ],
    },
    // Last rider standing: a bright synth stab chord with a shimmer after it.
    trailsStanding: {
      layers: [
        { type: "sawtooth", notes: [523, 659, 784, 1047], seconds: 0.5, gain: 0.35, filter: { type: "lowpass", from: 1800, to: 3600 } },
        { type: "triangle", notes: [262, 330, 392, 523], seconds: 0.5, gain: 0.6 },
        { type: "sine", from: 2093, to: 2093, seconds: 0.4, delay: 0.4, gain: 0.2 },
      ],
    },
    // A new arena: a noise sweep rising into a wide, held power chord (the
    // game pitches it up a touch for each level).
    trailsArena: {
      layers: [
        { type: "noise", seconds: 0.45, attack: 0.2, gain: 0.3, filter: { type: "bandpass", from: 400, to: 3000, q: 1.2 } },
        { type: "sawtooth", from: 220, to: 220, seconds: 0.7, delay: 0.4, gain: 0.35, filter: { type: "lowpass", from: 600, to: 2400, q: 2 } },
        { type: "sawtooth", from: 330, to: 330, seconds: 0.7, delay: 0.4, gain: 0.3, filter: { type: "lowpass", from: 600, to: 2400, q: 2 } },
        { type: "triangle", from: 440, to: 440, seconds: 0.7, delay: 0.4, gain: 0.4 },
      ],
    },
    // The Laser firing: a bright beam tearing down the grid, a crackle along
    // it and a low thump where it lands.
    trailsLaser: {
      layers: [
        { type: "sawtooth", from: 3200, to: 420, seconds: 0.22, gain: 0.45, filter: { type: "lowpass", from: 6000, to: 1200, q: 3 } },
        { type: "square", from: 1600, to: 200, seconds: 0.18, gain: 0.25, filter: { type: "bandpass", from: 2400, to: 600, q: 2 } },
        { type: "noise", seconds: 0.2, gain: 0.3, filter: { type: "highpass", from: 5000, to: 2000 } },
        { type: "sine", from: 140, to: 50, seconds: 0.25, delay: 0.12, gain: 0.6 },
      ],
    },
    // A Shield taking the crash: a glassy dome shattering into a ring of bells.
    trailsShieldPop: {
      layers: [
        { type: "noise", seconds: 0.35, gain: 0.45, filter: { type: "bandpass", from: 7000, to: 1500, q: 1 } },
        { type: "triangle", notes: [2093, 1568, 2637, 1976], seconds: 0.4, gain: 0.4 },
        { type: "sine", from: 600, to: 1800, seconds: 0.3, delay: 0.05, gain: 0.35 },
        { type: "brown", seconds: 0.4, gain: 0.5, filter: { type: "lowpass", from: 800, to: 120 } },
      ],
    },
    // Hyperjump: sucked down a tunnel of light and flung out the far end.
    trailsJump: {
      layers: [
        { type: "sawtooth", from: 900, to: 90, seconds: 0.25, gain: 0.4, filter: { type: "lowpass", from: 4000, to: 400, q: 6 } },
        { type: "sawtooth", from: 120, to: 1800, seconds: 0.3, delay: 0.22, gain: 0.4, filter: { type: "lowpass", from: 500, to: 6000, q: 6 } },
        { type: "pink", seconds: 0.5, attack: 0.2, gain: 0.3, filter: { type: "bandpass", from: 300, to: 5000, q: 2 } },
      ],
    },
    // A Heart, or a life won with points: a warm lub-dub and a rising chime.
    trailsHeart: {
      layers: [
        { type: "sine", from: 110, to: 70, seconds: 0.12, gain: 0.8 },
        { type: "sine", from: 120, to: 75, seconds: 0.14, delay: 0.16, gain: 0.9 },
        { type: "triangle", notes: [784, 988, 1175, 1568], seconds: 0.45, delay: 0.22, gain: 0.4 },
        { type: "sine", from: 3136, to: 3136, seconds: 0.3, delay: 0.55, gain: 0.15 },
      ],
    },
    // Ridden out of your grace in time: a quick rush of air and a lift.
    trailsSave: {
      layers: [
        { type: "pink", seconds: 0.22, attack: 0.03, filter: { type: "bandpass", from: 600, to: 3000, q: 2 } },
        { type: "triangle", from: 900, to: 1600, seconds: 0.1, gain: 0.3 },
      ],
    },
  },
  hums: {
    // Your light cycle: detuned saws over a sub, a sine body and a thin whine,
    // through a resonant lowpass, with a faint flutter; pitch follows speed.
    // Kept low (a third of its old 0.045) so it sits under the songs.
    trailsCycle: {
      parts: [
        { type: "sawtooth", freq: 82 },
        { type: "sawtooth", freq: 82.5 },
        { type: "square", freq: 41, gain: 0.35 },
        { type: "sine", freq: 164, gain: 0.3 },
        { type: "sawtooth", freq: 246.7, gain: 0.12 },
      ],
      noise: { color: "brown", gain: 0.08 },
      filter: { type: "lowpass", freq: 900, q: 5, follow: 0.9 },
      pulse: { rate: 30, depth: 0.15 },
      peak: 0.015,
    },
    // Riding alongside a rival's wall (or held up against one): an electric
    // crackle, louder the more walls are at your side.
    trailsGraze: {
      parts: [{ type: "sawtooth", freq: 120, gain: 0.15 }],
      noise: { color: "noise", gain: 1 },
      filter: { type: "bandpass", freq: 2600, q: 3, follow: 0.8 },
      pulse: { rate: 17, depth: 0.7 },
      peak: 0.03,
    },
    // Phase running: a soft, beating shimmer.
    trailsPhase: {
      parts: [
        { type: "sine", freq: 660 },
        { type: "sine", freq: 663.5 },
        { type: "triangle", freq: 990, gain: 0.4 },
      ],
      filter: { type: "lowpass", freq: 3000, q: 1, follow: 1 },
      pulse: { rate: 7, depth: 0.5 },
      peak: 0.025,
    },
    // A ring about to close: a two-tone alarm, climbing as it comes.
    trailsSiren: {
      parts: [
        { type: "square", freq: 440 },
        { type: "square", freq: 554, gain: 0.5 },
      ],
      filter: { type: "lowpass", freq: 1400, q: 2, follow: 1 },
      pulse: { rate: 4, depth: 0.8 },
      peak: 0.025,
    },
  },
};
