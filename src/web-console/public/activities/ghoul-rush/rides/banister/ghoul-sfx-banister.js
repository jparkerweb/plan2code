// Plan2Code Web Console - ghoul: The Grand Banister's own sound effects and music track, merged into ghoul-sfx.js; defines only.
//
// Same shape and rules as ghoul-sfx-sled.js: `tones` (a `ghoulBan<Act>` sound for the ride's
// things) and `music` (a track for the room, named in ROOM_MUSIC in ghoul.js). Built from the house
// tone layers only (no external audio), each tone under 1.2 s; the music is a loop built from
// parts. These are first drafts, to be picked by ear. A name may be defined only once across
// tones.js and every game's file. No imports.

export const BANISTER_SFX = {
  tones: {
    // The Grand Banister: the bonus ride: you slide down the grand staircase's polished rail, jumping, ducking and shooting.
    // Jumps: A push off the wood and a rush of air.
    ghoulBanJump: {
      layers: [
        { type: "noise", seconds: 0.2, attack: 0.06, gain: 0.34, filter: { type: "bandpass", from: 2600, to: 1400, q: 4 } },
        { type: "triangle", from: 170, to: 130, seconds: 0.08, attack: 0.002, gain: 0.5, filter: { type: "lowpass", from: 700, to: 500, q: 1 } },
      ],
    },
    // Lands: A slap of wood and a squeak of polish.
    ghoulBanLand: {
      layers: [
        { type: "triangle", from: 150, to: 95, seconds: 0.12, attack: 0.002, gain: 0.7, filter: { type: "lowpass", from: 800, to: 500, q: 1 } },
        { type: "brown", seconds: 0.1, attack: 0, gain: 0.5, filter: { type: "lowpass", from: 400, to: 300, q: 1 } },
        { type: "sine", from: 1400, to: 1900, seconds: 0.09, attack: 0.01, gain: 0.12, delay: 0.05, vibrato: { rate: 30, depth: 0.04 } },
      ],
    },
    // Launches off the end of the rail: A long whoosh and a whoop.
    ghoulBanLaunch: {
      layers: [
        { type: "noise", seconds: 0.8, attack: 0.3, gain: 0.5, filter: { type: "bandpass", from: 400, to: 2400, q: 2 } },
        { type: "pink", seconds: 0.8, attack: 0.4, gain: 0.3, filter: { type: "bandpass", from: 240, to: 1700, q: 1 } },
        { type: "sine", from: 320, to: 880, seconds: 0.5, attack: 0.1, gain: 0.36, vibrato: { rate: 6, depth: 0.05 } },
      ],
    },
    // Ducks: A quick swish under the lamp.
    ghoulBanDuck: {
      layers: [
        { type: "noise", seconds: 0.18, attack: 0.07, gain: 0.5, filter: { type: "bandpass", from: 500, to: 2400, q: 1.5 } },
      ],
    },
    // Switches rails: A brass ring.
    ghoulBanSwitch: {
      layers: [
        { type: "sine", from: 1568, to: 1555, seconds: 0.3, attack: 0.003, gain: 0.3 },
        { type: "sine", from: 3136, to: 3110, seconds: 0.2, attack: 0.003, gain: 0.14 },
        { type: "sine", from: 2349, to: 2330, seconds: 0.24, attack: 0.003, gain: 0.18, delay: 0.05 },
      ],
    },
    // Crash: Wood cracks and china and crystal shatter.
    ghoulBanCrash: {
      layers: [
        { type: "sine", from: 90, to: 34, seconds: 0.22, attack: 0, gain: 0.9 },
        { type: "brown", seconds: 0.18, attack: 0, gain: 0.7, filter: { type: "lowpass", from: 260, to: 260, q: 1 } },
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.7, filter: { type: "bandpass", from: 3600, to: 2400, q: 5 }, delay: 0.02 },
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.6, filter: { type: "bandpass", from: 4400, to: 3000, q: 6 }, delay: 0.09 },
        { type: "sine", from: 3900, to: 3700, seconds: 0.3, attack: 0.002, gain: 0.12, delay: 0.1 },
      ],
    },
    // Checkpoint: A chime of the hall clock.
    ghoulBanCheck: {
      layers: [
        { type: "sine", from: 784, to: 780, seconds: 0.5, attack: 0.004, gain: 0.34 },
        { type: "sine", from: 1568, to: 1560, seconds: 0.4, attack: 0.004, gain: 0.14 },
        { type: "sine", from: 988, to: 984, seconds: 0.6, attack: 0.004, gain: 0.34, delay: 0.16 },
        { type: "sine", from: 1976, to: 1968, seconds: 0.45, attack: 0.004, gain: 0.14, delay: 0.16 },
      ],
    },
    // Finish: A fanfare of the house organ.
    ghoulBanFinish: {
      layers: [
        { type: "triangle", seconds: 0.95, attack: 0.01, gain: 0.7, notes: [440, 523, 659, 880] },
        { type: "square", seconds: 0.95, attack: 0.01, gain: 0.12, notes: [220, 262, 330, 440], filter: { type: "lowpass", from: 1600, to: 1200, q: 1 } },
        { type: "sine", seconds: 0.95, attack: 0.01, gain: 0.22, notes: [880, 1047, 1319, 1760] },
      ],
    },
    // Butler: A ghostly butler on the stairs: it bows, then lunges with its silver tray. Shoot it twice, or jump it.
    // Bows: A polite ring of a service bell.
    ghoulBanButlerWarn: {
      layers: [
        { type: "sine", from: 2637, to: 2620, seconds: 0.3, attack: 0.002, gain: 0.3 },
        { type: "sine", from: 5274, to: 5240, seconds: 0.16, attack: 0.002, gain: 0.1 },
        { type: "sine", from: 2637, to: 2620, seconds: 0.34, attack: 0.002, gain: 0.3, delay: 0.2 },
        { type: "sine", from: 5274, to: 5240, seconds: 0.18, attack: 0.002, gain: 0.1, delay: 0.2 },
      ],
    },
    // Lunges: A hiss of cold air and a hollow moan.
    ghoulBanButlerLunge: {
      layers: [
        { type: "noise", seconds: 0.3, attack: 0.1, gain: 0.4, filter: { type: "bandpass", from: 1800, to: 900, q: 2 } },
        { type: "sawtooth", from: 200, to: 140, seconds: 0.4, attack: 0.05, gain: 0.4, vibrato: { rate: 9, depth: 0.12 }, filter: { type: "bandpass", from: 800, to: 420, q: 3 } },
        { type: "square", from: 100, to: 80, seconds: 0.4, attack: 0.05, gain: 0.16, filter: { type: "lowpass", from: 420, to: 420, q: 1 } },
      ],
    },
    // Takes a bolt: A clang on the tray.
    ghoulBanButlerHit: {
      layers: [
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.7, filter: { type: "bandpass", from: 2800, to: 1800, q: 3 } },
        { type: "square", from: 1250, to: 1100, seconds: 0.12, attack: 0.002, gain: 0.26, filter: { type: "bandpass", from: 1800, to: 1400, q: 4 } },
        { type: "sine", from: 2100, to: 2040, seconds: 0.3, attack: 0.002, gain: 0.14 },
      ],
    },
    // Breaks: The tray clatters down and the ghost sighs away.
    ghoulBanButlerBreak: {
      layers: [
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.7, filter: { type: "bandpass", from: 2800, to: 1800, q: 3 } },
        { type: "square", from: 1100, to: 800, seconds: 0.1, attack: 0.002, gain: 0.26, filter: { type: "bandpass", from: 1600, to: 1200, q: 4 } },
        { type: "noise", seconds: 0.04, delay: 0.1, attack: 0, gain: 0.5, filter: { type: "bandpass", from: 2200, to: 1500, q: 4 } },
        { type: "noise", seconds: 0.04, delay: 0.17, attack: 0, gain: 0.4, filter: { type: "bandpass", from: 3000, to: 2000, q: 4 } },
        { type: "triangle", from: 330, to: 220, seconds: 0.6, attack: 0.25, gain: 0.34, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 1400, to: 800, q: 1 }, delay: 0.1 },
        { type: "pink", seconds: 0.6, attack: 0.3, gain: 0.12, filter: { type: "bandpass", from: 500, to: 300, q: 5 }, delay: 0.1 },
      ],
    },
    // Cobweb: A web strung across the rail: shoot it for points; riding through only tears it.
    // Tears: A soft dry rip.
    ghoulBanWebTear: {
      layers: [
        { type: "noise", seconds: 0.16, attack: 0.02, gain: 0.3, filter: { type: "highpass", from: 2400, to: 3600, q: 1 } },
        { type: "noise", seconds: 0.1, attack: 0.01, gain: 0.2, delay: 0.05, filter: { type: "bandpass", from: 4200, to: 3200, q: 3 } },
      ],
    },
    // Shot: A quick zip and a pop.
    ghoulBanWebShot: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.5, filter: { type: "bandpass", from: 3400, to: 2200, q: 3 } },
        { type: "sine", from: 1800, to: 700, seconds: 0.08, attack: 0.002, gain: 0.2 },
        { type: "noise", seconds: 0.12, attack: 0.01, gain: 0.2, delay: 0.04, filter: { type: "highpass", from: 3000, to: 4200, q: 1 } },
      ],
    },
  },
  music: {
    // The Grand Banister: a harpsichord waltz at a gallop. The hall's harpsichord runs
    // broken chords over a slow organ and a walking bass in A minor (Am, F, C, E),
    // with a thin violin line over the second round and a ticking clock of hats. At
    // high dread a chandelier-bright octave and a riser join.
    ghoulBanister: {
      bpm: 150,
      rush: 12,
      voices: {
        harp: { wave: "pulse", duty: 0.25, gain: 0.13, decay: 0.16, sustain: 0.15 },
        harp2: { wave: "pulse", duty: 0.125, gain: 0.06, decay: 0.12, sustain: 0.1, from: 0.85 },
        organ: { wave: "triangle", gain: 0.1, decay: 0.8, sustain: 0.85, from: 0.1 },
        violin: { wave: "sawtooth", gain: 0.045, decay: 0.3, sustain: 0.7, from: 0.35, vibrato: { rate: 5.2, depth: 0.035, delay: 0.1 } },
        bass: { wave: "triangle", gain: 0.4, decay: 0.1, sustain: 0.5 },
        kick: { kit: true, gain: 0.24, from: 0.2 },
        hat: { kit: true, gain: 0.08, from: 0.45 },
        snap: { kit: true, gain: 0.14, from: 0.6 },
        riser: { wave: "sawtooth", gain: 0.03, decay: 0.3, sustain: 1, from: 0.8, vibrato: { rate: 0.6, depth: 0.04, delay: 0 } },
      },
      patterns: {
        A: {
          harp:
          "A4 . C5 . E5 . A5 . E5 . C5 . E5 . C5 . | F4 . A4 . C5 . F5 . C5 . A4 . C5 . A4 . | " +
          "E4 . G4 . C5 . E5 . C5 . G4 . C5 . G4 . | E4 . G#4 . B4 . E5 . D5 . B4 . G#4 . B4 .",
          harp2:
          "A5 . . . E6 . . . A5 . . . E6 . . . | F5 . . . C6 . . . F5 . . . C6 . . . | " +
          "E5 . . . C6 . . . E5 . . . C6 . . . | E5 . . . B5 . . . E5 . . . B5 . . .",
          organ:
          "A3^037 - - - - - - - - - - - - - - - | F3^047 - - - - - - - - - - - - - - - | " +
          "C3^047 - - - - - - - - - - - - - - - | E3^047 - - - - - - - - - - - - - - -",
          violin:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          bass:
          "A2 . . . . . A2 . . . . . A2 . . . | F2 . . . . . F2 . . . . . F2 . . . | " +
          "C3 . . . . . C3 . . . . . C3 . . . | E2 . . . . . E2 . . . . . E2 . . .",
          kick:
          "k . . . . . . . k . . . . . . . | k . . . . . . . k . . . . . . . | " +
          "k . . . . . . . k . . . . . . . | k . . . . . . . k . . . . . . .",
          hat:
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h . | " +
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h .",
          snap:
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . . | " +
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . .",
          riser:
          "A3^037 - - - - - - - - - - - - - - - | F3^047 - - - - - - - - - - - - - - - | " +
          "C4^047 - - - - - - - - - - - - - - - | E3^047 - - - - - - - - - - - - - - -",
        },
        B: {
          harp:
          "A4 . C5 . E5 . A5 . E5 . C5 . E5 . C5 . | D5 . F5 . A5 . D6 . A5 . F5 . A5 . F5 . | " +
          "C5 . E5 . G5 . C6 . G5 . E5 . G5 . E5 . | B4 . D#5 . F#5 . B5 . F#5 . D#5 . G#4 . B4 .",
          harp2:
          "A5 . . . E6 . . . A5 . . . E6 . . . | D6 . . . A5 . . . D6 . . . A5 . . . | " +
          "C6 . . . G5 . . . C6 . . . G5 . . . | B5 . . . F#5 . . . B5 . . . F#5 . . .",
          organ:
          "A3^037 - - - - - - - - - - - - - - - | D3^037 - - - - - - - - - - - - - - - | " +
          "C3^047 - - - - - - - - - - - - - - - | B2^047 - - - - - - - - - - - - - - -",
          violin:
          "E5 - - - - - D5 - C5 - - - B4 - - - | A4 - - - - - - - D5 - - - F5 - - - | " +
          "G5 - - - - - E5 - C5 - - - E5 - - - | D#5 - - - - - F#5 - B4 - - - - - - -",
          bass:
          "A2 . . . . . A2 . . . . . A2 . . . | D3 . . . . . D3 . . . . . D3 . . . | " +
          "C3 . . . . . C3 . . . . . C3 . . . | B2 . . . . . B2 . . . . . B2 . . .",
          kick:
          "k . . . . . . . k . . . . . . . | k . . . . . . . k . . . . . . . | " +
          "k . . . . . . . k . . . . . . . | k . . . . . . . k . . . . . . .",
          hat:
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h . | " +
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h .",
          snap:
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . . | " +
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . .",
          riser:
          "A3^037 - - - - - - - - - - - - - - - | D3^037 - - - - - - - - - - - - - - - | " +
          "C4^047 - - - - - - - - - - - - - - - | B3^047 - - - - - - - - - - - - - - -",
        },
        C: {
          harp:
          "E5 . A4 . C5 . E5 . A5 . E5 . C5 . A4 . | F5 . A4 . C5 . F5 . A5 . F5 . C5 . A4 . | " +
          "G5 . C5 . E5 . G5 . C6 . G5 . E5 . C5 . | G#4 . B4 . E5 . G#5 . B5 . G#5 . E5 . B4 .",
          harp2:
          "A5 A5 . . E6 E6 . . A5 A5 . . E6 E6 . . | F5 F5 . . C6 C6 . . F5 F5 . . C6 C6 . . | " +
          "E5 E5 . . C6 C6 . . E5 E5 . . C6 C6 . . | E5 E5 . . B5 B5 . . E5 E5 . . B5 B5 . .",
          organ:
          "A3^037 - - - - - - - - - - - - - - - | F3^047 - - - - - - - - - - - - - - - | " +
          "C3^047 - - - - - - - - - - - - - - - | E3^047 - - - - - - - - - - - - - - -",
          violin:
          "A5 - - - - - - - E5 - - - A5 - - - | A5 - - - - - - - C6 - - - A5 - - - | " +
          "G5 - - - - - - - E5 - - - G5 - - - | G#5 - - - - - B5 - E6 - - - - - - -",
          bass:
          "A2 . A2 . . . A2 . A2 . A2 . . . A2 . | F2 . F2 . . . F2 . F2 . F2 . . . F2 . | " +
          "C3 . C3 . . . C3 . C3 . C3 . . . C3 . | E2 . E2 . . . E2 . E2 . E2 . . . E2 .",
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
          "A3^037 - - - - - - - - - - - - - - - | F3^047 - - - - - - - - - - - - - - - | " +
          "C4^047 - - - - - - - - - - - - - - - | E3^047 - - - - - - - - - - - - - - -",
        },
      },
      order: ["A", "A", "B", "A", "C", "B", "A", "C"],
    },
  },
};
