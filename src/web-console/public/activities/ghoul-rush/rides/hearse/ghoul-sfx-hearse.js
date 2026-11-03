// Plan2Code Web Console - ghoul: The Midnight Hearse's own sound effects and music track, merged into ghoul-sfx.js; defines only.
//
// Same shape and rules as ghoul-sfx-sled.js: `tones` (a `ghoulHearse<Act>` sound for the
// hearse's things, built from the house tone layers, none over 1.2 s with its delay) and
// `music` (the room's track, `ghoulHearseRide`, named in ROOM_MUSIC in ghoul.js: a
// funeral march at a gallop, built from four-bar parts the way the sled's is). Both are
// first drafts, to be picked by ear later. A name may be defined only once across
// tones.js and every game's file. No imports (the little helpers below are local).

const bars = (...b) => b.join(" | ");
// The gallop under the march: a root on the beat's off steps, the horses' hoofbeat that no horse is making.
const gallop = (n) => `${n} . ${n} ${n} . ${n} ${n} . ${n} . ${n} ${n} . ${n} ${n} .`;
const FLOOR = "k . . . k . . . k . . . k . . .";
const OFFBEAT = ". . h . . . h . . . h . . . h .";
const SNAP = ". . . . s . . . . . . . s . . .";
// One toll of a bell on the first step of a bar.
const toll = (n) => `${n} . . . . . . . . . . . . . . .`;

export const HEARSE_SFX = {
  tones: {
    // The midnight hearse: the bonus ride along the cemetery road, jumping, ducking, switching lanes and shooting.
    // Jumps: the engine roars and the coffins lift.
    ghoulHearseJump: {
      layers: [
        { type: "sawtooth", from: 90, to: 240, seconds: 0.26, attack: 0.04, gain: 0.3, filter: { type: "lowpass", from: 500, to: 1800, q: 2 } },
        { type: "noise", seconds: 0.2, attack: 0.07, gain: 0.3, filter: { type: "bandpass", from: 400, to: 1800, q: 1.5 } },
      ],
    },
    // Lands: a thud and the coffins rattling.
    ghoulHearseLand: {
      layers: [
        { type: "sine", from: 110, to: 46, seconds: 0.16, attack: 0, gain: 0.8 },
        { type: "brown", seconds: 0.12, attack: 0, gain: 0.5, filter: { type: "lowpass", from: 300, to: 200, q: 1 } },
        { type: "square", from: 420, to: 380, seconds: 0.02, gain: 0.14, delay: 0.06 },
        { type: "square", from: 520, to: 470, seconds: 0.02, gain: 0.14, delay: 0.1 },
        { type: "square", from: 360, to: 330, seconds: 0.02, gain: 0.14, delay: 0.15 },
      ],
    },
    // Ducks: a quick swish under the branch.
    ghoulHearseDuck: {
      layers: [
        { type: "noise", seconds: 0.18, attack: 0.06, gain: 0.5, filter: { type: "bandpass", from: 500, to: 2400, q: 1.5 } },
      ],
    },
    // Switches lane: two bumps over the curb.
    ghoulHearseSwitch: {
      layers: [
        { type: "sine", from: 170, to: 80, seconds: 0.1, attack: 0, gain: 0.7 },
        { type: "noise", seconds: 0.14, attack: 0.03, gain: 0.3, filter: { type: "bandpass", from: 800, to: 2000, q: 2 } },
        { type: "sine", from: 150, to: 70, seconds: 0.12, attack: 0, gain: 0.6, delay: 0.17 },
      ],
    },
    // Crash: wood, iron and a coffin lid.
    ghoulHearseCrash: {
      layers: [
        { type: "sine", from: 92, to: 30, seconds: 0.3, attack: 0, gain: 1 },
        { type: "brown", seconds: 0.25, attack: 0, gain: 0.8, filter: { type: "lowpass", from: 260, to: 220, q: 1 } },
        { type: "noise", seconds: 0.4, attack: 0.12, gain: 0.4, delay: 0.03, filter: { type: "bandpass", from: 900, to: 3200, q: 2 } },
        { type: "square", from: 300, to: 160, seconds: 0.1, gain: 0.2, delay: 0.08 },
        { type: "square", from: 240, to: 120, seconds: 0.1, gain: 0.2, delay: 0.18 },
      ],
    },
    // Checkpoint: a single bell.
    ghoulHearseCheck: {
      layers: [
        { type: "sine", from: 523, to: 520, seconds: 0.6, attack: 0.003, gain: 0.34 },
        { type: "sine", from: 1047, to: 1040, seconds: 0.4, attack: 0.003, gain: 0.14 },
        { type: "sine", from: 784, to: 780, seconds: 0.5, attack: 0.003, gain: 0.22, delay: 0.1 },
      ],
    },
    // The finish: brakes squealing, then a toll.
    ghoulHearseFinish: {
      layers: [
        { type: "sawtooth", from: 1100, to: 380, seconds: 0.6, attack: 0.03, gain: 0.16, vibrato: { rate: 18, depth: 0.04 }, filter: { type: "bandpass", from: 1800, to: 900, q: 3 } },
        { type: "noise", seconds: 0.55, attack: 0.1, gain: 0.3, filter: { type: "bandpass", from: 1500, to: 600, q: 2 } },
        { type: "sine", from: 196, to: 192, seconds: 0.6, attack: 0.003, gain: 0.5, delay: 0.5 },
      ],
    },
    // A hand stirs in the grave mound: earth shifting.
    ghoulHearseHandWarn: {
      layers: [
        { type: "brown", seconds: 0.4, attack: 0.15, gain: 0.5, filter: { type: "lowpass", from: 200, to: 420, q: 1 } },
        { type: "sine", from: 70, to: 90, seconds: 0.4, attack: 0.1, gain: 0.3 },
      ],
    },
    // The hand reaches up: clawing dirt.
    ghoulHearseHandUp: {
      layers: [
        { type: "noise", seconds: 0.3, attack: 0.1, gain: 0.45, filter: { type: "bandpass", from: 500, to: 2600, q: 2 } },
        { type: "square", from: 110, to: 200, seconds: 0.2, gain: 0.16 },
      ],
    },
    // A hit on the hand: a dull smack.
    ghoulHearseHandHit: {
      layers: [
        { type: "sine", from: 300, to: 190, seconds: 0.09, attack: 0, gain: 0.5 },
        { type: "noise", seconds: 0.08, attack: 0, gain: 0.35, filter: { type: "bandpass", from: 1200, to: 900, q: 3 } },
      ],
    },
    // The hand breaks: bone and dirt.
    ghoulHearseHandBreak: {
      layers: [
        { type: "noise", seconds: 0.3, attack: 0, gain: 0.55, filter: { type: "bandpass", from: 2400, to: 700, q: 2 } },
        { type: "sine", from: 210, to: 70, seconds: 0.25, attack: 0, gain: 0.6 },
        { type: "square", from: 700, to: 300, seconds: 0.05, gain: 0.14, delay: 0.04 },
      ],
    },
    // A crow takes wing: two caws and the flap.
    ghoulHearseCrowWake: {
      layers: [
        { type: "sawtooth", from: 900, to: 520, seconds: 0.16, attack: 0.01, gain: 0.26, filter: { type: "bandpass", from: 1100, to: 800, q: 3 } },
        { type: "sawtooth", from: 800, to: 460, seconds: 0.18, attack: 0.01, gain: 0.26, delay: 0.2, filter: { type: "bandpass", from: 1000, to: 700, q: 3 } },
        { type: "noise", seconds: 0.35, attack: 0.1, gain: 0.2, delay: 0.1, filter: { type: "bandpass", from: 3000, to: 1500, q: 4 } },
      ],
    },
    // A crow shot: a puff of feathers.
    ghoulHearseCrowHit: {
      layers: [
        { type: "noise", seconds: 0.2, attack: 0.02, gain: 0.4, filter: { type: "bandpass", from: 3400, to: 1800, q: 2 } },
        { type: "sine", from: 520, to: 240, seconds: 0.12, attack: 0, gain: 0.4 },
      ],
    },
    // A lantern taken: glass chimes.
    ghoulHearseLantern: {
      layers: [
        { type: "sine", from: 1568, to: 1560, seconds: 0.3, attack: 0.002, gain: 0.3 },
        { type: "sine", from: 2093, to: 2085, seconds: 0.3, attack: 0.002, gain: 0.22, delay: 0.06 },
        { type: "sine", from: 2637, to: 2625, seconds: 0.24, attack: 0.002, gain: 0.14, delay: 0.12 },
      ],
    },
    // The lamp goes out: a sigh down into the dark.
    ghoulHearseLampOut: {
      layers: [
        { type: "sine", from: 440, to: 96, seconds: 0.7, attack: 0.01, gain: 0.45 },
        { type: "brown", seconds: 0.5, attack: 0.1, gain: 0.5, filter: { type: "lowpass", from: 500, to: 120, q: 1 } },
      ],
    },
    // The lamp lit again: a whump of flame.
    ghoulHearseLampLit: {
      layers: [
        { type: "sine", from: 220, to: 660, seconds: 0.3, attack: 0.02, gain: 0.4 },
        { type: "noise", seconds: 0.25, attack: 0.08, gain: 0.3, filter: { type: "bandpass", from: 1800, to: 4200, q: 2 } },
      ],
    },
    // A coffin flies out of the back: a whoosh, then the knocks.
    ghoulHearseCoffin: {
      layers: [
        { type: "noise", seconds: 0.5, attack: 0.2, gain: 0.35, filter: { type: "bandpass", from: 300, to: 1500, q: 1.5 } },
        { type: "square", from: 180, to: 110, seconds: 0.08, gain: 0.2, delay: 0.4 },
        { type: "square", from: 150, to: 95, seconds: 0.08, gain: 0.2, delay: 0.52 },
      ],
    },
    // The lid pops and a ghoul sits up: a crack and a moan.
    ghoulHearseSitUp: {
      layers: [
        { type: "square", from: 160, to: 320, seconds: 0.08, gain: 0.26 },
        { type: "sine", from: 130, to: 210, seconds: 0.55, attack: 0.12, gain: 0.3, vibrato: { rate: 5, depth: 0.05 }, delay: 0.06 },
      ],
    },
    // The sat-up ghoul shot: a bony pop.
    ghoulHearseSitHit: {
      layers: [
        { type: "noise", seconds: 0.12, attack: 0, gain: 0.4, filter: { type: "bandpass", from: 2200, to: 900, q: 3 } },
        { type: "sine", from: 420, to: 150, seconds: 0.16, attack: 0, gain: 0.5 },
      ],
    },
  },
  music: {
    // The Midnight Hearse: a funeral march at a gallop. D minor: the organ says the dirge
    // (D, Bb, C, then an A major that never resolves) over a hoofbeat bass nobody is
    // making, a bell tolling each bar, four on the floor and a snap on two and four; at
    // high dread a riser and a shrill octave join. The march that cannot slow down.
    ghoulHearseRide: {
      bpm: 142,
      rush: 8,
      voices: {
        organ: { wave: "pulse", duty: 0.25, gain: 0.13, decay: 0.2, sustain: 0.7, vibrato: { rate: 5, depth: 0.012, delay: 0.2 } },
        toll: { wave: "sine", gain: 0.32, decay: 0.9, sustain: 0.15 },
        bass: { wave: "triangle", gain: 0.45, decay: 0.08, sustain: 0.5 },
        kick: { kit: true, gain: 0.28, from: 0.2 },
        hat: { kit: true, gain: 0.1, from: 0.4 },
        snap: { kit: true, gain: 0.16, from: 0.55 },
        shrill: { wave: "pulse", duty: 0.125, gain: 0.05, decay: 0.1, sustain: 0.4, from: 0.85 },
      },
      patterns: {
        A: {
          organ: bars(
            "D5 - - - F5 - - - A5 - - - F5 - D5 -",
            "Bb4 - - - D5 - - - F5 - - - D5 - Bb4 -",
            "C5 - - - E5 - - - G5 - - - E5 - C5 -",
            "A4 - - - C#5 - - - E5 - A5 - G5 - E5 -",
          ),
          toll: bars(toll("D4"), toll("Bb3"), toll("C4"), toll("A3")),
          bass: bars(gallop("D3"), gallop("Bb2"), gallop("C3"), gallop("A2")),
          kick: bars(FLOOR, FLOOR, FLOOR, FLOOR),
          hat: bars(OFFBEAT, OFFBEAT, OFFBEAT, OFFBEAT),
          snap: bars(SNAP, SNAP, SNAP, SNAP),
          shrill: bars(
            "D6 . D6 . F6 . F6 . A6 . A6 . F6 . D6 .",
            "Bb5 . Bb5 . D6 . D6 . F6 . F6 . D6 . Bb5 .",
            "C6 . C6 . E6 . E6 . G6 . G6 . E6 . C6 .",
            "A5 . A5 . C#6 . C#6 . E6 . A6 . G6 . E6 .",
          ),
        },
        B: {
          organ: bars(
            "A5 - A5 - G5 - F5 - E5 - D5 - E5 - F5 -",
            "F5 - F5 - E5 - D5 - C5 - Bb4 - C5 - D5 -",
            "E5 - E5 - D5 - C5 - Bb4 - A4 - Bb4 - C5 -",
            "A4 - C#5 - E5 - A5 - . . A5 - G5 - E5 -",
          ),
          toll: bars(toll("D4"), toll("Bb3"), toll("C4"), toll("A3")),
          bass: bars(gallop("D3"), gallop("Bb2"), gallop("C3"), gallop("A2")),
          kick: bars(FLOOR, FLOOR, FLOOR, FLOOR),
          hat: bars(OFFBEAT, OFFBEAT, OFFBEAT, OFFBEAT),
          snap: bars(SNAP, SNAP, SNAP, SNAP),
          shrill: bars(
            "A6 . A6 . G6 . F6 . E6 . D6 . E6 . F6 .",
            "F6 . F6 . E6 . D6 . C6 . Bb5 . C6 . D6 .",
            "E6 . E6 . D6 . C6 . Bb5 . A5 . Bb5 . C6 .",
            "A5 . C#6 . E6 . A6 . . . A6 . G6 . E6 .",
          ),
        },
        C: {
          organ: bars(
            "F5 - - - - - D5 - F5 - - - A5 - - -",
            "D5 - - - - - Bb4 - D5 - - - F5 - - -",
            "E5 - - - - - C5 - E5 - - - G5 - - -",
            "E5 - - - C#5 - - - A4 - - - E4 - - -",
          ),
          toll: bars(toll("D4"), toll("Bb3"), toll("C4"), toll("A3")),
          bass: bars(gallop("D3"), gallop("Bb2"), gallop("C3"), gallop("A2")),
          kick: bars(FLOOR, FLOOR, FLOOR, FLOOR),
          hat: bars(OFFBEAT, OFFBEAT, OFFBEAT, OFFBEAT),
          snap: bars(SNAP, SNAP, SNAP, SNAP),
          shrill: bars(
            "F6 . . . . . D6 . F6 . . . A6 . . .",
            "D6 . . . . . Bb5 . D6 . . . F6 . . .",
            "E6 . . . . . C6 . E6 . . . G6 . . .",
            "E6 . . . C#6 . . . A5 . . . E5 . . .",
          ),
        },
      },
      order: ["A", "A", "B", "A", "C", "B", "A", "C", "B", "A"],
    },
  },
};
