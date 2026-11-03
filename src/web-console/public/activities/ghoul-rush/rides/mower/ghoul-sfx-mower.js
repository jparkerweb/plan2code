// Plan2Code Web Console - ghoul: The Gardener's Revenge's own sound effects and music track, merged into ghoul-sfx.js; defines only.
//
// Same shape and rules as ghoul-sfx-sled.js: `tones` (a `ghoulMower<Act>` sound for the
// mower's things, each under 1.2 s, built only from the house's tone layers) and `music` (a
// track for the room, `ghoulMowerRide`, named in ROOM_MUSIC in ghoul.js). The sounds and the
// track are first drafts, to be picked by ear. A name may be defined only once across tones.js
// and every game's file. No imports.

export const MOWER_SFX = {
  tones: {
    // The Gardener's Revenge: the bonus ride: you mow a long lawn on a haunted ride-on mower, jumping, ducking, shooting and cutting.
    // Jump: the engine revs as the deck bounces up.
    ghoulMowerJump: {
      layers: [
        { type: "sawtooth", from: 70, to: 150, seconds: 0.3, attack: 0.02, gain: 0.5, vibrato: { rate: 22, depth: 0.1 }, filter: { type: "lowpass", from: 900, to: 1500, q: 2 } },
        { type: "noise", seconds: 0.2, attack: 0.06, gain: 0.3, filter: { type: "bandpass", from: 500, to: 1800, q: 1.5 } },
        { type: "triangle", from: 180, to: 320, seconds: 0.18, attack: 0.01, gain: 0.3 },
      ],
    },
    // Land: a clunk of the deck and a rattle of the chassis.
    ghoulMowerLand: {
      layers: [
        { type: "sine", from: 110, to: 50, seconds: 0.14, attack: 0, gain: 0.8 },
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.5, filter: { type: "bandpass", from: 1600, to: 900, q: 5 } },
        { type: "square", from: 330, to: 270, seconds: 0.03, delay: 0.04, gain: 0.14 },
        { type: "noise", seconds: 0.05, delay: 0.08, attack: 0, gain: 0.4, filter: { type: "bandpass", from: 1300, to: 800, q: 6 } },
      ],
    },
    // Duck: a quick swish under a branch.
    ghoulMowerDuck: {
      layers: [
        { type: "noise", seconds: 0.18, attack: 0.06, gain: 0.5, filter: { type: "bandpass", from: 350, to: 1900, q: 1.5 } },
      ],
    },
    // Crash: a clang of metal, a thud and a rattle of loose parts.
    ghoulMowerCrash: {
      layers: [
        { type: "sine", from: 90, to: 34, seconds: 0.25, attack: 0, gain: 1 },
        { type: "square", from: 520, to: 300, seconds: 0.12, attack: 0, gain: 0.22, filter: { type: "bandpass", from: 800, to: 500, q: 3 } },
        { type: "noise", seconds: 0.3, attack: 0.01, gain: 0.45, delay: 0.02, filter: { type: "bandpass", from: 2200, to: 700, q: 2 } },
        { type: "noise", seconds: 0.04, delay: 0.16, attack: 0, gain: 0.5, filter: { type: "bandpass", from: 1500, to: 1000, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.23, attack: 0, gain: 0.4, filter: { type: "bandpass", from: 1900, to: 1200, q: 6 } },
      ],
    },
    // Checkpoint: a rusty bicycle bell, twice.
    ghoulMowerCheck: {
      layers: [
        { type: "sine", from: 1976, to: 1960, seconds: 0.25, attack: 0.003, gain: 0.3 },
        { type: "sine", from: 4150, to: 4100, seconds: 0.12, attack: 0.003, gain: 0.12 },
        { type: "sine", from: 1976, to: 1960, seconds: 0.3, attack: 0.003, gain: 0.3, delay: 0.14 },
        { type: "sine", from: 4150, to: 4100, seconds: 0.14, attack: 0.003, gain: 0.12, delay: 0.14 },
      ],
    },
    // Finish: the engine coughs, rattles and dies, then a triumphant ding.
    ghoulMowerFinish: {
      layers: [
        { type: "sawtooth", from: 120, to: 40, seconds: 0.7, attack: 0.01, gain: 0.5, vibrato: { rate: 14, depth: 0.2 }, filter: { type: "lowpass", from: 700, to: 200, q: 2 } },
        { type: "noise", seconds: 0.5, attack: 0.05, gain: 0.25, filter: { type: "bandpass", from: 900, to: 300, q: 1.5 } },
        { type: "triangle", seconds: 0.5, attack: 0.01, delay: 0.6, gain: 0.5, notes: [659, 880, 1175] },
      ],
    },
    // Grass: the blades biting a swathe, a quick chatter.
    ghoulMowerGrass: {
      layers: [
        { type: "noise", seconds: 0.1, attack: 0.02, gain: 0.4, filter: { type: "bandpass", from: 3200, to: 1800, q: 2.5 } },
        { type: "sawtooth", from: 200, to: 170, seconds: 0.08, attack: 0.005, gain: 0.2, vibrato: { rate: 40, depth: 0.15 }, filter: { type: "lowpass", from: 1200, to: 900, q: 1 } },
      ],
    },
    // Hedge: the blades chop a thorn hedge, a crunch with a thunk.
    ghoulMowerHedge: {
      layers: [
        { type: "noise", seconds: 0.18, attack: 0.005, gain: 0.7, filter: { type: "bandpass", from: 2400, to: 800, q: 1.5 } },
        { type: "square", from: 260, to: 110, seconds: 0.1, attack: 0, gain: 0.3, filter: { type: "lowpass", from: 1200, to: 500, q: 1 } },
        { type: "brown", seconds: 0.2, attack: 0.01, gain: 0.6, filter: { type: "lowpass", from: 500, to: 300, q: 1 } },
        { type: "triangle", seconds: 0.2, delay: 0.1, attack: 0.005, gain: 0.35, notes: [784, 1047] },
      ],
    },
    // Weed: a small pop of a weed patch.
    ghoulMowerWeed: {
      layers: [
        { type: "sine", from: 500, to: 950, seconds: 0.08, attack: 0.002, gain: 0.5 },
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.3, filter: { type: "bandpass", from: 2600, to: 2000, q: 3 } },
      ],
    },
    // Jam: the blades overheat: a clank, a grind winding down and a long hiss of steam.
    ghoulMowerJam: {
      layers: [
        { type: "square", from: 140, to: 60, seconds: 0.2, attack: 0, gain: 0.4, filter: { type: "lowpass", from: 900, to: 400, q: 3 } },
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.6, filter: { type: "bandpass", from: 1400, to: 900, q: 5 } },
        { type: "sawtooth", from: 190, to: 50, seconds: 0.6, attack: 0.02, delay: 0.05, gain: 0.35, vibrato: { rate: 18, depth: 0.3 }, filter: { type: "lowpass", from: 800, to: 150, q: 2 } },
        { type: "noise", seconds: 0.8, attack: 0.1, delay: 0.1, gain: 0.3, filter: { type: "highpass", from: 3500, to: 5000 } },
      ],
    },
    // Topiary Beast: a bush that comes alive and lunges across the lane, snapping its hedge-trimmed jaws.
    // Warn: leaves rustle and shake.
    ghoulMowerBeastWarn: {
      layers: [
        { type: "noise", seconds: 0.4, attack: 0.15, gain: 0.4, filter: { type: "bandpass", from: 1800, to: 3200, q: 1.5 }, vibrato: { rate: 24, depth: 0.2 } },
        { type: "pink", seconds: 0.4, attack: 0.2, gain: 0.25, filter: { type: "bandpass", from: 900, to: 1500, q: 1 } },
      ],
    },
    // Snap: the lunge and two clacks of the shears.
    ghoulMowerBeastSnap: {
      layers: [
        { type: "noise", seconds: 0.2, attack: 0.06, gain: 0.45, filter: { type: "bandpass", from: 600, to: 2400, q: 1.5 } },
        { type: "square", from: 880, to: 300, seconds: 0.04, delay: 0.1, attack: 0, gain: 0.35 },
        { type: "noise", seconds: 0.04, delay: 0.1, attack: 0, gain: 0.55, filter: { type: "bandpass", from: 3000, to: 2000, q: 4 } },
        { type: "square", from: 780, to: 260, seconds: 0.04, delay: 0.22, attack: 0, gain: 0.35 },
        { type: "noise", seconds: 0.04, delay: 0.22, attack: 0, gain: 0.55, filter: { type: "bandpass", from: 2800, to: 1900, q: 4 } },
      ],
    },
    // Hit: a bolt strikes it: a leafy thwack.
    ghoulMowerBeastHit: {
      layers: [
        { type: "noise", seconds: 0.06, attack: 0, gain: 0.7, filter: { type: "bandpass", from: 1800, to: 1000, q: 2 } },
        { type: "square", from: 640, to: 220, seconds: 0.05, attack: 0, gain: 0.3 },
        { type: "pink", seconds: 0.15, delay: 0.03, attack: 0.02, gain: 0.3, filter: { type: "bandpass", from: 1400, to: 800, q: 1 } },
      ],
    },
    // Break: it is trimmed to a stump: a crunch of cut branches.
    ghoulMowerBeastBreak: {
      layers: [
        { type: "noise", seconds: 0.3, attack: 0.01, gain: 0.7, filter: { type: "bandpass", from: 2600, to: 700, q: 1.5 } },
        { type: "brown", seconds: 0.25, attack: 0.01, gain: 0.6, filter: { type: "lowpass", from: 500, to: 250, q: 1 } },
        { type: "square", from: 500, to: 160, seconds: 0.08, attack: 0, gain: 0.3 },
        { type: "triangle", seconds: 0.3, delay: 0.1, attack: 0.005, gain: 0.35, notes: [988, 1319, 1760] },
      ],
    },
  },
  music: {
    // The Gardener's Revenge: a sputtering waltz-march. A reedy pulse lead walks an E minor
    // figure over a chugging two-stroke bass (a bass note on every beat's offbeat, like an
    // engine), a kick and a snare crack on the backbeat; a thin siren-like wheeze joins as the
    // dread grows. The bridge drops the drums for a creeping line.
    ghoulMowerRide: {
      bpm: 138,
      rush: 8,
      voices: {
        lead: { wave: "pulse", duty: 0.25, gain: 0.1, decay: 0.12, sustain: 0.45 },
        bass: { wave: "triangle", gain: 0.42, decay: 0.08, sustain: 0.5 },
        chug: { wave: "sawtooth", gain: 0.07, decay: 0.06, sustain: 0.2, from: 0.15 },
        kick: { kit: true, gain: 0.26, from: 0.2 },
        hat: { kit: true, gain: 0.1, from: 0.35 },
        snap: { kit: true, gain: 0.16, from: 0.5 },
        wheeze: { wave: "sawtooth", gain: 0.03, decay: 0.3, sustain: 1, from: 0.75, vibrato: { rate: 0.7, depth: 0.05, delay: 0 } },
      },
      patterns: {
        A: {
          lead:
          "E4 . G4 . B4 . G4 . E4 . G4 . B4 . G4 . | E4 . G4 . A4 . F#4 . E4 . G4 . A4 . F#4 . | " +
          "E4 . G4 . B4 . D5 . B4 . G4 . B4 . D5 . | C5 . B4 . A4 . G4 . F#4 . . . B4 . . .",
          bass:
          "E2 . . E2 . . E2 . E2 . . E2 . . E2 . | E2 . . E2 . . E2 . E2 . . E2 . . E2 . | " +
          "C2 . . C2 . . C2 . C2 . . C2 . . C2 . | B1 . . B1 . . B1 . B1 . . B1 . . B1 .",
          chug:
          ". . E3 . . . E3 . . . E3 . . . E3 . | . . E3 . . . E3 . . . E3 . . . E3 . | " +
          ". . C3 . . . C3 . . . C3 . . . C3 . | . . B2 . . . B2 . . . B2 . . . B2 .",
          kick:
          "k . . . . . k . k . . . . . k . | k . . . . . k . k . . . . . k . | " +
          "k . . . . . k . k . . . . . k . | k . . . . . k . k . . . . . k .",
          hat:
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h . | " +
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h .",
          snap:
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . . | " +
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . .",
          wheeze:
          "B3 - - - - - - - - - - - - - - - | A3 - - - - - - - - - - - - - - - | " +
          "G3 - - - - - - - - - - - - - - - | F#3 - - - - - - - - - - - - - - -",
        },
        B: {
          lead:
          "B4 . D5 . E5 . D5 . B4 . D5 . E5 . G5 . | F#5 . E5 . D5 . B4 . A4 . B4 . D5 . . . | " +
          "E5 . D5 . B4 . D5 . E5 . G5 . E5 . D5 . | C5 . D5 . B4 . A4 . B4 . . . . . . .",
          bass:
          "E2 . . E2 . . E2 . E2 . . E2 . . E2 . | A1 . . A1 . . A1 . A1 . . A1 . . A1 . | " +
          "C2 . . C2 . . C2 . C2 . . C2 . . C2 . | B1 . . B1 . . B1 . B1 . . B1 . . B1 .",
          chug:
          ". . E3 . . . E3 . . . E3 . . . E3 . | . . A2 . . . A2 . . . A2 . . . A2 . | " +
          ". . C3 . . . C3 . . . C3 . . . C3 . | . . B2 . . . B2 . . . B2 . . . B2 .",
          kick:
          "k . . . . . k . k . . . . . k . | k . . . . . k . k . . . . . k . | " +
          "k . . . . . k . k . . . . . k . | k . . . . . k . k . . . k . k .",
          hat:
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h . | " +
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . h . h .",
          snap:
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . . | " +
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . s s",
          wheeze:
          "E4 - - - - - - - - - - - - - - - | C#4 - - - - - - - - - - - - - - - | " +
          "C4 - - - - - - - - - - - - - - - | B3 - - - - - - - - - - - - - - -",
        },
        C: {
          lead:
          "E4 . . . G4 . . . B4 . . . G4 . . . | A4 . . . F#4 . . . E4 . . . . . . . | " +
          "E4 . . . G4 . . . B4 . . . D5 . . . | C5 . . . B4 . . . A4 . . . . . . .",
          bass:
          "E2 . . . . . . . E2 . . . . . . . | A1 . . . . . . . A1 . . . . . . . | " +
          "C2 . . . . . . . C2 . . . . . . . | B1 . . . . . . . B1 . . . . . . .",
          chug:
          ". . . . . . E3 . . . . . . . E3 . | . . . . . . A2 . . . . . . . A2 . | " +
          ". . . . . . C3 . . . . . . . C3 . | . . . . . . B2 . . . . . . . B2 .",
          kick:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          hat:
          ". . . . h . . . . . . . h . . . | . . . . h . . . . . . . h . . . | " +
          ". . . . h . . . . . . . h . . . | . . . . h . . . . . . . h . . .",
          snap:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          wheeze:
          "B3 - - - - - - - - - - - - - - - | A3 - - - - - - - - - - - - - - - | " +
          "G3 - - - - - - - - - - - - - - - | F#3 - - - - - - - - - - - - - - -",
        },
      },
      order: ["A", "A", "B", "A", "C", "B", "A", "B", "C"],
    },
  },
};
