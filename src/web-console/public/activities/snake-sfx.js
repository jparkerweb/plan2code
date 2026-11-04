// Plan2Code Web Console - snake: its own sound effects and music, merged into tones.js beside the shared kit; defines only.
//
// `tones` are one-shot sounds played with tone(name, level, pitch); `hums` are
// held sounds kept going with hum(id, name, level, pitch). Both take the shapes
// tones.js documents, as plain objects (tones.js freezes them). A name may be
// defined only once across tones.js and every game's file. The music is in
// snake-music.js, merged in below as `music`: that file is the only import.

import { SNAKE_MUSIC } from "./snake-music.js";

export default {
  music: SNAKE_MUSIC,
  tones: {
    // A crunchy bite laid over `eat` while a combo runs (pitched up a step
    // per combo), and on a caught runaway.
    snakeChomp: {
      layers: [
        { type: "noise", seconds: 0.07, filter: { type: "bandpass", from: 2600, to: 900, q: 1.6 } },
        { type: "triangle", from: 540, to: 260, seconds: 0.06, gain: 0.5 },
        { type: "noise", seconds: 0.05, delay: 0.05, gain: 0.5, filter: { type: "bandpass", from: 1800, to: 700, q: 2 } },
      ],
    },
    // A bite out of a boss fruit: a deep, wet crunch (pitched up as fewer
    // bites are left).
    snakeBite: {
      layers: [
        { type: "brown", seconds: 0.16, filter: { type: "lowpass", from: 1400, to: 200 } },
        { type: "noise", seconds: 0.12, gain: 0.6, filter: { type: "bandpass", from: 2000, to: 500, q: 1.4 } },
        { type: "sine", from: 260, to: 90, seconds: 0.13, gain: 0.7 },
      ],
    },
    // The boss fruit's last bite: a burst under a bright climb.
    snakeBossDown: {
      layers: [
        { type: "brown", seconds: 0.5, filter: { type: "lowpass", from: 1600, to: 120 } },
        { type: "sine", from: 150, to: 45, seconds: 0.35, gain: 0.7 },
        { type: "triangle", notes: [392, 523, 659, 784, 1047], seconds: 0.45, delay: 0.08, gain: 0.7 },
      ],
    },
    // A turn taken: a very soft scale-rustle, quiet since it comes often.
    snakeTurn: { layers: [{ type: "pink", seconds: 0.035, filter: { type: "bandpass", from: 1500, to: 1100, q: 3 } }] },
    // Scissors: two quick metal snips.
    snakeSnip: {
      layers: [
        { type: "noise", seconds: 0.04, filter: { type: "highpass", from: 4000, to: 6000 } },
        { type: "triangle", from: 2600, to: 2200, seconds: 0.03, gain: 0.4 },
        { type: "noise", seconds: 0.05, delay: 0.1, filter: { type: "highpass", from: 4200, to: 6500 } },
        { type: "triangle", from: 2800, to: 2300, seconds: 0.035, delay: 0.1, gain: 0.4 },
      ],
    },
    // Slow-mo grabbed: time stretching down, a wobbling fall.
    snakeSlowOn: {
      layers: [
        { type: "sawtooth", from: 600, to: 90, seconds: 0.6, gain: 0.45, vibrato: { rate: 6, depth: 0.03 }, filter: { type: "lowpass", from: 2000, to: 300 } },
        { type: "sine", from: 300, to: 60, seconds: 0.6, gain: 0.5 },
      ],
    },
    // Slow-mo running out: time catching back up, a soft rise.
    snakeTimeResume: {
      layers: [
        { type: "sine", from: 120, to: 600, seconds: 0.35, gain: 0.6 },
        { type: "pink", seconds: 0.35, attack: 0.1, gain: 0.3, filter: { type: "bandpass", from: 300, to: 1500, q: 1.5 } },
      ],
    },
    // Magnet grabbed: a clunk and an electric buzz rising.
    snakeMagnetOn: {
      layers: [
        { type: "noise", seconds: 0.04, gain: 0.5, filter: { type: "bandpass", from: 2200, to: 1600, q: 2 } },
        { type: "square", from: 110, to: 112, seconds: 0.28, gain: 0.45, vibrato: { rate: 30, depth: 0.02 }, filter: { type: "lowpass", from: 900, to: 700 } },
        { type: "sine", from: 880, to: 1760, seconds: 0.2, gain: 0.35 },
      ],
    },
    // Ghost grabbed: a wavering "whooo".
    snakeGhostOn: {
      layers: [
        { type: "sine", from: 300, to: 600, seconds: 0.6, attack: 0.12, vibrato: { rate: 5, depth: 0.04 } },
        { type: "sine", from: 452, to: 900, seconds: 0.6, attack: 0.12, gain: 0.35 },
        { type: "pink", seconds: 0.5, attack: 0.1, gain: 0.2, filter: { type: "bandpass", from: 600, to: 1200, q: 2 } },
      ],
    },
    // Jackpot: a cascade of coins.
    snakeJackpot: {
      layers: [
        { type: "triangle", notes: [1319, 1568, 1319, 1760, 2093, 2637], seconds: 0.42, gain: 0.7 },
        { type: "square", notes: [659, 784, 659, 880, 1047, 1319], seconds: 0.42, gain: 0.22, filter: { type: "lowpass", from: 3000, to: 3000 } },
        { type: "noise", seconds: 0.35, delay: 0.2, gain: 0.15, filter: { type: "highpass", from: 7000, to: 9000 } },
      ],
    },
    // Lights out: the switch's click and the room powering down.
    snakeLightsOut: {
      layers: [
        { type: "noise", seconds: 0.02, gain: 0.6, filter: { type: "bandpass", from: 3000, to: 2800, q: 2 } },
        { type: "sawtooth", from: 220, to: 40, seconds: 0.55, delay: 0.03, gain: 0.5, filter: { type: "lowpass", from: 1200, to: 150 } },
      ],
    },
    // Disco fever: two kicks, four hats and a bright run.
    snakeDisco: {
      layers: [
        { type: "sine", from: 120, to: 50, seconds: 0.12 },
        { type: "sine", from: 120, to: 50, seconds: 0.12, delay: 0.25 },
        ...[0.125, 0.19, 0.375, 0.44].map((delay) => ({ type: "noise", seconds: 0.03, delay, gain: 0.35, filter: { type: "highpass", from: 7000, to: 8000 } })),
        { type: "square", notes: [523, 659, 784, 1047, 784, 1047], seconds: 0.5, gain: 0.35, filter: { type: "lowpass", from: 3000, to: 3000 } },
      ],
    },
    // Big snack: three gulps going down.
    snakeGulp: {
      layers: [
        { type: "sine", from: 500, to: 130, seconds: 0.14 },
        { type: "sine", from: 430, to: 110, seconds: 0.14, delay: 0.15, gain: 0.85 },
        { type: "sine", from: 360, to: 90, seconds: 0.16, delay: 0.3, gain: 0.7 },
        { type: "pink", seconds: 0.4, gain: 0.2, filter: { type: "lowpass", from: 900, to: 200, q: 3 } },
      ],
    },
    // A rock on its way down (it flashes before it lands): a falling whistle.
    snakeMeteor: {
      layers: [
        { type: "sine", from: 2200, to: 500, seconds: 0.6, gain: 0.45 },
        { type: "pink", seconds: 0.6, attack: 0.2, gain: 0.3, filter: { type: "bandpass", from: 3000, to: 600, q: 1.5 } },
      ],
    },
    // A rock landing and turning solid.
    snakeRockLand: {
      layers: [
        { type: "brown", seconds: 0.2, filter: { type: "lowpass", from: 800, to: 120 } },
        { type: "sine", from: 110, to: 45, seconds: 0.16, gain: 0.7 },
        { type: "noise", seconds: 0.05, gain: 0.3, filter: { type: "bandpass", from: 1400, to: 600, q: 2 } },
      ],
    },
    // A comet appearing (it flashes before it flies): a two-tone alert.
    snakeCometWarn: {
      layers: [
        { type: "triangle", notes: [988, 1319, 988, 1319], seconds: 0.36, gain: 0.6 },
        { type: "sine", notes: [494, 659, 494, 659], seconds: 0.36, gain: 0.3 },
      ],
    },
    // A comet taking off: a fiery whoosh.
    snakeCometLaunch: {
      layers: [
        { type: "pink", seconds: 0.4, attack: 0.05, filter: { type: "bandpass", from: 600, to: 3500, q: 1.3 } },
        { type: "sawtooth", from: 300, to: 900, seconds: 0.3, gain: 0.3, filter: { type: "lowpass", from: 1500, to: 2500 } },
      ],
    },
    // A close shave: a turn just before a wall, a rock or the tail, or a comet
    // flying right past the head.
    snakeNearMiss: {
      layers: [
        { type: "noise", seconds: 0.18, attack: 0.02, filter: { type: "bandpass", from: 3000, to: 900, q: 2 } },
        { type: "sine", from: 1200, to: 700, seconds: 0.1, gain: 0.25 },
      ],
    },
    // A power-up or mystery box popping onto the board.
    snakeItemPop: {
      layers: [
        { type: "sine", from: 600, to: 1500, seconds: 0.07 },
        { type: "triangle", from: 1500, to: 2200, seconds: 0.08, delay: 0.05, gain: 0.5 },
      ],
    },
    // A power-up fading away untaken.
    snakeItemFade: { layers: [{ type: "sine", from: 900, to: 300, seconds: 0.18, gain: 0.6, vibrato: { rate: 14, depth: 0.03 } }] },
    // The runaway fruit turning up: a cheeky giggle.
    snakeRunner: { layers: [{ type: "triangle", notes: [880, 1175, 880, 1175, 988], seconds: 0.3, gain: 0.7, vibrato: { rate: 12, depth: 0.02 } }] },
    // The runaway fruit hopping away.
    snakeHop: {
      layers: [
        { type: "triangle", from: 700, to: 1300, seconds: 0.05 },
        { type: "sine", from: 1300, to: 1000, seconds: 0.04, delay: 0.04, gain: 0.4 },
      ],
    },
    // The runaway fruit getting away: a teasing fall.
    snakeEscape: {
      layers: [
        { type: "triangle", notes: [784, 659, 523, 392], seconds: 0.36, gain: 0.7 },
        { type: "sine", from: 330, to: 150, seconds: 0.3, delay: 0.2, gain: 0.4 },
      ],
    },
    // A new level: a five-note climb with a cymbal swell under it (the game
    // pitches it up a little each level).
    snakeLevel: {
      layers: [
        { type: "triangle", notes: [523, 659, 784, 1047, 1319], seconds: 0.5, gain: 0.8 },
        { type: "square", notes: [262, 330, 392, 523, 659], seconds: 0.5, gain: 0.25, filter: { type: "lowpass", from: 2400, to: 2400 } },
        { type: "noise", seconds: 0.5, delay: 0.3, attack: 0.05, gain: 0.2, filter: { type: "highpass", from: 6000, to: 9000 } },
      ],
    },
    // The shield taking a hit: a ringing energy deflect.
    snakeShieldHit: {
      layers: [
        { type: "sine", from: 1600, to: 600, seconds: 0.25, vibrato: { rate: 30, depth: 0.05 } },
        { type: "noise", seconds: 0.12, gain: 0.4, filter: { type: "bandpass", from: 4000, to: 1500, q: 1.5 } },
        { type: "triangle", from: 2400, to: 2380, seconds: 0.45, gain: 0.25 },
      ],
    },
    // Portals moving: a sliding shimmer.
    snakePortalShift: {
      layers: [
        { type: "sine", from: 1200, to: 400, seconds: 0.4, gain: 0.6, vibrato: { rate: 20, depth: 0.08 } },
        { type: "pink", seconds: 0.4, gain: 0.25, filter: { type: "bandpass", from: 3000, to: 800, q: 3 } },
      ],
    },
    // Game over, the snake way: a rattle shaking itself out.
    snakeRattle: {
      layers: [0, 0.06, 0.12, 0.18, 0.24, 0.31, 0.39, 0.48, 0.58].map((delay, i) => ({ type: "noise", seconds: 0.035, delay, gain: Math.max(0.2, 0.8 - i * 0.07), filter: { type: "bandpass", from: 4200, to: 3200, q: 3 } })),
    },
  },
  hums: {
    // Scales on the ground, a soft pulsing rustle under every round. Its
    // pulse is a step at STEP_MS (1000 / 120 ms); the game pitches it with
    // the pace, so the rustle quickens as the snake does.
    snakeSlither: { noise: { color: "pink", gain: 1 }, filter: { type: "bandpass", freq: 1500, q: 1.2, follow: 0.35 }, pulse: { rate: 8.33, depth: 0.8 }, peak: 0.02 },
    // Slow-mo: a low, slowly breathing drone.
    snakeSlowmo: { parts: [{ type: "sine", freq: 65 }, { type: "sine", freq: 65.7 }, { type: "triangle", freq: 130, gain: 0.3 }], filter: { type: "lowpass", freq: 500, q: 1, follow: 0.5 }, pulse: { rate: 0.8, depth: 0.4 }, peak: 0.04 },
    // Magnet: a mains buzz, pitched up as the food slides closer.
    snakeMagnet: { parts: [{ type: "sawtooth", freq: 60, gain: 0.6 }, { type: "sine", freq: 120, gain: 0.6 }, { type: "sine", freq: 1240, gain: 0.06 }], filter: { type: "lowpass", freq: 700, q: 3, follow: 0.8 }, pulse: { rate: 6, depth: 0.3 }, peak: 0.03 },
    // Ghost: a thin, wavering choir.
    snakeGhost: { parts: [{ type: "sine", freq: 330 }, { type: "sine", freq: 333 }, { type: "sine", freq: 495, gain: 0.4 }], filter: { type: "lowpass", freq: 1400, q: 1, follow: 1 }, pulse: { rate: 4.5, depth: 0.5 }, peak: 0.022 },
    // Disco fever: a four-on-the-floor bass thump at 120 beats a minute.
    snakeDiscoBeat: { parts: [{ type: "square", freq: 55 }, { type: "sine", freq: 110, gain: 0.6 }], filter: { type: "lowpass", freq: 260, q: 3, follow: 1 }, pulse: { rate: 2, depth: 0.95 }, peak: 0.05 },
    // A flying comet: a crackling, fiery roar, louder the closer it is.
    snakeComet: { parts: [{ type: "sawtooth", freq: 80, gain: 0.2 }], noise: { color: "pink", gain: 1 }, filter: { type: "bandpass", freq: 900, q: 0.9, follow: 1 }, pulse: { rate: 14, depth: 0.4 }, peak: 0.045 },
    // The portals: a shimmering hum, louder as the head nears one.
    snakePortal: { parts: [{ type: "sine", freq: 220 }, { type: "sine", freq: 221.5 }, { type: "sine", freq: 660, gain: 0.3 }, { type: "triangle", freq: 880, gain: 0.1 }], filter: { type: "lowpass", freq: 1500, q: 1, follow: 1 }, pulse: { rate: 3, depth: 0.5 }, peak: 0.03 },
  },
};
