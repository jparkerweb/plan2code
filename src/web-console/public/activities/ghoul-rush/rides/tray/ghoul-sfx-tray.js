// Plan2Code Web Console - ghoul: The Servants' Back Stairs' own sound effects and music track, merged into ghoul-sfx.js; defines only.
//
// Same shape and rules as ghoul-sfx-sled.js: `tones` (a `ghoulTray<Act>` sound for the tray's
// things, named in ghoul-tray-draw.js's VOICES) and `music` (the room's track, named in
// ROOM_MUSIC in ghoul.js). Made from the house tone layers only; no tone is longer than 1.2 s.
// Sound and music picks are still pending (these are first drafts to be picked by ear). A name
// may be defined only once across tones.js and every game's file. No imports.

export const TRAY_SFX = {
  tones: {
    // The Servants' Back Stairs: the bonus ride: you rush down the back stairs and through the kitchens on a silver tray.
    // Jumps: A tin clank and a whoosh.
    ghoulTrayJump: {
      layers: [
        { type: "square", from: 560, to: 320, seconds: 0.06, attack: 0, gain: 0.16 },
        { type: "noise", seconds: 0.2, attack: 0.06, gain: 0.34, filter: { type: "bandpass", from: 2800, to: 1300, q: 5 } },
        { type: "noise", seconds: 0.28, attack: 0.1, gain: 0.3, delay: 0.04, filter: { type: "bandpass", from: 300, to: 1700, q: 1.5 } },
      ],
    },
    // Lands: Cutlery clatter.
    ghoulTrayLand: {
      layers: [
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.54, filter: { type: "bandpass", from: 2400, to: 1900, q: 7 } },
        { type: "triangle", from: 880, to: 700, seconds: 0.05, gain: 0.2 },
        { type: "noise", seconds: 0.04, delay: 0.05, attack: 0, gain: 0.5, filter: { type: "bandpass", from: 3100, to: 2500, q: 7 } },
        { type: "noise", seconds: 0.04, delay: 0.09, attack: 0, gain: 0.46, filter: { type: "bandpass", from: 1900, to: 1500, q: 7 } },
        { type: "noise", seconds: 0.3, attack: 0.09, gain: 0.26, delay: 0.1, filter: { type: "bandpass", from: 3500, to: 1800, q: 4 } },
      ],
    },
    // Launches off the last shelf: A big whoosh and a rising ting.
    ghoulTrayLaunch: {
      layers: [
        { type: "noise", seconds: 0.8, attack: 0.3, gain: 0.5, filter: { type: "bandpass", from: 400, to: 2600, q: 2 } },
        { type: "sine", from: 400, to: 1200, seconds: 0.5, attack: 0.1, gain: 0.36, vibrato: { rate: 6, depth: 0.05 } },
        { type: "sine", from: 2093, to: 2093, seconds: 0.4, attack: 0.003, gain: 0.2, delay: 0.5 },
      ],
    },
    // Ducks: A quick swish.
    ghoulTrayDuck: {
      layers: [
        { type: "noise", seconds: 0.18, attack: 0.06, gain: 0.5, filter: { type: "bandpass", from: 500, to: 2400, q: 1.5 } },
      ],
    },
    // Crash: A pot dropped down the stairs.
    ghoulTrayCrash: {
      layers: [
        { type: "sine", from: 110, to: 38, seconds: 0.25, attack: 0, gain: 1 },
        { type: "square", from: 720, to: 380, seconds: 0.08, attack: 0, gain: 0.22 },
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.7, delay: 0.02, filter: { type: "bandpass", from: 1800, to: 1400, q: 6 } },
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.6, delay: 0.09, filter: { type: "bandpass", from: 2300, to: 1700, q: 6 } },
        { type: "noise", seconds: 0.4, attack: 0.12, gain: 0.3, delay: 0.05, filter: { type: "bandpass", from: 1400, to: 3200, q: 2 } },
      ],
    },
    // Checkpoint: A service bell, ding ding.
    ghoulTrayCheck: {
      layers: [
        { type: "sine", from: 1760, to: 1750, seconds: 0.5, attack: 0.003, gain: 0.34 },
        { type: "sine", from: 3520, to: 3500, seconds: 0.35, attack: 0.003, gain: 0.16 },
        { type: "sine", from: 5280, to: 5250, seconds: 0.2, attack: 0.003, gain: 0.08 },
        { type: "sine", from: 1760, to: 1750, seconds: 0.5, attack: 0.003, gain: 0.34, delay: 0.14 },
        { type: "sine", from: 3520, to: 3500, seconds: 0.35, attack: 0.003, gain: 0.16, delay: 0.14 },
      ],
    },
    // Finish: A fanfare, and plates ringing.
    ghoulTrayFinish: {
      layers: [
        { type: "triangle", seconds: 0.9, attack: 0.01, gain: 0.7, notes: [392, 494, 587, 784] },
        { type: "sine", seconds: 0.9, attack: 0.01, gain: 0.25, notes: [784, 988, 1175, 1568] },
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.4, delay: 0.7, filter: { type: "highpass", from: 3500, to: 3500, q: 1 } },
      ],
    },
    // A silver dome: Run through it and it chimes up the scale.
    ghoulTrayDome: {
      layers: [
        { type: "sine", from: 2637, to: 2620, seconds: 0.28, attack: 0.003, gain: 0.3 },
        { type: "sine", from: 3951, to: 3930, seconds: 0.22, attack: 0.003, gain: 0.2, delay: 0.06 },
        { type: "sine", from: 5274, to: 5250, seconds: 0.18, attack: 0.003, gain: 0.14, delay: 0.12 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.3, filter: { type: "highpass", from: 5000, to: 5000, q: 1 } },
      ],
    },
    // A flying plate: Caught with a china clink and a sweet chime.
    ghoulTrayPlate: {
      layers: [
        { type: "sine", from: 3322, to: 3300, seconds: 0.12, attack: 0.002, gain: 0.3 },
        { type: "sine", from: 4435, to: 4400, seconds: 0.08, attack: 0.002, gain: 0.2, delay: 0.03 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.35, filter: { type: "highpass", from: 4000, to: 4000, q: 1 } },
        { type: "sine", from: 1568, to: 1560, seconds: 0.3, attack: 0.003, gain: 0.3, delay: 0.1 },
        { type: "sine", from: 2093, to: 2085, seconds: 0.4, attack: 0.003, gain: 0.3, delay: 0.17 },
      ],
    },
    // Spectral cook: A cook who winds up to fling a dish at you (shoot him, or jump the dish).
    // Appears: A hollow, hungry groan.
    ghoulTrayCookUp: {
      layers: [
        { type: "sawtooth", from: 170, to: 105, seconds: 0.5, attack: 0.06, gain: 0.3, vibrato: { rate: 6, depth: 0.08 }, filter: { type: "lowpass", from: 800, to: 400, q: 2 } },
        { type: "pink", seconds: 0.5, attack: 0.1, gain: 0.14, filter: { type: "bandpass", from: 520, to: 300, q: 1 } },
      ],
    },
    // Flings the dish: A whoosh.
    ghoulTrayToss: {
      layers: [
        { type: "noise", seconds: 0.3, attack: 0.1, gain: 0.4, filter: { type: "bandpass", from: 700, to: 2200, q: 2 } },
        { type: "triangle", from: 300, to: 520, seconds: 0.15, attack: 0.01, gain: 0.2 },
      ],
    },
    // Shot: A pop and a sigh.
    ghoulTrayCookHit: {
      layers: [
        { type: "sine", from: 620, to: 190, seconds: 0.1, attack: 0, gain: 0.6 },
        { type: "noise", seconds: 0.14, attack: 0, gain: 0.3, filter: { type: "bandpass", from: 1600, to: 600, q: 2 } },
        { type: "sine", from: 230, to: 110, seconds: 0.4, attack: 0.02, gain: 0.3, delay: 0.05, vibrato: { rate: 5, depth: 0.1 } },
      ],
    },
    // A dish shot out of the air: China smashing.
    ghoulTrayDishBreak: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.5, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.45, delay: 0.04, filter: { type: "bandpass", from: 4200, to: 3000, q: 5 } },
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.4, delay: 0.09, filter: { type: "bandpass", from: 3400, to: 2400, q: 5 } },
        { type: "square", from: 1400, to: 600, seconds: 0.05, attack: 0, gain: 0.16 },
      ],
    },
  },
  music: {
    // The Servants' Back Stairs: kitchen galop. A clattering, hurried polka for the tray's rush
    // down the back stairs: a pulse lead skipping over a stair-step oompah bass, a tin tick of
    // cutlery on the offbeats, a kick, a hat and the snap of a pan. At high dread a riser and
    // a second lead an octave up join in.
    ghoulTrayRide: {
      bpm: 172,
      rush: 10,
      voices: {
        lead: { wave: "pulse", duty: 0.25, gain: 0.12, decay: 0.08, sustain: 0.35 },
        tin: { wave: "pulse", duty: 0.125, gain: 0.05, decay: 0.03, sustain: 0.2, from: 0.15 },
        bass: { wave: "triangle", gain: 0.4, decay: 0.08, sustain: 0.5 },
        kick: { kit: true, gain: 0.26, from: 0.2 },
        hat: { kit: true, gain: 0.1, from: 0.4 },
        snap: { kit: true, gain: 0.16, from: 0.55 },
        riser: { wave: "sawtooth", gain: 0.035, decay: 0.3, sustain: 1, from: 0.8, vibrato: { rate: 0.6, depth: 0.04, delay: 0 } },
        lead2: { wave: "pulse", duty: 0.25, gain: 0.07, decay: 0.1, sustain: 0.3, from: 0.9 },
      },
      patterns: {
        A: {
          lead:
          "D5 . F5 . A5 . F5 . D5 . F5 . A5 . D6 . | C5 . E5 . G5 . E5 . C5 . E5 . G5 . C6 . | " +
          "Bb4 . D5 . F5 . D5 . Bb4 . D5 . F5 . Bb5 . | A4 . C#5 . E5 . A5 . E5 . C#5 . A4 . . .",
          tin:
          ". D6 . D6 . D6 . D6 . D6 . D6 . D6 . D6 | . C6 . C6 . C6 . C6 . C6 . C6 . C6 . C6 | " +
          ". Bb5 . Bb5 . Bb5 . Bb5 . Bb5 . Bb5 . Bb5 . Bb5 | . A5 . A5 . A5 . A5 . A5 . A5 . A5 . A5",
          bass:
          "D3 . A3 . D3 . A3 . D3 . A3 . D3 . A3 . | C3 . G3 . C3 . G3 . C3 . G3 . C3 . G3 . | " +
          "Bb2 . F3 . Bb2 . F3 . Bb2 . F3 . Bb2 . F3 . | A2 . E3 . A2 . E3 . A2 . E3 . A2 . E3 .",
          kick:
          "k . . . k . . . k . . . k . . . | k . . . k . . . k . . . k . . . | " +
          "k . . . k . . . k . . . k . . . | k . . . k . . . k . . . k . . .",
          hat:
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h . | " +
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h .",
          snap:
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . . | " +
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . .",
          riser:
          "D4 - - - - - - - - - - - - - - - | C4 - - - - - - - - - - - - - - - | " +
          "Bb3 - - - - - - - - - - - - - - - | A3 - - - - - - - - - - - - - - -",
          lead2:
          "D5 D5 D5 D5 F5 F5 F5 F5 A5 A5 A5 A5 . . . . | C5 C5 C5 C5 E5 E5 E5 E5 G5 G5 G5 G5 . . . . | " +
          "Bb4 Bb4 Bb4 Bb4 D5 D5 D5 D5 F5 F5 F5 F5 . . . . | A4 A4 A4 A4 C#5 C#5 C#5 C#5 E5 E5 E5 E5 . . . .",
        },
        B: {
          lead:
          "A5 . F5 . D5 . F5 . A5 . F5 . D5 . A4 . | G5 . E5 . C5 . E5 . G5 . E5 . C5 . G4 . | " +
          "F5 . D5 . Bb4 . D5 . F5 . D5 . Bb4 . F4 . | E5 . C#5 . A4 . C#5 . E5 . C#5 . A4 . . .",
          tin:
          ". D6 . D6 . D6 . D6 . D6 . D6 . D6 . D6 | . C6 . C6 . C6 . C6 . C6 . C6 . C6 . C6 | " +
          ". Bb5 . Bb5 . Bb5 . Bb5 . Bb5 . Bb5 . Bb5 . Bb5 | . A5 . A5 . A5 . A5 . A5 . A5 . A5 . A5",
          bass:
          "D3 . A3 . D3 . A3 . D3 . A3 . D3 . A3 . | C3 . G3 . C3 . G3 . C3 . G3 . C3 . G3 . | " +
          "Bb2 . F3 . Bb2 . F3 . Bb2 . F3 . Bb2 . F3 . | A2 . E3 . A2 . E3 . A2 . E3 . A2 . E3 .",
          kick:
          "k . . . k . . . k . . . k . . . | k . . . k . . . k . . . k . . . | " +
          "k . . . k . . . k . . . k . . . | k . . . k . . . k . . . k . . .",
          hat:
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h . | " +
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h .",
          snap:
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . . | " +
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . .",
          riser:
          "D4 - - - - - - - - - - - - - - - | C4 - - - - - - - - - - - - - - - | " +
          "Bb3 - - - - - - - - - - - - - - - | A3 - - - - - - - - - - - - - - -",
          lead2:
          "A5 A5 A5 A5 F5 F5 F5 F5 D5 D5 D5 D5 . . . . | G5 G5 G5 G5 E5 E5 E5 E5 C5 C5 C5 C5 . . . . | " +
          "F5 F5 F5 F5 D5 D5 D5 D5 Bb4 Bb4 Bb4 Bb4 . . . . | E5 E5 E5 E5 C#5 C#5 C#5 C#5 A4 A4 A4 A4 . . . .",
        },
        C: {
          lead:
          "G5 . Bb5 . D6 . Bb5 . G5 . Bb5 . D6 . G6 . | F5 . A5 . C6 . A5 . F5 . A5 . C6 . F6 . | " +
          "Eb5 . G5 . Bb5 . G5 . Eb5 . G5 . Bb5 . Eb6 . | A5 . C#6 . E6 . C#6 . A5 . E5 . A4 . . .",
          tin:
          ". G6 . G6 . G6 . G6 . G6 . G6 . G6 . G6 | . F6 . F6 . F6 . F6 . F6 . F6 . F6 . F6 | " +
          ". Eb6 . Eb6 . Eb6 . Eb6 . Eb6 . Eb6 . Eb6 . Eb6 | . A5 . A5 . A5 . A5 . A5 . A5 . A5 . A5",
          bass:
          "G2 . D3 . G2 . D3 . G2 . D3 . G2 . D3 . | F2 . C3 . F2 . C3 . F2 . C3 . F2 . C3 . | " +
          "Eb2 . Bb2 . Eb2 . Bb2 . Eb2 . Bb2 . Eb2 . Bb2 . | A2 . E3 . A2 . E3 . A2 . E3 . A2 . E3 .",
          kick:
          "k . . . k . . . k . . . k . . . | k . . . k . . . k . . . k . . . | " +
          "k . . . k . . . k . . . k . . . | k . . . k . . . k . . . k . . .",
          hat:
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h . | " +
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h .",
          snap:
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . . | " +
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . .",
          riser:
          "G3 - - - - - - - - - - - - - - - | F3 - - - - - - - - - - - - - - - | " +
          "Eb3 - - - - - - - - - - - - - - - | A3 - - - - - - - - - - - - - - -",
          lead2:
          "G5 G5 G5 G5 Bb5 Bb5 Bb5 Bb5 D6 D6 D6 D6 . . . . | F5 F5 F5 F5 A5 A5 A5 A5 C6 C6 C6 C6 . . . . | " +
          "Eb5 Eb5 Eb5 Eb5 G5 G5 G5 G5 Bb5 Bb5 Bb5 Bb5 . . . . | A5 A5 A5 A5 C#6 C#6 C#6 C#6 E6 E6 E6 E6 . . . .",
        },
      },
      order: ["A", "B", "A", "C", "B", "A", "B", "A", "C", "B", "A"],
    },
  },
};
