// Plan2Code Web Console - ghoul: The Bog Runner's own sound effects and music track, merged into ghoul-sfx.js; defines only.
//
// Same shape and rules as ghoul-sfx-hearse.js: `tones` (a `ghoulBogboat<Act>` sound for the
// fan boat's things, built from the house tone layers, none over 1.2 s with its delay) and
// `music` (the room's track, `ghoulBoatRide`, named in ROOM_MUSIC in ghoul.js: a drone and a
// fan's chug under a reedy line, built from four-bar parts the way the hearse's is). Both are
// first drafts, to be picked by ear later (Phase 5's pick pages). A name may be defined only
// once across tones.js and every game's file. No imports (the little helpers below are local).

const bars = (...b) => b.join(" | ");
// The fan's chug under the line: a root on the off steps, the propeller nobody is turning.
const chug = (n) => `${n} . ${n} . ${n} ${n} . ${n} ${n} . ${n} . ${n} ${n} . .`;
const FLOOR = "k . . . k . . . k . . . k . . .";
const OFFBEAT = ". . h . . . h . . . h . . . h .";
const SNAP = ". . . . s . . . . . . . s . . .";
// One slow drone note on the first step of a bar.
const drone = (n) => `${n} - - - - - - - - - - - - - - -`;

export const BOGBOAT_SFX = {
  tones: {
    // The Bog Runner: the bonus ride down the black channel, jumping, ducking, switching lanes and shooting.
    // Jumps: the fan screams up and the hull lifts clear of the water.
    ghoulBogboatJump: {
      layers: [
        { type: "sawtooth", from: 120, to: 300, seconds: 0.26, attack: 0.04, gain: 0.28, filter: { type: "lowpass", from: 600, to: 2200, q: 2 } },
        { type: "noise", seconds: 0.22, attack: 0.08, gain: 0.3, filter: { type: "bandpass", from: 600, to: 2600, q: 1.5 } },
      ],
    },
    // Lands: a flat smack on the water and a spray.
    ghoulBogboatLand: {
      layers: [
        { type: "sine", from: 130, to: 52, seconds: 0.16, attack: 0, gain: 0.7 },
        { type: "noise", seconds: 0.2, attack: 0.02, gain: 0.4, filter: { type: "bandpass", from: 1400, to: 500, q: 1.5 } },
        { type: "brown", seconds: 0.12, attack: 0, gain: 0.4, filter: { type: "lowpass", from: 300, to: 180, q: 1 } },
      ],
    },
    // Ducks: a quick swish under the limb.
    ghoulBogboatDuck: {
      layers: [
        { type: "noise", seconds: 0.18, attack: 0.06, gain: 0.45, filter: { type: "bandpass", from: 700, to: 2800, q: 1.5 } },
      ],
    },
    // Switches lane: a shudder up the mud ramp and a wet slap.
    ghoulBogboatSwitch: {
      layers: [
        { type: "sine", from: 150, to: 70, seconds: 0.12, attack: 0, gain: 0.6 },
        { type: "brown", seconds: 0.3, attack: 0.04, gain: 0.5, filter: { type: "lowpass", from: 500, to: 160, q: 1 } },
        { type: "noise", seconds: 0.16, attack: 0.03, gain: 0.25, delay: 0.14, filter: { type: "bandpass", from: 500, to: 1500, q: 2 } },
      ],
    },
    // Crash: wood, a splash and the prop catching.
    ghoulBogboatCrash: {
      layers: [
        { type: "sine", from: 98, to: 32, seconds: 0.3, attack: 0, gain: 1 },
        { type: "brown", seconds: 0.25, attack: 0, gain: 0.8, filter: { type: "lowpass", from: 260, to: 200, q: 1 } },
        { type: "noise", seconds: 0.4, attack: 0.1, gain: 0.45, delay: 0.03, filter: { type: "bandpass", from: 800, to: 3000, q: 2 } },
        { type: "square", from: 320, to: 150, seconds: 0.1, gain: 0.2, delay: 0.08 },
      ],
    },
    // Checkpoint: a single bell over the water.
    ghoulBogboatCheck: {
      layers: [
        { type: "sine", from: 587, to: 584, seconds: 0.6, attack: 0.003, gain: 0.34 },
        { type: "sine", from: 1175, to: 1168, seconds: 0.4, attack: 0.003, gain: 0.14 },
        { type: "sine", from: 880, to: 876, seconds: 0.5, attack: 0.003, gain: 0.22, delay: 0.1 },
      ],
    },
    // The finish: the fan winding down, then the pier's bell.
    ghoulBogboatFinish: {
      layers: [
        { type: "sawtooth", from: 420, to: 90, seconds: 0.7, attack: 0.03, gain: 0.2, vibrato: { rate: 14, depth: 0.05 }, filter: { type: "lowpass", from: 1400, to: 300, q: 2 } },
        { type: "noise", seconds: 0.5, attack: 0.1, gain: 0.28, filter: { type: "bandpass", from: 1400, to: 500, q: 2 } },
        { type: "sine", from: 220, to: 216, seconds: 0.6, attack: 0.003, gain: 0.5, delay: 0.5 },
      ],
    },
    // The swarm boils close behind: a rising wet churn.
    ghoulBogboatPanic: {
      layers: [
        { type: "noise", seconds: 0.6, attack: 0.25, gain: 0.4, filter: { type: "bandpass", from: 300, to: 1800, q: 3 } },
        { type: "sine", from: 70, to: 120, seconds: 0.6, attack: 0.2, gain: 0.35, vibrato: { rate: 9, depth: 0.08 } },
      ],
    },
    // The swarm has you: a snap of tiny teeth under a squelch.
    ghoulBogboatCatch: {
      layers: [
        { type: "noise", seconds: 0.35, attack: 0, gain: 0.5, filter: { type: "bandpass", from: 2800, to: 900, q: 3 } },
        { type: "sine", from: 140, to: 50, seconds: 0.3, attack: 0, gain: 0.7 },
        { type: "square", from: 900, to: 400, seconds: 0.04, gain: 0.14, delay: 0.05 },
        { type: "square", from: 800, to: 380, seconds: 0.04, gain: 0.14, delay: 0.11 },
      ],
    },
    // The fan is clogging: a labouring grind.
    ghoulBogboatClog: {
      layers: [
        { type: "sawtooth", from: 150, to: 90, seconds: 0.45, attack: 0.05, gain: 0.26, vibrato: { rate: 24, depth: 0.1 }, filter: { type: "lowpass", from: 700, to: 300, q: 2 } },
        { type: "brown", seconds: 0.4, attack: 0.1, gain: 0.4, filter: { type: "lowpass", from: 400, to: 160, q: 1 } },
      ],
    },
    // The fan stalls: a cough, a clunk and silence.
    ghoulBogboatStall: {
      layers: [
        { type: "sawtooth", from: 240, to: 40, seconds: 0.5, attack: 0.01, gain: 0.3, filter: { type: "lowpass", from: 900, to: 150, q: 2 } },
        { type: "square", from: 90, to: 60, seconds: 0.08, gain: 0.3, delay: 0.5 },
        { type: "brown", seconds: 0.3, attack: 0, gain: 0.5, delay: 0.5, filter: { type: "lowpass", from: 260, to: 120, q: 1 } },
      ],
    },
    // A gas pocket shot: a fat bubbling pop and a hiss.
    ghoulBogboatGas: {
      layers: [
        { type: "sine", from: 180, to: 520, seconds: 0.12, attack: 0, gain: 0.5 },
        { type: "noise", seconds: 0.5, attack: 0.02, gain: 0.4, filter: { type: "bandpass", from: 3200, to: 1200, q: 2 } },
        { type: "sine", from: 240, to: 600, seconds: 0.1, attack: 0, gain: 0.3, delay: 0.14 },
      ],
    },
    // A charm shot: a rattle of bone or a clink of glass.
    ghoulBogboatProp: {
      layers: [
        { type: "noise", seconds: 0.14, attack: 0, gain: 0.4, filter: { type: "bandpass", from: 3600, to: 1800, q: 3 } },
        { type: "sine", from: 1320, to: 880, seconds: 0.2, attack: 0.002, gain: 0.26 },
        { type: "sine", from: 420, to: 160, seconds: 0.14, attack: 0, gain: 0.4 },
      ],
    },
  },
  music: {
    // The Bog Runner: a fan boat at a chug through the dark. E minor: a drone under the
    // chug, a reedy pulse line that wanders around the root and flat second, four on the
    // floor and a snap on two and four; at high dread a shrill octave joins. The swarm is
    // in the water behind it.
    ghoulBoatRide: {
      bpm: 150,
      rush: 8,
      voices: {
        reed: { wave: "pulse", duty: 0.2, gain: 0.13, decay: 0.2, sustain: 0.65, vibrato: { rate: 5, depth: 0.014, delay: 0.2 } },
        drone: { wave: "sine", gain: 0.3, decay: 0.9, sustain: 0.6 },
        bass: { wave: "triangle", gain: 0.45, decay: 0.08, sustain: 0.5 },
        kick: { kit: true, gain: 0.28, from: 0.2 },
        hat: { kit: true, gain: 0.1, from: 0.4 },
        snap: { kit: true, gain: 0.16, from: 0.55 },
        shrill: { wave: "pulse", duty: 0.125, gain: 0.05, decay: 0.1, sustain: 0.4, from: 0.85 },
      },
      patterns: {
        A: {
          reed: bars(
            "E5 - - - G5 - - - B5 - - - G5 - E5 -",
            "F5 - - - A5 - - - C6 - - - A5 - F5 -",
            "E5 - - - G5 - - - B5 - D6 - B5 - G5 -",
            "F5 - E5 - D5 - E5 - . . E5 - - - - -",
          ),
          drone: bars(drone("E3"), drone("F3"), drone("E3"), drone("B2")),
          bass: bars(chug("E2"), chug("F2"), chug("E2"), chug("B1")),
          kick: bars(FLOOR, FLOOR, FLOOR, FLOOR),
          hat: bars(OFFBEAT, OFFBEAT, OFFBEAT, OFFBEAT),
          snap: bars(SNAP, SNAP, SNAP, SNAP),
          shrill: bars(
            "E6 . E6 . G6 . G6 . B6 . B6 . G6 . E6 .",
            "F6 . F6 . A6 . A6 . C7 . C7 . A6 . F6 .",
            "E6 . E6 . G6 . G6 . B6 . D7 . B6 . G6 .",
            "F6 . E6 . D6 . E6 . . . E6 . . . . .",
          ),
        },
        B: {
          reed: bars(
            "B5 - B5 - A5 - G5 - F5 - E5 - F5 - G5 -",
            "C6 - C6 - B5 - A5 - G5 - F5 - G5 - A5 -",
            "B5 - B5 - A5 - G5 - F5 - E5 - F5 - G5 -",
            "B4 - D5 - F5 - B5 - . . B5 - A5 - F5 -",
          ),
          drone: bars(drone("E3"), drone("F3"), drone("E3"), drone("B2")),
          bass: bars(chug("E2"), chug("F2"), chug("E2"), chug("B1")),
          kick: bars(FLOOR, FLOOR, FLOOR, FLOOR),
          hat: bars(OFFBEAT, OFFBEAT, OFFBEAT, OFFBEAT),
          snap: bars(SNAP, SNAP, SNAP, SNAP),
          shrill: bars(
            "B6 . B6 . A6 . G6 . F6 . E6 . F6 . G6 .",
            "C7 . C7 . B6 . A6 . G6 . F6 . G6 . A6 .",
            "B6 . B6 . A6 . G6 . F6 . E6 . F6 . G6 .",
            "B5 . D6 . F6 . B6 . . . B6 . A6 . F6 .",
          ),
        },
        C: {
          reed: bars(
            "G5 - - - - - E5 - G5 - - - B5 - - -",
            "A5 - - - - - F5 - A5 - - - C6 - - -",
            "G5 - - - - - E5 - G5 - - - B5 - - -",
            "F5 - - - D5 - - - B4 - - - E4 - - -",
          ),
          drone: bars(drone("E3"), drone("F3"), drone("E3"), drone("B2")),
          bass: bars(chug("E2"), chug("F2"), chug("E2"), chug("B1")),
          kick: bars(FLOOR, FLOOR, FLOOR, FLOOR),
          hat: bars(OFFBEAT, OFFBEAT, OFFBEAT, OFFBEAT),
          snap: bars(SNAP, SNAP, SNAP, SNAP),
          shrill: bars(
            "G6 . . . . . E6 . G6 . . . B6 . . .",
            "A6 . . . . . F6 . A6 . . . C7 . . .",
            "G6 . . . . . E6 . G6 . . . B6 . . .",
            "F6 . . . D6 . . . B5 . . . E5 . . .",
          ),
        },
      },
      order: ["A", "A", "B", "A", "C", "B", "A", "C", "B", "A"],
    },
  },
};
