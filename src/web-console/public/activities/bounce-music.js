// Plan2Code Web Console - bounce: its music, twenty chip tracks built from short scores, merged into bounce-sfx.js beside the sounds; defines only.
//
// The car's radio: twenty fast arcade tunes, dealt in a new order each run
// (MUSIC_TRACKS and dealMusic in bounce.js). Nothing is recorded: each is note
// data for music.js's sequencer, the shape it documents,
// { bpm, rush, voices, patterns, order }. Writing twenty of those out step by
// step would be a wall of text, so each tune is a short score (SCORES) that
// build() turns into a track when the file loads:
//
//   { title, key, scale, bpm, kit, bass, arp, drums, A: { chords, lead }, B: { chords, lead } }
//
// `key` is the tonic as a MIDI note for the bass (36 is C2, 47 is B2) and
// `scale` a name in SCALES. A part's `chords` is a chord a bar, each a scale
// degree ("1 6 3 7"; the triad on it is built from the scale), cycled over the
// part. `lead` is the tune: bars of sixteen characters, a sixteenth each, split
// by spaces. "1" to "7" are the scale's degrees from the tonic, "a" to "g" the
// same seven an octave up, "A" to "G" an octave down, "-" holds the note before
// and "." rests. `bass`, `arp` and `drums` name a bar's pattern in BASS, ARP and
// DRUMS (a part may name its own).
//
// Every tune plays the same way: four bars in, the tune without and then with
// its arpeggio, the second tune twice, a four bar break and both tunes again.
// The game sends how hot play is: an echo of the lead joins for a boss and a
// harmony under it in a Fever, and the tempo climbs a little with both.
// A name may be defined only once across tones.js and every game's file. No
// imports.

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  mixo: [0, 2, 4, 5, 7, 9, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
};

const NOTES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const noteName = (midi) => NOTES[midi % 12] + (Math.floor(midi / 12) - 1);

// A scale degree (0 is the tonic; it may run below or past the octave) in semitones.
const semis = (scale, d) => scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);

// A bar of bass: r the chord's root, R the root an octave up, t its third, f
// its fifth.
const BASS = {
  drive: "r.r.r.r.r.r.r.r.",
  octave: "r.R.r.R.r.R.r.R.",
  gallop: "r.rrr.rrr.rrr.rr",
  sixteen: "rrrrrrrrrrrrRrrr",
  synco: "r..r..r.r..r..R.",
  walk: "r.r.t.t.f.f.t.t.",
  funk: "r..r.r..R.r..rf.",
  rock: "r.r.r.r.r.r.f.R.",
  oom: "r.R.f.R.r.R.f.R.",
};

// A bar of arpeggio: 0 the chord's root, 1 its third, 2 its fifth, 3 to 5 the
// same an octave up, x the whole chord as a chip arpeggio on one note.
const ARP = {
  up: "0123012301230123",
  updown: "0123432101234321",
  alberti: "0.2.1.2.0.2.1.2.",
  high: "3.5.4.5.3.5.4.5.",
  roll: "0120120120120123",
  stab: "x-..x-..x-.x-...",
  off: "..x...x...x...x.",
  skank: "..x-..x-..x-..x-",
};

// A bar of drums: k kick, s snare, h hat, o open hat, K kick and hat, S snare
// and hat, O kick and open hat, B kick and snare.
const DRUMS = {
  rock: "K.h.S.h.K.K.S.h.",
  four: "K.o.B.o.K.o.B.o.",
  dnb: "K.h.S.h.h.K.S.h.",
  gallop: "K.hkS.hkK.hkS.hk",
  sixteen: "KhhhShhhKhKhShhh",
  half: "K.h.h.h.S.h.h.k.",
  hats: "h.h.h.h.h.h.h.h.",
  fill: "K.h.S.h.K.s.ssss",
  build: "k.k.k.k.kkkkssss",
};

const DRUM_TOKENS = { k: "k", s: "s", h: "h", o: "o", K: "kh", S: "sh", O: "ko", B: "ks", ".": "." };

// The chips: a bass, a lead and an arpeggio voice each.
const VIBRATO = { rate: 6, depth: 0.012, delay: 0.14 };
const KITS = {
  // The triangle bass and thin squares of a grey home console.
  nes: {
    bass: { wave: "triangle", gain: 0.9, decay: 0.08, sustain: 0.55 },
    lead: { wave: "pulse", duty: 0.25, gain: 0.3, decay: 0.07, sustain: 0.7, vibrato: VIBRATO },
    arp: { wave: "pulse", duty: 0.125, gain: 0.13, decay: 0.05, sustain: 0.3 },
  },
  // Three square waves and nothing else.
  sms: {
    bass: { wave: "pulse", duty: 0.5, gain: 0.42, decay: 0.07, sustain: 0.45 },
    lead: { wave: "pulse", duty: 0.125, gain: 0.3, decay: 0.07, sustain: 0.7, vibrato: VIBRATO },
    arp: { wave: "pulse", duty: 0.25, gain: 0.12, decay: 0.05, sustain: 0.3 },
  },
  // Saw waves: an arcade cabinet's synth board.
  saw: {
    bass: { wave: "sawtooth", gain: 0.3, decay: 0.09, sustain: 0.5 },
    lead: { wave: "sawtooth", gain: 0.2, decay: 0.08, sustain: 0.75, vibrato: VIBRATO },
    arp: { wave: "pulse", duty: 0.25, gain: 0.12, decay: 0.05, sustain: 0.3 },
  },
  // A rounder board: a full square lead over a plucked triangle.
  fm: {
    bass: { wave: "triangle", gain: 0.9, decay: 0.07, sustain: 0.5 },
    lead: { wave: "square", gain: 0.22, decay: 0.06, sustain: 0.65, vibrato: VIBRATO },
    arp: { wave: "triangle", gain: 0.32, decay: 0.04, sustain: 0.2 },
  },
  // A home computer: a hollow pulse bass under a buzzing saw.
  c64: {
    bass: { wave: "pulse", duty: 0.25, gain: 0.42, decay: 0.08, sustain: 0.5 },
    lead: { wave: "sawtooth", gain: 0.19, decay: 0.08, sustain: 0.7, vibrato: { rate: 6.5, depth: 0.016, delay: 0.1 } },
    arp: { wave: "pulse", duty: 0.125, gain: 0.14, decay: 0.05, sustain: 0.3 },
  },
};

// How hot play must be for the echo and the harmony to join, and how far
// behind the lead the echo runs, in steps.
const ECHO_FROM = 0.7;
const HARMONY_FROM = 0.9;
const ECHO_STEPS = 3;

// The beats a minute a track gains at full heat.
const RUSH = 14;

const LEAD_CHARS = "ABCDEFG1234567abcdefg";

function build(score) {
  const scale = SCALES[score.scale];
  const kit = KITS[score.kit];
  // The lead's tonic sits two octaves over the bass's, so a tune tops out
  // around the top of a chip's sweet range, and the arpeggio in the octave
  // around middle C, whatever the key.
  const top = score.key + 24;
  const mid = score.key + (score.key < 43 ? 24 : 12);
  // A chord's root above `base`, kept within a fifth of it either way.
  const rootOf = (base, chord) => {
    const up = semis(scale, chord - 1);
    return base + (up > 7 ? up - 12 : up);
  };
  const tone = (chord, i) => semis(scale, chord - 1 + 2 * (i % 3)) - semis(scale, chord - 1) + 12 * Math.floor(i / 3);
  const chordsOf = (part, bars) => {
    const list = part.chords.split(/\s+/).filter(Boolean).map(Number);
    return Array.from({ length: bars }, (_, k) => list[k % list.length]);
  };
  const line = (bars) => bars.map((steps) => steps.join(" ")).join(" | ");
  const bassBars = (chords, name) =>
    chords.map((chord) =>
      [...(BASS[name] || name)].map((ch) => {
        if (ch === "." || ch === "-") return ch;
        const root = rootOf(score.key, chord);
        return noteName(root + (ch === "R" ? 12 : ch === "t" ? tone(chord, 1) : ch === "f" ? tone(chord, 2) : 0));
      }),
    );
  const arpBars = (chords, name) =>
    chords.map((chord) =>
      [...(ARP[name] || name)].map((ch) => {
        if (ch === "." || ch === "-") return ch;
        const root = rootOf(mid, chord);
        if (ch === "x") return `${noteName(root)}^0${tone(chord, 1)}${tone(chord, 2)}`;
        return noteName(root + tone(chord, Number(ch)));
      }),
    );
  const drumBars = (names) => names.map((name) => [...(DRUMS[name] || name)].map((ch) => DRUM_TOKENS[ch]));
  const leadSteps = (part) => [...part.lead.replace(/\s+/g, "")];
  const leadLine = (steps, shift) =>
    steps
      .map((ch) => {
        if (ch === "." || ch === "-") return ch;
        return noteName(top + semis(scale, LEAD_CHARS.indexOf(ch) - 7 + shift));
      })
      .join(" ");
  const echoOf = (steps) => [...steps.slice(-ECHO_STEPS), ...steps.slice(0, -ECHO_STEPS)];

  // A tune's part: every voice, with a drum fill in its last bar.
  const tune = (part, withArp) => {
    const steps = leadSteps(part);
    const bars = steps.length / 16;
    const chords = chordsOf(part, bars);
    const beat = part.drums || score.drums;
    const out = {
      bass: line(bassBars(chords, part.bass || score.bass)),
      lead: leadLine(steps, 0),
      echo: leadLine(echoOf(steps), 0),
      harmony: leadLine(steps, -5),
      drums: line(drumBars(chords.map((_, k) => (k === bars - 1 ? "fill" : beat)))),
    };
    if (withArp) out.arp = line(arpBars(chords, part.arp || score.arp));
    return out;
  };
  // Four bars in: the bass and the hats, then the beat, then a roll.
  const intro = () => {
    const chords = chordsOf(score.A, 4);
    return {
      bass: line(bassBars(chords, score.A.bass || score.bass)),
      arp: line(arpBars(chords, score.A.arp || score.arp)),
      drums: line(drumBars(["hats", "hats", score.drums, "build"])),
    };
  };
  // The break: the tune drops out, the arpeggio climbs over a held bass and
  // the drums roll back in.
  const breakdown = () => {
    const chords = chordsOf(score.B, 4);
    return {
      bass: line(bassBars(chords, "r-------r---r-r-")),
      arp: line(arpBars(chords, "0123432101234321")),
      drums: line(drumBars(["half", "half", "half", "build"])),
    };
  };
  // The lead's chip again, quieter and without its vibrato.
  const quiet = ({ vibrato, ...voice }, from, gain) => ({ ...voice, gain: voice.gain * gain, from });
  const voices = {
    bass: kit.bass,
    lead: kit.lead,
    arp: kit.arp,
    drums: { kit: true, gain: 0.6 },
    echo: quiet(kit.lead, ECHO_FROM, 0.35),
    harmony: quiet(kit.lead, HARMONY_FROM, 0.5),
  };
  return {
    title: score.title,
    bpm: score.bpm,
    rush: RUSH,
    voices,
    patterns: { I: intro(), A1: tune(score.A, false), A: tune(score.A, true), B: tune(score.B, true), C: breakdown() },
    order: ["I", "A1", "A", "B", "B", "C", "A", "B"],
  };
}

export const SCORES = [
  {
    title: "Turbo Sunrise",
    key: 45,
    scale: "minor",
    bpm: 160,
    kit: "nes",
    bass: "drive",
    arp: "up",
    drums: "rock",
    A: {
      chords: "1 6 3 7",
      lead: "5.5.3.5-..a-5.3. 6.6.3.6-..a-6.3. 5.5.3.5-..g-5.3. 4.4.2.4-..7-4.2. a.a.5.a-..c-b.a. a.a.6.a-..c-b.a. g.g.5.g-..b-a.g. g-..b-..d-..b-g-",
    },
    B: {
      chords: "6 7 1 1",
      bass: "octave",
      lead: "c-b-a-6-a-..6.a. b-a-g-5-g-..4.g. a-..5-..a.b.c-b- a-------..5.a.c. c-d-c-a-6-..a.c. d-c-b-g-b-..g.b. c-..a-..e-..c-b- a-------........",
    },
  },
  {
    title: "Neon Overpass",
    key: 40,
    scale: "minor",
    bpm: 150,
    kit: "saw",
    bass: "sixteen",
    arp: "updown",
    drums: "four",
    A: {
      chords: "1 1 6 7",
      lead: "5-----3-5-----a- a---g-5-3---5--- 6-----a-c-----a- b-----g-b---d--- e-----c-e-----a- e---d-c-a---c--- c-----a-c---d-c- b-------g-..b.d.",
    },
    B: {
      chords: "4 4 6 7",
      lead: "d.d.d-c-a-..6-a- d.d.d-c-a-..c-d- c.c.c-a-6-..a-c- b.b.b-d-b-..g-b- f.f.f-d-a-..d-f- f-d-a-d-f-d-a-d- c.c.e-c-a-..a-c- b-..d-..g-b-d-g-",
    },
  },
  {
    title: "Pixel Pursuit",
    key: 38,
    scale: "dorian",
    bpm: 168,
    kit: "sms",
    bass: "gallop",
    arp: "stab",
    drums: "gallop",
    A: {
      chords: "1 4",
      lead: "1.13.35.5.31.3.5 6.64.46.a.64.6.a 5.53.35.a.53.5.a a-6-4-6-a-..6.4. 1.13.35.5.31.3.5 6.64.46.a.64.6.a c.ca.a5.a.5a.c.e d-..a-..6-4-6-a-",
    },
    B: {
      chords: "7 4 1 1",
      bass: "drive",
      lead: "b-..g-..b-d-b-g- a-..6-..a-d-a-6- a.5.a.c-..a.5.3. 5-------..3.5.a. d-..b-..d-b-g-b- d-..a-..d-a-6-a- c.a.c.e-..c.a.5. a-------........",
    },
  },
  {
    title: "Checkered Flag",
    key: 36,
    scale: "major",
    bpm: 172,
    kit: "nes",
    bass: "octave",
    arp: "alberti",
    drums: "rock",
    A: {
      chords: "1 5 6 4",
      lead: "3.5.a.c-..a.5.3. 2.5.7.b-..7.5.2. 3.6.a.c-..a.6.3. 4.6.a.d-..c.a.6. c-..a.5.c-..a.5. b-..g.5.b-..g.5. a-..6.3.a-..c.e. d-..c-..a-6-a-c-",
    },
    B: {
      chords: "4 5 3 6",
      bass: "drive",
      lead: "f-e-d-c-a-..c.d. e-d-b-g-b-..d.e. e-..g-..e-c-b-g- a-..c-..a-c-a-6- f-e-d-c-a-..c.d. e-d-b-g-b-..d.e. g-..e-..c-..e-g- a-------..5.6.7.",
    },
  },
  {
    title: "Rocket Skates",
    key: 43,
    scale: "mixo",
    bpm: 156,
    kit: "fm",
    bass: "octave",
    arp: "off",
    drums: "four",
    A: {
      chords: "1 7 4 1",
      lead: "5.5.6.5.3-..5-.. 4.4.5.4.2-..4-.. 6.6.a.6.4-..6-.. 5-3-5-a-..5.3.1. a.a.b.a.5-..a-.. b.b.d.b.g-..b-.. d.d.c.a.6-..a-.. a-..5-..3-5-a-c-",
    },
    B: {
      chords: "4 1 7 1",
      lead: "d-..d.c.a-..6-a- c-..c.a.5-..3-5- b-..b.d.b-..g-b- a---5---a-b-c-b- d-..d.f.d-..a-d- e-..e.c.a-..c-e- d-..b-..g-..b-d- c-..a-..5-..a---",
    },
  },
  {
    title: "Boss Rush",
    key: 40,
    scale: "phrygian",
    bpm: 176,
    kit: "c64",
    bass: "sixteen",
    arp: "roll",
    drums: "dnb",
    A: {
      chords: "1 2",
      lead: "1.1.5.1.1.5.1.3. 2.2.6.2.2.6.2.4. 1.1.5.1.a.5.3.1. 2-4-6-4-2-..4.2. 5.5.a.5.5.a.5.c. 6.6.b.6.6.b.6.d. c.a.5.3.c.a.5.3. b-..6-..4-6-b-d-",
    },
    B: {
      chords: "1 2 3 2",
      drums: "gallop",
      lead: "a-------5-a-b-a- b-------6-b-d-b- c-------g-c-e-c- d-..b-..6-..b-.. e-------c-e-c-a- f-------d-f-d-b- g-..e-..c-..e-g- f-d-b-6-b-d-f-d-",
    },
  },
  {
    title: "Hairpin",
    key: 42,
    scale: "minor",
    bpm: 164,
    kit: "sms",
    bass: "synco",
    arp: "up",
    drums: "sixteen",
    A: {
      chords: "1 7 6 7",
      lead: "a-5.a-5.c-a.5-3. b-g.b-g.d-b.g-4. a-6.a-6.c-a.6-3. b-g.b-g.d---b--- a-5.a-5.c-a.5-3. b-g.b-g.d-b.g-4. c-a.c-a.f-c.a-6. d-------b-g-b-d-",
    },
    B: {
      chords: "4 6 7 1",
      bass: "drive",
      lead: "f.d.a.d.f.d.a.d. f.c.a.c.f.c.a.c. g.d.b.d.g.d.b.d. e---c---a-c-e-c- f.d.a.d.f.d.a.d. f.c.a.c.f.c.a.c. g-..d-..b-d-g-d- e-------c---a---",
    },
  },
  {
    title: "Arcade Royale",
    key: 41,
    scale: "major",
    bpm: 152,
    kit: "nes",
    bass: "synco",
    arp: "high",
    drums: "sixteen",
    A: {
      chords: "4 5 3 6",
      lead: "6-a-d-c-..a.6.a. 7-b-e-d-..b.7.b. 5-g-c-b-..g.5.g. 6-a-c-e-..c.a.6. d-..c.a.d-..c.a. e-..d.b.e-..d.b. e-..c.g.e-..c.g. c-..a-..6-a-c-e-",
    },
    B: {
      chords: "2 5 1 6",
      bass: "octave",
      lead: "4.6.b.d-..b.6.4. 5.7.b.e-..b.7.5. 5.a.c.e-..c.a.5. 6.a.c.e-..c.a.6. d-b-6-b-d-..f-d- e-b-g-b-e-..g-e- e-c-a-c-e-..c-a- a-------..c.d.e.",
    },
  },
  {
    title: "Nitro Boost",
    key: 47,
    scale: "minor",
    bpm: 174,
    kit: "saw",
    bass: "synco",
    arp: "roll",
    drums: "dnb",
    A: {
      chords: "1 3 7 6",
      lead: "5---..3.5---..a. g---..5.g---..c. b---..g.b---..d. c---a---6-a-c-a- e---..c.e---..a. e---..c.g---..e. d---..b.d---..g. f---c---a---c-..",
    },
    B: {
      chords: "4 1 6 7",
      bass: "sixteen",
      lead: "d..d..a.d..d..f. c..c..a.c..c..e. c..c..a.c..c..f. d..d..b.d..b.g.b f..f..d.f..f..a. e..e..c.e..e..a. f..f..c.f..c.a.c g---d---b---d---",
    },
  },
  {
    title: "Dashboard Lights",
    key: 36,
    scale: "harmonic",
    bpm: 148,
    kit: "c64",
    bass: "rock",
    arp: "updown",
    drums: "rock",
    A: {
      chords: "1 4 5 1",
      lead: "1.3.5.a.c.a.5.3. 4.6.a.d.f.d.a.6. 5.7.b.e.g.e.b.7. a-..5-..3-5-a-.. c.a.5.a.c.a.5.a. d.a.6.a.d.a.6.a. e.b.g.b.e.b.g.b. c-------a-..5-..",
    },
    B: {
      chords: "6 4 5 5",
      lead: "c-a-6-a-c-..e-c- d-a-6-a-d-..f-d- e-b-g-b-e-..d-b- g-------e-d-b-g- c-a-6-a-c-..e-c- d-a-6-a-d-..f-d- e-..g-..b-..d-.. e-------g-------",
    },
  },
  {
    title: "Speed Bump Boogie",
    key: 45,
    scale: "major",
    bpm: 160,
    kit: "fm",
    bass: "walk",
    arp: "stab",
    drums: "rock",
    A: {
      chords: "1 1 4 1 5 4 1 5",
      lead: "1.3.5.6.a.6.5.3. 1.3.5.6.a.6.5.3. 4.6.a.b.d.b.a.6. 1.3.5.6.a.6.5.3. 5.7.b.c.e.c.b.7. 4.6.a.b.d.b.a.6. a-..5.6.a-..c-.. b-..7-..5.7.b.e.",
    },
    B: {
      chords: "4 4 1 1 5 4 1 1",
      lead: "d-d.d-c.a-..6.a. d-d.d-f.d-..a.d. c-c.c-a.5-..3.5. c-c.c-e.c-..a.c. e-e.e-d.b-..g.b. d-d.d-c.a-..6.a. a.5.3.5.a.c.e.c. a-------........",
    },
  },
  {
    title: "Jump Start",
    key: 38,
    scale: "major",
    bpm: 166,
    kit: "sms",
    bass: "octave",
    arp: "skank",
    drums: "rock",
    A: {
      chords: "1 4 5 1",
      lead: "5-a-c-a-5-..3.5. 6-a-d-a-6-..4.6. 7-b-e-b-7-..5.7. a---c-a-5---.... c-e-c-a-c-..a.c. d-f-d-a-d-..a.d. e-g-e-b-e-..d.b. a-------..5.a.c.",
    },
    B: {
      chords: "6 4 1 5",
      lead: "c.c.a.6.c.c.a.6. d.d.a.6.d.d.a.6. e.e.c.a.e.e.c.a. e.e.b.g.e-d-b-.. c.c.a.6.c.c.e.c. d.d.a.6.d.d.f.d. e-..c-..a-..5-.. 7-..b-..e-d-b-7-",
    },
  },
  {
    title: "Tunnel Vision",
    key: 43,
    scale: "minor",
    bpm: 158,
    kit: "saw",
    bass: "sixteen",
    arp: "alberti",
    drums: "four",
    A: {
      chords: "1 1 3 7",
      lead: "a-..a.5.a-..c-a- 5-..5.3.5-..a-5- g-..g.5.g-..c-g- b-..b.g.b-..d-b- c-..c.a.c-..e-c- e-..d.c.a-..5-a- c-..c.g.c-..e-c- d-------b-..g-..",
    },
    B: {
      chords: "6 6 7 7",
      lead: "a-c-f-c-a-c-f-c- a-c-f-c-a-..c-a- b-d-g-d-b-d-g-d- b-d-g-d-b-..d-b- f---c---a---c--- f-e-c-a-c-..a-c- g---d---b---d--- g-..d-..b-d-g-..",
    },
  },
  {
    title: "Rubber Burner",
    key: 40,
    scale: "minor",
    bpm: 170,
    kit: "c64",
    bass: "rock",
    arp: "stab",
    drums: "rock",
    A: {
      chords: "1 3 4 1",
      lead: "1.1.3.1.5.3.1.G. 3.3.5.3.7.5.3.2. 4.4.6.4.a.6.4.3. 1-3-5-3-1-..G.1. a.a.c.a.e.c.a.g. c.c.e.c.g.e.c.b. d.d.f.d.f.d.a.6. a-..5-..3-5-a-..",
    },
    B: {
      chords: "3 7 6 5",
      bass: "gallop",
      lead: "e-..c-..g-e-c-e- d-..b-..g-d-b-d- c-..a-..f-c-a-c- b-..g-..e-b-g-b- g-e-c-e-g-..e-c- g-d-b-d-g-..d-b- f-c-a-c-f-..c-a- e-------b-..g-..",
    },
  },
  {
    title: "Coin-Op Carnival",
    key: 46,
    scale: "major",
    bpm: 154,
    kit: "nes",
    bass: "oom",
    arp: "off",
    drums: "gallop",
    A: {
      chords: "1 1 5 5 5 5 1 1",
      lead: "5.5.6.5.3.5.a-.. c.c.d.c.a.c.e-.. e.e.f.e.b.e.g-.. b.b.c.b.7.b.e-.. e.d.b.7.5.7.b.d. e-..b-..g-e-b-7- a.5.3.5.a.c.e.c. a-..5-..a-......",
    },
    B: {
      chords: "4 4 1 1 5 5 1 1",
      lead: "d-a-6-a-d-a-f-d- d.c.a.6.a-..6-a- c-a-5-a-c-a-e-c- c.a.5.3.5-..3-5- b-7-5-7-b-7-e-b- b.d.e.g.e-..d-b- a.c.e.c.a.5.3.5. a-------........",
    },
  },
  {
    title: "Midnight Lane Change",
    key: 41,
    scale: "dorian",
    bpm: 146,
    kit: "fm",
    bass: "funk",
    arp: "stab",
    drums: "sixteen",
    A: {
      chords: "1 4",
      lead: "5..5.3.5..a.5.3. 6..6.4.6..a.6.4. 5..5.3.5..a.c.a. a-..6-..4.6.a.d. c..c.a.c..e.c.a. d..d.a.d..f.d.a. e..c.a.5..a.c.e. d-------a-6-4-..",
    },
    B: {
      chords: "7 4 1 1",
      lead: "b-d-b-g-..g.b.d. a-d-a-6-..6.a.d. c-..a.5.c-..a.5. a-------..5.a.c. d-b-g-b-d-..b-d- f-d-a-d-f-..d-f- e-c-a-c-e-c-a-5- a-------........",
    },
  },
  {
    title: "Thunder Alley",
    key: 38,
    scale: "harmonic",
    bpm: 178,
    kit: "saw",
    bass: "gallop",
    arp: "up",
    drums: "gallop",
    A: {
      chords: "1 6 4 5",
      lead: "a.aa5.55a.aac.a. a.aa6.66a.aac.a. a.aa6.66d.ddf.d. b.bbg.gge.eeg.e. e-..c-..a-c-e-c- f-..c-..a-c-f-c- f-..d-..a-d-f-d- e-g-b-g-e-..g-..",
    },
    B: {
      chords: "4 5 1 1 6 5 1 1",
      bass: "sixteen",
      lead: "d.a.6.a.d.a.6.a. e.b.g.b.e.b.g.b. e.c.a.c.e.c.a.c. a-..5-..a-c-e-.. f.c.a.c.f.c.a.c. g.e.b.e.g.e.b.e. a.c.e.c.a.c.e.c. a-------........",
    },
  },
  {
    title: "Sky Ramp",
    key: 39,
    scale: "major",
    bpm: 162,
    kit: "fm",
    bass: "drive",
    arp: "high",
    drums: "four",
    A: {
      chords: "1 3 4 5",
      lead: "3-5-a---..5.a.c. 5-7-b---..7.b.e. 6-a-d---..a.d.f. 7-b-e---b-e-b-7- c-e-c---..a.c.e. e-g-e---..c.e.g. f-d-a---..a.d.f. e-------b-..g-..",
    },
    B: {
      chords: "6 5 4 5",
      bass: "octave",
      lead: "a.c.a.6.a.c.e.c. b.d.b.7.b.d.e.d. a.d.a.6.a.d.f.d. b-..e-..g-e-b-.. c.e.c.a.c.e.f.e. b.e.b.g.b.e.g.e. d-..f-..d-a-6-a- b-------..5.7.b.",
    },
  },
  {
    title: "Laser Lanes",
    key: 47,
    scale: "minor",
    bpm: 154,
    kit: "c64",
    bass: "octave",
    arp: "roll",
    drums: "four",
    A: {
      chords: "1 5 6 4",
      lead: "1.5.a.5.1.5.a.5. 2.5.b.5.2.5.b.5. 3.6.a.6.3.6.a.6. 4.6.a.6.d-a-6-4- c---a-5-c---e-c- b---g-5-b---e-b- c---a-6-c---f-c- d---a---f-d-a-..",
    },
    B: {
      chords: "6 7 5 1",
      bass: "sixteen",
      lead: "f-..f.c.a-..c-f- g-..g.d.b-..d-g- e-..e.b.7-..b-e- e---c---a-c-e-c- f.c.a.c.f.c.a.c. g.d.b.d.g.d.b.d. e.b.7.b.e.b.7.b. a-------..5-a-..",
    },
  },
  {
    title: "Victory Lap",
    key: 43,
    scale: "major",
    bpm: 168,
    kit: "nes",
    bass: "drive",
    arp: "up",
    drums: "rock",
    A: {
      chords: "1 5 6 3 4 1 4 5",
      lead: "c-b-a-5-a-..5.a. b-a-7-5-7-..5.7. a-7-6-3-6-..3.6. 7-6-5-3-5-..3.5. 6-a-d-a-6-..a.d. 5-a-c-a-5-..a.c. 6-a-d-f-d-..a.d. e-..d-..b-d-e-g-",
    },
    B: {
      chords: "6 4 1 5",
      bass: "octave",
      lead: "c.c.c-a.c-..a-c- d.d.d-a.d-..a-d- e.e.e-c.e-..c-e- e.e.e-b.e-..b-d- f.f.f-c.a-..c-f- f.f.f-d.a-..d-f- e-c-a-c-e-..c-a- b-------..5.7.b.",
    },
  },
];

// bounceSong1 to bounceSong20, in the scores' order.
export const BOUNCE_MUSIC = Object.fromEntries(SCORES.map((score, k) => [`bounceSong${k + 1}`, build(score)]));
