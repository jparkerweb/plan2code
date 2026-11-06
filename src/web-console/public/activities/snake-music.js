// Plan2Code Web Console - snake: its music tracks, merged into snake-sfx.js beside the sounds; defines only.
//
// Ten tracks, one dealt to each level of a round (MUSIC_TRACKS and dealMusic in
// snake.js), picked on the pages in prototypes/music/snake. They share a sound: a
// rhythm from a real folk or world tradition, led by something plucked or reedy,
// mostly in a dark or modal key. Each is the shape music.js documents,
// { bpm, rush, voices, patterns, order }, and builds with the pace: the bass and
// the lead first, then the rest as the snake speeds up. Bars are not all sixteen
// steps: Pirate Cove is 6/8 (12), Clockwork Factory 7/8 (14), Oasis Sama'i and Raga
// Lantern ten beats (20) and Solea Sunrise twelve beats (24), and every pattern
// holds a whole number of its bars. A name may be defined only once across
// tones.js and every game's file. No imports.

export const SNAKE_MUSIC = {
  // Desert Bazaar: A busy desert bazaar in D phrygian dominant: an oud bass plucking around the D, a
  // reed lead winding through the half steps, a drone underneath and darbuka drums in a rolling rumba.
  // Listen for the reed sliding D, E-flat, F-sharp in the first bar, the long breath on the D, and the
  // bridge where the reed breaks into sixteenth-note ornaments.
  snakeBazaar: {
    bpm: 104,
    rush: 8,
    voices: {
      oud: { wave: "pulse", duty: 0.25, gain: 0.5, decay: 0.08, sustain: 0.2 },
      reed: { wave: "pulse", duty: 0.125, gain: 0.3, decay: 0.08, sustain: 0.7, vibrato: { rate: 6.5, depth: 0.018, delay: 0.1 } },
      drone: { wave: "sine", gain: 0.3, from: 0.15, decay: 0.3, sustain: 0.9 },
      drums: { kit: true, gain: 0.56, from: 0.1 },
      low: { wave: "triangle", gain: 0.3, from: 0.5, decay: 0.1, sustain: 0.8 },
    },
    patterns: {
      A: {
        oud:
        "D2 . D2 . Eb2 . D2 . F#2 . G2 . F#2 . Eb2 . | D2 . D2 . D2 . Eb2 . D2 . D2 . A2 . G2 . | D2 . D2 . Eb2 . D2 . F#2 . G2 . F#2 . Eb2 . | D2 . D2 . D2 . Eb2 . D2 . D2 . A2 . G2 . | " +
        "D2 . D2 . Eb2 . D2 . F#2 . G2 . F#2 . Eb2 . | D2 . D2 . D2 . Eb2 . D2 . D2 . A2 . G2 . | D2 . D2 . Eb2 . D2 . F#2 . G2 . F#2 . Eb2 . | D2 . D2 . D2 . Eb2 . D2 . D2 . A2 . G2 .",
        reed:
        "D5 - Eb5 D5 - F#5 - G5 F#5 - Eb5 D5 - - - - | A5 - G5 F#5 - Eb5 - D5 Eb5 - F#5 - Eb5 D5 - - | G5 - F#5 G5 - A5 - A5 G5 - F#5 - Eb5 - D5 - | D5 - - - - - - - . . . . A4 - Bb4 - | " +
        "A4 - Bb4 A4 - D5 - Eb5 D5 - F#5 - G5 - A5 - | A5 - G5 F#5 - Eb5 - F#5 G5 - A5 - G5 F#5 - - | F#5 - Eb5 D5 - Eb5 - F#5 G5 - F#5 - Eb5 - D5 - | D5 - - - - - - - . . . . . . . .",
        drone:
        "D3 - - - - - - - - - - - - - - - | D3 - - - - - - - - - - - - - - - | D3 - - - - - - - - - - - - - - - | D3 - - - - - - - - - - - - - - - | " +
        "D3 - - - - - - - - - - - - - - - | D3 - - - - - - - - - - - - - - - | D3 - - - - - - - - - - - - - - - | D3 - - - - - - - - - - - - - - -",
        low:
        "D4 - D#4 D4 - F#4 - G4 F#4 - D#4 D4 - - - - | A4 - G4 F#4 - D#4 - D4 D#4 - F#4 - D#4 D4 - - | G4 - F#4 G4 - A4 - A4 G4 - F#4 - D#4 - D4 - | D4 - - - - - - - . . . . A3 - A#3 - | " +
        "A3 - A#3 A3 - D4 - D#4 D4 - F#4 - G4 - A4 - | A4 - G4 F#4 - D#4 - F#4 G4 - A4 - G4 F#4 - - | F#4 - D#4 D4 - D#4 - F#4 G4 - F#4 - D#4 - D4 - | D4 - - - - - - - . . . . . . . .",
        drums:
        "k . s . h . s . k . h . s . h . | k . s . h . s . k . h . s . h . | k . s . h . s . k . h . s . h . | k . s . h . s . k . h . s . h . | " +
        "k . s . h . s . k . h . s . h . | k . s . h . s . k . h . s . h . | k . s . h . s . k . h . s . h . | k . s . h . s . s s s s s s s s",
      },
      B: {
        oud:
        "D2 . D2 . D2 . Eb2 . D2 . D2 . A2 . G2 . | D2 . D2 . Eb2 . D2 . F#2 . G2 . F#2 . Eb2 . | D2 . D2 . D2 . Eb2 . D2 . D2 . A2 . G2 . | D2 . D2 . Eb2 . D2 . F#2 . G2 . F#2 . Eb2 .",
        reed:
        "D5 Eb5 D5 C5 D5 Eb5 F#5 Eb5 D5 Eb5 D5 C5 Bb4 A4 Bb4 C5 | D5 F#5 A5 G5 F#5 Eb5 D5 Eb5 F#5 G5 A5 G5 F#5 Eb5 D5 C5 | D5 Eb5 D5 C5 D5 Eb5 F#5 Eb5 D5 Eb5 D5 C5 Bb4 A4 Bb4 C5 | D5 - - - - - - - . . . . . . . .",
        drone:
        "D3 - - - - - - - - - - - - - - - | D3 - - - - - - - - - - - - - - - | D3 - - - - - - - - - - - - - - - | D3 - - - - - - - - - - - - - - -",
        low:
        "D4 D#4 D4 C4 D4 D#4 F#4 D#4 D4 D#4 D4 C4 A#3 A3 A#3 C4 | D4 F#4 A4 G4 F#4 D#4 D4 D#4 F#4 G4 A4 G4 F#4 D#4 D4 C4 | D4 D#4 D4 C4 D4 D#4 F#4 D#4 D4 D#4 D4 C4 A#3 A3 A#3 C4 | D4 - - - - - - - . . . . . . . .",
        drums:
        "k . s . h . s . k . h . s . h . | k . s . h . s . k . h . s . h . | k . s . h . s . k . h . s . h . | k . s . h . s . s s s s s s s s",
      },
    },
    order: ["A","B","A"],
  },
  // Jungle Drums: A drumming jungle in G minor pentatonic: a marimba tapping a pattern that never lands
  // where you expect, a syncopated bass and drums that argue with each other. Listen for the marimba's
  // double tap in the third bar, the low chant sitting under it, and the bridge where the marimba and
  // drums trade turns.
  snakeJungle: {
    bpm: 124,
    rush: 10,
    voices: {
      bass: { wave: "triangle", gain: 0.9, decay: 0.06, sustain: 0.4 },
      marimba: { wave: "pulse", duty: 0.125, gain: 0.34, decay: 0.05, sustain: 0.1 },
      chant: { wave: "sine", gain: 0.3, from: 0.4, decay: 0.3, sustain: 0.9, vibrato: { rate: 4.5, depth: 0.02, delay: 0.2 } },
      drums: { kit: true, gain: 0.66, from: 0.1 },
      echo: { wave: "pulse", duty: 0.125, gain: 0.12, from: 0.55, decay: 0.04, sustain: 0.3 },
    },
    patterns: {
      A: {
        bass:
        "G2 . . G2 . G2 . . Bb2 . . C3 . D3 . . | G2 . . G2 . G2 . . Bb2 . . C3 . D3 . . | G2 . . G2 . G2 . . Bb2 . . C3 . D3 . . | G2 . . G2 . G2 . . Bb2 . . C3 . D3 . . | " +
        "Bb1 . . Bb1 . Bb1 . . D2 . . F2 . G2 . . | Bb1 . . Bb1 . Bb1 . . D2 . . F2 . G2 . . | C2 . . C2 . C2 . . E2 . . G2 . A2 . . | G2 . . G2 . G2 . . Bb2 . . C3 . D3 . .",
        chant:
        "G3 - - - - - - - D3 - - - - - - - | G3 - - - - - - - D3 - - - - - - - | G3 - - - - - - - D3 - - - - - - - | G3 - - - - - - - D3 - - - - - - - | " +
        "Bb3 - - - - - - - F3 - - - - - - - | Bb3 - - - - - - - F3 - - - - - - - | C3 - - - - - - - G3 - - - - - - - | G3 - - - - - - - D3 - - - - - - -",
        marimba:
        "G4 . Bb4 . D5 . Bb4 . G4 . C5 . D5 . F5 . | F5 . D5 . C5 . Bb4 . G4 . Bb4 . C5 . D5 . | G4 G4 . Bb4 . D5 D5 . F5 . D5 . C5 . Bb4 . | C5 . Bb4 . G4 . F4 . G4 - - - . . . . | " +
        "Bb4 . D5 . F5 . D5 . Bb4 . C5 . D5 . F5 . | G5 . F5 . D5 . C5 . Bb4 . C5 . D5 . . . | G4 G4 . Bb4 . D5 D5 . F5 . G5 . F5 . D5 . | C5 . Bb4 . G4 . Bb4 . G4 - - - . . . .",
        drums:
        "k h k h s h k k h k h h s h k h | k h k h s h k k h k h h s h k h | k h k h s h k k h k h h s h k h | k h k h s h k k h k h h s h k h | " +
        "k h k h s h k k h k h h s h k h | k h k h s h k k h k h h s h k h | k h k h s h k k h k h h s h k h | k h k h s h k k s s s s s s s s",
        echo:
        ". . . G4 . Bb4 . D5 . Bb4 . G4 . C5 . D5 | . F5 . F5 . D5 . C5 . Bb4 . G4 . Bb4 . C5 | . D5 . G4 G4 . Bb4 . D5 D5 . F5 . D5 . C5 | . Bb4 . C5 . Bb4 . G4 . F4 . G4 - - - . | " +
        ". . . Bb4 . D5 . F5 . D5 . Bb4 . C5 . D5 | . F5 . G5 . F5 . D5 . C5 . Bb4 . C5 . D5 | . . . G4 G4 . Bb4 . D5 D5 . F5 . G5 . F5 | . D5 . C5 . Bb4 . G4 . Bb4 . G4 - - - .",
      },
      B: {
        bass:
        "Eb2 . . Eb2 . Eb2 . . G2 . . Bb2 . C3 . . | F2 . . F2 . F2 . . A2 . . C3 . D3 . . | G2 . . G2 . G2 . . Bb2 . . C3 . D3 . . | G2 . . G2 . G2 . . Bb2 . . C3 . D3 . .",
        chant:
        "Eb3 - - - - - - - Bb2 - - - - - - - | F3 - - - - - - - C3 - - - - - - - | G3 - - - - - - - D3 - - - - - - - | G3 - - - - - - - D3 - - - - - - -",
        marimba:
        "Bb4 . . Bb4 . . D5 . . F5 . . D5 . . . | A4 . . A4 . . C5 . . F5 . . C5 . . . | G4 . . G4 . . Bb4 . . D5 . . G5 . . . | G5 - - - - - - - . . . . . . . .",
        drums:
        "k h k h s h k k h k h h s h k h | k h k h s h k k h k h h s h k h | k h k h s h k k h k h h s h k h | k h k h s h k k s s s s s s s s",
        echo:
        ". . . Bb4 . . Bb4 . . D5 . . F5 . . D5 | . . . A4 . . A4 . . C5 . . F5 . . C5 | . . . G4 . . G4 . . Bb4 . . D5 . . G5 | . . . G5 - - - - - - - . . . . .",
      },
    },
    order: ["A","B","A"],
  },
  // Pirate Cove: A pirate jig in D minor, rolling in 6/8: an accordion oompah, a fiddle skipping in
  // pairs and a drum that thumps on the one and snaps on the four. Listen for the fiddle climbing D, F,
  // A before falling back, the A major that closes every strain on a roar, and the shanty bridge in G
  // minor.
  snakePirate: {
    bpm: 126,
    rush: 10,
    bar: 12,
    voices: {
      bass: { wave: "triangle", gain: 0.9, decay: 0.08, sustain: 0.5 },
      fiddle: { wave: "pulse", duty: 0.5, gain: 0.32, decay: 0.08, sustain: 0.7, vibrato: { rate: 6, depth: 0.012, delay: 0.2 } },
      drums: { kit: true, gain: 0.58, from: 0.1 },
      accordion: { wave: "pulse", duty: 0.25, gain: 0.18, from: 0.3, decay: 0.05, sustain: 0.4 },
      echo: { wave: "pulse", duty: 0.125, gain: 0.1, from: 0.7, decay: 0.04, sustain: 0.5 },
    },
    patterns: {
      A: {
        bass:
        "D2 . . . . . A2 . . . . . | C3 . . . . . G2 . . . . . | Bb1 . . . . . F2 . . . . . | A1 . . . . . E2 . . . . . | " +
        "D2 . . . . . A2 . . . . . | C3 . . . . . G2 . . . . . | Bb1 . . . . . F2 . . . . . | A1 . . . . . E2 . . . . .",
        accordion:
        ". . D4^037 . D4^037 . . . D4^037 . D4^037 . | . . C4^047 . C4^047 . . . C4^047 . C4^047 . | . . Bb3^047 . Bb3^047 . . . Bb3^047 . Bb3^047 . | . . A3^047 . A3^047 . . . A3^047 . A3^047 . | " +
        ". . D4^037 . D4^037 . . . D4^037 . D4^037 . | . . C4^047 . C4^047 . . . C4^047 . C4^047 . | . . Bb3^047 . Bb3^047 . . . Bb3^047 . Bb3^047 . | . . A3^047 . A3^047 . . . A3^047 . A3^047 .",
        fiddle:
        "D5 - F5 - A5 - A5 - F5 - D5 - | E5 - G5 - E5 - C5 - E5 - G5 - | D5 - F5 - Bb4 - D5 - F5 - D5 - | C#5 - E5 - A5 - G5 - E5 - C#5 - | " +
        "A5 - G5 - F5 - E5 - D5 - F5 - | G5 - E5 - C5 - E5 - G5 - E5 - | F5 - D5 - Bb4 - D5 - F5 - A5 - | A5 - G5 - E5 - C#5 - A4 - - -",
        drums:
        "k . h . h . s . h . h . | k . h . h . s . h . h . | k . h . h . s . h . h . | k . h . h . s . h . h . | " +
        "k . h . h . s . h . h . | k . h . h . s . h . h . | k . h . h . s . h . h . | k . h . h . s . h . h .",
        echo:
        ". . D5 - F5 - A5 - A5 - F5 - D5 - E5 - | G5 - E5 - C5 - E5 - G5 - D5 - F5 - Bb4 - | D5 - F5 - D5 - C#5 - E5 - A5 - G5 - E5 - | C#5 - A5 - G5 - F5 - E5 - D5 - F5 - G5 - | " +
        "E5 - C5 - E5 - G5 - E5 - F5 - D5 - Bb4 - | D5 - F5 - A5 - A5 - G5 - E5 - C#5 - A4 -",
      },
      B: {
        bass:
        "G1 . . . . . D2 . . . . . | A1 . . . . . E2 . . . . . | D2 . . . . . A2 . . . . . | A1 . . . . . E2 . . . . .",
        accordion:
        ". . G3^037 . G3^037 . . . G3^037 . G3^037 . | . . A3^047 . A3^047 . . . A3^047 . A3^047 . | . . D4^037 . D4^037 . . . D4^037 . D4^037 . | . . A3^047 . A3^047 . . . A3^047 . A3^047 .",
        fiddle:
        "G5 - Bb4 - D5 - G5 - D5 - Bb4 - | A5 - E5 - C#5 - E5 - A5 - E5 - | F5 - A5 - F5 - D5 - F5 - A5 - | E5 - C#5 - A4 - C#5 - E5 - - -",
        drums:
        "k . h . h . s . h . h . | k . h . h . s . h . h . | k . h . h . s . h . h . | k . h . h . s . h . h .",
        echo:
        ". . G5 - Bb4 - D5 - G5 - D5 - Bb4 - A5 - | E5 - C#5 - E5 - A5 - E5 - F5 - A5 - F5 - | D5 - F5 - A5 - E5 - C#5 - A4 - C#5 - E5 -",
      },
    },
    order: ["A","B","A"],
  },
  // Clockwork Factory: A clockwork factory in F minor, seven beats to the bar: a glockenspiel picking
  // out a small machine of a melody, a hi-hat ticking every beat and a bass that rocks in two-two-three.
  // Listen for the bar that never feels finished because of the odd seventh beat, the cogs of the melody
  // turning one chord at a time, and the bridge where it slows to long notes.
  snakeClockwork: {
    bpm: 132,
    rush: 8,
    bar: 14,
    voices: {
      bass: { wave: "triangle", gain: 0.88, decay: 0.08, sustain: 0.5 },
      glock: { wave: "pulse", duty: 0.125, gain: 0.3, decay: 0.06, sustain: 0.1 },
      drums: { kit: true, gain: 0.55, from: 0.1 },
      low: { wave: "triangle", gain: 0.3, from: 0.45, decay: 0.1, sustain: 0.7 },
      echo: { wave: "pulse", duty: 0.125, gain: 0.1, from: 0.7, decay: 0.04, sustain: 0.4 },
    },
    patterns: {
      A: {
        bass:
        "F2 - - - C3 - - - F2 - - - - - | Db2 - - - Ab2 - - - Db2 - - - - - | Eb2 - - - Bb2 - - - Eb2 - - - - - | C2 - - - G2 - - - C2 - - - - - | " +
        "F2 - - - C3 - - - F2 - - - - - | Db2 - - - Ab2 - - - Db2 - - - - - | Eb2 - - - Bb2 - - - Eb2 - - - - - | C2 - - - G2 - - - C2 - - - - -",
        glock:
        "F5 . C5 . F5 . Ab4 . C5 . . . . . | Db5 . Ab4 . Db5 . F5 . Ab4 . . . . . | Eb5 . Bb4 . Eb5 . G5 . Bb4 . . . . . | C5 . E5 . G5 . E5 . C5 . . . . . | " +
        "C5 . F5 . Ab5 . F5 . C5 . . . . . | F5 . Db5 . Ab4 . Db5 . F5 . . . . . | G5 . Eb5 . Bb4 . Eb5 . G5 . . . . . | G5 . E5 . C5 . G4 . C5 - - - - -",
        low:
        "F4 . C4 . F4 . G#3 . C4 . . . . . | C#4 . G#3 . C#4 . F4 . G#3 . . . . . | D#4 . A#3 . D#4 . G4 . A#3 . . . . . | C4 . E4 . G4 . E4 . C4 . . . . . | " +
        "C4 . F4 . G#4 . F4 . C4 . . . . . | F4 . C#4 . G#3 . C#4 . F4 . . . . . | G4 . D#4 . A#3 . D#4 . G4 . . . . . | G4 . E4 . C4 . G3 . C4 - - - - -",
        drums:
        "kh . h . sh . h . kh . h . sh . | kh . h . sh . h . kh . h . sh . | kh . h . sh . h . kh . h . sh . | kh . h . sh . h . kh . h . sh . | " +
        "kh . h . sh . h . kh . h . sh . | kh . h . sh . h . kh . h . sh . | kh . h . sh . h . kh . h . sh . | kh . h . sh . h . kh . h . sh .",
        echo:
        ". . . . F5 . C5 . F5 . Ab4 . C5 . . . | . . Db5 . Ab4 . Db5 . F5 . Ab4 . . . . . | Eb5 . Bb4 . Eb5 . G5 . Bb4 . . . . . C5 . | E5 . G5 . E5 . C5 . . . . . C5 . F5 . | " +
        "Ab5 . F5 . C5 . . . . . F5 . Db5 . Ab4 . | Db5 . F5 . . . . . G5 . Eb5 . Bb4 . Eb5 . | G5 . . . . . G5 . E5 . C5 . G4 . C5 -",
      },
      B: {
        bass:
        "F2 - - - C3 - - - F2 - - - - - | F2 - - - C3 - - - F2 - - - - - | Bb1 - - - F2 - - - Bb1 - - - - - | Bb1 - - - F2 - - - Bb1 - - - - - | " +
        "Db2 - - - Ab2 - - - Db2 - - - - - | Eb2 - - - Bb2 - - - Eb2 - - - - - | C2 - - - G2 - - - C2 - - - - - | C2 - - - G2 - - - C2 - - - - -",
        glock:
        "Ab4 - - - C5 - - - F5 - - - . . | Eb5 - - - C5 - - - Ab4 - - - . . | Bb4 - - - Db5 - - - F5 - - - . . | F5 - - - Db5 - - - Bb4 - - - . . | " +
        "Db5 - - - F5 - - - Ab5 - - - . . | G5 - - - Bb4 - - - Eb5 - - - . . | E5 - - - G5 - - - C5 - - - . . | G5 - - - E5 - - - C5 - - - . .",
        low:
        "G#3 - - - C4 - - - F4 - - - . . | D#4 - - - C4 - - - G#3 - - - . . | A#3 - - - C#4 - - - F4 - - - . . | F4 - - - C#4 - - - A#3 - - - . . | " +
        "C#4 - - - F4 - - - G#4 - - - . . | G4 - - - A#3 - - - D#4 - - - . . | E4 - - - G4 - - - C4 - - - . . | G4 - - - E4 - - - C4 - - - . .",
        drums:
        "kh . h . sh . h . kh . h . sh . | kh . h . sh . h . kh . h . sh . | kh . h . sh . h . kh . h . sh . | kh . h . sh . h . kh . h . sh . | " +
        "kh . h . sh . h . kh . h . sh . | kh . h . sh . h . kh . h . sh . | kh . h . sh . h . kh . h . sh . | kh . h . sh . h . kh . h . sh .",
        echo:
        ". . . . Ab4 - - - C5 - - - F5 - - - | . . Eb5 - - - C5 - - - Ab4 - - - . . | Bb4 - - - Db5 - - - F5 - - - . . F5 - | - - Db5 - - - Bb4 - - - . . Db5 - - - | " +
        "F5 - - - Ab5 - - - . . G5 - - - Bb4 - | - - Eb5 - - - . . E5 - - - G5 - - - | C5 - - - . . G5 - - - E5 - - - C5 -",
      },
    },
    order: ["A","B","A"],
  },
  // Tango Tarantula: A tango in A minor on the 3-3-2 pulse: a marcato bass, a bandoneon snapping chords
  // on two and four and a staccato violin that strikes, stops and strikes again. Listen for the sharp
  // G-sharp that leans into every A, the held pause at the end of the verse, and the major-key bridge
  // that sweeps through C and G before the E chord drags it back.
  snakeTango: {
    bpm: 112,
    rush: 10,
    voices: {
      bass: { wave: "triangle", gain: 0.92, decay: 0.05, sustain: 0.3 },
      lead: { wave: "pulse", duty: 0.25, gain: 0.34, decay: 0.05, sustain: 0.5, vibrato: { rate: 5.5, depth: 0.014, delay: 0.3 } },
      drums: { kit: true, gain: 0.58, from: 0.1 },
      stab: { wave: "pulse", duty: 0.5, gain: 0.2, from: 0.2, decay: 0.04, sustain: 0.2 },
      echo: { wave: "pulse", duty: 0.125, gain: 0.1, from: 0.7, decay: 0.04, sustain: 0.4 },
    },
    patterns: {
      A: {
        bass:
        "A2 . . E3 . . A2 . E3 . . A2 . . E3 . | A2 . . E3 . . A2 . E3 . . A2 . . E3 . | E2 . . B2 . . E2 . B2 . . E2 . . B2 . | A2 . . E3 . . A2 . E3 . . A2 . . E3 . | " +
        "D2 . . A2 . . D2 . A2 . . D2 . . A2 . | A2 . . E3 . . A2 . E3 . . A2 . . E3 . | E2 . . B2 . . E2 . B2 . . E2 . . B2 . | A2 . . E3 . . A2 . E3 . . A2 . . E3 .",
        stab:
        ". . . . A3^037 . . . . . . . A3^037 . . . | . . . . A3^037 . . . . . . . A3^037 . . . | . . . . E3^047 . . . . . . . E3^047 . . . | . . . . A3^037 . . . . . . . A3^037 . . . | " +
        ". . . . D4^037 . . . . . . . D4^037 . . . | . . . . A3^037 . . . . . . . A3^037 . . . | . . . . E3^047 . . . . . . . E3^047 . . . | . . . . A3^037 . . . . . . . A3^037 . . .",
        lead:
        "A4 - - C5 - - E5 - A5 - - - G#5 - A5 - | E5 - - D5 - - C5 - B4 - - C5 - - A4 - | G#4 - - B4 - - D5 - E5 - - D5 - - B4 - | A4 - - - - - - - C5 - B4 - A4 - G#4 - | " +
        "F5 - - A5 - - F5 - D5 - - F5 - - A4 - | C5 - - E5 - - A5 - G#5 - - E5 - - C5 - | B4 - - G#4 - - E4 - G#4 - - B4 - - E5 - | A4 - - - - - - - A4 - - - . . . .",
        drums:
        "kh . h s . . s . kh . h s . . s . | kh . h s . . s . kh . h s . . s . | kh . h s . . s . kh . h s . . s . | kh . h s . . s . kh . h s . . s . | " +
        "kh . h s . . s . kh . h s . . s . | kh . h s . . s . kh . h s . . s . | kh . h s . . s . kh . h s . . s . | kh . s s . . s . s . s s . . s .",
        echo:
        ". . . A4 - - C5 - - E5 - A5 - - - G#5 | - A5 - E5 - - D5 - - C5 - B4 - - C5 - | - A4 - G#4 - - B4 - - D5 - E5 - - D5 - | - B4 - A4 - - - - - - - C5 - B4 - A4 | " +
        "- G#4 - F5 - - A5 - - F5 - D5 - - F5 - | - A4 - C5 - - E5 - - A5 - G#5 - - E5 - | - C5 - B4 - - G#4 - - E4 - G#4 - - B4 - | - E5 - A4 - - - - - - - A4 - - - .",
      },
      B: {
        bass:
        "C3 . . G2 . . C3 . G2 . . C3 . . G2 . | G2 . . D3 . . G2 . D3 . . G2 . . D3 . | A2 . . E3 . . A2 . E3 . . A2 . . E3 . | E2 . . B2 . . E2 . B2 . . E2 . . B2 .",
        stab:
        ". . . . C4^047 . . . . . . . C4^047 . . . | . . . . G3^047 . . . . . . . G3^047 . . . | . . . . A3^037 . . . . . . . A3^037 . . . | . . . . E3^047 . . . . . . . E3^047 . . .",
        lead:
        "G5 - - E5 - - C5 - E5 - - G5 - - E5 - | B4 - - D5 - - G5 - B5 - - G5 - - D5 - | C5 - - E5 - - A5 - E5 - - C5 - - A4 - | G#4 - - B4 - - E5 - G#5 - - - E5 - - -",
        drums:
        "kh . h s . . s . kh . h s . . s . | kh . h s . . s . kh . h s . . s . | kh . h s . . s . kh . h s . . s . | kh . s s . . s . s . s s . . s .",
        echo:
        ". . . G5 - - E5 - - C5 - E5 - - G5 - | - E5 - B4 - - D5 - - G5 - B5 - - G5 - | - D5 - C5 - - E5 - - A5 - E5 - - C5 - | - A4 - G#4 - - B4 - - E5 - G#5 - - - E5",
      },
    },
    order: ["A","B","A"],
  },
  // Raga Rush: A raga rush in D bhairav: a tanpura drone shimmering underneath, a sitar sliding up the
  // scale with the flat second and sharp third that give bhairav its edge, and a tabla keeping a
  // sixteen-beat theka. Listen for the sitar climbing D, E-flat, F-sharp, G, A in the first bar, the
  // long pause on the dark C-sharp, and the bridge that races the same climb at double speed.
  snakeRaga: {
    bpm: 126,
    rush: 10,
    voices: {
      bass: { wave: "sine", gain: 0.5, decay: 0.4, sustain: 0.9 },
      drone: { wave: "triangle", gain: 0.3, from: 0, decay: 0.4, sustain: 0.7 },
      sitar: { wave: "pulse", duty: 0.125, gain: 0.34, decay: 0.12, sustain: 0.35, vibrato: { rate: 6, depth: 0.022, delay: 0.1 } },
      drums: { kit: true, gain: 0.5, from: 0.1 },
      echo: { wave: "pulse", duty: 0.125, gain: 0.12, from: 0.55, decay: 0.08, sustain: 0.2 },
    },
    patterns: {
      A: {
        drone:
        "D3 . . . A3 . . . D4 . . . D3 . . . | D3 . . . A3 . . . D4 . . . D3 . . . | D3 . . . A3 . . . D4 . . . D3 . . . | D3 . . . A3 . . . D4 . . . D3 . . . | " +
        "D3 . . . A3 . . . D4 . . . D3 . . . | D3 . . . A3 . . . D4 . . . D3 . . . | D3 . . . A3 . . . D4 . . . D3 . . . | D3 . . . A3 . . . D4 . . . D3 . . .",
        bass:
        "D2 - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - - | " +
        "D2 - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - -",
        sitar:
        "D5 - Eb5 - F#5 - G5 - A5 - - - G5 - F#5 - | Eb5 - D5 - C#5 - D5 - F#5 - - - Eb5 - D5 - | A5 - Bb5 - A5 - G5 - F#5 - G5 - F#5 - Eb5 - | D5 - - - C#5 - D5 - A4 - - - D5 - - - | " +
        "D5 - Eb5 - F#5 - G5 - A5 - - - G5 - F#5 - | A5 - Bb5 - A5 - G5 - F#5 - G5 - F#5 - Eb5 - | Eb5 - D5 - C#5 - D5 - F#5 - - - Eb5 - D5 - | D5 - - - C#5 - D5 - A4 - - - D5 - - -",
        drums:
        "ks k k ks ks k k ks ks h h s s k k ks | ks k k ks ks k k ks ks h h s s k k ks | ks k k ks ks k k ks ks h h s s k k ks | ks k k ks ks k k ks ks h h s s k k ks | " +
        "ks k k ks ks k k ks ks h h s s k k ks | ks k k ks ks k k ks ks h h s s k k ks | ks k k ks ks k k ks ks h h s s k k ks | ks k k ks ks k k ks ks h h s s k k ks",
        echo:
        ". . . . D5 - Eb5 - F#5 - G5 - A5 - - - | G5 - F#5 - Eb5 - D5 - C#5 - D5 - F#5 - - - | Eb5 - D5 - A5 - Bb5 - A5 - G5 - F#5 - G5 - | F#5 - Eb5 - D5 - - - C#5 - D5 - A4 - - - | " +
        "D5 - - - D5 - Eb5 - F#5 - G5 - A5 - - - | G5 - F#5 - A5 - Bb5 - A5 - G5 - F#5 - G5 - | F#5 - Eb5 - Eb5 - D5 - C#5 - D5 - F#5 - - - | Eb5 - D5 - D5 - - - C#5 - D5 - A4 - - -",
      },
      B: {
        drone:
        "D3 . . . A3 . . . D4 . . . D3 . . . | D3 . . . A3 . . . D4 . . . D3 . . . | D3 . . . A3 . . . D4 . . . D3 . . . | D3 . . . A3 . . . D4 . . . D3 . . .",
        bass:
        "D2 - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - -",
        sitar:
        "D5 Eb5 F#5 G5 A5 G5 F#5 Eb5 D5 Eb5 F#5 G5 A5 Bb5 A5 G5 | F#5 G5 A5 Bb5 A5 G5 F#5 Eb5 D5 C#5 D5 Eb5 D5 - D5 - | D5 Eb5 F#5 G5 A5 G5 F#5 Eb5 D5 Eb5 F#5 G5 A5 Bb5 A5 G5 | D5 - - - C#5 - D5 - A4 - - - D5 - - -",
        drums:
        "ks k k ks ks k k ks ks h h s s k k ks | ks k k ks ks k k ks ks h h s s k k ks | ks k k ks ks k k ks ks h h s s k k ks | ks k k ks ks k k ks ks h h s s k k ks",
        echo:
        ". . . . D5 Eb5 F#5 G5 A5 G5 F#5 Eb5 D5 Eb5 F#5 G5 | A5 Bb5 A5 G5 F#5 G5 A5 Bb5 A5 G5 F#5 Eb5 D5 C#5 D5 Eb5 | D5 - D5 - D5 Eb5 F#5 G5 A5 G5 F#5 Eb5 D5 Eb5 F#5 G5 | A5 Bb5 A5 G5 D5 - - - C#5 - D5 - A4 - - -",
      },
    },
    order: ["A","B","A"],
  },
  // Oasis Sama'i: An Arabic sama'i in E hijaz, ten beats to the bar in groups of three, two, two and
  // three: an oud plucking around the E, a nay flute winding through the augmented second between F and
  // G-sharp, and a darbuka that dances through the long rhythm. Listen for the nay sliding E, F, G-sharp
  // in the first bar, the long fall to D-sharp, and the bridge where the oud moves down to A.
  snakeSamai: {
    bpm: 100,
    rush: 8,
    bar: 20,
    voices: {
      oud: { wave: "pulse", duty: 0.25, gain: 0.5, decay: 0.08, sustain: 0.2 },
      nay: { wave: "pulse", duty: 0.125, gain: 0.3, decay: 0.1, sustain: 0.75, vibrato: { rate: 5.5, depth: 0.02, delay: 0.15 } },
      drone: { wave: "sine", gain: 0.26, from: 0.15, decay: 0.3, sustain: 0.9 },
      drums: { kit: true, gain: 0.56, from: 0.1 },
      low: { wave: "triangle", gain: 0.28, from: 0.5, decay: 0.1, sustain: 0.8 },
      echo: { wave: "pulse", duty: 0.125, gain: 0.1, from: 0.6, decay: 0.05, sustain: 0.3 },
    },
    patterns: {
      A: {
        oud:
        "E2 . . . . . E2 . . . F2 . . . E2 . G#2 . . . | E2 . . . . . E2 . . . F2 . . . E2 . G#2 . . . | E2 . . . . . E2 . . . F2 . . . E2 . G#2 . . . | E2 . . . . . E2 . . . F2 . . . E2 . G#2 . . .",
        nay:
        "E5 - - - F5 - G#5 - - - A5 - - - G#5 - F5 - E5 - | B5 - - - A5 - G#5 - - - F5 - - - E5 - - - D#5 - | E5 - F5 - G#5 - A5 - B5 - A5 - - - G#5 - F5 - E5 - | E5 - - - - - B4 - - - E5 - - - E5 - - - - -",
        drone:
        "E3 - - - - - - - - - - - - - - - - - - - | E3 - - - - - - - - - - - - - - - - - - - | E3 - - - - - - - - - - - - - - - - - - - | E3 - - - - - - - - - - - - - - - - - - -",
        drums:
        "k . h . h . s . h . s . h . k . h . h . | k . h . h . s . h . s . h . k . h . h . | k . h . h . s . h . s . h . k . h . h . | k . s . s . s . s . s . s . k . s . s .",
        low:
        "E4 - - - F4 - G#4 - - - A4 - - - G#4 - F4 - E4 - | B4 - - - A4 - G#4 - - - F4 - - - E4 - - - D#4 - | E4 - F4 - G#4 - A4 - B4 - A4 - - - G#4 - F4 - E4 - | E4 - - - - - B3 - - - E4 - - - E4 - - - - -",
        echo:
        ". . . . E5 - - - F5 - G#5 - - - A5 - | - - G#5 - F5 - E5 - B5 - - - A5 - G#5 - | - - F5 - - - E5 - - - D#5 - E5 - F5 - | G#5 - A5 - B5 - A5 - - - G#5 - F5 - E5 - | " +
        "E5 - - - - - B4 - - - E5 - - - E5 -",
      },
      B: {
        oud:
        "A1 . . . . . A1 . . . B1 . . . A1 . C2 . . . | A1 . . . . . A1 . . . B1 . . . A1 . C2 . . . | E2 . . . . . E2 . . . F2 . . . E2 . G#2 . . . | E2 . . . . . E2 . . . F2 . . . E2 . G#2 . . .",
        nay:
        "A5 - - - G#5 - F5 - - - E5 - - - F5 - G#5 - A5 - | B5 - - - A5 - G#5 - - - A5 - - - B5 - - - A5 - | G#5 - A5 - B5 - A5 - G#5 - F5 - - - E5 - F5 - G#5 - | E5 - - - - - B4 - - - E5 - - - E5 - - - - -",
        drone:
        "E3 - - - - - - - - - - - - - - - - - - - | E3 - - - - - - - - - - - - - - - - - - - | E3 - - - - - - - - - - - - - - - - - - - | E3 - - - - - - - - - - - - - - - - - - -",
        drums:
        "k . h . h . s . h . s . h . k . h . h . | k . h . h . s . h . s . h . k . h . h . | k . h . h . s . h . s . h . k . h . h . | k . s . s . s . s . s . s . k . s . s .",
        low:
        "A4 - - - G#4 - F4 - - - E4 - - - F4 - G#4 - A4 - | B4 - - - A4 - G#4 - - - A4 - - - B4 - - - A4 - | G#4 - A4 - B4 - A4 - G#4 - F4 - - - E4 - F4 - G#4 - | E4 - - - - - B3 - - - E4 - - - E4 - - - - -",
        echo:
        ". . . . A5 - - - G#5 - F5 - - - E5 - | - - F5 - G#5 - A5 - B5 - - - A5 - G#5 - | - - A5 - - - B5 - - - A5 - G#5 - A5 - | B5 - A5 - G#5 - F5 - - - E5 - F5 - G#5 - | " +
        "E5 - - - - - B4 - - - E5 - - - E5 -",
      },
    },
    order: ["A","A","B","A"],
  },
  // Bouzouki Blaze: A Greek dance in A harmonic minor: a bouzouki picking every note twice in a
  // shimmering tremolo, a bass that booms on the beat and a drum that drives it forward. Listen for the
  // raised G-sharp that bites into every A, the climb to the high B over the E chord, and the bridge
  // that brightens to C major before the dark returns.
  snakeBouzouki: {
    bpm: 124,
    rush: 10,
    voices: {
      bass: { wave: "triangle", gain: 0.9, decay: 0.05, sustain: 0.3 },
      lead: { wave: "pulse", duty: 0.125, gain: 0.32, decay: 0.05, sustain: 0.5 },
      drums: { kit: true, gain: 0.6, from: 0.1 },
      low: { wave: "triangle", gain: 0.3, from: 0.4, decay: 0.1, sustain: 0.8 },
      echo: { wave: "pulse", duty: 0.125, gain: 0.1, from: 0.7, decay: 0.04, sustain: 0.4 },
    },
    patterns: {
      A: {
        bass:
        "A2 . . . E3 . . . A2 . . . E3 . . . | A2 . . . E3 . . . A2 . . . E3 . . . | E2 . . . B2 . . . E2 . . . B2 . . . | A2 . . . E3 . . . A2 . . . E3 . . . | " +
        "D2 . . . A2 . . . D2 . . . A2 . . . | A2 . . . E3 . . . A2 . . . E3 . . . | E2 . . . B2 . . . E2 . . . B2 . . . | A2 . . . E3 . . . A2 . . . E3 . . .",
        lead:
        "A4 A4 C5 C5 E5 E5 A5 A5 G#5 G#5 E5 E5 C5 C5 A4 A4 | B4 B4 C5 C5 D5 D5 E5 E5 F5 F5 E5 E5 C5 C5 B4 B4 | G#4 G#4 B4 B4 E5 E5 G#5 G#5 B5 B5 G#5 G#5 E5 E5 B4 B4 | A4 A4 C5 C5 A4 A4 E4 E4 A4 A4 . . . . . . | " +
        "D5 D5 F5 F5 A5 A5 F5 F5 D5 D5 F5 F5 A4 A4 D5 D5 | C5 C5 E5 E5 A5 A5 E5 E5 C5 C5 E5 E5 A4 A4 C5 C5 | B4 B4 G#4 G#4 E4 E4 G#4 G#4 B4 B4 E5 E5 G#5 G#5 B5 B5 | A5 A5 E5 E5 C5 C5 A4 A4 A4 A4 . . . . . .",
        drums:
        "k . h . s . h . k . h . s . h h | k . h . s . h . k . h . s . h h | k . h . s . h . k . h . s . h h | k . h . s . h . k . h . s . h h | " +
        "k . h . s . h . k . h . s . h h | k . h . s . h . k . h . s . h h | k . h . s . h . k . h . s . h h | k . h . s . h . s s s s s s s s",
        low:
        "A3 A3 C4 C4 E4 E4 A4 A4 G#4 G#4 E4 E4 C4 C4 A3 A3 | B3 B3 C4 C4 D4 D4 E4 E4 F4 F4 E4 E4 C4 C4 B3 B3 | G#3 G#3 B3 B3 E4 E4 G#4 G#4 B4 B4 G#4 G#4 E4 E4 B3 B3 | A3 A3 C4 C4 A3 A3 E3 E3 A3 A3 . . . . . . | " +
        "D4 D4 F4 F4 A4 A4 F4 F4 D4 D4 F4 F4 A3 A3 D4 D4 | C4 C4 E4 E4 A4 A4 E4 E4 C4 C4 E4 E4 A3 A3 C4 C4 | B3 B3 G#3 G#3 E3 E3 G#3 G#3 B3 B3 E4 E4 G#4 G#4 B4 B4 | A4 A4 E4 E4 C4 C4 A3 A3 A3 A3 . . . . . .",
        echo:
        ". . . . A4 A4 C5 C5 E5 E5 A5 A5 G#5 G#5 E5 E5 | C5 C5 A4 A4 B4 B4 C5 C5 D5 D5 E5 E5 F5 F5 E5 E5 | C5 C5 B4 B4 G#4 G#4 B4 B4 E5 E5 G#5 G#5 B5 B5 G#5 G#5 | E5 E5 B4 B4 A4 A4 C5 C5 A4 A4 E4 E4 A4 A4 . . | " +
        ". . . . D5 D5 F5 F5 A5 A5 F5 F5 D5 D5 F5 F5 | A4 A4 D5 D5 C5 C5 E5 E5 A5 A5 E5 E5 C5 C5 E5 E5 | A4 A4 C5 C5 B4 B4 G#4 G#4 E4 E4 G#4 G#4 B4 B4 E5 E5 | G#5 G#5 B5 B5 A5 A5 E5 E5 C5 C5 A4 A4 A4 A4 . .",
      },
      B: {
        bass:
        "C3 . . . G2 . . . C3 . . . G2 . . . | G2 . . . D3 . . . G2 . . . D3 . . . | D2 . . . A2 . . . D2 . . . A2 . . . | E2 . . . B2 . . . E2 . . . B2 . . .",
        lead:
        "E5 E5 G5 G5 C6 C6 G5 G5 E5 E5 C5 C5 E5 E5 G5 G5 | D5 D5 G5 G5 B5 B5 G5 G5 D5 D5 B4 B4 G4 G4 B4 B4 | D5 D5 F5 F5 A5 A5 F5 F5 D5 D5 F5 F5 A4 A4 D5 D5 | G#4 G#4 B4 B4 E5 E5 G#5 G#5 B5 B5 G#5 G#5 E5 E5 B4 B4",
        drums:
        "k . h . s . h . k . h . s . h h | k . h . s . h . k . h . s . h h | k . h . s . h . k . h . s . h h | k . h . s . h . s s s s s s s s",
        low:
        "E4 E4 G4 G4 C5 C5 G4 G4 E4 E4 C4 C4 E4 E4 G4 G4 | D4 D4 G4 G4 B4 B4 G4 G4 D4 D4 B3 B3 G3 G3 B3 B3 | D4 D4 F4 F4 A4 A4 F4 F4 D4 D4 F4 F4 A3 A3 D4 D4 | G#3 G#3 B3 B3 E4 E4 G#4 G#4 B4 B4 G#4 G#4 E4 E4 B3 B3",
        echo:
        ". . . . E5 E5 G5 G5 C6 C6 G5 G5 E5 E5 C5 C5 | E5 E5 G5 G5 D5 D5 G5 G5 B5 B5 G5 G5 D5 D5 B4 B4 | G4 G4 B4 B4 D5 D5 F5 F5 A5 A5 F5 F5 D5 D5 F5 F5 | A4 A4 D5 D5 G#4 G#4 B4 B4 E5 E5 G#5 G#5 B5 B5 G#5 G#5",
      },
    },
    order: ["A","B","A"],
  },
  // Solea Sunrise: A solea over the twelve-beat flamenco compas, accented on three, six, eight, ten and
  // twelve: a guitar rolling up and down each chord of the Andalusian cadence, hand claps landing on the
  // accents and a picado lead running down every chord. Listen for the claps skipping the beats that are
  // not accented, the G-sharp that turns the E chord into a cliff, and the bridge that races through D
  // minor.
  snakeSolea: {
    bpm: 160,
    rush: 8,
    bar: 24,
    voices: {
      bass: { wave: "triangle", gain: 0.88, decay: 0.07, sustain: 0.4 },
      lead: { wave: "pulse", duty: 0.25, gain: 0.32, decay: 0.07, sustain: 0.6, vibrato: { rate: 6, depth: 0.012, delay: 0.2 } },
      guitar: { wave: "pulse", duty: 0.125, gain: 0.22, from: 0.1, decay: 0.05, sustain: 0.2 },
      drums: { kit: true, gain: 0.56, from: 0.1 },
      low: { wave: "triangle", gain: 0.3, from: 0.5, decay: 0.1, sustain: 0.8 },
      echo: { wave: "pulse", duty: 0.125, gain: 0.1, from: 0.6, decay: 0.05, sustain: 0.3 },
    },
    patterns: {
      A: {
        bass:
        "A2 . . . E3 . . . . . A2 . . . E3 . . . A2 . . . E3 . | G2 . . . D3 . . . . . G2 . . . D3 . . . G2 . . . D3 . | F2 . . . C3 . . . . . F2 . . . C3 . . . F2 . . . C3 . | E2 . . . B2 . . . . . E2 . . . B2 . . . E2 . . . B2 . | " +
        "A2 . . . E3 . . . . . A2 . . . E3 . . . A2 . . . E3 . | G2 . . . D3 . . . . . G2 . . . D3 . . . G2 . . . D3 . | F2 . . . C3 . . . . . F2 . . . C3 . . . F2 . . . C3 . | E2 . . . B2 . . . . . E2 . . . B2 . . . E2 . . . B2 .",
        guitar:
        "A3 C4 E4 A4 E4 C4 A3 C4 E4 A4 E4 C4 A3 C4 E4 A4 E4 C4 A3 C4 E4 A4 E4 C4 | G3 B3 D4 G4 D4 B3 G3 B3 D4 G4 D4 B3 G3 B3 D4 G4 D4 B3 G3 B3 D4 G4 D4 B3 | F3 A3 C4 F4 C4 A3 F3 A3 C4 F4 C4 A3 F3 A3 C4 F4 C4 A3 F3 A3 C4 F4 C4 A3 | E3 G#3 B3 E4 B3 G#3 E3 G#3 B3 E4 B3 G#3 E3 G#3 B3 E4 B3 G#3 E3 G#3 B3 E4 B3 G#3 | " +
        "A3 C4 E4 A4 E4 C4 A3 C4 E4 A4 E4 C4 A3 C4 E4 A4 E4 C4 A3 C4 E4 A4 E4 C4 | G3 B3 D4 G4 D4 B3 G3 B3 D4 G4 D4 B3 G3 B3 D4 G4 D4 B3 G3 B3 D4 G4 D4 B3 | F3 A3 C4 F4 C4 A3 F3 A3 C4 F4 C4 A3 F3 A3 C4 F4 C4 A3 F3 A3 C4 F4 C4 A3 | E3 G#3 B3 E4 B3 G#3 E3 G#3 B3 E4 B3 G#3 E3 G#3 B3 E4 B3 G#3 E3 G#3 B3 E4 B3 G#3",
        lead:
        "A5 - G5 - E5 - C5 - E5 - A5 - G5 - E5 - C5 - E5 - A4 - - - | G5 - F5 - D5 - B4 - D5 - G5 - F5 - D5 - B4 - D5 - G4 - - - | F5 - E5 - C5 - A4 - C5 - F5 - E5 - C5 - A4 - C5 - F4 - - - | E5 - F5 - E5 - D5 - B4 - G#4 - B4 - E5 - G#5 - B5 - - - . . | " +
        "E5 - A5 - C6 - B5 - A5 - G5 - E5 - C5 - A4 - - - - - - - | D5 - G5 - B5 - A5 - G5 - F5 - D5 - B4 - G4 - - - - - - - | C5 - F5 - A5 - G5 - F5 - E5 - C5 - A4 - F4 - - - - - - - | B4 - E5 - G#5 - F5 - E5 - D5 - B4 - G#4 - E4 - - - - - - -",
        drums:
        "kh . . . s . . . . . s . . . s . . . s . . . s . | kh . . . s . . . . . s . . . s . . . s . . . s . | kh . . . s . . . . . s . . . s . . . s . . . s . | kh . . . s . . . . . s . . . s . . . s . . . s . | " +
        "kh . . . s . . . . . s . . . s . . . s . . . s . | kh . . . s . . . . . s . . . s . . . s . . . s . | kh . . . s . . . . . s . . . s . . . s . . . s . | kh . . . s . s . s . s . k . s . s . s . s . s .",
        low:
        "A4 - G4 - E4 - C4 - E4 - A4 - G4 - E4 - C4 - E4 - A3 - - - | G4 - F4 - D4 - B3 - D4 - G4 - F4 - D4 - B3 - D4 - G3 - - - | F4 - E4 - C4 - A3 - C4 - F4 - E4 - C4 - A3 - C4 - F3 - - - | E4 - F4 - E4 - D4 - B3 - G#3 - B3 - E4 - G#4 - B4 - - - . . | " +
        "E4 - A4 - C5 - B4 - A4 - G4 - E4 - C4 - A3 - - - - - - - | D4 - G4 - B4 - A4 - G4 - F4 - D4 - B3 - G3 - - - - - - - | C4 - F4 - A4 - G4 - F4 - E4 - C4 - A3 - F3 - - - - - - - | B3 - E4 - G#4 - F4 - E4 - D4 - B3 - G#3 - E3 - - - - - - -",
        echo:
        ". . . . A5 - G5 - E5 - C5 - E5 - A5 - | G5 - E5 - C5 - E5 - A4 - - - G5 - F5 - | D5 - B4 - D5 - G5 - F5 - D5 - B4 - D5 - | G4 - - - F5 - E5 - C5 - A4 - C5 - F5 - | " +
        "E5 - C5 - A4 - C5 - F4 - - - E5 - F5 - | E5 - D5 - B4 - G#4 - B4 - E5 - G#5 - B5 - | - - . . E5 - A5 - C6 - B5 - A5 - G5 - | E5 - C5 - A4 - - - - - - - D5 - G5 - | " +
        "B5 - A5 - G5 - F5 - D5 - B4 - G4 - - - | - - - - C5 - F5 - A5 - G5 - F5 - E5 - | C5 - A4 - F4 - - - - - - - B4 - E5 - | G#5 - F5 - E5 - D5 - B4 - G#4 - E4 - - -",
      },
      B: {
        bass:
        "D2 . . . A2 . . . . . D2 . . . A2 . . . D2 . . . A2 . | E2 . . . B2 . . . . . E2 . . . B2 . . . E2 . . . B2 . | A2 . . . E3 . . . . . A2 . . . E3 . . . A2 . . . E3 . | E2 . . . B2 . . . . . E2 . . . B2 . . . E2 . . . B2 .",
        guitar:
        "D3 F3 A3 D4 A3 F3 D3 F3 A3 D4 A3 F3 D3 F3 A3 D4 A3 F3 D3 F3 A3 D4 A3 F3 | E3 G#3 B3 E4 B3 G#3 E3 G#3 B3 E4 B3 G#3 E3 G#3 B3 E4 B3 G#3 E3 G#3 B3 E4 B3 G#3 | A3 C4 E4 A4 E4 C4 A3 C4 E4 A4 E4 C4 A3 C4 E4 A4 E4 C4 A3 C4 E4 A4 E4 C4 | E3 G#3 B3 E4 B3 G#3 E3 G#3 B3 E4 B3 G#3 E3 G#3 B3 E4 B3 G#3 E3 G#3 B3 E4 B3 G#3",
        lead:
        "F5 - - A5 - - F5 - D5 - - F5 - - A4 - - - D5 - - - - - | G#5 - - B5 - - G#5 - E5 - - G#5 - - B4 - - - E5 - - - - - | C5 - - E5 - - A5 - E5 - - C5 - - A4 - - - A4 - - - - - | G#5 - - B5 - - G#5 - E5 - - G#5 - - B4 - - - E5 - - - - -",
        drums:
        "kh . . . s . . . . . s . . . s . . . s . . . s . | kh . . . s . . . . . s . . . s . . . s . . . s . | kh . . . s . . . . . s . . . s . . . s . . . s . | kh . . . s . s . s . s . k . s . s . s . s . s .",
        low:
        "F4 - - A4 - - F4 - D4 - - F4 - - A3 - - - D4 - - - - - | G#4 - - B4 - - G#4 - E4 - - G#4 - - B3 - - - E4 - - - - - | C4 - - E4 - - A4 - E4 - - C4 - - A3 - - - A3 - - - - - | G#4 - - B4 - - G#4 - E4 - - G#4 - - B3 - - - E4 - - - - -",
        echo:
        ". . . . F5 - - A5 - - F5 - D5 - - F5 | - - A4 - - - D5 - - - - - G#5 - - B5 | - - G#5 - E5 - - G#5 - - B4 - - - E5 - | - - - - C5 - - E5 - - A5 - E5 - - C5 | " +
        "- - A4 - - - A4 - - - - - G#5 - - B5 | - - G#5 - E5 - - G#5 - - B4 - - - E5 -",
      },
    },
    order: ["A","B","A"],
  },
  // Raga Lantern: A raga in the dark todi mode over jhaptal, ten beats to the bar counted
  // two-three-two-three: a tanpura drone, a tabla keeping the cycle and a sitar that climbs the flat
  // second and sharp fourth and falls back. Listen for the sitar reaching B-flat before it falls, the
  // silences after the sam on beat one, and the bridge that runs the whole climb at double speed.
  snakeLantern: {
    bpm: 120,
    rush: 10,
    bar: 20,
    voices: {
      bass: { wave: "sine", gain: 0.5, decay: 0.4, sustain: 0.9 },
      tanpura: { wave: "triangle", gain: 0.3, decay: 0.4, sustain: 0.7 },
      sitar: { wave: "pulse", duty: 0.125, gain: 0.34, decay: 0.12, sustain: 0.35, vibrato: { rate: 6, depth: 0.022, delay: 0.1 } },
      drums: { kit: true, gain: 0.52, from: 0.1 },
      low: { wave: "triangle", gain: 0.28, from: 0.5, decay: 0.1, sustain: 0.8 },
      echo: { wave: "pulse", duty: 0.125, gain: 0.12, from: 0.55, decay: 0.08, sustain: 0.2 },
    },
    patterns: {
      A: {
        tanpura:
        "D3 . . . . A3 . . . . D4 . . . . D3 . . . . | D3 . . . . A3 . . . . D4 . . . . D3 . . . . | D3 . . . . A3 . . . . D4 . . . . D3 . . . . | D3 . . . . A3 . . . . D4 . . . . D3 . . . .",
        bass:
        "D2 - - - - - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - - - - - -",
        sitar:
        "D5 - Eb5 - F5 - G#5 - A5 - - - Bb5 - A5 - G#5 - F5 - | Eb5 - D5 - C#5 - D5 - - - F5 - - - Eb5 - D5 - - - | A5 - G#5 - F5 - Eb5 - F5 - G#5 - A5 - - - F5 - D5 - | D5 - - - - - A4 - - - D5 - - - D5 - - - - -",
        drums:
        "ks . k . ks . k . k . h . h . ks . k . k . | ks . k . ks . k . k . h . h . ks . k . k . | ks . k . ks . k . k . h . h . ks . k . k . | ks . k . ks . k . k . h . h . ks . k . k .",
        low:
        "D4 - D#4 - F4 - G#4 - A4 - - - A#4 - A4 - G#4 - F4 - | D#4 - D4 - C#4 - D4 - - - F4 - - - D#4 - D4 - - - | A4 - G#4 - F4 - D#4 - F4 - G#4 - A4 - - - F4 - D4 - | D4 - - - - - A3 - - - D4 - - - D4 - - - - -",
        echo:
        ". . . . D5 - Eb5 - F5 - G#5 - A5 - - - | Bb5 - A5 - G#5 - F5 - Eb5 - D5 - C#5 - D5 - | - - F5 - - - Eb5 - D5 - - - A5 - G#5 - | F5 - Eb5 - F5 - G#5 - A5 - - - F5 - D5 - | " +
        "D5 - - - - - A4 - - - D5 - - - D5 -",
      },
      B: {
        tanpura:
        "D3 . . . . A3 . . . . D4 . . . . D3 . . . . | D3 . . . . A3 . . . . D4 . . . . D3 . . . . | D3 . . . . A3 . . . . D4 . . . . D3 . . . . | D3 . . . . A3 . . . . D4 . . . . D3 . . . .",
        bass:
        "D2 - - - - - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - - - - - -",
        sitar:
        "D5 Eb5 F5 G#5 A5 Bb5 A5 G#5 F5 Eb5 D5 Eb5 F5 G#5 A5 - F5 - D5 - | G#5 A5 Bb5 A5 G#5 F5 Eb5 D5 C#5 D5 Eb5 D5 C#5 - D5 - D5 - - - | D5 Eb5 F5 G#5 A5 Bb5 A5 G#5 F5 Eb5 D5 Eb5 F5 G#5 A5 - F5 - D5 - | D5 - - - - - A4 - - - D5 - - - D5 - - - - -",
        drums:
        "ks . k . ks . k . k . h . h . ks . k . k . | ks . k . ks . k . k . h . h . ks . k . k . | ks . k . ks . k . k . h . h . ks . k . k . | ks . k . ks . k . k . h . h . ks . k . k .",
        low:
        "D4 D#4 F4 G#4 A4 A#4 A4 G#4 F4 D#4 D4 D#4 F4 G#4 A4 - F4 - D4 - | G#4 A4 A#4 A4 G#4 F4 D#4 D4 C#4 D4 D#4 D4 C#4 - D4 - D4 - - - | D4 D#4 F4 G#4 A4 A#4 A4 G#4 F4 D#4 D4 D#4 F4 G#4 A4 - F4 - D4 - | D4 - - - - - A3 - - - D4 - - - D4 - - - - -",
        echo:
        ". . . . D5 Eb5 F5 G#5 A5 Bb5 A5 G#5 F5 Eb5 D5 Eb5 | F5 G#5 A5 - F5 - D5 - G#5 A5 Bb5 A5 G#5 F5 Eb5 D5 | C#5 D5 Eb5 D5 C#5 - D5 - D5 - - - D5 Eb5 F5 G#5 | A5 Bb5 A5 G#5 F5 Eb5 D5 Eb5 F5 G#5 A5 - F5 - D5 - | " +
        "D5 - - - - - A4 - - - D5 - - - D5 -",
      },
    },
    order: ["A","A","B","A"],
  },
};
