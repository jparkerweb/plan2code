// Plan2Code Web Console - ghoul: the game's intro story's own sounds, merged into ghoul-sfx.js; defines only.
//
// Same shape and rules as ghoul-sfx-tray.js: `tones` (one-shots named in the pages' `cues` in
// ghoul-story.js: wind, a distant bell, a heartbeat, a door creak, knocks, a whisper, a flashlight
// click, a page turn, the last page's "begin") and `hums` (the low drone that runs under the whole
// story, asked for every tick by ghoul.js while the story is up). Made from the house tone
// layers only; no tone is longer than 1.2 s. A name may be defined only once across tones.js and
// every game's file. No imports.

export const STORY_SFX = {
  tones: {
    // A long cold gust over open ground.
    ghoulStoryWind: {
      layers: [
        { type: "noise", seconds: 1.15, attack: 0.5, gain: 0.34, filter: { type: "bandpass", from: 420, to: 1100, q: 1.6 } },
        { type: "brown", seconds: 1.1, attack: 0.4, gain: 0.5, filter: { type: "lowpass", from: 260, to: 520 } },
        { type: "sine", from: 310, to: 380, seconds: 1.0, attack: 0.5, delay: 0.1, gain: 0.05, vibrato: { rate: 5, depth: 0.04 } },
      ],
    },
    // A far-off bell: a dull strike and a long, falling ring.
    ghoulStoryBell: {
      layers: [
        { type: "sine", from: 233, to: 231, seconds: 1.15, attack: 0.004, gain: 0.34 },
        { type: "sine", from: 466, to: 462, seconds: 1.0, attack: 0.004, gain: 0.16 },
        { type: "sine", from: 700, to: 694, seconds: 0.8, attack: 0.004, gain: 0.08 },
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.2, filter: { type: "lowpass", from: 1400, to: 700 } },
      ],
    },
    // Two heavy beats of a heart under the floor.
    ghoulStoryBeat: {
      layers: [
        { type: "sine", from: 62, to: 38, seconds: 0.22, attack: 0.008, gain: 0.7 },
        { type: "brown", seconds: 0.16, attack: 0.004, gain: 0.5, filter: { type: "lowpass", from: 200, to: 90 } },
        { type: "sine", from: 56, to: 34, seconds: 0.26, attack: 0.008, delay: 0.3, gain: 0.55 },
        { type: "brown", seconds: 0.18, attack: 0.004, delay: 0.3, gain: 0.4, filter: { type: "lowpass", from: 180, to: 80 } },
      ],
    },
    // A door opening on dry hinges.
    ghoulStoryCreak: {
      layers: [
        { type: "sawtooth", from: 150, to: 310, seconds: 1.0, attack: 0.1, gain: 0.12, vibrato: { rate: 13, depth: 0.08 }, filter: { type: "bandpass", from: 700, to: 1500, q: 7 } },
        { type: "sawtooth", from: 180, to: 250, seconds: 0.8, attack: 0.2, delay: 0.2, gain: 0.08, vibrato: { rate: 9, depth: 0.06 }, filter: { type: "bandpass", from: 1100, to: 800, q: 6 } },
        { type: "noise", seconds: 0.9, attack: 0.3, gain: 0.05, filter: { type: "bandpass", from: 2400, to: 1800, q: 3 } },
      ],
    },
    // Three slow knocks from the wrong side of a wall.
    ghoulStoryKnock: {
      layers: [0, 0.3, 0.6].flatMap((delay, i) => [
        { type: "sine", from: 140 - i * 6, to: 90, seconds: 0.09, attack: 0.002, delay, gain: 0.6 },
        { type: "noise", seconds: 0.04, attack: 0, delay, gain: 0.3, filter: { type: "bandpass", from: 900, to: 500, q: 3 } },
      ]),
    },
    // A whisper in the next room: breath shaped into almost-words.
    ghoulStoryWhisper: {
      layers: [
        { type: "pink", seconds: 1.1, attack: 0.3, gain: 0.3, filter: { type: "bandpass", from: 1700, to: 2600, q: 5 } },
        { type: "pink", seconds: 0.9, attack: 0.25, delay: 0.15, gain: 0.2, filter: { type: "bandpass", from: 3000, to: 2100, q: 6 } },
        { type: "sine", from: 190, to: 170, seconds: 1.0, attack: 0.4, gain: 0.04, vibrato: { rate: 7, depth: 0.05 } },
      ],
    },
    // A flashlight clicking on: a switch, a hum of current, a bright bloom.
    ghoulStoryClick: {
      layers: [
        { type: "square", from: 1600, to: 900, seconds: 0.018, attack: 0, gain: 0.3 },
        { type: "noise", seconds: 0.03, attack: 0, delay: 0.02, gain: 0.3, filter: { type: "highpass", from: 3000, to: 4000 } },
        { type: "triangle", from: 400, to: 1250, seconds: 0.45, attack: 0.05, delay: 0.06, gain: 0.16 },
        { type: "sine", from: 1250, to: 1260, seconds: 0.5, attack: 0.02, delay: 0.3, gain: 0.08 },
      ],
    },
    // A page turning: a soft paper whoosh.
    ghoulStoryPage: {
      layers: [
        { type: "noise", seconds: 0.22, attack: 0.05, gain: 0.2, filter: { type: "bandpass", from: 1600, to: 4200, q: 1.2 } },
        { type: "sine", from: 330, to: 262, seconds: 0.2, attack: 0.01, gain: 0.05 },
      ],
    },
    // A crow, once, from somewhere in the dark.
    ghoulStoryCrow: {
      layers: [
        { type: "sawtooth", from: 520, to: 360, seconds: 0.2, attack: 0.01, gain: 0.16, filter: { type: "bandpass", from: 1200, to: 900, q: 3 } },
        { type: "sawtooth", from: 500, to: 330, seconds: 0.22, attack: 0.01, delay: 0.26, gain: 0.14, filter: { type: "bandpass", from: 1100, to: 800, q: 3 } },
      ],
    },
    // A swallow: something very large clearing its throat.
    ghoulStoryGulp: {
      layers: [
        { type: "sine", from: 95, to: 48, seconds: 0.6, attack: 0.15, gain: 0.5, vibrato: { rate: 8, depth: 0.1 } },
        { type: "brown", seconds: 0.5, attack: 0.2, gain: 0.5, filter: { type: "lowpass", from: 500, to: 120 } },
        { type: "noise", seconds: 0.2, attack: 0.02, delay: 0.5, gain: 0.1, filter: { type: "bandpass", from: 800, to: 400, q: 2 } },
      ],
    },
    // A lock turning and a bolt thrown home.
    ghoulStoryLock: {
      layers: [
        { type: "noise", seconds: 0.03, attack: 0, gain: 0.5, filter: { type: "bandpass", from: 2600, to: 2000, q: 8 } },
        { type: "noise", seconds: 0.05, attack: 0, delay: 0.14, gain: 0.6, filter: { type: "bandpass", from: 1200, to: 700, q: 6 } },
        { type: "sine", from: 120, to: 70, seconds: 0.25, attack: 0.004, delay: 0.14, gain: 0.5 },
      ],
    },
    // The last page: a slammed chord, a rising sweep and a flash of bright metal. The run begins.
    ghoulStoryBegin: {
      layers: [
        { type: "sawtooth", from: 110, to: 108, seconds: 1.0, attack: 0.005, gain: 0.4, filter: { type: "lowpass", from: 2600, to: 400 } },
        { type: "sawtooth", from: 165, to: 163, seconds: 1.0, attack: 0.005, gain: 0.34, filter: { type: "lowpass", from: 2600, to: 400 } },
        { type: "sawtooth", from: 220, to: 218, seconds: 0.9, attack: 0.005, gain: 0.3, filter: { type: "lowpass", from: 2600, to: 400 } },
        { type: "brown", seconds: 0.5, attack: 0.003, gain: 0.7, filter: { type: "lowpass", from: 500, to: 100 } },
        { type: "noise", seconds: 0.6, attack: 0.3, gain: 0.14, delay: 0.5, filter: { type: "highpass", from: 1500, to: 6000 } },
        { type: "triangle", from: 880, to: 1760, seconds: 0.45, attack: 0.02, delay: 0.6, gain: 0.14 },
      ],
    },
  },
  hums: {
    // Under every page: a low, slow breath, a house asleep with one eye open.
    ghoulStoryDrone: { parts: [{ type: "sawtooth", freq: 55 }, { type: "sawtooth", freq: 55.7, gain: 0.8 }, { type: "sine", freq: 82.4, gain: 0.35 }], noise: { color: "brown", gain: 0.4 }, filter: { type: "lowpass", freq: 220, q: 3, follow: 0.6 }, pulse: { rate: 0.35, depth: 0.5 }, peak: 0.035 },
  },
};
