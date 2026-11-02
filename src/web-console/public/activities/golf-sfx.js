// Plan2Code Web Console - golf: its own sound effects, merged into tones.js beside the shared kit; defines only.
//
// `tones` are one-shot sounds played with tone(name, level, pitch); `hums` are
// held sounds kept going with hum(id, name, level, pitch). Both take the shapes
// tones.js documents, as plain objects (tones.js freezes them). A name may be
// defined only once across tones.js and every game's file. No imports.

export default {
  tones: {
    // The club face on the ball: a short woody click under the old `putt`.
    golfThock: { layers: [
      { type: "noise", seconds: 0.03, gain: 0.7, filter: { type: "bandpass", from: 2600, to: 1800, q: 2.5 } },
      { type: "triangle", from: 900, to: 560, seconds: 0.04, gain: 0.6 },
    ] },
    // The ball dropping in: a few rattles off the cup's plastic, quicker and
    // softer each time, and a low knock on the bottom.
    golfCupRattle: { layers: [
      ...[0, 0.07, 0.12, 0.155, 0.18].map((delay, i) => ({ type: "noise", seconds: 0.025, delay, gain: 0.7 - i * 0.1, filter: { type: "bandpass", from: 2400 - i * 150, to: 2000, q: 3 } })),
      { type: "triangle", from: 1600, to: 1500, seconds: 0.05, gain: 0.35 },
      { type: "sine", from: 180, to: 90, seconds: 0.08, delay: 0.2, gain: 0.7 },
    ] },
    // A fast ball over the cup's rim: a bright metal clink.
    golfLipOut: { layers: [
      { type: "triangle", from: 2100, to: 2060, seconds: 0.16, gain: 0.6 },
      { type: "sine", from: 3150, to: 3100, seconds: 0.1, gain: 0.3 },
      { type: "noise", seconds: 0.02, gain: 0.5, filter: { type: "bandpass", from: 4000, to: 3500, q: 3 } },
    ] },
    // The result stingers. A birdie is a bird: two chirps over a bright rise.
    golfBirdie: { layers: [
      { type: "sine", from: 2400, to: 3300, seconds: 0.07, vibrato: { rate: 40, depth: 0.03 } },
      { type: "sine", from: 2600, to: 3600, seconds: 0.07, delay: 0.11, vibrato: { rate: 40, depth: 0.03 } },
      { type: "triangle", notes: [784, 988, 1175], seconds: 0.3, delay: 0.05, gain: 0.5 },
    ] },
    // An eagle (two under or better): a soaring five-note run and a shimmer.
    golfEagle: { layers: [
      { type: "triangle", notes: [523, 659, 784, 1047, 1319], seconds: 0.5 },
      { type: "square", notes: [262, 330, 392, 523, 659], seconds: 0.5, gain: 0.25, filter: { type: "lowpass", from: 2200, to: 2200 } },
      { type: "noise", seconds: 0.35, delay: 0.4, gain: 0.12, filter: { type: "highpass", from: 7000, to: 9000 } },
    ] },
    // Par: a polite two-note nod.
    golfPar: { layers: [{ type: "triangle", notes: [659, 784], seconds: 0.22, gain: 0.7 }] },
    // A bogey: a little two-note slump.
    golfBogey: { layers: [
      { type: "triangle", notes: [392, 349], seconds: 0.34, gain: 0.8 },
      { type: "sawtooth", notes: [196, 175], seconds: 0.34, gain: 0.2, filter: { type: "lowpass", from: 700, to: 500 } },
    ] },
    // Double bogey or worse, or picked up: the sad trombone, wah wah wah waaah.
    golfWomp: { layers: [
      { type: "sawtooth", notes: [294, 277, 262, 247], seconds: 1, gain: 0.55, vibrato: { rate: 6, depth: 0.025 }, filter: { type: "lowpass", from: 1000, to: 600, q: 2 } },
      { type: "triangle", notes: [147, 139, 131, 123], seconds: 1, gain: 0.4 },
    ] },
    // All eighteen holed: the course's own fanfare, a run up and a held top
    // over a cymbal wash.
    golfCourseDone: { layers: [
      { type: "square", notes: [523, 659, 784, 659, 784, 1047, 1047], seconds: 1.05, gain: 0.35, filter: { type: "lowpass", from: 2600, to: 2600 } },
      { type: "triangle", notes: [262, 330, 392, 330, 392, 523, 523], seconds: 1.05, gain: 0.7 },
      { type: "noise", seconds: 0.45, delay: 0.7, gain: 0.15, filter: { type: "highpass", from: 6000, to: 8000 } },
    ] },
    // A new hole's tee: a soft whoosh into a two-note chime.
    golfTeeUp: { layers: [
      { type: "pink", seconds: 0.2, attack: 0.06, gain: 0.4, filter: { type: "bandpass", from: 600, to: 1800, q: 1.4 } },
      { type: "triangle", notes: [784, 1175], seconds: 0.2, delay: 0.1, gain: 0.5 },
    ] },
    // The needle into the MAX band: a tiny bright ping.
    golfNeedlePing: { layers: [{ type: "sine", from: 1760, to: 1760, seconds: 0.06, gain: 0.6 }] },
    // An overswing's wobble, under the old `shank`.
    golfWobble: { layers: [
      { type: "sawtooth", from: 300, to: 170, seconds: 0.32, gain: 0.5, vibrato: { rate: 16, depth: 0.08 }, filter: { type: "lowpass", from: 1400, to: 500 } },
    ] },
    // A dribbled putt: a limp little plop.
    golfPlop: { layers: [
      { type: "sine", from: 420, to: 160, seconds: 0.09 },
      { type: "pink", seconds: 0.07, gain: 0.3, filter: { type: "lowpass", from: 900, to: 300 } },
    ] },
    // What a bumper is made of. Wood: a hollow barrel knock.
    golfBarrel: { layers: [
      { type: "triangle", from: 230, to: 180, seconds: 0.13 },
      { type: "noise", seconds: 0.05, gain: 0.5, filter: { type: "bandpass", from: 950, to: 700, q: 3 } },
    ] },
    // Rubbery things (mushrooms, gumdrops, snowmen): a boing.
    golfBoing: { layers: [
      { type: "sine", from: 180, to: 540, seconds: 0.18, vibrato: { rate: 22, depth: 0.06 } },
      { type: "triangle", from: 360, to: 1080, seconds: 0.12, gain: 0.25 },
    ] },
    // Metal and crystal (coins, ornaments, stars): a ring that hangs.
    golfChime: { layers: [
      { type: "triangle", from: 1568, to: 1568, seconds: 0.45, gain: 0.6 },
      { type: "sine", from: 2349, to: 2349, seconds: 0.32, gain: 0.35 },
      { type: "sine", from: 3136, to: 3136, seconds: 0.2, gain: 0.2 },
    ] },
    // Stone (rocks, skulls, asteroids, the cave's walls): a hard clack.
    golfClack: { layers: [
      { type: "noise", seconds: 0.05, filter: { type: "bandpass", from: 1700, to: 1200, q: 4 } },
      { type: "square", from: 300, to: 180, seconds: 0.04, gain: 0.35, filter: { type: "lowpass", from: 1200, to: 600 } },
    ] },
    // A plain rail: a dull rubber thock with some body.
    golfRail: { layers: [
      { type: "triangle", from: 260, to: 170, seconds: 0.07 },
      { type: "brown", seconds: 0.06, gain: 0.5, filter: { type: "lowpass", from: 800, to: 300 } },
    ] },
    // A windmill's sail (or a tentacle, a candy cane) swatting the ball.
    golfWhack: { layers: [
      { type: "noise", seconds: 0.08, filter: { type: "bandpass", from: 1100, to: 650, q: 2 } },
      { type: "triangle", from: 190, to: 90, seconds: 0.11, gain: 0.7 },
    ] },
    // The shark's jaws: two snaps over a low bite.
    golfChomp: { layers: [
      { type: "noise", seconds: 0.03, filter: { type: "bandpass", from: 1900, to: 1500, q: 3 } },
      { type: "noise", seconds: 0.03, delay: 0.09, filter: { type: "bandpass", from: 1700, to: 1300, q: 3 } },
      { type: "sawtooth", from: 120, to: 60, seconds: 0.14, gain: 0.4, filter: { type: "lowpass", from: 600, to: 200 } },
    ] },
    // A dinosaur or a yeti bumped: a short throaty roar.
    golfRoar: { layers: [
      { type: "sawtooth", from: 150, to: 85, seconds: 0.5, attack: 0.04, gain: 0.6, vibrato: { rate: 14, depth: 0.06 }, filter: { type: "lowpass", from: 1000, to: 350, q: 2 } },
      { type: "brown", seconds: 0.45, attack: 0.04, gain: 0.5, filter: { type: "lowpass", from: 700, to: 250 } },
    ] },
    // The rubber duck (and a penguin): quack quack.
    golfQuack: { layers: [
      { type: "sawtooth", from: 640, to: 480, seconds: 0.11, gain: 0.6, filter: { type: "bandpass", from: 1300, to: 1100, q: 4 } },
      { type: "sawtooth", from: 600, to: 440, seconds: 0.13, delay: 0.15, gain: 0.6, filter: { type: "bandpass", from: 1250, to: 1000, q: 4 } },
    ] },
    // A crab's claws: click click.
    golfPinch: { layers: [
      { type: "noise", seconds: 0.02, filter: { type: "bandpass", from: 3600, to: 3200, q: 4 } },
      { type: "noise", seconds: 0.02, delay: 0.07, filter: { type: "bandpass", from: 3300, to: 3000, q: 4 } },
      { type: "square", from: 1400, to: 1200, seconds: 0.02, gain: 0.2 },
    ] },
    // The spyglass pulled out: a click and a brassy slide.
    golfSpyglass: { layers: [
      { type: "square", from: 600, to: 620, seconds: 0.03, gain: 0.4 },
      { type: "noise", seconds: 0.22, delay: 0.03, gain: 0.4, filter: { type: "bandpass", from: 1500, to: 3500, q: 3 } },
    ] },
    // A ball into sand at speed: a soft gritty puff.
    golfSandPuff: { layers: [{ type: "pink", seconds: 0.22, attack: 0.02, filter: { type: "lowpass", from: 1800, to: 400 } }] },
    // A ball onto ice: a thin skate hiss and a glassy ring.
    golfIceSkate: { layers: [
      { type: "noise", seconds: 0.3, gain: 0.5, filter: { type: "highpass", from: 5000, to: 3000 } },
      { type: "triangle", from: 2600, to: 2200, seconds: 0.25, gain: 0.15 },
    ] },
    // Gates slamming shut, by look. A stone crusher (or a long neck): a heavy slam.
    golfGateSlam: { layers: [
      { type: "brown", seconds: 0.3, filter: { type: "lowpass", from: 700, to: 120 } },
      { type: "sine", from: 95, to: 40, seconds: 0.25, gain: 0.8 },
      { type: "noise", seconds: 0.03, gain: 0.3, filter: { type: "bandpass", from: 2000, to: 1500, q: 2 } },
    ] },
    // An airlock: a hiss of air and a heavy clunk.
    golfAirlock: { layers: [
      { type: "noise", seconds: 0.35, gain: 0.5, filter: { type: "highpass", from: 2000, to: 4000 } },
      { type: "square", from: 150, to: 100, seconds: 0.07, gain: 0.5, filter: { type: "lowpass", from: 600, to: 300 } },
    ] },
    // An energy shield flicking on.
    golfShieldGate: { layers: [
      { type: "sine", from: 300, to: 900, seconds: 0.18, vibrato: { rate: 30, depth: 0.05 } },
      { type: "triangle", from: 600, to: 1800, seconds: 0.14, gain: 0.25 },
    ] },
    // Icicles dropping: a glassy tinkle down.
    golfIcicle: { layers: [
      { type: "triangle", notes: [2637, 2349, 2093], seconds: 0.2, gain: 0.6 },
      { type: "noise", seconds: 0.12, gain: 0.2, filter: { type: "highpass", from: 6000, to: 8000 } },
    ] },
    // A wall of fire roaring up.
    golfFlame: { layers: [
      { type: "pink", seconds: 0.42, attack: 0.08, filter: { type: "bandpass", from: 500, to: 1400, q: 1 } },
      { type: "brown", seconds: 0.4, attack: 0.05, gain: 0.6, filter: { type: "lowpass", from: 400, to: 200 } },
    ] },
    // Splashes, by what the ball fell into. Fizzy soda: a sparkling hiss.
    golfFizz: { layers: [{ type: "noise", seconds: 0.8, attack: 0.05, gain: 0.5, filter: { type: "highpass", from: 4000, to: 7000 } }] },
    // Thick stuff (tar, chocolate): a slow gloop and a bubble popping.
    golfGloop: { layers: [
      { type: "sine", from: 150, to: 70, seconds: 0.26 },
      { type: "pink", seconds: 0.3, gain: 0.6, filter: { type: "lowpass", from: 650, to: 150, q: 4 } },
      { type: "sine", from: 250, to: 620, seconds: 0.06, delay: 0.22, gain: 0.5 },
    ] },
    // Down a chasm, a crevasse or the void: a long falling whistle and a
    // faraway bump at the bottom.
    golfFallFar: { layers: [
      { type: "sine", from: 1300, to: 200, seconds: 0.72, gain: 0.6, vibrato: { rate: 9, depth: 0.02 } },
      { type: "sine", from: 110, to: 50, seconds: 0.16, delay: 0.78, gain: 0.5 },
      { type: "brown", seconds: 0.16, delay: 0.78, gain: 0.4, filter: { type: "lowpass", from: 500, to: 150 } },
    ] },
    // The courses' passing life, now and then. A gull over the cove.
    golfGull: { layers: [
      { type: "sine", from: 1300, to: 1750, seconds: 0.15, vibrato: { rate: 12, depth: 0.05 } },
      { type: "sine", from: 1500, to: 1100, seconds: 0.22, delay: 0.2, vibrato: { rate: 12, depth: 0.05 } },
    ] },
    // A drip into a cave pool: a quick rising plink.
    golfDrip: { layers: [
      { type: "sine", from: 900, to: 1800, seconds: 0.05 },
      { type: "sine", from: 1400, to: 2300, seconds: 0.04, delay: 0.25, gain: 0.25 },
    ] },
    // A jungle bird.
    golfJungleBird: { layers: [{ type: "triangle", notes: [1760, 2093, 1568, 2349], seconds: 0.32, gain: 0.7, vibrato: { rate: 18, depth: 0.03 } }] },
    // A dinosaur bellowing far away.
    golfDinoCall: { layers: [
      { type: "sawtooth", from: 95, to: 68, seconds: 0.95, attack: 0.25, gain: 0.6, vibrato: { rate: 5, depth: 0.04 }, filter: { type: "lowpass", from: 420, to: 220, q: 2 } },
      { type: "brown", seconds: 0.9, attack: 0.3, gain: 0.4, filter: { type: "lowpass", from: 300, to: 160 } },
    ] },
    // A music box in Candy Land.
    golfMusicBox: { layers: [
      { type: "triangle", notes: [1568, 1319, 1047, 1319], seconds: 0.56, gain: 0.6 },
      { type: "sine", notes: [3136, 2637, 2093, 2637], seconds: 0.56, gain: 0.15 },
    ] },
    // A radio blip from mission control.
    golfRadio: { layers: [
      { type: "sine", notes: [1760, 2637], seconds: 0.14, gain: 0.6 },
      { type: "noise", seconds: 0.18, gain: 0.15, filter: { type: "bandpass", from: 2500, to: 2000, q: 2 } },
    ] },
    // Ice cracking somewhere on the glacier.
    golfIceCrack: { layers: [
      { type: "noise", seconds: 0.08, filter: { type: "bandpass", from: 3000, to: 1200, q: 3 } },
      { type: "brown", seconds: 0.25, delay: 0.03, gain: 0.5, filter: { type: "lowpass", from: 600, to: 200 } },
    ] },
  },
  hums: {
    // The ball rolling on the green: a soft low rumble with a little spin,
    // pitch and loudness with its speed.
    golfRoll: { parts: [{ type: "sine", freq: 70, gain: 0.25 }], noise: { color: "brown", gain: 1 }, filter: { type: "lowpass", freq: 500, q: 1, follow: 1 }, pulse: { rate: 9, depth: 0.25 }, peak: 0.045 },
    // Rolling through sand: a gritty hiss.
    golfSandRoll: { noise: { color: "pink", gain: 1 }, filter: { type: "bandpass", freq: 900, q: 1.5, follow: 0.6 }, pulse: { rate: 14, depth: 0.5 }, peak: 0.035 },
    // Gliding on ice: a thin high hiss with a glassy edge.
    golfIceGlide: { parts: [{ type: "triangle", freq: 1800, gain: 0.06 }], noise: { color: "noise", gain: 1 }, filter: { type: "highpass", freq: 3000, q: 0.7, follow: 0.5 }, peak: 0.02 },
    // Each course's air, under everything. Pirate Cove: waves washing in.
    golfAmbPirate: { noise: { color: "brown", gain: 1 }, filter: { type: "lowpass", freq: 520, q: 0.5, follow: 1 }, pulse: { rate: 0.12, depth: 0.7 }, peak: 0.035 },
    // The caves: a hollow, breathing wind over a low note.
    golfAmbCave: { parts: [{ type: "sine", freq: 49, gain: 0.3 }], noise: { color: "pink", gain: 1 }, filter: { type: "bandpass", freq: 260, q: 3, follow: 1 }, pulse: { rate: 0.07, depth: 0.5 }, peak: 0.03 },
    // The jungle: insects trilling high up.
    golfAmbDino: { noise: { color: "noise", gain: 1 }, filter: { type: "bandpass", freq: 4200, q: 6, follow: 1 }, pulse: { rate: 13, depth: 0.8 }, peak: 0.015 },
    // Candy Land: a soft, sweet chord breathing in and out.
    golfAmbCandy: { parts: [{ type: "sine", freq: 262 }, { type: "sine", freq: 330, gain: 0.6 }, { type: "sine", freq: 392, gain: 0.5 }, { type: "sine", freq: 524.5, gain: 0.2 }], filter: { type: "lowpass", freq: 900, q: 0.7, follow: 1 }, pulse: { rate: 0.5, depth: 0.4 }, peak: 0.015 },
    // Space: a slow, beating station drone.
    golfAmbSpace: { parts: [{ type: "sawtooth", freq: 55 }, { type: "sawtooth", freq: 55.4 }, { type: "sine", freq: 82.5, gain: 0.5 }], filter: { type: "lowpass", freq: 300, q: 2, follow: 1 }, pulse: { rate: 0.1, depth: 0.5 }, peak: 0.025 },
    // The glacier: wind over the snow.
    golfAmbFrost: { noise: { color: "pink", gain: 1 }, filter: { type: "bandpass", freq: 900, q: 1.4, follow: 1 }, pulse: { rate: 0.18, depth: 0.6 }, peak: 0.03 },
    // A hole over lava (or plasma): a deep bubbling.
    golfAmbLava: { parts: [{ type: "square", freq: 40, gain: 0.2 }], noise: { color: "brown", gain: 1 }, filter: { type: "lowpass", freq: 300, q: 1, follow: 1 }, pulse: { rate: 3, depth: 0.6 }, peak: 0.035 },
    // A windmill (or any spinner) turning: a whir with each sail's swish,
    // pitched with its speed, louder as the ball comes near.
    golfSpin: { parts: [{ type: "triangle", freq: 70, gain: 0.5 }], noise: { color: "pink", gain: 0.6 }, filter: { type: "bandpass", freq: 400, q: 2, follow: 1 }, pulse: { rate: 4, depth: 0.7 }, peak: 0.03 },
    // A whirlpool, a black hole or a tractor beam: a swirling rush.
    golfVortex: { parts: [{ type: "sine", freq: 110, gain: 0.3 }], noise: { color: "pink", gain: 1 }, filter: { type: "bandpass", freq: 500, q: 4, follow: 1 }, pulse: { rate: 1.5, depth: 0.5 }, peak: 0.03 },
    // A flying saucer's warble.
    golfUfo: { parts: [{ type: "sine", freq: 700 }, { type: "sine", freq: 707, gain: 0.8 }], filter: { type: "lowpass", freq: 2000, q: 0.7, follow: 1 }, pulse: { rate: 7, depth: 0.6 }, peak: 0.02 },
    // A fireball or a meteor rushing past: a low roar.
    golfFireball: { noise: { color: "brown", gain: 1 }, filter: { type: "lowpass", freq: 700, q: 1, follow: 1 }, pulse: { rate: 10, depth: 0.4 }, peak: 0.035 },
    // The magnet working on a putt: a low electric hum.
    golfMagnet: { parts: [{ type: "sine", freq: 120 }, { type: "sine", freq: 240, gain: 0.4 }, { type: "square", freq: 60, gain: 0.2 }], filter: { type: "lowpass", freq: 500, q: 1, follow: 1 }, pulse: { rate: 8, depth: 0.3 }, peak: 0.025 },
  },
};
