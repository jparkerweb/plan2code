// Plan2Code Web Console - ghoul: The Drowned Lantern's own sound effects, merged into ghoul-sfx.js; defines only.
//
// Same shape and rules as ghoul-sfx-hearse.js: `tones` (a `ghoulLantern<Act>` sound for each thing the
// round does, built from the house tone layers, none over 1.2 s with its delay), `hums` (the held sounds the
// room asks for through lanternHums in ghoul-lantern.js: the Lurker near, Mother awake) and `music` (the
// room's theme, `ghoulLanternTheme`, named in ROOM_MUSIC in ghoul.js, the user's pick, Tiptoe plucks).
// Every hunter is heard before it reaches you: the Lurker's groan when it hears you and the rising
// hiss as it lines up its dash, the leeches' dry skitter, the wisps' thin chime, the bog bodies' wet boil, and
// Mother's low thrum as her hand's shadow falls. First drafts, to be picked by ear later. A name may be
// defined only once across tones.js and every game's file. No imports.

export const LANTERN_SFX = {
  tones: {
    // Step: a board creaking underfoot, the sound the Lurker listens for.
    ghoulLanternStep: {
      layers: [
        { type: "triangle", from: 190, to: 150, seconds: 0.09, attack: 0.01, gain: 0.35, vibrato: { rate: 30, depth: 0.08 } },
        { type: "brown", seconds: 0.08, attack: 0, gain: 0.3, filter: { type: "lowpass", from: 900, to: 300, q: 2 } },
      ],
    },
    // Flare: the lantern blazes up, a whoomp and a bright hiss.
    ghoulLanternFlare: {
      layers: [
        { type: "noise", seconds: 0.12, attack: 0, gain: 0.6, filter: { type: "highpass", from: 2200, to: 900 } },
        { type: "sine", from: 160, to: 70, seconds: 0.26, attack: 0, gain: 0.7 },
        { type: "noise", seconds: 0.7, attack: 0.04, gain: 0.3, filter: { type: "bandpass", from: 3400, to: 1800, q: 1 } },
      ],
    },
    // Sputter: no oil for a flare, a weak cough of flame.
    ghoulLanternSputter: {
      layers: [
        { type: "noise", seconds: 0.08, attack: 0, gain: 0.35, filter: { type: "bandpass", from: 1200, to: 600, q: 2 } },
        { type: "noise", seconds: 0.08, delay: 0.12, attack: 0, gain: 0.25, filter: { type: "bandpass", from: 1000, to: 500, q: 2 } },
      ],
    },
    // Pop: a wisp bursts, a small bright pop and a falling whistle.
    ghoulLanternPop: {
      layers: [
        { type: "sine", from: 1500, to: 400, seconds: 0.16, attack: 0, gain: 0.4 },
        { type: "noise", seconds: 0.07, attack: 0, gain: 0.45, filter: { type: "highpass", from: 3000, to: 2000 } },
      ],
    },
    // Shrine: a wisp shrine takes the flame, a rising three-note chime.
    ghoulLanternShrine: {
      layers: [
        { type: "triangle", from: 660, to: 660, seconds: 0.2, attack: 0, gain: 0.4 },
        { type: "triangle", from: 880, to: 880, seconds: 0.2, delay: 0.12, attack: 0, gain: 0.4 },
        { type: "triangle", from: 1320, to: 1320, seconds: 0.5, delay: 0.24, attack: 0, gain: 0.42 },
      ],
    },
    // Gutter: the oil is out, the flame shrinks with a choke and a sigh.
    ghoulLanternGutter: {
      layers: [
        { type: "sawtooth", from: 220, to: 70, seconds: 0.6, attack: 0.02, gain: 0.3, filter: { type: "lowpass", from: 1200, to: 200, q: 2 } },
        { type: "noise", seconds: 0.5, attack: 0.05, gain: 0.3, filter: { type: "lowpass", from: 1400, to: 300, q: 1 } },
      ],
    },
    // Catch: a hunter has you, a thump, a splash and a drop in the flame.
    ghoulLanternCatch: {
      layers: [
        { type: "sine", from: 150, to: 45, seconds: 0.3, attack: 0, gain: 0.8 },
        { type: "noise", seconds: 0.4, attack: 0.02, gain: 0.5, filter: { type: "bandpass", from: 1600, to: 400, q: 1.2 } },
        { type: "brown", seconds: 0.5, attack: 0.04, gain: 0.5, filter: { type: "lowpass", from: 500, to: 120, q: 1 } },
      ],
    },
    // Finish: into the boat and away, a bright run of notes.
    ghoulLanternFinish: {
      layers: [
        { type: "triangle", from: 523, to: 523, seconds: 0.18, attack: 0, gain: 0.4 },
        { type: "triangle", from: 659, to: 659, seconds: 0.18, delay: 0.14, attack: 0, gain: 0.4 },
        { type: "triangle", from: 784, to: 784, seconds: 0.18, delay: 0.28, attack: 0, gain: 0.4 },
        { type: "triangle", from: 1047, to: 1047, seconds: 0.6, delay: 0.42, attack: 0, gain: 0.45 },
      ],
    },
    // Meet: a hunter's rule shown for the first time, a soft low sting.
    ghoulLanternMeet: {
      layers: [
        { type: "sine", from: 311, to: 311, seconds: 0.5, attack: 0.02, gain: 0.3 },
        { type: "sine", from: 440, to: 440, seconds: 0.5, attack: 0.02, gain: 0.22 },
      ],
    },
    // Close: a dash or a slam that just missed, a quick rushing whoosh.
    ghoulLanternClose: {
      layers: [
        { type: "noise", seconds: 0.3, attack: 0.05, gain: 0.45, filter: { type: "bandpass", from: 600, to: 2400, q: 1.5 } },
        { type: "sine", from: 700, to: 1100, seconds: 0.2, delay: 0.1, attack: 0.02, gain: 0.2 },
      ],
    },
    // The Bog Lurker hears you: a low bubbling groan under the water.
    ghoulLanternLurker: {
      layers: [
        { type: "sawtooth", from: 46, to: 62, seconds: 0.9, attack: 0.2, gain: 0.6, vibrato: { rate: 7, depth: 0.14 }, filter: { type: "lowpass", from: 220, to: 480, q: 4 } },
        { type: "brown", seconds: 0.8, attack: 0.1, gain: 0.5, filter: { type: "lowpass", from: 600, to: 160, q: 1 } },
      ],
    },
    // It lines up its dash: a rising hiss and a growl, the cue to get off the lane.
    ghoulLanternAim: {
      layers: [
        { type: "noise", seconds: 0.75, attack: 0.5, gain: 0.45, filter: { type: "bandpass", from: 800, to: 3200, q: 2 } },
        { type: "sawtooth", from: 70, to: 110, seconds: 0.75, attack: 0.2, gain: 0.4, filter: { type: "lowpass", from: 300, to: 700, q: 3 } },
      ],
    },
    // The dash: a surge of water and a snap of jaws.
    ghoulLanternDash: {
      layers: [
        { type: "noise", seconds: 0.35, attack: 0, gain: 0.6, filter: { type: "lowpass", from: 2400, to: 500, q: 1 } },
        { type: "square", from: 140, to: 60, seconds: 0.08, delay: 0.18, attack: 0, gain: 0.45, filter: { type: "lowpass", from: 1600, to: 600, q: 1 } },
      ],
    },
    // The leeches: a dry rapid skitter, like many small things on wet wood.
    ghoulLanternLeech: {
      layers: [
        { type: "noise", seconds: 0.5, attack: 0.02, gain: 0.5, filter: { type: "bandpass", from: 5200, to: 3600, q: 4 } },
        { type: "noise", seconds: 0.4, delay: 0.12, attack: 0.02, gain: 0.35, filter: { type: "bandpass", from: 3000, to: 4400, q: 3 } },
      ],
    },
    // The wisps: a thin whistling chime that wavers.
    ghoulLanternWisp: {
      layers: [
        { type: "sine", from: 1760, to: 1480, seconds: 0.8, attack: 0.1, gain: 0.22, vibrato: { rate: 9, depth: 0.06 } },
        { type: "sine", from: 2640, to: 2220, seconds: 0.7, delay: 0.1, attack: 0.1, gain: 0.12, vibrato: { rate: 11, depth: 0.05 } },
      ],
    },
    // A bog body stirs: a wet boil, a slow slurp and a gasp of marsh gas.
    ghoulLanternBody: {
      layers: [
        { type: "brown", seconds: 0.7, attack: 0.1, gain: 0.7, filter: { type: "lowpass", from: 300, to: 900, q: 2 } },
        { type: "sine", from: 120, to: 240, seconds: 0.5, attack: 0.05, gain: 0.4 },
        { type: "noise", seconds: 0.25, delay: 0.5, attack: 0.04, gain: 0.25, filter: { type: "bandpass", from: 700, to: 1500, q: 1.5 } },
      ],
    },
    // Mother stirs (the third shrine): a held low chord that swells.
    ghoulLanternWake: {
      layers: [
        { type: "sawtooth", from: 55, to: 58, seconds: 1.1, attack: 0.5, gain: 0.5, filter: { type: "lowpass", from: 260, to: 520, q: 3 } },
        { type: "sawtooth", from: 58, to: 62, seconds: 1.1, attack: 0.5, gain: 0.4, filter: { type: "lowpass", from: 260, to: 520, q: 3 } },
        { type: "sine", from: 800, to: 760, seconds: 0.9, delay: 0.2, attack: 0.3, gain: 0.12 },
      ],
    },
    // She rises (the fifth): water pouring off her, a long gurgling roar.
    ghoulLanternRise: {
      layers: [
        { type: "brown", seconds: 1.1, attack: 0.1, gain: 0.8, filter: { type: "lowpass", from: 300, to: 1400, q: 1.5 } },
        { type: "sawtooth", from: 40, to: 72, seconds: 1.1, attack: 0.15, gain: 0.5, vibrato: { rate: 5, depth: 0.12 }, filter: { type: "lowpass", from: 300, to: 700, q: 3 } },
        { type: "noise", seconds: 0.8, delay: 0.3, attack: 0.1, gain: 0.3, filter: { type: "bandpass", from: 500, to: 1800, q: 1 } },
      ],
    },
    // Her hand's shadow falls: a low thrum from under the water.
    ghoulLanternHand: {
      layers: [
        { type: "sine", from: 58, to: 52, seconds: 0.7, attack: 0.15, gain: 0.6 },
        { type: "triangle", from: 116, to: 104, seconds: 0.6, attack: 0.15, gain: 0.25 },
      ],
    },
    // The slam: a huge wet slap on the water.
    ghoulLanternSlam: {
      layers: [
        { type: "sine", from: 110, to: 35, seconds: 0.35, attack: 0, gain: 0.85 },
        { type: "noise", seconds: 0.5, attack: 0, gain: 0.6, filter: { type: "lowpass", from: 2600, to: 400, q: 1 } },
        { type: "brown", seconds: 0.7, delay: 0.08, attack: 0.05, gain: 0.45, filter: { type: "lowpass", from: 700, to: 150, q: 1 } },
      ],
    },
  },
  hums: {
    // The Lurker close: a low bubbling growl under the water, louder and higher as it closes and hunts.
    ghoulLanternLurk: { parts: [{ type: "sawtooth", freq: 48 }, { type: "square", freq: 24, gain: 0.4 }], noise: { color: "brown", gain: 0.5 }, filter: { type: "lowpass", freq: 300, q: 4, follow: 0.8 }, pulse: { rate: 3, depth: 0.5 }, peak: 0.035 },
    // Mother awake: a deep slow breath from the pool, a held dread under everything once she has risen.
    ghoulLanternMother: { parts: [{ type: "sawtooth", freq: 36 }, { type: "sine", freq: 54, gain: 0.5 }], noise: { color: "brown", gain: 0.3 }, filter: { type: "lowpass", freq: 220, q: 2, follow: 0.5 }, pulse: { rate: 0.5, depth: 0.6 }, peak: 0.04 },
  },
  music: {
    // The Drowned Lantern: tiptoe plucks. A sparse stealth tiptoe: dry
    // marimba plucks that stop and start, a soft footfall kick, a creeping
    // triangle bass and a few pluck plinks in the gaps. The footfalls double
    // in the sour third part; a high plink and a snap join only near full
    // dread.
    ghoulLanternTheme: {
      bpm: 88,
      rush: 20,
      voices: {
        marimba: { wave: "triangle", gain: 0.3, decay: 0.03, sustain: 0.05 },
        pluck: { wave: "pulse", duty: 0.25, gain: 0.08, decay: 0.03, sustain: 0.15, from: 0.4 },
        bass: { wave: "triangle", gain: 0.4, decay: 0.06, sustain: 0.5 },
        foot: { kit: true, gain: 0.14, from: 0.3 },
        tick: { kit: true, gain: 0.06, from: 0.5 },
        plink: { wave: "sine", gain: 0.05, decay: 0.05, sustain: 0.1, from: 0.85 },
        snap: { kit: true, gain: 0.12, from: 0.85 },
      },
      patterns: {
        A: {
          marimba:
          "A3 - . . . . E4 - . . C5 - . . . . | F3 - . . . . C4 - . . A4 - . . . . | " +
          "D3 - . . . . A3 - . . F4 - . . . . | E3 - . . . . G#4 - . . B4 - . . E5 .",
          pluck:
          ". . . . C5 . . . . . . . . E5 . . | . . . . . . . C5 . . . . . C5 . . | " +
          ". . . . D5 . . . . . . . . A4 . . | . . . . . . . G#5 . . . . . B4 . .",
          bass:
          "A2 - . . . . E3 . A2 - . . . . A2 . | F2 - . . . . C3 . F2 - . . . . F2 . | " +
          "D2 - . . . . A2 . D2 - . . . . D2 . | E2 - . . . . B2 . E2 - . . . . G#2 .",
          foot:
          "k . . . . . . . k . . . . . . . | k . . . . . . . k . . . . . . . | " +
          "k . . . . . . . k . . . . . . . | k . . . . . . . k . . . . . . .",
          tick:
          ". . . . h . . . . . . . h . . . | . . . . h . . . . . . . h . . . | " +
          ". . . . h . . . . . . . h . . . | . . . . h . . . . . . . h . . .",
          plink:
          ". . . E7 . . . . . . . . . . . . | . . . . . . . . . C7 . . . . . . | " +
          ". . . A6 . . . . . . . . . . . . | . . . . . . . . . B6 . . . . . .",
          snap:
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . . | " +
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . .",
        },
        B: {
          marimba:
          "D3 - . . . . A3 - . . F4 - . A4 . . | A3 - . . . . E4 - . . C5 - . E5 . . | " +
          "F3 - . . . . C4 - . . A4 - . C5 . . | E3 - . . . . G#4 - . . B4 - . . E5 .",
          pluck:
          ". . . . F4 . . . . . . . . A4 . . | . . . . . . . E5 . . . . . E5 . . | " +
          ". . . . F5 . . . . . . . . C5 . . | . . . . . . . G#5 . . . . . B4 . .",
          bass:
          "D2 - . . . . A2 . D2 - . . . . D2 . | A2 - . . . . E3 . A2 - . . . . A2 . | " +
          "F2 - . . . . C3 . F2 - . . . . F2 . | E2 - . . . . B2 . E2 - . . . . G#2 .",
          foot:
          "k . . . . . . . k . . . . . . . | k . . . . . . . k . . . . . . . | " +
          "k . . . . . . . k . . . . . . . | k . . . . . . . k . . . . . . .",
          tick:
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h . | " +
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h .",
          plink:
          ". . . A6 . . . . . . . . . . . . | . . . . . . . . . E7 . . . . . . | " +
          ". . . C7 . . . . . . . . . . . . | . . . . . . . . . B6 . . . . . .",
          snap:
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . . | " +
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . .",
        },
        C: {
          marimba:
          "A3 - . . . . E4 - . . C5 - . . . . | A#3 - . . . . F4 - . . D5 - . . . . | " +
          "A3 - . . . . E4 - . . C5 - . . . . | E3 - . . . . G#4 - . . B4 - . . E5 .",
          pluck:
          ". . . . C5 . . . . . . . . E5 . . | . . . . . . . F5 . . . . . F5 . . | " +
          ". . . . A5 . . . . . . . . E5 . . | . . . . . . . G#5 . . . . . B4 . .",
          bass:
          "A2 - . . . . E3 . A2 - . . . . A2 . | A#2 - . . . . F3 . A#2 - . . . . A#2 . | " +
          "A2 - . . . . E3 . A2 - . . . . A2 . | E2 - . . . . B2 . E2 - . . . . G#2 .",
          foot:
          "k . . k . . . . k . . k . . . . | k . . k . . . . k . . k . . . . | " +
          "k . . k . . . . k . . k . . . . | k . . k . . . . k . . k . . . .",
          tick:
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h . | " +
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h .",
          plink:
          ". . . E7 . . . . . . . . . . . . | . . . . . . . . . F7 . . . . . . | " +
          ". . . E7 . . . . . . . . . . . . | . . . . . . . . . B6 . . . . . .",
          snap:
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . . | " +
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . .",
        },
      },
      order: ["A", "B", "A", "C", "B"],
    },
  },
};
