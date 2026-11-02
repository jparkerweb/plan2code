// Plan2Code Web Console - ghoul: The Frozen Lake's own sound effects and music tracks, merged into ghoul-sfx.js; defines only.
//
// Same shape and rules as ghoul-sfx-carnival.js: `tones` (the stage's monsters'
// and boss's `ghoul<Kind><Act>` sounds) and `music` (a track per room, named in
// ROOM_MUSIC in ghoul.js). `music` holds the picked tracks (`ghoulHuts`, `ghoulLodge`,
// `ghoulBlackIce`, `ghoulWidow`); `tones` is empty until the sounds are picked
// by ear and the art's VOICES borrow older tones. A name may be defined only once across tones.js and every game's file.
// No imports.

export const FROZEN_SFX = {
  tones: {
    // Frozen Lake picks, by ear (prototypes/sounds/ghoul-rush/frozen.html).
    // Under-Ice Hand: A grey hand that trails you under the ice, cracks thin ice open beneath you, or bursts up through the floor to grab.
    // Slides in: Scrabbling fingernails.
    ghoulIceHandAppear: {
      layers: [
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1270, to: 1016, q: 6 } },
        { type: "square", from: 585, to: 365, seconds: 0.02, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.04, attack: 0, gain: 0.82, filter: { type: "bandpass", from: 1208, to: 966, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.11, attack: 0, gain: 0.75, filter: { type: "bandpass", from: 2090, to: 1672, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.15, attack: 0, gain: 0.67, filter: { type: "bandpass", from: 1233, to: 986, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.19, attack: 0, gain: 0.59, filter: { type: "bandpass", from: 1776, to: 1421, q: 6 } },
        { type: "square", from: 519, to: 347, seconds: 0.02, delay: 0.19, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.26, attack: 0, gain: 0.51, filter: { type: "bandpass", from: 1424, to: 1139, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.31, attack: 0, gain: 0.44, filter: { type: "bandpass", from: 1884, to: 1507, q: 6 } },
        { type: "noise", seconds: 0.4, attack: 0.12, gain: 0.3, delay: 0.1, filter: { type: "bandpass", from: 1800, to: 900, q: 5 } },
      ],
    },
    // Warns, then cracks the ice: Rap, rap, rap.
    ghoulIceHandWarn: {
      layers: [
        { type: "triangle", from: 220, to: 176, seconds: 0.18, attack: 0.003, gain: 0.72, filter: { type: "lowpass", from: 660, to: 440, q: 1 } },
        { type: "brown", seconds: 0.08, attack: 0.002, gain: 0.4, filter: { type: "lowpass", from: 400, to: 400, q: 1 } },
        { type: "triangle", from: 220, to: 176, seconds: 0.18, attack: 0.003, gain: 0.72, delay: 0.12, filter: { type: "lowpass", from: 660, to: 440, q: 1 } },
        { type: "brown", seconds: 0.08, attack: 0.002, gain: 0.4, delay: 0.12, filter: { type: "lowpass", from: 400, to: 400, q: 1 } },
        { type: "triangle", from: 230, to: 184, seconds: 0.18, attack: 0.003, gain: 0.81, delay: 0.22, filter: { type: "lowpass", from: 690, to: 460, q: 1 } },
        { type: "brown", seconds: 0.08, attack: 0.002, gain: 0.45, delay: 0.22, filter: { type: "lowpass", from: 400, to: 400, q: 1 } },
        { type: "triangle", from: 240, to: 192, seconds: 0.18, attack: 0.003, gain: 0.9, delay: 0.3, filter: { type: "lowpass", from: 720, to: 480, q: 1 } },
        { type: "brown", seconds: 0.08, attack: 0.002, gain: 0.5, delay: 0.3, filter: { type: "lowpass", from: 400, to: 400, q: 1 } },
      ],
    },
    // Bursts up and grabs: Whump and shards.
    ghoulIceHandGrab: {
      layers: [
        { type: "brown", seconds: 0.35, attack: 0.01, gain: 0.81, filter: { type: "lowpass", from: 770, to: 110, q: 1 } },
        { type: "sine", from: 165, to: 50, seconds: 0.3, attack: 0.005, gain: 0.72 },
        { type: "sine", from: 3200, to: 3072, seconds: 0.2, attack: 0.002, gain: 0.2, delay: 0.08 },
        { type: "sine", from: 4100, to: 3936, seconds: 0.27, attack: 0.002, gain: 0.2, delay: 0.13 },
        { type: "sine", from: 5200, to: 4992, seconds: 0.34, attack: 0.002, gain: 0.2, delay: 0.17 },
        { type: "sine", from: 3700, to: 3552, seconds: 0.2, attack: 0.002, gain: 0.2, delay: 0.22 },
        { type: "noise", seconds: 0.3, attack: 0.06, gain: 0.24, filter: { type: "highpass", from: 2400, to: 5000, q: 1 }, delay: 0.1 },
        { type: "pink", seconds: 0.3, attack: 0.05, gain: 0.15, filter: { type: "bandpass", from: 3200, to: 2200, q: 2 }, delay: 0.1 },
      ],
    },
    // Takes a bolt: Ice-rimmed crack.
    ghoulIceHandHurt: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.8, filter: { type: "bandpass", from: 1440, to: 960, q: 2 } },
        { type: "square", from: 720, to: 240, seconds: 0.05, attack: 0, gain: 0.32 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.56, filter: { type: "bandpass", from: 2080, to: 1440, q: 3 } },
        { type: "sawtooth", from: 164, to: 113, seconds: 0.16, attack: 0.01, gain: 0.45, vibrato: { rate: 9, depth: 0.1 }, filter: { type: "lowpass", from: 1078, to: 1078, q: 1 }, delay: 0.03 },
        { type: "brown", seconds: 0.13, attack: 0.01, gain: 0.3, filter: { type: "lowpass", from: 700, to: 700, q: 1 }, delay: 0.03 },
      ],
    },
    // Dies: Crumble to snow.
    ghoulIceHandDie: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.7, filter: { type: "bandpass", from: 1080, to: 720, q: 2 } },
        { type: "square", from: 540, to: 180, seconds: 0.05, attack: 0, gain: 0.28 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.49, filter: { type: "bandpass", from: 1560, to: 1080, q: 3 } },
        { type: "noise", seconds: 0.04, delay: 0.1, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2802, to: 2242, q: 6 } },
        { type: "square", from: 894, to: 547, seconds: 0.02, delay: 0.1, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.15, attack: 0, gain: 0.79, filter: { type: "bandpass", from: 3102, to: 2482, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.2, attack: 0, gain: 0.68, filter: { type: "bandpass", from: 3184, to: 2547, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.27, attack: 0, gain: 0.58, filter: { type: "bandpass", from: 3025, to: 2420, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.35, attack: 0, gain: 0.47, filter: { type: "bandpass", from: 3135, to: 2508, q: 6 } },
        { type: "square", from: 898, to: 487, seconds: 0.02, delay: 0.35, gain: 0.3 },
        { type: "noise", seconds: 0.6, attack: 0.06, gain: 0.24, filter: { type: "highpass", from: 1200, to: 2500, q: 1 }, delay: 0.2 },
        { type: "pink", seconds: 0.6, attack: 0.05, gain: 0.15, filter: { type: "bandpass", from: 1600, to: 1100, q: 2 }, delay: 0.2 },
      ],
    },
    // Snow Shade: A shape in the falling snow, seen only by its footprints: it stalks you, rears up, then lunges. A bolt near it, or a flare, shows it.
    // Drifts in: Hollow moan on the air.
    ghoulShadeAppear: {
      layers: [
        { type: "triangle", from: 168, to: 126, seconds: 1, attack: 0.25, gain: 0.63, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 1680, to: 1080, q: 1 } },
        { type: "sine", from: 336, to: 252, seconds: 1, attack: 0.3, gain: 0.21 },
        { type: "pink", seconds: 1, attack: 0.3, gain: 0.18, filter: { type: "bandpass", from: 672, to: 504, q: 6 } },
        { type: "noise", seconds: 0.7, attack: 0.27999999999999997, gain: 0.21, filter: { type: "bandpass", from: 500, to: 1200, q: 2 } },
        { type: "pink", seconds: 0.7, attack: 0.35, gain: 0.12, filter: { type: "bandpass", from: 300, to: 840, q: 1 } },
      ],
    },
    // Shown by a bolt: Frost snaps into shape.
    ghoulShadeShow: {
      layers: [
        { type: "noise", seconds: 0.06, attack: 0.001, gain: 0.45, filter: { type: "highpass", from: 3250, to: 6500, q: 1 } },
        { type: "sawtooth", from: 2860, to: 338, seconds: 0.22, attack: 0.002, gain: 0.25, filter: { type: "bandpass", from: 2340, to: 780, q: 4 } },
        { type: "noise", seconds: 0.05, attack: 0.001, gain: 0.3, delay: 0.07, filter: { type: "bandpass", from: 4550, to: 3250, q: 3 } },
        { type: "sine", from: 156, to: 65, seconds: 0.25, attack: 0.003, gain: 0.25, delay: 0.02 },
        { type: "sine", from: 1500, to: 2250, seconds: 0.4, attack: 0.16000000000000003, gain: 0.25, delay: 0.05, vibrato: { rate: 9, depth: 0.03 } },
        { type: "triangle", from: 2250, to: 3300, seconds: 0.4, attack: 0.16000000000000003, gain: 0.15, delay: 0.05 },
        { type: "pink", seconds: 0.4, attack: 0.2, gain: 0.08, delay: 0.05, filter: { type: "highpass", from: 4000, to: 6000, q: 1 } },
      ],
    },
    // Rears up: Wind sucks in.
    ghoulShadeWind: {
      layers: [
        { type: "noise", seconds: 0.5, attack: 0.2, gain: 0.49, filter: { type: "bandpass", from: 1600, to: 300, q: 2 } },
        { type: "pink", seconds: 0.5, attack: 0.25, gain: 0.28, filter: { type: "bandpass", from: 960, to: 210, q: 1 } },
        { type: "triangle", from: 140, to: 182, seconds: 0.5, attack: 0.25, gain: 0.45, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 1400, to: 900, q: 1 } },
        { type: "sine", from: 280, to: 364, seconds: 0.5, attack: 0.3, gain: 0.15 },
        { type: "pink", seconds: 0.5, attack: 0.3, gain: 0.13, filter: { type: "bandpass", from: 560, to: 420, q: 6 } },
      ],
    },
    // Lunges: Banshee wail.
    ghoulShadeLunge: {
      layers: [
        { type: "sine", from: 700, to: 1050, seconds: 0.34, attack: 0.15, gain: 0.64, vibrato: { rate: 6, depth: 0.04 } },
        { type: "sine", from: 1050, to: 490, seconds: 0.5, delay: 0.3, attack: 0.04, gain: 0.64, vibrato: { rate: 6, depth: 0.05 } },
        { type: "triangle", from: 1407, to: 980, seconds: 0.8, attack: 0.3, gain: 0.16 },
        { type: "pink", seconds: 0.8, attack: 0.3, gain: 0.16, filter: { type: "bandpass", from: 1400, to: 1400, q: 8 } },
      ],
    },
    // Takes a bolt: Frost flies off.
    ghoulShadeHurt: {
      layers: [
        { type: "noise", seconds: 0.06, attack: 0.001, gain: 0.45, filter: { type: "highpass", from: 3500, to: 7000, q: 1 } },
        { type: "sawtooth", from: 3080, to: 364, seconds: 0.22, attack: 0.002, gain: 0.25, filter: { type: "bandpass", from: 2520, to: 840, q: 4 } },
        { type: "noise", seconds: 0.05, attack: 0.001, gain: 0.3, delay: 0.07, filter: { type: "bandpass", from: 4900, to: 3500, q: 3 } },
        { type: "sine", from: 168, to: 70, seconds: 0.25, attack: 0.003, gain: 0.25, delay: 0.02 },
        { type: "sine", from: 3200, to: 3072, seconds: 0.2, attack: 0.002, gain: 0.16, delay: 0.05 },
        { type: "sine", from: 4100, to: 3936, seconds: 0.27, attack: 0.002, gain: 0.16, delay: 0.1 },
        { type: "sine", from: 5200, to: 4992, seconds: 0.34, attack: 0.002, gain: 0.16, delay: 0.14 },
        { type: "noise", seconds: 0.22, attack: 0.15, gain: 0.28, filter: { type: "bandpass", from: 1100, to: 2400, q: 4 } },
        { type: "sawtooth", from: 280, to: 364, seconds: 0.2, attack: 0.14, gain: 0.1, filter: { type: "lowpass", from: 1400, to: 1400, q: 1 } },
      ],
    },
    // Dies: Sigh and a drift of flakes.
    ghoulShadeDie: {
      layers: [
        { type: "triangle", from: 140, to: 105, seconds: 0.8, attack: 0.25, gain: 0.54, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 1400, to: 900, q: 1 } },
        { type: "sine", from: 280, to: 210, seconds: 0.8, attack: 0.3, gain: 0.18 },
        { type: "pink", seconds: 0.8, attack: 0.3, gain: 0.15, filter: { type: "bandpass", from: 560, to: 420, q: 6 } },
        { type: "sine", from: 1800, to: 1080, seconds: 0.7, attack: 0.27999999999999997, gain: 0.2, delay: 0.1, vibrato: { rate: 9, depth: 0.03 } },
        { type: "triangle", from: 2700, to: 1620, seconds: 0.7, attack: 0.27999999999999997, gain: 0.12, delay: 0.1 },
        { type: "pink", seconds: 0.7, attack: 0.35, gain: 0.06, delay: 0.1, filter: { type: "highpass", from: 4000, to: 6000, q: 1 } },
      ],
    },
    // Frozen Ghoul: A zombie in a crust of ice that slides toward you. It shatters into flying shards when shot, or melts under a flare.
    // Slides in: Chattering and a moan.
    ghoulFrozenGhoulAppear: {
      layers: [
        { type: "square", from: 111, to: 78, seconds: 0.03, gain: 0.25, filter: { type: "bandpass", from: 167, to: 111, q: 4 } },
        { type: "square", from: 105, to: 74, seconds: 0.03, delay: 0.04, gain: 0.25, filter: { type: "bandpass", from: 158, to: 105, q: 4 } },
        { type: "square", from: 120, to: 84, seconds: 0.03, delay: 0.08, gain: 0.25, filter: { type: "bandpass", from: 180, to: 120, q: 4 } },
        { type: "square", from: 83, to: 58, seconds: 0.03, delay: 0.12, gain: 0.25, filter: { type: "bandpass", from: 124, to: 83, q: 4 } },
        { type: "square", from: 125, to: 88, seconds: 0.03, delay: 0.16, gain: 0.25, filter: { type: "bandpass", from: 188, to: 125, q: 4 } },
        { type: "square", from: 96, to: 68, seconds: 0.03, delay: 0.2, gain: 0.25, filter: { type: "bandpass", from: 145, to: 96, q: 4 } },
        { type: "square", from: 112, to: 79, seconds: 0.03, delay: 0.24, gain: 0.25, filter: { type: "bandpass", from: 169, to: 112, q: 4 } },
        { type: "square", from: 99, to: 70, seconds: 0.03, delay: 0.28, gain: 0.25, filter: { type: "bandpass", from: 149, to: 99, q: 4 } },
        { type: "square", from: 107, to: 75, seconds: 0.03, delay: 0.32, gain: 0.25, filter: { type: "bandpass", from: 160, to: 107, q: 4 } },
        { type: "square", from: 124, to: 87, seconds: 0.03, delay: 0.36, gain: 0.25, filter: { type: "bandpass", from: 186, to: 124, q: 4 } },
        { type: "triangle", from: 80, to: 60, seconds: 0.8, attack: 0.25, gain: 0.54, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 1400, to: 900, q: 1 }, delay: 0.1 },
        { type: "sine", from: 160, to: 120, seconds: 0.8, attack: 0.3, gain: 0.18, delay: 0.1 },
      ],
    },
    // Shatters: Deep boom, glassy rain.
    ghoulFrozenGhoulShatter: {
      layers: [
        { type: "brown", seconds: 0.35, attack: 0.01, gain: 0.72, filter: { type: "lowpass", from: 630, to: 90, q: 1 } },
        { type: "sine", from: 135, to: 41, seconds: 0.3, attack: 0.005, gain: 0.64 },
        { type: "noise", seconds: 0.06, attack: 0.001, gain: 0.63, delay: 0.03, filter: { type: "highpass", from: 2000, to: 4000, q: 1 } },
        { type: "sawtooth", from: 1760, to: 208, seconds: 0.22, attack: 0.002, gain: 0.35, delay: 0.03, filter: { type: "bandpass", from: 1440, to: 480, q: 4 } },
        { type: "noise", seconds: 0.05, attack: 0.001, gain: 0.42, delay: 0.1, filter: { type: "bandpass", from: 2800, to: 2000, q: 3 } },
        { type: "sine", from: 96, to: 40, seconds: 0.25, attack: 0.003, gain: 0.35, delay: 0.05 },
        { type: "sine", from: 2560, to: 2458, seconds: 0.2, attack: 0.002, gain: 0.2, delay: 0.12 },
        { type: "sine", from: 3280, to: 3149, seconds: 0.27, attack: 0.002, gain: 0.2, delay: 0.19 },
        { type: "sine", from: 4160, to: 3994, seconds: 0.34, attack: 0.002, gain: 0.2, delay: 0.26 },
        { type: "sine", from: 2960, to: 2842, seconds: 0.2, attack: 0.002, gain: 0.2, delay: 0.33 },
        { type: "sine", from: 4800, to: 4608, seconds: 0.27, attack: 0.002, gain: 0.2, delay: 0.4 },
        { type: "sine", from: 3680, to: 3533, seconds: 0.34, attack: 0.002, gain: 0.2, delay: 0.47 },
      ],
    },
    // Melts: Drip drip, a puddle.
    ghoulFrozenGhoulMelt: {
      layers: [
        { type: "sine", from: 888, to: 1509, seconds: 0.05, delay: 0.51, attack: 0, gain: 0.28 },
        { type: "sine", from: 433, to: 737, seconds: 0.05, delay: 0.17, attack: 0, gain: 0.28 },
        { type: "sine", from: 672, to: 1142, seconds: 0.05, delay: 0.53, attack: 0, gain: 0.28 },
        { type: "sine", from: 629, to: 1070, seconds: 0.05, delay: 0.52, attack: 0, gain: 0.28 },
        { type: "sine", from: 549, to: 933, seconds: 0.05, delay: 0.4, attack: 0, gain: 0.28 },
        { type: "sine", from: 799, to: 1359, seconds: 0.05, delay: 0.68, attack: 0, gain: 0.28 },
        { type: "noise", seconds: 0.4, attack: 0.06, gain: 0.32, filter: { type: "highpass", from: 1920, to: 4000, q: 1 } },
        { type: "pink", seconds: 0.4, attack: 0.05, gain: 0.2, filter: { type: "bandpass", from: 2560, to: 1760, q: 2 } },
      ],
    },
    // Takes a bolt: Ice chips off.
    ghoulFrozenGhoulHurt: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.8, filter: { type: "bandpass", from: 2160, to: 1440, q: 2 } },
        { type: "square", from: 1080, to: 360, seconds: 0.05, attack: 0, gain: 0.32 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.56, filter: { type: "bandpass", from: 3120, to: 2160, q: 3 } },
        { type: "sine", from: 3200, to: 3072, seconds: 0.2, attack: 0.002, gain: 0.16, delay: 0.05 },
        { type: "sine", from: 4100, to: 3936, seconds: 0.27, attack: 0.002, gain: 0.16, delay: 0.1 },
      ],
    },
    // Dies: Roar and crumble.
    ghoulFrozenGhoulDie: {
      layers: [
        { type: "sawtooth", from: 65, to: 83, seconds: 0.21, attack: 0.05, gain: 0.54, vibrato: { rate: 18, depth: 0.1 }, filter: { type: "lowpass", from: 300, to: 1540, q: 4 } },
        { type: "sawtooth", from: 83, to: 50, seconds: 0.42, delay: 0.18, attack: 0.02, gain: 0.54, vibrato: { rate: 18, depth: 0.12 }, filter: { type: "lowpass", from: 1540, to: 260, q: 4 } },
        { type: "sawtooth", from: 36, to: 26, seconds: 0.6, attack: 0.08, gain: 0.36, filter: { type: "lowpass", from: 500, to: 500, q: 1 } },
        { type: "brown", seconds: 0.6, attack: 0.06, gain: 0.48, filter: { type: "lowpass", from: 900, to: 180, q: 1 } },
        { type: "sine", from: 36, to: 25, seconds: 0.6, attack: 0.05, gain: 0.42 },
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.5, filter: { type: "bandpass", from: 1260, to: 840, q: 2 }, delay: 0.5 },
        { type: "square", from: 630, to: 210, seconds: 0.05, attack: 0, gain: 0.2, delay: 0.5 },
        { type: "noise", seconds: 0.04, delay: 0.56, attack: 0, gain: 0.35, filter: { type: "bandpass", from: 1820, to: 1260, q: 3 } },
      ],
    },
    // Ice Wraith: A shrieking spirit of the frost that hovers over you and dives. Its chill freezes you for 700 ms (Hot Cocoa is immune).
    // Wakes: Hollow moan on the wind.
    ghoulIceWraithWake: {
      layers: [
        { type: "triangle", from: 364, to: 473, seconds: 0.9, attack: 0.25, gain: 0.63, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 1960, to: 1260, q: 1 } },
        { type: "sine", from: 728, to: 946, seconds: 0.9, attack: 0.3, gain: 0.21 },
        { type: "pink", seconds: 0.9, attack: 0.3, gain: 0.18, filter: { type: "bandpass", from: 1456, to: 1092, q: 6 } },
        { type: "noise", seconds: 0.8, attack: 0.32000000000000006, gain: 0.21, filter: { type: "bandpass", from: 600, to: 1500, q: 2 } },
        { type: "pink", seconds: 0.8, attack: 0.4, gain: 0.12, filter: { type: "bandpass", from: 360, to: 1050, q: 1 } },
      ],
    },
    // Shrieks (wind-up): Double shriek.
    ghoulIceWraithWind: {
      layers: [
        { type: "sawtooth", from: 1400, to: 1960, seconds: 0.3, attack: 0.03, gain: 0.48, vibrato: { rate: 12, depth: 0.04 }, filter: { type: "bandpass", from: 2800, to: 3360, q: 4 } },
        { type: "sawtooth", from: 2100, to: 2940, seconds: 0.27, attack: 0.04, gain: 0.21, filter: { type: "bandpass", from: 4200, to: 4200, q: 5 } },
        { type: "noise", seconds: 0.24, attack: 0.03, gain: 0.18, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
        { type: "sawtooth", from: 1800, to: 2520, seconds: 0.35, attack: 0.03, gain: 0.48, vibrato: { rate: 12, depth: 0.04 }, filter: { type: "bandpass", from: 3600, to: 4320, q: 4 }, delay: 0.3 },
        { type: "sawtooth", from: 2700, to: 3780, seconds: 0.32, attack: 0.04, gain: 0.21, filter: { type: "bandpass", from: 5400, to: 5400, q: 5 }, delay: 0.3 },
        { type: "noise", seconds: 0.28, attack: 0.03, gain: 0.18, filter: { type: "highpass", from: 3000, to: 3000, q: 1 }, delay: 0.3 },
      ],
    },
    // Dives: Icy whoosh.
    ghoulIceWraithDive: {
      layers: [
        { type: "noise", seconds: 0.45, attack: 0.18000000000000002, gain: 0.63, filter: { type: "bandpass", from: 600, to: 4000, q: 2 } },
        { type: "pink", seconds: 0.45, attack: 0.225, gain: 0.36, filter: { type: "bandpass", from: 360, to: 2800, q: 1 } },
        { type: "sine", from: 2000, to: 1200, seconds: 0.4, attack: 0.16000000000000003, gain: 0.15, vibrato: { rate: 9, depth: 0.03 } },
        { type: "triangle", from: 3000, to: 1800, seconds: 0.4, attack: 0.16000000000000003, gain: 0.09 },
        { type: "pink", seconds: 0.4, attack: 0.2, gain: 0.05, filter: { type: "highpass", from: 4000, to: 6000, q: 1 } },
      ],
    },
    // Its chill freezes you: Frost creeping up, chime.
    ghoulIceWraithChill: {
      layers: [
        { type: "sine", from: 1100, to: 1650, seconds: 0.6, attack: 0.24, gain: 0.35, vibrato: { rate: 9, depth: 0.03 } },
        { type: "triangle", from: 1650, to: 2420, seconds: 0.6, attack: 0.24, gain: 0.21 },
        { type: "pink", seconds: 0.6, attack: 0.3, gain: 0.11, filter: { type: "highpass", from: 4000, to: 6000, q: 1 } },
        { type: "sine", from: 2093, to: 2072, seconds: 0.5, attack: 0.003, gain: 0.24, delay: 0.3 },
        { type: "sine", from: 5777, to: 5651, seconds: 0.3, attack: 0.003, gain: 0.12, delay: 0.3 },
        { type: "sine", from: 11302, to: 11093, seconds: 0.15, attack: 0.003, gain: 0.06, delay: 0.3 },
      ],
    },
    // Takes a bolt: Chime cracks.
    ghoulIceWraithHurt: {
      layers: [
        { type: "sine", from: 1400, to: 1386, seconds: 0.3, attack: 0.003, gain: 0.36 },
        { type: "sine", from: 3864, to: 3780, seconds: 0.18, attack: 0.003, gain: 0.18 },
        { type: "sine", from: 7560, to: 7420, seconds: 0.09, attack: 0.003, gain: 0.09 },
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.6, filter: { type: "bandpass", from: 2340, to: 1560, q: 2 } },
        { type: "square", from: 1170, to: 390, seconds: 0.05, attack: 0, gain: 0.24 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.42, filter: { type: "bandpass", from: 3380, to: 2340, q: 3 } },
      ],
    },
    // Dies: Scream into snow.
    ghoulIceWraithDie: {
      layers: [
        { type: "sawtooth", from: 1700, to: 1020, seconds: 0.6, attack: 0.03, gain: 0.48, vibrato: { rate: 12, depth: 0.04 }, filter: { type: "bandpass", from: 3400, to: 4080, q: 4 } },
        { type: "sawtooth", from: 2550, to: 1530, seconds: 0.54, attack: 0.04, gain: 0.21, filter: { type: "bandpass", from: 5100, to: 5100, q: 5 } },
        { type: "noise", seconds: 0.48, attack: 0.03, gain: 0.18, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
        { type: "noise", seconds: 0.7, attack: 0.27999999999999997, gain: 0.28, filter: { type: "bandpass", from: 2500, to: 500, q: 2 } },
        { type: "pink", seconds: 0.7, attack: 0.35, gain: 0.16, filter: { type: "bandpass", from: 1500, to: 350, q: 1 } },
      ],
    },
    // Frost Widow: A great spider in the roof of the Widow's Web. Her veil of frost guards her: melt it with a burning barrel, then hit her heart. She drops, spits webs, calls a blizzard, raises ice spikes and, enraged, calls wraiths.
    // Wakes: Deep chime tolls, then a snarl.
    ghoulFrostWidowWake: {
      layers: [
        { type: "sine", from: 330, to: 327, seconds: 0.9, attack: 0.003, gain: 0.42 },
        { type: "sine", from: 911, to: 891, seconds: 0.54, attack: 0.003, gain: 0.21 },
        { type: "sine", from: 1782, to: 1749, seconds: 0.27, attack: 0.003, gain: 0.11 },
        { type: "sawtooth", from: 58, to: 43, seconds: 0.5, attack: 0.03, gain: 0.63, vibrato: { rate: 6, depth: 0.2 }, filter: { type: "bandpass", from: 324, to: 180, q: 3 }, delay: 0.4 },
        { type: "noise", seconds: 0.45, attack: 0.02, gain: 0.35, filter: { type: "bandpass", from: 960, to: 420, q: 1.5 }, delay: 0.4 },
        { type: "square", from: 29, to: 25, seconds: 0.5, attack: 0.03, gain: 0.24, filter: { type: "lowpass", from: 300, to: 300, q: 1 }, delay: 0.4 },
      ],
    },
    // Drops to the floor: Crash through ice.
    ghoulFrostWidowDrop: {
      layers: [
        { type: "noise", seconds: 0.5, attack: 0, gain: 0.8, filter: { type: "lowpass", from: 2520, to: 90, q: 1 }, delay: 0.3 },
        { type: "sine", from: 96, to: 21, seconds: 0.4, attack: 0, gain: 0.72, delay: 0.3 },
        { type: "brown", seconds: 0.6, attack: 0.01, gain: 0.56, filter: { type: "lowpass", from: 240, to: 240, q: 1 }, delay: 0.3 },
        { type: "sine", from: 2560, to: 2458, seconds: 0.2, attack: 0.002, gain: 0.16, delay: 0.35 },
        { type: "sine", from: 3280, to: 3149, seconds: 0.27, attack: 0.002, gain: 0.16, delay: 0.39 },
        { type: "sine", from: 4160, to: 3994, seconds: 0.34, attack: 0.002, gain: 0.16, delay: 0.44 },
        { type: "sine", from: 2960, to: 2842, seconds: 0.2, attack: 0.002, gain: 0.16, delay: 0.49 },
      ],
    },
    // Climbs back up: Ice shivers as she leaves.
    ghoulFrostWidowRise: {
      layers: [
        { type: "sine", from: 800, to: 1200, seconds: 0.7, attack: 0.27999999999999997, gain: 0.3, vibrato: { rate: 9, depth: 0.03 } },
        { type: "triangle", from: 1200, to: 1760, seconds: 0.7, attack: 0.27999999999999997, gain: 0.18 },
        { type: "pink", seconds: 0.7, attack: 0.35, gain: 0.09, filter: { type: "highpass", from: 4000, to: 6000, q: 1 } },
        { type: "brown", seconds: 0.7, attack: 0.08, gain: 0.4, filter: { type: "lowpass", from: 180, to: 70, q: 1 } },
        { type: "sine", from: 48, to: 30, seconds: 0.7, attack: 0.05, gain: 0.32 },
      ],
    },
    // Rages: Screech and chitter.
    ghoulFrostWidowRage: {
      layers: [
        { type: "sawtooth", from: 700, to: 980, seconds: 0.7, attack: 0.03, gain: 0.56, vibrato: { rate: 12, depth: 0.04 }, filter: { type: "bandpass", from: 1400, to: 1680, q: 4 } },
        { type: "sawtooth", from: 1050, to: 1470, seconds: 0.63, attack: 0.04, gain: 0.24, filter: { type: "bandpass", from: 2100, to: 2100, q: 5 } },
        { type: "noise", seconds: 0.56, attack: 0.03, gain: 0.21, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
        { type: "square", from: 67, to: 47, seconds: 0.03, delay: 0.3, gain: 0.25, filter: { type: "bandpass", from: 100, to: 67, q: 4 } },
        { type: "square", from: 77, to: 54, seconds: 0.03, delay: 0.34, gain: 0.25, filter: { type: "bandpass", from: 116, to: 77, q: 4 } },
        { type: "square", from: 72, to: 50, seconds: 0.03, delay: 0.38, gain: 0.25, filter: { type: "bandpass", from: 107, to: 72, q: 4 } },
        { type: "square", from: 58, to: 41, seconds: 0.03, delay: 0.42, gain: 0.25, filter: { type: "bandpass", from: 87, to: 58, q: 4 } },
        { type: "square", from: 68, to: 48, seconds: 0.03, delay: 0.46, gain: 0.25, filter: { type: "bandpass", from: 103, to: 68, q: 4 } },
        { type: "square", from: 77, to: 54, seconds: 0.03, delay: 0.5, gain: 0.25, filter: { type: "bandpass", from: 116, to: 77, q: 4 } },
        { type: "square", from: 85, to: 59, seconds: 0.03, delay: 0.54, gain: 0.25, filter: { type: "bandpass", from: 127, to: 85, q: 4 } },
        { type: "square", from: 86, to: 60, seconds: 0.03, delay: 0.58, gain: 0.25, filter: { type: "bandpass", from: 129, to: 86, q: 4 } },
        { type: "square", from: 71, to: 50, seconds: 0.03, delay: 0.62, gain: 0.25, filter: { type: "bandpass", from: 107, to: 71, q: 4 } },
      ],
    },
    // Veil melts: Screech, melting drips.
    ghoulFrostWidowMelt: {
      layers: [
        { type: "sawtooth", from: 700, to: 420, seconds: 0.4, attack: 0.03, gain: 0.4, vibrato: { rate: 12, depth: 0.04 }, filter: { type: "bandpass", from: 1400, to: 1680, q: 4 } },
        { type: "sawtooth", from: 1050, to: 630, seconds: 0.36, attack: 0.04, gain: 0.18, filter: { type: "bandpass", from: 2100, to: 2100, q: 5 } },
        { type: "noise", seconds: 0.32, attack: 0.03, gain: 0.15, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
        { type: "sine", from: 749, to: 1273, seconds: 0.05, delay: 0.69, attack: 0, gain: 0.24 },
        { type: "sine", from: 335, to: 570, seconds: 0.05, delay: 0.14, attack: 0, gain: 0.24 },
        { type: "sine", from: 625, to: 1063, seconds: 0.05, delay: 0.4, attack: 0, gain: 0.24 },
        { type: "sine", from: 319, to: 542, seconds: 0.05, delay: 0.18, attack: 0, gain: 0.24 },
        { type: "sine", from: 718, to: 1221, seconds: 0.05, delay: 0.3, attack: 0, gain: 0.24 },
        { type: "sine", from: 685, to: 1164, seconds: 0.05, delay: 0.49, attack: 0, gain: 0.24 },
        { type: "noise", seconds: 0.5, attack: 0.06, gain: 0.32, filter: { type: "highpass", from: 1440, to: 3000, q: 1 }, delay: 0.2 },
        { type: "pink", seconds: 0.5, attack: 0.05, gain: 0.2, filter: { type: "bandpass", from: 1920, to: 1320, q: 2 }, delay: 0.2 },
      ],
    },
    // Veil grows back: Frost creeps over, chime.
    ghoulFrostWidowUp: {
      layers: [
        { type: "sine", from: 900, to: 1350, seconds: 0.7, attack: 0.27999999999999997, gain: 0.35, vibrato: { rate: 9, depth: 0.03 } },
        { type: "triangle", from: 1350, to: 1980, seconds: 0.7, attack: 0.27999999999999997, gain: 0.21 },
        { type: "pink", seconds: 0.7, attack: 0.35, gain: 0.11, filter: { type: "highpass", from: 4000, to: 6000, q: 1 } },
        { type: "sine", from: 1568, to: 1552, seconds: 0.5, attack: 0.003, gain: 0.24, delay: 0.5 },
        { type: "sine", from: 4328, to: 4234, seconds: 0.3, attack: 0.003, gain: 0.12, delay: 0.5 },
        { type: "sine", from: 8467, to: 8310, seconds: 0.15, attack: 0.003, gain: 0.06, delay: 0.5 },
      ],
    },
    // Blizzard warning: Wind rising.
    ghoulFrostWidowGust: {
      layers: [
        { type: "noise", seconds: 1, attack: 0.4, gain: 0.56, filter: { type: "bandpass", from: 300, to: 1600, q: 2 } },
        { type: "pink", seconds: 1, attack: 0.5, gain: 0.32, filter: { type: "bandpass", from: 180, to: 1120, q: 1 } },
        { type: "triangle", from: 90, to: 117, seconds: 1, attack: 0.25, gain: 0.27, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 2100, to: 1350, q: 1 } },
        { type: "sine", from: 180, to: 234, seconds: 1, attack: 0.3, gain: 0.09 },
        { type: "pink", seconds: 1, attack: 0.3, gain: 0.08, filter: { type: "bandpass", from: 360, to: 270, q: 6 } },
      ],
    },
    // Blizzard blows: Full gale.
    ghoulFrostWidowBlow: {
      layers: [
        { type: "noise", seconds: 1.1, attack: 0.44000000000000006, gain: 0.7, filter: { type: "bandpass", from: 500, to: 2500, q: 2 } },
        { type: "pink", seconds: 1.1, attack: 0.55, gain: 0.4, filter: { type: "bandpass", from: 300, to: 1750, q: 1 } },
        { type: "brown", seconds: 1, attack: 0.08, gain: 0.4, filter: { type: "lowpass", from: 180, to: 70, q: 1 } },
        { type: "sine", from: 48, to: 30, seconds: 1, attack: 0.05, gain: 0.32 },
      ],
    },
    // Spike warning: Tick, tick, tick.
    ghoulFrostWidowWarn: {
      layers: [
        { type: "triangle", from: 900, to: 765, seconds: 0.22, attack: 0, gain: 0.45 },
        { type: "sine", from: 2430, to: 2250, seconds: 0.12, attack: 0, gain: 0.18 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.25, filter: { type: "bandpass", from: 3600, to: 3600, q: 2 } },
        { type: "triangle", from: 1000, to: 850, seconds: 0.22, attack: 0, gain: 0.54, delay: 0.2 },
        { type: "sine", from: 2700, to: 2500, seconds: 0.12, attack: 0, gain: 0.21, delay: 0.2 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.3, filter: { type: "bandpass", from: 4000, to: 4000, q: 2 }, delay: 0.2 },
        { type: "triangle", from: 1150, to: 978, seconds: 0.22, attack: 0, gain: 0.63, delay: 0.4 },
        { type: "sine", from: 3105, to: 2875, seconds: 0.12, attack: 0, gain: 0.24, delay: 0.4 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.35, filter: { type: "bandpass", from: 4600, to: 4600, q: 2 }, delay: 0.4 },
        { type: "triangle", from: 1300, to: 1105, seconds: 0.22, attack: 0, gain: 0.72, delay: 0.55 },
        { type: "sine", from: 3510, to: 3250, seconds: 0.12, attack: 0, gain: 0.28, delay: 0.55 },
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.4, filter: { type: "bandpass", from: 5200, to: 5200, q: 2 }, delay: 0.55 },
      ],
    },
    // Spike erupts: Stab and shatter.
    ghoulFrostWidowSpike: {
      layers: [
        { type: "noise", seconds: 0.15, attack: 0.05, gain: 0.56, filter: { type: "bandpass", from: 450, to: 2700, q: 1.5 } },
        { type: "noise", seconds: 0.06, attack: 0.001, gain: 0.72, delay: 0.03, filter: { type: "highpass", from: 2000, to: 4000, q: 1 } },
        { type: "sawtooth", from: 1760, to: 208, seconds: 0.22, attack: 0.002, gain: 0.4, delay: 0.03, filter: { type: "bandpass", from: 1440, to: 480, q: 4 } },
        { type: "noise", seconds: 0.05, attack: 0.001, gain: 0.48, delay: 0.1, filter: { type: "bandpass", from: 2800, to: 2000, q: 3 } },
        { type: "sine", from: 96, to: 40, seconds: 0.25, attack: 0.003, gain: 0.4, delay: 0.05 },
        { type: "sine", from: 3200, to: 3072, seconds: 0.2, attack: 0.002, gain: 0.16, delay: 0.1 },
        { type: "sine", from: 4100, to: 3936, seconds: 0.27, attack: 0.002, gain: 0.16, delay: 0.15 },
        { type: "sine", from: 5200, to: 4992, seconds: 0.34, attack: 0.002, gain: 0.16, delay: 0.19 },
      ],
    },
    // Web wind-up: Low burble.
    ghoulFrostWidowSpit: {
      layers: [
        { type: "sine", from: 109, to: 84, seconds: 0.7, attack: 0.05, gain: 0.72, vibrato: { rate: 9, depth: 0.4 } },
        { type: "brown", seconds: 0.7, attack: 0.05, gain: 0.48, filter: { type: "lowpass", from: 700, to: 350, q: 1 } },
        { type: "noise", seconds: 0.5, attack: 0.06, gain: 0.24, filter: { type: "highpass", from: 1200, to: 2500, q: 1 }, delay: 0.2 },
        { type: "pink", seconds: 0.5, attack: 0.05, gain: 0.15, filter: { type: "bandpass", from: 1600, to: 1100, q: 2 }, delay: 0.2 },
      ],
    },
    // Web spat: Sticky spit.
    ghoulFrostWidowShot: {
      layers: [
        { type: "noise", seconds: 0.1, attack: 0, gain: 0.72, filter: { type: "highpass", from: 1620, to: 1620, q: 1 } },
        { type: "sine", from: 630, to: 135, seconds: 0.16, delay: 0.02, gain: 0.54 },
        { type: "brown", seconds: 0.12, attack: 0, gain: 0.45, filter: { type: "lowpass", from: 378, to: 378, q: 1 } },
        { type: "noise", seconds: 0.3, attack: 0.11, gain: 0.32, filter: { type: "bandpass", from: 360, to: 2160, q: 1.5 }, delay: 0.05 },
      ],
    },
    // Web lands: Wet splat, stretch.
    ghoulFrostWidowLand: {
      layers: [
        { type: "noise", seconds: 0.28, attack: 0, gain: 0.72, filter: { type: "lowpass", from: 2340, to: 180, q: 1 } },
        { type: "square", from: 126, to: 36, seconds: 0.16, attack: 0, gain: 0.4, filter: { type: "lowpass", from: 540, to: 540, q: 1 } },
        { type: "sine", from: 810, to: 1170, seconds: 0.05, delay: 0.2, gain: 0.2 },
        { type: "sine", from: 684, to: 990, seconds: 0.05, delay: 0.34, gain: 0.14 },
        { type: "sawtooth", from: 400, to: 540, seconds: 0.3, attack: 0.08, gain: 0.15, delay: 0.1, filter: { type: "bandpass", from: 1600, to: 1200, q: 8 }, vibrato: { rate: 7, depth: 0.2 } },
        { type: "pink", seconds: 0.3, attack: 0.1, gain: 0.06, delay: 0.1, filter: { type: "bandpass", from: 2000, to: 1600, q: 6 } },
        { type: "sine", from: 200, to: 160, seconds: 0.3, attack: 0.1, gain: 0.12, delay: 0.1 },
      ],
    },
    // Calls the wraiths: Eerie chorus.
    ghoulFrostWidowCall: {
      layers: [
        { type: "sine", from: 520, to: 780, seconds: 0.38, attack: 0.15, gain: 0.48, vibrato: { rate: 6, depth: 0.04 } },
        { type: "sine", from: 780, to: 364, seconds: 0.56, delay: 0.34, attack: 0.04, gain: 0.48, vibrato: { rate: 6, depth: 0.05 } },
        { type: "triangle", from: 1045, to: 728, seconds: 0.9, attack: 0.3, gain: 0.12 },
        { type: "pink", seconds: 0.9, attack: 0.3, gain: 0.12, filter: { type: "bandpass", from: 1040, to: 1040, q: 8 } },
        { type: "sine", from: 780, to: 1170, seconds: 0.34, attack: 0.15, gain: 0.4, vibrato: { rate: 6, depth: 0.04 }, delay: 0.15 },
        { type: "sine", from: 1170, to: 546, seconds: 0.5, delay: 0.45, attack: 0.04, gain: 0.4, vibrato: { rate: 6, depth: 0.05 } },
        { type: "triangle", from: 1568, to: 1092, seconds: 0.8, attack: 0.3, gain: 0.1, delay: 0.15 },
        { type: "pink", seconds: 0.8, attack: 0.3, gain: 0.1, filter: { type: "bandpass", from: 1560, to: 1560, q: 8 }, delay: 0.15 },
      ],
    },
    // Barrel kicked: Metal bong, rolling.
    ghoulFrostWidowKick: {
      layers: [
        { type: "sine", from: 300, to: 297, seconds: 0.4, attack: 0.003, gain: 0.3 },
        { type: "sine", from: 828, to: 810, seconds: 0.24, attack: 0.003, gain: 0.15 },
        { type: "sine", from: 1620, to: 1590, seconds: 0.12, attack: 0.003, gain: 0.08 },
        { type: "brown", seconds: 0.6, attack: 0.08, gain: 0.4, filter: { type: "lowpass", from: 180, to: 70, q: 1 }, delay: 0.1 },
        { type: "sine", from: 48, to: 30, seconds: 0.6, attack: 0.05, gain: 0.32, delay: 0.1 },
      ],
    },
    // Barrel bursts: Metal clang and flare.
    ghoulFrostWidowBurst: {
      layers: [
        { type: "sine", from: 240, to: 238, seconds: 0.5, attack: 0.003, gain: 0.36 },
        { type: "sine", from: 662, to: 648, seconds: 0.3, attack: 0.003, gain: 0.18 },
        { type: "sine", from: 1296, to: 1272, seconds: 0.15, attack: 0.003, gain: 0.09 },
        { type: "noise", seconds: 0.5, attack: 0, gain: 0.6, filter: { type: "lowpass", from: 5040, to: 180, q: 1 }, delay: 0.03 },
        { type: "sine", from: 192, to: 42, seconds: 0.4, attack: 0, gain: 0.54, delay: 0.03 },
        { type: "brown", seconds: 0.6, attack: 0.01, gain: 0.42, filter: { type: "lowpass", from: 480, to: 480, q: 1 }, delay: 0.03 },
        { type: "noise", seconds: 0.5, attack: 0.05, gain: 0.3, delay: 0.1, filter: { type: "bandpass", from: 900, to: 2500, q: 1 } },
        { type: "noise", seconds: 0.02, attack: 0.001, gain: 0.4, delay: 0.15, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
        { type: "noise", seconds: 0.02, attack: 0.001, gain: 0.35, delay: 0.24, filter: { type: "highpass", from: 3600, to: 3600, q: 1 } },
        { type: "noise", seconds: 0.02, attack: 0.001, gain: 0.4, delay: 0.37, filter: { type: "highpass", from: 3200, to: 3200, q: 1 } },
      ],
    },
    // Takes a hit: Angry screech.
    ghoulFrostWidowHurt: {
      layers: [
        { type: "sawtooth", from: 500, to: 300, seconds: 0.3, attack: 0.03, gain: 0.56, vibrato: { rate: 12, depth: 0.04 }, filter: { type: "bandpass", from: 1000, to: 1200, q: 4 } },
        { type: "sawtooth", from: 750, to: 450, seconds: 0.27, attack: 0.04, gain: 0.24, filter: { type: "bandpass", from: 1500, to: 1500, q: 5 } },
        { type: "noise", seconds: 0.24, attack: 0.03, gain: 0.21, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
      ],
    },
    // Weak spot hit: Squelch and shriek.
    ghoulFrostWidowWeak: {
      layers: [
        { type: "brown", seconds: 0.3, attack: 0.01, gain: 0.8, filter: { type: "lowpass", from: 1040, to: 120, q: 1 } },
        { type: "sine", from: 208, to: 48, seconds: 0.22, attack: 0.01, gain: 0.56 },
        { type: "noise", seconds: 0.12, attack: 0.01, gain: 0.32, filter: { type: "bandpass", from: 720, to: 240, q: 3 } },
        { type: "sawtooth", from: 700, to: 420, seconds: 0.5, attack: 0.03, gain: 0.56, vibrato: { rate: 12, depth: 0.04 }, filter: { type: "bandpass", from: 1400, to: 1680, q: 4 } },
        { type: "sawtooth", from: 1050, to: 630, seconds: 0.45, attack: 0.04, gain: 0.24, filter: { type: "bandpass", from: 2100, to: 2100, q: 5 } },
        { type: "noise", seconds: 0.4, attack: 0.03, gain: 0.21, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
      ],
    },
    // Dies: Long wail, chimes fade.
    ghoulFrostWidowDie: {
      layers: [
        { type: "sine", from: 260, to: 390, seconds: 0.46, attack: 0.15, gain: 0.56, vibrato: { rate: 6, depth: 0.04 } },
        { type: "sine", from: 390, to: 182, seconds: 0.68, delay: 0.42, attack: 0.04, gain: 0.56, vibrato: { rate: 6, depth: 0.05 } },
        { type: "triangle", from: 523, to: 364, seconds: 1.1, attack: 0.3, gain: 0.14 },
        { type: "pink", seconds: 1.1, attack: 0.3, gain: 0.14, filter: { type: "bandpass", from: 520, to: 520, q: 8 } },
        { type: "sine", from: 523, to: 518, seconds: 0.7, attack: 0.003, gain: 0.24, delay: 0.5 },
        { type: "sine", from: 1443, to: 1412, seconds: 0.42, attack: 0.003, gain: 0.12, delay: 0.5 },
        { type: "sine", from: 2824, to: 2772, seconds: 0.21, attack: 0.003, gain: 0.06, delay: 0.5 },
        { type: "sine", from: 392, to: 388, seconds: 0.4, attack: 0.003, gain: 0.18, delay: 0.75 },
        { type: "sine", from: 1082, to: 1058, seconds: 0.24, attack: 0.003, gain: 0.09, delay: 0.75 },
        { type: "sine", from: 2117, to: 2078, seconds: 0.12, attack: 0.003, gain: 0.05, delay: 0.75 },
      ],
    },
    // Thin Ice: The lake itself: thin ice cracks when you stand on it, breaks and drops you through, and freezes over again six seconds later.
    // Cracks: Long spidering crackle.
    ghoulThinIceCrack: {
      layers: [
        { type: "noise", seconds: 0.06, attack: 0.001, gain: 0.54, filter: { type: "highpass", from: 2750, to: 5500, q: 1 } },
        { type: "sawtooth", from: 2420, to: 286, seconds: 0.22, attack: 0.002, gain: 0.3, filter: { type: "bandpass", from: 1980, to: 660, q: 4 } },
        { type: "noise", seconds: 0.05, attack: 0.001, gain: 0.36, delay: 0.07, filter: { type: "bandpass", from: 3850, to: 2750, q: 3 } },
        { type: "sine", from: 132, to: 55, seconds: 0.25, attack: 0.003, gain: 0.3, delay: 0.02 },
        { type: "noise", seconds: 0.06, attack: 0.001, gain: 0.45, delay: 0.12, filter: { type: "highpass", from: 3250, to: 6500, q: 1 } },
        { type: "sawtooth", from: 2860, to: 338, seconds: 0.22, attack: 0.002, gain: 0.25, delay: 0.12, filter: { type: "bandpass", from: 2340, to: 780, q: 4 } },
        { type: "noise", seconds: 0.05, attack: 0.001, gain: 0.3, delay: 0.19, filter: { type: "bandpass", from: 4550, to: 3250, q: 3 } },
        { type: "sine", from: 156, to: 65, seconds: 0.25, attack: 0.003, gain: 0.25, delay: 0.14 },
        { type: "noise", seconds: 0.06, attack: 0.001, gain: 0.36, delay: 0.25, filter: { type: "highpass", from: 3750, to: 7500, q: 1 } },
        { type: "sawtooth", from: 3300, to: 390, seconds: 0.22, attack: 0.002, gain: 0.2, delay: 0.25, filter: { type: "bandpass", from: 2700, to: 900, q: 4 } },
        { type: "noise", seconds: 0.05, attack: 0.001, gain: 0.24, delay: 0.32, filter: { type: "bandpass", from: 5250, to: 3750, q: 3 } },
        { type: "sine", from: 180, to: 75, seconds: 0.25, attack: 0.003, gain: 0.2, delay: 0.27 },
      ],
    },
    // Breaks: Smash and splash.
    ghoulThinIceBreak: {
      layers: [
        { type: "noise", seconds: 0.5, attack: 0, gain: 0.8, filter: { type: "lowpass", from: 4200, to: 150, q: 1 } },
        { type: "sine", from: 160, to: 35, seconds: 0.4, attack: 0, gain: 0.72 },
        { type: "brown", seconds: 0.6, attack: 0.01, gain: 0.56, filter: { type: "lowpass", from: 400, to: 400, q: 1 } },
        { type: "noise", seconds: 0.06, attack: 0.001, gain: 0.72, filter: { type: "highpass", from: 2000, to: 4000, q: 1 } },
        { type: "sawtooth", from: 1760, to: 208, seconds: 0.22, attack: 0.002, gain: 0.4, filter: { type: "bandpass", from: 1440, to: 480, q: 4 } },
        { type: "noise", seconds: 0.05, attack: 0.001, gain: 0.48, delay: 0.07, filter: { type: "bandpass", from: 2800, to: 2000, q: 3 } },
        { type: "sine", from: 96, to: 40, seconds: 0.25, attack: 0.003, gain: 0.4, delay: 0.02 },
        { type: "noise", seconds: 0.28, attack: 0, gain: 0.54, filter: { type: "lowpass", from: 2080, to: 160, q: 1 }, delay: 0.12 },
        { type: "square", from: 112, to: 32, seconds: 0.16, attack: 0, gain: 0.3, filter: { type: "lowpass", from: 480, to: 480, q: 1 }, delay: 0.12 },
        { type: "sine", from: 720, to: 1040, seconds: 0.05, delay: 0.32, gain: 0.15 },
        { type: "sine", from: 608, to: 880, seconds: 0.05, delay: 0.46, gain: 0.11 },
      ],
    },
    // Freezes over: Soft crystal chime.
    ghoulThinIceBack: {
      layers: [
        { type: "sine", from: 1976, to: 1956, seconds: 0.5, attack: 0.003, gain: 0.3 },
        { type: "sine", from: 5454, to: 5335, seconds: 0.3, attack: 0.003, gain: 0.15 },
        { type: "sine", from: 10670, to: 10473, seconds: 0.15, attack: 0.003, gain: 0.08 },
        { type: "sine", from: 2000, to: 3000, seconds: 0.4, attack: 0.16000000000000003, gain: 0.15, vibrato: { rate: 9, depth: 0.03 } },
        { type: "triangle", from: 3000, to: 4400, seconds: 0.4, attack: 0.16000000000000003, gain: 0.09 },
        { type: "pink", seconds: 0.4, attack: 0.2, gain: 0.05, filter: { type: "highpass", from: 4000, to: 6000, q: 1 } },
      ],
    },
    // Burning Barrel: Three oil barrels stand in the Widow's Web, burning. Kick one with a shot and it rolls at her and melts her veil.
    // Burns: Steady crackle.
    ghoulBarrelBurn: {
      layers: [
        { type: "noise", seconds: 0.9, attack: 0.05, gain: 0.3, filter: { type: "bandpass", from: 900, to: 2500, q: 1 } },
        { type: "noise", seconds: 0.02, attack: 0.001, gain: 0.4, delay: 0.05, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
        { type: "noise", seconds: 0.02, attack: 0.001, gain: 0.35, delay: 0.14, filter: { type: "highpass", from: 3600, to: 3600, q: 1 } },
        { type: "noise", seconds: 0.02, attack: 0.001, gain: 0.4, delay: 0.27, filter: { type: "highpass", from: 3200, to: 3200, q: 1 } },
        { type: "noise", seconds: 0.6, attack: 0.05, gain: 0.24, delay: 0.3, filter: { type: "bandpass", from: 900, to: 2500, q: 1 } },
        { type: "noise", seconds: 0.02, attack: 0.001, gain: 0.32, delay: 0.35, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
        { type: "noise", seconds: 0.02, attack: 0.001, gain: 0.28, delay: 0.44, filter: { type: "highpass", from: 3600, to: 3600, q: 1 } },
        { type: "noise", seconds: 0.02, attack: 0.001, gain: 0.32, delay: 0.57, filter: { type: "highpass", from: 3200, to: 3200, q: 1 } },
      ],
    },
    // Road Flare: The stage weapon (tap twice): a lobbed flare that lands as a pool of fire, burning monsters, lighting shades and melting the Widow's veil.
    // Throw: Spitting sparks.
    ghoulFlareThrow: {
      layers: [
        { type: "noise", seconds: 0.5, attack: 0.05, gain: 0.36, filter: { type: "bandpass", from: 900, to: 2500, q: 1 } },
        { type: "noise", seconds: 0.02, attack: 0.001, gain: 0.48, delay: 0.05, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
        { type: "noise", seconds: 0.02, attack: 0.001, gain: 0.42, delay: 0.14, filter: { type: "highpass", from: 3600, to: 3600, q: 1 } },
        { type: "noise", seconds: 0.02, attack: 0.001, gain: 0.48, delay: 0.27, filter: { type: "highpass", from: 3200, to: 3200, q: 1 } },
        { type: "sine", from: 600, to: 1200, seconds: 0.4, attack: 0.04, gain: 0.3, vibrato: { rate: 6, depth: 0.03 } },
        { type: "sawtooth", from: 780, to: 540, seconds: 0.1, attack: 0.01, gain: 0.27, vibrato: { rate: 6, depth: 0.1 }, filter: { type: "lowpass", from: 4125, to: 4125, q: 1 } },
        { type: "brown", seconds: 0.08, attack: 0.01, gain: 0.18, filter: { type: "lowpass", from: 750, to: 750, q: 1 } },
      ],
    },
    // Lands and burns: Thump and sputter.
    ghoulFlareLand: {
      layers: [
        { type: "sine", from: 143, to: 52, seconds: 0.25, attack: 0, gain: 0.7 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.56, filter: { type: "lowpass", from: 416, to: 416, q: 1 } },
        { type: "noise", seconds: 0.8, attack: 0.05, gain: 0.36, delay: 0.08, filter: { type: "bandpass", from: 900, to: 2500, q: 1 } },
        { type: "noise", seconds: 0.02, attack: 0.001, gain: 0.48, delay: 0.13, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
        { type: "noise", seconds: 0.02, attack: 0.001, gain: 0.42, delay: 0.22, filter: { type: "highpass", from: 3600, to: 3600, q: 1 } },
        { type: "noise", seconds: 0.02, attack: 0.001, gain: 0.48, delay: 0.35, filter: { type: "highpass", from: 3200, to: 3200, q: 1 } },
        { type: "noise", seconds: 0.4, attack: 0.06, gain: 0.24, filter: { type: "highpass", from: 3360, to: 7000, q: 1 }, delay: 0.3 },
        { type: "pink", seconds: 0.4, attack: 0.05, gain: 0.15, filter: { type: "bandpass", from: 4480, to: 3080, q: 2 }, delay: 0.3 },
      ],
    },
    // Hot Cocoa: The stage power-up: for 10 seconds you do not slide, are not frozen, and thin ice cracks at half speed.
    // Picked up: Cozy rising notes.
    ghoulCocoaActive: {
      layers: [
        { type: "triangle", seconds: 0.6, attack: 0.01, gain: 0.7, notes: [392, 494, 587, 784] },
        { type: "sine", seconds: 0.6, attack: 0.01, gain: 0.25, notes: [784, 988, 1175, 1568] },
      ],
    },
  },
  music: {
    // Ice Fishing Huts: taut lines (plucked). Short, dry plucks like a
    // fishing line plucked taut: the figure snaps in staccato pairs over a
    // syncopated bass, with ticks on the offbeats and a rim-shot backbeat.
    // Sharper and a bit anxious compared with the bells, and the most
    // rhythmic of the quiet options. At high dread a bowed twang slides in
    // and the kit stomps.
    ghoulHuts: {
      bpm: 98,
      rush: 6,
      voices: {
        pluck: { wave: "pulse", duty: 0.125, gain: 0.15, decay: 0.03, sustain: 0.1 },
        pizz: { wave: "sine", gain: 0.18, decay: 0.06, sustain: 0.2, from: 0.2 },
        bass: { wave: "triangle", gain: 0.36, decay: 0.1, sustain: 0.5 },
        tick: { kit: true, gain: 0.1, from: 0.1 },
        snap: { kit: true, gain: 0.16, from: 0.5 },
        wind: { kit: true, gain: 0.04 },
        bow: { wave: "sawtooth", gain: 0.04, decay: 0.3, sustain: 1, from: 0.8, vibrato: { rate: 7, depth: 0.02, delay: 0.2 } },
        stomp: { kit: true, gain: 0.24, from: 0.9 },
      },
      patterns: {
        A: {
          pluck:
          "D5 . . D5 F5 . . F5 A5 . . A5 . . . . | G5 . . G5 F5 . . F5 E5 . . E5 . . . . | " +
          "F5 . . F5 D5 . . D5 Bb4 . . Bb4 . . . . | C#5 . . C#5 . . . . A4 . . A4 . . . .",
          pizz:
          ". D4 . . . F4 . . . A4 . . . . . . | . G4 . . . F4 . . . E4 . . . . . . | " +
          ". F4 . . . D4 . . . Bb3 . . . . . . | . C#4 . . . . . . . A3 . . . . . .",
          bass:
          "D3 - . . . . D3 - . . D3 - . . . . | C3 - . . . . C3 - . . C3 - . . . . | " +
          "Bb2 - . . . . Bb2 - . . Bb2 - . . . . | A2 - . . . . A2 - . . A2 - . . . .",
          tick:
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h . | " +
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h .",
          snap:
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . . | " +
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . .",
          wind:
          "o . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          bow:
          "D4^037 - - - - - - - - - - - - - - - | C4^047 - - - - - - - - - - - - - - - | " +
          "Bb3^047 - - - - - - - - - - - - - - - | A3^047 - - - - - - - - - - - - - - -",
          stomp:
          "k . . . k . . . k . . . k . k k | k . . . k . . . k . . . k . k k | " +
          "k . . . k . . . k . . . k . k k | k . . . k . . . k . . . k . k k",
        },
        B: {
          pluck:
          "A5 . . A5 F5 . . F5 D5 . . D5 . . . . | G5 . . G5 E5 . . E5 C5 . . C5 . . . . | " +
          "D5 . . D5 Bb4 . . Bb4 F4 . . F4 . . . . | E5 . . E5 C#5 . . C#5 A4 . . A4 . . . .",
          pizz:
          ". A4 . . . F4 . . . D4 . . . . . . | . G4 . . . E4 . . . C4 . . . . . . | " +
          ". D4 . . . Bb3 . . . F3 . . . . . . | . E4 . . . C#4 . . . A3 . . . . . .",
          bass:
          "D3 - . . . . D3 - . . D3 - . . . . | C3 - . . . . C3 - . . C3 - . . . . | " +
          "Bb2 - . . . . Bb2 - . . Bb2 - . . . . | A2 - . . . . A2 - . . A2 - . . . .",
          tick:
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h . | " +
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h .",
          snap:
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . . | " +
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . .",
          wind:
          "o . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          bow:
          "D4^037 - - - - - - - - - - - - - - - | C4^047 - - - - - - - - - - - - - - - | " +
          "Bb3^047 - - - - - - - - - - - - - - - | A3^047 - - - - - - - - - - - - - - -",
          stomp:
          "k . . . k . . . k . . . k . k k | k . . . k . . . k . . . k . k k | " +
          "k . . . k . . . k . . . k . k k | k . . . k . . . k . . . k . k k",
        },
        C: {
          pluck:
          "Bb4 . . Bb4 D5 . . D5 G5 . . G5 . . . . | A4 . . A4 C5 . . C5 F5 . . F5 . . . . | " +
          "G5 . . G5 Bb4 . . Bb4 Eb5 . . Eb5 . . . . | A5 . . A5 E5 . . E5 C#5 . . C#5 . . . .",
          pizz:
          ". Bb3 . . . D4 . . . G4 . . . . . . | . A3 . . . C4 . . . F4 . . . . . . | " +
          ". G4 . . . Bb3 . . . Eb4 . . . . . . | . A4 . . . E4 . . . C#4 . . . . . .",
          bass:
          "G2 - . . . . G2 - . . G2 - . . . . | F2 - . . . . F2 - . . F2 - . . . . | " +
          "Eb2 - . . . . Eb2 - . . Eb2 - . . . . | A2 - . . . . A2 - . . A2 - . . . .",
          tick:
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h . | " +
          ". . h . . . h . . . h . . . h . | . . h . . . h . . . h . . . h .",
          snap:
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . . | " +
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . .",
          wind:
          "o . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          bow:
          "G3^037 - - - - - - - - - - - - - - - | F3^047 - - - - - - - - - - - - - - - | " +
          "Eb3^047 - - - - - - - - - - - - - - - | A3^047 - - - - - - - - - - - - - - -",
          stomp:
          "k . . . k . . . k . . . k . k k | k . . . k . . . k . . . k . k k | " +
          "k . . . k . . . k . . . k . k k | k . . . k . . . k . . . k . k k",
        },
      },
      order: ["A", "B", "A", "C", "A", "B", "A", "C"],
    },
    // Snowbound Lodge: out-of-tune upright piano. A neglected upright piano:
    // the right hand plays the figure with a second, wavering voice slightly
    // behind it so every note is a little drunk, over a plain left hand and
    // sparse chords. Human, sad and a bit dusty. At high dread a cold bell
    // doubles the top and a long string note rubs underneath.
    ghoulLodge: {
      bpm: 73,
      rush: 6,
      voices: {
        pf: { wave: "pulse", duty: 0.25, gain: 0.16, decay: 0.1, sustain: 0.2 },
        pf2: { wave: "pulse", duty: 0.25, gain: 0.08, decay: 0.12, sustain: 0.2, from: 0.1, vibrato: { rate: 2.6, depth: 0.012, delay: 0 } },
        left: { wave: "triangle", gain: 0.36, decay: 0.2, sustain: 0.5 },
        chord: { wave: "pulse", duty: 0.5, gain: 0.05, decay: 0.05, sustain: 0.3, from: 0.25 },
        hush: { kit: true, gain: 0.04 },
        tap: { kit: true, gain: 0.15, from: 0.5 },
        bell: { wave: "sine", gain: 0.07, decay: 0.4, sustain: 0.2, from: 0.8 },
        rub: { wave: "sawtooth", gain: 0.04, decay: 0.3, sustain: 1, from: 0.9, vibrato: { rate: 4, depth: 0.02, delay: 0.2 } },
      },
      patterns: {
        A: {
          pf:
          "D5 - . . F5 - . . A5 - . . . . . . | G5 - . . F5 - . . E5 - . . . . . . | " +
          "F5 - . . D5 - . . Bb4 - . . . . . . | C#5 - . . . . . . A4 - . . . . . .",
          pf2:
          ". . D5 . . . F5 . . . A5 . . . . . | . . G5 . . . F5 . . . E5 . . . . . | " +
          ". . F5 . . . D5 . . . Bb4 . . . . . | . . C#5 . . . . . . . A4 . . . . .",
          left:
          "D3 - - - - - - - A3 - - - - - - - | C3 - - - - - - - G3 - - - - - - - | " +
          "Bb2 - - - - - - - F3 - - - - - - - | A2 - - - - - - - E3 - - - - - - -",
          chord:
          "D4^037 - - - - - - - D4^037 - - - - - - - | C4^047 - - - - - - - C4^047 - - - - - - - | " +
          "Bb3^047 - - - - - - - Bb3^047 - - - - - - - | A3^047 - - - - - - - A3^047 - - - - - - -",
          hush:
          "o . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          tap:
          "k . . . . . s . k . . . . . s . | k . . . . . s . k . . . . . s . | " +
          "k . . . . . s . k . . . . . s . | k . . . . . s . k . . . . . s .",
          bell:
          "D6 - . . F6 - . . A6 - . . . . . . | G6 - . . F6 - . . E6 - . . . . . . | " +
          "F6 - . . D6 - . . Bb5 - . . . . . . | C#6 - . . . . . . A5 - . . . . . .",
          rub:
          "C#4^037 - - - - - - - - - - - - - - - | B3^047 - - - - - - - - - - - - - - - | " +
          "A3^047 - - - - - - - - - - - - - - - | Ab3^047 - - - - - - - - - - - - - - -",
        },
        B: {
          pf:
          "A5 - . . F5 - . . D5 - . . . . . . | G5 - . . E5 - . . C5 - . . . . . . | " +
          "D5 - . . Bb4 - . . F4 - . . . . . . | E5 - . . C#5 - . . A4 - . . . . . .",
          pf2:
          ". . A5 . . . F5 . . . D5 . . . . . | . . G5 . . . E5 . . . C5 . . . . . | " +
          ". . D5 . . . Bb4 . . . F4 . . . . . | . . E5 . . . C#5 . . . A4 . . . . .",
          left:
          "D3 - - - - - - - A3 - - - - - - - | C3 - - - - - - - G3 - - - - - - - | " +
          "Bb2 - - - - - - - F3 - - - - - - - | A2 - - - - - - - E3 - - - - - - -",
          chord:
          "D4^037 - - - - - - - D4^037 - - - - - - - | C4^047 - - - - - - - C4^047 - - - - - - - | " +
          "Bb3^047 - - - - - - - Bb3^047 - - - - - - - | A3^047 - - - - - - - A3^047 - - - - - - -",
          hush:
          "o . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          tap:
          "k . . . . . s . k . . . . . s . | k . . . . . s . k . . . . . s . | " +
          "k . . . . . s . k . . . . . s . | k . . . . . s . k . . . . . s .",
          bell:
          "A6 - . . F6 - . . D6 - . . . . . . | G6 - . . E6 - . . C6 - . . . . . . | " +
          "D6 - . . Bb5 - . . F5 - . . . . . . | E6 - . . C#6 - . . A5 - . . . . . .",
          rub:
          "C#4^037 - - - - - - - - - - - - - - - | B3^047 - - - - - - - - - - - - - - - | " +
          "A3^047 - - - - - - - - - - - - - - - | Ab3^047 - - - - - - - - - - - - - - -",
        },
        C: {
          pf:
          "Bb4 - . . D5 - . . G5 - . . . . . . | A4 - . . C5 - . . F5 - . . . . . . | " +
          "G5 - . . Bb4 - . . Eb5 - . . . . . . | A5 - . . E5 - . . C#5 - . . . . . .",
          pf2:
          ". . Bb4 . . . D5 . . . G5 . . . . . | . . A4 . . . C5 . . . F5 . . . . . | " +
          ". . G5 . . . Bb4 . . . Eb5 . . . . . | . . A5 . . . E5 . . . C#5 . . . . .",
          left:
          "G2 - - - - - - - D3 - - - - - - - | F2 - - - - - - - C3 - - - - - - - | " +
          "Eb2 - - - - - - - Bb2 - - - - - - - | A2 - - - - - - - E3 - - - - - - -",
          chord:
          "G3^037 - - - - - - - G3^037 - - - - - - - | F3^047 - - - - - - - F3^047 - - - - - - - | " +
          "Eb3^047 - - - - - - - Eb3^047 - - - - - - - | A3^047 - - - - - - - A3^047 - - - - - - -",
          hush:
          "o . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          tap:
          "k . . . . . s . k . . . . . s . | k . . . . . s . k . . . . . s . | " +
          "k . . . . . s . k . . . . . s . | k . . . . . s . k . . . . . s .",
          bell:
          "Bb5 - . . D6 - . . G6 - . . . . . . | A5 - . . C6 - . . F6 - . . . . . . | " +
          "G6 - . . Bb5 - . . Eb6 - . . . . . . | A6 - . . E6 - . . C#6 - . . . . . .",
          rub:
          "F#3^037 - - - - - - - - - - - - - - - | E3^047 - - - - - - - - - - - - - - - | " +
          "D3^047 - - - - - - - - - - - - - - - | Ab3^047 - - - - - - - - - - - - - - -",
        },
      },
      order: ["A", "B", "C", "A", "B", "A"],
    },
    // The Black Ice: chased across the lake. The fastest of the lake's
    // options: a tight chip lead says the figure in eighths over a nonstop
    // arpeggio, a 16th-note bass and a driving kit, like running with
    // something under the ice keeping pace. At high dread a laser stabs, a
    // riser climbs and the kick goes four on the floor.
    ghoulBlackIce: {
      bpm: 113,
      rush: 10,
      voices: {
        lead: { wave: "pulse", duty: 0.25, gain: 0.12, decay: 0.05, sustain: 0.6, vibrato: { rate: 6, depth: 0.01, delay: 0.1 } },
        arp: { wave: "pulse", duty: 0.125, gain: 0.06, decay: 0.04, sustain: 0.5 },
        bass: { wave: "sawtooth", gain: 0.1, decay: 0.04, sustain: 0.6 },
        drum: { kit: true, gain: 0.26, from: 0.3 },
        hat: { kit: true, gain: 0.1, from: 0.45 },
        laser: { wave: "pulse", duty: 0.125, gain: 0.05, decay: 0.03, sustain: 0.1, from: 0.8 },
        riser: { wave: "sawtooth", gain: 0.035, decay: 0.3, sustain: 1, from: 0.85, vibrato: { rate: 0.6, depth: 0.04, delay: 0 } },
        dk: { kit: true, gain: 0.24, from: 0.9 },
      },
      patterns: {
        A: {
          lead:
          "D5 . D5 . F5 . F5 . A5 . A5 . . . . . | G5 . G5 . F5 . F5 . E5 . E5 . . . . . | " +
          "F5 . F5 . D5 . D5 . Bb4 . Bb4 . . . . . | C#5 . C#5 . . . . . A4 . A4 . . . . .",
          arp:
          "D4^037 - D4^037 - D4^037 - D4^037 - D4^037 - D4^037 - D4^037 - D4^037 - | C4^047 - C4^047 - C4^047 - C4^047 - C4^047 - C4^047 - C4^047 - C4^047 - | " +
          "Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 - | A3^047 - A3^047 - A3^047 - A3^047 - A3^047 - A3^047 - A3^047 - A3^047 -",
          bass:
          "D3 D4 D3 D4 D3 D4 D3 D4 D3 D4 D3 D4 D3 D4 D3 D4 | C3 C4 C3 C4 C3 C4 C3 C4 C3 C4 C3 C4 C3 C4 C3 C4 | " +
          "Bb2 Bb3 Bb2 Bb3 Bb2 Bb3 Bb2 Bb3 Bb2 Bb3 Bb2 Bb3 Bb2 Bb3 Bb2 Bb3 | A2 A3 A2 A3 A2 A3 A2 A3 A2 A3 A2 A3 A2 A3 A2 A3",
          drum:
          "k . . k s . . . k . k . s . . k | k . . k s . . . k . k . s . . k | " +
          "k . . k s . . . k . k . s . . k | k . . . s . . . k . k . s s s s",
          hat:
          "h h h h h h h h h h h h h h h h | h h h h h h h h h h h h h h h h | " +
          "h h h h h h h h h h h h h h h h | h h h h h h h h h h h h h h h h",
          laser:
          "D5 - D6 - F5 - F6 - A5 - A6 - . . . . | G5 - G6 - F5 - F6 - E5 - E6 - . . . . | " +
          "F5 - F6 - D5 - D6 - Bb4 - Bb5 - . . . . | C#5 - C#6 - . . . . A4 - A5 - . . . .",
          riser:
          "Eb4^037 - - - - - - - - - - - - - - - | C#4^047 - - - - - - - - - - - - - - - | " +
          "B3^047 - - - - - - - - - - - - - - - | Bb3^047 - - - - - - - - - - - - - - -",
          dk:
          "k . . . k . . . k . . . k . . . | k . . . k . . . k . . . k . . . | " +
          "k . . . k . . . k . . . k . . . | k . . . k . . . k . . . k . . .",
        },
        B: {
          lead:
          "A5 . A5 . F5 . F5 . D5 . D5 . . . . . | G5 . G5 . E5 . E5 . C5 . C5 . . . . . | " +
          "D5 . D5 . Bb4 . Bb4 . F4 . F4 . . . . . | E5 . E5 . C#5 . C#5 . A4 . A4 . . . . .",
          arp:
          "D4^037 - D4^037 - D4^037 - D4^037 - D4^037 - D4^037 - D4^037 - D4^037 - | C4^047 - C4^047 - C4^047 - C4^047 - C4^047 - C4^047 - C4^047 - C4^047 - | " +
          "Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 - | A3^047 - A3^047 - A3^047 - A3^047 - A3^047 - A3^047 - A3^047 - A3^047 -",
          bass:
          "D3 D4 D3 D4 D3 D4 D3 D4 D3 D4 D3 D4 D3 D4 D3 D4 | C3 C4 C3 C4 C3 C4 C3 C4 C3 C4 C3 C4 C3 C4 C3 C4 | " +
          "Bb2 Bb3 Bb2 Bb3 Bb2 Bb3 Bb2 Bb3 Bb2 Bb3 Bb2 Bb3 Bb2 Bb3 Bb2 Bb3 | A2 A3 A2 A3 A2 A3 A2 A3 A2 A3 A2 A3 A2 A3 A2 A3",
          drum:
          "k . . k s . . . k . k . s . . k | k . . k s . . . k . k . s . . k | " +
          "k . . k s . . . k . k . s . . k | k . . . s . . . k . k . s s s s",
          hat:
          "h h h h h h h h h h h h h h h h | h h h h h h h h h h h h h h h h | " +
          "h h h h h h h h h h h h h h h h | h h h h h h h h h h h h h h h h",
          laser:
          "A5 - A6 - F5 - F6 - D5 - D6 - . . . . | G5 - G6 - E5 - E6 - C5 - C6 - . . . . | " +
          "D5 - D6 - Bb4 - Bb5 - F4 - F5 - . . . . | E5 - E6 - C#5 - C#6 - A4 - A5 - . . . .",
          riser:
          "Eb4^037 - - - - - - - - - - - - - - - | C#4^047 - - - - - - - - - - - - - - - | " +
          "B3^047 - - - - - - - - - - - - - - - | Bb3^047 - - - - - - - - - - - - - - -",
          dk:
          "k . . . k . . . k . . . k . . . | k . . . k . . . k . . . k . . . | " +
          "k . . . k . . . k . . . k . . . | k . . . k . . . k . . . k . . .",
        },
        C: {
          lead:
          "Bb4 . Bb4 . D5 . D5 . G5 . G5 . . . . . | A4 . A4 . C5 . C5 . F5 . F5 . . . . . | " +
          "G5 . G5 . Bb4 . Bb4 . Eb5 . Eb5 . . . . . | A5 . A5 . E5 . E5 . C#5 . C#5 . . . . .",
          arp:
          "G3^037 - G3^037 - G3^037 - G3^037 - G3^037 - G3^037 - G3^037 - G3^037 - | F3^047 - F3^047 - F3^047 - F3^047 - F3^047 - F3^047 - F3^047 - F3^047 - | " +
          "Eb3^047 - Eb3^047 - Eb3^047 - Eb3^047 - Eb3^047 - Eb3^047 - Eb3^047 - Eb3^047 - | A3^047 - A3^047 - A3^047 - A3^047 - A3^047 - A3^047 - A3^047 - A3^047 -",
          bass:
          "G2 G3 G2 G3 G2 G3 G2 G3 G2 G3 G2 G3 G2 G3 G2 G3 | F2 F3 F2 F3 F2 F3 F2 F3 F2 F3 F2 F3 F2 F3 F2 F3 | " +
          "Eb2 Eb3 Eb2 Eb3 Eb2 Eb3 Eb2 Eb3 Eb2 Eb3 Eb2 Eb3 Eb2 Eb3 Eb2 Eb3 | A2 A3 A2 A3 A2 A3 A2 A3 A2 A3 A2 A3 A2 A3 A2 A3",
          drum:
          "k . . k s . . . k . k . s . . k | k . . k s . . . k . k . s . . k | " +
          "k . . k s . . . k . k . s . . k | k . . . s . . . k . k . s s s s",
          hat:
          "h h h h h h h h h h h h h h h h | h h h h h h h h h h h h h h h h | " +
          "h h h h h h h h h h h h h h h h | h h h h h h h h h h h h h h h h",
          laser:
          "Bb4 - Bb5 - D5 - D6 - G5 - G6 - . . . . | A4 - A5 - C5 - C6 - F5 - F6 - . . . . | " +
          "G5 - G6 - Bb4 - Bb5 - Eb5 - Eb6 - . . . . | A5 - A6 - E5 - E6 - C#5 - C#6 - . . . .",
          riser:
          "Ab3^037 - - - - - - - - - - - - - - - | F#3^047 - - - - - - - - - - - - - - - | " +
          "E3^047 - - - - - - - - - - - - - - - | Bb3^047 - - - - - - - - - - - - - - -",
          dk:
          "k . . . k . . . k . . . k . . . | k . . . k . . . k . . . k . . . | " +
          "k . . . k . . . k . . . k . . . | k . . . k . . . k . . . k . . .",
        },
        D: {
          lead:
          "D6 . D6 . F6 . F6 . A6 . A6 . . . . . | G6 . G6 . F6 . F6 . E6 . E6 . . . . . | " +
          "F6 . F6 . D6 . D6 . Bb5 . Bb5 . . . . . | C#6 . C#6 . . . . . A5 . A5 . . . . .",
          arp:
          "D4^037 - D4^037 - D4^037 - D4^037 - D4^037 - D4^037 - D4^037 - D4^037 - | C4^047 - C4^047 - C4^047 - C4^047 - C4^047 - C4^047 - C4^047 - C4^047 - | " +
          "Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 - Bb3^047 - | A3^047 - A3^047 - A3^047 - A3^047 - A3^047 - A3^047 - A3^047 - A3^047 -",
          bass:
          "D3 D4 D3 D4 D3 D4 D3 D4 D3 D4 D3 D4 D3 D4 D3 D4 | C3 C4 C3 C4 C3 C4 C3 C4 C3 C4 C3 C4 C3 C4 C3 C4 | " +
          "Bb2 Bb3 Bb2 Bb3 Bb2 Bb3 Bb2 Bb3 Bb2 Bb3 Bb2 Bb3 Bb2 Bb3 Bb2 Bb3 | A2 A3 A2 A3 A2 A3 A2 A3 A2 A3 A2 A3 A2 A3 A2 A3",
          drum:
          "k . . k s . . . k . k . s . . k | k . . k s . . . k . k . s . . k | " +
          "k . . k s . . . k . k . s . . k | k . . . s . . . k . k . s s s s",
          hat:
          "h h h h h h h h h h h h h h h h | h h h h h h h h h h h h h h h h | " +
          "h h h h h h h h h h h h h h h h | h h h h h h h h h h h h h h h h",
          laser:
          "D6 - D7 - F6 - F7 - A6 - A7 - . . . . | G6 - G7 - F6 - F7 - E6 - E7 - . . . . | " +
          "F6 - F7 - D6 - D7 - Bb5 - Bb6 - . . . . | C#6 - C#7 - . . . . A5 - A6 - . . . .",
          riser:
          "Eb4^037 - - - - - - - - - - - - - - - | C#4^047 - - - - - - - - - - - - - - - | " +
          "B3^047 - - - - - - - - - - - - - - - | Bb3^047 - - - - - - - - - - - - - - -",
          dk:
          "k . . . k . . . k . . . k . . . | k . . . k . . . k . . . k . . . | " +
          "k . . . k . . . k . . . k . . . | k . . . k . . . k . . . k . . .",
        },
      },
      order: ["A", "B", "A", "C", "B", "D", "A", "B", "A", "C"],
    },
    // The Widow's Web (the Frost Widow's fight): the spider's march. Eight
    // legs creeping: a chromatic crawl in the bass (D, D, Eb, D) never stops,
    // the glass figure stabs over it in staccato pairs, and the kit stomps
    // like a march. Insect and tense. At high dread a screech slides over the
    // top and the kick doubles.
    ghoulWidow: {
      bpm: 122,
      rush: 14,
      voices: {
        stab: { wave: "pulse", duty: 0.125, gain: 0.14, decay: 0.03, sustain: 0.3 },
        crawl: { wave: "sawtooth", gain: 0.1, decay: 0.04, sustain: 0.5 },
        pad: { wave: "pulse", duty: 0.25, gain: 0.05, decay: 0.04, sustain: 0.3, from: 0.2 },
        drum: { kit: true, gain: 0.26, from: 0.3 },
        hat: { kit: true, gain: 0.1, from: 0.5 },
        clack: { kit: true, gain: 0.14, from: 0.6 },
        screech: { wave: "sawtooth", gain: 0.04, decay: 0.3, sustain: 1, from: 0.8, vibrato: { rate: 7, depth: 0.03, delay: 0.1 } },
        dk: { kit: true, gain: 0.25, from: 0.9 },
      },
      patterns: {
        A: {
          stab:
          "D5 . . D5 F5 . . F5 A5 . . A5 . . . . | G5 . . G5 F5 . . F5 E5 . . E5 . . . . | " +
          "F5 . . F5 D5 . . D5 Bb4 . . Bb4 . . . . | C#5 . . C#5 . . . . A4 . . A4 . . . .",
          crawl:
          "D3 D3 Eb3 D3 D3 D3 Eb3 D3 D3 D3 Eb3 D3 D3 D3 Eb3 D3 | C3 C3 C#3 C3 C3 C3 C#3 C3 C3 C3 C#3 C3 C3 C3 C#3 C3 | " +
          "Bb2 Bb2 B2 Bb2 Bb2 Bb2 B2 Bb2 Bb2 Bb2 B2 Bb2 Bb2 Bb2 B2 Bb2 | A2 A2 Bb2 A2 A2 A2 Bb2 A2 A2 A2 Bb2 A2 A2 A2 Bb2 A2",
          pad:
          ". . . . D4^037 . . . . . . . D4^037 . . . | . . . . C4^047 . . . . . . . C4^047 . . . | " +
          ". . . . Bb3^047 . . . . . . . Bb3^047 . . . | . . . . A3^047 . . . . . . . A3^047 . . .",
          drum:
          "k . . . k . . . k . . . k . k k | k . . . k . . . k . . . k . k k | " +
          "k . . . k . . . k . . . k . k k | k . . . s . . . k . k . s s s s",
          hat:
          "h . h . h . h . h . h . h . h . | h . h . h . h . h . h . h . h . | " +
          "h . h . h . h . h . h . h . h . | h . h . h . h . h . h . h . h .",
          clack:
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . . | " +
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . .",
          screech:
          "Eb4^037 - - - - - - - - - - - - - - - | C#4^047 - - - - - - - - - - - - - - - | " +
          "B3^047 - - - - - - - - - - - - - - - | Bb3^047 - - - - - - - - - - - - - - -",
          dk:
          "k . . . k . . . k . . . k . . . | k . . . k . . . k . . . k . . . | " +
          "k . . . k . . . k . . . k . . . | k . . . k . . . k . . . k . . .",
        },
        B: {
          stab:
          "A5 . . A5 F5 . . F5 D5 . . D5 . . . . | G5 . . G5 E5 . . E5 C5 . . C5 . . . . | " +
          "D5 . . D5 Bb4 . . Bb4 F4 . . F4 . . . . | E5 . . E5 C#5 . . C#5 A4 . . A4 . . . .",
          crawl:
          "D3 D3 Eb3 D3 D3 D3 Eb3 D3 D3 D3 Eb3 D3 D3 D3 Eb3 D3 | C3 C3 C#3 C3 C3 C3 C#3 C3 C3 C3 C#3 C3 C3 C3 C#3 C3 | " +
          "Bb2 Bb2 B2 Bb2 Bb2 Bb2 B2 Bb2 Bb2 Bb2 B2 Bb2 Bb2 Bb2 B2 Bb2 | A2 A2 Bb2 A2 A2 A2 Bb2 A2 A2 A2 Bb2 A2 A2 A2 Bb2 A2",
          pad:
          ". . . . D4^037 . . . . . . . D4^037 . . . | . . . . C4^047 . . . . . . . C4^047 . . . | " +
          ". . . . Bb3^047 . . . . . . . Bb3^047 . . . | . . . . A3^047 . . . . . . . A3^047 . . .",
          drum:
          "k . . . k . . . k . . . k . k k | k . . . k . . . k . . . k . k k | " +
          "k . . . k . . . k . . . k . k k | k . . . s . . . k . k . s s s s",
          hat:
          "h . h . h . h . h . h . h . h . | h . h . h . h . h . h . h . h . | " +
          "h . h . h . h . h . h . h . h . | h . h . h . h . h . h . h . h .",
          clack:
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . . | " +
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . .",
          screech:
          "Eb4^037 - - - - - - - - - - - - - - - | C#4^047 - - - - - - - - - - - - - - - | " +
          "B3^047 - - - - - - - - - - - - - - - | Bb3^047 - - - - - - - - - - - - - - -",
          dk:
          "k . . . k . . . k . . . k . . . | k . . . k . . . k . . . k . . . | " +
          "k . . . k . . . k . . . k . . . | k . . . k . . . k . . . k . . .",
        },
        C: {
          stab:
          "Bb4 . . Bb4 D5 . . D5 G5 . . G5 . . . . | A4 . . A4 C5 . . C5 F5 . . F5 . . . . | " +
          "G5 . . G5 Bb4 . . Bb4 Eb5 . . Eb5 . . . . | A5 . . A5 E5 . . E5 C#5 . . C#5 . . . .",
          crawl:
          "G2 G2 Ab2 G2 G2 G2 Ab2 G2 G2 G2 Ab2 G2 G2 G2 Ab2 G2 | F2 F2 F#2 F2 F2 F2 F#2 F2 F2 F2 F#2 F2 F2 F2 F#2 F2 | " +
          "Eb2 Eb2 E2 Eb2 Eb2 Eb2 E2 Eb2 Eb2 Eb2 E2 Eb2 Eb2 Eb2 E2 Eb2 | A2 A2 Bb2 A2 A2 A2 Bb2 A2 A2 A2 Bb2 A2 A2 A2 Bb2 A2",
          pad:
          ". . . . G3^037 . . . . . . . G3^037 . . . | . . . . F3^047 . . . . . . . F3^047 . . . | " +
          ". . . . Eb3^047 . . . . . . . Eb3^047 . . . | . . . . A3^047 . . . . . . . A3^047 . . .",
          drum:
          "k . . . k . . . k . . . k . k k | k . . . k . . . k . . . k . k k | " +
          "k . . . k . . . k . . . k . k k | k . . . s . . . k . k . s s s s",
          hat:
          "h . h . h . h . h . h . h . h . | h . h . h . h . h . h . h . h . | " +
          "h . h . h . h . h . h . h . h . | h . h . h . h . h . h . h . h .",
          clack:
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . . | " +
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . .",
          screech:
          "Ab3^037 - - - - - - - - - - - - - - - | F#3^047 - - - - - - - - - - - - - - - | " +
          "E3^047 - - - - - - - - - - - - - - - | Bb3^047 - - - - - - - - - - - - - - -",
          dk:
          "k . . . k . . . k . . . k . . . | k . . . k . . . k . . . k . . . | " +
          "k . . . k . . . k . . . k . . . | k . . . k . . . k . . . k . . .",
        },
        D: {
          stab:
          "D6 . . D6 F6 . . F6 A6 . . A6 . . . . | G6 . . G6 F6 . . F6 E6 . . E6 . . . . | " +
          "F6 . . F6 D6 . . D6 Bb5 . . Bb5 . . . . | C#6 . . C#6 . . . . A5 . . A5 . . . .",
          crawl:
          "D3 D3 Eb3 D3 D3 D3 Eb3 D3 D3 D3 Eb3 D3 D3 D3 Eb3 D3 | C3 C3 C#3 C3 C3 C3 C#3 C3 C3 C3 C#3 C3 C3 C3 C#3 C3 | " +
          "Bb2 Bb2 B2 Bb2 Bb2 Bb2 B2 Bb2 Bb2 Bb2 B2 Bb2 Bb2 Bb2 B2 Bb2 | A2 A2 Bb2 A2 A2 A2 Bb2 A2 A2 A2 Bb2 A2 A2 A2 Bb2 A2",
          pad:
          ". . . . D4^037 . . . . . . . D4^037 . . . | . . . . C4^047 . . . . . . . C4^047 . . . | " +
          ". . . . Bb3^047 . . . . . . . Bb3^047 . . . | . . . . A3^047 . . . . . . . A3^047 . . .",
          drum:
          "k . . . k . . . k . . . k . k k | k . . . k . . . k . . . k . k k | " +
          "k . . . k . . . k . . . k . k k | k . . . s . . . k . k . s s s s",
          hat:
          "h . h . h . h . h . h . h . h . | h . h . h . h . h . h . h . h . | " +
          "h . h . h . h . h . h . h . h . | h . h . h . h . h . h . h . h .",
          clack:
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . . | " +
          ". . . . s . . . . . . . s . . . | . . . . s . . . . . . . s . . .",
          screech:
          "Eb4^037 - - - - - - - - - - - - - - - | C#4^047 - - - - - - - - - - - - - - - | " +
          "B3^047 - - - - - - - - - - - - - - - | Bb3^047 - - - - - - - - - - - - - - -",
          dk:
          "k . . . k . . . k . . . k . . . | k . . . k . . . k . . . k . . . | " +
          "k . . . k . . . k . . . k . . . | k . . . k . . . k . . . k . . .",
        },
      },
      order: ["A", "B", "A", "C", "B", "D", "A", "B", "A", "C", "B"],
    },
  },
};
