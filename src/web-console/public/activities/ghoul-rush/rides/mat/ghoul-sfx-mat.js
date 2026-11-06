// Plan2Code Web Console - ghoul: the sounds for the finale's first ride, Down the Hatch (surfing the WELCOME mat down the House's throat), merged into sfx/ghoul-sfx.js; defines only.
//
// Same shape and rules as ghoul-sfx-banister.js: `tones` (a `ghoulMat<Act>` sound for the ride's
// things). Built from the house tone layers only (no external audio), each tone under 1.2 s. `music`
// holds ghoulMarrowMat, the user's pick (Seasick calliope), named in ROOM_MUSIC. These
// are the user's picks from the sound vote (prototypes/sounds/ghoul-rush/mat.html). A name may be
// defined only once across tones.js and every game's file. No imports.

export const MAT_SFX = {
  tones: {
    // The WELCOME mat: YOU surf the WELCOME mat down the House's wet, ribbed throat: jumping ribs, ducking uvulas, hopping onto the gristle ledge, skidding on bile.
    // Jumps: Spring and spit.
    ghoulMatJump: {
      layers: [
        { type: "sine", from: 160, to: 420, seconds: 0.14, attack: 0.003, gain: 0.6 },
        { type: "noise", seconds: 0.1, attack: 0, gain: 0.32, filter: { type: "highpass", from: 2340, to: 2340, q: 1 } },
        { type: "sine", from: 910, to: 195, seconds: 0.16, delay: 0.02, gain: 0.24 },
        { type: "brown", seconds: 0.12, attack: 0, gain: 0.2, filter: { type: "lowpass", from: 546, to: 546, q: 1 } },
      ],
    },
    // Lands: Belly flop.
    ghoulMatLand: {
      layers: [
        { type: "sine", from: 98, to: 46, seconds: 0.12, attack: 0.003, gain: 0.8 },
        { type: "noise", seconds: 0.09, attack: 0.003, gain: 0.5, filter: { type: "bandpass", from: 630, to: 315, q: 2 } },
        { type: "brown", seconds: 0.14, attack: 0.01, gain: 0.4, delay: 0.02, filter: { type: "lowpass", from: 350, to: 140, q: 3 } },
        { type: "noise", seconds: 0.28, attack: 0, gain: 0.45, filter: { type: "lowpass", from: 2080, to: 160, q: 1 }, delay: 0.02 },
        { type: "square", from: 112, to: 32, seconds: 0.16, attack: 0, gain: 0.25, filter: { type: "lowpass", from: 480, to: 480, q: 1 }, delay: 0.02 },
        { type: "sine", from: 720, to: 1040, seconds: 0.05, delay: 0.22, gain: 0.13 },
        { type: "sine", from: 608, to: 880, seconds: 0.05, delay: 0.36, gain: 0.09 },
      ],
    },
    // Spat out: Gulp and whoosh (in game).
    ghoulMatLaunch: {
      layers: [
        { type: "sine", from: 180, to: 60, seconds: 0.25, attack: 0.01, gain: 0.6 },
        { type: "noise", seconds: 0.7, attack: 0.25, gain: 0.45, delay: 0.1, filter: { type: "bandpass", from: 400, to: 2200, q: 2 } },
        { type: "sine", from: 300, to: 760, seconds: 0.45, attack: 0.1, gain: 0.3, delay: 0.15, vibrato: { rate: 7, depth: 0.05 } },
      ],
    },
    // Ducks: Quick swish.
    ghoulMatDuck: {
      layers: [
        { type: "noise", seconds: 0.2, attack: 0.07, gain: 0.64, filter: { type: "bandpass", from: 390, to: 2340, q: 1.5 } },
      ],
    },
    // Onto the ledge: Rubbery boing (in game).
    ghoulMatSwitch: {
      layers: [
        { type: "triangle", from: 260, to: 520, seconds: 0.14, attack: 0.004, gain: 0.45, vibrato: { rate: 24, depth: 0.08 } },
        { type: "sine", from: 520, to: 390, seconds: 0.16, attack: 0.004, gain: 0.25, delay: 0.1 },
      ],
    },
    // Crash: Smack, crunch, gasp (in game).
    ghoulMatCrash: {
      layers: [
        { type: "sine", from: 90, to: 34, seconds: 0.24, attack: 0, gain: 0.9 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.7, filter: { type: "lowpass", from: 300, to: 200, q: 1 } },
        { type: "noise", seconds: 0.08, attack: 0, gain: 0.6, delay: 0.02, filter: { type: "bandpass", from: 1600, to: 900, q: 3 } },
        { type: "noise", seconds: 0.3, attack: 0.05, gain: 0.25, delay: 0.12, filter: { type: "highpass", from: 2500, to: 1500, q: 1 } },
      ],
    },
    // Checkpoint: Lantern chime.
    ghoulMatCheck: {
      layers: [
        { type: "sine", from: 988, to: 985, seconds: 0.5, attack: 0.003, gain: 0.35 },
        { type: "sine", from: 1976, to: 1970, seconds: 0.3, attack: 0.003, gain: 0.12 },
      ],
    },
    // Finish: Doorstep jingle.
    ghoulMatFinish: {
      layers: [
        { type: "triangle", notes: [659, 784, 988, 1319], seconds: 0.9, attack: 0.01, gain: 0.5 },
        { type: "sine", from: 1319, to: 1312, seconds: 0.4, attack: 0.003, gain: 0.2, delay: 0.75, filter: { type: "lowpass", from: 1600, to: 1000, q: 1 } },
        { type: "sine", from: 2638, to: 2625, seconds: 0.24, attack: 0.003, gain: 0.07, delay: 0.75, filter: { type: "lowpass", from: 1600, to: 1000, q: 1 } },
      ],
    },
    // Onto bile: Sizzle.
    ghoulMatBile: {
      layers: [
        { type: "noise", seconds: 0.5, attack: 0.06, gain: 0.48, filter: { type: "highpass", from: 3120, to: 6500, q: 1 } },
        { type: "pink", seconds: 0.5, attack: 0.05, gain: 0.3, filter: { type: "bandpass", from: 4160, to: 2860, q: 2 } },
        { type: "sine", from: 572, to: 972, seconds: 0.05, delay: 0.17, attack: 0, gain: 0.14 },
        { type: "sine", from: 429, to: 730, seconds: 0.05, delay: 0.31, attack: 0, gain: 0.14 },
        { type: "sine", from: 476, to: 809, seconds: 0.05, delay: 0.32, attack: 0, gain: 0.14 },
        { type: "sine", from: 375, to: 637, seconds: 0.05, delay: 0.27, attack: 0, gain: 0.14 },
        { type: "sine", from: 927, to: 1576, seconds: 0.05, delay: 0.11, attack: 0, gain: 0.14 },
      ],
    },
    // The squeeze: A ring of muscle down the throat: the walls throb twice to warn, then it clamps down to just over a ducked head.
    // Throbs: Rising rumble.
    ghoulMatThrob: {
      layers: [
        { type: "brown", seconds: 0.6, attack: 0.08, gain: 0.7, filter: { type: "lowpass", from: 144, to: 56, q: 1 } },
        { type: "sine", from: 38, to: 24, seconds: 0.6, attack: 0.05, gain: 0.56 },
        { type: "sine", from: 50, to: 80, seconds: 0.5, attack: 0.2, gain: 0.5 },
      ],
    },
    // Clamps shut: Gulp.
    ghoulMatClose: {
      layers: [
        { type: "sine", from: 140, to: 39, seconds: 0.35, attack: 0.01, gain: 0.8 },
        { type: "brown", seconds: 0.39, attack: 0.02, gain: 0.55, filter: { type: "lowpass", from: 630, to: 112, q: 5 } },
      ],
    },
    // The swallowed furniture: Chairs, side tables and mantel clocks the House swallowed before YOU: they drop from the roof and tumble up the throat at YOU. Shoot twice or jump.
    // Drops: Creak and falling whistle (in game).
    ghoulMatFurnDrop: {
      layers: [
        { type: "sawtooth", from: 180, to: 140, seconds: 0.18, attack: 0.01, gain: 0.25, filter: { type: "lowpass", from: 900, to: 600, q: 4 } },
        { type: "sine", from: 1400, to: 500, seconds: 0.7, attack: 0.05, gain: 0.25, delay: 0.15 },
      ],
    },
    // Lands: Wooden thump on flesh (in game).
    ghoulMatFurnLand: {
      layers: [
        { type: "triangle", from: 160, to: 90, seconds: 0.14, attack: 0.002, gain: 0.7 },
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.5, filter: { type: "bandpass", from: 1800, to: 1000, q: 3 } },
        { type: "brown", seconds: 0.18, attack: 0.01, gain: 0.45, delay: 0.02, filter: { type: "lowpass", from: 500, to: 200, q: 2 } },
      ],
    },
    // Hit by a bolt: Chip.
    ghoulMatFurnHit: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.5, filter: { type: "bandpass", from: 2880, to: 1920, q: 2 } },
        { type: "square", from: 1440, to: 480, seconds: 0.05, attack: 0, gain: 0.2 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.35, filter: { type: "bandpass", from: 4160, to: 2880, q: 3 } },
      ],
    },
    // Breaks: Crash of kindling.
    ghoulMatFurnBreak: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0.003, gain: 0.63, filter: { type: "bandpass", from: 2200, to: 1100, q: 2.5 } },
        { type: "triangle", from: 220, to: 110, seconds: 0.14, attack: 0.003, gain: 0.68 },
        { type: "sine", from: 90, to: 45, seconds: 0.2, attack: 0.003, gain: 0.45 },
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.7, filter: { type: "bandpass", from: 1800, to: 1200, q: 2 }, delay: 0.05 },
        { type: "square", from: 900, to: 300, seconds: 0.05, attack: 0, gain: 0.28, delay: 0.05 },
        { type: "noise", seconds: 0.04, delay: 0.11, attack: 0, gain: 0.49, filter: { type: "bandpass", from: 2600, to: 1800, q: 3 } },
        { type: "noise", seconds: 0.05, attack: 0.003, gain: 0.35, delay: 0.12, filter: { type: "bandpass", from: 3080, to: 1540, q: 2.5 } },
        { type: "triangle", from: 308, to: 154, seconds: 0.14, attack: 0.003, gain: 0.38, delay: 0.12 },
        { type: "sine", from: 126, to: 63, seconds: 0.2, attack: 0.003, gain: 0.25, delay: 0.12 },
      ],
    },
    // The ways a heart goes: Played with the crash when a heart is lost, one for each cause.
    // Rib: Bone knock.
    ghoulMatRib: {
      layers: [
        { type: "triangle", from: 420, to: 357, seconds: 0.22, attack: 0, gain: 0.81 },
        { type: "sine", from: 1134, to: 1050, seconds: 0.12, attack: 0, gain: 0.32 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.45, filter: { type: "bandpass", from: 1680, to: 1680, q: 2 } },
        { type: "triangle", from: 300, to: 255, seconds: 0.22, attack: 0, gain: 0.45, delay: 0.08 },
        { type: "sine", from: 810, to: 750, seconds: 0.12, attack: 0, gain: 0.18, delay: 0.08 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.25, filter: { type: "bandpass", from: 1200, to: 1200, q: 2 }, delay: 0.08 },
      ],
    },
    // Uvula: Boing and buzz.
    ghoulMatUvula: {
      layers: [
        { type: "triangle", from: 200, to: 300, seconds: 0.25, attack: 0.003, gain: 0.5, vibrato: { rate: 18, depth: 0.1 } },
        { type: "square", from: 120, to: 120, seconds: 0.2, attack: 0.003, gain: 0.15, delay: 0.05, filter: { type: "lowpass", from: 800, to: 800, q: 1 } },
      ],
    },
    // Squeeze: Wheeze.
    ghoulMatSqueeze: {
      layers: [
        { type: "noise", seconds: 0.22, attack: 0.15, gain: 0.56, filter: { type: "bandpass", from: 990, to: 2160, q: 4 } },
        { type: "sawtooth", from: 180, to: 234, seconds: 0.2, attack: 0.14, gain: 0.2, filter: { type: "lowpass", from: 1260, to: 1260, q: 1 } },
        { type: "sine", from: 98, to: 46, seconds: 0.12, attack: 0.003, gain: 0.4 },
        { type: "noise", seconds: 0.09, attack: 0.003, gain: 0.25, filter: { type: "bandpass", from: 630, to: 315, q: 2 } },
        { type: "brown", seconds: 0.14, attack: 0.01, gain: 0.2, delay: 0.02, filter: { type: "lowpass", from: 350, to: 140, q: 3 } },
      ],
    },
  },
  music: {
    // Down the Hatch: seasick calliope. A band organ that has eaten something bad: two organ pipes play the waltz in
    // thirds, each wobbling at a different slow rate, so the harmony swims in and out of tune like a rolling deck.
    // The tuba keeps the oom-oom heartbeat. The middle part slides down chromatically at the start of each bar, a
    // stomach dropping; near full dread a piccolo shrieks down the scale.
    ghoulMarrowMat: {
      bpm: 156,
      rush: 16,
      voices: {
        organ: { wave: "pulse", duty: 0.5, gain: 0.09, decay: 0.05, sustain: 0.8, vibrato: { rate: 2.2, depth: 0.03 } },
        organ2: { wave: "pulse", duty: 0.25, gain: 0.07, decay: 0.05, sustain: 0.8, from: 0.2, vibrato: { rate: 2.7, depth: 0.03 } },
        tuba: { wave: "triangle", gain: 0.36, decay: 0.08, sustain: 0.6 },
        pah: { wave: "square", gain: 0.06, decay: 0.02, sustain: 0.3, from: 0.3 },
        ratchet: { kit: true, gain: 0.08, from: 0.5 },
        piccolo: { wave: "sine", gain: 0.07, decay: 0.02, sustain: 0.7, from: 0.85 },
      },
      patterns: {
        A: {
          organ:
          "D5 - - - A4 - - - F4 - - - | Bb4 - - - - - - - A4 - - - | " +
          "C#5 - - - A4 - - - E4 - - - | G4 - - - - - - - F4 - E4 - | " +
          "F4 - - - A4 - - - D5 - - - | G5 - - - - - F5 - E5 - D5 - | " +
          "C#5 - - - E5 - - - A5 - - - | D5 - - - - - - - . . . .",
          organ2:
          "F4 - - - F4 - - - D4 - - - | G4 - - - - - - - F4 - - - | " +
          "A4 - - - E4 - - - C#4 - - - | E4 - - - - - - - D4 - C#4 - | " +
          "D4 - - - F4 - - - A4 - - - | Bb4 - - - - - A4 - G4 - F4 - | " +
          "A4 - - - C#5 - - - E5 - - - | A4 - - - - - - - . . . .",
          tuba:
          "D2 - . . D2 - . . . . . . | G1 - . . G1 - . . . . . . | " +
          "A1 - . . A1 - . . . . . . | A1 - . . A1 - . . . . . . | " +
          "D2 - . . D2 - . . . . . . | G1 - . . G1 - . . . . . . | " +
          "A1 - . . A1 - . . . . . . | D2 - . . D2 - . . . . . .",
          pah:
          ". . . . . . . . F3^49 - . . | . . . . . . . . G3^37 - . . | " +
          ". . . . . . . . E3^59 - . . | . . . . . . . . E3^59 - . . | " +
          ". . . . . . . . F3^49 - . . | . . . . . . . . G3^37 - . . | " +
          ". . . . . . . . E3^59 - . . | . . . . . . . . F3^49 - . .",
          ratchet:
          ". . . . . . . . h h . . | . . . . . . . . h h . . | " +
          ". . . . . . . . h h . . | . . . . . . . . h h . . | " +
          ". . . . . . . . h h . . | . . . . . . . . h h . . | " +
          ". . . . . . . . h h . . | . . . . . . . . h h . .",
          piccolo:
          ". . . . . . . . . . . . | . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . | . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . | . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . | . . . . . . . . . . . .",
        },
        B: {
          organ:
          "A5 G#5 G5 F#5 F5 - - - . . . . | D5 - - - Bb4 - - - G4 - - - | " +
          "E5 Eb5 D5 C#5 C5 - - - . . . . | A4 - - - C#5 - - - E5 - - - | " +
          "F5 E5 Eb5 D5 C#5 - - - . . . . | Bb4 - - - G4 - - - D5 - - - | " +
          "C#5 - - - Bb4 - - - G4 - - - | A4 - - - E4 - - - C#4 - - -",
          organ2:
          "F5 E5 Eb5 D5 D5 - - - . . . . | Bb4 - - - G4 - - - D4 - - - | " +
          "C#5 C5 B4 Bb4 A4 - - - . . . . | E4 - - - A4 - - - C#5 - - - | " +
          "D5 C#5 C5 B4 A4 - - - . . . . | G4 - - - D4 - - - Bb4 - - - | " +
          "E4 - - - G4 - - - E4 - - - | C#4 - - - A3 - - - E3 - - -",
          tuba:
          "D2 - . . D2 - . . . . . . | G1 - . . G1 - . . . . . . | " +
          "A1 - . . A1 - . . . . . . | A1 - . . A1 - . . . . . . | " +
          "D2 - . . D2 - . . . . . . | G1 - . . G1 - . . . . . . | " +
          "A1 - . . A1 - . . . . . . | D2 - . . D2 - . . . . . .",
          pah:
          ". . . . . . . . F3^49 - . . | . . . . . . . . G3^37 - . . | " +
          ". . . . . . . . E3^59 - . . | . . . . . . . . E3^59 - . . | " +
          ". . . . . . . . F3^49 - . . | . . . . . . . . G3^37 - . . | " +
          ". . . . . . . . E3^59 - . . | . . . . . . . . F3^49 - . .",
          ratchet:
          ". . . . . . . . h h . . | . . . . . . . . h h . . | " +
          ". . . . . . . . h h . . | . . . . . . . . h h . . | " +
          ". . . . . . . . h h . . | . . . . . . . . h h . . | " +
          ". . . . . . . . h h . . | . . . . . . . . h h . .",
          piccolo:
          ". . . . . . . . . . . . | . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . | E6 D6 C#6 Bb5 A5 G5 F5 E5 D5 - - - | " +
          ". . . . . . . . . . . . | . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . | A6 G6 F6 E6 D6 C#6 Bb5 A5 G5 F5 E5 C#5",
        },
      },
      order: ["A", "B", "A"],
    },
  },
};
