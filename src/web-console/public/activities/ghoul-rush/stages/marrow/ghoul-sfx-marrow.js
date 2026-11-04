// Plan2Code Web Console - ghoul: Marrow's own sound effects, merged into ghoul-sfx.js; defines only.
//
// Same shape and rules as ghoul-sfx-bog.js: `tones` (the finale boss's `ghoulMarrow<Act>`
// sounds, none over 1.2 s with its delay). `music` holds ghoulMarrowLawn, the user's pick (Storm toccata).
// The House's voice is wood and pipes, every sound a building rather than a throat: creaks,
// hinges dropped in pitch, floorboards, glass, a pipe organ's lowest note, wind in a chimney.
// These are the user's picks from the sound vote (marrow.html). A name may be defined only
// once across tones.js and every game's file. No imports.

export const MARROW_SFX = {
  tones: {
    // Marrow, the House: The house itself, Kill I on the Front Lawn: its windows are its eyes, its door a mouth and its pickets teeth; shoot every window out. Its voice is wood and pipes, a building, not a throat.
    // Wakes: Organ chord swells.
    ghoulMarrowWake: {
      layers: [
        { type: "square", from: 33, to: 33, seconds: 1.15, attack: 0.45, gain: 0.27, filter: { type: "lowpass", from: 229, to: 131, q: 1 } },
        { type: "sine", from: 65, to: 65, seconds: 1.15, attack: 0.45, gain: 0.23 },
        { type: "square", from: 49, to: 49, seconds: 1.15, attack: 0.45, gain: 0.27, filter: { type: "lowpass", from: 343, to: 196, q: 1 } },
        { type: "sine", from: 98, to: 98, seconds: 1.15, attack: 0.45, gain: 0.23 },
        { type: "square", from: 65, to: 65, seconds: 1.15, attack: 0.45, gain: 0.27, filter: { type: "lowpass", from: 458, to: 262, q: 1 } },
        { type: "sine", from: 131, to: 131, seconds: 1.15, attack: 0.45, gain: 0.23 },
        { type: "pink", seconds: 0.3, attack: 0.04, gain: 0.14, filter: { type: "bandpass", from: 327, to: 229, q: 4 } },
        { type: "sawtooth", from: 50, to: 94, seconds: 0.8, attack: 0.04, gain: 0.3, delay: 0.3, vibrato: { rate: 16, depth: 0.12 }, filter: { type: "bandpass", from: 336, to: 630, q: 7 } },
        { type: "sawtooth", from: 34, to: 64, seconds: 0.8, attack: 0.06, gain: 0.15, delay: 0.33, vibrato: { rate: 11.2, depth: 0.08 }, filter: { type: "lowpass", from: 350, to: 280, q: 2 } },
      ],
    },
    // Hit: Draft: glass tick, wooden creak.
    ghoulMarrowHurt: {
      layers: [
        { type: "sine", from: 3520, to: 3300, seconds: 0.06, attack: 0, gain: 0.25 },
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.3, filter: { type: "highpass", from: 4200, to: 3600, q: 1 } },
        { type: "sawtooth", from: 180, to: 140, seconds: 0.22, delay: 0.03, attack: 0.02, gain: 0.3, vibrato: { rate: 24, depth: 0.08 }, filter: { type: "bandpass", from: 900, to: 600, q: 7 } },
      ],
    },
    // Dies: Organ falls apart.
    ghoulMarrowDie: {
      layers: [
        { type: "square", from: 65, to: 33, seconds: 1.15, attack: 0.03, gain: 0.3, filter: { type: "lowpass", from: 458, to: 262, q: 1 } },
        { type: "sine", from: 131, to: 65, seconds: 1.15, attack: 0.03, gain: 0.25 },
        { type: "square", from: 78, to: 39, seconds: 1.15, attack: 0.03, gain: 0.3, filter: { type: "lowpass", from: 545, to: 311, q: 1 } },
        { type: "sine", from: 156, to: 78, seconds: 1.15, attack: 0.03, gain: 0.25 },
        { type: "square", from: 98, to: 49, seconds: 1.15, attack: 0.03, gain: 0.3, filter: { type: "lowpass", from: 686, to: 392, q: 1 } },
        { type: "sine", from: 196, to: 98, seconds: 1.15, attack: 0.03, gain: 0.25 },
        { type: "pink", seconds: 0.3, attack: 0.04, gain: 0.15, filter: { type: "bandpass", from: 654, to: 458, q: 4 } },
        { type: "brown", seconds: 1.1, attack: 0.08, gain: 0.6, filter: { type: "lowpass", from: 180, to: 70, q: 1 } },
        { type: "sine", from: 48, to: 30, seconds: 1.1, attack: 0.05, gain: 0.48 },
        { type: "noise", seconds: 0.05, attack: 0.003, gain: 0.54, filter: { type: "bandpass", from: 3600, to: 2400, q: 1.5 } },
        { type: "noise", seconds: 0.4, attack: 0.003, gain: 0.3, filter: { type: "highpass", from: 6500, to: 3500, q: 1 } },
        { type: "sine", from: 4453, to: 4320, seconds: 0.07, attack: 0.003, gain: 0.12, delay: 0.21 },
      ],
    },
    // Roof shakes: Slates chattering.
    ghoulMarrowRoof: {
      layers: [
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1332, to: 1066, q: 6 } },
        { type: "square", from: 408, to: 307, seconds: 0.02, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.1, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1818, to: 1455, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.16, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1681, to: 1345, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.23, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1806, to: 1445, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.32, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1363, to: 1091, q: 6 } },
        { type: "square", from: 362, to: 313, seconds: 0.02, delay: 0.32, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.38, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1788, to: 1431, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.45, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1696, to: 1357, q: 6 } },
        { type: "brown", seconds: 0.7, attack: 0.08, gain: 0.4, filter: { type: "lowpass", from: 180, to: 70, q: 1 } },
        { type: "sine", from: 48, to: 30, seconds: 0.7, attack: 0.05, gain: 0.32 },
      ],
    },
    // Front door opens: Draft: huge hinge creak three octaves down.
    ghoulMarrowDoor: {
      layers: [
        { type: "sawtooth", from: 60, to: 95, seconds: 0.95, attack: 0.08, gain: 0.7, vibrato: { rate: 14, depth: 0.12 }, filter: { type: "bandpass", from: 300, to: 500, q: 8 } },
        { type: "sawtooth", from: 45, to: 72, seconds: 0.95, attack: 0.1, gain: 0.4, vibrato: { rate: 9, depth: 0.1 }, filter: { type: "lowpass", from: 400, to: 500, q: 3 } },
        { type: "brown", seconds: 0.9, attack: 0.1, gain: 0.3, filter: { type: "lowpass", from: 160, to: 120, q: 1 } },
        { type: "sine", from: 70, to: 40, seconds: 0.2, delay: 0.95, attack: 0, gain: 0.5 },
      ],
    },
    // Carpet rolls out: Rug unrolling flaps.
    ghoulMarrowCarpet: {
      layers: [
        { type: "sine", from: 88, to: 32, seconds: 0.25, attack: 0, gain: 0.8 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.64, filter: { type: "lowpass", from: 256, to: 256, q: 1 } },
        { type: "pink", seconds: 0.07, delay: 0.1, attack: 0.01, gain: 0.63, filter: { type: "bandpass", from: 420, to: 182, q: 1 } },
        { type: "pink", seconds: 0.07, delay: 0.2, attack: 0.01, gain: 0.42, filter: { type: "bandpass", from: 420, to: 182, q: 1 } },
        { type: "pink", seconds: 0.07, delay: 0.3, attack: 0.01, gain: 0.63, filter: { type: "bandpass", from: 420, to: 182, q: 1 } },
        { type: "pink", seconds: 0.07, delay: 0.4, attack: 0.01, gain: 0.42, filter: { type: "bandpass", from: 420, to: 182, q: 1 } },
        { type: "pink", seconds: 0.07, delay: 0.5, attack: 0.01, gain: 0.63, filter: { type: "bandpass", from: 420, to: 182, q: 1 } },
        { type: "pink", seconds: 0.07, delay: 0.6, attack: 0.01, gain: 0.42, filter: { type: "bandpass", from: 420, to: 182, q: 1 } },
      ],
    },
    // Slate lands: Draft: clay crack and thud.
    ghoulMarrowShingle: {
      layers: [
        { type: "noise", seconds: 0.07, attack: 0, gain: 0.6, filter: { type: "bandpass", from: 2400, to: 1400, q: 2 } },
        { type: "triangle", from: 900, to: 600, seconds: 0.06, attack: 0, gain: 0.25 },
        { type: "sine", from: 140, to: 60, seconds: 0.14, attack: 0, gain: 0.6 },
        { type: "brown", seconds: 0.12, attack: 0, gain: 0.5, filter: { type: "lowpass", from: 500, to: 150, q: 1 } },
      ],
    },
    // Lawn ripples: Draft: soil crackle and low rumble.
    ghoulMarrowPicketWind: {
      layers: [
        { type: "brown", seconds: 0.8, attack: 0.2, gain: 0.7, filter: { type: "lowpass", from: 120, to: 260, q: 1 } },
        { type: "sine", from: 38, to: 48, seconds: 0.8, attack: 0.2, gain: 0.5, vibrato: { rate: 6, depth: 0.1 } },
        { type: "noise", seconds: 0.7, delay: 0.1, attack: 0.15, gain: 0.25, filter: { type: "bandpass", from: 1600, to: 2600, q: 2 } },
      ],
    },
    // Picket bursts up: Stake thrust.
    ghoulMarrowPicketUp: {
      layers: [
        { type: "noise", seconds: 0.08, attack: 0.05, gain: 0.6, filter: { type: "bandpass", from: 600, to: 2400, q: 2 } },
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.8, filter: { type: "bandpass", from: 1440, to: 960, q: 2 }, delay: 0.07 },
        { type: "square", from: 720, to: 240, seconds: 0.05, attack: 0, gain: 0.32, delay: 0.07 },
        { type: "noise", seconds: 0.04, delay: 0.13, attack: 0, gain: 0.56, filter: { type: "bandpass", from: 2080, to: 1440, q: 3 } },
      ],
    },
    // Chimney coughs: Organ splutter.
    ghoulMarrowCough: {
      layers: [
        { type: "square", from: 60, to: 50, seconds: 0.08, attack: 0.003, gain: 0.5, filter: { type: "lowpass", from: 500, to: 300, q: 3 } },
        { type: "square", from: 55, to: 45, seconds: 0.08, attack: 0.003, gain: 0.5, delay: 0.1, filter: { type: "lowpass", from: 500, to: 300, q: 3 } },
        { type: "square", from: 50, to: 40, seconds: 0.08, attack: 0.003, gain: 0.5, delay: 0.2, filter: { type: "lowpass", from: 500, to: 300, q: 3 } },
        { type: "square", from: 45, to: 35, seconds: 0.08, attack: 0.003, gain: 0.5, delay: 0.34, filter: { type: "lowpass", from: 500, to: 300, q: 3 } },
        { type: "pink", seconds: 0.4, attack: 0.05, gain: 0.5, filter: { type: "bandpass", from: 500, to: 250, q: 5 } },
      ],
    },
    // Brick lands: Brick cracks.
    ghoulMarrowBrick: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 990, to: 660, q: 2 } },
        { type: "square", from: 495, to: 165, seconds: 0.05, attack: 0, gain: 0.36 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.63, filter: { type: "bandpass", from: 1430, to: 990, q: 3 } },
        { type: "sine", from: 99, to: 36, seconds: 0.25, attack: 0, gain: 0.8 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.64, filter: { type: "lowpass", from: 288, to: 288, q: 1 } },
      ],
    },
    // The dead shamble out: Doorbell, creak.
    ghoulMarrowDoormen: {
      layers: [
        { type: "sine", from: 659, to: 659, seconds: 0.4, attack: 0.003, gain: 0.5 },
        { type: "sine", from: 523, to: 523, seconds: 0.6, attack: 0.003, gain: 0.5, delay: 0.35 },
        { type: "sine", from: 1318, to: 1318, seconds: 0.2, attack: 0.003, gain: 0.12 },
        { type: "sawtooth", from: 97, to: 61, seconds: 0.4, attack: 0.04, gain: 0.36, delay: 0.7, vibrato: { rate: 16, depth: 0.12 }, filter: { type: "bandpass", from: 648, to: 405, q: 7 } },
        { type: "sawtooth", from: 66, to: 41, seconds: 0.4, attack: 0.06, gain: 0.18, delay: 0.73, vibrato: { rate: 11.2, depth: 0.08 }, filter: { type: "lowpass", from: 450, to: 360, q: 2 } },
      ],
    },
    // Rears up: Draft: long rising creak of timbers.
    ghoulMarrowRear: {
      layers: [
        { type: "sawtooth", from: 70, to: 160, seconds: 1, attack: 0.1, gain: 0.6, vibrato: { rate: 16, depth: 0.1 }, filter: { type: "bandpass", from: 400, to: 900, q: 7 } },
        { type: "sawtooth", from: 50, to: 110, seconds: 1, delay: 0.1, attack: 0.15, gain: 0.35, vibrato: { rate: 11, depth: 0.08 }, filter: { type: "lowpass", from: 400, to: 800, q: 2 } },
        { type: "brown", seconds: 1, attack: 0.3, gain: 0.35, filter: { type: "lowpass", from: 140, to: 260, q: 1 } },
      ],
    },
    // Comes down: Boom and rattling panes.
    ghoulMarrowStomp: {
      layers: [
        { type: "sine", from: 55, to: 20, seconds: 0.25, attack: 0, gain: 1 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.8, filter: { type: "lowpass", from: 160, to: 160, q: 1 } },
        { type: "brown", seconds: 1, attack: 0.08, gain: 0.8, filter: { type: "lowpass", from: 180, to: 70, q: 1 } },
        { type: "sine", from: 48, to: 30, seconds: 1, attack: 0.05, gain: 0.64 },
        { type: "noise", seconds: 0.05, attack: 0.003, gain: 0.32, delay: 0.05, filter: { type: "bandpass", from: 2880, to: 1920, q: 1.5 } },
        { type: "noise", seconds: 0.4, attack: 0.003, gain: 0.18, delay: 0.05, filter: { type: "highpass", from: 5200, to: 2800, q: 1 } },
        { type: "sine", from: 2655, to: 2575, seconds: 0.11, attack: 0.003, gain: 0.07, delay: 0.31 },
        { type: "sine", from: 2455, to: 2382, seconds: 0.1, attack: 0.003, gain: 0.06, delay: 0.1 },
        { type: "sine", from: 3075, to: 2983, seconds: 0.11, attack: 0.003, gain: 0.05, delay: 0.14 },
        { type: "sine", from: 3322, to: 3223, seconds: 0.07, attack: 0.003, gain: 0.05, delay: 0.3 },
      ],
    },
    // A window lights: Draft: soft glassy chime and hum.
    ghoulMarrowLight: {
      layers: [
        { type: "sine", from: 1568, to: 1568, seconds: 0.5, attack: 0.02, gain: 0.18 },
        { type: "sine", from: 2349, to: 2349, seconds: 0.35, delay: 0.04, attack: 0.02, gain: 0.1 },
        { type: "triangle", from: 120, to: 120, seconds: 0.45, attack: 0.05, gain: 0.15, vibrato: { rate: 13, depth: 0.03 } },
      ],
    },
    // Window shot out: Draft: glass shatter, then a falling sigh.
    ghoulMarrowWindowOut: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.8, filter: { type: "bandpass", from: 3500, to: 2500, q: 1.5 } },
        { type: "sine", from: 60, to: 35, seconds: 0.08, attack: 0, gain: 0.4 },
        { type: "noise", seconds: 0.45, attack: 0, gain: 0.55, filter: { type: "highpass", from: 6000, to: 3500, q: 1 } },
        { type: "sine", from: 3136, to: 3050, seconds: 0.12, delay: 0.02, attack: 0, gain: 0.18 },
        { type: "sine", from: 4186, to: 4100, seconds: 0.09, delay: 0.06, attack: 0, gain: 0.14 },
        { type: "sine", from: 2637, to: 2580, seconds: 0.1, delay: 0.11, attack: 0, gain: 0.14 },
        { type: "sine", from: 3729, to: 3650, seconds: 0.07, delay: 0.17, attack: 0, gain: 0.11 },
        { type: "sine", from: 4699, to: 4600, seconds: 0.06, delay: 0.24, attack: 0, gain: 0.08 },
        { type: "sine", from: 2960, to: 2900, seconds: 0.06, delay: 0.32, attack: 0, gain: 0.06 },
        { type: "pink", seconds: 0.7, delay: 0.3, attack: 0.12, gain: 0.4, filter: { type: "bandpass", from: 1200, to: 250, q: 2 } },
        { type: "sawtooth", from: 220, to: 90, seconds: 0.7, delay: 0.32, attack: 0.12, gain: 0.15, filter: { type: "lowpass", from: 700, to: 250, q: 3 } },
      ],
    },
    // Every window black: Organ sinks.
    ghoulMarrowSag: {
      layers: [
        { type: "square", from: 49, to: 29, seconds: 1.15, attack: 0.1, gain: 0.27, filter: { type: "lowpass", from: 343, to: 196, q: 1 } },
        { type: "sine", from: 98, to: 59, seconds: 1.15, attack: 0.1, gain: 0.23 },
        { type: "square", from: 58, to: 35, seconds: 1.15, attack: 0.1, gain: 0.27, filter: { type: "lowpass", from: 408, to: 233, q: 1 } },
        { type: "sine", from: 117, to: 70, seconds: 1.15, attack: 0.1, gain: 0.23 },
        { type: "square", from: 73, to: 44, seconds: 1.15, attack: 0.1, gain: 0.27, filter: { type: "lowpass", from: 514, to: 294, q: 1 } },
        { type: "sine", from: 147, to: 88, seconds: 1.15, attack: 0.1, gain: 0.23 },
        { type: "pink", seconds: 0.3, attack: 0.04, gain: 0.14, filter: { type: "bandpass", from: 490, to: 343, q: 4 } },
      ],
    },
    // A false victory: Draft: little brass fanfare in a major key.
    ghoulMarrowFalseWin: {
      layers: [
        { type: "sawtooth", from: 392, to: 392, seconds: 0.14, attack: 0.02, gain: 0.35, filter: { type: "lowpass", from: 2200, to: 1600, q: 1 } },
        { type: "sawtooth", from: 392, to: 392, seconds: 0.14, delay: 0.16, attack: 0.02, gain: 0.35, filter: { type: "lowpass", from: 2200, to: 1600, q: 1 } },
        { type: "sawtooth", from: 523, to: 523, seconds: 0.2, delay: 0.32, attack: 0.02, gain: 0.35, filter: { type: "lowpass", from: 2400, to: 1600, q: 1 } },
        { type: "sawtooth", from: 659, to: 659, seconds: 0.2, delay: 0.54, attack: 0.02, gain: 0.35, filter: { type: "lowpass", from: 2400, to: 1600, q: 1 } },
        { type: "sawtooth", from: 784, to: 784, seconds: 0.42, delay: 0.76, attack: 0.03, gain: 0.35, vibrato: { rate: 6, depth: 0.01 }, filter: { type: "lowpass", from: 2600, to: 1400, q: 1 } },
        { type: "sawtooth", from: 523, to: 523, seconds: 0.42, delay: 0.76, attack: 0.03, gain: 0.25, filter: { type: "lowpass", from: 2000, to: 1200, q: 1 } },
        { type: "sine", from: 131, to: 131, seconds: 0.42, delay: 0.76, attack: 0.03, gain: 0.3 },
      ],
    },
    // The House laughs: Draft: slow breath through broken windows, shutters clapping.
    ghoulMarrowLaugh: {
      layers: [
        { type: "pink", seconds: 1.15, attack: 0.3, gain: 0.5, filter: { type: "bandpass", from: 400, to: 900, q: 4 } },
        { type: "noise", seconds: 1.1, attack: 0.3, gain: 0.2, filter: { type: "bandpass", from: 1600, to: 1100, q: 6 } },
        { type: "square", from: 160, to: 140, seconds: 0.04, delay: 0.2, attack: 0, gain: 0.35, filter: { type: "lowpass", from: 900, to: 500, q: 2 } },
        { type: "square", from: 150, to: 130, seconds: 0.04, delay: 0.38, attack: 0, gain: 0.35, filter: { type: "lowpass", from: 900, to: 500, q: 2 } },
        { type: "square", from: 140, to: 120, seconds: 0.04, delay: 0.56, attack: 0, gain: 0.32, filter: { type: "lowpass", from: 900, to: 500, q: 2 } },
        { type: "square", from: 130, to: 110, seconds: 0.04, delay: 0.74, attack: 0, gain: 0.28, filter: { type: "lowpass", from: 900, to: 500, q: 2 } },
        { type: "square", from: 120, to: 100, seconds: 0.04, delay: 0.92, attack: 0, gain: 0.24, filter: { type: "lowpass", from: 900, to: 500, q: 2 } },
        { type: "triangle", from: 98, to: 82, seconds: 1.1, attack: 0.3, gain: 0.2, vibrato: { rate: 5, depth: 0.06 } },
      ],
    },
    // Sinks into the ground: Draft: long low rumble and grinding.
    ghoulMarrowSink: {
      layers: [
        { type: "brown", seconds: 1.2, attack: 0.15, gain: 0.9, filter: { type: "lowpass", from: 300, to: 90, q: 1 } },
        { type: "sine", from: 45, to: 28, seconds: 1.2, attack: 0.15, gain: 0.7 },
        { type: "sawtooth", from: 40, to: 30, seconds: 1.1, delay: 0.05, attack: 0.2, gain: 0.4, vibrato: { rate: 17, depth: 0.2 }, filter: { type: "bandpass", from: 400, to: 200, q: 3 } },
        { type: "noise", seconds: 1, delay: 0.1, attack: 0.2, gain: 0.25, filter: { type: "bandpass", from: 900, to: 400, q: 2 } },
      ],
    },
    // Gone: Draft: deep thud and hollow wind.
    ghoulMarrowGone: {
      layers: [
        { type: "sine", from: 60, to: 26, seconds: 0.6, attack: 0, gain: 0.9 },
        { type: "brown", seconds: 0.4, attack: 0, gain: 0.7, filter: { type: "lowpass", from: 700, to: 80, q: 1 } },
        { type: "pink", seconds: 0.9, delay: 0.25, attack: 0.3, gain: 0.35, filter: { type: "bandpass", from: 350, to: 600, q: 8 } },
        { type: "sine", from: 220, to: 196, seconds: 0.8, delay: 0.35, attack: 0.3, gain: 0.08, vibrato: { rate: 2, depth: 0.03 } },
      ],
    },
    // Storm gathers: Draft: thunder roll, static, rising hum.
    ghoulMarrowStorm: {
      layers: [
        { type: "brown", seconds: 1.2, attack: 0.25, gain: 0.7, filter: { type: "lowpass", from: 180, to: 320, q: 1 } },
        { type: "sine", from: 42, to: 55, seconds: 1.1, attack: 0.3, gain: 0.45 },
        { type: "noise", seconds: 0.9, attack: 0.4, gain: 0.35, filter: { type: "highpass", from: 2400, to: 5200, q: 1 } },
        { type: "sawtooth", from: 60, to: 120, seconds: 0.9, attack: 0.3, gain: 0.18, vibrato: { rate: 23, depth: 0.15 }, filter: { type: "lowpass", from: 500, to: 1400, q: 4 } },
        { type: "square", from: 2200, to: 2600, seconds: 0.03, delay: 0.35, attack: 0, gain: 0.08 },
        { type: "square", from: 2600, to: 3000, seconds: 0.03, delay: 0.6, attack: 0, gain: 0.1 },
        { type: "square", from: 3000, to: 3400, seconds: 0.03, delay: 0.78, attack: 0, gain: 0.12 },
      ],
    },
    // Charge builds: Draft: fizzing crackle and a whine climbing.
    ghoulMarrowCharge: {
      layers: [
        { type: "sine", from: 700, to: 2400, seconds: 0.5, attack: 0.05, gain: 0.22 },
        { type: "square", from: 350, to: 1200, seconds: 0.45, attack: 0.05, gain: 0.08, filter: { type: "lowpass", from: 1500, to: 4000, q: 2 } },
        { type: "noise", seconds: 0.5, attack: 0.1, gain: 0.3, filter: { type: "bandpass", from: 3000, to: 6000, q: 2 } },
        { type: "noise", seconds: 0.02, delay: 0.12, attack: 0, gain: 0.35, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
        { type: "noise", seconds: 0.02, delay: 0.27, attack: 0, gain: 0.4, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
        { type: "noise", seconds: 0.02, delay: 0.38, attack: 0, gain: 0.45, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
      ],
    },
    // Bolt strikes: Draft: sharp crack, wood split, thunder on top.
    ghoulMarrowStrike: {
      layers: [
        { type: "noise", seconds: 0.08, attack: 0, gain: 0.9, filter: { type: "highpass", from: 1800, to: 900, q: 1 } },
        { type: "square", from: 900, to: 120, seconds: 0.09, attack: 0, gain: 0.3 },
        { type: "noise", seconds: 0.12, delay: 0.04, attack: 0, gain: 0.5, filter: { type: "bandpass", from: 1400, to: 600, q: 3 } },
        { type: "brown", seconds: 1, delay: 0.05, attack: 0.02, gain: 0.85, filter: { type: "lowpass", from: 600, to: 90, q: 1 } },
        { type: "sine", from: 70, to: 32, seconds: 0.9, delay: 0.05, attack: 0, gain: 0.6 },
      ],
    },
    // Crows burst out: Draft: door thump, rush of wings, harsh caws.
    ghoulMarrowCrows: {
      layers: [
        { type: "sine", from: 90, to: 50, seconds: 0.18, attack: 0, gain: 0.5 },
        { type: "noise", seconds: 0.6, delay: 0.05, attack: 0.05, gain: 0.4, filter: { type: "bandpass", from: 900, to: 1600, q: 1.5 } },
        { type: "sawtooth", from: 820, to: 560, seconds: 0.16, delay: 0.12, attack: 0.01, gain: 0.22, filter: { type: "bandpass", from: 1200, to: 900, q: 4 } },
        { type: "sawtooth", from: 760, to: 520, seconds: 0.18, delay: 0.36, attack: 0.01, gain: 0.2, filter: { type: "bandpass", from: 1100, to: 800, q: 4 } },
        { type: "sawtooth", from: 880, to: 600, seconds: 0.15, delay: 0.58, attack: 0.01, gain: 0.16, filter: { type: "bandpass", from: 1300, to: 900, q: 4 } },
      ],
    },
  },
  music: {
    // The Front Lawn: storm toccata. A Bach-style organ toccata that never stops: a running sixteenth figure through
    // every chord, leaping up an octave and back, over a long pedal and the storm. The heartbeat is a timpani thump
    // at each bar, lost in the run. A second manual sings the theme from 80%; a kick and choir join near full dread.
    ghoulMarrowLawn: {
      bpm: 96,
      rush: 10,
      voices: {
        manual: { wave: "pulse", duty: 0.25, gain: 0.06, decay: 0.03, sustain: 0.5 },
        pedal: { wave: "triangle", gain: 0.4, decay: 0.1, sustain: 0.9 },
        tim: { wave: "triangle", gain: 0.3, decay: 0.04, sustain: 0.25, from: 0.2 },
        thunder: { kit: true, gain: 0.3 },
        kick: { kit: true, gain: 0.25, from: 0.7 },
        lead: { wave: "pulse", duty: 0.5, gain: 0.05, decay: 0.2, sustain: 1, from: 0.8 },
        choir: { wave: "triangle", gain: 0.07, decay: 0.3, sustain: 1, from: 0.95, vibrato: { rate: 5, depth: 0.008, delay: 0.2 } },
      },
      patterns: {
        I: {
          manual:
          "A4 D5 F5 D5 A4 D5 F5 D5 A5 D6 F6 D6 A4 D5 F5 D5 | A4 D5 F5 D5 A4 D5 F5 D5 A5 D6 F6 D6 A4 D5 F5 D5 | " +
          "F4 Bb4 D5 Bb4 F4 Bb4 D5 Bb4 F5 Bb5 D6 Bb5 F4 Bb4 D5 Bb4 | E4 A4 C#5 A4 E4 A4 C#5 A4 E5 A5 Db6 A5 E4 A4 C#5 A4",
          pedal:
          "D2 - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - - | " +
          "Bb2 - - - - - - - - - - - - - - - | A2 - - - - - - - - - - - - - - -",
          tim:
          "D2 - A1 - . . . . . . . . . . . . | D2 - A1 - . . . . . . . . . . . . | " +
          "D2 - A1 - . . . . . . . . . . . . | D2 - A1 - . . . . A1 A1 A1 A1 A1 A1 A1 A1",
          thunder:
          "ko . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . o . . . . . | . . . . . . . . . . . . . . . .",
          kick:
          "k . . . . . . . k . . . . . . . | k . . . . . . . k . . . . . . . | " +
          "k . . . . . . . k . . . . . . . | k . . . . . . . k . . . . . . .",
        },
        A: {
          manual:
          "A4 D5 F5 D5 A4 D5 F5 D5 A5 D6 F6 D6 A4 D5 F5 D5 | F4 Bb4 D5 Bb4 F4 Bb4 D5 Bb4 F5 Bb5 D6 Bb5 F4 Bb4 D5 Bb4 | " +
          "G4 C5 E5 C5 G4 C5 E5 C5 G5 C6 E6 C6 G4 C5 E5 C5 | E4 A4 C#5 A4 E4 A4 C#5 A4 E5 A5 Db6 A5 E4 A4 C#5 A4",
          pedal:
          "D2 - - - - - - - - - - - - - - - | Bb2 - - - - - - - - - - - - - - - | " +
          "C2 - - - - - - - - - - - - - - - | A2 - - - - - - - - - - - - - - -",
          tim:
          "D2 - A1 - . . . . . . . . . . . . | D2 - A1 - . . . . . . . . . . . . | " +
          "D2 - A1 - . . . . . . . . . . . . | D2 - A1 - . . . . A1 A1 A1 A1 A1 A1 A1 A1",
          thunder:
          "ko . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . o . . . . . | . . . . . . . . . . . . . . . .",
          kick:
          "k . . . . . . . k . . . . . . . | k . . . . . . . k . . . . . . . | " +
          "k . . . . . . . k . . . . . . . | k . . . . . . . k . . . . . . .",
          lead:
          "D5 - - - A4 - - - F5 - - - - - E5 - | D5 - - - - - - - C5 - - - Bb4 - - - | " +
          "C5 - - - E5 - - - G5 - - - - - F5 - | E5 - - - - - - - - - - - C#5 - - -",
          choir:
          "A5 - - - - - - - - - - - - - - - | F5 - - - - - - - - - - - - - - - | " +
          "G5 - - - - - - - - - - - - - - - | E5 - - - - - - - - - - - - - - -",
        },
        B: {
          manual:
          "A4 D5 F5 D5 A4 D5 F5 D5 A5 D6 F6 D6 A4 D5 F5 D5 | D4 G4 Bb4 G4 D4 G4 Bb4 G4 D5 G5 Bb5 G5 D4 G4 Bb4 G4 | " +
          "F4 Bb4 D5 Bb4 F4 Bb4 D5 Bb4 F5 Bb5 D6 Bb5 F4 Bb4 D5 Bb4 | E4 A4 C#5 A4 E4 A4 C#5 A4 E5 A5 Db6 A5 E4 A4 C#5 A4",
          pedal:
          "D2 - - - - - - - - - - - - - - - | G2 - - - - - - - - - - - - - - - | " +
          "Bb2 - - - - - - - - - - - - - - - | A2 - - - - - - - - - - - - - - -",
          tim:
          "D2 - A1 - . . . . . . . . . . . . | D2 - A1 - . . . . . . . . . . . . | " +
          "D2 - A1 - . . . . . . . . . . . . | D2 - A1 - . . . . A1 A1 A1 A1 A1 A1 A1 A1",
          thunder:
          "ko . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . o . . . . . | . . . . . . . . . . . . . . . .",
          kick:
          "k . . . . . . . k . . . . . . . | k . . . . . . . k . . . . . . . | " +
          "k . . . . . . . k . . . . . . . | k . . . . . . . k . . . . . . .",
          lead:
          "A5 - - - - - G5 - F5 - - - E5 - - - | D5 - - - - - Bb4 - G4 - - - - - - - | " +
          "F5 - - - D5 - - - Bb4 - - - D5 - - - | E5 - - - C#5 - - - A4 - - - - - - -",
          choir:
          "A5 - - - - - - - - - - - - - - - | D5 - - - - - - - - - - - - - - - | " +
          "F5 - - - - - - - - - - - - - - - | E5 - - - - - - - - - - - - - - -",
        },
        C: {
          manual:
          "F4 Bb4 D5 Bb4 F4 Bb4 D5 Bb4 F5 Bb5 D6 Bb5 F4 Bb4 D5 Bb4 | G4 C5 E5 C5 G4 C5 E5 C5 G5 C6 E6 C6 G4 C5 E5 C5 | " +
          "A4 D5 F5 D5 A4 D5 F5 D5 A5 D6 F6 D6 A4 D5 F5 D5 | E4 A4 C#5 A4 E4 A4 C#5 A4 E5 A5 Db6 A5 E4 A4 C#5 A4",
          pedal:
          "Bb2 - - - - - - - - - - - - - - - | C2 - - - - - - - - - - - - - - - | " +
          "D2 - - - - - - - - - - - - - - - | A2 - - - - - - - - - - - - - - -",
          tim:
          "D2 - A1 - . . . . . . . . . . . . | D2 - A1 - . . . . . . . . . . . . | " +
          "D2 - A1 - . . . . . . . . . . . . | D2 - A1 - . . . . A1 A1 A1 A1 A1 A1 A1 A1",
          thunder:
          "ko . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . o . . . . . | . . . . . . . . . . . . . . . .",
          kick:
          "k . . . . . . . k . . . . . . . | k . . . . . . . k . . . . . . . | " +
          "k . . . . . . . k . . . . . . . | k . . . . . . . k . . . . . . .",
          lead:
          "F5 - - - Bb5 - - - D6 - - - - - - - | E6 - - - - - C6 - G5 - - - - - - - | " +
          "F6 - - - - - - - A5 - - - D6 - - - | C#6 - - - - - - - E5 - - - A5 - - -",
          choir:
          "F5 - - - - - - - - - - - - - - - | G5 - - - - - - - - - - - - - - - | " +
          "A5 - - - - - - - - - - - - - - - | E5 - - - - - - - - - - - - - - -",
        },
      },
      order: ["I", "A", "B", "A", "C"],
    },
  },
};
