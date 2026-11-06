// Plan2Code Web Console - ghoul: The Torch Mob's own sound effects and music track, merged into ghoul-sfx.js; defines only.
//
// Same shape and rules as ghoul-sfx-sled.js: `tones` (a `ghoulWagon<Act>` sound for the
// wagon's things) and `music` (a track for the room, named in ROOM_MUSIC in ghoul.js). Both are
// built here from the house's tone layers (no audio files); the picks are still to be made by ear,
// so each is a first sketch. No tone runs over 1.2 s; the track is built from short patterns. A
// name may be defined only once across tones.js and every game's file. No imports.

export const WAGON_SFX = {
  tones: {
    // Torch Mob: The bonus ride: you race a stolen hay wagon out of Hollow End with the whole village behind you.
    // Jumps: Wheels leave the cobbles with a creak.
    ghoulWagonJump: {
      layers: [
        { type: "noise", seconds: 0.2, attack: 0.06, gain: 0.34, filter: { type: "bandpass", from: 1200, to: 2600, q: 3 } },
        { type: "sawtooth", from: 150, to: 230, seconds: 0.18, attack: 0.04, gain: 0.2, vibrato: { rate: 22, depth: 0.1 }, filter: { type: "bandpass", from: 500, to: 900, q: 4 } },
      ],
    },
    // Lands: Wheels and planks clatter back down.
    ghoulWagonLand: {
      layers: [
        { type: "sine", from: 120, to: 50, seconds: 0.16, attack: 0, gain: 0.8 },
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.5, filter: { type: "bandpass", from: 1500, to: 900, q: 4 } },
        { type: "noise", seconds: 0.05, delay: 0.06, attack: 0, gain: 0.4, filter: { type: "bandpass", from: 1900, to: 1200, q: 4 } },
        { type: "noise", seconds: 0.05, delay: 0.11, attack: 0, gain: 0.3, filter: { type: "bandpass", from: 1300, to: 800, q: 4 } },
      ],
    },
    // Launches off the bridge ramp: A whoosh and a whooping horse.
    ghoulWagonLaunch: {
      layers: [
        { type: "noise", seconds: 0.8, attack: 0.3, gain: 0.5, filter: { type: "bandpass", from: 300, to: 2200, q: 2 } },
        { type: "sawtooth", from: 420, to: 1150, seconds: 0.55, attack: 0.08, gain: 0.3, vibrato: { rate: 9, depth: 0.08 }, filter: { type: "bandpass", from: 1100, to: 1700, q: 3 } },
        { type: "triangle", from: 280, to: 640, seconds: 0.5, attack: 0.1, gain: 0.3 },
      ],
    },
    // Brakes: Wood scrapes on stone, an axle squeal.
    ghoulWagonBrake: {
      layers: [
        { type: "noise", seconds: 0.3, attack: 0.05, gain: 0.45, filter: { type: "bandpass", from: 1800, to: 700, q: 2 } },
        { type: "sawtooth", from: 900, to: 620, seconds: 0.28, attack: 0.03, gain: 0.16, vibrato: { rate: 30, depth: 0.05 }, filter: { type: "bandpass", from: 1500, to: 800, q: 6 } },
      ],
    },
    // Crash: Splintering wood.
    ghoulWagonCrash: {
      layers: [
        { type: "sine", from: 96, to: 36, seconds: 0.25, attack: 0, gain: 1 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.7, filter: { type: "lowpass", from: 300, to: 300, q: 1 } },
        { type: "noise", seconds: 0.05, delay: 0.02, attack: 0, gain: 0.7, filter: { type: "bandpass", from: 2400, to: 1500, q: 3 } },
        { type: "noise", seconds: 0.05, delay: 0.08, attack: 0, gain: 0.6, filter: { type: "bandpass", from: 3000, to: 2000, q: 3 } },
        { type: "noise", seconds: 0.3, delay: 0.1, attack: 0.1, gain: 0.25, filter: { type: "bandpass", from: 1200, to: 3000, q: 2 } },
      ],
    },
    // Checkpoint: The village's church bell.
    ghoulWagonCheck: {
      layers: [
        { type: "sine", from: 392, to: 388, seconds: 0.9, attack: 0.004, gain: 0.45 },
        { type: "sine", from: 784, to: 776, seconds: 0.7, attack: 0.004, gain: 0.22 },
        { type: "sine", from: 1180, to: 1170, seconds: 0.5, attack: 0.004, gain: 0.12 },
        { type: "sine", from: 523, to: 520, seconds: 0.8, attack: 0.004, gain: 0.3, delay: 0.16 },
        { type: "sine", from: 1046, to: 1040, seconds: 0.5, attack: 0.004, gain: 0.14, delay: 0.16 },
      ],
    },
    // Finish: A fanfare through the gate.
    ghoulWagonFinish: {
      layers: [
        { type: "triangle", seconds: 0.9, attack: 0.01, gain: 0.7, notes: [392, 494, 587, 784] },
        { type: "sine", seconds: 0.9, attack: 0.01, gain: 0.25, notes: [784, 988, 1175, 1568] },
      ],
    },
    // Horses bolt: The mob is close, a panicked whinny.
    ghoulWagonPanic: {
      layers: [
        { type: "sawtooth", from: 520, to: 1250, seconds: 0.35, attack: 0.04, gain: 0.34, vibrato: { rate: 24, depth: 0.1 }, filter: { type: "bandpass", from: 1400, to: 2200, q: 3 } },
        { type: "sawtooth", from: 1250, to: 640, seconds: 0.5, attack: 0.02, gain: 0.3, delay: 0.35, vibrato: { rate: 20, depth: 0.12 }, filter: { type: "bandpass", from: 1600, to: 900, q: 3 } },
      ],
    },
    // Caught: The mob's roar and a hard knock.
    ghoulWagonCatch: {
      layers: [
        { type: "sawtooth", from: 110, to: 70, seconds: 0.7, attack: 0.04, gain: 0.5, vibrato: { rate: 13, depth: 0.15 }, filter: { type: "lowpass", from: 900, to: 400, q: 2 } },
        { type: "noise", seconds: 0.7, attack: 0.1, gain: 0.35, filter: { type: "bandpass", from: 500, to: 1500, q: 1 } },
        { type: "sine", from: 80, to: 36, seconds: 0.25, attack: 0, gain: 0.9, delay: 0.05 },
      ],
    },
    // Hay catches: A flare and crackle.
    ghoulWagonFire: {
      layers: [
        { type: "noise", seconds: 0.5, attack: 0.1, gain: 0.5, filter: { type: "bandpass", from: 500, to: 2800, q: 1.5 } },
        { type: "pink", seconds: 0.6, attack: 0.2, gain: 0.3, filter: { type: "bandpass", from: 800, to: 3200, q: 1 } },
        { type: "noise", seconds: 0.03, delay: 0.25, attack: 0, gain: 0.5, filter: { type: "highpass", from: 3500, to: 3500 } },
        { type: "noise", seconds: 0.03, delay: 0.38, attack: 0, gain: 0.5, filter: { type: "highpass", from: 3800, to: 3800 } },
      ],
    },
    // Fire out: A hiss that dies away.
    ghoulWagonOut: {
      layers: [
        { type: "noise", seconds: 0.5, attack: 0.02, gain: 0.35, filter: { type: "bandpass", from: 4200, to: 1800, q: 1.5 } },
      ],
    },
    // Thrower: A villager in a window or on a roof, with a pitchfork or a torch for the wagon (shoot it or dodge it).
    // Winds up: A torch flares and a grunt.
    ghoulWagonWind: {
      layers: [
        { type: "noise", seconds: 0.4, attack: 0.15, gain: 0.34, filter: { type: "bandpass", from: 600, to: 2400, q: 2 } },
        { type: "sawtooth", from: 150, to: 110, seconds: 0.3, attack: 0.04, gain: 0.3, vibrato: { rate: 9, depth: 0.1 }, filter: { type: "lowpass", from: 700, to: 450, q: 2 }, delay: 0.1 },
      ],
    },
    // Throws: A swish through the air.
    ghoulWagonThrow: {
      layers: [
        { type: "noise", seconds: 0.25, attack: 0.08, gain: 0.5, filter: { type: "bandpass", from: 3000, to: 900, q: 3 } },
        { type: "sine", from: 900, to: 400, seconds: 0.2, attack: 0.02, gain: 0.12 },
      ],
    },
    // Shot down: A crack and a shower of sparks.
    ghoulWagonShot: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.8, filter: { type: "bandpass", from: 2000, to: 1300, q: 2 } },
        { type: "square", from: 900, to: 300, seconds: 0.05, attack: 0, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.5, filter: { type: "highpass", from: 3500, to: 3500 } },
        { type: "sine", from: 2600, to: 3800, seconds: 0.16, attack: 0.002, gain: 0.15, delay: 0.05 },
      ],
    },
    // A torch lands short: A soft thud and sputter.
    ghoulWagonEmber: {
      layers: [
        { type: "brown", seconds: 0.1, attack: 0, gain: 0.4, filter: { type: "lowpass", from: 300, to: 300, q: 1 } },
        { type: "noise", seconds: 0.2, delay: 0.04, attack: 0.04, gain: 0.2, filter: { type: "bandpass", from: 3000, to: 1500, q: 2 } },
      ],
    },
    // Spooked Horse: A loose horse that rears, then charges down the road (jump it, or shoot it three times to turn it).
    // Rears: A whinny.
    ghoulWagonRear: {
      layers: [
        { type: "sawtooth", from: 700, to: 1500, seconds: 0.3, attack: 0.03, gain: 0.34, vibrato: { rate: 26, depth: 0.1 }, filter: { type: "bandpass", from: 1500, to: 2400, q: 3 } },
        { type: "sawtooth", from: 1500, to: 800, seconds: 0.4, attack: 0.02, gain: 0.3, delay: 0.3, vibrato: { rate: 22, depth: 0.12 }, filter: { type: "bandpass", from: 1700, to: 1000, q: 3 } },
        { type: "noise", seconds: 0.2, attack: 0.05, gain: 0.15, filter: { type: "bandpass", from: 2400, to: 3600, q: 1.5 } },
      ],
    },
    // Takes a bolt: A startled snort.
    ghoulWagonHorseHit: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.6, filter: { type: "bandpass", from: 1600, to: 1100, q: 2 } },
        { type: "sawtooth", from: 420, to: 300, seconds: 0.18, attack: 0.01, gain: 0.35, vibrato: { rate: 14, depth: 0.1 }, filter: { type: "lowpass", from: 1200, to: 700, q: 2 }, delay: 0.03 },
        { type: "noise", seconds: 0.15, delay: 0.08, attack: 0.03, gain: 0.25, filter: { type: "bandpass", from: 800, to: 400, q: 1 } },
      ],
    },
    // Turns back: A whinny and hooves galloping away.
    ghoulWagonHorseTurn: {
      layers: [
        { type: "sawtooth", from: 800, to: 1400, seconds: 0.25, attack: 0.02, gain: 0.3, vibrato: { rate: 24, depth: 0.1 }, filter: { type: "bandpass", from: 1500, to: 2200, q: 3 } },
        { type: "noise", seconds: 0.04, delay: 0.25, attack: 0, gain: 0.5, filter: { type: "bandpass", from: 500, to: 300, q: 4 } },
        { type: "noise", seconds: 0.04, delay: 0.33, attack: 0, gain: 0.45, filter: { type: "bandpass", from: 520, to: 320, q: 4 } },
        { type: "noise", seconds: 0.04, delay: 0.4, attack: 0, gain: 0.4, filter: { type: "bandpass", from: 500, to: 300, q: 4 } },
        { type: "noise", seconds: 0.04, delay: 0.5, attack: 0, gain: 0.3, filter: { type: "bandpass", from: 520, to: 320, q: 4 } },
        { type: "noise", seconds: 0.04, delay: 0.57, attack: 0, gain: 0.2, filter: { type: "bandpass", from: 500, to: 300, q: 4 } },
      ],
    },
  },
  music: {
    // Torch Mob: a runaway hoedown. A sawing fiddle line over a galloping bass (long, short, short
    // on every beat) and a stomping kick and snare, in D minor, quick enough to feel chased. As the
    // dread rises a drone of low chords and a high second fiddle join, and the tempo climbs.
    ghoulWagonRide: {
      bpm: 168,
      rush: 14,
      voices: {
        fiddle: { wave: "pulse", duty: 0.25, gain: 0.11, decay: 0.12, sustain: 0.55, vibrato: { rate: 5.5, depth: 0.02, delay: 0.1 } },
        chord: { wave: "pulse", duty: 0.125, gain: 0.045, decay: 0.05, sustain: 0.4, from: 0.25 },
        bass: { wave: "triangle", gain: 0.42, decay: 0.07, sustain: 0.45 },
        drums: { kit: true, gain: 0.24 },
        fiddle2: { wave: "pulse", duty: 0.5, gain: 0.05, decay: 0.1, sustain: 0.5, from: 0.6 },
      },
      patterns: {
        A: {
          fiddle:
          "D5 - F5 - A5 - F5 - D5 - F5 - A5 - D6 - | C6 - A5 - F5 - A5 - C6 - A5 - F5 - A5 - | " +
          "Bb5 - G5 - D5 - G5 - Bb5 - G5 - D5 - G5 - | A5 - - - E5 - - - A5 - C#6 - E6 - - -",
          chord:
          "D4^037 - - - D4^037 - - - D4^037 - - - D4^037 - - - | F4^047 - - - F4^047 - - - F4^047 - - - F4^047 - - - | " +
          "Bb3^047 - - - Bb3^047 - - - Bb3^047 - - - Bb3^047 - - - | A3^047 - - - A3^047 - - - A3^047 - - - A3^047 - - -",
          bass:
          "D2 . D3 D2 D2 . D3 D2 D2 . D3 D2 D2 . D3 D2 | F2 . F3 F2 F2 . F3 F2 F2 . F3 F2 F2 . F3 F2 | " +
          "Bb1 . Bb2 Bb1 Bb1 . Bb2 Bb1 Bb1 . Bb2 Bb1 Bb1 . Bb2 Bb1 | A1 . A2 A1 A1 . A2 A1 A1 . A2 A1 A1 . A2 A1",
          drums:
          "k . h . s . h . k . h k s . h . | k . h . s . h . k . h k s . h . | " +
          "k . h . s . h . k . h k s . h . | k . h . s . h . k . h k s . s s",
          fiddle2:
          "A5 - - - - - - - F5 - - - - - - - | A5 - - - - - - - C6 - - - - - - - | " +
          "D6 - - - - - - - Bb5 - - - - - - - | E6 - - - - - - - A5 - - - - - - -",
        },
        B: {
          fiddle:
          "A5 - A5 D6 - D6 A5 - F5 - A5 - D6 - - - | G5 - G5 C6 - C6 G5 - E5 - G5 - C6 - - - | " +
          "F5 - F5 Bb5 - Bb5 F5 - D5 - F5 - Bb5 - - - | E5 - G5 - Bb5 - A5 - G5 - E5 - C#5 - A4 -",
          chord:
          "D4^037 - - - D4^037 - - - D4^037 - - - D4^037 - - - | C4^047 - - - C4^047 - - - C4^047 - - - C4^047 - - - | " +
          "Bb3^047 - - - Bb3^047 - - - Bb3^047 - - - Bb3^047 - - - | A3^047 - - - A3^047 - - - A3^047 - - - A3^047 - - -",
          bass:
          "D2 . D3 D2 D2 . D3 D2 D2 . D3 D2 D2 . D3 D2 | C2 . C3 C2 C2 . C3 C2 C2 . C3 C2 C2 . C3 C2 | " +
          "Bb1 . Bb2 Bb1 Bb1 . Bb2 Bb1 Bb1 . Bb2 Bb1 Bb1 . Bb2 Bb1 | A1 . A2 A1 A1 . A2 A1 A1 . A2 A1 A1 . A2 A1",
          drums:
          "k . h . s . h . k . h k s . h . | k . h . s . h . k . h k s . h . | " +
          "k . h . s . h . k . h k s . h . | k . h . s . h . k . h k s . s s",
          fiddle2:
          "D6 - - - - - - - D6 - - - - - - - | E6 - - - - - - - E6 - - - - - - - | " +
          "F6 - - - - - - - D6 - - - - - - - | E6 - - - - - - - A5 - - - - - - -",
        },
        C: {
          fiddle:
          "F5 - A5 - D6 - A5 - F5 - A5 - D6 - F6 - | E6 - D6 - C6 - A5 - E5 - A5 - C6 - E6 - | " +
          "D6 - Bb5 - G5 - Bb5 - D6 - Bb5 - G5 - D5 - | C#6 - E6 - A5 - C#6 - E5 - A5 - C#6 - E6 -",
          chord:
          "D4^037 - - - D4^037 - - - D4^037 - - - D4^037 - - - | A3^037 - - - A3^037 - - - A3^037 - - - A3^037 - - - | " +
          "G3^037 - - - G3^037 - - - G3^037 - - - G3^037 - - - | A3^047 - - - A3^047 - - - A3^047 - - - A3^047 - - -",
          bass:
          "D2 . D3 D2 D2 . D3 D2 D2 . D3 D2 D2 . D3 D2 | A1 . A2 A1 A1 . A2 A1 A1 . A2 A1 A1 . A2 A1 | " +
          "G1 . G2 G1 G1 . G2 G1 G1 . G2 G1 G1 . G2 G1 | A1 . A2 A1 A1 . A2 A1 A1 . A2 A1 A1 . A2 A1",
          drums:
          "k . h k s . h . k . h k s . h k | k . h k s . h . k . h k s . h k | " +
          "k . h k s . h . k . h k s . h k | k . h k s . h . k s k s k s s s",
          fiddle2:
          "F6 - - - - - - - A6 - - - - - - - | E6 - - - - - - - C6 - - - - - - - | " +
          "D6 - - - - - - - Bb5 - - - - - - - | E6 - - - - - - - A6 - - - - - - -",
        },
      },
      order: ["A", "A", "B", "A", "C", "B", "A", "B", "C", "A"],
    },
  },
};
