// Plan2Code Web Console - ghoul: Code Blue's own sound effects and music track, merged into ghoul-sfx.js; defines only.
//
// Same shape and rules as ghoul-sfx-sled.js: `tones` (a `ghoulBlue<Act>` sound for the
// gurney's things) and `music` (a track for the room, named in ROOM_MUSIC in ghoul.js).
// Every tone is built from the house's layers and is at most 1.2 s long. These are first
// picks and still pending a listen: the sounds and the track are to be chosen by ear. A
// name may be defined only once across tones.js and every game's file. No imports.

export const GURNEY_SFX = {
  tones: {
    // Code Blue: The bonus ride: YOU lie strapped to a runaway hospital gurney, jumping, ducking and shooting as the lights go out in waves.
    // Jumps: Wheels squeal as the gurney lifts.
    ghoulBlueJump: {
      layers: [
        { type: "noise", seconds: 0.2, attack: 0.05, gain: 0.3, filter: { type: "bandpass", from: 1200, to: 2800, q: 6 } },
        { type: "square", from: 300, to: 560, seconds: 0.1, gain: 0.1 },
      ],
    },
    // Lands: Clatter of casters and a thud.
    ghoulBlueLand: {
      layers: [
        { type: "sine", from: 130, to: 55, seconds: 0.14, attack: 0, gain: 0.6 },
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.5, filter: { type: "bandpass", from: 1900, to: 1500, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.4, filter: { type: "bandpass", from: 2300, to: 1700, q: 6 } },
        { type: "noise", seconds: 0.3, attack: 0.09, gain: 0.2, delay: 0.08, filter: { type: "bandpass", from: 3000, to: 1500, q: 5 } },
      ],
    },
    // Launches off the loading ramp: Big whoosh and a whoop.
    ghoulBlueLaunch: {
      layers: [
        { type: "noise", seconds: 0.8, attack: 0.3, gain: 0.5, filter: { type: "bandpass", from: 400, to: 2500, q: 2 } },
        { type: "sine", from: 300, to: 900, seconds: 0.5, attack: 0.1, gain: 0.35, vibrato: { rate: 6, depth: 0.05 } },
      ],
    },
    // Ducks: Quick swish.
    ghoulBlueDuck: {
      layers: [
        { type: "noise", seconds: 0.2, attack: 0.07, gain: 0.5, filter: { type: "bandpass", from: 420, to: 2520, q: 1.5 } },
      ],
    },
    // Crash: Metal clang and a groan.
    ghoulBlueCrash: {
      layers: [
        { type: "sine", from: 140, to: 50, seconds: 0.25, attack: 0, gain: 1 },
        { type: "square", from: 220, to: 90, seconds: 0.2, attack: 0, gain: 0.3 },
        { type: "noise", seconds: 0.35, attack: 0.02, gain: 0.35, delay: 0.02, filter: { type: "bandpass", from: 1500, to: 3500, q: 2 } },
        { type: "brown", seconds: 0.25, attack: 0, gain: 0.7, filter: { type: "lowpass", from: 300, to: 200, q: 1 } },
      ],
    },
    // Checkpoint: Two monitor pings.
    ghoulBlueCheck: {
      layers: [
        { type: "sine", from: 1318, to: 1318, seconds: 0.12, attack: 0.004, gain: 0.35 },
        { type: "sine", from: 1760, to: 1760, seconds: 0.18, attack: 0.004, gain: 0.35, delay: 0.1 },
      ],
    },
    // Finish: Fanfare notes.
    ghoulBlueFinish: {
      layers: [
        { type: "triangle", seconds: 0.9, attack: 0.01, gain: 0.7, notes: [392, 523, 659, 784] },
        { type: "sine", seconds: 0.9, attack: 0.01, gain: 0.25, notes: [784, 1047, 1319, 1568] },
      ],
    },
    // Countdown tick (3, 2, 1): An electric buzz and a beep.
    ghoulBlueWarn: {
      layers: [
        { type: "sawtooth", from: 118, to: 112, seconds: 0.2, attack: 0.01, gain: 0.3, vibrato: { rate: 50, depth: 0.04 } },
        { type: "noise", seconds: 0.14, attack: 0.01, gain: 0.3, filter: { type: "highpass", from: 3000, to: 3000 } },
        { type: "sine", from: 880, to: 880, seconds: 0.1, attack: 0.004, gain: 0.3, delay: 0.1 },
      ],
    },
    // Lights out: A power-down groan and a thunk.
    ghoulBlueDark: {
      layers: [
        { type: "sine", from: 900, to: 60, seconds: 0.9, attack: 0.01, gain: 0.4 },
        { type: "noise", seconds: 0.6, attack: 0.02, gain: 0.4, filter: { type: "lowpass", from: 800, to: 100, q: 1 } },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.8, delay: 0.05, filter: { type: "lowpass", from: 200, to: 120, q: 1 } },
      ],
    },
    // Lights back on: A power-up rise and a pop.
    ghoulBlueLit: {
      layers: [
        { type: "sine", from: 120, to: 700, seconds: 0.5, attack: 0.02, gain: 0.35 },
        { type: "noise", seconds: 0.06, attack: 0, gain: 0.4, delay: 0.45, filter: { type: "highpass", from: 2500, to: 2500 } },
        { type: "triangle", seconds: 0.25, attack: 0.01, gain: 0.3, delay: 0.5, notes: [659, 988] },
      ],
    },
    // Heartbeat monitor: A clean beep.
    ghoulBlueBeat: {
      layers: [
        { type: "sine", from: 1000, to: 1000, seconds: 0.1, attack: 0.003, gain: 0.4 },
      ],
    },
    // Flatline: One long tone.
    ghoulBlueFlat: {
      layers: [
        { type: "sine", from: 1000, to: 1000, seconds: 1.1, attack: 0.003, gain: 0.35 },
        { type: "sine", from: 2000, to: 2000, seconds: 1.1, attack: 0.003, gain: 0.05 },
      ],
    },
    // Wheelchair: A squeaky wheel starts to roll.
    ghoulBlueChair: {
      layers: [
        { type: "noise", seconds: 0.25, attack: 0.04, gain: 0.3, filter: { type: "bandpass", from: 800, to: 1700, q: 8 } },
        { type: "square", from: 600, to: 760, seconds: 0.05, gain: 0.08, delay: 0.05 },
        { type: "square", from: 640, to: 800, seconds: 0.05, gain: 0.08, delay: 0.13 },
      ],
    },
    // Orderly: The door shivers in its frame.
    ghoulBlueOrderlyWarn: {
      layers: [
        { type: "noise", seconds: 0.3, attack: 0.02, gain: 0.35, filter: { type: "bandpass", from: 200, to: 420, q: 3 } },
        { type: "square", from: 90, to: 80, seconds: 0.05, gain: 0.25 },
        { type: "square", from: 90, to: 80, seconds: 0.05, gain: 0.25, delay: 0.1 },
        { type: "square", from: 90, to: 80, seconds: 0.05, gain: 0.25, delay: 0.2 },
      ],
    },
    // Orderly: The door flies open and he roars.
    ghoulBlueOrderlyUp: {
      layers: [
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.8, filter: { type: "lowpass", from: 400, to: 200, q: 1 } },
        { type: "sawtooth", from: 110, to: 80, seconds: 0.45, attack: 0.03, gain: 0.3, delay: 0.05, vibrato: { rate: 18, depth: 0.05 } },
      ],
    },
    // Orderly: A bolt thumps into him.
    ghoulBlueOrderlyHit: {
      layers: [
        { type: "sine", from: 110, to: 60, seconds: 0.12, attack: 0, gain: 0.7 },
        { type: "noise", seconds: 0.12, attack: 0, gain: 0.4, filter: { type: "bandpass", from: 600, to: 300, q: 2 } },
      ],
    },
    // Orderly: Down he goes.
    ghoulBlueOrderlyBreak: {
      layers: [
        { type: "sawtooth", from: 200, to: 50, seconds: 0.5, attack: 0.01, gain: 0.35 },
        { type: "noise", seconds: 0.35, attack: 0.01, gain: 0.4, filter: { type: "lowpass", from: 1500, to: 200, q: 1 } },
        { type: "sine", from: 90, to: 40, seconds: 0.3, attack: 0, gain: 0.7, delay: 0.1 },
      ],
    },
    // Surge lamp: Glass shatters and a zap.
    ghoulBlueLampBreak: {
      layers: [
        { type: "noise", seconds: 0.3, attack: 0, gain: 0.5, filter: { type: "highpass", from: 2200, to: 2200 } },
        { type: "sine", from: 3000, to: 200, seconds: 0.22, attack: 0, gain: 0.25 },
        { type: "square", from: 140, to: 60, seconds: 0.18, attack: 0, gain: 0.2, delay: 0.04 },
      ],
    },
  },
  music: {
    // Code Blue: monitor rush. A pulsing minor-key chase: an urgent staccato lead over a driving
    // bass, a kick on every beat, hats and a snap, and a monitor beep once a bar that keeps
    // the heartbeat; at high dread a stab and an octave-up lead join.
    ghoulBlueRide: {
      bpm: 144,
      rush: 10,
      voices: {
        lead: { wave: "pulse", duty: 0.25, gain: 0.1, decay: 0.07, sustain: 0.3 },
        bass: { wave: "triangle", gain: 0.4, decay: 0.08, sustain: 0.6 },
        kick: { kit: true, gain: 0.26, from: 0.15 },
        hat: { kit: true, gain: 0.1, from: 0.35 },
        snap: { kit: true, gain: 0.16, from: 0.5 },
        beep: { wave: "sine", gain: 0.1, decay: 0.12, sustain: 0.2 },
        stab: { wave: "sawtooth", gain: 0.05, decay: 0.1, sustain: 0.3, from: 0.75 },
        lead2: { wave: "pulse", duty: 0.125, gain: 0.06, decay: 0.08, sustain: 0.3, from: 0.9 },
      },
      patterns: {
        A: {
          lead:
          "D5 . . F5 . . A5 . . F5 . . E5 . D5 . | Bb4 . . D5 . . F5 . . D5 . . C5 . Bb4 . | " +
          "G4 . . Bb4 . . D5 . . Bb4 . . A4 . G4 . | A4 . . C#5 . . E5 . . A5 . G5 . F5 . E5",
          bass:
          "D2 . D2 . D2 . D2 . D2 . D2 . D2 . D2 . | Bb1 . Bb1 . Bb1 . Bb1 . Bb1 . Bb1 . Bb1 . Bb1 . | " +
          "G1 . G1 . G1 . G1 . G1 . G1 . G1 . G1 . | A1 . A1 . A1 . A1 . A1 . A1 . A1 . A1 .",
          kick:
          "k . . . k . . . k . . . k . . . | k . . . k . . . k . . . k . . . | " +
          "k . . . k . . . k . . . k . . . | k . . . k . . . k . . . k . . .",
          hat:
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h . | " +
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h .",
          snap:
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . . | " +
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . .",
          beep:
          "E6 . . . . . . . . . . . . . . . | E6 . . . . . . . . . . . . . . . | " +
          "E6 . . . . . . . . . . . . . . . | E6 . . . . . . . . . . . . . . .",
          stab:
          "D4^037 . . . . . . . . . . . . . . . | Bb3^047 . . . . . . . . . . . . . . . | " +
          "G3^037 . . . . . . . . . . . . . . . | A3^047 . . . . . . . . . . . . . . .",
          lead2:
          "D6 . . F6 . . A6 . . F6 . . E6 . D6 . | Bb5 . . D6 . . F6 . . D6 . . C6 . Bb5 . | " +
          "G5 . . Bb5 . . D6 . . Bb5 . . A5 . G5 . | A5 . . C#6 . . E6 . . A6 . G6 . F6 . E6",
        },
        B: {
          lead:
          "A5 . F5 . D5 . F5 . A5 . . D6 . C6 . A5 | F5 . D5 . Bb4 . D5 . F5 . . Bb5 . A5 . F5 | " +
          "D5 . Bb4 . G4 . Bb4 . D5 . . G5 . F5 . D5 | E5 . C#5 . A4 . C#5 . E5 . . A5 . G5 . E5",
          bass:
          "D2 . . D2 . . D2 . D2 . . D2 . . D2 . | Bb1 . . Bb1 . . Bb1 . Bb1 . . Bb1 . . Bb1 . | " +
          "G1 . . G1 . . G1 . G1 . . G1 . . G1 . | A1 . . A1 . . A1 . A1 . . A1 . . A1 .",
          kick:
          "k . . . k . . . k . . . k . . k | k . . . k . . . k . . . k . . k | " +
          "k . . . k . . . k . . . k . . k | k . . . k . . . k . . . k . k k",
          hat:
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h . | " +
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h .",
          snap:
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . . | " +
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . s",
          beep:
          "E6 . . . . . . . E6 . . . . . . . | E6 . . . . . . . E6 . . . . . . . | " +
          "E6 . . . . . . . E6 . . . . . . . | E6 . . . . . . . E6 . . . . . . .",
          stab:
          "D4^037 . . . . . . . D4^037 . . . . . . . | Bb3^047 . . . . . . . Bb3^047 . . . . . . . | " +
          "G3^037 . . . . . . . G3^037 . . . . . . . | A3^047 . . . . . . . A3^047 . . . . . . .",
          lead2:
          "A6 . F6 . D6 . F6 . A6 . . D7 . C7 . A6 | F6 . D6 . Bb5 . D6 . F6 . . Bb6 . A6 . F6 | " +
          "D6 . Bb5 . G5 . Bb5 . D6 . . G6 . F6 . D6 | E6 . C#6 . A5 . C#6 . E6 . . A6 . G6 . E6",
        },
      },
      order: ["A", "A", "B", "A", "B", "B", "A", "B", "A", "A", "B", "B", "A"],
    },
  },
};
