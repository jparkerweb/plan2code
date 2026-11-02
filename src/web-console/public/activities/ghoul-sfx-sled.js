// Plan2Code Web Console - ghoul: The Coffin Sled's own sound effects and music tracks, merged into ghoul-sfx.js; defines only.
//
// Same shape and rules as ghoul-sfx-carnival.js: `tones` (a `ghoul<Kind><Act>` sound for
// the sled's things) and `music` (a track for the room, named in ROOM_MUSIC in
// ghoul.js). `music` holds the picked `ghoulSledRide`; `tones` is empty until the sounds
// are picked by ear and the art's VOICES borrow older tones. A name may be defined only once across tones.js and every
// game's file. No imports.

export const SLED_SFX = {
  tones: {
    // Frozen Lake picks, by ear (prototypes/sounds/ghoul-rush/frozen.html).
    // Coffin Sled: The bonus ride: you coast down a long frozen hill on a coffin lid, jumping, ducking and shooting.
    // Jumps: Runners lift off.
    ghoulSledJump: {
      layers: [
        { type: "noise", seconds: 0.2, attack: 0.06, gain: 0.36, filter: { type: "bandpass", from: 3000, to: 1500, q: 5 } },
        { type: "noise", seconds: 0.3, attack: 0.11, gain: 0.4, filter: { type: "bandpass", from: 300, to: 1800, q: 1.5 }, delay: 0.05 },
      ],
    },
    // Lands: Clatter and slide.
    ghoulSledLand: {
      layers: [
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.54, filter: { type: "bandpass", from: 1837, to: 1469, q: 6 } },
        { type: "square", from: 490, to: 455, seconds: 0.02, gain: 0.18 },
        { type: "noise", seconds: 0.04, delay: 0.05, attack: 0, gain: 0.54, filter: { type: "bandpass", from: 2070, to: 1656, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.08, attack: 0, gain: 0.54, filter: { type: "bandpass", from: 1488, to: 1190, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.11, attack: 0, gain: 0.54, filter: { type: "bandpass", from: 1691, to: 1353, q: 6 } },
        { type: "noise", seconds: 0.3, attack: 0.09, gain: 0.3, delay: 0.1, filter: { type: "bandpass", from: 3000, to: 1500, q: 5 } },
      ],
    },
    // Launches off the lip: Big whoosh and whoop.
    ghoulSledLaunch: {
      layers: [
        { type: "noise", seconds: 0.8, attack: 0.32000000000000006, gain: 0.56, filter: { type: "bandpass", from: 400, to: 2500, q: 2 } },
        { type: "pink", seconds: 0.8, attack: 0.4, gain: 0.32, filter: { type: "bandpass", from: 240, to: 1750, q: 1 } },
        { type: "sine", from: 300, to: 900, seconds: 0.5, attack: 0.1, gain: 0.4, vibrato: { rate: 6, depth: 0.05 } },
      ],
    },
    // Ducks: Quick swish.
    ghoulSledDuck: {
      layers: [
        { type: "noise", seconds: 0.2, attack: 0.07, gain: 0.56, filter: { type: "bandpass", from: 420, to: 2520, q: 1.5 } },
      ],
    },
    // Crash: Thud and snow puff.
    ghoulSledCrash: {
      layers: [
        { type: "sine", from: 88, to: 32, seconds: 0.25, attack: 0, gain: 1 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.8, filter: { type: "lowpass", from: 256, to: 256, q: 1 } },
        { type: "noise", seconds: 0.4, attack: 0.16000000000000003, gain: 0.35, delay: 0.03, filter: { type: "bandpass", from: 1500, to: 3500, q: 2 } },
        { type: "pink", seconds: 0.4, attack: 0.2, gain: 0.2, delay: 0.03, filter: { type: "bandpass", from: 900, to: 2450, q: 1 } },
      ],
    },
    // Checkpoint: Sleigh bells.
    ghoulSledCheck: {
      layers: [
        { type: "sine", from: 2349, to: 2326, seconds: 0.2, attack: 0.003, gain: 0.3 },
        { type: "sine", from: 6483, to: 6342, seconds: 0.12, attack: 0.003, gain: 0.15 },
        { type: "sine", from: 12685, to: 12450, seconds: 0.06, attack: 0.003, gain: 0.08 },
        { type: "sine", from: 2793, to: 2765, seconds: 0.2, attack: 0.003, gain: 0.3, delay: 0.07 },
        { type: "sine", from: 7709, to: 7541, seconds: 0.12, attack: 0.003, gain: 0.15, delay: 0.07 },
        { type: "sine", from: 15082, to: 14803, seconds: 0.06, attack: 0.003, gain: 0.08, delay: 0.07 },
        { type: "sine", from: 2637, to: 2611, seconds: 0.3, attack: 0.003, gain: 0.3, delay: 0.14 },
        { type: "sine", from: 7278, to: 7120, seconds: 0.18, attack: 0.003, gain: 0.15, delay: 0.14 },
        { type: "sine", from: 14240, to: 13976, seconds: 0.09, attack: 0.003, gain: 0.08, delay: 0.14 },
      ],
    },
    // Finish: Fanfare notes.
    ghoulSledFinish: {
      layers: [
        { type: "triangle", seconds: 0.9, attack: 0.01, gain: 0.7, notes: [523, 659, 784, 1047] },
        { type: "sine", seconds: 0.9, attack: 0.01, gain: 0.25, notes: [1047, 1319, 1568, 2093] },
      ],
    },
    // Sled Hand: A hand in the snow beside the track: it stirs, shivers, and reaches up for the sled. Shoot it twice, or jump it.
    // Stirs: Dull knocks.
    ghoulSledHandWarn: {
      layers: [
        { type: "triangle", from: 190, to: 152, seconds: 0.18, attack: 0.003, gain: 0.63, filter: { type: "lowpass", from: 570, to: 380, q: 1 } },
        { type: "brown", seconds: 0.08, attack: 0.002, gain: 0.35, filter: { type: "lowpass", from: 400, to: 400, q: 1 } },
        { type: "triangle", from: 180, to: 144, seconds: 0.18, attack: 0.003, gain: 0.63, delay: 0.15, filter: { type: "lowpass", from: 540, to: 360, q: 1 } },
        { type: "brown", seconds: 0.08, attack: 0.002, gain: 0.35, delay: 0.15, filter: { type: "lowpass", from: 400, to: 400, q: 1 } },
        { type: "triangle", from: 200, to: 160, seconds: 0.18, attack: 0.003, gain: 0.72, delay: 0.28, filter: { type: "lowpass", from: 600, to: 400, q: 1 } },
        { type: "brown", seconds: 0.08, attack: 0.002, gain: 0.4, delay: 0.28, filter: { type: "lowpass", from: 400, to: 400, q: 1 } },
      ],
    },
    // Reaches up: Snow burst and a snarl.
    ghoulSledHandUp: {
      layers: [
        { type: "noise", seconds: 0.3, attack: 0.12, gain: 0.49, filter: { type: "bandpass", from: 1000, to: 3000, q: 2 } },
        { type: "pink", seconds: 0.3, attack: 0.15, gain: 0.28, filter: { type: "bandpass", from: 600, to: 2100, q: 1 } },
        { type: "sawtooth", from: 130, to: 97, seconds: 0.35, attack: 0.03, gain: 0.54, vibrato: { rate: 13.5, depth: 0.2 }, filter: { type: "bandpass", from: 729, to: 405, q: 3 }, delay: 0.03 },
        { type: "noise", seconds: 0.32, attack: 0.02, gain: 0.3, filter: { type: "bandpass", from: 1440, to: 630, q: 1.5 }, delay: 0.03 },
        { type: "square", from: 65, to: 57, seconds: 0.35, attack: 0.03, gain: 0.21, filter: { type: "lowpass", from: 450, to: 450, q: 1 }, delay: 0.03 },
      ],
    },
    // Takes a bolt: Frozen crack.
    ghoulSledHandHit: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.8, filter: { type: "bandpass", from: 1440, to: 960, q: 2 } },
        { type: "square", from: 720, to: 240, seconds: 0.05, attack: 0, gain: 0.32 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.56, filter: { type: "bandpass", from: 2080, to: 1440, q: 3 } },
        { type: "sawtooth", from: 152, to: 105, seconds: 0.16, attack: 0.01, gain: 0.36, vibrato: { rate: 9, depth: 0.1 }, filter: { type: "lowpass", from: 1144, to: 1144, q: 1 }, delay: 0.03 },
        { type: "brown", seconds: 0.13, attack: 0.01, gain: 0.24, filter: { type: "lowpass", from: 650, to: 650, q: 1 }, delay: 0.03 },
      ],
    },
    // Breaks: Brittle snaps.
    ghoulSledHandBreak: {
      layers: [
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.72, filter: { type: "bandpass", from: 4808, to: 3846, q: 6 } },
        { type: "square", from: 1186, to: 924, seconds: 0.02, gain: 0.24 },
        { type: "noise", seconds: 0.04, delay: 0.03, attack: 0, gain: 0.72, filter: { type: "bandpass", from: 3574, to: 2859, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.09, attack: 0, gain: 0.72, filter: { type: "bandpass", from: 3041, to: 2433, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.13, attack: 0, gain: 0.72, filter: { type: "bandpass", from: 3208, to: 2566, q: 6 } },
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.6, filter: { type: "bandpass", from: 1800, to: 1200, q: 2 }, delay: 0.15 },
        { type: "square", from: 900, to: 300, seconds: 0.05, attack: 0, gain: 0.24, delay: 0.15 },
        { type: "noise", seconds: 0.04, delay: 0.21, attack: 0, gain: 0.42, filter: { type: "bandpass", from: 2600, to: 1800, q: 3 } },
      ],
    },
    // Popping Ghoul: A ghoul that pops up beside the track for 2.4 s to be shot with one bolt (it never hurts you).
    // Pops up: Boo! groan.
    ghoulSledPopUp: {
      layers: [
        { type: "sawtooth", from: 88, to: 138, seconds: 0.5, attack: 0.12, gain: 0.63, vibrato: { rate: 20, depth: 0.07 }, filter: { type: "lowpass", from: 1200, to: 600, q: 5 } },
        { type: "sawtooth", from: 89, to: 137, seconds: 0.5, attack: 0.14, gain: 0.35, filter: { type: "lowpass", from: 960, to: 480, q: 3 } },
        { type: "brown", seconds: 0.5, attack: 0.1, gain: 0.42, filter: { type: "bandpass", from: 440, to: 330, q: 2 } },
        { type: "noise", seconds: 0.2, attack: 0.07, gain: 0.32, filter: { type: "bandpass", from: 330, to: 1980, q: 1.5 } },
      ],
    },
    // Shot: Pop and a sigh.
    ghoulSledPopHit: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.8, filter: { type: "bandpass", from: 2160, to: 1440, q: 2 } },
        { type: "square", from: 1080, to: 360, seconds: 0.05, attack: 0, gain: 0.32 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.56, filter: { type: "bandpass", from: 3120, to: 2160, q: 3 } },
        { type: "triangle", from: 110, to: 83, seconds: 0.5, attack: 0.25, gain: 0.45, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 1400, to: 900, q: 1 }, delay: 0.05 },
        { type: "sine", from: 220, to: 165, seconds: 0.5, attack: 0.3, gain: 0.15, delay: 0.05 },
        { type: "pink", seconds: 0.5, attack: 0.3, gain: 0.13, filter: { type: "bandpass", from: 440, to: 330, q: 6 }, delay: 0.05 },
      ],
    },
    // Icicle: Icicles hang from a dead limb over the track; shoot them for points (they never hurt).
    // Shatters: Tink and tinkle.
    ghoulSledIcicleBreak: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.7, filter: { type: "bandpass", from: 2880, to: 1920, q: 2 } },
        { type: "square", from: 1440, to: 480, seconds: 0.05, attack: 0, gain: 0.28 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.49, filter: { type: "bandpass", from: 4160, to: 2880, q: 3 } },
        { type: "sine", from: 3200, to: 3072, seconds: 0.2, attack: 0.002, gain: 0.2, delay: 0.03 },
        { type: "sine", from: 4100, to: 3936, seconds: 0.27, attack: 0.002, gain: 0.2, delay: 0.08 },
        { type: "sine", from: 5200, to: 4992, seconds: 0.34, attack: 0.002, gain: 0.2, delay: 0.12 },
        { type: "sine", from: 3700, to: 3552, seconds: 0.2, attack: 0.002, gain: 0.2, delay: 0.17 },
      ],
    },
  },
  music: {
    // Coffin Sled: glass-bell rush. The stage's glass bells at breakneck
    // speed: a high bell pulse says the figure in sparkling eighths over a
    // fast shimmer, with an offbeat bass and a four-on-the-floor kick. The
    // icy one: bright, hard and clean, like techno played on wind chimes. At
    // high dread a riser and an extra bell octave join.
    ghoulSledRide: {
      bpm: 159,
      rush: 10,
      voices: {
        bell: { wave: "pulse", duty: 0.125, gain: 0.12, decay: 0.08, sustain: 0.3 },
        shimmer: { wave: "pulse", duty: 0.125, gain: 0.05, decay: 0.03, sustain: 0.3, from: 0.15 },
        bass: { wave: "triangle", gain: 0.4, decay: 0.08, sustain: 0.5 },
        kick: { kit: true, gain: 0.26, from: 0.2 },
        hat: { kit: true, gain: 0.1, from: 0.4 },
        snap: { kit: true, gain: 0.16, from: 0.55 },
        riser: { wave: "sawtooth", gain: 0.035, decay: 0.3, sustain: 1, from: 0.8, vibrato: { rate: 0.6, depth: 0.04, delay: 0 } },
        bell2: { wave: "pulse", duty: 0.125, gain: 0.07, decay: 0.1, sustain: 0.3, from: 0.9 },
      },
      patterns: {
        A: {
          bell:
          "D5 - D6 - F5 - F6 - A5 - A6 - . . . . | G5 - G6 - F5 - F6 - E5 - E6 - . . . . | " +
          "F5 - F6 - D5 - D6 - Bb4 - Bb5 - . . . . | C#5 - C#6 - . . . . A4 - A5 - . . . .",
          shimmer:
          "Eb4^037 - Eb4^037 - Eb4^037 - Eb4^037 - Eb4^037 - Eb4^037 - Eb4^037 - Eb4^037 - | C#4^047 - C#4^047 - C#4^047 - C#4^047 - C#4^047 - C#4^047 - C#4^047 - C#4^047 - | " +
          "B3^047 - B3^047 - B3^047 - B3^047 - B3^047 - B3^047 - B3^047 - B3^047 - | Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 -",
          bass:
          ". . D3 . . . D3 . . . D3 . . . D3 . | . . C3 . . . C3 . . . C3 . . . C3 . | " +
          ". . Bb2 . . . Bb2 . . . Bb2 . . . Bb2 . | . . A2 . . . A2 . . . A2 . . . A2 .",
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
          "Eb4^037 - - - - - - - - - - - - - - - | C#4^047 - - - - - - - - - - - - - - - | " +
          "B3^047 - - - - - - - - - - - - - - - | Bb3^047 - - - - - - - - - - - - - - -",
          bell2:
          "D5 D5 D5 D5 F5 F5 F5 F5 A5 A5 A5 A5 . . . . | G5 G5 G5 G5 F5 F5 F5 F5 E5 E5 E5 E5 . . . . | " +
          "F5 F5 F5 F5 D5 D5 D5 D5 Bb4 Bb4 Bb4 Bb4 . . . . | C#5 C#5 C#5 C#5 . . . . A4 A4 A4 A4 . . . .",
        },
        B: {
          bell:
          "A5 - A6 - F5 - F6 - D5 - D6 - . . . . | G5 - G6 - E5 - E6 - C5 - C6 - . . . . | " +
          "D5 - D6 - Bb4 - Bb5 - F4 - F5 - . . . . | E5 - E6 - C#5 - C#6 - A4 - A5 - . . . .",
          shimmer:
          "Eb4^037 - Eb4^037 - Eb4^037 - Eb4^037 - Eb4^037 - Eb4^037 - Eb4^037 - Eb4^037 - | C#4^047 - C#4^047 - C#4^047 - C#4^047 - C#4^047 - C#4^047 - C#4^047 - C#4^047 - | " +
          "B3^047 - B3^047 - B3^047 - B3^047 - B3^047 - B3^047 - B3^047 - B3^047 - | Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 -",
          bass:
          ". . D3 . . . D3 . . . D3 . . . D3 . | . . C3 . . . C3 . . . C3 . . . C3 . | " +
          ". . Bb2 . . . Bb2 . . . Bb2 . . . Bb2 . | . . A2 . . . A2 . . . A2 . . . A2 .",
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
          "Eb4^037 - - - - - - - - - - - - - - - | C#4^047 - - - - - - - - - - - - - - - | " +
          "B3^047 - - - - - - - - - - - - - - - | Bb3^047 - - - - - - - - - - - - - - -",
          bell2:
          "A5 A5 A5 A5 F5 F5 F5 F5 D5 D5 D5 D5 . . . . | G5 G5 G5 G5 E5 E5 E5 E5 C5 C5 C5 C5 . . . . | " +
          "D5 D5 D5 D5 Bb4 Bb4 Bb4 Bb4 F4 F4 F4 F4 . . . . | E5 E5 E5 E5 C#5 C#5 C#5 C#5 A4 A4 A4 A4 . . . .",
        },
        C: {
          bell:
          "Bb4 - Bb5 - D5 - D6 - G5 - G6 - . . . . | A4 - A5 - C5 - C6 - F5 - F6 - . . . . | " +
          "G5 - G6 - Bb4 - Bb5 - Eb5 - Eb6 - . . . . | A5 - A6 - E5 - E6 - C#5 - C#6 - . . . .",
          shimmer:
          "Ab3^037 - Ab3^037 - Ab3^037 - Ab3^037 - Ab3^037 - Ab3^037 - Ab3^037 - Ab3^037 - | F#3^047 - F#3^047 - F#3^047 - F#3^047 - F#3^047 - F#3^047 - F#3^047 - F#3^047 - | " +
          "E3^047 - E3^047 - E3^047 - E3^047 - E3^047 - E3^047 - E3^047 - E3^047 - | Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 -",
          bass:
          ". . G2 . . . G2 . . . G2 . . . G2 . | . . F2 . . . F2 . . . F2 . . . F2 . | " +
          ". . Eb2 . . . Eb2 . . . Eb2 . . . Eb2 . | . . A2 . . . A2 . . . A2 . . . A2 .",
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
          "Ab3^037 - - - - - - - - - - - - - - - | F#3^047 - - - - - - - - - - - - - - - | " +
          "E3^047 - - - - - - - - - - - - - - - | Bb3^047 - - - - - - - - - - - - - - -",
          bell2:
          "Bb4 Bb4 Bb4 Bb4 D5 D5 D5 D5 G5 G5 G5 G5 . . . . | A4 A4 A4 A4 C5 C5 C5 C5 F5 F5 F5 F5 . . . . | " +
          "G5 G5 G5 G5 Bb4 Bb4 Bb4 Bb4 Eb5 Eb5 Eb5 Eb5 . . . . | A5 A5 A5 A5 E5 E5 E5 E5 C#5 C#5 C#5 C#5 . . . .",
        },
        D: {
          bell:
          "D6 - D7 - F6 - F7 - A6 - A7 - . . . . | G6 - G7 - F6 - F7 - E6 - E7 - . . . . | " +
          "F6 - F7 - D6 - D7 - Bb5 - Bb6 - . . . . | C#6 - C#7 - . . . . A5 - A6 - . . . .",
          shimmer:
          "Eb4^037 - Eb4^037 - Eb4^037 - Eb4^037 - Eb4^037 - Eb4^037 - Eb4^037 - Eb4^037 - | C#4^047 - C#4^047 - C#4^047 - C#4^047 - C#4^047 - C#4^047 - C#4^047 - C#4^047 - | " +
          "B3^047 - B3^047 - B3^047 - B3^047 - B3^047 - B3^047 - B3^047 - B3^047 - | Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 -",
          bass:
          ". . D3 . . . D3 . . . D3 . . . D3 . | . . C3 . . . C3 . . . C3 . . . C3 . | " +
          ". . Bb2 . . . Bb2 . . . Bb2 . . . Bb2 . | . . A2 . . . A2 . . . A2 . . . A2 .",
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
          "Eb4^037 - - - - - - - - - - - - - - - | C#4^047 - - - - - - - - - - - - - - - | " +
          "B3^047 - - - - - - - - - - - - - - - | Bb3^047 - - - - - - - - - - - - - - -",
          bell2:
          "D6 D6 D6 D6 F6 F6 F6 F6 A6 A6 A6 A6 . . . . | G6 G6 G6 G6 F6 F6 F6 F6 E6 E6 E6 E6 . . . . | " +
          "F6 F6 F6 F6 D6 D6 D6 D6 Bb5 Bb5 Bb5 Bb5 . . . . | C#6 C#6 C#6 C#6 . . . . A5 A5 A5 A5 . . . .",
        },
      },
      order: ["A", "B", "A", "C", "B", "D", "A", "B", "A", "C", "B", "D", "A"],
    },
  },
};
