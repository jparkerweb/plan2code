// Plan2Code Web Console - ghoul: the ending's sounds and music, merged into sfx/ghoul-sfx.js; defines only.
//
// Same shape and rules as ghoul-sfx-story.js: `tones` (one-shots named in the
// pages' `cues` in ghoul-ending.js: a hush, a window going out and the last
// one, the road unfolding, a bird at dawn, the flashlight clicking off, the
// cottage settling, the mailbox's flag, an envelope, the FINAL NOTICE stamp
// and the gag's sad horn) and `music` (ghoulMarrowEnding, the track under the
// whole ending, the user's pick: eighties horror end credits). The tones are
// the user's picks from the sound vote (prototypes/sounds/ghoul-rush/ending.html).
// No tone is longer than 1.2 s. A name may be defined only once across tones.js
// and every game's file. No imports.

export const ENDING_SFX = {
  tones: {
    // LIGHTS OUT: The house from the hill: every window goes out, one by one, to a falling tone each, then the last.
    // The ending opens: Low warm chord (option 4).
    ghoulEndingHush: {
      layers: [
        { type: "sine", from: 147, to: 147, seconds: 1.15, attack: 0.3, gain: 0.14 },
        { type: "sine", from: 220, to: 220, seconds: 1.15, attack: 0.3, gain: 0.108 },
        { type: "sine", from: 294, to: 293, seconds: 1.15, attack: 0.3, gain: 0.088 },
        { type: "sine", from: 370, to: 369, seconds: 1.15, attack: 0.3, gain: 0.074 },
      ],
    },
    // A window goes out: Click and soft fall (option 1).
    ghoulEndingWindow: {
      layers: [
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.18, filter: { type: "bandpass", from: 2600, to: 1800, q: 4 } },
        { type: "sine", from: 880, to: 440, seconds: 0.7, attack: 0.01, gain: 0.22, delay: 0.02 },
        { type: "triangle", from: 1320, to: 660, seconds: 0.5, attack: 0.01, gain: 0.06, delay: 0.02 },
      ],
    },
    // The last window: Long fall, warm chord (option 1).
    ghoulEndingLast: {
      layers: [
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.2, filter: { type: "bandpass", from: 2000, to: 1400, q: 4 } },
        { type: "sine", from: 587, to: 147, seconds: 1.15, attack: 0.02, gain: 0.3, delay: 0.03 },
        { type: "sine", from: 294, to: 293, seconds: 1.09, attack: 0.3, gain: 0.12, delay: 0.1 },
        { type: "sine", from: 440, to: 439, seconds: 1, attack: 0.3, gain: 0.08, delay: 0.15 },
        { type: "sine", from: 370, to: 369, seconds: 1, attack: 0.3, gain: 0.07, delay: 0.2 },
      ],
    },
    // THE ROAD: Dawn: the road unfolds out of the valley, creasing flat like a napkin; YOU walk; the flashlight clicks off.
    // The road unfolds: Paper shaken out (option 1).
    ghoulEndingFold: {
      layers: [
        { type: "noise", seconds: 0.35, attack: 0.08, gain: 0.22, filter: { type: "bandpass", from: 900, to: 3200, q: 1.1 } },
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.2, delay: 0.3, filter: { type: "highpass", from: 2500, to: 3500, q: 1 } },
        { type: "sine", from: 180, to: 120, seconds: 0.2, attack: 0.01, gain: 0.12, delay: 0.3 },
      ],
    },
    // A bird: Two chirps and a trill (option 1).
    ghoulEndingBird: {
      layers: [
        { type: "sine", from: 2600, to: 3400, seconds: 0.08, attack: 0.005, gain: 0.14 },
        { type: "sine", from: 2800, to: 3600, seconds: 0.08, attack: 0.005, gain: 0.12, delay: 0.14 },
        { type: "sine", from: 3200, to: 2600, seconds: 0.3, attack: 0.01, gain: 0.08, delay: 0.32, vibrato: { rate: 26, depth: 0.05 } },
      ],
    },
    // The flashlight clicks off: Switch and settle (option 1).
    ghoulEndingClickOff: {
      layers: [
        { type: "square", from: 1100, to: 700, seconds: 0.016, attack: 0, gain: 0.25 },
        { type: "noise", seconds: 0.025, attack: 0, gain: 0.22, delay: 0.015, filter: { type: "highpass", from: 3000, to: 3500, q: 1 } },
        { type: "triangle", from: 900, to: 300, seconds: 0.4, attack: 0.01, gain: 0.08, delay: 0.04 },
      ],
    },
    // MORNING: Broad day: the House is only a small sagging cottage in the sun, birds on the roof.
    // The cottage settles: Easy creak (option 1).
    ghoulEndingSettle: {
      layers: [
        { type: "sawtooth", from: 200, to: 170, seconds: 0.6, attack: 0.1, gain: 0.06, filter: { type: "bandpass", from: 900, to: 700, q: 6 }, vibrato: { rate: 9, depth: 0.04 } },
        { type: "brown", seconds: 0.4, attack: 0.05, gain: 0.25, filter: { type: "lowpass", from: 300, to: 150, q: 1 } },
      ],
    },
    // FINAL NOTICE: The stuffed mailbox in close-up: the flag drops, a last envelope slides out, FINAL NOTICE stamped on it.
    // The flag drops: Tin clack and rattle (option 1).
    ghoulEndingFlag: {
      layers: [
        { type: "square", from: 620, to: 540, seconds: 0.05, attack: 0, gain: 0.16, filter: { type: "bandpass", from: 1800, to: 1400, q: 3 } },
        { type: "noise", seconds: 0.06, attack: 0, gain: 0.25, filter: { type: "bandpass", from: 3000, to: 2200, q: 4 } },
        { type: "triangle", from: 780, to: 760, seconds: 0.25, attack: 0.002, gain: 0.08, delay: 0.05 },
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.12, delay: 0.12, filter: { type: "bandpass", from: 2800, to: 2000, q: 4 } },
      ],
    },
    // An envelope slides out: Paper slide (option 1).
    ghoulEndingPaper: {
      layers: [
        { type: "noise", seconds: 0.45, attack: 0.1, gain: 0.18, filter: { type: "bandpass", from: 2400, to: 4200, q: 1.5 } },
        { type: "pink", seconds: 0.3, attack: 0.05, gain: 0.12, delay: 0.1, filter: { type: "highpass", from: 1500, to: 2500, q: 1 } },
      ],
    },
    // FINAL NOTICE is stamped: Rubber stamp thump (option 1).
    ghoulEndingStamp: {
      layers: [
        { type: "sine", from: 140, to: 60, seconds: 0.18, attack: 0.002, gain: 0.6 },
        { type: "noise", seconds: 0.06, attack: 0, gain: 0.35, filter: { type: "lowpass", from: 1600, to: 500, q: 1 } },
        { type: "brown", seconds: 0.15, attack: 0.002, gain: 0.4, filter: { type: "lowpass", from: 400, to: 120, q: 1 } },
      ],
    },
    // The gag lands: Wah wah wah waaah (option 2).
    ghoulEndingGag: {
      layers: [
        { type: "sawtooth", from: 330, to: 330, seconds: 0.22, attack: 0.03, gain: 0.13, filter: { type: "lowpass", from: 900, to: 700, q: 2 } },
        { type: "sawtooth", from: 311, to: 311, seconds: 0.22, attack: 0.03, gain: 0.13, delay: 0.25, filter: { type: "lowpass", from: 900, to: 700, q: 2 } },
        { type: "sawtooth", from: 294, to: 294, seconds: 0.22, attack: 0.03, gain: 0.13, delay: 0.5, filter: { type: "lowpass", from: 900, to: 700, q: 2 } },
        { type: "sawtooth", from: 277, to: 247, seconds: 0.45, attack: 0.03, gain: 0.13, delay: 0.75, filter: { type: "lowpass", from: 900, to: 500, q: 2 }, vibrato: { rate: 6, depth: 0.03 } },
      ],
    },
  },
  music: {
    // The ending: eighties horror end credits. The credits roll like an old VHS horror film's: a pulsing synth
    // arpeggio in D minor, a wide pad, a driving bass in eighths and a lonely sawtooth lead. A faint kick plays the
    // House's heartbeat, two thumps and a rest, slowing until it stops, and the theme rises through one D major bar
    // like sunrise. Then the arpeggio cuts off mid-bar, the heart kicks twice in the quiet, and the lead's last note
    // slides a half step off.
    ghoulMarrowEnding: {
      bpm: 112,
      voices: {
        arp: { wave: "pulse", duty: 0.125, gain: 0.03, decay: 0.02, sustain: 0.3 },
        padLo: { wave: "sawtooth", gain: 0.012, decay: 0.6, sustain: 1 },
        padMid: { wave: "sawtooth", gain: 0.011, decay: 0.6, sustain: 1, from: 0.2 },
        padHi: { wave: "sawtooth", gain: 0.01, decay: 0.6, sustain: 1, from: 0.3 },
        bass: { wave: "triangle", gain: 0.28, decay: 0.04, sustain: 0.4 },
        lead: { wave: "sawtooth", gain: 0.045, decay: 0.1, sustain: 0.8, from: 0.3, vibrato: { rate: 5, depth: 0.008, delay: 0.25 } },
        heart: { kit: true, gain: 0.24 },
        hat: { kit: true, gain: 0.04, from: 0.5 },
      },
      patterns: {
        I: {
          arp:
          "D4 F4 A4 D5 D4 F4 A4 D5 D4 F4 A4 D5 D4 F4 A4 D5 | D4 F4 A4 D5 D4 F4 A4 D5 D4 F4 A4 D5 D4 F4 A4 D5",
          padLo:
          "A3 - - - - - - - - - - - - - - - | A3 - - - - - - - - - - - - - - -",
          padMid:
          "D4 - - - - - - - - - - - - - - - | D4 - - - - - - - - - - - - - - -",
          padHi:
          "F4 - - - - - - - - - - - - - - - | F4 - - - - - - - - - - - - - - -",
          bass:
          "D2 . D2 . D2 . D2 . D2 . D2 . D2 . D2 . | D2 . D2 . D2 . D2 . D2 . D2 . D2 . D2 .",
          lead:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          heart:
          "k . k . . . . . . . . . . . . . | k . k . . . . . . . . . . . . .",
          hat:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
        },
        A: {
          arp:
          "D4 F4 A4 D5 D4 F4 A4 D5 D4 F4 A4 D5 D4 F4 A4 D5 | D4 F4 Bb4 D5 D4 F4 Bb4 D5 D4 F4 Bb4 D5 D4 F4 Bb4 D5 | " +
          "F4 A4 C5 F5 F4 A4 C5 F5 F4 A4 C5 F5 F4 A4 C5 F5 | E4 G4 C5 E5 E4 G4 C5 E5 E4 G4 C5 E5 E4 G4 C5 E5 | " +
          "D4 F4 A4 D5 D4 F4 A4 D5 D4 F4 A4 D5 D4 F4 A4 D5 | D4 F4 Bb4 D5 D4 F4 Bb4 D5 D4 F4 Bb4 D5 D4 F4 Bb4 D5 | " +
          "D4 G4 Bb4 D5 D4 G4 Bb4 D5 D4 G4 Bb4 D5 D4 G4 Bb4 D5 | E4 A4 C#5 E5 E4 A4 C#5 E5 E4 A4 C#5 E5 E4 A4 C#5 E5",
          padLo:
          "A3 - - - - - - - - - - - - - - - | Bb3 - - - - - - - - - - - - - - - | " +
          "A3 - - - - - - - - - - - - - - - | C4 - - - - - - - - - - - - - - - | " +
          "A3 - - - - - - - - - - - - - - - | Bb3 - - - - - - - - - - - - - - - | " +
          "Bb3 - - - - - - - - - - - - - - - | A3 - - - - - - - - - - - - - - -",
          padMid:
          "D4 - - - - - - - - - - - - - - - | D4 - - - - - - - - - - - - - - - | " +
          "C4 - - - - - - - - - - - - - - - | E4 - - - - - - - - - - - - - - - | " +
          "D4 - - - - - - - - - - - - - - - | D4 - - - - - - - - - - - - - - - | " +
          "D4 - - - - - - - - - - - - - - - | C#4 - - - - - - - - - - - - - - -",
          padHi:
          "F4 - - - - - - - - - - - - - - - | F4 - - - - - - - - - - - - - - - | " +
          "F4 - - - - - - - - - - - - - - - | G4 - - - - - - - - - - - - - - - | " +
          "F4 - - - - - - - - - - - - - - - | F4 - - - - - - - - - - - - - - - | " +
          "G4 - - - - - - - - - - - - - - - | E4 - - - - - - - - - - - - - - -",
          bass:
          "D2 . D2 . D2 . D2 . D2 . D2 . D2 . D2 . | Bb2 . Bb2 . Bb2 . Bb2 . Bb2 . Bb2 . Bb2 . Bb2 . | " +
          "F2 . F2 . F2 . F2 . F2 . F2 . F2 . F2 . | C3 . C3 . C3 . C3 . C3 . C3 . C3 . C3 . | " +
          "D2 . D2 . D2 . D2 . D2 . D2 . D2 . D2 . | Bb2 . Bb2 . Bb2 . Bb2 . Bb2 . Bb2 . Bb2 . Bb2 . | " +
          "G2 . G2 . G2 . G2 . G2 . G2 . G2 . G2 . | A2 . A2 . A2 . A2 . A2 . A2 . A2 . A2 .",
          lead:
          "D5 - - - - - - - F5 - - - A5 - - - | Bb5 - - - - - - - A5 - - - F5 - - - | " +
          "A5 - - - - - - - C6 - - - A5 - - - | G5 - - - - - - - - - - - E5 - - - | " +
          "D6 - - - - - - - C6 - - - A5 - - - | Bb5 - - - - - - - D6 - - - F6 - - - | " +
          "G6 - - - - - - - F6 - - - D6 - - - | E6 - - - - - - - C#6 - - - A5 - - -",
          heart:
          "k . k . . . . . . . . . . . . . | k . k . . . . . . . . . . . . . | " +
          "k . . k . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          "k . . . k . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          hat:
          ". h . h . h . h . h . h . h . h | . h . h . h . h . h . h . h . h | " +
          ". h . h . h . h . h . h . h . h | . h . h . h . h . h . h . h . h | " +
          ". h . h . h . h . h . h . h . h | . h . h . h . h . h . h . h . h | " +
          ". h . h . h . h . h . h . h . h | . h . h . h . h . h . h . h . h",
        },
        B: {
          arp:
          "D4 F4 Bb4 D5 D4 F4 Bb4 D5 D4 F4 Bb4 D5 D4 F4 Bb4 D5 | E4 G4 C5 E5 E4 G4 C5 E5 E4 G4 C5 E5 E4 G4 C5 E5 | " +
          "E4 A4 C5 E5 E4 A4 C5 E5 E4 A4 C5 E5 E4 A4 C5 E5 | D4 F4 A4 D5 D4 F4 A4 D5 D4 F4 A4 D5 D4 F4 A4 D5 | " +
          "D4 G4 Bb4 D5 D4 G4 Bb4 D5 D4 G4 Bb4 D5 D4 G4 Bb4 D5 | E4 G4 C5 E5 E4 G4 C5 E5 E4 G4 C5 E5 E4 G4 C5 E5 | " +
          "D4 F#4 A4 D5 D4 F#4 A4 D5 D4 F#4 A4 D5 D4 F#4 A4 D5 | D4 F4 A4 D5 D4 F4 A4 D5 . . . . . . . .",
          padLo:
          "Bb3 - - - - - - - - - - - - - - - | C4 - - - - - - - - - - - - - - - | " +
          "A3 - - - - - - - - - - - - - - - | A3 - - - - - - - - - - - - - - - | " +
          "Bb3 - - - - - - - - - - - - - - - | C4 - - - - - - - - - - - - - - - | " +
          "A3 - - - - - - - - - - - - - - - | A3 - - - - - - - - - - - - - - -",
          padMid:
          "D4 - - - - - - - - - - - - - - - | E4 - - - - - - - - - - - - - - - | " +
          "C4 - - - - - - - - - - - - - - - | D4 - - - - - - - - - - - - - - - | " +
          "D4 - - - - - - - - - - - - - - - | E4 - - - - - - - - - - - - - - - | " +
          "D4 - - - - - - - - - - - - - - - | D4 - - - - - - - - - - - - - - -",
          padHi:
          "F4 - - - - - - - - - - - - - - - | G4 - - - - - - - - - - - - - - - | " +
          "E4 - - - - - - - - - - - - - - - | F4 - - - - - - - - - - - - - - - | " +
          "G4 - - - - - - - - - - - - - - - | G4 - - - - - - - - - - - - - - - | " +
          "F#4 - - - - - - - - - - - - - - - | F4 - - - - - - - - - - - - - - -",
          bass:
          "Bb2 . Bb2 . Bb2 . Bb2 . Bb2 . Bb2 . Bb2 . Bb2 . | C3 . C3 . C3 . C3 . C3 . C3 . C3 . C3 . | " +
          "A2 . A2 . A2 . A2 . A2 . A2 . A2 . A2 . | D2 . D2 . D2 . D2 . D2 . D2 . D2 . D2 . | " +
          "G2 . G2 . G2 . G2 . G2 . G2 . G2 . G2 . | C3 . C3 . C3 . C3 . C3 . C3 . C3 . C3 . | " +
          "D2 . D2 . D2 . D2 . D2 . D2 . D2 . D2 . | D2 - - - - - - - . . . . . . . .",
          lead:
          "F5 - - - - - - - D5 - - - F5 - - - | G5 - - - - - - - E5 - - - G5 - - - | " +
          "A5 - - - - - - - C6 - - - E6 - - - | D6 - - - - - - - - - - - . . . . | " +
          "Bb5 - - - - - - - D6 - - - G6 - - - | G6 - - - - - - - E6 - - - C6 - - - | " +
          "F#6 - - - - - - - A6 - - - F#6 - - - | F6 - - - - - - - . . . . Eb6 - - -",
          heart:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . k . . . k . . .",
          hat:
          ". h . h . h . h . h . h . h . h | . h . h . h . h . h . h . h . h | " +
          ". h . h . h . h . h . h . h . h | . h . h . h . h . h . h . h . h | " +
          ". h . h . h . h . h . h . h . h | . h . h . h . h . h . h . h . h | " +
          ". h . h . h . h . h . h . h . h | . . . . . . . . . . . . . . . .",
        },
      },
      order: ["I", "A", "B"],
    },
  },
};
