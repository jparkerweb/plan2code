// Plan2Code Web Console - ghoul: the sounds for the finale's third kill, The Heart of Marrow in the Pit, merged into sfx/ghoul-sfx.js; defines only.
//
// Same shape and rules as ghoul-sfx-marrow.js: `tones` (the heart's `ghoulHeart<Act>`
// sounds, none over 1.2 s with its delay). `music` holds ghoulMarrowPit, the
// user's pick (Strings in the dark). The heart is two real thumps, felt more than heard, then the speakers
// strain; the roots are wood and wet earth, the pipes iron and gurgling; the HOLD FIRE
// flood is a rising tone in parts that never quite resolves until the last thump. These
// are the user's picks from the sound vote (prototypes/sounds/ghoul-rush/heart.html).
// A name may be defined only once across tones.js and every game's file. No imports.

export const HEART_SFX = {
  tones: {
    // The Heart of Marrow: the House's own heart, huge in the dark of the Pit.
    // Wakes: Three slow thumps.
    ghoulHeartWake: {
      layers: [
        { type: "sine", from: 66, to: 32, seconds: 0.3, attack: 0.006, gain: 0.95 },
        { type: "brown", seconds: 0.24, attack: 0.003, gain: 0.55, filter: { type: "lowpass", from: 240, to: 70, q: 1 } },
        { type: "sine", from: 66, to: 32, seconds: 0.3, attack: 0.006, gain: 0.95, delay: 0.38 },
        { type: "brown", seconds: 0.24, attack: 0.003, gain: 0.55, delay: 0.38, filter: { type: "lowpass", from: 240, to: 70, q: 1 } },
        { type: "sine", from: 66, to: 32, seconds: 0.36, attack: 0.006, gain: 0.95, delay: 0.76 },
        { type: "brown", seconds: 0.29, attack: 0.003, gain: 0.55, delay: 0.76, filter: { type: "lowpass", from: 240, to: 70, q: 1 } },
      ],
    },
    // Hit: a wet slap into muscle (plays often, so it stays short).
    ghoulHeartHurt: {
      layers: [
        { type: "noise", seconds: 0.07, attack: 0, gain: 0.45, filter: { type: "bandpass", from: 900, to: 400, q: 1.5 } },
        { type: "sine", from: 140, to: 70, seconds: 0.12, attack: 0.002, gain: 0.55 },
      ],
    },
    // Dies: Deflating.
    ghoulHeartDie: {
      layers: [
        { type: "noise", seconds: 1.1, attack: 0.06, gain: 0.48, filter: { type: "highpass", from: 1200, to: 2500, q: 1 } },
        { type: "pink", seconds: 1.1, attack: 0.05, gain: 0.3, filter: { type: "bandpass", from: 1600, to: 1100, q: 2 } },
        { type: "sine", from: 80, to: 30, seconds: 1, attack: 0.004, gain: 0.6 },
      ],
    },
    // Beats: Lub-dub, muffled.
    ghoulHeartBeat: {
      layers: [
        { type: "sine", from: 58, to: 34, seconds: 0.2, attack: 0.004, gain: 0.9 },
        { type: "sine", from: 54, to: 30, seconds: 0.26, attack: 0.004, gain: 0.9, delay: 0.3 },
      ],
    },
    // The ribs part: a wet creak of bone opening, the cue to fire.
    ghoulHeartOpen: {
      layers: [
        { type: "sawtooth", from: 240, to: 340, seconds: 0.16, attack: 0.02, gain: 0.3, vibrato: { rate: 30, depth: 0.08 }, filter: { type: "bandpass", from: 1200, to: 1600, q: 5 } },
        { type: "noise", seconds: 0.1, delay: 0.05, attack: 0.01, gain: 0.25, filter: { type: "bandpass", from: 1800, to: 2600, q: 2 } },
      ],
    },
    // Roots wind up: a low creak of wood under the floor and earth shifting.
    ghoulHeartRootWind: {
      layers: [
        { type: "sawtooth", from: 90, to: 70, seconds: 0.6, attack: 0.08, gain: 0.45, vibrato: { rate: 14, depth: 0.1 }, filter: { type: "bandpass", from: 500, to: 300, q: 6 } },
        { type: "brown", seconds: 0.7, attack: 0.15, gain: 0.5, filter: { type: "lowpass", from: 300, to: 160, q: 1 } },
      ],
    },
    // Roots crack: the second warning, the floor splitting.
    ghoulHeartRootCrack: {
      layers: [
        { type: "noise", seconds: 0.1, attack: 0, gain: 0.6, filter: { type: "bandpass", from: 1400, to: 600, q: 1.5 } },
        { type: "square", from: 160, to: 90, seconds: 0.12, attack: 0, gain: 0.3, filter: { type: "lowpass", from: 900, to: 300, q: 1 } },
        { type: "noise", seconds: 0.08, delay: 0.12, attack: 0, gain: 0.4, filter: { type: "bandpass", from: 1100, to: 500, q: 1.5 } },
      ],
    },
    // Roots burst up: a tearing of earth and a thick whip.
    ghoulHeartRootUp: {
      layers: [
        { type: "noise", seconds: 0.25, attack: 0.005, gain: 0.6, filter: { type: "bandpass", from: 600, to: 2200, q: 1 } },
        { type: "sine", from: 90, to: 220, seconds: 0.18, attack: 0.005, gain: 0.5 },
        { type: "brown", seconds: 0.3, attack: 0.005, gain: 0.5, filter: { type: "lowpass", from: 400, to: 120, q: 1 } },
      ],
    },
    // A grab winds up: roots slithering over stone, a creak.
    ghoulHeartGrabWind: {
      layers: [
        { type: "pink", seconds: 0.6, attack: 0.15, gain: 0.4, filter: { type: "bandpass", from: 900, to: 1600, q: 2 } },
        { type: "sawtooth", from: 130, to: 110, seconds: 0.5, delay: 0.1, attack: 0.08, gain: 0.35, vibrato: { rate: 18, depth: 0.1 }, filter: { type: "bandpass", from: 700, to: 500, q: 6 } },
      ],
    },
    // A grab tenses: wood drawn tight, rising.
    ghoulHeartGrabTense: {
      layers: [
        { type: "sawtooth", from: 150, to: 260, seconds: 0.4, attack: 0.05, gain: 0.4, vibrato: { rate: 22, depth: 0.07 }, filter: { type: "bandpass", from: 800, to: 1300, q: 7 } },
        { type: "noise", seconds: 0.3, delay: 0.1, attack: 0.1, gain: 0.25, filter: { type: "bandpass", from: 1500, to: 2400, q: 3 } },
      ],
    },
    // A grab lashes: a crack of a whip across the ledge.
    ghoulHeartGrabLash: {
      layers: [
        { type: "noise", seconds: 0.18, attack: 0, gain: 0.7, filter: { type: "highpass", from: 1800, to: 900, q: 1 } },
        { type: "sine", from: 400, to: 120, seconds: 0.14, attack: 0, gain: 0.45 },
      ],
    },
    // Clots wind up: the pipes over YOU gurgle and swell.
    ghoulHeartClotWind: {
      layers: [
        { type: "sine", from: 180, to: 120, seconds: 0.18, attack: 0.02, gain: 0.45, vibrato: { rate: 18, depth: 0.15 } },
        { type: "sine", from: 220, to: 140, seconds: 0.2, delay: 0.22, attack: 0.02, gain: 0.45, vibrato: { rate: 16, depth: 0.15 } },
        { type: "brown", seconds: 0.6, attack: 0.1, gain: 0.35, filter: { type: "bandpass", from: 300, to: 500, q: 3 } },
        { type: "square", from: 62, to: 62, seconds: 0.5, delay: 0.1, attack: 0.1, gain: 0.15, filter: { type: "lowpass", from: 200, to: 160, q: 1 } },
      ],
    },
    // A clot lands: a thick wet splat.
    ghoulHeartClotLand: {
      layers: [
        { type: "noise", seconds: 0.14, attack: 0, gain: 0.55, filter: { type: "lowpass", from: 1400, to: 300, q: 1 } },
        { type: "sine", from: 130, to: 55, seconds: 0.16, attack: 0.002, gain: 0.6 },
      ],
    },
    // The quake: the whole Pit rumbling, stone grinding.
    ghoulHeartQuake: {
      layers: [
        { type: "brown", seconds: 1.1, attack: 0.1, gain: 0.85, filter: { type: "lowpass", from: 200, to: 90, q: 1 } },
        { type: "sawtooth", from: 41, to: 36, seconds: 1.0, attack: 0.15, gain: 0.3, filter: { type: "lowpass", from: 180, to: 120, q: 1 } },
        { type: "noise", seconds: 0.8, delay: 0.2, attack: 0.2, gain: 0.25, filter: { type: "bandpass", from: 500, to: 300, q: 1 } },
      ],
    },
    // A chunk of roof lands: stone smashing on stone.
    ghoulHeartChunk: {
      layers: [
        { type: "noise", seconds: 0.3, attack: 0, gain: 0.7, filter: { type: "lowpass", from: 2400, to: 400, q: 1 } },
        { type: "sine", from: 90, to: 40, seconds: 0.25, attack: 0, gain: 0.7 },
      ],
    },
    // The beat stops dead: a sharp catch, then nothing.
    ghoulHeartStop: {
      layers: [
        { type: "sine", from: 70, to: 50, seconds: 0.12, attack: 0.004, gain: 0.7 },
        { type: "noise", seconds: 0.06, delay: 0.02, attack: 0, gain: 0.25, filter: { type: "bandpass", from: 1200, to: 800, q: 2 } },
      ],
    },
    // The swell: a long rising groan of strained muscle before the big wave.
    ghoulHeartSwell: {
      layers: [
        { type: "sawtooth", from: 45, to: 90, seconds: 0.8, attack: 0.3, gain: 0.5, vibrato: { rate: 7, depth: 0.05 }, filter: { type: "lowpass", from: 200, to: 700, q: 3 } },
        { type: "brown", seconds: 0.8, attack: 0.4, gain: 0.6, filter: { type: "lowpass", from: 150, to: 400, q: 1 } },
      ],
    },
    // Big wave: Boom.
    ghoulHeartSlam: {
      layers: [
        { type: "sine", from: 53, to: 26, seconds: 0.5, attack: 0.006, gain: 0.95 },
        { type: "brown", seconds: 0.4, attack: 0.003, gain: 0.55, filter: { type: "lowpass", from: 192, to: 56, q: 1 } },
        { type: "brown", seconds: 0.6, attack: 0.08, gain: 0.6, filter: { type: "lowpass", from: 180, to: 70, q: 1 } },
        { type: "sine", from: 48, to: 30, seconds: 0.6, attack: 0.05, gain: 0.48 },
      ],
    },
    // In the hold, a weak beat: soft, slow, failing.
    ghoulHeartWeakBeat: {
      layers: [
        { type: "sine", from: 56, to: 32, seconds: 0.22, attack: 0.01, gain: 0.55 },
        { type: "sine", from: 50, to: 30, seconds: 0.26, delay: 0.38, attack: 0.01, gain: 0.45 },
      ],
    },
    // A ripple reaches YOU in the hold: the light knocked back, a dull thud and a flutter.
    ghoulHeartKnock: {
      layers: [
        { type: "sine", from: 120, to: 60, seconds: 0.15, attack: 0.002, gain: 0.6 },
        { type: "triangle", from: 880, to: 520, seconds: 0.25, attack: 0.01, gain: 0.3 },
      ],
    },
    // The flood rising, one part a quarter (played higher each time): never quite resolving.
    ghoulHeartFlood: {
      layers: [
        { type: "triangle", from: 293.7, to: 311, seconds: 0.9, attack: 0.2, gain: 0.45, vibrato: { rate: 5, depth: 0.01 } },
        { type: "triangle", from: 440, to: 466, seconds: 0.9, delay: 0.05, attack: 0.25, gain: 0.35 },
        { type: "sine", from: 587, to: 622, seconds: 0.85, delay: 0.1, attack: 0.3, gain: 0.3 },
        { type: "pink", seconds: 0.9, attack: 0.3, gain: 0.15, filter: { type: "highpass", from: 3000, to: 5000, q: 1 } },
      ],
    },
    // The white: the light floods everything, a bright chord at last resolved.
    ghoulHeartWhite: {
      layers: [
        { type: "triangle", from: 293.7, to: 293.7, seconds: 1.1, attack: 0.05, gain: 0.5 },
        { type: "triangle", from: 370, to: 370, seconds: 1.1, attack: 0.08, gain: 0.4 },
        { type: "sine", from: 440, to: 440, seconds: 1.1, attack: 0.1, gain: 0.4 },
        { type: "sine", from: 587.3, to: 587.3, seconds: 1.0, delay: 0.1, attack: 0.15, gain: 0.3 },
        { type: "noise", seconds: 0.6, attack: 0.002, gain: 0.3, filter: { type: "highpass", from: 4000, to: 7000, q: 1 } },
      ],
    },
    // The last thump: one, enormous, and then silence.
    ghoulHeartLast: {
      layers: [
        { type: "sine", from: 64, to: 22, seconds: 0.9, attack: 0.005, gain: 1 },
        { type: "brown", seconds: 0.7, attack: 0.003, gain: 0.85, filter: { type: "lowpass", from: 300, to: 50, q: 1 } },
        { type: "noise", seconds: 0.12, attack: 0.002, gain: 0.25, filter: { type: "lowpass", from: 800, to: 200, q: 1 } },
      ],
    },
    // Daylight: a soft high shimmer far above, and a warm open fifth.
    ghoulHeartDaylight: {
      layers: [
        { type: "sine", from: 587.3, to: 587.3, seconds: 1.1, attack: 0.4, gain: 0.35 },
        { type: "sine", from: 880, to: 880, seconds: 1.0, delay: 0.1, attack: 0.4, gain: 0.3 },
        { type: "triangle", from: 1174.7, to: 1174.7, seconds: 0.9, delay: 0.2, attack: 0.3, gain: 0.2, vibrato: { rate: 6, depth: 0.004 } },
        { type: "pink", seconds: 1.0, attack: 0.5, gain: 0.12, filter: { type: "highpass", from: 5000, to: 7000, q: 1 } },
      ],
    },
  },
  music: {
    // The Pit: strings in the dark. A horror-film string section: low cellos grind the root against the half step
    // below in sixteenths, turning to the flat second every second bar, while basses pluck the heartbeat twice a bar
    // over a deep boom. Violas tremble on the fifth from 30% and sag to the tritone; from 60% violins stab high
    // octaves that end in a shriek of half steps. Once a loop the grinding stops for one held breath. A choir and a
    // high shiver at 90%; at full dread it all opens into D major.
    ghoulMarrowPit: {
      bpm: 100,
      rush: 16,
      voices: {
        heart: { wave: "triangle", gain: 0.42, decay: 0.05, sustain: 0.25 },
        celli: { wave: "sawtooth", gain: 0.05, decay: 0.04, sustain: 0.6 },
        boom: { kit: true, gain: 0.26, from: 0.2 },
        violas: { wave: "pulse", duty: 0.125, gain: 0.03, decay: 0.02, sustain: 0.6, from: 0.3 },
        stabs: { wave: "sawtooth", gain: 0.045, decay: 0.03, sustain: 0.25, from: 0.6 },
        shiver: { wave: "pulse", duty: 0.125, gain: 0.014, decay: 0.02, sustain: 0.5, from: 0.9 },
        choirLo: { wave: "triangle", gain: 0.05, decay: 1.2, sustain: 2.5, from: 0.9, vibrato: { rate: 4.5, depth: 0.008, delay: 0.3 } },
        choirHi: { wave: "triangle", gain: 0.04, decay: 1.2, sustain: 2.5, from: 0.9, vibrato: { rate: 4.5, depth: 0.008, delay: 0.3 } },
        fanfare: { wave: "sawtooth", gain: 0.06, decay: 0.12, sustain: 0.85, from: 0.995, vibrato: { rate: 5.5, depth: 0.006, delay: 0.15 } },
        sunThird: { wave: "triangle", gain: 0.14, decay: 0.4, sustain: 1, from: 0.995, vibrato: { rate: 5, depth: 0.006, delay: 0.3 } },
        sunTop: { wave: "triangle", gain: 0.1, decay: 0.4, sustain: 1, from: 0.995, vibrato: { rate: 4.5, depth: 0.006, delay: 0.3 } },
        bells: { wave: "sine", gain: 0.1, decay: 0.3, sustain: 0.3, from: 0.995 },
      },
      patterns: {
        A: {
          heart:
          "D2 . A1 . . . . . D2 . A1 . . . . . | D2 . A1 . . . . . D2 . A1 . . . . . | " +
          "Bb1 . F1 . . . . . Bb1 . F1 . . . . . | A1 . E1 . . . . . A1 . E1 . . . . .",
          celli:
          "D3 Db3 D3 Db3 D3 Db3 D3 Db3 D3 Db3 D3 Db3 D3 Db3 D3 Db3 | D3 Db3 D3 Db3 D3 Db3 D3 Db3 D3 Db3 D3 Db3 Eb3 D3 Eb3 D3 | " +
          "Bb2 A2 Bb2 A2 Bb2 A2 Bb2 A2 Bb2 A2 Bb2 A2 Bb2 A2 Bb2 A2 | A2 G2 A2 G2 A2 G2 A2 G2 A2 G2 A2 G2 Bb2 A2 Bb2 A2",
          violas:
          "A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 | A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 Ab4 Ab4 Ab4 Ab4 | " +
          "F4 F4 F4 F4 F4 F4 F4 F4 F4 F4 F4 F4 F4 F4 F4 F4 | E4 E4 E4 E4 E4 E4 E4 E4 E4 E4 E4 E4 Eb4 Eb4 Eb4 Eb4",
          boom:
          "k . k . . . . . k . k . . . . . | k . k . . . . . k . k . o . . . | " +
          "k . k . . . . . k . k . . . . . | k . k . . . . . k . k . o . . .",
          stabs:
          ". . . . . . D6 . . . . . . . D6 . | . . . . . . D6 . . . . . D6 Eb6 D6 Eb6 | " +
          ". . . . . . Bb5 . . . . . . . Bb5 . | . . . . . . A5 . . . . . A5 Bb5 A5 Bb5",
          shiver:
          "D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 | D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 | " +
          "Bb6 Bb6 Bb6 Bb6 Bb6 Bb6 Bb6 Bb6 Bb6 Bb6 Bb6 Bb6 Bb6 Bb6 Bb6 Bb6 | A6 A6 A6 A6 A6 A6 A6 A6 A6 A6 A6 A6 A6 A6 A6 A6",
          choirLo:
          "D3 - - - - - - - - - - - - - - - | D3 - - - - - - - - - - - - - - - | " +
          "Bb3 - - - - - - - - - - - - - - - | A3 - - - - - - - - - - - - - - -",
          choirHi:
          "A3 - - - - - - - - - - - - - - - | A3 - - - - - - - - - - - - - - - | " +
          "F3 - - - - - - - - - - - - - - - | E3 - - - - - - - - - - - - - - -",
          fanfare:
          "D5 . A4 . . . D5 - F#5 - - - A5 - - - | D5 . A4 . . . D5 - F#5 - - - . . . . | " +
          "Bb4 . F4 . . . Bb4 - D5 - - - F5 - - - | A4 . E4 . . . A4 - C#5 - - - . . . .",
          sunThird:
          "F#4 - - - - - - - - - - - - - - - | F#4 - - - - - - - - - - - . . . . | " +
          "D4 - - - - - - - - - - - - - - - | C#4 - - - - - - - - - - - . . . .",
          sunTop:
          "D5 - - - - - - - - - - - - - - - | D5 - - - - - - - - - - - . . . . | " +
          "F4 - - - - - - - - - - - - - - - | E4 - - - - - - - - - - - . . . .",
          bells:
          "D6 . . . F#6 . . . A6 . . . D7 . . . | D6 . . . F#6 . . . A6 . . . . . . . | " +
          "Bb5 . . . D6 . . . F6 . . . Bb6 . . . | A5 . . . C#6 . . . E6 . . . . . . .",
        },
        B: {
          heart:
          "D2 . A1 . . . . . D2 . A1 . . . . . | D2 . A1 . . . . . D2 . A1 . . . . . | " +
          "C2 . G1 . . . . . C2 . G1 . . . . . | A1 . E1 . . . . . A1 . E1 . . . . .",
          celli:
          "D3 Db3 D3 Db3 D3 Db3 D3 Db3 D3 Db3 D3 Db3 D3 Db3 D3 Db3 | D3 Db3 D3 Db3 D3 Db3 D3 Db3 D3 Db3 D3 Db3 Eb3 D3 Eb3 D3 | " +
          "C3 B2 C3 B2 C3 B2 C3 B2 C3 B2 C3 B2 C3 B2 C3 B2 | A2 G2 A2 G2 A2 G2 A2 G2 A2 G2 A2 G2 Bb2 A2 Bb2 A2",
          violas:
          "A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 | A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 Ab4 Ab4 Ab4 Ab4 | " +
          "G4 G4 G4 G4 G4 G4 G4 G4 G4 G4 G4 G4 G4 G4 G4 G4 | E4 E4 E4 E4 E4 E4 E4 E4 E4 E4 E4 E4 Eb4 Eb4 Eb4 Eb4",
          boom:
          "k . k . . . . . k . k . . . . . | k . k . . . . . k . k . o . . . | " +
          "k . k . . . . . k . k . . . . . | k . k . . . . . k . k . o . . .",
          stabs:
          ". . . . . . D6 . . . . . . . D6 . | . . . . . . D6 . . . . . D6 Eb6 D6 Eb6 | " +
          ". . . . . . C6 . . . . . . . C6 . | . . . . . . A5 . . . . . A5 Bb5 A5 Bb5",
          shiver:
          "D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 | D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 | " +
          "C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 | A6 A6 A6 A6 A6 A6 A6 A6 A6 A6 A6 A6 A6 A6 A6 A6",
          choirLo:
          "D3 - - - - - - - - - - - - - - - | D3 - - - - - - - - - - - - - - - | " +
          "C3 - - - - - - - - - - - - - - - | A3 - - - - - - - - - - - - - - -",
          choirHi:
          "A3 - - - - - - - - - - - - - - - | A3 - - - - - - - - - - - - - - - | " +
          "G3 - - - - - - - - - - - - - - - | E3 - - - - - - - - - - - - - - -",
          fanfare:
          "D5 . A4 . . . D5 - F#5 - - - A5 - - - | D5 . A4 . . . D5 - F#5 - - - . . . . | " +
          "C5 . G4 . . . C5 - E5 - - - G5 - - - | A4 . E4 . . . A4 - C#5 - - - . . . .",
          sunThird:
          "F#4 - - - - - - - - - - - - - - - | F#4 - - - - - - - - - - - . . . . | " +
          "E4 - - - - - - - - - - - - - - - | C#4 - - - - - - - - - - - . . . .",
          sunTop:
          "D5 - - - - - - - - - - - - - - - | D5 - - - - - - - - - - - . . . . | " +
          "G4 - - - - - - - - - - - - - - - | E4 - - - - - - - - - - - . . . .",
          bells:
          "D6 . . . F#6 . . . A6 . . . D7 . . . | D6 . . . F#6 . . . A6 . . . . . . . | " +
          "C6 . . . E6 . . . G6 . . . C7 . . . | A5 . . . C#6 . . . E6 . . . . . . .",
        },
        C: {
          heart:
          "Bb1 . F1 . . . . . Bb1 . F1 . . . . . | C2 . G1 . . . . . C2 . G1 . . . . . | " +
          "D2 . A1 . . . . . D2 . A1 . . . . . | D2 . A1 . . . . . D2 . A1 . . . . .",
          celli:
          "Bb2 A2 Bb2 A2 Bb2 A2 Bb2 A2 Bb2 A2 Bb2 A2 Bb2 A2 Bb2 A2 | C3 B2 C3 B2 C3 B2 C3 B2 C3 B2 C3 B2 Db3 C3 Db3 C3 | " +
          "D3 Db3 D3 Db3 D3 Db3 D3 Db3 D3 Db3 D3 Db3 D3 Db3 D3 Db3 | D3 Db3 D3 Db3 D3 Db3 D3 Db3 D3 Db3 D3 Db3 Eb3 D3 Eb3 D3",
          violas:
          "F4 F4 F4 F4 F4 F4 F4 F4 F4 F4 F4 F4 F4 F4 F4 F4 | G4 G4 G4 G4 G4 G4 G4 G4 G4 G4 G4 G4 Gb4 Gb4 Gb4 Gb4 | " +
          "A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 | A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 Ab4 Ab4 Ab4 Ab4",
          boom:
          "k . k . . . . . k . k . . . . . | k . k . . . . . k . k . o . . . | " +
          "k . k . . . . . k . k . . . . . | k . k . . . . . k . k . o . . .",
          stabs:
          ". . . . . . Bb5 . . . . . . . Bb5 . | . . . . . . C6 . . . . . C6 Db6 C6 Db6 | " +
          ". . . . . . D6 . . . . . . . D6 . | . . . . . . D6 . . . . . D6 Eb6 D6 Eb6",
          shiver:
          "Bb6 Bb6 Bb6 Bb6 Bb6 Bb6 Bb6 Bb6 Bb6 Bb6 Bb6 Bb6 Bb6 Bb6 Bb6 Bb6 | C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 | " +
          "D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 | D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6 D6",
          choirLo:
          "Bb3 - - - - - - - - - - - - - - - | C3 - - - - - - - - - - - - - - - | " +
          "D3 - - - - - - - - - - - - - - - | D3 - - - - - - - - - - - - - - -",
          choirHi:
          "F3 - - - - - - - - - - - - - - - | G3 - - - - - - - - - - - - - - - | " +
          "A3 - - - - - - - - - - - - - - - | A3 - - - - - - - - - - - - - - -",
          fanfare:
          "Bb4 . F4 . . . Bb4 - D5 - - - F5 - - - | C5 . G4 . . . C5 - E5 - - - . . . . | " +
          "D5 . A4 . . . D5 - F#5 - - - A5 - - - | D5 . A4 . . . D5 - F#5 - - - . . . .",
          sunThird:
          "D4 - - - - - - - - - - - - - - - | E4 - - - - - - - - - - - . . . . | " +
          "F#4 - - - - - - - - - - - - - - - | F#4 - - - - - - - - - - - . . . .",
          sunTop:
          "F4 - - - - - - - - - - - - - - - | G4 - - - - - - - - - - - . . . . | " +
          "D5 - - - - - - - - - - - - - - - | D5 - - - - - - - - - - - . . . .",
          bells:
          "Bb5 . . . D6 . . . F6 . . . Bb6 . . . | C6 . . . E6 . . . G6 . . . . . . . | " +
          "D6 . . . F#6 . . . A6 . . . D7 . . . | D6 . . . F#6 . . . A6 . . . . . . .",
        },
        X: {
          heart:
          "D2 . A1 . . . . . D2 . A1 . . . . . | D2 . A1 . . . . . D2 . A1 . . . . .",
          violas:
          "A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 | A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 A4 Ab4 Ab4 Ab4 Ab4",
          celli:
          ". . . . . . . . . . . . . . . . | . . . . . . . . D3 Db3 D3 Db3 Eb3 D3 Eb3 D3",
          boom:
          "k . k . . . . . k . k . . . . . | k . k . . . . . k k k k k k k k",
          choirLo:
          "D3 - - - - - - - - - - - - - - - | D3 - - - - - - - - - - - - - - -",
          choirHi:
          "A3 - - - - - - - - - - - - - - - | A3 - - - - - - - - - - - - - - -",
          fanfare:
          "D5 . A4 . . . D5 - F#5 - - - A5 - - - | D5 . A4 . . . D5 - F#5 - - - . . . .",
          sunThird:
          "F#4 - - - - - - - - - - - - - - - | F#4 - - - - - - - - - - - . . . .",
          sunTop:
          "D5 - - - - - - - - - - - - - - - | D5 - - - - - - - - - - - . . . .",
          bells:
          "D6 . . . F#6 . . . A6 . . . D7 . . . | D6 . . . F#6 . . . A6 . . . . . . .",
        },
      },
      order: ["A", "B", "A", "C", "X"],
    },
  },
};
