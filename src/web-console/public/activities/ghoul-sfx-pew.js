// Plan2Code Web Console - ghoul: Holy Roller's own sound effects and music track, merged into ghoul-sfx.js; defines only.
//
// Same shape and rules as ghoul-sfx-sled.js: `tones` (a `ghoul<Kind><Act>` sound for the runner's
// moves and things, each under 1.2 s) and `music` (a track for the room, named in ROOM_MUSIC in ghoul.js).
// The sounds and the track are first drafts in the house's tone layers; they are still to be
// picked by ear. A name may be defined only once across tones.js and every game's file. No imports.

export const PEW_SFX = {
  tones: {
    // Lane change: a quick whoosh as the pew slides across.
    ghoulPewLane: {
      layers: [
        { type: "noise", seconds: 0.16, attack: 0.04, gain: 0.4, filter: { type: "bandpass", from: 600, to: 2400, q: 1.4 } },
        { type: "triangle", from: 180, to: 260, seconds: 0.12, attack: 0.01, gain: 0.18 },
      ],
    },
    // A lane press at the edge: a tiny bump on the chapel wall.
    ghoulPewBump: {
      layers: [
        { type: "sine", from: 120, to: 70, seconds: 0.1, attack: 0, gain: 0.6 },
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.25, filter: { type: "lowpass", from: 900, to: 400, q: 1 } },
      ],
    },
    // Jump: wood creak and a lift.
    ghoulPewJump: {
      layers: [
        { type: "noise", seconds: 0.18, attack: 0.05, gain: 0.3, filter: { type: "bandpass", from: 700, to: 1800, q: 4 } },
        { type: "triangle", from: 240, to: 420, seconds: 0.2, attack: 0.02, gain: 0.3 },
      ],
    },
    // Landing: a wooden thump.
    ghoulPewLand: {
      layers: [
        { type: "sine", from: 130, to: 55, seconds: 0.14, attack: 0, gain: 0.8 },
        { type: "noise", seconds: 0.06, attack: 0, gain: 0.4, filter: { type: "bandpass", from: 900, to: 500, q: 3 } },
      ],
    },
    // Slide: a scrape of wood on stone.
    ghoulPewSlide: {
      layers: [
        { type: "noise", seconds: 0.4, attack: 0.03, gain: 0.42, filter: { type: "bandpass", from: 2200, to: 900, q: 2 } },
        { type: "sawtooth", from: 110, to: 80, seconds: 0.35, attack: 0.02, gain: 0.1, filter: { type: "lowpass", from: 700, to: 300, q: 1 } },
      ],
    },
    // Down in the air, a fast fall: a falling whistle.
    ghoulPewDive: {
      layers: [
        { type: "sine", from: 900, to: 260, seconds: 0.2, attack: 0.01, gain: 0.2 },
        { type: "noise", seconds: 0.18, attack: 0.02, gain: 0.2, filter: { type: "highpass", from: 1200, to: 1200, q: 1 } },
      ],
    },
    // A wax soul taken: a bright tick (the art raises its pitch with the combo).
    ghoulPewSoul: {
      layers: [
        { type: "sine", from: 880, to: 880, seconds: 0.1, attack: 0.003, gain: 0.3 },
        { type: "triangle", from: 1760, to: 1760, seconds: 0.08, attack: 0.003, gain: 0.12 },
        { type: "noise", seconds: 0.02, attack: 0, gain: 0.1, filter: { type: "highpass", from: 5000, to: 5000, q: 1 } },
      ],
    },
    // A halo caught: a rising shimmer.
    ghoulPewHalo: {
      layers: [
        { type: "sine", from: 660, to: 1320, seconds: 0.5, attack: 0.01, gain: 0.28 },
        { type: "sine", from: 990, to: 1980, seconds: 0.5, attack: 0.01, gain: 0.16, delay: 0.04 },
        { type: "sine", from: 1320, to: 2640, seconds: 0.4, attack: 0.01, gain: 0.1, delay: 0.08 },
      ],
    },
    // A hit: splintering wood and a sour organ chord.
    ghoulPewCrash: {
      layers: [
        { type: "sine", from: 96, to: 34, seconds: 0.25, attack: 0, gain: 0.95 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.7, filter: { type: "lowpass", from: 300, to: 260, q: 1 } },
        { type: "noise", seconds: 0.3, attack: 0.04, gain: 0.4, delay: 0.02, filter: { type: "bandpass", from: 1200, to: 3200, q: 2 } },
        { type: "sawtooth", from: 196, to: 190, seconds: 0.5, attack: 0.02, gain: 0.2, delay: 0.05, filter: { type: "lowpass", from: 900, to: 500, q: 1 } },
        { type: "sawtooth", from: 208, to: 200, seconds: 0.5, attack: 0.02, gain: 0.2, delay: 0.05, filter: { type: "lowpass", from: 900, to: 500, q: 1 } },
        { type: "sawtooth", from: 233, to: 225, seconds: 0.5, attack: 0.02, gain: 0.2, delay: 0.05, filter: { type: "lowpass", from: 900, to: 500, q: 1 } },
      ],
    },
    // Checkpoint: two chapel bell strokes.
    ghoulPewCheck: {
      layers: [
        { type: "sine", from: 784, to: 776, seconds: 0.4, attack: 0.003, gain: 0.3 },
        { type: "sine", from: 2093, to: 2070, seconds: 0.2, attack: 0.003, gain: 0.12 },
        { type: "sine", from: 988, to: 980, seconds: 0.5, attack: 0.003, gain: 0.3, delay: 0.16 },
        { type: "sine", from: 2637, to: 2610, seconds: 0.25, attack: 0.003, gain: 0.12, delay: 0.16 },
      ],
    },
    // Finish: an organ fanfare, a major chord.
    ghoulPewFinish: {
      layers: [
        { type: "square", seconds: 1, attack: 0.02, gain: 0.2, notes: [262, 330, 392, 523], filter: { type: "lowpass", from: 1600, to: 1600, q: 1 } },
        { type: "triangle", seconds: 1, attack: 0.02, gain: 0.4, notes: [131, 165, 196, 262] },
        { type: "sine", seconds: 1, attack: 0.02, gain: 0.2, notes: [523, 659, 784, 1047] },
      ],
    },
    // The ride picks up speed: an organ swell, rising.
    ghoulPewSpeed: {
      layers: [
        { type: "sawtooth", from: 147, to: 294, seconds: 0.7, attack: 0.3, gain: 0.2, filter: { type: "lowpass", from: 600, to: 1600, q: 1 } },
        { type: "sawtooth", from: 220, to: 440, seconds: 0.7, attack: 0.3, gain: 0.14, filter: { type: "lowpass", from: 600, to: 1600, q: 1 } },
        { type: "noise", seconds: 0.6, attack: 0.3, gain: 0.18, filter: { type: "bandpass", from: 500, to: 3000, q: 1.5 } },
      ],
    },
    // Gargoyle: a stone gargoyle in the arches. It shudders (grinding stone) ...
    ghoulPewGargWarn: {
      layers: [
        { type: "brown", seconds: 0.45, attack: 0.05, gain: 0.5, filter: { type: "bandpass", from: 300, to: 700, q: 3 } },
        { type: "sawtooth", from: 92, to: 70, seconds: 0.45, attack: 0.05, gain: 0.3, vibrato: { rate: 18, depth: 0.12 }, filter: { type: "lowpass", from: 500, to: 300, q: 2 } },
      ],
    },
    // ... drops into the lane (a heavy stone thud) ...
    ghoulPewGargDrop: {
      layers: [
        { type: "sine", from: 74, to: 28, seconds: 0.3, attack: 0, gain: 1 },
        { type: "brown", seconds: 0.25, attack: 0, gain: 0.8, filter: { type: "lowpass", from: 240, to: 200, q: 1 } },
        { type: "noise", seconds: 0.1, attack: 0, gain: 0.35, delay: 0.02, filter: { type: "bandpass", from: 1400, to: 800, q: 2 } },
      ],
    },
    // ... a first bolt chips it (a stone crack) ...
    ghoulPewGargChip: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.6, filter: { type: "bandpass", from: 2200, to: 1400, q: 3 } },
        { type: "square", from: 520, to: 300, seconds: 0.04, attack: 0, gain: 0.2 },
      ],
    },
    // ... and the second bolt breaks it: stone cracking apart.
    ghoulPewGargHit: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.8, filter: { type: "bandpass", from: 1800, to: 1000, q: 2 } },
        { type: "square", from: 600, to: 200, seconds: 0.05, attack: 0, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.07, attack: 0, gain: 0.5, filter: { type: "bandpass", from: 2600, to: 1600, q: 3 } },
        { type: "brown", seconds: 0.3, attack: 0.02, gain: 0.5, delay: 0.04, filter: { type: "lowpass", from: 500, to: 200, q: 1 } },
      ],
    },
    // Bell rope: shoot it and the bell rings, a deep stroke, and the gargoyles ahead are stunned.
    ghoulPewBell: {
      layers: [
        { type: "sine", from: 392, to: 386, seconds: 1.1, attack: 0.004, gain: 0.5 },
        { type: "sine", from: 784, to: 772, seconds: 0.9, attack: 0.004, gain: 0.22 },
        { type: "sine", from: 1180, to: 1160, seconds: 0.6, attack: 0.004, gain: 0.14 },
        { type: "sine", from: 1990, to: 1960, seconds: 0.35, attack: 0.004, gain: 0.08 },
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.4, filter: { type: "bandpass", from: 3000, to: 2000, q: 3 } },
      ],
    },
  },
  music: {
    // Holy Roller: the organist's chase. A driving D minor organ ride at 132 beats a minute (the pulse the
    // art throbs in the pillars and windows): four on the floor, a pedal bass in eighths, organ chords on the
    // off-beats, a reed line that climbs through the bars, and a bell stroke on the backbeat. Built to loop:
    // two four-bar phrases that answer each other, round and round.
    ghoulPewDirge: {
      bpm: 132,
      rush: 0,
      voices: {
        organ: { wave: "square", gain: 0.045, decay: 0.12, sustain: 0.6, vibrato: { rate: 5, depth: 0.01, delay: 0.2 } },
        reed: { wave: "sawtooth", gain: 0.04, decay: 0.12, sustain: 0.6, vibrato: { rate: 5.5, depth: 0.018, delay: 0.2 } },
        pedal: { wave: "triangle", gain: 0.42, decay: 0.2, sustain: 0.7 },
        kick: { kit: true, gain: 0.22, from: 0 },
        toll: { kit: true, gain: 0.12, from: 0.35 },
      },
      patterns: {
        A: {
          organ:
            ". . D4^037 - . . D4^037 - . . D4^037 - . . D4^037 - | " +
            ". . Bb3^047 - . . Bb3^047 - . . Bb3^047 - . . Bb3^047 - | " +
            ". . G3^037 - . . G3^037 - . . G3^037 - . . G3^037 - | " +
            ". . A3^047 - . . A3^047 - . . A3^047 - . . A3^047 -",
          reed:
            "D5 - F5 - A5 - F5 - D5 - F5 - A5 - F5 - | " +
            "D5 - F5 - Bb5 - F5 - D5 - F5 - Bb5 - F5 - | " +
            "D5 - G5 - Bb5 - G5 - D5 - G5 - Bb5 - G5 - | " +
            "E5 - A5 - C#6 - A5 - E5 - A5 - C#6 - A5 -",
          pedal:
            "D2 - D2 - D2 - D2 - D2 - D2 - D2 - D2 - | " +
            "Bb1 - Bb1 - Bb1 - Bb1 - Bb1 - Bb1 - Bb1 - Bb1 - | " +
            "G1 - G1 - G1 - G1 - G1 - G1 - G1 - G1 - | " +
            "A1 - A1 - A1 - A1 - A1 - A1 - A1 - A1 -",
          kick:
            "k . . . k . . . k . . . k . . . | " +
            "k . . . k . . . k . . . k . . . | " +
            "k . . . k . . . k . . . k . . . | " +
            "k . . . k . . . k . . . k . . .",
          toll:
            ". . . . s . . . . . . . s . . . | " +
            ". . . . s . . . . . . . s . . . | " +
            ". . . . s . . . . . . . s . . . | " +
            ". . . . s . . . . . . . s . s .",
        },
        B: {
          organ:
            ". . F4^037 - . . F4^037 - . . F4^037 - . . F4^037 - | " +
            ". . G3^037 - . . G3^037 - . . G3^037 - . . G3^037 - | " +
            ". . Bb3^047 - . . Bb3^047 - . . Bb3^047 - . . Bb3^047 - | " +
            ". . A3^047 - . . A3^047 - . . A3^047 - . . A3^047 -",
          reed:
            "A5 - F5 - A5 - D6 - A5 - F5 - A5 - D6 - | " +
            "G5 - D5 - G5 - Bb5 - G5 - D5 - G5 - Bb5 - | " +
            "F5 - D5 - F5 - Bb5 - F5 - D5 - F5 - Bb5 - | " +
            "E5 - A5 - C#6 - E6 - D6 - A5 - F5 - A4 -",
          pedal:
            "F1 - F1 - F1 - F1 - F1 - F1 - F1 - F1 - | " +
            "G1 - G1 - G1 - G1 - G1 - G1 - G1 - G1 - | " +
            "Bb1 - Bb1 - Bb1 - Bb1 - Bb1 - Bb1 - Bb1 - Bb1 - | " +
            "A1 - A1 - A1 - A1 - A1 - A1 - A1 - A1 -",
          kick:
            "k . . . k . . . k . . . k . . . | " +
            "k . . . k . . . k . . . k . . . | " +
            "k . . . k . . . k . . . k . . . | " +
            "k . . . k . . . k . . . k . k .",
          toll:
            ". . . . s . . . . . . . s . . . | " +
            ". . . . s . . . . . . . s . . . | " +
            ". . . . s . . . . . . . s . . . | " +
            ". . . . s . . . . . . . s . . .",
        },
      },
      order: ["A", "B", "A", "B", "A", "B"],
    },
  },
};
