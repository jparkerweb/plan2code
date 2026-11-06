// Plan2Code Web Console - drive: its own sound effects, merged into tones.js beside the shared kit; defines only.
//
// `tones` are one-shot sounds played with tone(name, level, pitch); `hums` are
// held sounds kept going with hum(id, name, level, pitch). Both take the shapes
// tones.js documents, as plain objects (tones.js freezes them). A name may be
// defined only once across tones.js and every game's file. No imports.

export default {
  tones: {
    // The key turned as a round starts: the starter motor's whirring grind,
    // then the engine catching with a low cough and a rising rev.
    driveIgnition: {
      layers: [
        { type: "square", from: 62, to: 70, seconds: 0.42, gain: 0.35, vibrato: { rate: 14, depth: 0.12 }, filter: { type: "lowpass", from: 700, to: 500 } },
        { type: "noise", seconds: 0.42, gain: 0.25, filter: { type: "bandpass", from: 1600, to: 1300, q: 3 } },
        { type: "brown", seconds: 0.22, delay: 0.4, gain: 0.8, filter: { type: "lowpass", from: 600, to: 150 } },
        { type: "sawtooth", from: 50, to: 120, seconds: 0.5, delay: 0.42, attack: 0.08, gain: 0.6, filter: { type: "lowpass", from: 300, to: 900, q: 3 } },
      ],
    },
    // Letting off at high revs: two quick pops out of the exhaust.
    driveBackfire: {
      layers: [
        { type: "brown", seconds: 0.07, filter: { type: "lowpass", from: 1400, to: 200 } },
        { type: "sine", from: 120, to: 50, seconds: 0.06, gain: 0.7 },
        { type: "brown", seconds: 0.06, delay: 0.11, gain: 0.7, filter: { type: "lowpass", from: 1200, to: 200 } },
      ],
    },
    // The nitro running out: a turbo's blow-off, a hiss sweeping down.
    driveBlowoff: {
      layers: [
        { type: "noise", seconds: 0.4, attack: 0.02, gain: 0.7, filter: { type: "bandpass", from: 5200, to: 1400, q: 1.6 } },
        { type: "sine", from: 2400, to: 900, seconds: 0.3, gain: 0.15 },
      ],
    },
    // The median's wall scraped: metal grinding on concrete.
    driveScrape: {
      layers: [
        { type: "noise", seconds: 0.32, attack: 0.02, filter: { type: "bandpass", from: 2600, to: 1800, q: 4 } },
        { type: "sawtooth", from: 340, to: 290, seconds: 0.3, gain: 0.25, vibrato: { rate: 37, depth: 0.06 }, filter: { type: "lowpass", from: 1800, to: 900 } },
      ],
    },
    // A clock picked up: a tick, a tock and a bright chime.
    driveClock: {
      layers: [
        { type: "triangle", from: 1800, to: 1700, seconds: 0.03, gain: 0.6 },
        { type: "triangle", from: 1300, to: 1250, seconds: 0.03, delay: 0.08, gain: 0.6 },
        { type: "triangle", notes: [1319, 1760], seconds: 0.2, delay: 0.16, gain: 0.7 },
      ],
    },
    // The checkpoint gate: a bright bell-like arpeggio over a low swell, time
    // added on the clock.
    driveCheckpoint: {
      layers: [
        { type: "triangle", notes: [784, 1047, 1319, 1568, 2093], seconds: 0.45, gain: 0.7 },
        { type: "square", notes: [392, 523, 659, 784, 1047], seconds: 0.45, gain: 0.25, filter: { type: "lowpass", from: 2400, to: 2400 } },
        { type: "sine", from: 2093, to: 2093, seconds: 0.5, delay: 0.42, gain: 0.35 },
      ],
    },
    // A road never driven before: a wide, sparkly major stinger.
    driveNewRoad: {
      layers: [
        { type: "triangle", notes: [523, 659, 784, 1047, 1319, 1568], seconds: 0.6, gain: 0.7 },
        { type: "sawtooth", notes: [262, 330, 392, 523, 659, 784], seconds: 0.6, gain: 0.2, filter: { type: "lowpass", from: 1200, to: 2600 } },
        { type: "noise", seconds: 0.4, delay: 0.45, gain: 0.12, filter: { type: "highpass", from: 7000, to: 9000 } },
      ],
    },
    // The last five seconds: a sharp dashboard beep.
    driveBeep: {
      layers: [
        { type: "square", from: 1175, to: 1175, seconds: 0.09, gain: 0.45, filter: { type: "lowpass", from: 3000, to: 3000 } },
        { type: "sine", from: 2350, to: 2350, seconds: 0.09, gain: 0.25 },
      ],
    },
    // Out of time: the engine sputtering and cutting out.
    driveStall: {
      layers: [
        { type: "sawtooth", from: 140, to: 40, seconds: 0.8, gain: 0.5, vibrato: { rate: 9, depth: 0.25 }, filter: { type: "lowpass", from: 900, to: 150 } },
        { type: "brown", seconds: 0.08, delay: 0.25, gain: 0.7, filter: { type: "lowpass", from: 900, to: 200 } },
        { type: "brown", seconds: 0.08, delay: 0.5, gain: 0.5, filter: { type: "lowpass", from: 800, to: 200 } },
      ],
    },
    // A Rocket Hop lifting off: a thrust roar swelling up.
    driveLiftoff: {
      layers: [
        { type: "pink", seconds: 0.6, attack: 0.05, filter: { type: "bandpass", from: 500, to: 2400, q: 1 } },
        { type: "sawtooth", from: 80, to: 260, seconds: 0.5, gain: 0.35, filter: { type: "lowpass", from: 400, to: 1600 } },
      ],
    },
    // A Monster Truck firing up: a huge, low, two-stage rev.
    driveMonsterRev: {
      layers: [
        { type: "sawtooth", from: 40, to: 110, seconds: 0.35, gain: 0.7, filter: { type: "lowpass", from: 300, to: 900, q: 4 } },
        { type: "sawtooth", from: 70, to: 150, seconds: 0.45, delay: 0.38, gain: 0.7, filter: { type: "lowpass", from: 400, to: 1100, q: 4 } },
        { type: "brown", seconds: 0.8, gain: 0.5, filter: { type: "lowpass", from: 400, to: 200 } },
      ],
    },
  },
  hums: {
    // Planny's convertible: a V8-ish burble of two detuned saws, a sub
    // octave and a touch of second harmonic, firing pulses and exhaust rumble.
    // Pitch 1 is idle, about 3.4 the redline; the game shifts gears under it.
    driveEngine: { parts: [{ type: "sawtooth", freq: 46 }, { type: "sawtooth", freq: 46.4, gain: 0.7 }, { type: "square", freq: 23, gain: 0.5 }, { type: "sawtooth", freq: 92.3, gain: 0.22 }, { type: "triangle", freq: 138, gain: 0.1 }], noise: { color: "brown", gain: 0.25 }, filter: { type: "lowpass", freq: 420, q: 3, follow: 0.85 }, pulse: { rate: 11, depth: 0.4 }, peak: 0.06 },
    // The same car as a Monster Truck: lower, lumpier, louder.
    driveMonster: { parts: [{ type: "sawtooth", freq: 34 }, { type: "sawtooth", freq: 34.5, gain: 0.8 }, { type: "square", freq: 17, gain: 0.6 }], noise: { color: "brown", gain: 0.45 }, filter: { type: "lowpass", freq: 320, q: 4, follow: 0.8 }, pulse: { rate: 8, depth: 0.6 }, peak: 0.07 },
    // A car in traffic going by: a lighter, buzzier engine the game Dopplers.
    driveTraffic: { parts: [{ type: "sawtooth", freq: 70 }, { type: "sawtooth", freq: 70.6, gain: 0.6 }, { type: "triangle", freq: 140, gain: 0.2 }], noise: { color: "pink", gain: 0.3 }, filter: { type: "lowpass", freq: 620, q: 1.5, follow: 0.9 }, pulse: { rate: 14, depth: 0.3 }, peak: 0.045 },
    // A truck in traffic: a slow diesel chug.
    driveTruck: { parts: [{ type: "sawtooth", freq: 38 }, { type: "sawtooth", freq: 38.4, gain: 0.6 }, { type: "square", freq: 19, gain: 0.6 }], noise: { color: "brown", gain: 0.5 }, filter: { type: "lowpass", freq: 340, q: 2, follow: 0.8 }, pulse: { rate: 7, depth: 0.5 }, peak: 0.05 },
    // Off the road: gravel and dirt drumming under the tires.
    driveGravel: { noise: { color: "brown", gain: 1 }, filter: { type: "lowpass", freq: 700, q: 0.8, follow: 0.6 }, pulse: { rate: 9, depth: 0.7 }, peak: 0.05 },
    // Nitro burning: a jet's hiss with a faint whistle.
    driveNitro: { parts: [{ type: "sawtooth", freq: 220, gain: 0.1 }], noise: { color: "noise", gain: 1 }, filter: { type: "bandpass", freq: 1800, q: 1.2, follow: 0.7 }, pulse: { rate: 26, depth: 0.2 }, peak: 0.035 },
    // A Rocket Hop in the air: a soft thrust roar.
    driveRocket: { parts: [{ type: "sawtooth", freq: 90, gain: 0.2 }], noise: { color: "pink", gain: 1 }, filter: { type: "bandpass", freq: 1100, q: 0.9, follow: 1 }, pulse: { rate: 18, depth: 0.35 }, peak: 0.04 },
    // A Coin Magnet on: a gentle electric thrum.
    driveMagnet: { parts: [{ type: "sine", freq: 220 }, { type: "sine", freq: 221.5, gain: 0.8 }, { type: "triangle", freq: 660, gain: 0.15 }], filter: { type: "lowpass", freq: 1500, q: 1, follow: 1 }, pulse: { rate: 5, depth: 0.4 }, peak: 0.025 },
  },
  // The music: a song for each road, picked in prototypes/music/sunset-drive.
  // Each builds with your speed: the bass alone at a standstill, then the
  // drums, chords and lead, and a quicker tempo with nitro.
  music: {
    // Sunset Coast: E minor surf with a twangy root-fifth-octave riff, a
    // tremolo-picked lead and slapback echo; listen for the B major
    // turnarounds and the spy-movie line-cliche breakdown before the last
    // chorus.
    driveCoast: {
      bpm: 136,
      rush: 12,
      voices: {
        bass: { wave: "triangle", gain: 0.9, decay: 0.1, sustain: 0.5 },
        drums: { kit: true, gain: 0.68, from: 0.1 },
        riff: { wave: "pulse", duty: 0.25, gain: 0.26, from: 0.25, decay: 0.04, sustain: 0.3 },
        lead: { wave: "pulse", duty: 0.125, gain: 0.34, from: 0.5, decay: 0.03, sustain: 0.6 },
        echo: { wave: "pulse", duty: 0.125, gain: 0.13, from: 0.55, decay: 0.03, sustain: 0.5 },
      },
      patterns: {
        A: {
          bass:
          "E2 - . E2 B2 . E2 . E3 - . E2 B2 . E2 . | E2 - . E2 B2 . E2 . E3 - . E2 B2 . E2 . | " +
          "C2 - . C2 G2 . C2 . C3 - . C2 G2 . C2 . | B2 - . B2 F#3 . B2 . B3 - . B2 F#3 . B2 .",
          drums:
          "k . . k . . k . k . . k . . k . | k . . k . . k . k . . k . . k . | " +
          "k . h k s . h . k . h k s . h . | k . h k s . h . s . s s s s s s",
          riff:
          "E3 . E3 B3 . E3 E4 - B3 . E3 . D#3 E3 . B3 | E3 . E3 B3 . E3 E4 - B3 . E3 . D#3 E3 . B3 | " +
          "C3 . C3 G3 . C3 C4 - G3 . C3 . B2 C3 . G3 | B3 . B3 F#4 . B3 B4 - F#4 . B4 . F#4 . B3 .",
          lead:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . B4 - D#5 - F#5 - A5 -",
          echo:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . B4 - D#5 - F#5 -",
        },
        B: {
          bass:
          "E2 - . E2 B2 . E2 . E3 - . E2 B2 . E2 . | D2 - . D2 A2 . D2 . D3 - . D2 A2 . D2 . | " +
          "C2 - . C2 G2 . C2 . C3 - . C2 G2 . C2 . | B2 - . B2 F#3 . B2 . B3 - . B2 F#3 . B2 .",
          drums:
          "k . h k s . h . k . h k s . h . | k . h k s . h . k . h k s . h . | " +
          "k . h k s . h . k . h k s . h . | k . h k s . h . s s s s s s s s",
          riff:
          "E3 . E3 B3 . E3 E4 - B3 . E3 . D#3 E3 . B3 | D3 . D3 A3 . D3 D4 - A3 . D3 . C#3 D3 . A3 | " +
          "C3 . C3 G3 . C3 C4 - G3 . C3 . B2 C3 . G3 | B3 . B3 F#4 . B3 B4 - F#4 . B4 . F#4 . B3 .",
          lead:
          "B4 B4 B4 B4 E5 E5 E5 E5 G5 G5 G5 G5 G5 G5 F#5 F#5 | A5 A5 A5 A5 A5 A5 F#5 F#5 D5 D5 D5 D5 D5 D5 D5 D5 | " +
          "G5 G5 G5 G5 G5 G5 E5 E5 C5 C5 C5 C5 E5 E5 E5 E5 | D#5 D#5 D#5 D#5 D#5 D#5 D#5 D#5 F#5 F#5 F#5 F#5 B4 B4 B4 B4",
          echo:
          ". . B4 B4 B4 B4 E5 E5 E5 E5 G5 G5 G5 G5 G5 G5 | F#5 F#5 A5 A5 A5 A5 A5 A5 F#5 F#5 D5 D5 D5 D5 D5 D5 | " +
          "D5 D5 G5 G5 G5 G5 G5 G5 E5 E5 C5 C5 C5 C5 E5 E5 | E5 E5 D#5 D#5 D#5 D#5 D#5 D#5 D#5 D#5 F#5 F#5 F#5 F#5 B4 B4",
        },
        C: {
          bass:
          "A2 . A2 . E3 . A2 . A3 . A2 . E3 . C3 . | E2 . E2 . B2 . E2 . E3 . E2 . B2 . G2 . | " +
          "A2 . A2 . E3 . A2 . A3 . A2 . E3 . C3 . | B2 . B2 . F#3 . B2 . B3 . B2 . F#3 . D#3 .",
          drums:
          "k . o k s . h . k . o k s . h h | k . o k s . h . k . o k s . h h | " +
          "k . o k s . h . k . o k s . h h | k . o k s . h . k s s . s s s s",
          riff:
          "A3 . A4 . A3 . A4 . A3 . A4 . A3 . A4 . | E3 . E4 . E3 . E4 . E3 . E4 . E3 . E4 . | " +
          "A3 . A4 . A3 . A4 . A3 . A4 . A3 . A4 . | B3 . B3 F#4 . B3 B4 - F#4 . B4 . F#4 . B3 .",
          lead:
          "A5 A5 A5 A5 A5 A5 A5 A5 C6 C6 C6 C6 B5 B5 B5 B5 | B5 B5 B5 B5 B5 B5 G5 G5 E5 E5 E5 E5 E5 E5 E5 E5 | " +
          "E5 - A5 - C6 - B5 - A5 - - - G5 - E5 - | F#5 F#5 F#5 F#5 D#5 D#5 D#5 D#5 B4 B4 B4 B4 B4 B4 . .",
          echo:
          ". . A5 A5 A5 A5 A5 A5 A5 A5 C6 C6 C6 C6 B5 B5 | B5 B5 B5 B5 B5 B5 B5 B5 G5 G5 E5 E5 E5 E5 E5 E5 | " +
          "E5 E5 E5 - A5 - C6 - B5 - A5 - - - G5 - | E5 - F#5 F#5 F#5 F#5 D#5 D#5 D#5 D#5 B4 B4 B4 B4 B4 B4",
        },
        D: {
          bass:
          "E2 . . . E2 . . . E2 . . . E2 . . . | E2 . . . E2 . . . E2 . . . E2 . . . | " +
          "C2 . . . C2 . . . C2 . . . C2 . . . | B2 . . . B2 . . . B2 . B2 . B2 B2 B2 B2",
          drums:
          "k . . . . . . . k . . . . . h . | k . . . . . . . k . . . . . h . | " +
          "k . . . s . . . k . . . s . h . | s . s . s . s . s s s s s s s s",
          riff:
          "E3 . . . . . . . . . . . . . . . | E3 . . . . . . . . . . . . . . . | " +
          "C3 . . . . . . . C3 . . . . . . . | B3 . . . B3 . . . B3 . B3 . B3 . B3 .",
          lead:
          "E5 E5 E5 E5 E5 E5 E5 E5 D#5 D#5 D#5 D#5 D#5 D#5 D#5 D#5 | D5 D5 D5 D5 D5 D5 D5 D5 C#5 C#5 C#5 C#5 C#5 C#5 C#5 C#5 | " +
          "C5 C5 C5 C5 C5 C5 C5 C5 E5 E5 E5 E5 G5 G5 G5 G5 | B5 B5 B5 B5 A5 A5 A5 A5 F#5 F#5 F#5 F#5 D#5 D#5 D#5 D#5",
          echo:
          ". . E5 E5 E5 E5 E5 E5 E5 E5 D#5 D#5 D#5 D#5 D#5 D#5 | D#5 D#5 D5 D5 D5 D5 D5 D5 D5 D5 C#5 C#5 C#5 C#5 C#5 C#5 | " +
          "C#5 C#5 C5 C5 C5 C5 C5 C5 C5 C5 E5 E5 E5 E5 G5 G5 | G5 G5 B5 B5 B5 B5 A5 A5 A5 A5 F#5 F#5 F#5 F#5 D#5 D#5",
        },
        E: {
          bass:
          "A2 . A2 . E3 . A2 . A3 . A2 . E3 . C3 . | E2 . E2 . B2 . E2 . E3 . E2 . B2 . G2 . | " +
          "B2 . B2 . F#3 . B2 . B3 . B2 . F#3 . D#3 . | E2 - - - B2 - - - E2 . B2 . E3 . B2 .",
          drums:
          "k . o k s . h . k . o k s . h h | k . o k s . h . k . o k s . h h | " +
          "k . o k s . h . k . o k s . h h | k . . . s . . . k . s s s s s s",
          riff:
          "A3 . A4 . A3 . A4 . A3 . A4 . A3 . A4 . | E3 . E4 . E3 . E4 . E3 . E4 . E3 . E4 . | " +
          "B3 . B3 F#4 . B3 B4 - F#4 . B4 . F#4 . B3 . | E3 . E4 . E3 . E4 . E3 . E4 . E3 . E4 .",
          lead:
          "A5 A5 A5 A5 A5 A5 A5 A5 C6 C6 C6 C6 B5 B5 B5 B5 | B5 B5 B5 B5 B5 B5 G5 G5 E5 E5 E5 E5 E5 E5 E5 E5 | " +
          "F#5 F#5 F#5 F#5 A5 A5 A5 A5 D#5 D#5 D#5 D#5 D#5 D#5 D#5 D#5 | E5 E5 E5 E5 E5 E5 E5 E5 . . . . . . . .",
          echo:
          ". . A5 A5 A5 A5 A5 A5 A5 A5 C6 C6 C6 C6 B5 B5 | B5 B5 B5 B5 B5 B5 B5 B5 G5 G5 E5 E5 E5 E5 E5 E5 | " +
          "E5 E5 F#5 F#5 F#5 F#5 A5 A5 A5 A5 D#5 D#5 D#5 D#5 D#5 D#5 | D#5 D#5 E5 E5 E5 E5 E5 E5 E5 E5 . . . . . .",
        },
      },
      order: ["A", "B", "C", "B", "C", "D", "C", "E"],
    },
    // Canyon Road: Rumba-style 3-3-2 picking down the Am, G, F, E cadence
    // with a trumpet pair in thirds; listen for the Phrygian F to E pull, the
    // solo guitar falseta over hand claps, and the last chorus jumping an
    // octave.
    driveDesert: {
      bpm: 138,
      rush: 12,
      voices: {
        bass: {wave: "triangle", gain: 0.85, decay: 0.07, sustain: 0.55},
        drums: {kit: true, gain: 0.55, from: 0.1},
        guitar: {wave: "pulse", duty: 0.125, gain: 0.22, from: 0.25, decay: 0.05, sustain: 0.2},
        trumpet: {wave: "pulse", duty: 0.5, gain: 0.36, from: 0.5, decay: 0.1, sustain: 0.75, vibrato: {rate: 6, depth: 0.012, delay: 0.18}},
        trumpet2: {wave: "pulse", duty: 0.5, gain: 0.22, from: 0.6, decay: 0.1, sustain: 0.7, vibrato: {rate: 6, depth: 0.01, delay: 0.2}},
      },
      patterns: {
        A: {
          bass: "A2 - - E2 - - A2 - A2 - - E2 - - C3 - | G2 - - D3 - - G2 - G2 - - D3 - - B2 - | F2 - - C3 - - F2 - F2 - - C3 - - A2 - | E2 - - B2 - - E2 - E2 - - B2 - - G#2 -",
          drums: "ko . h s . h s . k . h s . h s h | k . h s . h s . k . h s . h s h | k . h s . h s . k . h s . h s h | k . h s . h s . s s s s ks ks ks ks",
          guitar: "A3 C4 E4 A3 C4 E4 A4 E4 A3 C4 E4 A3 C4 E4 A4 E4 | G3 B3 D4 G3 B3 D4 G4 D4 G3 B3 D4 G3 B3 D4 G4 D4 | F3 A3 C4 F3 A3 C4 F4 C4 F3 A3 C4 F3 A3 C4 F4 C4 | E3 G#3 B3 E3 G#3 B3 D4 B3 E3 G#3 B3 E3 G#3 B3 D4 B3",
          trumpet: ". . . . . . . . E4 A4 C5 - E5 - - - | D5 - - - - - - - B4 - - - G4 - - - | . . . . . . . . F4 A4 C5 - F5 - - - | E5 - - - - - D5 C5 B4 - - - - - - -",
        },
        B: {
          bass: "A2 - - E2 - - A2 - A2 - - E2 - - C3 - | G2 - - D3 - - G2 - G2 - - D3 - - B2 - | F2 - - C3 - - F2 - F2 - - C3 - - A2 - | E2 - - B2 - - E2 - E2 - - B2 - - G#2 -",
          drums: "ko . h s . h s . k . h s . h s h | k . h s . h s . k . h s . h s h | k . h s . h s . k . h s . h s h | k . h s . h s . s s s s ks ks ks ks",
          guitar: "A3 C4 E4 A3 C4 E4 A4 E4 A3 C4 E4 A3 C4 E4 A4 E4 | G3 B3 D4 G3 B3 D4 G4 D4 G3 B3 D4 G3 B3 D4 G4 D4 | F3 A3 C4 F3 A3 C4 F4 C4 F3 A3 C4 F3 A3 C4 F4 C4 | E3 G#3 B3 E3 G#3 B3 D4 B3 E3 G#3 B3 E3 G#3 B3 D4 B3",
          trumpet: "E5 - - E5 - - E5 - F5 E5 D5 C5 B4 - C5 - | D5 - - D5 - - D5 - E5 D5 C5 B4 A4 - B4 - | C5 - - C5 - - C5 - D5 C5 A4 F4 A4 - C5 - | B4 - - - C5 B4 A4 G#4 F4 - G#4 - E4 - - -",
          trumpet2: "C5 - - C5 - - C5 - D5 C5 B4 A4 G#4 - A4 - | B4 - - B4 - - B4 - C5 B4 A4 G4 F4 - G4 - | A4 - - A4 - - A4 - B4 A4 F4 D4 F4 - A4 - | G#4 - - - A4 G#4 F4 E4 D4 - E4 - B3 - - -",
        },
        C: {
          bass: "D2 - - A2 - - D3 - D2 - - A2 - - F2 - | E2 - - B2 - - E2 - E2 - - B2 - - G#2 - | A2 - - E2 - - A2 - A2 - - E2 - - C3 - | E2 - - B2 - - E2 - E2 - - B2 - - G#2 -",
          drums: "ko . h s . h s . k . h s . h s h | k . h s . h s . k . h s . h s h | k . h s . h s . k . h s . h s h | k . h s . h s . s s s s ks ks ks ks",
          guitar: "D3 F3 A3 D3 F3 A3 D4 A3 D3 F3 A3 D3 F3 A3 D4 A3 | E3 G#3 B3 E3 G#3 B3 D4 B3 E3 G#3 B3 E3 G#3 B3 D4 B3 | A3 C4 E4 A3 C4 E4 A4 E4 A3 C4 E4 A3 C4 E4 A4 E4 | E3 G#3 B3 E3 G#3 B3 D4 B3 E3 G#3 B3 E3 G#3 B3 D4 B3",
          trumpet: "A4 - D5 - F5 - - - E5 - D5 - F5 - A5 - | G#5 - - - - - F5 - E5 - - - D5 - B4 - | C5 - E5 - A5 - - - G#5 - F5 - E5 - C5 - | B4 - C5 - B4 - G#4 - F4 E4 F4 G#4 B4 - - -",
          trumpet2: "F4 - A4 - D5 - - - C5 - A4 - D5 - F5 - | E5 - - - - - D5 - B4 - - - B4 - G#4 - | A4 - C5 - E5 - - - E5 - D5 - C5 - A4 - | G#4 - A4 - G#4 - E4 - D4 C4 D4 E4 G#4 - - -",
        },
        D: {
          bass: "E2 - - B2 - - E2 - E2 - - B2 - - E2 - | F2 - - C3 - - F2 - F2 - - C3 - - F2 - | E2 - - B2 - - E2 - E2 - - B2 - - E2 - | F2 - - C3 - - F2 - E2 - - B2 - - G#2 -",
          drums: ". . . s . . s . . . . s . . s . | . . . s . . s . . . . s . . s . | . . . s . . s . . . . s . . s . | . . . s . . s . s . s s s s ks ks",
          guitar: "E4 F4 G#4 A4 B4 A4 G#4 F4 E4 F4 G#4 B4 D5 C5 B4 A4 | A4 C5 F5 C5 A4 C5 F5 E5 D5 C5 B4 A4 G#4 A4 B4 C5 | B4 G#4 E4 G#4 B4 D5 C5 B4 C5 B4 A4 G#4 A4 G#4 F4 E4 | F4 A4 C5 F5 E5 D5 C5 B4 G#4 B4 E5 D5 C5 B4 A4 G#4",
        },
        E: {
          bass: "D2 - - A2 - - D3 - D2 - - A2 - - F2 - | E2 - - B2 - - E2 - E2 - - B2 - - G#2 - | A2 - - E2 - - A2 - A2 - - E2 - - C3 - | E2 - - B2 - - E2 - E2 - - B2 - - G#2 -",
          drums: "ko . h s . h s . k . h s . h s h | k . h s . h s . k . h s . h s h | k . h s . h s . k . h s . h s h | k . h s . h s . s s s s ks ks ks ks",
          guitar: "D3 F3 A3 D3 F3 A3 D4 A3 D3 F3 A3 D3 F3 A3 D4 A3 | E3 G#3 B3 E3 G#3 B3 D4 B3 E3 G#3 B3 E3 G#3 B3 D4 B3 | A3 C4 E4 A3 C4 E4 A4 E4 A3 C4 E4 A3 C4 E4 A4 E4 | E3 G#3 B3 E3 G#3 B3 D4 B3 E3 G#3 B3 E3 G#3 B3 D4 B3",
          trumpet: "D5 F5 A5 D6 - - - - C6 - A5 - F5 - A5 - | B5 - - B5 - - B5 - C6 B5 A5 G#5 F5 - E5 - | A5 - - A5 - - A5 - G#5 A5 B5 C6 B5 - A5 - | G#5 - - - F5 - E5 - D5 - C5 - B4 - - -",
          trumpet2: "A4 D5 F5 A5 - - - - A5 - F5 - D5 - F5 - | G#5 - - G#5 - - G#5 - A5 G#5 F5 E5 D5 - B4 - | E5 - - E5 - - E5 - E5 F5 G#5 A5 G#5 - E5 - | E5 - - - D5 - C5 - B4 - A4 - G#4 - - -",
        },
      },
      order: ["A", "B", "C", "E", "D", "B", "C", "E"],
    },
    // Maple Valley: A tense E minor groove of wah-style sixteenth chicka
    // riffs and syncopated octave bass; listen for the chromatic C7 to B7
    // brass build, the bass-and-drums break and the big major-key chase
    // chorus.
    driveForest: {
      bpm: 116,
      rush: 12,
      voices: {
        bass: {wave: "triangle", gain: 0.92, decay: 0.06, sustain: 0.4},
        drums: {kit: true, gain: 0.66, from: 0.1},
        wah: {wave: "pulse", duty: 0.25, gain: 0.24, from: 0.25, decay: 0.04, sustain: 0.15},
        brass: {wave: "pulse", duty: 0.5, gain: 0.28, from: 0.35, decay: 0.06, sustain: 0.6},
        lead: {wave: "pulse", duty: 0.25, gain: 0.36, from: 0.55, decay: 0.05, sustain: 0.75, vibrato: {rate: 5.5, depth: 0.012, delay: 0.15}},
      },
      patterns: {
        I: {
          bass: "E2 . E3 . . E2 E3 . E2 . . E3 D3 . B2 . | E2 . E3 . . E2 E3 . E2 . . E3 D3 . B2 . | E2 . E3 . . E2 E3 . E2 . . E3 D3 . B2 . | E2 . E3 . . E2 E3 . E2 . G2 A2 Bb2 B2 D3 E3",
          drums: "kh . h k sh . h h . h kh h sh . h h | kh . h k sh . h h . h kh h sh . h h | kh . h k sh . h h . h kh h sh . h h | kh . h k sh . h h s s s . s s ks ks",
          wah: "B4 . B4 D5 . B4 E5 . B4 . B4 D5 E5 . D5 B4 | B4 . B4 D5 . B4 E5 . B4 . B4 D5 E5 . D5 B4 | B4 . B4 D5 . B4 E5 . B4 . B4 D5 E5 . D5 B4 | B4 . B4 D5 . B4 E5 . B4 . B4 D5 E5 . D5 B4",
        },
        A: {
          bass: "E2 . E3 . . E2 E3 . E2 . . E3 D3 . B2 . | E2 . E3 . . E2 E3 . E2 . G2 A2 Bb2 B2 D3 E3 | A2 . A3 . . A2 A3 . A2 . . A3 G3 . E3 . | E2 . E3 . . E2 E3 . E2 . G2 A2 Bb2 B2 D3 E3",
          drums: "kh . h k sh . h h . h kh h sh . h h | kh . h k sh . h h . h kh h sh . h h | kh . h k sh . h h . h kh h sh . h h | kh . h k sh . h h s s s . s s ks ks",
          wah: "B4 . B4 D5 . B4 E5 . B4 . B4 D5 E5 . D5 B4 | B4 . B4 D5 . B4 E5 . B4 . B4 D5 E5 . D5 B4 | C#5 . C#5 E5 . C#5 G5 . C#5 . C#5 E5 G5 . E5 C#5 | B4 . B4 D5 . B4 E5 . B4 . B4 D5 E5 . D5 B4",
          brass: ". . . . . . . . . . E4^037a - . E4^037a - - | . . . . . . . . . . . . . . . . | . . . . . . . . . . A3^047a - . A3^047a - - | E4^037 - - - . . . . . . . . . . . .",
          lead: "E5 - . E5 G5 - . A5 Bb5 - A5 - G5 - E5 - | D5 - - - E5 - - - . . . . . . . . | E5 - . E5 G5 - . A5 C#6 - A5 - G5 - E5 - | B5 - - - - - - - . . . . . . . .",
        },
        B: {
          bass: "C3 . C4 . . C3 C4 . C3 . . C4 Bb3 . G3 . | B2 . B3 . . B2 B3 . B2 . . B3 A3 . F#3 . | C3 . C4 . . C3 C4 . C3 . . C4 Bb3 . G3 . | B2 . B3 . . B2 B3 . B2 . . B3 A3 . F#3 .",
          drums: "kh . h k sh . h h . h kh h sh . h h | kh . h k sh . h h . h kh h sh . h h | kh . h k sh . h h . h kh h sh . h h | kh . h k sh . h h s s s . s s ks ks",
          wah: "E5 . E5 G5 . E5 Bb5 . E5 . E5 G5 Bb5 . G5 E5 | D#5 . D#5 F#5 . D#5 A5 . D#5 . D#5 F#5 A5 . F#5 D#5 | E5 . E5 G5 . E5 Bb5 . E5 . E5 G5 Bb5 . G5 E5 | D#5 . D#5 F#5 . D#5 A5 . D#5 . D#5 F#5 A5 . F#5 D#5",
          brass: "C4^047a - - - . . . . C4^047a - . C4^047a - - . . | B3^047a - - - . . . . B3^047a - . B3^047a - - . . | C4^047a - - - . . . . C4^047a - . C4^047a - - . . | B3^047a - . B3^047a - . B3^047a - . B3^047a - . B3^047a - - -",
          lead: ". . . . . . . . E5 - G5 - Bb5 - - - | A5 - - - F#5 - - - D#5 - - - B4 - - - | . . . . . . . . G5 - Bb5 - C6 - - - | B5 - - - A5 - - - F#5 - - - D#5 - - -",
        },
        C: {
          bass: "C3 . C3 C4 . C3 G2 . C3 . C3 C4 . G2 Bb2 B2 | D2 . D2 D3 . D2 A2 . D2 . D2 D3 . A2 C3 C#3 | E2 . E2 E3 . E2 B2 . E2 . E2 E3 . D3 B2 G2 | E2 . E2 E3 . E2 B2 . E2 . E2 E3 . D3 B2 G2",
          drums: "ko . h k sh . o h k h ko h sh . o h | ko . h k sh . o h k h ko h sh . o h | ko . h k sh . o h k h ko h sh . o h | ko . h k sh . o h s s s . s s ks ks",
          wah: "C4^047 . C4^047 C4^047 . C4^047 . C4^047 C4^047 . C4^047 C4^047 . C4^047 . C4^047 | D4^047 . D4^047 D4^047 . D4^047 . D4^047 D4^047 . D4^047 D4^047 . D4^047 . D4^047 | E4^037 . E4^037 E4^037 . E4^037 . E4^037 E4^037 . E4^037 E4^037 . E4^037 . E4^037 | E4^037 . E4^037 E4^037 . E4^037 . E4^037 E4^037 . E4^037 E4^037 . E4^037 . E4^037",
          brass: "C4^047 - . . . . . . . . C4^047 - . C4^047 - . | D4^047 - . . . . . . . . D4^047 - . D4^047 - . | E4^037 - . . . . . . . . E4^037 - . E4^037 - . | E4^037 - . . . . . . . . E4^037 - . E4^037 - .",
          lead: "G5 - - - E5 - G5 - C6 - - - B5 - G5 - | A5 - - - F#5 - A5 - D6 - - - C6 - A5 - | B5 - - - - - - - G5 - A5 - B5 - D6 - | E6 - - - - - - - - - - - . . . .",
        },
        C2: {
          bass: "C3 . C3 C4 . C3 G2 . C3 . C3 C4 . G2 Bb2 B2 | D2 . D2 D3 . D2 A2 . D2 . D2 D3 . A2 C3 C#3 | B2 . B2 B3 . B2 F#2 . B2 . B2 B3 . A2 F#2 D#2 | B2 . B2 B3 . B2 F#2 . B2 . B2 B3 . A2 F#2 D#2",
          drums: "ko . h k sh . o h k h ko h sh . o h | ko . h k sh . o h k h ko h sh . o h | ko . h k sh . o h k h ko h sh . o h | ko . h k sh . o h s s s . s s ks ks",
          wah: "C4^047 . C4^047 C4^047 . C4^047 . C4^047 C4^047 . C4^047 C4^047 . C4^047 . C4^047 | D4^047 . D4^047 D4^047 . D4^047 . D4^047 D4^047 . D4^047 D4^047 . D4^047 . D4^047 | B3^047a . B3^047a B3^047a . B3^047a . B3^047a B3^047a . B3^047a B3^047a . B3^047a . B3^047a | B3^047a . B3^047a B3^047a . B3^047a . B3^047a B3^047a . B3^047a B3^047a . B3^047a . B3^047a",
          brass: "C4^047 - . . . . . . . . C4^047 - . C4^047 - . | D4^047 - . . . . . . . . D4^047 - . D4^047 - . | B3^047a - . . . . . . . . B3^047a - . B3^047a - . | B3^047a - . B3^047a - . B3^047a - . B3^047a - . B3^047a - - -",
          lead: "G5 - - - E5 - G5 - C6 - - - B5 - G5 - | A5 - - - F#5 - A5 - D6 - - - C6 - A5 - | D#6 - - - - - C6 - B5 - - - A5 - F#5 - | D#5 - - - F#5 - - - A5 - - - B5 - - -",
        },
        D: {
          bass: "E2 . . E2 . . E3 . . E2 . . G2 A2 B2 . | E2 . . E2 . . E3 . . E2 . . D3 . B2 . | E2 . . E2 . . E3 . . E2 . . G2 A2 B2 . | E2 . E3 . D3 . E3 . B2 . D3 . A2 . B2 .",
          drums: "k . . k s . . k . . k . s . . . | k . . k s . . k . . k . s . . . | k . . k s . . k . . k . s . . . | s . s . s s . s s s s s ks ks ks ks",
          brass: ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | . . . . . . . . E4^037a - . E4^037a - . B3^047a -",
        },
      },
      order: ["I", "A", "B", "C", "C2", "D", "B", "C", "C2"],
    },
    // Snowcap Pass: Euphoric A minor trance at 138: four-on-the-floor kick,
    // galloping offbeat bass and octave-stacked pulse arps; listen for the
    // hands-up breakdown and the snare roll that slams back into the drop.
    driveAlpine: {
      bpm: 138,
      rush: 10,
      voices: {
        bass: { wave: "triangle", gain: 0.88, decay: 0.09, sustain: 0.3 },
        drums: { kit: true, gain: 0.7, from: 0.1 },
        arp: { wave: "pulse", duty: 0.25, gain: 0.22, from: 0.22, decay: 0.08, sustain: 0.2 },
        stack: { wave: "pulse", duty: 0.5, gain: 0.18, from: 0.35, decay: 0.15, sustain: 0.35 },
        lead: { wave: "pulse", duty: 0.5, gain: 0.36, from: 0.55, decay: 0.3, sustain: 0.7, vibrato: { rate: 6, depth: 0.01, delay: 0.1 } },
      },
      patterns: {
        A: {
          bass: ". A2 A3 A2 . A2 A3 A2 . A2 A3 A2 . A2 A3 A2 | . F2 F3 F2 . F2 F3 F2 . F2 F3 F2 . F2 F3 F2 | . C3 C4 C3 . C3 C4 C3 . C3 C4 C3 . C3 C4 C3 | . G2 G3 G2 . G2 G3 G2 . G2 G3 G2 . G2 G3 G2",
          drums: "k . o . k . o . k . o . k . o . | k . o . k . o . k . o . k . o . | k . o . k . o . k . o . k . o . | k . o . k . o . s . s . s s s s",
          arp: "A4^0c C5^0c E5^0c A5^0c C5^0c E5^0c A5^0c E5^0c A4^0c C5^0c E5^0c A5^0c C5^0c E5^0c A5^0c E5^0c | F4^0c A4^0c C5^0c F5^0c A4^0c C5^0c F5^0c C5^0c F4^0c A4^0c C5^0c F5^0c A4^0c C5^0c F5^0c C5^0c | G4^0c C5^0c E5^0c G5^0c C5^0c E5^0c G5^0c E5^0c G4^0c C5^0c E5^0c G5^0c C5^0c E5^0c G5^0c E5^0c | G4^0c B4^0c D5^0c G5^0c B4^0c D5^0c G5^0c D5^0c G4^0c B4^0c D5^0c G5^0c B4^0c D5^0c G5^0c D5^0c",
        },
        B: {
          bass: ". A2 A3 A2 . A2 A3 A2 . A2 A3 A2 . A2 A3 A2 | . F2 F3 F2 . F2 F3 F2 . F2 F3 F2 . F2 F3 F2 | . C3 C4 C3 . C3 C4 C3 . C3 C4 C3 . C3 C4 C3 | . G2 G3 G2 . G2 G3 G2 . G2 G3 G2 . G2 G3 G2",
          drums: "k . o . ks . o . k . o . ks . o . | k . o . ks . o . k . o . ks . o . | k . o . ks . o . k . o . ks . o . | kh h o h ksh h o h k s s s s s s s",
          arp: "A4^0c C5^0c E5^0c A5^0c C5^0c E5^0c A5^0c E5^0c A4^0c C5^0c E5^0c A5^0c C5^0c E5^0c A5^0c E5^0c | F4^0c A4^0c C5^0c F5^0c A4^0c C5^0c F5^0c C5^0c F4^0c A4^0c C5^0c F5^0c A4^0c C5^0c F5^0c C5^0c | G4^0c C5^0c E5^0c G5^0c C5^0c E5^0c G5^0c E5^0c G4^0c C5^0c E5^0c G5^0c C5^0c E5^0c G5^0c E5^0c | G4^0c B4^0c D5^0c G5^0c B4^0c D5^0c G5^0c D5^0c G4^0c B4^0c D5^0c G5^0c B4^0c D5^0c G5^0c D5^0c",
          stack: ". . A4^037c - . . A4^037c - . . A4^037c - . . A4^037c - | . . F4^047c - . . F4^047c - . . F4^047c - . . F4^047c - | . . C5^047c - . . C5^047c - . . C5^047c - . . C5^047c - | . . G4^047c - . . G4^047c - . . G4^047c - . . G4^047c -",
          lead: "E5 - A5 - E5 - C5 - E5 - A5 - B5 - C6 - | C6 - A5 - F5 - A5 - C6 - - - A5 - - - | G5 - E5 - C5 - E5 - G5 - C6 - B5 - G5 - | D5 - G5 - B5 - - - A5 - - - G5 - - -",
        },
        C: {
          bass: ". F2 F3 F2 . F2 F3 F2 . F2 F3 F2 . F2 F3 F2 | . G2 G3 G2 . G2 G3 G2 . G2 G3 G2 . G2 G3 G2 | . E2 E3 E2 . E2 E3 E2 . E2 E3 E2 . E2 E3 E2 | . A2 A3 A2 . A2 A3 A2 . A2 A3 A2 . A2 A3 A2",
          drums: "kh h o h ksh h o h kh h o h ksh h o h | kh h o h ksh h o h kh h o h ksh h o h | kh h o h ksh h o h kh h o h ksh h o h | kh h o h ksh h o h k s s s s s s s",
          arp: "F4^0c A4^0c C5^0c F5^0c A4^0c C5^0c F5^0c C5^0c F4^0c A4^0c C5^0c F5^0c A4^0c C5^0c F5^0c C5^0c | G4^0c B4^0c D5^0c G5^0c B4^0c D5^0c G5^0c D5^0c G4^0c B4^0c D5^0c G5^0c B4^0c D5^0c G5^0c D5^0c | E4^0c G4^0c B4^0c E5^0c G4^0c B4^0c E5^0c B4^0c E4^0c G4^0c B4^0c E5^0c G4^0c B4^0c E5^0c B4^0c | A4^0c C5^0c E5^0c A5^0c C5^0c E5^0c A5^0c E5^0c A4^0c C5^0c E5^0c A5^0c C5^0c E5^0c A5^0c E5^0c",
          stack: ". . F4^047c - . . F4^047c - . . F4^047c - . . F4^047c - | . . G4^047c - . . G4^047c - . . G4^047c - . . G4^047c - | . . E4^037c - . . E4^037c - . . E4^037c - . . E4^037c - | . . A4^037c - . . A4^037c - . . A4^037c - . . A4^037c -",
          lead: "A5 - - G5 A5 - C6 - - - A5 - G5 - F5 - | G5 - - F5 G5 - B5 - - - D6 - - - B5 - | B5 - - A5 G5 - E5 - - - G5 - B5 - - - | A5 - - B5 C6 - E6 - - - C6 - A5 - - -",
        },
        D: {
          bass: "F2 - - - - - - - - - - - - - - - | G2 - - - - - - - - - - - - - - - | A2 - - - - - - - - - - - - - - - | A2 - - - - - - - E2 - - - - - - -",
          drums: ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | s . . . s . . . s . . . s . . . | s . s . s . s . s s s s s s s s",
          stack: "F4^047c - - - - - - - - - - - - - - - | G4^047c - - - - - - - - - - - - - - - | A4^037c - - - - - - - - - - - - - - - | E4^047c - - - - - - - - - - - - - - -",
          arp: ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | A4^0c C5^0c E5^0c A5^0c C5^0c E5^0c A5^0c E5^0c A4^0c C5^0c E5^0c A5^0c C5^0c E5^0c A5^0c E5^0c | E4^0c G#4^0c B4^0c E5^0c G#4^0c B4^0c E5^0c B4^0c E4^0c G#4^0c B4^0c E5^0c G#4^0c B4^0c E5^0c B4^0c",
          lead: "A5 - - - - - - - C6 - - - - - - - | B5 - - - - - - - D6 - - - - - - - | C6 - - - - - - - - - - - B5 - A5 - | B5 - - - G#5 - - - E5 - - - - - - -",
        },
        E: {
          bass: ". F2 F3 F2 . F2 F3 F2 . F2 F3 F2 . F2 F3 F2 | . G2 G3 G2 . G2 G3 G2 . G2 G3 G2 . G2 G3 G2 | . C3 C4 C3 . C3 C4 C3 . C3 C4 C3 . C3 C4 C3 | . E2 E3 E2 . E2 E3 E2 . E2 E3 E2 . E2 E3 E2",
          drums: "kh h o h ksh h o h kh h o h ksh h o h | kh h o h ksh h o h kh h o h ksh h o h | kh h o h ksh h o h kh h o h ksh h o h | k s k s ks s ks s s s s s s s s s",
          arp: "F4^0c A4^0c C5^0c F5^0c A4^0c C5^0c F5^0c C5^0c F4^0c A4^0c C5^0c F5^0c A4^0c C5^0c F5^0c C5^0c | G4^0c B4^0c D5^0c G5^0c B4^0c D5^0c G5^0c D5^0c G4^0c B4^0c D5^0c G5^0c B4^0c D5^0c G5^0c D5^0c | G4^0c C5^0c E5^0c G5^0c C5^0c E5^0c G5^0c E5^0c G4^0c C5^0c E5^0c G5^0c C5^0c E5^0c G5^0c E5^0c | E4^0c G#4^0c B4^0c E5^0c G#4^0c B4^0c E5^0c B4^0c E4^0c G#4^0c B4^0c E5^0c G#4^0c B4^0c E5^0c B4^0c",
          stack: ". . F4^047c - . . F4^047c - . . F4^047c - . . F4^047c - | . . G4^047c - . . G4^047c - . . G4^047c - . . G4^047c - | . . C5^047c - . . C5^047c - . . C5^047c - . . C5^047c - | . . E4^047c - . . E4^047c - . . E4^047c - . . E4^047c -",
          lead: "A5 - - G5 A5 - C6 - - - A5 - G5 - F5 - | G5 - - F5 G5 - B5 - - - D6 - - - B5 - | C6 - - B5 G5 - E5 - - - G5 - C6 - - - | B5 - - - G#5 - - - E5 - - - D6 - - -",
        },
      },
      order: ["A", "B", "C", "E", "D", "B", "C", "E"],
    },
    // Neon City: Menacing D minor over a pounding sawtooth sixteenth bass
    // with a harmonic-minor A major twist; listen for the tresillo stabs, the
    // octave-leaping chorus hook and the Phrygian Eb in the half-time bridge.
    driveCity: {
      bpm: 112,
      rush: 14,
      voices: {
        bass: { wave: "sawtooth", gain: 0.42, decay: 0.06, sustain: 0.35 },
        drums: { kit: true, gain: 0.78, from: 0.1 },
        stab: { wave: "pulse", duty: 0.25, gain: 0.28, decay: 0.05, sustain: 0.15, from: 0.25 },
        arp: { wave: "pulse", duty: 0.5, gain: 0.18, decay: 0.04, sustain: 0.3, from: 0.35 },
        lead: { wave: "pulse", duty: 0.125, gain: 0.36, decay: 0.1, sustain: 0.75, vibrato: { rate: 6, depth: 0.012, delay: 0.15 }, from: 0.5 },
      },
      patterns: {
        A: {
          bass: "D2 D2 D3 D2 D2 D2 D3 D2 D2 D2 D3 D2 D2 D3 D2 D3 | D2 D2 D3 D2 D2 D2 D3 D2 D2 D2 D3 D2 D2 D3 D2 D3 | Bb2 Bb2 Bb3 Bb2 Bb2 Bb2 Bb3 Bb2 Bb2 Bb2 Bb3 Bb2 Bb2 Bb3 Bb2 Bb3 | A2 A2 A3 A2 A2 A3 A2 A2 C#3 C#3 E3 E3 G3 G3 A3 A3",
          drums: "k . h . k . h . k . h . k . h . | k . h . k . h . k . h . k . h . | kh h h h sh h h h kh h kh h sh h h h | kh h h h sh h h h s . s s s s s s",
          stab: "D4^037 . . . . . . . . . . . . . . . | D4^037 . . . . . . . . . . . . . . . | Bb3^047 . . . . . . . . . . . . . . . | A3^047 . . A3^047 . . A3^047 . A3^047 . . A3^047 . . A3^047 .",
          arp: ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | Bb3 F4 Bb4 F4 D4 F4 Bb4 F4 Bb3 F4 Bb4 F4 D4 F4 Bb4 F4 | A3 E4 A4 E4 C#4 E4 A4 E4 A3 E4 A4 E4 C#4 E4 A4 E4",
        },
        B: {
          bass: "D2 D2 D3 D2 D2 D2 D3 D2 D2 D2 D3 D2 D2 D3 D2 D3 | Bb2 Bb2 Bb3 Bb2 Bb2 Bb2 Bb3 Bb2 Bb2 Bb2 Bb3 Bb2 Bb2 Bb3 Bb2 Bb3 | G2 G2 G3 G2 G2 G2 G3 G2 G2 G2 G3 G2 G2 G3 G2 G3 | A2 A2 A3 A2 A2 A3 A2 A2 C#3 C#3 E3 E3 G3 G3 A3 A3",
          drums: "kh h h h sh h h h kh h kh h sh h h h | kh h h h sh h h kh h h kh h sh h kh h | kh h h h sh h h h kh h kh h sh h h h | kh h h h sh h kh h s s ks s s s ks o",
          stab: "D4^037 . . D4^037 . . D4^037 . D4^037 . . D4^037 . . D4^037 . | Bb3^047 . . Bb3^047 . . Bb3^047 . Bb3^047 . . Bb3^047 . . Bb3^047 . | G3^037 . . G3^037 . . G3^037 . G3^037 . . G3^037 . . G3^037 . | A3^047 . . A3^047 . . A3^047 . A3^047 . . A3^047 . . A3^047 .",
          arp: "D4 A4 D5 A4 F4 A4 D5 A4 D4 A4 D5 A4 F4 A4 D5 A4 | Bb3 F4 Bb4 F4 D4 F4 Bb4 F4 Bb3 F4 Bb4 F4 D4 F4 Bb4 F4 | G3 D4 G4 D4 Bb3 D4 G4 D4 G3 D4 G4 D4 Bb3 D4 G4 D4 | A3 E4 A4 E4 C#4 E4 A4 E4 A3 E4 A4 E4 C#4 E4 A4 E4",
          lead: "D5 - - A4 D5 - F5 - E5 - - - D5 - C5 - | D5 - - - . . Bb4 - C5 - D5 - F5 - - - | G5 - - - - - F5 - E5 - D5 - Bb4 - - - | A4 - - - C#5 - - - E5 - - - G5 - F5 -",
        },
        C: {
          bass: "D2 D2 D3 D2 D2 D2 D3 D2 D2 D2 D3 D2 D2 D3 D2 D3 | C2 C2 C3 C2 C2 C2 C3 C2 C2 C2 C3 C2 C2 C3 C2 C3 | Bb2 Bb2 Bb3 Bb2 Bb2 Bb2 Bb3 Bb2 Bb2 Bb2 Bb3 Bb2 Bb2 Bb3 Bb2 Bb3 | A2 A2 A3 A2 A2 A3 A2 A2 C#3 C#3 E3 E3 G3 G3 A3 A3",
          drums: "kh h h h sh h h h kh h kh h sh h h h | kh h h h sh h h kh h h kh h sh h kh h | kh h h h sh h h h kh h kh h sh h h h | kh h h h sh h h h s . s s s s s s",
          stab: "D4^037 . . D4^037 . . D4^037 . D4^037 . . D4^037 . . D4^037 . | C4^047 . . C4^047 . . C4^047 . C4^047 . . C4^047 . . C4^047 . | Bb3^047 . . Bb3^047 . . Bb3^047 . Bb3^047 . . Bb3^047 . . Bb3^047 . | A3^047 . . A3^047 . . A3^047 . A3^047 . . A3^047 . . A3^047 .",
          arp: "D4 A4 D5 A4 F4 A4 D5 A4 D4 A4 D5 A4 F4 A4 D5 A4 | C4 G4 C5 G4 E4 G4 C5 G4 C4 G4 C5 G4 E4 G4 C5 G4 | Bb3 F4 Bb4 F4 D4 F4 Bb4 F4 Bb3 F4 Bb4 F4 D4 F4 Bb4 F4 | A3 E4 A4 E4 C#4 E4 A4 E4 A3 E4 A4 E4 C#4 E4 A4 E4",
          lead: "A5 - . A5 G5 - F5 - E5 - F5 - D5 - - - | E5 - . E5 F5 - G5 - E5 - - - C5 - - - | D5 - . D5 F5 - Bb5 - A5 - - - G5 - F5 - | E5 - - - F5 - E5 - C#5 - - - A4 - - -",
        },
        D: {
          bass: "G2 . G2 . G3 . G2 . G2 . G2 . G3 . G2 . | Eb2 . Eb2 . Eb3 . Eb2 . Eb2 . Eb2 . Eb3 . Eb2 . | G2 . G2 . G3 . G2 . G2 . G2 . G3 . G2 . | A2 A2 A3 A2 A2 A2 A3 A2 A2 A2 A3 A2 A2 A3 A2 A3",
          drums: "k . h . h . h . s . h . h . h k | k . h . h . h . s . h . h . h k | k . h . h . h . s . h . h . h k | s . s . s . s . s s s s s s s s",
          arp: "G3 D4 G4 D4 Bb3 D4 G4 D4 G3 D4 G4 D4 Bb3 D4 G4 D4 | Eb4 Bb4 Eb5 Bb4 G4 Bb4 Eb5 Bb4 Eb4 Bb4 Eb5 Bb4 G4 Bb4 Eb5 Bb4 | G3 D4 G4 D4 Bb3 D4 G4 D4 G3 D4 G4 D4 Bb3 D4 G4 D4 | A3 E4 A4 E4 C#4 E4 A4 E4 A3 E4 A4 E4 C#4 E4 A4 E4",
          lead: "G4 - - - - - - - Bb4 - - - A4 - - - | G4 - - - Eb5 - - - - - - - D5 - - - | Bb4 - - - D5 - - - G5 - - - - - - - | A5 - - - G5 - F5 - E5 - - - C#5 - - -",
        },
        E: {
          bass: "D2 D2 D3 D2 D2 D2 D3 D2 D2 D2 D3 D2 D2 D3 D2 D3 | C2 C2 C3 C2 C2 C2 C3 C2 C2 C2 C3 C2 C2 C3 C2 C3 | Bb2 Bb2 Bb3 Bb2 Bb2 Bb2 Bb3 Bb2 Bb2 Bb2 Bb3 Bb2 Bb2 Bb3 Bb2 Bb3 | A2 A2 A3 A2 A2 A3 A2 A2 C#3 C#3 E3 E3 G3 G3 A3 A3",
          drums: "kh h h h sh h h h kh h kh h sh h h h | kh h h h sh h h kh h h kh h sh h kh h | kh h h h sh h h h kh h kh h sh h h h | kh h h h sh h kh h s s ks s s s ks o",
          stab: "D4^037 . . D4^037 . . D4^037 . D4^037 . . D4^037 . . D4^037 . | C4^047 . . C4^047 . . C4^047 . C4^047 . . C4^047 . . C4^047 . | Bb3^047 . . Bb3^047 . . Bb3^047 . Bb3^047 . . Bb3^047 . . Bb3^047 . | A3^047 . . A3^047 . . A3^047 . A3^047 . . A3^047 . . A3^047 .",
          arp: "D4 A4 D5 A4 F4 A4 D5 A4 D4 A4 D5 A4 F4 A4 D5 A4 | C4 G4 C5 G4 E4 G4 C5 G4 C4 G4 C5 G4 E4 G4 C5 G4 | Bb3 F4 Bb4 F4 D4 F4 Bb4 F4 Bb3 F4 Bb4 F4 D4 F4 Bb4 F4 | A3 E4 A4 E4 C#4 E4 A4 E4 A3 E4 A4 E4 C#4 E4 A4 E4",
          lead: "A5 - . A5 G5 - F5 - E5 - F5 - D5 - - - | E5 - . E5 F5 - G5 - E5 - - - C5 - - - | D6 - . D6 C6 - Bb5 - A5 - - - F5 - - - | E5 - - - G5 - F5 - E5 - C#5 - D5 - - -",
        },
        F: {
          bass: "D2 D2 D3 D2 D2 D2 D3 D2 D2 D2 D3 D2 D2 D3 D2 D3 | Bb2 Bb2 Bb3 Bb2 Bb2 Bb2 Bb3 Bb2 Bb2 Bb2 Bb3 Bb2 Bb2 Bb3 Bb2 Bb3 | G2 G2 G3 G2 G2 G2 G3 G2 G2 G2 G3 G2 G2 G3 G2 G3 | A2 A2 A3 A2 A2 A3 A2 A2 C#3 C#3 E3 E3 G3 G3 A3 A3",
          drums: "kh h h h sh h h kh h h kh h sh h kh h | kh h h h sh h h h kh h kh h sh h h h | kh h h h sh h h kh h h kh h sh h kh h | kh h h h sh h h h s . s s s s s s",
          stab: "D4^037 . . D4^037 . . D4^037 . D4^037 . . D4^037 . . D4^037 . | Bb3^047 . . Bb3^047 . . Bb3^047 . Bb3^047 . . Bb3^047 . . Bb3^047 . | G3^037 . . G3^037 . . G3^037 . G3^037 . . G3^037 . . G3^037 . | A3^047 . . A3^047 . . A3^047 . A3^047 . . A3^047 . . A3^047 .",
          arp: "D4 A4 D5 A4 F4 A4 D5 A4 D4 A4 D5 A4 F4 A4 D5 A4 | Bb3 F4 Bb4 F4 D4 F4 Bb4 F4 Bb3 F4 Bb4 F4 D4 F4 Bb4 F4 | G3 D4 G4 D4 Bb3 D4 G4 D4 G3 D4 G4 D4 Bb3 D4 G4 D4 | A3 E4 A4 E4 C#4 E4 A4 E4 A3 E4 A4 E4 C#4 E4 A4 E4",
          lead: "D5 - . D5 A4 - D5 - F5 - E5 F5 E5 - D5 - | F5 - - - D5 - Bb4 - C5 - D5 - C5 - Bb4 - | G4 - Bb4 - D5 - G5 - - - F5 - D5 - Bb4 - | C#5 - - - E5 - - - A5 - - - G5 - E5 -",
        },
      },
      order: ["A", "B", "C", "F", "E", "D", "C", "E"],
    },
    // Starlight Highway: A 50s flying-saucer groove in A minor: a wobbly sine
    // theremin slides between notes in chromatic steps over augmented and
    // diminished arps, quirky offbeat blips and a whole-tone bridge.
    driveStars: {
      bpm: 108,
      rush: 10,
      voices: {
        bass: { wave: "triangle", gain: 0.85, decay: 0.1, sustain: 0.5 },
        drums: { kit: true, gain: 0.55, from: 0.1 },
        arp: { wave: "pulse", duty: 0.25, gain: 0.2, decay: 0.04, sustain: 0.4, from: 0.25 },
        blip: { wave: "pulse", duty: 0.125, gain: 0.2, decay: 0.03, sustain: 0.1, from: 0.35 },
        theremin: { wave: "sine", gain: 0.42, decay: 0.25, sustain: 0.9, vibrato: { rate: 5.5, depth: 0.03, delay: 0.08 }, from: 0.45 },
      },
      patterns: {
        A: {
          bass: "A2 - . . E3 . A2 - C3 - . . E3 . G#2 - | F2 - . . C3 . F2 - Ab2 - . . C3 . E2 - | A2 - . . E3 . A2 - C3 - . . E3 . F2 - | E2 - . . G#2 . E2 - C3 - . . B2 . G#2 -",
          drums: "k . . h . . s . . h k . s . . h | k . . h . . s . . h k . s . . h | k . . h . . s . . h k . s . . h | k . . h . . s . s . s s . s s s",
          arp: "A3^037 - - A3^037 - - A3^037 - A3^037 - - A3^037 - - A3^037 - | F3^037 - - F3^037 - - F3^037 - F3^037 - - F3^037 - - F3^037 - | A3^037 - - A3^037 - - A3^037 - A3^037 - - A3^037 - - A3^037 - | E3^048 - - E3^048 - - E3^048 - E3^048 - - E3^048 - - E3^048 -",
          blip: ". . E5 . . A5 . . C6 . . A5 . E5 . . | . . C5 . . F5 . . Ab5 . . F5 . C5 . . | . . E5 . . A5 . . C6 . . A5 . E5 . . | . . E5 . . G#5 . . C6 . . G#5 . E5 . .",
          theremin: ". . . . . . . . A4 Bb4 B4 C5 - - - - | C5 - - - - - - - - - - - B4 Bb4 A4 Ab4 | A4 - - - - - - - - - - - - - - - | . . . . G#4 A4 A#4 B4 C5 - - - - - - -",
        },
        B: {
          bass: "A2 - . . E3 . A2 - C3 - . . E3 . B2 - | C3 - . . G#2 . C3 - E3 - . . G#2 . C#3 - | D3 - . . A2 . D3 - F3 - . . A2 . C3 - | B2 - . . F3 . B2 - D3 - . . F3 . G#2 -",
          drums: "k . . h . . s . . h k . s . . h | k . . h . . s . . h k . s . . h | k . . h . . s . . h k . s . . h | k . . h . . s . s . s s . s s s",
          arp: "A3^037 - - A3^037 - - A3^037 - A3^037 - - A3^037 - - A3^037 - | C4^048 - - C4^048 - - C4^048 - C4^048 - - C4^048 - - C4^048 - | D4^037 - - D4^037 - - D4^037 - D4^037 - - D4^037 - - D4^037 - | B3^0369 - - B3^0369 - - B3^0369 - B3^0369 - - B3^0369 - - B3^0369 -",
          blip: ". . E5 . . A5 . . C6 . . A5 . E5 . . | . . E5 . . G#5 . . C6 . . G#5 . E5 . . | . . D5 . . F5 . . A5 . . F5 . D5 . . | . . B4 . . F5 . . Ab5 . . F5 . B4 . .",
          theremin: "E4 F4 F#4 G4 G#4 A4 - - - - - - - - - - | C5 - - - - - - - B4 Bb4 A4 G#4 - - - - | F4 - - - - - E4 Eb4 D4 - - - F4 F#4 G4 G#4 | Ab4 - - - F4 - - - D5 - - - - - C#5 C5",
        },
        C: {
          bass: "F2 - . . C3 . F2 - A2 - . . C3 . Ab2 - | F2 - . . C3 . F2 - Ab2 - . . C3 . G#2 - | A2 - . . E3 . A2 - C3 - . . E3 . F2 - | E2 - . . C3 . E2 - G#2 - . . C3 . E2 -",
          drums: "k . . h . . s . . h k . s . . h | k . . h . . s . . h k . s . . h | k . . h . . s . . h k . s . . h | k . . h . . s . s . s s . s s s",
          arp: "F3^047 - - F3^047 - - F3^047 - F3^047 - - F3^047 - - F3^047 - | F3^037 - - F3^037 - - F3^037 - F3^037 - - F3^037 - - F3^037 - | A3^037 - - A3^037 - - A3^037 - A3^037 - - A3^037 - - A3^037 - | E3^048 - - E3^048 - - E3^048 - E3^048 - - E3^048 - - E3^048 -",
          blip: ". . C5 . . F5 . . A5 . . F5 . C5 . . | . . C5 . . F5 . . Ab5 . . F5 . C5 . . | . . E5 . . A5 . . C6 . . A5 . E5 . . | . . E5 . . G#5 . . C6 . . G#5 . E5 . .",
          theremin: "A4 Bb4 B4 C5 - - - - - - - - A5 - - - | Ab5 - - - - - - - G5 Gb5 F5 - - - - - | E5 - - - - - D#5 D5 C5 - - - E5 - - - | G#5 - - - - - - - G5 F#5 F5 E5 - - - -",
        },
        D: {
          bass: "C3 - - - E3 - - - G#3 - - - E3 - - - | D3 - - - F#3 - - - A#3 - - - F#3 - - - | E2 - - - G#2 - - - C3 - - - G#2 - - - | G#2 - - - B2 - - - D3 - - - F3 - - -",
          drums: "k . . . . . . h . . k . . . . . | k . . . . . . h . . k . . . . . | k . . . . . . h . . k . . . . . | k . . h . . s . s . s s . s s s",
          arp: "C4 D4 E4 F#4 G#4 A#4 C5 A#4 G#4 F#4 E4 D4 C4 E4 G#4 C5 | D4 E4 F#4 G#4 A#4 C5 D5 C5 A#4 G#4 F#4 E4 D4 F#4 A#4 D5 | E4 F#4 G#4 A#4 C5 D5 E5 D5 C5 A#4 G#4 F#4 E4 G#4 C5 E5 | G#3 B3 D4 F4 G#4 B4 D5 F5 G#5 F5 D5 B4 G#4 F4 D4 B3",
          theremin: "E5 - - - - - - - - - - - F5 F#5 G5 G#5 | A#5 - - - - - - - A5 G#5 G5 F#5 - - - - | G#5 - - - - - - - - - - - G5 F#5 F5 E5 | F5 - - - - - - - E5 Eb5 D5 - - - - -",
        },
        E: {
          bass: "A2 - . . E3 . A2 - C3 - . . E3 . G#2 - | F2 - . . C3 . F2 - Ab2 - . . C3 . E2 - | D3 - . . A2 . D3 - F3 - . . A2 . F2 - | E2 - . . G#2 . E2 - C3 - . . B2 . G#2 -",
          drums: "k . . h . . s . . h k . s . . h | k . . h . . s . . h k . s . . h | k . . h . . s . . h k . s . . h | k . . h . . s . s . s s . s s s",
          arp: "A3^037 - - A3^037 - - A3^037 - A3^037 - - A3^037 - - A3^037 - | F3^037 - - F3^037 - - F3^037 - F3^037 - - F3^037 - - F3^037 - | D4^037 - - D4^037 - - D4^037 - D4^037 - - D4^037 - - D4^037 - | E3^048 - - E3^048 - - E3^048 - E3^048 - - E3^048 - - E3^048 -",
          blip: ". . E5 . . A5 . . C6 . . A5 . E5 . . | . . C5 . . F5 . . Ab5 . . F5 . C5 . . | . . D5 . . F5 . . A5 . . F5 . D5 . . | . . E5 . . G#5 . . C6 . . G#5 . E5 . .",
          theremin: "C5 - - - B4 - A4 - E5 - - - - - - - | F5 - - - Eb5 - C5 - Ab4 - - - - - - - | D5 - - - C5 - A4 - F5 - - - - - E5 Eb5 | D5 - C#5 C5 - - - - B4 - - - G#4 - - -",
        },
      },
      order: ["A", "B", "C", "D", "E", "B", "C"],
    },
  },
};
