// Plan2Code Web Console - ghoul: Gallows Bog's own sound effects and music tracks, merged into ghoul-sfx.js; defines only.
//
// Same shape and rules as ghoul-sfx-mine.js: `tones` (the stage's monsters' and boss's
// `ghoul<Kind><Act>` sounds, none over 1.2 s with its delay) and `music` (a track per room,
// named in ROOM_MUSIC in ghoul.js). The tones are first drafts (option 1 of each act on
// prototypes/sounds/ghoul-rush/bog.html) until the user's vote replaces them with
// prototypes/ghoul-rush-tools/wire-bog-sounds.cjs; the rooms play borrowed tracks until
// wire-music-bog.cjs lands the picked ones. A name may be defined only once across
// tones.js and every game's file. No imports.

export const BOG_SFX = {
  tones: {
    // Bog Lurker: A pair of eyes in the black water: it watches from under the boards, sinks when you turn, then snaps at your feet.
    // Surfaces: Bubbles and ripple.
    ghoulLurkerAppear: {
      layers: [
        { type: "sine", from: 861, to: 1464, seconds: 0.05, delay: 0.02, attack: 0, gain: 0.35 },
        { type: "sine", from: 856, to: 1456, seconds: 0.05, delay: 0.12, attack: 0, gain: 0.35 },
        { type: "sine", from: 691, to: 1174, seconds: 0.05, delay: 0.16, attack: 0, gain: 0.35 },
        { type: "sine", from: 648, to: 1101, seconds: 0.05, delay: 0.12, attack: 0, gain: 0.35 },
        { type: "noise", seconds: 0.2, attack: 0.01, gain: 0.4, filter: { type: "bandpass", from: 700, to: 2600, q: 1.2 } },
        { type: "pink", seconds: 0.26, attack: 0.03, gain: 0.25, delay: 0.04, filter: { type: "highpass", from: 1800, to: 3000, q: 1 } },
        { type: "sine", from: 300, to: 120, seconds: 0.12, attack: 0.003, gain: 0.2 },
      ],
    },
    // Snaps: Jaws clap.
    ghoulLurkerSnap: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1080, to: 720, q: 2 } },
        { type: "square", from: 540, to: 180, seconds: 0.05, attack: 0, gain: 0.36 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.63, filter: { type: "bandpass", from: 1560, to: 1080, q: 3 } },
        { type: "sine", from: 99, to: 36, seconds: 0.25, attack: 0, gain: 0.7, delay: 0.03 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.56, filter: { type: "lowpass", from: 288, to: 288, q: 1 }, delay: 0.03 },
        { type: "noise", seconds: 0.25, attack: 0.01, gain: 0.4, delay: 0.02, filter: { type: "bandpass", from: 700, to: 2600, q: 1.2 } },
        { type: "pink", seconds: 0.33, attack: 0.03, gain: 0.25, delay: 0.06, filter: { type: "highpass", from: 1800, to: 3000, q: 1 } },
        { type: "sine", from: 300, to: 120, seconds: 0.12, attack: 0.003, gain: 0.2, delay: 0.02 },
      ],
    },
    // Sinks: Slow gurgle under.
    ghoulLurkerSink: {
      layers: [
        { type: "sine", from: 98, to: 74, seconds: 0.7, attack: 0.05, gain: 0.9, vibrato: { rate: 15, depth: 0.4 } },
        { type: "brown", seconds: 0.7, attack: 0.05, gain: 0.7, filter: { type: "lowpass", from: 700, to: 300, q: 1 } },
        { type: "sine", from: 147, to: 118, seconds: 0.49, delay: 0.11, attack: 0.03, gain: 0.4, vibrato: { rate: 9, depth: 0.5 } },
        { type: "sine", from: 240, to: 55, seconds: 0.5, attack: 0.02, gain: 0.4, delay: 0.1 },
        { type: "brown", seconds: 0.5, attack: 0.04, gain: 0.4, delay: 0.1, filter: { type: "lowpass", from: 700, to: 110, q: 1 } },
        { type: "noise", seconds: 0.25, attack: 0.05, gain: 0.15, delay: 0.15, filter: { type: "bandpass", from: 900, to: 300, q: 2 } },
      ],
    },
    // Hit: Grunt.
    ghoulLurkerHurt: {
      layers: [
        { type: "sawtooth", from: 82, to: 57, seconds: 0.16, attack: 0.01, gain: 0.9, vibrato: { rate: 8, depth: 0.1 }, filter: { type: "lowpass", from: 891, to: 891, q: 1 } },
        { type: "brown", seconds: 0.13, attack: 0.01, gain: 0.6, filter: { type: "lowpass", from: 450, to: 450, q: 1 } },
      ],
    },
    // Dies: Sinking groan.
    ghoulLurkerDie: {
      layers: [
        { type: "sawtooth", from: 69, to: 49, seconds: 0.9, attack: 0.12, gain: 0.9, vibrato: { rate: 8, depth: 0.07 }, filter: { type: "lowpass", from: 900, to: 450, q: 5 } },
        { type: "sawtooth", from: 70, to: 49, seconds: 0.9, attack: 0.14, gain: 0.5, filter: { type: "lowpass", from: 720, to: 360, q: 3 } },
        { type: "brown", seconds: 0.9, attack: 0.1, gain: 0.6, filter: { type: "bandpass", from: 252, to: 189, q: 2 } },
        { type: "sine", from: 98, to: 74, seconds: 0.6, attack: 0.05, gain: 0.45, vibrato: { rate: 15, depth: 0.4 }, delay: 0.3 },
        { type: "brown", seconds: 0.6, attack: 0.05, gain: 0.35, filter: { type: "lowpass", from: 700, to: 300, q: 1 }, delay: 0.3 },
        { type: "sine", from: 147, to: 118, seconds: 0.42, delay: 0.39, attack: 0.03, gain: 0.2, vibrato: { rate: 9, depth: 0.5 } },
      ],
    },
    // Leech Swarm: A drifting cloud of black leeches over the water: they flow toward you, latch on and drain a life.
    // Drifts in: Chittering.
    ghoulLeechAppear: {
      layers: [
        { type: "square", from: 566, to: 396, seconds: 0.03, gain: 0.5, filter: { type: "bandpass", from: 849, to: 566, q: 4 } },
        { type: "square", from: 668, to: 468, seconds: 0.03, delay: 0.04, gain: 0.5, filter: { type: "bandpass", from: 1002, to: 668, q: 4 } },
        { type: "square", from: 649, to: 454, seconds: 0.03, delay: 0.08, gain: 0.5, filter: { type: "bandpass", from: 974, to: 649, q: 4 } },
        { type: "square", from: 596, to: 417, seconds: 0.03, delay: 0.12, gain: 0.5, filter: { type: "bandpass", from: 893, to: 596, q: 4 } },
        { type: "square", from: 605, to: 423, seconds: 0.03, delay: 0.16, gain: 0.5, filter: { type: "bandpass", from: 907, to: 605, q: 4 } },
        { type: "square", from: 559, to: 392, seconds: 0.03, delay: 0.2, gain: 0.5, filter: { type: "bandpass", from: 839, to: 559, q: 4 } },
        { type: "square", from: 626, to: 439, seconds: 0.03, delay: 0.24, gain: 0.5, filter: { type: "bandpass", from: 940, to: 626, q: 4 } },
        { type: "square", from: 433, to: 303, seconds: 0.03, delay: 0.28, gain: 0.5, filter: { type: "bandpass", from: 649, to: 433, q: 4 } },
      ],
    },
    // Latches on: Squelch and chitter.
    ghoulLeechLatch: {
      layers: [
        { type: "brown", seconds: 0.3, attack: 0.01, gain: 0.8, filter: { type: "lowpass", from: 1560, to: 180, q: 1 } },
        { type: "sine", from: 312, to: 72, seconds: 0.22, attack: 0.01, gain: 0.56 },
        { type: "noise", seconds: 0.12, attack: 0.01, gain: 0.32, filter: { type: "bandpass", from: 1080, to: 360, q: 3 } },
        { type: "square", from: 661, to: 463, seconds: 0.03, delay: 0.1, gain: 0.5, filter: { type: "bandpass", from: 992, to: 661, q: 4 } },
        { type: "square", from: 532, to: 372, seconds: 0.03, delay: 0.13, gain: 0.5, filter: { type: "bandpass", from: 797, to: 532, q: 4 } },
        { type: "square", from: 466, to: 326, seconds: 0.03, delay: 0.16, gain: 0.5, filter: { type: "bandpass", from: 698, to: 466, q: 4 } },
        { type: "square", from: 462, to: 323, seconds: 0.03, delay: 0.19, gain: 0.5, filter: { type: "bandpass", from: 693, to: 462, q: 4 } },
        { type: "square", from: 569, to: 398, seconds: 0.03, delay: 0.22, gain: 0.5, filter: { type: "bandpass", from: 853, to: 569, q: 4 } },
        { type: "square", from: 556, to: 389, seconds: 0.03, delay: 0.25, gain: 0.5, filter: { type: "bandpass", from: 834, to: 556, q: 4 } },
      ],
    },
    // Hit: Squeak.
    ghoulLeechHurt: {
      layers: [
        { type: "sine", from: 462, to: 601, seconds: 0.08, attack: 0.01, gain: 0.8, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 554, to: 716, seconds: 0.07, delay: 0.1, attack: 0.01, gain: 0.6, vibrato: { rate: 40, depth: 0.08 } },
      ],
    },
    // Dies: Splat.
    ghoulLeechDie: {
      layers: [
        { type: "noise", seconds: 0.28, attack: 0, gain: 0.9, filter: { type: "lowpass", from: 3900, to: 300, q: 1 } },
        { type: "square", from: 210, to: 60, seconds: 0.16, attack: 0, gain: 0.5, filter: { type: "lowpass", from: 900, to: 900, q: 1 } },
        { type: "sine", from: 1350, to: 1950, seconds: 0.05, delay: 0.2, gain: 0.25 },
        { type: "sine", from: 1140, to: 1650, seconds: 0.05, delay: 0.34, gain: 0.18 },
      ],
    },
    // Will-o'-Wisp: A cold green light that drifts over the water: the dead are pulled toward you inside its glow; a shot puts it out, and it relights.
    // Glows: Rising chime.
    ghoulWispAppear: {
      layers: [
        { type: "sine", from: 880, to: 1320, seconds: 0.5, attack: 0.02, gain: 0.5 },
        { type: "sine", from: 1175, to: 1760, seconds: 0.5, attack: 0.02, gain: 0.3, delay: 0.1 },
      ],
    },
    // Goes out: Falling ring.
    ghoulWispOut: {
      layers: [
        { type: "sine", notes: [1000, 840, 670, 500], seconds: 0.7, attack: 0.02, gain: 0.6, vibrato: { rate: 7, depth: 0.02 } },
        { type: "triangle", notes: [1500, 1260, 1000, 750], seconds: 0.7, attack: 0.02, gain: 0.25 },
      ],
    },
    // Relights: Spark and chime.
    ghoulWispRelight: {
      layers: [
        { type: "noise", seconds: 0.06, attack: 0.003, gain: 0.5, filter: { type: "bandpass", from: 3500, to: 5000, q: 3 } },
        { type: "sine", from: 700, to: 1400, seconds: 0.4, attack: 0.02, gain: 0.5, delay: 0.05 },
      ],
    },
    // Burns bright: Held wail.
    ghoulWispOn: {
      layers: [
        { type: "sine", from: 1100, to: 1650, seconds: 0.38, attack: 0.15, gain: 0.48, vibrato: { rate: 6, depth: 0.04 } },
        { type: "sine", from: 1650, to: 770, seconds: 0.56, delay: 0.34, attack: 0.04, gain: 0.48, vibrato: { rate: 6, depth: 0.05 } },
        { type: "triangle", from: 2211, to: 1540, seconds: 0.9, attack: 0.3, gain: 0.12 },
        { type: "pink", seconds: 0.9, attack: 0.3, gain: 0.12, filter: { type: "bandpass", from: 2200, to: 2200, q: 8 } },
      ],
    },
    // Hit: Squeak.
    ghoulWispHurt: {
      layers: [
        { type: "sine", from: 1300, to: 1690, seconds: 0.08, attack: 0.01, gain: 0.8, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 1560, to: 2015, seconds: 0.07, delay: 0.1, attack: 0.01, gain: 0.6, vibrato: { rate: 40, depth: 0.08 } },
      ],
    },
    // Dies: Long falling ring.
    ghoulWispDie: {
      layers: [
        { type: "sine", notes: [1200, 1008, 804, 600], seconds: 1, attack: 0.02, gain: 0.6, vibrato: { rate: 7, depth: 0.02 } },
        { type: "triangle", notes: [1800, 1512, 1200, 900], seconds: 1, attack: 0.02, gain: 0.25 },
      ],
    },
    // Bog Body: An old drowned thing that climbs out of the muck and walks: it is harmless while it climbs, then it drags at you.
    // Shows itself: Low groan.
    ghoulBogbodyAppear: {
      layers: [
        { type: "sawtooth", from: 83, to: 59, seconds: 0.8, attack: 0.12, gain: 0.9, vibrato: { rate: 20, depth: 0.07 }, filter: { type: "lowpass", from: 800, to: 400, q: 5 } },
        { type: "sawtooth", from: 83, to: 58, seconds: 0.8, attack: 0.14, gain: 0.5, filter: { type: "lowpass", from: 640, to: 320, q: 3 } },
        { type: "brown", seconds: 0.8, attack: 0.1, gain: 0.6, filter: { type: "bandpass", from: 300, to: 225, q: 2 } },
      ],
    },
    // Climbs out: Squelch and groan.
    ghoulBogbodyRise: {
      layers: [
        { type: "brown", seconds: 0.3, attack: 0.01, gain: 0.8, filter: { type: "lowpass", from: 780, to: 90, q: 1 } },
        { type: "sine", from: 156, to: 36, seconds: 0.22, attack: 0.01, gain: 0.56 },
        { type: "noise", seconds: 0.12, attack: 0.01, gain: 0.32, filter: { type: "bandpass", from: 540, to: 180, q: 3 } },
        { type: "sawtooth", from: 60, to: 94, seconds: 0.8, attack: 0.12, gain: 0.54, vibrato: { rate: 20, depth: 0.07 }, filter: { type: "lowpass", from: 800, to: 400, q: 5 }, delay: 0.1 },
        { type: "sawtooth", from: 60, to: 93, seconds: 0.8, attack: 0.14, gain: 0.3, filter: { type: "lowpass", from: 640, to: 320, q: 3 }, delay: 0.1 },
        { type: "brown", seconds: 0.8, attack: 0.1, gain: 0.36, filter: { type: "bandpass", from: 300, to: 225, q: 2 }, delay: 0.1 },
      ],
    },
    // Hit: Grunt.
    ghoulBogbodyHurt: {
      layers: [
        { type: "sawtooth", from: 98, to: 68, seconds: 0.16, attack: 0.01, gain: 0.9, vibrato: { rate: 20, depth: 0.1 }, filter: { type: "lowpass", from: 880, to: 880, q: 1 } },
        { type: "brown", seconds: 0.13, attack: 0.01, gain: 0.6, filter: { type: "lowpass", from: 500, to: 500, q: 1 } },
      ],
    },
    // Dies: Long groan, squelch.
    ghoulBogbodyDie: {
      layers: [
        { type: "sawtooth", from: 83, to: 59, seconds: 1, attack: 0.12, gain: 0.9, vibrato: { rate: 20, depth: 0.07 }, filter: { type: "lowpass", from: 800, to: 400, q: 5 } },
        { type: "sawtooth", from: 83, to: 58, seconds: 1, attack: 0.14, gain: 0.5, filter: { type: "lowpass", from: 640, to: 320, q: 3 } },
        { type: "brown", seconds: 1, attack: 0.1, gain: 0.6, filter: { type: "bandpass", from: 300, to: 225, q: 2 } },
        { type: "brown", seconds: 0.3, attack: 0.01, gain: 0.7, filter: { type: "lowpass", from: 910, to: 105, q: 1 }, delay: 0.5 },
        { type: "sine", from: 182, to: 42, seconds: 0.22, attack: 0.01, gain: 0.49, delay: 0.5 },
        { type: "noise", seconds: 0.12, attack: 0.01, gain: 0.28, filter: { type: "bandpass", from: 630, to: 210, q: 3 }, delay: 0.5 },
      ],
    },
    // Old Mother Bog: A hag of mud and reeds stewing in her cauldron in the Drowning Pool: she sends a wave of mud down the boards, spits from the pot, then sinks and comes up somewhere else.
    // Wakes: Big roar.
    ghoulMotherWake: {
      layers: [
        { type: "sawtooth", from: 54, to: 69, seconds: 0.39, attack: 0.05, gain: 0.9, vibrato: { rate: 5, depth: 0.1 }, filter: { type: "lowpass", from: 300, to: 2200, q: 4 } },
        { type: "sawtooth", from: 69, to: 42, seconds: 0.77, delay: 0.33, attack: 0.02, gain: 0.9, vibrato: { rate: 5, depth: 0.12 }, filter: { type: "lowpass", from: 2200, to: 260, q: 4 } },
        { type: "sawtooth", from: 30, to: 22, seconds: 1.1, attack: 0.08, gain: 0.6, filter: { type: "lowpass", from: 500, to: 500, q: 1 } },
        { type: "brown", seconds: 1.1, attack: 0.06, gain: 0.8, filter: { type: "lowpass", from: 900, to: 180, q: 1 } },
        { type: "sine", from: 30, to: 21, seconds: 1.1, attack: 0.05, gain: 0.7 },
      ],
    },
    // Winds up the wave: Rising groan.
    ghoulMotherWind: {
      layers: [
        { type: "sawtooth", from: 48, to: 75, seconds: 0.9, attack: 0.12, gain: 0.9, vibrato: { rate: 5, depth: 0.07 }, filter: { type: "lowpass", from: 1000, to: 500, q: 5 } },
        { type: "sawtooth", from: 48, to: 75, seconds: 0.9, attack: 0.14, gain: 0.5, filter: { type: "lowpass", from: 800, to: 400, q: 3 } },
        { type: "brown", seconds: 0.9, attack: 0.1, gain: 0.6, filter: { type: "bandpass", from: 240, to: 180, q: 2 } },
        { type: "noise", seconds: 0.6, attack: 0.21, gain: 0.4, filter: { type: "bandpass", from: 180, to: 1080, q: 1.5 }, delay: 0.2 },
      ],
    },
    // Mud wave: Rumble and splash.
    ghoulMotherWave: {
      layers: [
        { type: "brown", seconds: 1, attack: 0.08, gain: 0.8, filter: { type: "lowpass", from: 180, to: 70, q: 1 } },
        { type: "sine", from: 48, to: 30, seconds: 1, attack: 0.05, gain: 0.64 },
        { type: "noise", seconds: 0.4, attack: 0.01, gain: 0.64, delay: 0.1, filter: { type: "bandpass", from: 490, to: 1820, q: 1.2 } },
        { type: "pink", seconds: 0.52, attack: 0.03, gain: 0.4, delay: 0.14, filter: { type: "highpass", from: 1260, to: 2100, q: 1 } },
        { type: "sine", from: 210, to: 84, seconds: 0.12, attack: 0.003, gain: 0.32, delay: 0.1 },
      ],
    },
    // Gulps for a spit: Gurgle and gasp.
    ghoulMotherSpitWind: {
      layers: [
        { type: "sine", from: 96, to: 72, seconds: 0.6, attack: 0.05, gain: 0.9, vibrato: { rate: 15, depth: 0.4 } },
        { type: "brown", seconds: 0.6, attack: 0.05, gain: 0.7, filter: { type: "lowpass", from: 700, to: 300, q: 1 } },
        { type: "sine", from: 144, to: 115, seconds: 0.42, delay: 0.09, attack: 0.03, gain: 0.4, vibrato: { rate: 9, depth: 0.5 } },
        { type: "noise", seconds: 0.22, attack: 0.15, gain: 0.7, filter: { type: "bandpass", from: 770, to: 1680, q: 4 }, delay: 0.3 },
        { type: "sawtooth", from: 84, to: 109, seconds: 0.2, attack: 0.14, gain: 0.25, filter: { type: "lowpass", from: 980, to: 980, q: 1 }, delay: 0.3 },
      ],
    },
    // Spits: Spit and splat.
    ghoulMotherSpit: {
      layers: [
        { type: "noise", seconds: 0.1, attack: 0, gain: 0.8, filter: { type: "highpass", from: 1260, to: 1260, q: 1 } },
        { type: "sine", from: 490, to: 105, seconds: 0.16, delay: 0.02, gain: 0.6 },
        { type: "brown", seconds: 0.12, attack: 0, gain: 0.5, filter: { type: "lowpass", from: 294, to: 294, q: 1 } },
        { type: "noise", seconds: 0.28, attack: 0, gain: 0.54, filter: { type: "lowpass", from: 1820, to: 140, q: 1 }, delay: 0.15 },
        { type: "square", from: 98, to: 28, seconds: 0.16, attack: 0, gain: 0.3, filter: { type: "lowpass", from: 420, to: 420, q: 1 }, delay: 0.15 },
        { type: "sine", from: 630, to: 910, seconds: 0.05, delay: 0.35, gain: 0.15 },
        { type: "sine", from: 532, to: 770, seconds: 0.05, delay: 0.49, gain: 0.11 },
      ],
    },
    // Cauldron opens: Lid clank, bubbles.
    ghoulMotherOpen: {
      layers: [
        { type: "sine", from: 260, to: 250, seconds: 0.35, attack: 0.003, gain: 0.6 },
        { type: "sine", from: 718, to: 702, seconds: 0.2, attack: 0.003, gain: 0.3 },
        { type: "noise", seconds: 0.04, attack: 0.003, gain: 0.5, filter: { type: "bandpass", from: 1300, to: 1300, q: 2 } },
        { type: "sine", from: 330, to: 560, seconds: 0.05, delay: 0.24, attack: 0, gain: 0.35 },
        { type: "sine", from: 462, to: 785, seconds: 0.05, delay: 0.41, attack: 0, gain: 0.35 },
        { type: "sine", from: 384, to: 653, seconds: 0.05, delay: 0.38, attack: 0, gain: 0.35 },
        { type: "sine", from: 702, to: 1193, seconds: 0.05, delay: 0.43, attack: 0, gain: 0.35 },
        { type: "sine", from: 860, to: 1462, seconds: 0.05, delay: 0.23, attack: 0, gain: 0.35 },
      ],
    },
    // Sinks: Long gurgle, rumble.
    ghoulMotherSink: {
      layers: [
        { type: "sine", from: 84, to: 63, seconds: 0.9, attack: 0.05, gain: 0.9, vibrato: { rate: 15, depth: 0.4 } },
        { type: "brown", seconds: 0.9, attack: 0.05, gain: 0.7, filter: { type: "lowpass", from: 700, to: 300, q: 1 } },
        { type: "sine", from: 126, to: 101, seconds: 0.63, delay: 0.14, attack: 0.03, gain: 0.4, vibrato: { rate: 9, depth: 0.5 } },
        { type: "brown", seconds: 1, attack: 0.08, gain: 0.5, filter: { type: "lowpass", from: 180, to: 70, q: 1 } },
        { type: "sine", from: 48, to: 30, seconds: 1, attack: 0.05, gain: 0.4 },
      ],
    },
    // Bubbles warn: Few bubbles.
    ghoulMotherBubble: {
      layers: [
        { type: "sine", from: 435, to: 740, seconds: 0.05, delay: 0.46, attack: 0, gain: 0.35 },
        { type: "sine", from: 538, to: 915, seconds: 0.05, delay: 0.15, attack: 0, gain: 0.35 },
        { type: "sine", from: 783, to: 1331, seconds: 0.05, delay: 0.09, attack: 0, gain: 0.35 },
        { type: "sine", from: 440, to: 748, seconds: 0.05, delay: 0.04, attack: 0, gain: 0.35 },
      ],
    },
    // Resurfaces: Rising roar.
    ghoulMotherRise: {
      layers: [
        { type: "sawtooth", from: 54, to: 69, seconds: 0.35, attack: 0.05, gain: 0.9, vibrato: { rate: 5, depth: 0.1 }, filter: { type: "lowpass", from: 300, to: 2200, q: 4 } },
        { type: "sawtooth", from: 69, to: 42, seconds: 0.7, delay: 0.3, attack: 0.02, gain: 0.9, vibrato: { rate: 5, depth: 0.12 }, filter: { type: "lowpass", from: 2200, to: 260, q: 4 } },
        { type: "sawtooth", from: 30, to: 22, seconds: 1, attack: 0.08, gain: 0.6, filter: { type: "lowpass", from: 500, to: 500, q: 1 } },
        { type: "brown", seconds: 1, attack: 0.06, gain: 0.8, filter: { type: "lowpass", from: 900, to: 180, q: 1 } },
        { type: "sine", from: 30, to: 21, seconds: 1, attack: 0.05, gain: 0.7 },
        { type: "noise", seconds: 0.4, attack: 0.01, gain: 0.48, filter: { type: "bandpass", from: 490, to: 1820, q: 1.2 } },
        { type: "pink", seconds: 0.52, attack: 0.03, gain: 0.3, delay: 0.04, filter: { type: "highpass", from: 1260, to: 2100, q: 1 } },
        { type: "sine", from: 210, to: 84, seconds: 0.12, attack: 0.003, gain: 0.24 },
      ],
    },
    // Muck lands: Splat.
    ghoulMotherMuck: {
      layers: [
        { type: "noise", seconds: 0.28, attack: 0, gain: 0.9, filter: { type: "lowpass", from: 2080, to: 160, q: 1 } },
        { type: "square", from: 112, to: 32, seconds: 0.16, attack: 0, gain: 0.5, filter: { type: "lowpass", from: 480, to: 480, q: 1 } },
        { type: "sine", from: 720, to: 1040, seconds: 0.05, delay: 0.2, gain: 0.25 },
        { type: "sine", from: 608, to: 880, seconds: 0.05, delay: 0.34, gain: 0.18 },
      ],
    },
    // Hit: Short roar.
    ghoulMotherHurt: {
      layers: [
        { type: "sawtooth", from: 59, to: 76, seconds: 0.16, attack: 0.05, gain: 0.9, vibrato: { rate: 5, depth: 0.1 }, filter: { type: "lowpass", from: 300, to: 2200, q: 4 } },
        { type: "sawtooth", from: 76, to: 46, seconds: 0.32, delay: 0.14, attack: 0.02, gain: 0.9, vibrato: { rate: 5, depth: 0.12 }, filter: { type: "lowpass", from: 2200, to: 260, q: 4 } },
        { type: "sawtooth", from: 33, to: 24, seconds: 0.45, attack: 0.08, gain: 0.6, filter: { type: "lowpass", from: 500, to: 500, q: 1 } },
        { type: "brown", seconds: 0.45, attack: 0.06, gain: 0.8, filter: { type: "lowpass", from: 900, to: 180, q: 1 } },
        { type: "sine", from: 33, to: 23, seconds: 0.45, attack: 0.05, gain: 0.7 },
      ],
    },
    // Weak spot: Crack and roar.
    ghoulMotherWeak: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1260, to: 840, q: 2 } },
        { type: "square", from: 630, to: 210, seconds: 0.05, attack: 0, gain: 0.36 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.63, filter: { type: "bandpass", from: 1820, to: 1260, q: 3 } },
        { type: "sawtooth", from: 54, to: 69, seconds: 0.21, attack: 0.05, gain: 0.63, vibrato: { rate: 5, depth: 0.1 }, filter: { type: "lowpass", from: 300, to: 2200, q: 4 }, delay: 0.05 },
        { type: "sawtooth", from: 69, to: 42, seconds: 0.42, delay: 0.23, attack: 0.02, gain: 0.63, vibrato: { rate: 5, depth: 0.12 }, filter: { type: "lowpass", from: 2200, to: 260, q: 4 } },
        { type: "sawtooth", from: 30, to: 22, seconds: 0.6, attack: 0.08, gain: 0.42, filter: { type: "lowpass", from: 500, to: 500, q: 1 }, delay: 0.05 },
        { type: "brown", seconds: 0.6, attack: 0.06, gain: 0.56, filter: { type: "lowpass", from: 900, to: 180, q: 1 }, delay: 0.05 },
        { type: "sine", from: 30, to: 21, seconds: 0.6, attack: 0.05, gain: 0.49, delay: 0.05 },
      ],
    },
    // Dies: Falling roar, rumble.
    ghoulMotherDie: {
      layers: [
        { type: "sawtooth", from: 49, to: 62, seconds: 0.42, attack: 0.05, gain: 0.9, vibrato: { rate: 5, depth: 0.1 }, filter: { type: "lowpass", from: 300, to: 2200, q: 4 } },
        { type: "sawtooth", from: 62, to: 38, seconds: 0.84, delay: 0.36, attack: 0.02, gain: 0.9, vibrato: { rate: 5, depth: 0.12 }, filter: { type: "lowpass", from: 2200, to: 260, q: 4 } },
        { type: "sawtooth", from: 27, to: 20, seconds: 1.2, attack: 0.08, gain: 0.6, filter: { type: "lowpass", from: 500, to: 500, q: 1 } },
        { type: "brown", seconds: 1.2, attack: 0.06, gain: 0.8, filter: { type: "lowpass", from: 900, to: 180, q: 1 } },
        { type: "sine", from: 27, to: 20, seconds: 1.2, attack: 0.05, gain: 0.7 },
        { type: "brown", seconds: 1.2, attack: 0.08, gain: 0.6, filter: { type: "lowpass", from: 180, to: 70, q: 1 } },
        { type: "sine", from: 48, to: 30, seconds: 1.2, attack: 0.05, gain: 0.48 },
      ],
    },
  },
  music: {
  },
};
