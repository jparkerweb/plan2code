// Plan2Code Web Console - ghoul: the sounds for the finale's second ride, down The Bone Stair ahead of the collapse, merged into sfx/ghoul-sfx.js; defines only.
//
// Same shape and rules as rides/wagon/ghoul-sfx-wagon.js: `tones` (a `ghoulStair<Act>` sound for the
// stair's things), built from the house's tone layers (no audio files). The user's picks from the
// sound vote (prototypes/sounds/ghoul-rush/bonestair.html). `music`
// holds ghoulMarrowStair, the user's pick (Drum chase), named in ROOM_MUSIC. No tone runs over
// 1.2 s. A name may be defined only once across tones.js and every game's file. No imports.

export const BONESTAIR_SFX = {
  tones: {
    // YOU on the stair: YOU run down an endless spiral of bones with the House coming down after YOU.
    // Jumps: Hop and click.
    ghoulStairJump: {
      layers: [
        { type: "triangle", from: 380, to: 640, seconds: 0.1, attack: 0.003, gain: 0.4 },
        { type: "noise", seconds: 0.04, attack: 0.003, gain: 0.3, delay: 0.02, filter: { type: "bandpass", from: 3080, to: 2200, q: 5 } },
        { type: "triangle", from: 770, to: 550, seconds: 0.06, attack: 0.003, gain: 0.13, delay: 0.02 },
      ],
    },
    // Lands: Dry clack (in game).
    ghoulStairLand: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.45, filter: { type: "bandpass", from: 2800, to: 1800, q: 5 } },
        { type: "sine", from: 180, to: 90, seconds: 0.1, attack: 0, gain: 0.4 },
      ],
    },
    // Crash: Bones snap (in game).
    ghoulStairCrash: {
      layers: [
        { type: "sine", from: 110, to: 40, seconds: 0.25, attack: 0, gain: 0.9 },
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.7, filter: { type: "bandpass", from: 3200, to: 2200, q: 4 } },
        { type: "noise", seconds: 0.04, delay: 0.05, attack: 0, gain: 0.55, filter: { type: "bandpass", from: 2600, to: 1800, q: 4 } },
        { type: "noise", seconds: 0.04, delay: 0.1, attack: 0, gain: 0.4, filter: { type: "bandpass", from: 3600, to: 2400, q: 4 } },
      ],
    },
    // Drops through: Falling whistle (in game).
    ghoulStairDrop: {
      layers: [
        { type: "sine", from: 900, to: 160, seconds: 0.7, attack: 0.02, gain: 0.32 },
        { type: "noise", seconds: 0.6, attack: 0.1, gain: 0.25, filter: { type: "lowpass", from: 2000, to: 300, q: 1 } },
      ],
    },
    // Checkpoint: Two bells.
    ghoulStairCheck: {
      layers: [
        { type: "sine", from: 294, to: 293, seconds: 0.6, attack: 0.003, gain: 0.45 },
        { type: "sine", from: 591, to: 588, seconds: 0.36, attack: 0.003, gain: 0.18 },
        { type: "sine", from: 440, to: 438, seconds: 0.6, attack: 0.003, gain: 0.32, delay: 0.2 },
        { type: "sine", from: 884, to: 880, seconds: 0.36, attack: 0.003, gain: 0.13, delay: 0.2 },
      ],
    },
    // Round the column: Whoosh past (in game).
    ghoulStairTurn: {
      layers: [
        { type: "noise", seconds: 0.35, attack: 0.12, gain: 0.28, filter: { type: "bandpass", from: 500, to: 1400, q: 2 } },
      ],
    },
    // Off the last step: Air opens (in game).
    ghoulStairEdge: {
      layers: [
        { type: "noise", seconds: 1.1, attack: 0.3, gain: 0.4, filter: { type: "lowpass", from: 1800, to: 200, q: 1 } },
        { type: "sine", from: 440, to: 110, seconds: 1, attack: 0.05, gain: 0.25 },
      ],
    },
    // Onto the Pit's floor: Boom and heartbeat (in game).
    ghoulStairFinish: {
      layers: [
        { type: "sine", from: 70, to: 32, seconds: 0.7, attack: 0, gain: 1 },
        { type: "brown", seconds: 0.5, attack: 0, gain: 0.6, filter: { type: "lowpass", from: 300, to: 120, q: 1 } },
        { type: "sine", from: 55, to: 44, seconds: 0.18, delay: 0.7, attack: 0.01, gain: 0.7 },
        { type: "sine", from: 55, to: 44, seconds: 0.18, delay: 0.92, attack: 0.01, gain: 0.55 },
      ],
    },
    // Rubble close: Grinding roar (in game).
    ghoulStairClose: {
      layers: [
        { type: "brown", seconds: 0.8, attack: 0.1, gain: 0.7, filter: { type: "lowpass", from: 400, to: 900, q: 1 } },
        { type: "sawtooth", from: 55, to: 48, seconds: 0.7, attack: 0.1, gain: 0.25, filter: { type: "lowpass", from: 300, to: 300, q: 1 } },
      ],
    },
    // Caught: Landslide over YOU (in game).
    ghoulStairCatch: {
      layers: [
        { type: "sine", from: 80, to: 30, seconds: 0.6, attack: 0, gain: 1 },
        { type: "brown", seconds: 0.9, attack: 0, gain: 0.8, filter: { type: "lowpass", from: 900, to: 200, q: 1 } },
        { type: "noise", seconds: 0.08, delay: 0.1, attack: 0, gain: 0.5, filter: { type: "bandpass", from: 1500, to: 900, q: 3 } },
        { type: "noise", seconds: 0.08, delay: 0.3, attack: 0, gain: 0.4, filter: { type: "bandpass", from: 1200, to: 700, q: 3 } },
      ],
    },
    // Treads give way: Cracking chain (in game).
    ghoulStairRot: {
      layers: [
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.5, filter: { type: "bandpass", from: 3000, to: 2000, q: 5 } },
        { type: "noise", seconds: 0.04, delay: 0.09, attack: 0, gain: 0.45, filter: { type: "bandpass", from: 2600, to: 1700, q: 5 } },
        { type: "noise", seconds: 0.04, delay: 0.17, attack: 0, gain: 0.4, filter: { type: "bandpass", from: 2300, to: 1500, q: 5 } },
        { type: "noise", seconds: 0.04, delay: 0.24, attack: 0, gain: 0.35, filter: { type: "bandpass", from: 2000, to: 1300, q: 5 } },
        { type: "brown", seconds: 0.5, delay: 0.1, attack: 0.1, gain: 0.35, filter: { type: "lowpass", from: 500, to: 200, q: 1 } },
      ],
    },
    // Skeleton: A skeleton pulls itself up over the treads and climbs the stair at YOU; two bolts knock it apart.
    // Rises: Rattle and hiss (in game).
    ghoulStairRise: {
      layers: [
        { type: "noise", seconds: 0.5, attack: 0.05, gain: 0.35, filter: { type: "bandpass", from: 3200, to: 2400, q: 6 } },
        { type: "square", from: 140, to: 120, seconds: 0.45, attack: 0.02, gain: 0.08, vibrato: { rate: 28, depth: 0.3 }, filter: { type: "bandpass", from: 900, to: 700, q: 3 } },
      ],
    },
    // Hit: Crack (in game).
    ghoulStairSkelHit: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.5, filter: { type: "bandpass", from: 3400, to: 2600, q: 5 } },
        { type: "triangle", from: 900, to: 600, seconds: 0.08, attack: 0, gain: 0.2 },
      ],
    },
    // Knocked apart: Clattering down (in game).
    ghoulStairSkelDown: {
      layers: [
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.5, filter: { type: "bandpass", from: 3000, to: 2200, q: 5 } },
        { type: "noise", seconds: 0.04, delay: 0.08, attack: 0, gain: 0.45, filter: { type: "bandpass", from: 2400, to: 1800, q: 5 } },
        { type: "noise", seconds: 0.04, delay: 0.15, attack: 0, gain: 0.4, filter: { type: "bandpass", from: 2800, to: 2000, q: 5 } },
        { type: "noise", seconds: 0.04, delay: 0.24, attack: 0, gain: 0.3, filter: { type: "bandpass", from: 2100, to: 1500, q: 5 } },
        { type: "triangle", from: 660, to: 330, seconds: 0.3, attack: 0, gain: 0.15 },
      ],
    },
    // Bone hand: A hand of bones creeps up over the rail's edge and grabs across the tread at YOUR ankles.
    // Reaches (the warning): Fingers tapping (in game).
    ghoulStairReach: {
      layers: [
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.35, filter: { type: "bandpass", from: 3600, to: 3000, q: 6 } },
        { type: "noise", seconds: 0.03, delay: 0.12, attack: 0, gain: 0.35, filter: { type: "bandpass", from: 3400, to: 2800, q: 6 } },
        { type: "noise", seconds: 0.03, delay: 0.24, attack: 0, gain: 0.35, filter: { type: "bandpass", from: 3200, to: 2600, q: 6 } },
        { type: "sine", from: 200, to: 260, seconds: 0.5, attack: 0.2, gain: 0.12 },
      ],
    },
    // Grabs: Snap shut (in game).
    ghoulStairGrab: {
      layers: [
        { type: "noise", seconds: 0.06, attack: 0, gain: 0.6, filter: { type: "bandpass", from: 2200, to: 1400, q: 4 } },
        { type: "sine", from: 160, to: 70, seconds: 0.18, attack: 0, gain: 0.5 },
      ],
    },
    // Falling masonry: Blocks of the House come loose overhead: a shadow, a creak, a crack, then the block lands on the stair.
    // Creaks (warning one): Long creak (in game).
    ghoulStairCreak: {
      layers: [
        { type: "sawtooth", from: 180, to: 120, seconds: 0.6, attack: 0.08, gain: 0.18, vibrato: { rate: 14, depth: 0.12 }, filter: { type: "bandpass", from: 700, to: 500, q: 5 } },
        { type: "noise", seconds: 0.5, attack: 0.2, gain: 0.15, filter: { type: "bandpass", from: 1800, to: 1200, q: 3 } },
      ],
    },
    // Cracks (warning two): Sharp crack (in game).
    ghoulStairCrack: {
      layers: [
        { type: "noise", seconds: 0.07, attack: 0, gain: 0.65, filter: { type: "bandpass", from: 2400, to: 1200, q: 3 } },
        { type: "sine", from: 300, to: 120, seconds: 0.12, attack: 0, gain: 0.3 },
      ],
    },
    // Lands: Thud and grit (in game).
    ghoulStairThud: {
      layers: [
        { type: "sine", from: 90, to: 34, seconds: 0.35, attack: 0, gain: 1 },
        { type: "brown", seconds: 0.3, attack: 0, gain: 0.6, filter: { type: "lowpass", from: 600, to: 200, q: 1 } },
        { type: "noise", seconds: 0.3, delay: 0.05, attack: 0.05, gain: 0.2, filter: { type: "bandpass", from: 2500, to: 1500, q: 2 } },
      ],
    },
  },
  music: {
    // The Bone Stair: drum chase. An action-movie chase built on the drums: a hard kick and snare drive from bar one,
    // brass blasting the heartbeat (low-low, rest) with a pickup run into each new chord, and string chords stabbing
    // on the off beats. The runs join in eighths in the second part and in sixteenths in the third, with crashes on
    // each downbeat; near full dread a siren climbs a semitone a bar.
    ghoulMarrowStair: {
      bpm: 170,
      rush: 14,
      voices: {
        drums: { kit: true, gain: 0.24 },
        brass: { wave: "square", gain: 0.12, decay: 0.05, sustain: 0.6 },
        stab: { wave: "sawtooth", gain: 0.06, decay: 0.02, sustain: 0.2, from: 0.1 },
        runs: { wave: "sawtooth", gain: 0.07, decay: 0.03, sustain: 0.7, from: 0.2, vibrato: { rate: 6, depth: 0.006, delay: 0.1 } },
        crash: { kit: true, gain: 0.08, from: 0.5 },
        siren: { wave: "triangle", gain: 0.06, decay: 0.05, sustain: 0.9, from: 0.85, vibrato: { rate: 5, depth: 0.03 } },
      },
      patterns: {
        A: {
          drums:
          "k . k . s . . h k . k . s . h h | k . k . s . . h k . k . s . h h | " +
          "k . k . s . . h k . k . s . h h | k . k . s . . h k . k . s . h h",
          brass:
          "D2 . D2 . . . . . D2 . D2 . . . . . | Bb1 . Bb1 . . . . . Bb1 . Bb1 . . . . . | " +
          "G1 . G1 . . . . . G1 . G1 . . . . . | A1 . A1 . . . . . A1 . A1 . C#2 E2 G2 A2",
          stab:
          ". . D4^37 . . . D4^37 . . . D4^37 . . . D4^37 . | . . D4^4 . . . D4^4 . . . D4^4 . . . D4^4 . | " +
          ". . D4^5 . . . D4^5 . . . D4^5 . . . D4^5 . | . . C#4^37 . . . C#4^37 . . . C#4^37 . . . C#4^37 .",
          runs:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          crash:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          siren:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
        },
        B: {
          drums:
          "k h k h s h h h k h k h s h s h | k h k h s h h h k h k h s h s h | " +
          "k h k h s h h h k h k h s h s h | k h k h s h h h k h k h s h s h",
          brass:
          "D2 . D2 . . . . . D2 . D2 . . . . . | Bb1 . Bb1 . . . . . Bb1 . Bb1 . . . . . | " +
          "G1 . G1 . . . . . G1 . G1 . . . . . | A1 . A1 . . . . . A1 . A1 . C#2 E2 G2 A2",
          stab:
          ". . D4^37 . . . D4^37 . . . D4^37 . . . D4^37 . | . . D4^4 . . . D4^4 . . . D4^4 . . . D4^4 . | " +
          ". . D4^5 . . . D4^5 . . . D4^5 . . . D4^5 . | . . C#4^37 . . . C#4^37 . . . C#4^37 . . . C#4^37 .",
          runs:
          "D6 - C6 - Bb5 - A5 - G5 - F5 - E5 - D5 - | Bb5 - A5 - G5 - F5 - E5 - D5 - C5 - Bb4 - | " +
          "G5 - F5 - E5 - D5 - C#5 - Bb4 - A4 - G4 - | E5 - D5 - C#5 - Bb4 - A4 - G4 - F4 - E4 -",
          crash:
          "o . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          "o . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          siren:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
        },
        C: {
          drums:
          "ks h k h s h k h ks h k h s s s s | ks h k h s h k h ks h k h s s s s | " +
          "ks h k h s h k h ks h k h s s s s | ks h k h s h k h ks h k h s s s s",
          brass:
          "D2 . D2 . F2 . A2 . D2 . D2 . C2 . A1 . | Bb1 . Bb1 . D2 . F2 . Bb1 . Bb1 . A1 . F1 . | " +
          "G1 . G1 . Bb1 . D2 . G1 . G1 . F1 . D1 . | A1 . A1 . C#2 . E2 . A1 . A1 . C#2 E2 G2 A2",
          stab:
          ". D4^37 . D4^37 . D4^37 . D4^37 . D4^37 . D4^37 . D4^37 . D4^37 | . D4^4 . D4^4 . D4^4 . D4^4 . D4^4 . D4^4 . D4^4 . D4^4 | " +
          ". D4^5 . D4^5 . D4^5 . D4^5 . D4^5 . D4^5 . D4^5 . D4^5 | . C#4^37 . C#4^37 . C#4^37 . C#4^37 . C#4^37 . C#4^37 . C#4^37 . C#4^37",
          runs:
          "D6 C#6 Bb5 A5 G5 F5 E5 D5 C#5 Bb4 A4 G4 F4 E4 D4 C#4 | Bb5 A5 G5 F5 E5 D5 C#5 Bb4 A4 G4 F4 E4 D4 C#4 Bb3 A3 | " +
          "G5 F5 E5 D5 C#5 Bb4 A4 G4 F4 E4 D4 C#4 Bb3 A3 G3 F3 | E6 D6 C#6 Bb5 A5 G5 F5 E5 D5 C#5 Bb4 A4 G4 F4 E4 D4",
          crash:
          "o . . . . . . . . . . . . . . . | o . . . . . . . . . . . . . . . | " +
          "o . . . . . . . . . . . . . . . | o . . . . . . . o . . . . . . .",
          siren:
          "A5 - - - - - - - - - - - - - - - | Bb5 - - - - - - - - - - - - - - - | " +
          "B5 - - - - - - - - - - - - - - - | C#6 - - - - - - - - - - - - - - -",
        },
      },
      order: ["A", "B", "B", "C", "C"],
    },
  },
};
