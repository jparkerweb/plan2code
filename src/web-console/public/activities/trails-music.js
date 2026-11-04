// Plan2Code Web Console - trails: its music tracks, merged into trails-sfx.js beside the sounds; defines only.
//
// Fourteen tracks, one dealt to each arena of a round (MUSIC_TRACKS and dealMusic in
// trails.js), picked on the pages in prototypes/music/light-trails. Most are dark,
// cinematic grid electro in minor keys at 96 to 120 bpm: a driving sawtooth bass (in
// threes against the beat, or a walking eighth-note ostinato), a sixteenth sequence
// ticking over a held note, sawtooth brass and a long pulse lead; the last three
// lean cyberpunk and synthwave. Each is the shape music.js documents,
// { bpm, rush, voices, patterns, order }, and builds with the heat: the bass, drums
// and sequence while a heat lines up, then the brass and lead once the riders go.
// A name may be defined only once across tones.js and every game's file. No imports.

export const TRAILS_MUSIC = {
  // Grid electro: A TRON-style D minor electro at 120: a sequenced sawtooth bass in groups of three
  // against the beat, a cold sixteenth sequence that walks its top note, dotted brass stabs, and a
  // heroic lead; the chorus rises through B-flat and C to a bright A major.
  trailsGridElectro: {
    bpm: 120,
    rush: 10,
    voices: {
      bass: { wave: "sawtooth", gain: 0.42, decay: 0.05, sustain: 0.3 },
      drums: { kit: true, gain: 0.8, from: 0.1 },
      seq: { wave: "pulse", duty: 0.125, gain: 0.2, decay: 0.03, sustain: 0.25, from: 0.2 },
      brass: { wave: "sawtooth", gain: 0.13, decay: 0.1, sustain: 0.7, from: 0.35 },
      lead: { wave: "pulse", duty: 0.25, gain: 0.34, decay: 0.12, sustain: 0.8, vibrato: { rate: 5.5, depth: 0.01, delay: 0.2 }, from: 0.5 },
    },
    patterns: {
      A: {
        bass: "D2 D2 D3 D2 D2 D3 D2 D2 D3 D2 D2 D3 D2 D3 D2 D3 | D2 D2 D3 D2 D2 D3 D2 D2 D3 D2 D2 D3 D2 D3 D2 D3 | Bb1 Bb1 Bb2 Bb1 Bb1 Bb2 Bb1 Bb1 Bb2 Bb1 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 | C2 C2 C3 C2 C2 C3 C2 C2 A1 A1 A2 A1 A1 A2 C#2 E2",
        drums: "k . h . s . h . k . h . s . h . | k . h . s . h . k . h . s . h k | k . h . s . h . k . h . s . h . | k . h . s . h k k . s . s s s s",
        seq: "D5 A4 F5 A4 D5 A4 F5 A4 D5 A4 F5 A4 E5 A4 F5 A4 | D5 A4 F5 A4 D5 A4 F5 A4 D5 A4 G5 A4 F5 A4 E5 A4 | D5 Bb4 F5 Bb4 D5 Bb4 F5 Bb4 D5 Bb4 F5 Bb4 G5 Bb4 F5 Bb4 | E5 C5 G5 C5 E5 C5 G5 C5 E5 C#5 A5 C#5 E5 C#5 G5 C#5",
      },
      B: {
        bass: "D2 D2 D3 D2 D2 D3 D2 D2 D3 D2 D2 D3 D2 D3 D2 D3 | D2 D2 D3 D2 D2 D3 D2 D2 D3 D2 D2 D3 D2 D3 D2 D3 | Bb1 Bb1 Bb2 Bb1 Bb1 Bb2 Bb1 Bb1 Bb2 Bb1 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 | C2 C2 C3 C2 C2 C3 C2 C2 A1 A1 A2 A1 A1 A2 C#2 E2",
        drums: "kh h h h sh h h h kh h kh h sh h h h | kh h h h sh h h h kh h kh h sh h h h | kh h h h sh h h h kh h kh h sh h h h | kh h h h sh h h h s . s s s s s s",
        seq: "D5 A4 F5 A4 D5 A4 F5 A4 D5 A4 F5 A4 E5 A4 F5 A4 | D5 A4 F5 A4 D5 A4 F5 A4 D5 A4 G5 A4 F5 A4 E5 A4 | D5 Bb4 F5 Bb4 D5 Bb4 F5 Bb4 D5 Bb4 F5 Bb4 G5 Bb4 F5 Bb4 | E5 C5 G5 C5 E5 C5 G5 C5 E5 C#5 A5 C#5 E5 C#5 G5 C#5",
        brass: "D4^037 - - . . . D4^037 - - . . . D4^037 - - . | D4^037 - - . . . D4^037 - - . . . D4^037 - - . | Bb3^047 - - . . . Bb3^047 - - . . . Bb3^047 - - . | C4^047 - - . . . C4^047 - A3^047 - - . . . A3^047 -",
        lead: "D6 - - - - - - - C6 - A5 - - - F5 - | G5 - - - A5 - - - F5 - - - E5 - D5 - | F5 - - - - - - - D6 - - - C6 - Bb5 - | C6 - - - - - - - C#6 - - - E6 - - -",
      },
      C: {
        bass: "Bb1 Bb1 Bb2 Bb1 Bb1 Bb2 Bb1 Bb1 Bb2 Bb1 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 | C2 C2 C3 C2 C2 C3 C2 C2 C3 C2 C2 C3 C2 C3 C2 C3 | A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A2 A1 A2 | D2 D2 D3 D2 D2 D3 D2 D2 D3 D2 D2 D3 C2 C3 A1 A2",
        drums: "k . h k s . h k k . h k s . h k | k . h k s . h k k . h k s . h k | k . h k s . h k k . h k s . h k | k . h k s . h k s s s s s s s s",
        seq: "F5 D5 Bb4 D5 F5 D5 Bb4 D5 F5 D5 Bb4 D5 F5 D5 Bb4 D5 | G5 E5 C5 E5 G5 E5 C5 E5 G5 E5 C5 E5 G5 E5 C5 E5 | E5 C#5 A4 C#5 E5 C#5 A4 C#5 E5 C#5 A4 C#5 E5 C#5 A4 C#5 | F5 D5 A4 D5 F5 D5 A4 D5 F5 D5 A4 D5 A5 F5 D5 A4",
        brass: "Bb3^047 - - - - - - - - - - - - - - - | C4^047 - - - - - - - - - - - - - - - | A3^047 - - - - - - - - - - - - - - - | D4^037 - - - - - - - - - - - - - - -",
        lead: "D6 - - - F6 - - - D6 - - - Bb5 - C6 - | E6 - - - G6 - - - E6 - - - C6 - D6 - | C#6 - - - E6 - - - A5 - - - C#6 - E6 - | D6 - - - - - - - - - - - . . . .",
      },
      D: {
        bass: "D2 - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - - | Bb1 - - - - - - - - - - - - - - - | A1 - - - - - - - A1 - - - A1 - A1 -",
        drums: ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h . | s . s . s . s . s s s s s s s s",
        seq: "D5 A4 F5 A4 D5 A4 F5 A4 D5 A4 F5 A4 E5 A4 F5 A4 | D5 A4 F5 A4 D5 A4 F5 A4 D5 A4 G5 A4 F5 A4 E5 A4 | D5 Bb4 F5 Bb4 D5 Bb4 F5 Bb4 D5 Bb4 F5 Bb4 G5 Bb4 F5 Bb4 | E5 C#5 A5 C#5 E5 C#5 A5 C#5 E5 C#5 A5 C#5 G5 E5 C#5 A4",
        lead: "A5 - - - - - - - - - - - - - - - | G5 - - - - - - - F5 - - - - - - - | F5 - - - - - - - - - - - - - - - | E5 - - - - - - - C#5 - - - - - - -",
      },
    },
    order: ["A", "B", "C", "D", "B", "C"],
  },
  // Recognizer: Something huge patrolling overhead at 104: a heavy eighth-note ostinato that walks
  // down to G at the end of each bar, big half-time snares and slow brass swells; the chorus pounds
  // up through A-flat and B-flat to a high G, and the last section slips onto a menacing D-flat.
  trailsRecognizer: {
    bpm: 104,
    rush: 16,
    voices: {
      bass: { wave: "sawtooth", gain: 0.44, decay: 0.06, sustain: 0.4 },
      drums: { kit: true, gain: 0.82, from: 0.1 },
      seq: { wave: "pulse", duty: 0.125, gain: 0.18, decay: 0.03, sustain: 0.25, from: 0.2 },
      brass: { wave: "sawtooth", gain: 0.14, decay: 0.2, sustain: 0.8, from: 0.35 },
      lead: { wave: "pulse", duty: 0.25, gain: 0.34, decay: 0.12, sustain: 0.8, vibrato: { rate: 5, depth: 0.012, delay: 0.2 }, from: 0.5 },
    },
    patterns: {
      A: {
        bass: "C2 - C2 - C3 - C2 - C2 - C2 - Bb1 - G1 - | Ab1 - Ab1 - Ab2 - Ab1 - Ab1 - Ab1 - G1 - F1 - | F1 - F1 - F2 - F1 - F1 - F1 - Ab1 - Bb1 - | G1 - G1 - G2 - G1 - G1 - G1 - B1 - D2 -",
        drums: "k . . . . . . . s . . . . . . . | k . . . . . . . s . . . . . . . | k . . . . . . . s . . . . . . . | k . . . . . . . s . s . s s s s",
        seq: "C5 G4 Eb5 G4 C5 G4 Eb5 G4 C5 G4 Eb5 G4 D5 G4 Eb5 G4 | C5 Ab4 Eb5 Ab4 C5 Ab4 Eb5 Ab4 C5 Ab4 Eb5 Ab4 F5 Ab4 Eb5 Ab4 | C5 F4 Ab4 F4 C5 F4 Ab4 F4 C5 F4 Ab4 F4 Bb4 F4 Ab4 F4 | B4 G4 D5 G4 B4 G4 D5 G4 B4 G4 D5 G4 F5 G4 D5 B4",
      },
      B: {
        bass: "C2 - C2 - C3 - C2 - C2 - C2 - Bb1 - G1 - | Ab1 - Ab1 - Ab2 - Ab1 - Ab1 - Ab1 - G1 - F1 - | F1 - F1 - F2 - F1 - F1 - F1 - Ab1 - Bb1 - | G1 - G1 - G2 - G1 - G1 - G1 - B1 - D2 -",
        drums: "k . h . h . h . s . h . h . h k | k . h . h . h . s . h . h . h k | k . h . h . h . s . h . h . h k | k . h . h . h . s . s s s s s s",
        seq: "C5 G4 Eb5 G4 C5 G4 Eb5 G4 C5 G4 Eb5 G4 D5 G4 Eb5 G4 | C5 Ab4 Eb5 Ab4 C5 Ab4 Eb5 Ab4 C5 Ab4 Eb5 Ab4 F5 Ab4 Eb5 Ab4 | C5 F4 Ab4 F4 C5 F4 Ab4 F4 C5 F4 Ab4 F4 Bb4 F4 Ab4 F4 | B4 G4 D5 G4 B4 G4 D5 G4 B4 G4 D5 G4 F5 G4 D5 B4",
        brass: "C4^037 - - - - - - - - - - - C4^037 - - - | Ab3^047 - - - - - - - - - - - Ab3^047 - - - | F3^037 - - - - - - - - - - - F3^037 - - - | G3^047 - - - - - - - G3^047a - - - G3^047a - - -",
        lead: "G5 - - - - - - - - - - - Ab5 - G5 - | Eb5 - - - - - - - - - - - F5 - Eb5 - | C5 - - - - - - - Eb5 - - - F5 - - - | D5 - - - - - - - B4 - - - - - - -",
      },
      C: {
        bass: "Ab1 Ab1 Ab2 Ab1 Ab1 Ab1 Ab2 Ab1 Ab1 Ab1 Ab2 Ab1 Ab1 Ab2 Ab1 Ab2 | Bb1 Bb1 Bb2 Bb1 Bb1 Bb1 Bb2 Bb1 Bb1 Bb1 Bb2 Bb1 Bb1 Bb2 Bb1 Bb2 | C2 C2 C3 C2 C2 C2 C3 C2 C2 C2 C3 C2 C2 C3 C2 C3 | G1 G1 G2 G1 G1 G1 G2 G1 G1 G1 G2 G1 B1 B1 D2 D2",
        drums: "k . h k s . h . k . h k s . h k | k . h k s . h . k . h k s . h k | k . h k s . h . k . h k s . h k | k . h k s . h k s s s s ks s ks s",
        seq: "Eb5 C5 Ab4 C5 Eb5 C5 Ab4 C5 Eb5 C5 Ab4 C5 Eb5 C5 Ab4 C5 | F5 D5 Bb4 D5 F5 D5 Bb4 D5 F5 D5 Bb4 D5 F5 D5 Bb4 D5 | G5 Eb5 C5 Eb5 G5 Eb5 C5 Eb5 G5 Eb5 C5 Eb5 G5 Eb5 C5 Eb5 | G5 D5 B4 D5 G5 D5 B4 D5 G5 D5 B4 D5 F5 D5 B4 G4",
        brass: "Ab3^047 - - - - - - - - - - - - - - - | Bb3^047 - - - - - - - - - - - - - - - | C4^037 - - - - - - - - - - - - - - - | G3^047 - - - - - - - - - - - - - - -",
        lead: "C6 - - - - - - - Eb6 - - - C6 - Ab5 - | D6 - - - - - - - F6 - - - D6 - Bb5 - | Eb6 - - - - - - - G6 - - - F6 - Eb6 - | D6 - - - - - - - B5 - - - G5 - - -",
      },
      D: {
        bass: "C2 - C2 - C3 - C2 - C2 - C2 - Bb1 - G1 - | Db2 - Db2 - Db3 - Db2 - Db2 - Db2 - C2 - Bb1 - | C2 - C2 - C3 - C2 - C2 - C2 - Bb1 - G1 - | G1 - G1 - G2 - G1 - G1 - G1 - B1 - D2 -",
        drums: "k . h . h . h . s . h . h . h k | k . h . h . h . s . h . h . h k | k . h . h . h . s . h . h . h k | k . h . h . h . s . s s s s s s",
        seq: "C5 G4 Eb5 G4 C5 G4 Eb5 G4 C5 G4 Eb5 G4 D5 G4 Eb5 G4 | Db5 Ab4 F5 Ab4 Db5 Ab4 F5 Ab4 Db5 Ab4 F5 Ab4 Eb5 Ab4 F5 Ab4 | C5 G4 Eb5 G4 C5 G4 Eb5 G4 C5 G4 Eb5 G4 D5 G4 Eb5 G4 | B4 G4 D5 G4 B4 G4 D5 G4 B4 G4 D5 G4 F5 G4 D5 B4",
        brass: "C4^037 - - - - - - - - - - - - - - - | Db4^047 - - - - - - - - - - - - - - - | C4^037 - - - - - - - - - - - - - - - | G3^047 - - - - - - - - - - - - - - -",
        lead: "C6 - - - - - - - - - - - - - - - | Db6 - - - - - - - - - - - C6 - - - | Eb6 - - - - - - - - - - - D6 - C6 - | B5 - - - - - - - D6 - - - G6 - - -",
      },
    },
    order: ["A", "B", "C", "D", "C"],
  },
  // Mainframe: A minor at 112: a sawtooth bass in threes against the beat, a sequence that ticks
  // over a low A pedal and reaches up to G, dotted brass and a lead that leaps a fourth and
  // settles; the chorus climbs F, G, A minor to a harmonic-minor E7, and the break slides onto a
  // dark B-flat.
  trailsMainframe: {
    bpm: 112,
    rush: 12,
    voices: {
      bass: { wave: "sawtooth", gain: 0.42, decay: 0.05, sustain: 0.3 },
      drums: { kit: true, gain: 0.8, from: 0.1 },
      seq: { wave: "pulse", duty: 0.125, gain: 0.2, decay: 0.03, sustain: 0.25, from: 0.2 },
      brass: { wave: "sawtooth", gain: 0.13, decay: 0.12, sustain: 0.75, from: 0.35 },
      lead: { wave: "pulse", duty: 0.25, gain: 0.34, decay: 0.12, sustain: 0.8, vibrato: { rate: 5.5, depth: 0.01, delay: 0.2 }, from: 0.5 },
    },
    patterns: {
      A: {
        bass: "A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A2 A1 A2 | A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A2 A1 A2 | F1 F1 F2 F1 F1 F2 F1 F1 F2 F1 F1 F2 F1 F2 F1 F2 | E1 E1 E2 E1 E1 E2 E1 E1 E2 E1 E1 E2 G#1 B1 D2 E2",
        drums: "k . h . s . h . k . h . s . h . | k . h . s . h . k . h . s . h k | k . h . s . h . k . h . s . h . | k . h . s . h k k . s . s s s s",
        seq: "C5 A4 E5 A4 C5 A4 E5 A4 C5 A4 E5 A4 F5 A4 E5 A4 | C5 A4 E5 A4 C5 A4 E5 A4 C5 A4 G5 A4 F5 A4 E5 A4 | C5 A4 F5 A4 C5 A4 F5 A4 C5 A4 F5 A4 G5 A4 F5 A4 | B4 G#4 E5 G#4 B4 G#4 E5 G#4 B4 G#4 E5 G#4 F5 E5 D5 B4",
      },
      B: {
        bass: "A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A2 A1 A2 | A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A2 A1 A2 | F1 F1 F2 F1 F1 F2 F1 F1 F2 F1 F1 F2 F1 F2 F1 F2 | E1 E1 E2 E1 E1 E2 E1 E1 E2 E1 E1 E2 G#1 B1 D2 E2",
        drums: "kh h h h sh h h h kh h kh h sh h h h | kh h h h sh h h h kh h kh h sh h h h | kh h h h sh h h h kh h kh h sh h h h | kh h h h sh h h h s . s s s s s s",
        seq: "C5 A4 E5 A4 C5 A4 E5 A4 C5 A4 E5 A4 F5 A4 E5 A4 | C5 A4 E5 A4 C5 A4 E5 A4 C5 A4 G5 A4 F5 A4 E5 A4 | C5 A4 F5 A4 C5 A4 F5 A4 C5 A4 F5 A4 G5 A4 F5 A4 | B4 G#4 E5 G#4 B4 G#4 E5 G#4 B4 G#4 E5 G#4 F5 E5 D5 B4",
        brass: "A3^037 - - . . . A3^037 - - . . . A3^037 - - . | A3^037 - - . . . A3^037 - - . . . A3^037 - - . | F3^047 - - . . . F3^047 - - . . . F3^047 - - . | E3^047 - - . . . E3^047 - - . E3^047 - E3^047 - - .",
        lead: "E5 - - - - - - - A5 - - - - - G5 - | E5 - - - - - - - C5 - - - D5 - E5 - | F5 - - - - - - - A5 - - - C6 - - - | B5 - - - - - - - G#5 - - - E5 - - -",
      },
      C: {
        bass: "F1 F1 F2 F1 F1 F2 F1 F1 F2 F1 F1 F2 F1 F2 F1 F2 | G1 G1 G2 G1 G1 G2 G1 G1 G2 G1 G1 G2 G1 G2 G1 G2 | A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A2 A1 A2 | E1 E1 E2 E1 E1 E2 E1 E1 E2 E1 E1 E2 G#1 B1 D2 E2",
        drums: "k . h k s . h k k . h k s . h k | k . h k s . h k k . h k s . h k | k . h k s . h k k . h k s . h k | k . h k s . h k s s s s ks s ks s",
        seq: "C5 A4 F5 A4 C5 A4 F5 A4 C5 A4 F5 A4 A5 A4 F5 A4 | D5 B4 G5 B4 D5 B4 G5 B4 D5 B4 G5 B4 B5 B4 G5 B4 | E5 C5 A5 C5 E5 C5 A5 C5 E5 C5 A5 C5 C6 C5 A5 C5 | E5 B4 G#5 B4 E5 B4 G#5 B4 E5 B4 G#5 B4 B5 G#5 E5 B4",
        brass: "F3^047 - - - - - - - - - - - - - - - | G3^047 - - - - - - - - - - - - - - - | A3^037 - - - - - - - - - - - - - - - | E3^047 - - - - - - - E3^047a - - - - - - -",
        lead: "A5 - - - - - - - C6 - - - F6 - - - | D6 - - - - - - - B5 - - - G5 - - - | C6 - - - - - - - E6 - - - D6 - C6 - | B5 - - - - - - - G#5 - - - E5 - - -",
      },
      D: {
        bass: "A1 - - - - - - - A2 - - - - - - - | Bb1 - - - - - - - Bb2 - - - - - - - | A1 - - - - - - - A2 - - - - - - - | E1 - - - E2 - - - E1 - E1 - E2 E2 E2 E2",
        drums: "k . . . . . . . s . . . . . . . | k . . . . . . . s . . . . . . . | k . . . . . . . s . . . . . . . | k . . . . . . . s . s . s s s s",
        seq: "C5 A4 E5 A4 C5 A4 E5 A4 C5 A4 E5 A4 F5 A4 E5 A4 | D5 Bb4 F5 Bb4 D5 Bb4 F5 Bb4 D5 Bb4 F5 Bb4 G5 Bb4 F5 Bb4 | C5 A4 E5 A4 C5 A4 E5 A4 C5 A4 E5 A4 F5 A4 E5 A4 | B4 G#4 E5 G#4 B4 G#4 E5 G#4 B4 G#4 E5 G#4 F5 E5 D5 B4",
        brass: "A3^037 - - - - - - - - - - - - - - - | Bb3^047 - - - - - - - - - - - - - - - | A3^037 - - - - - - - - - - - - - - - | E3^047 - - - - - - - - - - - - - - -",
        lead: "A5 - - - - - - - - - - - - - - - | Bb5 - - - - - - - - - - - A5 - - - | C6 - - - - - - - - - - - B5 - A5 - | G#5 - - - - - - - B5 - - - E6 - - -",
      },
    },
    order: ["A", "B", "C", "B", "D", "C"],
  },
  // Black ICE: Cold F minor at 108: an eighth-note ostinato that dips to the seventh and fifth in
  // every bar, half-time snares, swelling brass and a lead that falls in slow steps; the chorus
  // switches to the three-against-four bass over D-flat and E-flat, and the last section slips onto
  // a Neapolitan G-flat.
  trailsBlackIce: {
    bpm: 108,
    rush: 16,
    voices: {
      bass: { wave: "sawtooth", gain: 0.44, decay: 0.06, sustain: 0.4 },
      drums: { kit: true, gain: 0.82, from: 0.1 },
      seq: { wave: "pulse", duty: 0.125, gain: 0.18, decay: 0.03, sustain: 0.25, from: 0.2 },
      brass: { wave: "sawtooth", gain: 0.14, decay: 0.2, sustain: 0.8, from: 0.35 },
      lead: { wave: "pulse", duty: 0.25, gain: 0.34, decay: 0.12, sustain: 0.8, vibrato: { rate: 5, depth: 0.012, delay: 0.2 }, from: 0.5 },
    },
    patterns: {
      A: {
        bass: "F1 - F1 - F2 - F1 - Eb2 - F1 - C2 - F1 - | Db2 - Db2 - Db3 - Db2 - C3 - Db2 - Ab1 - Db2 - | Bb1 - Bb1 - Bb2 - Bb1 - Ab2 - Bb1 - F1 - Bb1 - | C2 - C2 - C3 - C2 - Bb2 - C2 - E2 - G2 -",
        drums: "k . . . . . h . s . . . . . h . | k . . . . . h . s . . . . . h k | k . . . . . h . s . . . . . h . | k . . . . . h . s . s . s s s s",
        seq: "Ab4 F4 C5 F4 Ab4 F4 C5 F4 Ab4 F4 C5 F4 Db5 F4 C5 F4 | Ab4 F4 Db5 F4 Ab4 F4 Db5 F4 Ab4 F4 Db5 F4 Eb5 F4 Db5 F4 | Bb4 F4 Db5 F4 Bb4 F4 Db5 F4 Bb4 F4 Db5 F4 Eb5 F4 Db5 F4 | Bb4 E4 C5 E4 G4 E4 C5 E4 Bb4 E4 C5 E4 Db5 C5 Bb4 G4",
      },
      B: {
        bass: "F1 - F1 - F2 - F1 - Eb2 - F1 - C2 - F1 - | Db2 - Db2 - Db3 - Db2 - C3 - Db2 - Ab1 - Db2 - | Bb1 - Bb1 - Bb2 - Bb1 - Ab2 - Bb1 - F1 - Bb1 - | C2 - C2 - C3 - C2 - Bb2 - C2 - E2 - G2 -",
        drums: "k . h . h . h . s . h . h . h k | k . h . h . h . s . h . h . h k | k . h . h . h . s . h . h . h k | k . h . h . h . s . s s s s s s",
        seq: "Ab4 F4 C5 F4 Ab4 F4 C5 F4 Ab4 F4 C5 F4 Db5 F4 C5 F4 | Ab4 F4 Db5 F4 Ab4 F4 Db5 F4 Ab4 F4 Db5 F4 Eb5 F4 Db5 F4 | Bb4 F4 Db5 F4 Bb4 F4 Db5 F4 Bb4 F4 Db5 F4 Eb5 F4 Db5 F4 | Bb4 E4 C5 E4 G4 E4 C5 E4 Bb4 E4 C5 E4 Db5 C5 Bb4 G4",
        brass: "F3^037 - - - - - - - - - - - F3^037 - - - | Db4^047 - - - - - - - - - - - Db4^047 - - - | Bb3^037 - - - - - - - - - - - Bb3^037 - - - | C4^047 - - - - - - - C4^047a - - - C4^047a - - -",
        lead: "C6 - - - - - - - Ab5 - - - G5 - F5 - | F5 - - - - - - - - - - - Eb5 - Db5 - | Db5 - - - - - - - F5 - - - Bb5 - - - | G5 - - - - - - - E5 - - - C5 - - -",
      },
      C: {
        bass: "Db2 Db2 Db3 Db2 Db2 Db3 Db2 Db2 Db3 Db2 Db2 Db3 Db2 Db3 Db2 Db3 | Eb2 Eb2 Eb3 Eb2 Eb2 Eb3 Eb2 Eb2 Eb3 Eb2 Eb2 Eb3 Eb2 Eb3 Eb2 Eb3 | F1 F1 F2 F1 F1 F2 F1 F1 F2 F1 F1 F2 F1 F2 F1 F2 | C2 C2 C3 C2 C2 C3 C2 C2 C3 C2 C2 C3 E2 G2 Bb2 C3",
        drums: "k . h k s . h . k . h k s . h k | k . h k s . h . k . h k s . h k | k . h k s . h . k . h k s . h k | k . h k s . h k s s s s ks s ks s",
        seq: "F5 Db5 Ab5 Db5 F5 Db5 Ab5 Db5 F5 Db5 Ab5 Db5 Bb5 Db5 Ab5 Db5 | G5 Eb5 Bb5 Eb5 G5 Eb5 Bb5 Eb5 G5 Eb5 Bb5 Eb5 C6 Eb5 Bb5 Eb5 | Ab5 F5 C6 F5 Ab5 F5 C6 F5 Ab5 F5 C6 F5 Db6 F5 C6 F5 | G5 E5 C6 E5 G5 E5 C6 E5 G5 E5 Bb5 E5 C6 Bb5 G5 E5",
        brass: "Db4^047 - - - - - - - - - - - - - - - | Eb4^047 - - - - - - - - - - - - - - - | F3^037 - - - - - - - - - - - - - - - | C4^047 - - - - - - - - - - - - - - -",
        lead: "Ab5 - - - - - - - F5 - - - Db6 - - - | Bb5 - - - - - - - G5 - - - Eb6 - - - | C6 - - - - - - - Ab5 - - - F6 - Eb6 - | E6 - - - - - - - C6 - - - G5 - - -",
      },
      D: {
        bass: "F1 - F1 - F2 - F1 - Eb2 - F1 - C2 - F1 - | Gb1 - Gb1 - Gb2 - Gb1 - F2 - Gb1 - Db2 - Gb1 - | F1 - F1 - F2 - F1 - Eb2 - F1 - C2 - F1 - | C2 - C2 - C3 - C2 - Bb2 - C2 - E2 - G2 -",
        drums: "k . h . h . h . s . h . h . h k | k . h . h . h . s . h . h . h k | k . h . h . h . s . h . h . h k | k . h . h . h . s . s s s s s s",
        seq: "Ab4 F4 C5 F4 Ab4 F4 C5 F4 Ab4 F4 C5 F4 Db5 F4 C5 F4 | Bb4 Gb4 Db5 Gb4 Bb4 Gb4 Db5 Gb4 Bb4 Gb4 Db5 Gb4 Eb5 Gb4 Db5 Gb4 | Ab4 F4 C5 F4 Ab4 F4 C5 F4 Ab4 F4 C5 F4 Db5 F4 C5 F4 | Bb4 E4 C5 E4 G4 E4 C5 E4 Bb4 E4 C5 E4 Db5 C5 Bb4 G4",
        brass: "F3^037 - - - - - - - - - - - - - - - | Gb3^047 - - - - - - - - - - - - - - - | F3^037 - - - - - - - - - - - - - - - | C4^047 - - - - - - - - - - - - - - -",
        lead: "F5 - - - - - - - - - - - - - - - | Gb5 - - - - - - - - - - - F5 - - - | Ab5 - - - - - - - - - - - G5 - F5 - | E5 - - - - - - - G5 - - - C6 - - -",
      },
    },
    order: ["A", "B", "C", "D", "C"],
  },
  // Sentinel: E minor at 100, slow and enormous: a deep three-against-four bass under half-time
  // drums, a sequence ringing over a high E pedal, and a lead that rises B, E, G like a call; the
  // chorus leaps a sixth over C and D, and the bridge leans on a Phrygian F before the last chorus.
  trailsSentinel: {
    bpm: 100,
    rush: 16,
    voices: {
      bass: { wave: "sawtooth", gain: 0.44, decay: 0.05, sustain: 0.32 },
      drums: { kit: true, gain: 0.82, from: 0.1 },
      seq: { wave: "pulse", duty: 0.125, gain: 0.18, decay: 0.03, sustain: 0.25, from: 0.2 },
      brass: { wave: "sawtooth", gain: 0.14, decay: 0.2, sustain: 0.8, from: 0.35 },
      lead: { wave: "pulse", duty: 0.25, gain: 0.34, decay: 0.12, sustain: 0.8, vibrato: { rate: 5, depth: 0.012, delay: 0.2 }, from: 0.5 },
    },
    patterns: {
      A: {
        bass: "E1 E1 E2 E1 E1 E2 E1 E1 E2 E1 E1 E2 E1 E2 E1 E2 | C2 C2 C3 C2 C2 C3 C2 C2 C3 C2 C2 C3 C2 C3 C2 C3 | A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A2 A1 A2 | B1 B1 B2 B1 B1 B2 B1 B1 B2 B1 B1 B2 D#2 F#2 A2 B2",
        drums: "k . . . . . . k s . . . . . . . | k . . . . . . k s . . . . . . . | k . . . . . . k s . . . . . . . | k . . . . . . k s . s . s s s s",
        seq: "G5 E5 B5 E5 G5 E5 B5 E5 G5 E5 B5 E5 A5 E5 B5 E5 | G5 E5 C6 E5 G5 E5 C6 E5 G5 E5 C6 E5 D6 E5 C6 E5 | A5 E5 C6 E5 A5 E5 C6 E5 A5 E5 C6 E5 B5 E5 C6 E5 | F#5 D#5 B5 D#5 F#5 D#5 B5 D#5 F#5 D#5 A5 D#5 B5 A5 F#5 D#5",
      },
      B: {
        bass: "E1 E1 E2 E1 E1 E2 E1 E1 E2 E1 E1 E2 E1 E2 E1 E2 | C2 C2 C3 C2 C2 C3 C2 C2 C3 C2 C2 C3 C2 C3 C2 C3 | A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A2 A1 A2 | B1 B1 B2 B1 B1 B2 B1 B1 B2 B1 B1 B2 D#2 F#2 A2 B2",
        drums: "k . h . h . h k s . h . h . h . | k . h . h . h k s . h . h . h . | k . h . h . h k s . h . h . h . | k . h . h . h k s . s s s s s s",
        seq: "G5 E5 B5 E5 G5 E5 B5 E5 G5 E5 B5 E5 A5 E5 B5 E5 | G5 E5 C6 E5 G5 E5 C6 E5 G5 E5 C6 E5 D6 E5 C6 E5 | A5 E5 C6 E5 A5 E5 C6 E5 A5 E5 C6 E5 B5 E5 C6 E5 | F#5 D#5 B5 D#5 F#5 D#5 B5 D#5 F#5 D#5 A5 D#5 B5 A5 F#5 D#5",
        brass: "E4^037 - - - - - - - - - - - E4^037 - - - | C4^047 - - - - - - - - - - - C4^047 - - - | A3^037 - - - - - - - - - - - A3^037 - - - | B3^047 - - - - - - - B3^047a - - - B3^047a - - -",
        lead: "B4 - - - E5 - - - G5 - - - - - F#5 - | E5 - - - - - - - - - - - D5 - C5 - | A4 - - - C5 - - - E5 - - - A5 - - - | F#5 - - - - - - - D#5 - - - B4 - - -",
      },
      C: {
        bass: "C2 C2 C3 C2 C2 C3 C2 C2 C3 C2 C2 C3 C2 C3 C2 C3 | D2 D2 D3 D2 D2 D3 D2 D2 D3 D2 D2 D3 D2 D3 D2 D3 | E1 E1 E2 E1 E1 E2 E1 E1 E2 E1 E1 E2 E1 E2 E1 E2 | E1 E1 E2 E1 E1 E2 E1 E1 B1 B1 B2 B1 D#2 F#2 A2 B2",
        drums: "k . h k s . h . k . h k s . h k | k . h k s . h . k . h k s . h k | k . h k s . h . k . h k s . h k | k . h k s . h k s s s s ks s ks s",
        seq: "E5 C5 G5 C5 E5 C5 G5 C5 E5 C5 G5 C5 A5 C5 G5 C5 | F#5 D5 A5 D5 F#5 D5 A5 D5 F#5 D5 A5 D5 B5 D5 A5 D5 | G5 E5 B5 E5 G5 E5 B5 E5 G5 E5 B5 E5 C6 E5 B5 E5 | G5 E5 B5 E5 G5 E5 B5 E5 F#5 D#5 B5 D#5 A5 F#5 D#5 B4",
        brass: "C4^047 - - - - - - - - - - - - - - - | D4^047 - - - - - - - - - - - - - - - | E4^037 - - - - - - - - - - - - - - - | E4^037 - - - - - - - B3^047 - - - - - - -",
        lead: "G5 - - - - - - - E6 - - - - - D6 - | A5 - - - - - - - F#6 - - - - - E6 - | E6 - - - - - - - B5 - - - G5 - - - | F#5 - - - - - - - D#6 - - - B5 - - -",
      },
      D: {
        bass: "E1 - - - - - - - E2 - - - - - - - | F1 - - - - - - - F2 - - - - - - - | E1 - - - - - - - E2 - - - - - - - | B1 - - - B2 - - - B1 - B1 - B2 B2 B2 B2",
        drums: "k . . . . . . k s . . . . . . . | k . . . . . . k s . . . . . . . | k . . . . . . k s . . . . . . . | k . . . . . . k s . s . s s s s",
        seq: "G5 E5 B5 E5 G5 E5 B5 E5 G5 E5 B5 E5 A5 E5 B5 E5 | A5 F5 C6 F5 A5 F5 C6 F5 A5 F5 C6 F5 D6 F5 C6 F5 | G5 E5 B5 E5 G5 E5 B5 E5 G5 E5 B5 E5 A5 E5 B5 E5 | F#5 D#5 B5 D#5 F#5 D#5 B5 D#5 F#5 D#5 A5 D#5 B5 A5 F#5 D#5",
        brass: "E4^037 - - - - - - - - - - - - - - - | F4^047 - - - - - - - - - - - - - - - | E4^037 - - - - - - - - - - - - - - - | B3^047 - - - - - - - - - - - - - - -",
        lead: "B5 - - - - - - - - - - - - - - - | C6 - - - - - - - - - - - B5 - - - | B5 - - - - - - - G5 - - - E5 - - - | D#5 - - - - - - - F#5 - - - B5 - - -",
      },
    },
    order: ["A", "B", "C", "D", "C"],
  },
  // Throne of the grid: G minor at 116, stately and grim: a three-against-four bass, a marching
  // brass figure that hits twice and pauses, and a lead that climbs G, B-flat, then falls; the
  // chorus moves to C minor and E-flat and hangs on D7, and a half-time bridge rises a step a bar
  // from A-flat to D.
  trailsThrone: {
    bpm: 116,
    rush: 12,
    voices: {
      bass: { wave: "sawtooth", gain: 0.42, decay: 0.05, sustain: 0.3 },
      drums: { kit: true, gain: 0.8, from: 0.1 },
      seq: { wave: "pulse", duty: 0.125, gain: 0.2, decay: 0.03, sustain: 0.25, from: 0.2 },
      brass: { wave: "sawtooth", gain: 0.13, decay: 0.1, sustain: 0.7, from: 0.35 },
      lead: { wave: "pulse", duty: 0.25, gain: 0.34, decay: 0.12, sustain: 0.8, vibrato: { rate: 5.5, depth: 0.01, delay: 0.2 }, from: 0.5 },
    },
    patterns: {
      A: {
        bass: "G1 G1 G2 G1 G1 G2 G1 G1 G2 G1 G1 G2 G1 G2 G1 G2 | Eb2 Eb2 Eb3 Eb2 Eb2 Eb3 Eb2 Eb2 Eb3 Eb2 Eb2 Eb3 Eb2 Eb3 Eb2 Eb3 | C2 C2 C3 C2 C2 C3 C2 C2 C3 C2 C2 C3 C2 C3 C2 C3 | D2 D2 D3 D2 D2 D3 D2 D2 D3 D2 D2 D3 F#2 A2 C3 D3",
        drums: "k . h . s . h . k . h . s . h . | k . h . s . h . k . h . s . h k | k . h . s . h . k . h . s . h . | k . h . s . h k k . s . s s s s",
        seq: "Bb4 G4 D5 G4 Bb4 G4 D5 G4 Bb4 G4 D5 G4 C5 G4 D5 G4 | Bb4 G4 Eb5 G4 Bb4 G4 Eb5 G4 Bb4 G4 Eb5 G4 F5 G4 Eb5 G4 | C5 G4 Eb5 G4 C5 G4 Eb5 G4 C5 G4 Eb5 G4 F5 G4 Eb5 G4 | A4 F#4 D5 F#4 A4 F#4 D5 F#4 A4 F#4 C5 F#4 D5 C5 A4 F#4",
      },
      B: {
        bass: "G1 G1 G2 G1 G1 G2 G1 G1 G2 G1 G1 G2 G1 G2 G1 G2 | Eb2 Eb2 Eb3 Eb2 Eb2 Eb3 Eb2 Eb2 Eb3 Eb2 Eb2 Eb3 Eb2 Eb3 Eb2 Eb3 | C2 C2 C3 C2 C2 C3 C2 C2 C3 C2 C2 C3 C2 C3 C2 C3 | D2 D2 D3 D2 D2 D3 D2 D2 D3 D2 D2 D3 F#2 A2 C3 D3",
        drums: "kh h h h sh h h h kh h kh h sh h h h | kh h h h sh h h h kh h kh h sh h h h | kh h h h sh h h h kh h kh h sh h h h | kh h h h sh h h h s . s s s s s s",
        seq: "Bb4 G4 D5 G4 Bb4 G4 D5 G4 Bb4 G4 D5 G4 C5 G4 D5 G4 | Bb4 G4 Eb5 G4 Bb4 G4 Eb5 G4 Bb4 G4 Eb5 G4 F5 G4 Eb5 G4 | C5 G4 Eb5 G4 C5 G4 Eb5 G4 C5 G4 Eb5 G4 F5 G4 Eb5 G4 | A4 F#4 D5 F#4 A4 F#4 D5 F#4 A4 F#4 C5 F#4 D5 C5 A4 F#4",
        brass: "G3^037 - . G3^037 G3^037 - . . G3^037 - . G3^037 G3^037 - . . | Eb3^047 - . Eb3^047 Eb3^047 - . . Eb3^047 - . Eb3^047 Eb3^047 - . . | C4^037 - . C4^037 C4^037 - . . C4^037 - . C4^037 C4^037 - . . | D4^047 - . D4^047 D4^047 - . . D4^047 - . D4^047 D4^047 - . .",
        lead: "D5 - - - G5 - - - Bb5 - - - - - A5 - | G5 - - - - - - - Eb5 - - - F5 - G5 - | Eb5 - - - - - - - G5 - - - C6 - - - | A5 - - - - - - - F#5 - - - D5 - - -",
      },
      C: {
        bass: "C2 C2 C3 C2 C2 C3 C2 C2 C3 C2 C2 C3 C2 C3 C2 C3 | Eb2 Eb2 Eb3 Eb2 Eb2 Eb3 Eb2 Eb2 Eb3 Eb2 Eb2 Eb3 Eb2 Eb3 Eb2 Eb3 | D2 D2 D3 D2 D2 D3 D2 D2 D3 D2 D2 D3 D2 D3 D2 D3 | D2 D2 D3 D2 D2 D3 D2 D2 D3 D2 D2 D3 F#2 A2 C3 D3",
        drums: "k . h k s . h k k . h k s . h k | k . h k s . h k k . h k s . h k | k . h k s . h k k . h k s . h k | k . h k s . h k s s s s ks s ks s",
        seq: "Eb5 C5 G5 C5 Eb5 C5 G5 C5 Eb5 C5 G5 C5 Ab5 C5 G5 C5 | G5 Eb5 Bb5 Eb5 G5 Eb5 Bb5 Eb5 G5 Eb5 Bb5 Eb5 C6 Eb5 Bb5 Eb5 | F#5 D5 A5 D5 F#5 D5 A5 D5 F#5 D5 A5 D5 Bb5 D5 A5 D5 | F#5 D5 A5 D5 F#5 D5 C6 D5 F#5 D5 A5 D5 C6 A5 F#5 D5",
        brass: "C4^037 - - - - - - - - - - - - - - - | Eb4^047 - - - - - - - - - - - - - - - | D4^047 - - - - - - - - - - - - - - - | D4^047a - - - - - - - - - - - - - - -",
        lead: "G5 - - - - - - - C6 - - - Eb6 - - - | Bb5 - - - - - - - Eb6 - - - D6 - C6 - | A5 - - - - - - - D6 - - - F#6 - - - | D6 - - - - - - - - - - - . . . .",
      },
      D: {
        bass: "Ab1 - - - - - - - Ab2 - - - - - - - | Bb1 - - - - - - - Bb2 - - - - - - - | C2 - - - - - - - C3 - - - - - - - | D2 - - - D3 - - - D2 - D2 - D3 D3 D3 D3",
        drums: "k . . . . . . . s . . . . . . . | k . . . . . . . s . . . . . . . | k . . . . . . . s . . . . . . . | k . . . s . . . s . s . s s s s",
        seq: "C5 Ab4 Eb5 Ab4 C5 Ab4 Eb5 Ab4 C5 Ab4 Eb5 Ab4 F5 Ab4 Eb5 Ab4 | D5 Bb4 F5 Bb4 D5 Bb4 F5 Bb4 D5 Bb4 F5 Bb4 G5 Bb4 F5 Bb4 | Eb5 C5 G5 C5 Eb5 C5 G5 C5 Eb5 C5 G5 C5 Ab5 C5 G5 C5 | F#5 D5 A5 D5 F#5 D5 A5 D5 F#5 D5 A5 D5 C6 A5 F#5 D5",
        brass: "Ab3^047 - - - - - - - - - - - - - - - | Bb3^047 - - - - - - - - - - - - - - - | C4^037 - - - - - - - - - - - - - - - | D4^047 - - - - - - - - - - - - - - -",
        lead: "Eb5 - - - - - - - C5 - - - Ab5 - - - | F5 - - - - - - - D5 - - - Bb5 - - - | G5 - - - - - - - Eb5 - - - C6 - - - | A5 - - - - - - - D6 - - - F#6 - - -",
      },
    },
    order: ["A", "B", "C", "B", "D", "C"],
  },
  // Siege: B minor at 104: a heavy eighth-note ostinato with a sixteenth pickup in the middle of
  // each bar, double-hit snares and slow brass swells, and a lead that drops a fourth and climbs
  // back; the chorus lifts through G, A and B minor to a high F#, and the last section turns on a
  // Neapolitan C major.
  trailsSiege: {
    bpm: 104,
    rush: 16,
    voices: {
      bass: { wave: "sawtooth", gain: 0.44, decay: 0.06, sustain: 0.4 },
      drums: { kit: true, gain: 0.82, from: 0.1 },
      seq: { wave: "pulse", duty: 0.125, gain: 0.18, decay: 0.03, sustain: 0.25, from: 0.2 },
      brass: { wave: "sawtooth", gain: 0.14, decay: 0.2, sustain: 0.8, from: 0.35 },
      lead: { wave: "pulse", duty: 0.25, gain: 0.34, decay: 0.12, sustain: 0.8, vibrato: { rate: 5, depth: 0.012, delay: 0.2 }, from: 0.5 },
    },
    patterns: {
      A: {
        bass: "B1 - B1 - B2 - B1 B1 B1 - B1 - A1 - F#1 - | G1 - G1 - G2 - G1 G1 G1 - G1 - F#1 - E1 - | E1 - E1 - E2 - E1 E1 E1 - E1 - G1 - A1 - | F#1 - F#1 - F#2 - F#1 F#1 F#1 - F#1 - A#1 - C#2 -",
        drums: "k . . . . . . . s . . s . . . . | k . . . . . . . s . . s . . . . | k . . . . . . . s . . s . . . . | k . . . . . . . s . s . s s s s",
        seq: "D5 B4 F#5 B4 D5 B4 F#5 B4 D5 B4 F#5 B4 G5 B4 F#5 B4 | D5 B4 G5 B4 D5 B4 G5 B4 D5 B4 G5 B4 A5 B4 G5 B4 | E5 B4 G5 B4 E5 B4 G5 B4 E5 B4 G5 B4 A5 B4 G5 B4 | C#5 A#4 F#5 A#4 C#5 A#4 F#5 A#4 C#5 A#4 E5 A#4 F#5 E5 C#5 A#4",
      },
      B: {
        bass: "B1 - B1 - B2 - B1 B1 B1 - B1 - A1 - F#1 - | G1 - G1 - G2 - G1 G1 G1 - G1 - F#1 - E1 - | E1 - E1 - E2 - E1 E1 E1 - E1 - G1 - A1 - | F#1 - F#1 - F#2 - F#1 F#1 F#1 - F#1 - A#1 - C#2 -",
        drums: "k . h . h . h . s . h s h . h k | k . h . h . h . s . h s h . h k | k . h . h . h . s . h s h . h k | k . h . h . h . s . s s s s s s",
        seq: "D5 B4 F#5 B4 D5 B4 F#5 B4 D5 B4 F#5 B4 G5 B4 F#5 B4 | D5 B4 G5 B4 D5 B4 G5 B4 D5 B4 G5 B4 A5 B4 G5 B4 | E5 B4 G5 B4 E5 B4 G5 B4 E5 B4 G5 B4 A5 B4 G5 B4 | C#5 A#4 F#5 A#4 C#5 A#4 F#5 A#4 C#5 A#4 E5 A#4 F#5 E5 C#5 A#4",
        brass: "B3^037 - - - - - - - - - - - B3^037 - - - | G3^047 - - - - - - - - - - - G3^047 - - - | E3^037 - - - - - - - - - - - E3^037 - - - | F#3^047 - - - - - - - F#3^047a - - - F#3^047a - - -",
        lead: "B5 - - - - - - - F#5 - - - - - - - | G5 - - - - - - - D5 - - - E5 - F#5 - | G5 - - - - - - - B5 - - - E6 - - - | C#6 - - - - - - - A#5 - - - F#5 - - -",
      },
      C: {
        bass: "G1 G1 G2 G1 G1 G2 G1 G1 G2 G1 G1 G2 G1 G2 G1 G2 | A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A2 A1 A2 | B1 B1 B2 B1 B1 B2 B1 B1 B2 B1 B1 B2 B1 B2 B1 B2 | F#1 F#1 F#2 F#1 F#1 F#2 F#1 F#1 F#2 F#1 F#1 F#2 A#1 C#2 E2 F#2",
        drums: "k . h k s . h . k . h k s . h k | k . h k s . h . k . h k s . h k | k . h k s . h . k . h k s . h k | k . h k s . h k s s s s ks s ks s",
        seq: "D5 B4 G5 B4 D5 B4 G5 B4 D5 B4 G5 B4 A5 B4 G5 B4 | E5 C#5 A5 C#5 E5 C#5 A5 C#5 E5 C#5 A5 C#5 B5 C#5 A5 C#5 | F#5 D5 B5 D5 F#5 D5 B5 D5 F#5 D5 B5 D5 C#6 D5 B5 D5 | F#5 C#5 A#5 C#5 F#5 C#5 A#5 C#5 F#5 C#5 A#5 C#5 E6 C#6 A#5 F#5",
        brass: "G3^047 - - - - - - - - - - - - - - - | A3^047 - - - - - - - - - - - - - - - | B3^037 - - - - - - - - - - - - - - - | F#3^047 - - - - - - - - - - - - - - -",
        lead: "D6 - - - - - - - B5 - - - G5 - - - | E6 - - - - - - - C#6 - - - A5 - - - | F#6 - - - - - - - D6 - - - B5 - - - | A#5 - - - - - - - C#6 - - - F#6 - - -",
      },
      D: {
        bass: "B1 - B1 - B2 - B1 B1 B1 - B1 - A1 - F#1 - | C2 - C2 - C3 - C2 C2 C2 - C2 - B1 - A1 - | B1 - B1 - B2 - B1 B1 B1 - B1 - A1 - F#1 - | F#1 - F#1 - F#2 - F#1 F#1 F#1 - F#1 - A#1 - C#2 -",
        drums: "k . h . h . h . s . h s h . h k | k . h . h . h . s . h s h . h k | k . h . h . h . s . h s h . h k | k . h . h . h . s . s s s s s s",
        seq: "D5 B4 F#5 B4 D5 B4 F#5 B4 D5 B4 F#5 B4 G5 B4 F#5 B4 | E5 C5 G5 C5 E5 C5 G5 C5 E5 C5 G5 C5 A5 C5 G5 C5 | D5 B4 F#5 B4 D5 B4 F#5 B4 D5 B4 F#5 B4 G5 B4 F#5 B4 | C#5 A#4 F#5 A#4 C#5 A#4 F#5 A#4 C#5 A#4 E5 A#4 F#5 E5 C#5 A#4",
        brass: "B3^037 - - - - - - - - - - - - - - - | C4^047 - - - - - - - - - - - - - - - | B3^037 - - - - - - - - - - - - - - - | F#3^047 - - - - - - - - - - - - - - -",
        lead: "B5 - - - - - - - - - - - - - - - | C6 - - - - - - - - - - - B5 - - - | D6 - - - - - - - - - - - C#6 - B5 - | A#5 - - - - - - - C#6 - - - F#6 - - -",
      },
    },
    order: ["A", "B", "C", "D", "C"],
  },
  // Iron gate: E minor at 104 behind a slow-opening gate: an eighth-note ostinato that dips to the
  // seventh and the fifth, half-time snares, a low sequence and swelling brass under a lead that
  // steps down from B; the chorus switches to the three-against-four bass over C, D and E minor,
  // and the last section leans on a Phrygian F.
  trailsIronGate: {
    bpm: 104,
    rush: 16,
    voices: {
      bass: { wave: "sawtooth", gain: 0.44, decay: 0.06, sustain: 0.4 },
      drums: { kit: true, gain: 0.82, from: 0.1 },
      seq: { wave: "pulse", duty: 0.125, gain: 0.18, decay: 0.03, sustain: 0.25, from: 0.2 },
      brass: { wave: "sawtooth", gain: 0.14, decay: 0.2, sustain: 0.8, from: 0.35 },
      lead: { wave: "pulse", duty: 0.25, gain: 0.34, decay: 0.12, sustain: 0.8, vibrato: { rate: 5, depth: 0.012, delay: 0.2 }, from: 0.5 },
    },
    patterns: {
      A: {
        bass: "E1 - E1 - E2 - E1 - D2 - E1 - B1 - E1 - | C2 - C2 - C3 - C2 - B2 - C2 - G1 - C2 - | A1 - A1 - A2 - A1 - G2 - A1 - E1 - A1 - | B1 - B1 - B2 - B1 - A2 - B1 - D#2 - F#2 -",
        drums: "k . . . . . h . s . . . . . h . | k . . . . . h . s . . . . . h k | k . . . . . h . s . . . . . h . | k . . . . . h . s . s . s s s s",
        seq: "G4 E4 B4 E4 G4 E4 B4 E4 G4 E4 B4 E4 C5 E4 B4 E4 | G4 E4 C5 E4 G4 E4 C5 E4 G4 E4 C5 E4 D5 E4 C5 E4 | A4 E4 C5 E4 A4 E4 C5 E4 A4 E4 C5 E4 D5 E4 C5 E4 | F#4 D#4 B4 D#4 F#4 D#4 B4 D#4 F#4 D#4 A4 D#4 B4 A4 F#4 D#4",
      },
      B: {
        bass: "E1 - E1 - E2 - E1 - D2 - E1 - B1 - E1 - | C2 - C2 - C3 - C2 - B2 - C2 - G1 - C2 - | A1 - A1 - A2 - A1 - G2 - A1 - E1 - A1 - | B1 - B1 - B2 - B1 - A2 - B1 - D#2 - F#2 -",
        drums: "k . h . h . h . s . h . h . h k | k . h . h . h . s . h . h . h k | k . h . h . h . s . h . h . h k | k . h . h . h . s . s s s s s s",
        seq: "G4 E4 B4 E4 G4 E4 B4 E4 G4 E4 B4 E4 C5 E4 B4 E4 | G4 E4 C5 E4 G4 E4 C5 E4 G4 E4 C5 E4 D5 E4 C5 E4 | A4 E4 C5 E4 A4 E4 C5 E4 A4 E4 C5 E4 D5 E4 C5 E4 | F#4 D#4 B4 D#4 F#4 D#4 B4 D#4 F#4 D#4 A4 D#4 B4 A4 F#4 D#4",
        brass: "E4^037 - - - - - - - - - - - E4^037 - - - | C4^047 - - - - - - - - - - - C4^047 - - - | A3^037 - - - - - - - - - - - A3^037 - - - | B3^047 - - - - - - - B3^047a - - - B3^047a - - -",
        lead: "B5 - - - - - - - G5 - - - F#5 - E5 - | E5 - - - - - - - - - - - D5 - C5 - | C5 - - - - - - - E5 - - - A5 - - - | F#5 - - - - - - - D#5 - - - B4 - - -",
      },
      C: {
        bass: "C2 C2 C3 C2 C2 C3 C2 C2 C3 C2 C2 C3 C2 C3 C2 C3 | D2 D2 D3 D2 D2 D3 D2 D2 D3 D2 D2 D3 D2 D3 D2 D3 | E1 E1 E2 E1 E1 E2 E1 E1 E2 E1 E1 E2 E1 E2 E1 E2 | B1 B1 B2 B1 B1 B2 B1 B1 B2 B1 B1 B2 D#2 F#2 A2 B2",
        drums: "k . h k s . h . k . h k s . h k | k . h k s . h . k . h k s . h k | k . h k s . h . k . h k s . h k | k . h k s . h k s s s s ks s ks s",
        seq: "E5 C5 G5 C5 E5 C5 G5 C5 E5 C5 G5 C5 A5 C5 G5 C5 | F#5 D5 A5 D5 F#5 D5 A5 D5 F#5 D5 A5 D5 B5 D5 A5 D5 | G5 E5 B5 E5 G5 E5 B5 E5 G5 E5 B5 E5 C6 E5 B5 E5 | F#5 D#5 B5 D#5 F#5 D#5 B5 D#5 F#5 D#5 A5 D#5 B5 A5 F#5 D#5",
        brass: "C4^047 - - - - - - - - - - - - - - - | D4^047 - - - - - - - - - - - - - - - | E4^037 - - - - - - - - - - - - - - - | B3^047 - - - - - - - - - - - - - - -",
        lead: "E6 - - - - - - - C6 - - - G5 - - - | F#6 - - - - - - - D6 - - - A5 - - - | E6 - - - - - - - B5 - - - G5 - B5 - | D#6 - - - - - - - F#6 - - - - - - -",
      },
      D: {
        bass: "E1 - E1 - E2 - E1 - D2 - E1 - B1 - E1 - | F1 - F1 - F2 - F1 - Eb2 - F1 - C2 - F1 - | E1 - E1 - E2 - E1 - D2 - E1 - B1 - E1 - | B1 - B1 - B2 - B1 - A2 - B1 - D#2 - F#2 -",
        drums: "k . h . h . h . s . h . h . h k | k . h . h . h . s . h . h . h k | k . h . h . h . s . h . h . h k | k . h . h . h . s . s s s s s s",
        seq: "G4 E4 B4 E4 G4 E4 B4 E4 G4 E4 B4 E4 C5 E4 B4 E4 | A4 F4 C5 F4 A4 F4 C5 F4 A4 F4 C5 F4 D5 F4 C5 F4 | G4 E4 B4 E4 G4 E4 B4 E4 G4 E4 B4 E4 C5 E4 B4 E4 | F#4 D#4 B4 D#4 F#4 D#4 B4 D#4 F#4 D#4 A4 D#4 B4 A4 F#4 D#4",
        brass: "E4^037 - - - - - - - - - - - - - - - | F4^047 - - - - - - - - - - - - - - - | E4^037 - - - - - - - - - - - - - - - | B3^047 - - - - - - - - - - - - - - -",
        lead: "E5 - - - - - - - - - - - - - - - | F5 - - - - - - - - - - - E5 - - - | G5 - - - - - - - - - - - F#5 - E5 - | D#5 - - - - - - - F#5 - - - B5 - - -",
      },
    },
    order: ["A", "B", "C", "D", "C"],
  },
  // Sky citadel: A minor at 100, vast and slow: a deep three-against-four bass, half-time drums and
  // a sequence that rocks against a high note over each chord, under a lead that calls up E, A, C;
  // the chorus climbs F and G to high leaps, and the break hangs on D minor and E7.
  trailsSkyCitadel: {
    bpm: 100,
    rush: 16,
    voices: {
      bass: { wave: "sawtooth", gain: 0.44, decay: 0.06, sustain: 0.4 },
      drums: { kit: true, gain: 0.82, from: 0.1 },
      seq: { wave: "pulse", duty: 0.125, gain: 0.18, decay: 0.03, sustain: 0.25, from: 0.2 },
      brass: { wave: "sawtooth", gain: 0.14, decay: 0.2, sustain: 0.8, from: 0.35 },
      lead: { wave: "pulse", duty: 0.25, gain: 0.34, decay: 0.12, sustain: 0.8, vibrato: { rate: 5, depth: 0.012, delay: 0.2 }, from: 0.5 },
    },
    patterns: {
      A: {
        bass: "A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A2 A1 A2 | F1 F1 F2 F1 F1 F2 F1 F1 F2 F1 F1 F2 F1 F2 F1 F2 | G1 G1 G2 G1 G1 G2 G1 G1 G2 G1 G1 G2 G1 G2 G1 G2 | E1 E1 E2 E1 E1 E2 E1 E1 E2 E1 E1 E2 G#1 B1 D2 E2",
        drums: "k . . . . . . k s . . . . . . . | k . . . . . . k s . . . . . . . | k . . . . . . k s . . . . . . . | k . . . . . . k s . s . s s s s",
        seq: "A4 E5 C5 E5 A4 E5 C5 E5 A4 E5 C5 E5 B4 E5 C5 E5 | A4 C5 F4 C5 A4 C5 F4 C5 A4 C5 F4 C5 G4 C5 A4 C5 | B4 D5 G4 D5 B4 D5 G4 D5 B4 D5 G4 D5 A4 D5 B4 D5 | G#4 B4 E4 B4 G#4 B4 E4 B4 G#4 B4 D5 B4 E5 D5 B4 G#4",
      },
      B: {
        bass: "A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A2 A1 A2 | F1 F1 F2 F1 F1 F2 F1 F1 F2 F1 F1 F2 F1 F2 F1 F2 | G1 G1 G2 G1 G1 G2 G1 G1 G2 G1 G1 G2 G1 G2 G1 G2 | E1 E1 E2 E1 E1 E2 E1 E1 E2 E1 E1 E2 G#1 B1 D2 E2",
        drums: "k . h . h . h k s . h . h . h . | k . h . h . h k s . h . h . h . | k . h . h . h k s . h . h . h . | k . h . h . h k s . s s s s s s",
        seq: "A4 E5 C5 E5 A4 E5 C5 E5 A4 E5 C5 E5 B4 E5 C5 E5 | A4 C5 F4 C5 A4 C5 F4 C5 A4 C5 F4 C5 G4 C5 A4 C5 | B4 D5 G4 D5 B4 D5 G4 D5 B4 D5 G4 D5 A4 D5 B4 D5 | G#4 B4 E4 B4 G#4 B4 E4 B4 G#4 B4 D5 B4 E5 D5 B4 G#4",
        brass: "A3^037 - - - - - - - - - - - A3^037 - - - | F3^047 - - - - - - - - - - - F3^047 - - - | G3^047 - - - - - - - - - - - G3^047 - - - | E3^047 - - - - - - - E3^047a - - - E3^047a - - -",
        lead: "E5 - - - A5 - - - C6 - - - - - B5 - | A5 - - - - - - - - - - - G5 - F5 - | D5 - - - G5 - - - B5 - - - D6 - - - | B5 - - - - - - - G#5 - - - E5 - - -",
      },
      C: {
        bass: "F1 F1 F2 F1 F1 F2 F1 F1 F2 F1 F1 F2 F1 F2 F1 F2 | G1 G1 G2 G1 G1 G2 G1 G1 G2 G1 G1 G2 G1 G2 G1 G2 | A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A2 A1 A2 | E1 E1 E2 E1 E1 E2 E1 E1 E2 E1 E1 E2 G#1 B1 D2 E2",
        drums: "k . h k s . h . k . h k s . h k | k . h k s . h . k . h k s . h k | k . h k s . h . k . h k s . h k | k . h k s . h k s s s s ks s ks s",
        seq: "C5 A4 F5 A4 C5 A4 F5 A4 C5 A4 F5 A4 G5 A4 F5 A4 | D5 B4 G5 B4 D5 B4 G5 B4 D5 B4 G5 B4 A5 B4 G5 B4 | E5 C5 A5 C5 E5 C5 A5 C5 E5 C5 A5 C5 B5 C5 A5 C5 | E5 B4 G#5 B4 E5 B4 G#5 B4 E5 B4 G#5 B4 B5 G#5 E5 B4",
        brass: "F3^047 - - - - - - - - - - - - - - - | G3^047 - - - - - - - - - - - - - - - | A3^037 - - - - - - - - - - - - - - - | E3^047a - - - - - - - - - - - - - - -",
        lead: "C6 - - - - - - - F6 - - - - - E6 - | D6 - - - - - - - G6 - - - - - F6 - | E6 - - - - - - - C6 - - - A5 - - - | B5 - - - - - - - G#5 - - - E6 - - -",
      },
      D: {
        bass: "D2 - - - - - - - D3 - - - - - - - | D2 - - - - - - - C3 - - - - - - - | E1 - - - - - - - E2 - - - - - - - | E1 - - - E2 - - - E1 - E1 - E2 E2 E2 E2",
        drums: "k . . . . . . k s . . . . . . . | k . . . . . . k s . . . . . . . | k . . . . . . k s . . . . . . . | k . . . . . . k s . s . s s s s",
        seq: "F5 D5 A5 D5 F5 D5 A5 D5 F5 D5 A5 D5 G5 D5 A5 D5 | F5 D5 A5 D5 F5 D5 A5 D5 F5 D5 Bb5 D5 A5 D5 G5 D5 | E5 B4 G#5 B4 E5 B4 G#5 B4 E5 B4 G#5 B4 A5 B4 G#5 B4 | E5 B4 G#5 B4 E5 B4 D6 B4 E5 B4 G#5 B4 D6 B5 G#5 E5",
        brass: "D4^037 - - - - - - - - - - - - - - - | D4^037 - - - - - - - - - - - - - - - | E4^047 - - - - - - - - - - - - - - - | E4^047a - - - - - - - - - - - - - - -",
        lead: "A5 - - - - - - - - - - - - - - - | F5 - - - - - - - - - - - E5 - D5 - | E5 - - - - - - - - - - - - - - - | G#5 - - - - - - - B5 - - - D6 - - -",
      },
    },
    order: ["A", "B", "C", "D", "C"],
  },
  // Deep core: G minor at 104, deep under the grid: an eighth-note ostinato that dips to the
  // seventh and the fifth, half-time snares, a low sequence and swelling brass under a lead that
  // falls from D; the chorus switches to the three-against-four bass over E-flat, F and G minor,
  // and the last section turns on a Neapolitan A-flat.
  trailsDeepCore: {
    bpm: 104,
    rush: 16,
    voices: {
      bass: { wave: "sawtooth", gain: 0.44, decay: 0.06, sustain: 0.4 },
      drums: { kit: true, gain: 0.82, from: 0.1 },
      seq: { wave: "pulse", duty: 0.125, gain: 0.18, decay: 0.03, sustain: 0.25, from: 0.2 },
      brass: { wave: "sawtooth", gain: 0.14, decay: 0.2, sustain: 0.8, from: 0.35 },
      lead: { wave: "pulse", duty: 0.25, gain: 0.34, decay: 0.12, sustain: 0.8, vibrato: { rate: 5, depth: 0.012, delay: 0.2 }, from: 0.5 },
    },
    patterns: {
      A: {
        bass: "G1 - G1 - G2 - G1 - F2 - G1 - D2 - G1 - | Eb2 - Eb2 - Eb3 - Eb2 - D3 - Eb2 - Bb1 - Eb2 - | C2 - C2 - C3 - C2 - Bb2 - C2 - G1 - C2 - | D2 - D2 - D3 - D2 - C3 - D2 - F#2 - A2 -",
        drums: "k . . . . . h . s . . . . . h . | k . . . . . h . s . . . . . h k | k . . . . . h . s . . . . . h . | k . . . . . h . s . s . s s s s",
        seq: "Bb4 G4 D5 G4 Bb4 G4 D5 G4 Bb4 G4 D5 G4 Eb5 G4 D5 G4 | Bb4 G4 Eb5 G4 Bb4 G4 Eb5 G4 Bb4 G4 Eb5 G4 F5 G4 Eb5 G4 | C5 G4 Eb5 G4 C5 G4 Eb5 G4 C5 G4 Eb5 G4 F5 G4 Eb5 G4 | A4 F#4 D5 F#4 A4 F#4 D5 F#4 A4 F#4 C5 F#4 D5 C5 A4 F#4",
      },
      B: {
        bass: "G1 - G1 - G2 - G1 - F2 - G1 - D2 - G1 - | Eb2 - Eb2 - Eb3 - Eb2 - D3 - Eb2 - Bb1 - Eb2 - | C2 - C2 - C3 - C2 - Bb2 - C2 - G1 - C2 - | D2 - D2 - D3 - D2 - C3 - D2 - F#2 - A2 -",
        drums: "k . h . h . h . s . h . h . h k | k . h . h . h . s . h . h . h k | k . h . h . h . s . h . h . h k | k . h . h . h . s . s s s s s s",
        seq: "Bb4 G4 D5 G4 Bb4 G4 D5 G4 Bb4 G4 D5 G4 Eb5 G4 D5 G4 | Bb4 G4 Eb5 G4 Bb4 G4 Eb5 G4 Bb4 G4 Eb5 G4 F5 G4 Eb5 G4 | C5 G4 Eb5 G4 C5 G4 Eb5 G4 C5 G4 Eb5 G4 F5 G4 Eb5 G4 | A4 F#4 D5 F#4 A4 F#4 D5 F#4 A4 F#4 C5 F#4 D5 C5 A4 F#4",
        brass: "G3^037 - - - - - - - - - - - G3^037 - - - | Eb4^047 - - - - - - - - - - - Eb4^047 - - - | C4^037 - - - - - - - - - - - C4^037 - - - | D4^047 - - - - - - - D4^047a - - - D4^047a - - -",
        lead: "D6 - - - - - - - Bb5 - - - A5 - G5 - | G5 - - - - - - - - - - - F5 - Eb5 - | Eb5 - - - - - - - G5 - - - C6 - - - | A5 - - - - - - - F#5 - - - D5 - - -",
      },
      C: {
        bass: "Eb2 Eb2 Eb3 Eb2 Eb2 Eb3 Eb2 Eb2 Eb3 Eb2 Eb2 Eb3 Eb2 Eb3 Eb2 Eb3 | F1 F1 F2 F1 F1 F2 F1 F1 F2 F1 F1 F2 F1 F2 F1 F2 | G1 G1 G2 G1 G1 G2 G1 G1 G2 G1 G1 G2 G1 G2 G1 G2 | D2 D2 D3 D2 D2 D3 D2 D2 D3 D2 D2 D3 F#2 A2 C3 D3",
        drums: "k . h k s . h . k . h k s . h k | k . h k s . h . k . h k s . h k | k . h k s . h . k . h k s . h k | k . h k s . h k s s s s ks s ks s",
        seq: "G5 Eb5 Bb5 Eb5 G5 Eb5 Bb5 Eb5 G5 Eb5 Bb5 Eb5 C6 Eb5 Bb5 Eb5 | A5 F5 C6 F5 A5 F5 C6 F5 A5 F5 C6 F5 D6 F5 C6 F5 | Bb5 G5 D6 G5 Bb5 G5 D6 G5 Bb5 G5 D6 G5 Eb6 G5 D6 G5 | A5 F#5 D6 F#5 A5 F#5 D6 F#5 A5 F#5 C6 F#5 D6 C6 A5 F#5",
        brass: "Eb4^047 - - - - - - - - - - - - - - - | F3^047 - - - - - - - - - - - - - - - | G3^037 - - - - - - - - - - - - - - - | D4^047 - - - - - - - - - - - - - - -",
        lead: "Bb5 - - - - - - - G5 - - - Eb6 - - - | C6 - - - - - - - A5 - - - F6 - - - | D6 - - - - - - - Bb5 - - - G6 - F6 - | F#6 - - - - - - - D6 - - - A5 - - -",
      },
      D: {
        bass: "G1 - G1 - G2 - G1 - F2 - G1 - D2 - G1 - | Ab1 - Ab1 - Ab2 - Ab1 - G2 - Ab1 - Eb2 - Ab1 - | G1 - G1 - G2 - G1 - F2 - G1 - D2 - G1 - | D2 - D2 - D3 - D2 - C3 - D2 - F#2 - A2 -",
        drums: "k . h . h . h . s . h . h . h k | k . h . h . h . s . h . h . h k | k . h . h . h . s . h . h . h k | k . h . h . h . s . s s s s s s",
        seq: "Bb4 G4 D5 G4 Bb4 G4 D5 G4 Bb4 G4 D5 G4 Eb5 G4 D5 G4 | C5 Ab4 Eb5 Ab4 C5 Ab4 Eb5 Ab4 C5 Ab4 Eb5 Ab4 F5 Ab4 Eb5 Ab4 | Bb4 G4 D5 G4 Bb4 G4 D5 G4 Bb4 G4 D5 G4 Eb5 G4 D5 G4 | A4 F#4 D5 F#4 A4 F#4 D5 F#4 A4 F#4 C5 F#4 D5 C5 A4 F#4",
        brass: "G3^037 - - - - - - - - - - - - - - - | Ab3^047 - - - - - - - - - - - - - - - | G3^037 - - - - - - - - - - - - - - - | D4^047 - - - - - - - - - - - - - - -",
        lead: "G5 - - - - - - - - - - - - - - - | Ab5 - - - - - - - - - - - G5 - - - | Bb5 - - - - - - - - - - - A5 - G5 - | F#5 - - - - - - - A5 - - - D6 - - -",
      },
    },
    order: ["A", "B", "C", "D", "C"],
  },
  // Monolith: D minor at 98, a black slab on the horizon: a deep three-against-four bass under
  // half-time drums, a sequence that rocks against a high note over D minor, B-flat, C and A, and a
  // lead that calls up A, D, F; the chorus climbs G minor, A, B-flat in long high notes, and the
  // break hangs on G minor and A7.
  trailsMonolith: {
    bpm: 98,
    rush: 16,
    voices: {
      bass: { wave: "sawtooth", gain: 0.44, decay: 0.06, sustain: 0.4 },
      drums: { kit: true, gain: 0.82, from: 0.1 },
      seq: { wave: "pulse", duty: 0.125, gain: 0.18, decay: 0.03, sustain: 0.25, from: 0.2 },
      brass: { wave: "sawtooth", gain: 0.14, decay: 0.2, sustain: 0.8, from: 0.35 },
      lead: { wave: "pulse", duty: 0.25, gain: 0.34, decay: 0.12, sustain: 0.8, vibrato: { rate: 5, depth: 0.012, delay: 0.2 }, from: 0.5 },
    },
    patterns: {
      A: {
        bass: "D2 D2 D3 D2 D2 D3 D2 D2 D3 D2 D2 D3 D2 D3 D2 D3 | Bb1 Bb1 Bb2 Bb1 Bb1 Bb2 Bb1 Bb1 Bb2 Bb1 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 | C2 C2 C3 C2 C2 C3 C2 C2 C3 C2 C2 C3 C2 C3 C2 C3 | A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A1 A2 C#2 E2 G2 A2",
        drums: "k . . . . . . k s . . . . . . . | k . . . . . . k s . . . . . . . | k . . . . . . k s . . . . . . . | k . . . . . . k s . s . s s s s",
        seq: "D5 A5 F5 A5 D5 A5 F5 A5 D5 A5 F5 A5 E5 A5 F5 A5 | D5 F5 Bb4 F5 D5 F5 Bb4 F5 D5 F5 Bb4 F5 C5 F5 D5 F5 | E5 G5 C5 G5 E5 G5 C5 G5 E5 G5 C5 G5 D5 G5 E5 G5 | C#5 E5 A4 E5 C#5 E5 A4 E5 C#5 E5 G5 E5 A5 G5 E5 C#5",
      },
      B: {
        bass: "D2 D2 D3 D2 D2 D3 D2 D2 D3 D2 D2 D3 D2 D3 D2 D3 | Bb1 Bb1 Bb2 Bb1 Bb1 Bb2 Bb1 Bb1 Bb2 Bb1 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 | C2 C2 C3 C2 C2 C3 C2 C2 C3 C2 C2 C3 C2 C3 C2 C3 | A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A1 A2 C#2 E2 G2 A2",
        drums: "k . h . h . h k s . h . h . h . | k . h . h . h k s . h . h . h . | k . h . h . h k s . h . h . h . | k . h . h . h k s . s s s s s s",
        seq: "D5 A5 F5 A5 D5 A5 F5 A5 D5 A5 F5 A5 E5 A5 F5 A5 | D5 F5 Bb4 F5 D5 F5 Bb4 F5 D5 F5 Bb4 F5 C5 F5 D5 F5 | E5 G5 C5 G5 E5 G5 C5 G5 E5 G5 C5 G5 D5 G5 E5 G5 | C#5 E5 A4 E5 C#5 E5 A4 E5 C#5 E5 G5 E5 A5 G5 E5 C#5",
        brass: "D4^037 - - - - - - - - - - - D4^037 - - - | Bb3^047 - - - - - - - - - - - Bb3^047 - - - | C4^047 - - - - - - - - - - - C4^047 - - - | A3^047 - - - - - - - A3^047a - - - A3^047a - - -",
        lead: "A4 - - - D5 - - - F5 - - - - - E5 - | D5 - - - - - - - - - - - C5 - Bb4 - | G4 - - - C5 - - - E5 - - - G5 - - - | E5 - - - - - - - C#5 - - - A4 - - -",
      },
      C: {
        bass: "G1 G1 G2 G1 G1 G2 G1 G1 G2 G1 G1 G2 G1 G2 G1 G2 | A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A2 A1 A2 | Bb1 Bb1 Bb2 Bb1 Bb1 Bb2 Bb1 Bb1 Bb2 Bb1 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 | A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A1 A2 C#2 E2 G2 A2",
        drums: "k . h k s . h . k . h k s . h k | k . h k s . h . k . h k s . h k | k . h k s . h . k . h k s . h k | k . h k s . h k s s s s ks s ks s",
        seq: "D5 Bb4 G5 Bb4 D5 Bb4 G5 Bb4 D5 Bb4 G5 Bb4 A5 Bb4 G5 Bb4 | E5 C#5 A5 C#5 E5 C#5 A5 C#5 E5 C#5 A5 C#5 B5 C#5 A5 C#5 | F5 D5 Bb5 D5 F5 D5 Bb5 D5 F5 D5 Bb5 D5 C6 D5 Bb5 D5 | E5 C#5 A5 C#5 E5 C#5 G5 C#5 E5 C#5 A5 C#5 G5 E5 C#5 A4",
        brass: "G3^037 - - - - - - - - - - - - - - - | A3^047 - - - - - - - - - - - - - - - | Bb3^047 - - - - - - - - - - - - - - - | A3^047a - - - - - - - - - - - - - - -",
        lead: "Bb5 - - - - - - - D6 - - - - - C6 - | C#6 - - - - - - - E6 - - - - - D6 - | D6 - - - - - - - F6 - - - - - - - | E6 - - - - - - - C#6 - - - A5 - - -",
      },
      D: {
        bass: "G1 - - - - - - - G2 - - - - - - - | G1 - - - - - - - F2 - - - - - - - | A1 - - - - - - - A2 - - - - - - - | A1 - - - A2 - - - A1 - A1 - A2 A2 A2 A2",
        drums: "k . . . . . . k s . . . . . . . | k . . . . . . k s . . . . . . . | k . . . . . . k s . . . . . . . | k . . . . . . k s . s . s s s s",
        seq: "D5 Bb4 G5 Bb4 D5 Bb4 G5 Bb4 D5 Bb4 G5 Bb4 A5 Bb4 G5 Bb4 | D5 Bb4 G5 Bb4 D5 Bb4 G5 Bb4 D5 Bb4 G5 Bb4 F5 Bb4 G5 Bb4 | E5 C#5 A5 C#5 E5 C#5 A5 C#5 E5 C#5 A5 C#5 B5 C#5 A5 C#5 | E5 C#5 A5 C#5 E5 C#5 G5 C#5 E5 C#5 A5 C#5 G5 E5 C#5 A4",
        brass: "G3^037 - - - - - - - - - - - - - - - | G3^037 - - - - - - - - - - - - - - - | A3^047 - - - - - - - - - - - - - - - | A3^047a - - - - - - - - - - - - - - -",
        lead: "D6 - - - - - - - - - - - - - - - | Bb5 - - - - - - - - - - - A5 - G5 - | A5 - - - - - - - - - - - - - - - | C#6 - - - - - - - E6 - - - - - - -",
      },
    },
    order: ["A", "B", "C", "D", "C"],
  },
  // Netrunner: D minor at 122, jacked into the net: a pulsing sixteenth sawtooth bass with an
  // octave kick on two and four, an arp in threes that slides against the beat, gated chord stabs
  // that stutter in and out, and a sawtooth lead; the chorus lifts G minor, B-flat, C to a bright A
  // major.
  trailsNetrunner: {
    bpm: 122,
    rush: 10,
    voices: {
      bass: { wave: "sawtooth", gain: 0.42, decay: 0.05, sustain: 0.3 },
      drums: { kit: true, gain: 0.8, from: 0.1 },
      arp: { wave: "pulse", duty: 0.125, gain: 0.18, decay: 0.03, sustain: 0.25, from: 0.2 },
      stab: { wave: "pulse", duty: 0.25, gain: 0.22, decay: 0.03, sustain: 0.1, from: 0.3 },
      lead: { wave: "sawtooth", gain: 0.19, decay: 0.1, sustain: 0.8, vibrato: { rate: 5.5, depth: 0.01, delay: 0.2 }, from: 0.5 },
    },
    patterns: {
      A: {
        bass: "D2 D2 D2 D2 D3 D2 D2 D2 D2 D2 D2 D2 D3 D2 C3 D2 | Bb1 Bb1 Bb1 Bb1 Bb2 Bb1 Bb1 Bb1 Bb1 Bb1 Bb1 Bb1 Bb2 Bb1 A1 Bb1 | F1 F1 F1 F1 F2 F1 F1 F1 F1 F1 F1 F1 F2 F1 E1 F1 | C2 C2 C2 C2 C3 C2 C2 C2 C2 C2 C2 C2 C3 C2 E2 G2",
        drums: "k . h . s . h . k . h k s . h . | k . h . s . h . k . h k s . h . | k . h . s . h . k . h k s . h . | k . h . s . h k s s s s s s s s",
        arp: "D5 F5 A5 D5 F5 A5 D5 F5 A5 D5 F5 A5 D5 F5 A5 C6 | D5 F5 Bb5 D5 F5 Bb5 D5 F5 Bb5 D5 F5 Bb5 D5 F5 Bb5 C6 | C5 F5 A5 C5 F5 A5 C5 F5 A5 C5 F5 A5 C5 F5 A5 C6 | C5 E5 G5 C5 E5 G5 C5 E5 G5 C5 E5 G5 C5 E5 G5 Bb5",
      },
      B: {
        bass: "D2 D2 D2 D2 D3 D2 D2 D2 D2 D2 D2 D2 D3 D2 C3 D2 | Bb1 Bb1 Bb1 Bb1 Bb2 Bb1 Bb1 Bb1 Bb1 Bb1 Bb1 Bb1 Bb2 Bb1 A1 Bb1 | F1 F1 F1 F1 F2 F1 F1 F1 F1 F1 F1 F1 F2 F1 E1 F1 | C2 C2 C2 C2 C3 C2 C2 C2 C2 C2 C2 C2 C3 C2 E2 G2",
        drums: "kh h h h sh h h h kh h kh h sh h h h | kh h h h sh h h h kh h kh h sh h h h | kh h h h sh h h h kh h kh h sh h h h | kh h h h sh h h h s . s s s s s s",
        arp: "D5 F5 A5 D5 F5 A5 D5 F5 A5 D5 F5 A5 D5 F5 A5 C6 | D5 F5 Bb5 D5 F5 Bb5 D5 F5 Bb5 D5 F5 Bb5 D5 F5 Bb5 C6 | C5 F5 A5 C5 F5 A5 C5 F5 A5 C5 F5 A5 C5 F5 A5 C6 | C5 E5 G5 C5 E5 G5 C5 E5 G5 C5 E5 G5 C5 E5 G5 Bb5",
        stab: "D4^037 D4^037 . D4^037 . D4^037 D4^037 . D4^037 . D4^037 D4^037 . D4^037 . . | Bb3^047 Bb3^047 . Bb3^047 . Bb3^047 Bb3^047 . Bb3^047 . Bb3^047 Bb3^047 . Bb3^047 . . | F4^047 F4^047 . F4^047 . F4^047 F4^047 . F4^047 . F4^047 F4^047 . F4^047 . . | C4^047 C4^047 . C4^047 . C4^047 C4^047 . C4^047 . C4^047 C4^047 . C4^047 . .",
        lead: "A5 - - - - - - - F5 - - - D5 - - - | D6 - - - - - - - C6 - - - Bb5 - - - | A5 - - - - - - - C6 - - - F6 - - - | E6 - - - - - - - D6 - - - C6 - - -",
      },
      C: {
        bass: "G1 G1 G1 G1 G2 G1 G1 G1 G1 G1 G1 G1 G2 G1 F1 G1 | Bb1 Bb1 Bb1 Bb1 Bb2 Bb1 Bb1 Bb1 Bb1 Bb1 Bb1 Bb1 Bb2 Bb1 A1 Bb1 | C2 C2 C2 C2 C3 C2 C2 C2 C2 C2 C2 C2 C3 C2 Bb1 C2 | A1 A1 A1 A1 A2 A1 A1 A1 A1 A1 A1 A1 A2 A1 C#2 E2",
        drums: "k . h k s . h k k . h k s . h k | k . h k s . h k k . h k s . h k | k . h k s . h k k . h k s . h k | k . h k s . h k s s s s ks s ks s",
        arp: "D5 G5 Bb5 D5 G5 Bb5 D5 G5 Bb5 D5 G5 Bb5 D5 G5 Bb5 C6 | D5 F5 Bb5 D5 F5 Bb5 D5 F5 Bb5 D5 F5 Bb5 D5 F5 Bb5 C6 | E5 G5 C6 E5 G5 C6 E5 G5 C6 E5 G5 C6 E5 G5 C6 D6 | C#5 E5 A5 C#5 E5 A5 C#5 E5 A5 C#5 E5 A5 C#5 E5 A5 G5",
        stab: "G3^037 - - - - - - - - - - - - - - - | Bb3^047 - - - - - - - - - - - - - - - | C4^047 - - - - - - - - - - - - - - - | A3^047a - - - - - - - - - - - - - - -",
        lead: "Bb5 - - - - - - - D6 - - - G6 - - - | F6 - - - - - - - D6 - - - Bb5 - - - | G6 - - - - - - - E6 - - - C6 - - - | C#6 - - - - - - - E6 - - - - - - -",
      },
    },
    order: ["A", "B", "C", "B", "C"],
  },
  // Overdrive at dusk: F minor outrun at 112 with the sun going down: a big gated snare on two and
  // four, an octave-bouncing sawtooth bass, a rolling sixteenth arp and gated chord pulses, and a
  // sawtooth lead doubled an octave below; the chorus swings B-flat minor, A-flat, D-flat to a
  // bright C major.
  trailsOverdrive: {
    bpm: 112,
    rush: 12,
    voices: {
      bass: { wave: "sawtooth", gain: 0.4, decay: 0.07, sustain: 0.4 },
      drums: { kit: true, gain: 0.8, from: 0.1 },
      arp: { wave: "pulse", duty: 0.125, gain: 0.16, decay: 0.03, sustain: 0.3, from: 0.3 },
      pad: { wave: "pulse", duty: 0.25, gain: 0.2, decay: 0.05, sustain: 0.3, from: 0.25 },
      lead: { wave: "sawtooth", gain: 0.2, decay: 0.12, sustain: 0.8, vibrato: { rate: 5.5, depth: 0.01, delay: 0.2 }, from: 0.5 },
      low: { wave: "pulse", duty: 0.5, gain: 0.16, decay: 0.12, sustain: 0.8, from: 0.5 },
    },
    patterns: {
      A: {
        bass: "F1 . F2 . F1 . F2 . F1 . F2 . F1 . F2 . | Db2 . Db3 . Db2 . Db3 . Db2 . Db3 . Db2 . Db3 . | Ab1 . Ab2 . Ab1 . Ab2 . Ab1 . Ab2 . Ab1 . Ab2 . | Eb2 . Eb3 . Eb2 . Eb3 . Eb2 . Eb3 . Eb2 . G2 Bb2",
        drums: "k . h . s . h . k . h k s . h . | k . h . s . h . k . h k s . h . | k . h . s . h . k . h k s . h . | k . h . s . h . s s s s s s s s",
        arp: "F4 Ab4 C5 F5 Ab5 F5 C5 Ab4 F4 Ab4 C5 F5 Ab5 F5 C5 Ab4 | F4 Ab4 Db5 F5 Ab5 F5 Db5 Ab4 F4 Ab4 Db5 F5 Ab5 F5 Db5 Ab4 | Eb4 Ab4 C5 Eb5 Ab5 Eb5 C5 Ab4 Eb4 Ab4 C5 Eb5 Ab5 Eb5 C5 Ab4 | Eb4 G4 Bb4 Eb5 G5 Eb5 Bb4 G4 Eb4 G4 Bb4 Eb5 G5 Eb5 Bb4 G4",
      },
      B: {
        bass: "F1 . F2 . F1 . F2 . F1 . F2 . F1 . F2 . | Db2 . Db3 . Db2 . Db3 . Db2 . Db3 . Db2 . Db3 . | Ab1 . Ab2 . Ab1 . Ab2 . Ab1 . Ab2 . Ab1 . Ab2 . | Eb2 . Eb3 . Eb2 . Eb3 . Eb2 . Eb3 . Eb2 . G2 Bb2",
        drums: "k h h h s h h h k h k h s h h h | k h h h s h h h k h k h s h h h | k h h h s h h h k h k h s h h h | k h h h s h h h s . s s s s s s",
        arp: "F4 Ab4 C5 F5 Ab5 F5 C5 Ab4 F4 Ab4 C5 F5 Ab5 F5 C5 Ab4 | F4 Ab4 Db5 F5 Ab5 F5 Db5 Ab4 F4 Ab4 Db5 F5 Ab5 F5 Db5 Ab4 | Eb4 Ab4 C5 Eb5 Ab5 Eb5 C5 Ab4 Eb4 Ab4 C5 Eb5 Ab5 Eb5 C5 Ab4 | Eb4 G4 Bb4 Eb5 G5 Eb5 Bb4 G4 Eb4 G4 Bb4 Eb5 G5 Eb5 Bb4 G4",
        pad: "F4^037 . F4^037 F4^037 . F4^037 . F4^037 F4^037 . F4^037 F4^037 . F4^037 . F4^037 | Db4^047 . Db4^047 Db4^047 . Db4^047 . Db4^047 Db4^047 . Db4^047 Db4^047 . Db4^047 . Db4^047 | Ab3^047 . Ab3^047 Ab3^047 . Ab3^047 . Ab3^047 Ab3^047 . Ab3^047 Ab3^047 . Ab3^047 . Ab3^047 | Eb4^047 . Eb4^047 Eb4^047 . Eb4^047 . Eb4^047 Eb4^047 . Eb4^047 Eb4^047 . Eb4^047 . Eb4^047",
        lead: "C6 - - - - - Ab5 - F5 - - - Ab5 - - - | Db6 - - - - - C6 - Ab5 - - - F5 - - - | Eb6 - - - - - C6 - Ab5 - - - C6 - - - | Bb5 - - - - - - - - - - - . . . .",
        low: "C5 - - - - - Ab4 - F4 - - - Ab4 - - - | Db5 - - - - - C5 - Ab4 - - - F4 - - - | Eb5 - - - - - C5 - Ab4 - - - C5 - - - | Bb4 - - - - - - - - - - - . . . .",
      },
      C: {
        bass: "Bb1 . Bb2 . Bb1 . Bb2 . Bb1 . Bb2 . Bb1 . Bb2 . | Ab1 . Ab2 . Ab1 . Ab2 . Ab1 . Ab2 . Ab1 . Ab2 . | Db2 . Db3 . Db2 . Db3 . Db2 . Db3 . Db2 . Db3 . | C2 . C3 . C2 . C3 . C2 . C3 . C2 . E2 G2",
        drums: "k h h h s h h h k h k h s h h h | k h h h s h h h k h k h s h h h | k h h h s h h h k h k h s h h h | k h h h s h h h s s s s s s s s",
        arp: "F4 Bb4 Db5 F5 Bb5 F5 Db5 Bb4 F4 Bb4 Db5 F5 Bb5 F5 Db5 Bb4 | Eb4 Ab4 C5 Eb5 Ab5 Eb5 C5 Ab4 Eb4 Ab4 C5 Eb5 Ab5 Eb5 C5 Ab4 | F4 Ab4 Db5 F5 Ab5 F5 Db5 Ab4 F4 Ab4 Db5 F5 Ab5 F5 Db5 Ab4 | E4 G4 C5 E5 G5 E5 C5 G4 E4 G4 C5 E5 G5 E5 C5 G4",
        pad: "Bb3^037 . Bb3^037 Bb3^037 . Bb3^037 . Bb3^037 Bb3^037 . Bb3^037 Bb3^037 . Bb3^037 . Bb3^037 | Ab3^047 . Ab3^047 Ab3^047 . Ab3^047 . Ab3^047 Ab3^047 . Ab3^047 Ab3^047 . Ab3^047 . Ab3^047 | Db4^047 . Db4^047 Db4^047 . Db4^047 . Db4^047 Db4^047 . Db4^047 Db4^047 . Db4^047 . Db4^047 | C4^047 . C4^047 C4^047 . C4^047 . C4^047 C4^047 . C4^047 C4^047 . C4^047 . C4^047",
        lead: "Db6 - - - - - - - F6 - - - Db6 - - - | C6 - - - - - - - Eb6 - - - C6 - - - | Ab5 - - - - - - - Db6 - - - F6 - - - | E6 - - - - - - - G6 - - - E6 - - -",
        low: "Db5 - - - - - - - F5 - - - Db5 - - - | C5 - - - - - - - Eb5 - - - C5 - - - | Ab4 - - - - - - - Db5 - - - F5 - - - | E5 - - - - - - - G5 - - - E5 - - -",
      },
    },
    order: ["A", "B", "C", "B", "C"],
  },
  // Laser highway: G minor at 120 on an empty highway of light: a pushing octave bass, a pad that
  // pumps on every beat like it is breathing with the kick, a sequence ticking over each chord, and
  // a lead with an echo trailing a dotted eighth behind it; the chorus climbs C minor, B-flat,
  // E-flat to F.
  trailsLaserHighway: {
    bpm: 120,
    rush: 10,
    voices: {
      bass: { wave: "sawtooth", gain: 0.4, decay: 0.06, sustain: 0.35 },
      drums: { kit: true, gain: 0.78, from: 0.1 },
      pad: { wave: "sine", gain: 0.22, decay: 0.2, sustain: 0.6, from: 0.2 },
      seq: { wave: "pulse", duty: 0.125, gain: 0.16, decay: 0.03, sustain: 0.25, from: 0.35 },
      lead: { wave: "pulse", duty: 0.25, gain: 0.34, decay: 0.12, sustain: 0.8, vibrato: { rate: 5.5, depth: 0.01, delay: 0.2 }, from: 0.5 },
      echo: { wave: "pulse", duty: 0.25, gain: 0.12, decay: 0.12, sustain: 0.6, from: 0.55 },
    },
    patterns: {
      A: {
        bass: "G1 . G2 . G1 G1 G2 . G1 . G2 . G1 G1 G2 F2 | Eb2 . Eb3 . Eb2 Eb2 Eb3 . Eb2 . Eb3 . Eb2 Eb2 Eb3 D3 | Bb1 . Bb2 . Bb1 Bb1 Bb2 . Bb1 . Bb2 . Bb1 Bb1 Bb2 A2 | F1 . F2 . F1 F1 F2 . F1 . F2 . F1 F1 F2 A1",
        drums: "k . h k s . h . k . h k s . h . | k . h k s . h . k . h k s . h . | k . h k s . h . k . h k s . h . | k . h k s . h . s s s s s s s s",
        pad: "G3^037 - - . G3^037 - - . G3^037 - - . G3^037 - - . | Eb4^047 - - . Eb4^047 - - . Eb4^047 - - . Eb4^047 - - . | Bb3^047 - - . Bb3^047 - - . Bb3^047 - - . Bb3^047 - - . | F3^047 - - . F3^047 - - . F3^047 - - . F3^047 - - .",
        seq: "G4 D5 Bb4 D5 G4 D5 Bb4 D5 G4 D5 Bb4 D5 A4 D5 Bb4 D5 | G4 Eb5 Bb4 Eb5 G4 Eb5 Bb4 Eb5 G4 Eb5 Bb4 Eb5 F4 Eb5 Bb4 Eb5 | F4 D5 Bb4 D5 F4 D5 Bb4 D5 F4 D5 Bb4 D5 G4 D5 Bb4 D5 | F4 C5 A4 C5 F4 C5 A4 C5 F4 C5 A4 C5 Eb5 C5 A4 C5",
      },
      B: {
        bass: "G1 . G2 . G1 G1 G2 . G1 . G2 . G1 G1 G2 F2 | Eb2 . Eb3 . Eb2 Eb2 Eb3 . Eb2 . Eb3 . Eb2 Eb2 Eb3 D3 | Bb1 . Bb2 . Bb1 Bb1 Bb2 . Bb1 . Bb2 . Bb1 Bb1 Bb2 A2 | F1 . F2 . F1 F1 F2 . F1 . F2 . F1 F1 F2 A1",
        drums: "kh h h kh sh h h h kh h h kh sh h h h | kh h h kh sh h h h kh h h kh sh h h h | kh h h kh sh h h h kh h h kh sh h h h | kh h h kh sh h h h s . s s s s s s",
        pad: "G3^037 - - . G3^037 - - . G3^037 - - . G3^037 - - . | Eb4^047 - - . Eb4^047 - - . Eb4^047 - - . Eb4^047 - - . | Bb3^047 - - . Bb3^047 - - . Bb3^047 - - . Bb3^047 - - . | F3^047 - - . F3^047 - - . F3^047 - - . F3^047 - - .",
        seq: "G4 D5 Bb4 D5 G4 D5 Bb4 D5 G4 D5 Bb4 D5 A4 D5 Bb4 D5 | G4 Eb5 Bb4 Eb5 G4 Eb5 Bb4 Eb5 G4 Eb5 Bb4 Eb5 F4 Eb5 Bb4 Eb5 | F4 D5 Bb4 D5 F4 D5 Bb4 D5 F4 D5 Bb4 D5 G4 D5 Bb4 D5 | F4 C5 A4 C5 F4 C5 A4 C5 F4 C5 A4 C5 Eb5 C5 A4 C5",
        lead: "D5 - - - G5 - - - Bb5 - - - A5 - G5 - | G5 - - - - - - - Eb5 - - - Bb4 - - - | D5 - - - F5 - - - Bb5 - - - C6 - D6 - | C6 - - - - - - - A5 - - - F5 - - -",
        echo: ". - - D5 - - - G5 - - - Bb5 - - - A5 | - G5 - G5 - - - - - - - Eb5 - - - Bb4 | - - - D5 - - - F5 - - - Bb5 - - - C6 | - D6 - C6 - - - - - - - A5 - - - F5",
      },
      C: {
        bass: "C2 . C3 . C2 C2 C3 . C2 . C3 . C2 C2 C3 Bb2 | Bb1 . Bb2 . Bb1 Bb1 Bb2 . Bb1 . Bb2 . Bb1 Bb1 Bb2 A2 | Eb2 . Eb3 . Eb2 Eb2 Eb3 . Eb2 . Eb3 . Eb2 Eb2 Eb3 D3 | F1 . F2 . F1 F1 F2 . F1 . F2 . F1 F1 F2 A1",
        drums: "kh h h kh sh h h h kh h h kh sh h h h | kh h h kh sh h h h kh h h kh sh h h h | kh h h kh sh h h h kh h h kh sh h h h | kh h h kh sh h h h s s s s s s s s",
        pad: "C4^037 - - . C4^037 - - . C4^037 - - . C4^037 - - . | Bb3^047 - - . Bb3^047 - - . Bb3^047 - - . Bb3^047 - - . | Eb4^047 - - . Eb4^047 - - . Eb4^047 - - . Eb4^047 - - . | F3^047 - - . F3^047 - - . F3^047 - - . F3^047 - - .",
        seq: "G4 Eb5 C5 Eb5 G4 Eb5 C5 Eb5 G4 Eb5 C5 Eb5 F4 Eb5 C5 Eb5 | F4 D5 Bb4 D5 F4 D5 Bb4 D5 F4 D5 Bb4 D5 G4 D5 Bb4 D5 | G4 Eb5 Bb4 Eb5 G4 Eb5 Bb4 Eb5 G4 Eb5 Bb4 Eb5 Ab4 Eb5 Bb4 Eb5 | F4 C5 A4 C5 F4 C5 A4 C5 F4 C5 A4 C5 Eb5 C5 A4 C5",
        lead: "Eb6 - - - - - - - D6 - - - C6 - - - | D6 - - - - - - - Bb5 - - - F5 - - - | G5 - - - - - - - Bb5 - - - Eb6 - - - | F6 - - - - - - - C6 - - - A5 - - -",
        echo: ". - - Eb6 - - - - - - - D6 - - - C6 | - - - D6 - - - - - - - Bb5 - - - F5 | - - - G5 - - - - - - - Bb5 - - - Eb6 | - - - F6 - - - - - - - C6 - - - A5",
      },
    },
    order: ["A", "B", "C", "B", "C"],
  },
};
