// Plan2Code Web Console - ghoul: the Dark Ride's sound effects and its drone and music box track, merged into ghoul-sfx.js; defines only.
//
// Ported from prototypes/ghoul-rush-ride/gallery.html's WebAudio: each `ghoulRide<Kind>`
// tone is that prototype sound as layers. Gains are the prototype's volumes over 0.3
// (capped at 1), so the loudest sit at the top of the game's range. Callers scale with
// level and pitch (see Scream, Breath and DiceLand). A name may be defined only once
// across tones.js and every game's file. No imports.

export const RIDE_SFX = Object.freeze({
  tones: {
    // The blaster: a high click, a falling square zap, a low thump.
    ghoulRideShoot: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0.005, gain: 0.6, filter: { type: "highpass", from: 2400, to: 2400, q: 1 } },
        { type: "square", from: 1100, to: 180, seconds: 0.09, attack: 0.008, gain: 0.23 },
        { type: "sine", from: 90, to: 50, seconds: 0.08, attack: 0.008, gain: 0.4 },
      ],
    },
    // A wet splat (the prototype's splat at size 1).
    ghoulRideSplat: {
      layers: [
        { type: "noise", seconds: 0.2, attack: 0.005, gain: 1, filter: { type: "lowpass", from: 900, to: 150, q: 1 } },
        { type: "sine", from: 130, to: 45, seconds: 0.14, attack: 0.008, gain: 0.73 },
        { type: "noise", seconds: 0.09, delay: 0.03, attack: 0.005, gain: 0.47, filter: { type: "bandpass", from: 2200, to: 2200, q: 3 } },
      ],
    },
    // A big kill: a size-2 splat, a long falling rumble and a deep thud.
    ghoulRideGib: {
      layers: [
        { type: "noise", seconds: 0.4, attack: 0.005, gain: 1, filter: { type: "lowpass", from: 900, to: 150, q: 1 } },
        { type: "sine", from: 130, to: 45, seconds: 0.14, attack: 0.008, gain: 0.73 },
        { type: "noise", seconds: 0.09, delay: 0.03, attack: 0.005, gain: 0.47, filter: { type: "bandpass", from: 2200, to: 2200, q: 3 } },
        { type: "noise", seconds: 0.5, delay: 0.05, attack: 0.005, gain: 0.83, filter: { type: "lowpass", from: 500, to: 80, q: 1 } },
        { type: "sine", from: 70, to: 30, seconds: 0.3, attack: 0.008, gain: 1 },
      ],
    },
    // A scream, defined for f 650 Hz, d 0.8 s, v 0.13. Callers pass pitch = f / 650 and level = v / 0.13 (level tops out at 1, so a v above 0.13 plays as 0.13). Built for pitch 0.28 to 1.6: every frequency and filter cutoff scales with it, only the length stays.
    ghoulRideScream: {
      layers: [
        { type: "sawtooth", from: 650, to: 975, seconds: 0.8, attack: 0.04, gain: 0.43, vibrato: { rate: 9, depth: 0.04 }, filter: { type: "lowpass", from: 3200, to: 3200 } },
        { type: "sawtooth", from: 981.5, to: 1430, seconds: 0.8, attack: 0.06, gain: 0.26, vibrato: { rate: 11, depth: 0.04 }, filter: { type: "lowpass", from: 3000, to: 3000 } },
        { type: "noise", seconds: 0.8, attack: 0.005, gain: 0.22, filter: { type: "bandpass", from: 1300, to: 1950, q: 2 } },
      ],
    },
    // The orchestra stab: a dissonant square chord and a hiss.
    ghoulRideStab: {
      layers: [
        { type: "square", from: 440, to: 426.8, seconds: 0.5, attack: 0.008, gain: 0.17, filter: { type: "lowpass", from: 2500, to: 2500 } },
        { type: "square", from: 466, to: 452.02, seconds: 0.5, attack: 0.008, gain: 0.17, filter: { type: "lowpass", from: 2500, to: 2500 } },
        { type: "square", from: 622, to: 603.34, seconds: 0.5, attack: 0.008, gain: 0.17, filter: { type: "lowpass", from: 2500, to: 2500 } },
        { type: "square", from: 659, to: 639.23, seconds: 0.5, attack: 0.008, gain: 0.17, filter: { type: "lowpass", from: 2500, to: 2500 } },
        { type: "noise", seconds: 0.25, attack: 0.005, gain: 0.6, filter: { type: "highpass", from: 1500, to: 1500, q: 1 } },
      ],
    },
    // A big boom: a falling noise burst over a deep sine drop.
    ghoulRideBang: {
      layers: [
        { type: "noise", seconds: 0.5, attack: 0.005, gain: 1, filter: { type: "lowpass", from: 500, to: 60, q: 1 } },
        { type: "sine", from: 55, to: 30, seconds: 0.5, attack: 0.008, gain: 1 },
      ],
    },
    // Metal on metal: two triangles and a bright tick.
    ghoulRideClank: {
      layers: [
        { type: "triangle", from: 1210, to: 1210, seconds: 0.3, attack: 0.008, gain: 0.33 },
        { type: "triangle", from: 1810, to: 1810, seconds: 0.25, attack: 0.008, gain: 0.23 },
        { type: "noise", seconds: 0.05, attack: 0.005, gain: 0.33, filter: { type: "highpass", from: 4000, to: 4000, q: 1 } },
      ],
    },
    // A bright bell with a fifth above.
    ghoulRideDing: {
      layers: [
        { type: "sine", from: 1320, to: 1320, seconds: 0.35, attack: 0.008, gain: 0.33 },
        { type: "sine", from: 1980, to: 1980, seconds: 0.3, delay: 0.05, attack: 0.008, gain: 0.17 },
      ],
    },
    // A monster popping up: a falling noise puff and a dull saw.
    ghoulRidePop: {
      layers: [
        { type: "noise", seconds: 0.22, attack: 0.005, gain: 0.67, filter: { type: "lowpass", from: 700, to: 200, q: 1 } },
        { type: "sawtooth", from: 240, to: 90, seconds: 0.2, attack: 0.008, gain: 0.23, filter: { type: "lowpass", from: 700, to: 700 } },
      ],
    },
    // A low rumbling growl with a swell in.
    ghoulRideGrowl: {
      layers: [
        { type: "sawtooth", from: 75, to: 45, seconds: 0.9, attack: 0.1, gain: 0.47, vibrato: { rate: 14, depth: 0.04 }, filter: { type: "lowpass", from: 380, to: 380 } },
        { type: "noise", seconds: 0.7, attack: 0.005, gain: 0.4, filter: { type: "lowpass", from: 400, to: 120, q: 1 } },
      ],
    },
    // Taking a hit: a scream at 420 Hz for 0.55 s at 0.17, a deep thump and a noise burst.
    ghoulRideHurt: {
      layers: [
        { type: "sawtooth", from: 420, to: 630, seconds: 0.55, attack: 0.04, gain: 0.57, vibrato: { rate: 9, depth: 0.04 }, filter: { type: "lowpass", from: 3200, to: 3200 } },
        { type: "sawtooth", from: 634.2, to: 924, seconds: 0.55, attack: 0.06, gain: 0.34, vibrato: { rate: 11, depth: 0.04 }, filter: { type: "lowpass", from: 3000, to: 3000 } },
        { type: "noise", seconds: 0.55, attack: 0.005, gain: 0.28, filter: { type: "bandpass", from: 840, to: 1260, q: 2 } },
        { type: "sine", from: 70, to: 30, seconds: 0.4, attack: 0.008, gain: 1 },
        { type: "noise", seconds: 0.3, attack: 0.005, gain: 1, filter: { type: "lowpass", from: 700, to: 100, q: 1 } },
      ],
    },
    // A swing: a swelling band of air rising in pitch.
    ghoulRideWhoosh: {
      layers: [
        { type: "noise", seconds: 0.45, attack: 0.2, gain: 0.73, filter: { type: "bandpass", from: 300, to: 1800, q: 1.5 } },
      ],
    },
    // A blade coming down: a sharp hiss and a thud.
    ghoulRideChop: {
      layers: [
        { type: "noise", seconds: 0.1, attack: 0.005, gain: 1, filter: { type: "highpass", from: 1200, to: 1200, q: 1 } },
        { type: "sine", from: 110, to: 55, seconds: 0.12, attack: 0.008, gain: 1 },
      ],
    },
    // Five crackles in a row (the prototype's random gaps fixed at their middle).
    ghoulRideSparks: {
      layers: [
        { type: "noise", seconds: 0.03, delay: 0.015, attack: 0.005, gain: 0.33, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
        { type: "noise", seconds: 0.03, delay: 0.055, attack: 0.005, gain: 0.33, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
        { type: "noise", seconds: 0.03, delay: 0.095, attack: 0.005, gain: 0.33, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
        { type: "noise", seconds: 0.03, delay: 0.135, attack: 0.005, gain: 0.33, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
        { type: "noise", seconds: 0.03, delay: 0.175, attack: 0.005, gain: 0.33, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
      ],
    },
    // A bite: a sharp noise snap and a short square drop.
    ghoulRideSnap: {
      layers: [
        { type: "noise", seconds: 0.08, attack: 0.005, gain: 1, filter: { type: "highpass", from: 1800, to: 1800, q: 1 } },
        { type: "square", from: 160, to: 60, seconds: 0.12, attack: 0.008, gain: 0.5 },
      ],
    },
    // Slow breathing: an inhale then an exhale. Defined at volume 1; callers scale level. The prototype's 2.1 s is pulled in to 1.2 s (the tones limit): a 0.6 s inhale and a 0.64 s exhale.
    ghoulRideBreath: {
      layers: [
        { type: "noise", seconds: 0.6, attack: 0.27, gain: 0.67, filter: { type: "bandpass", from: 380, to: 900, q: 0.8 } },
        { type: "noise", seconds: 0.64, delay: 0.55, attack: 0.07, gain: 0.53, filter: { type: "bandpass", from: 700, to: 250, q: 0.8 } },
      ],
    },
    // A heartbeat: two low thumps.
    ghoulRideHeart: {
      layers: [
        { type: "sine", from: 58, to: 38, seconds: 0.18, attack: 0.008, gain: 1 },
        { type: "sine", from: 54, to: 36, seconds: 0.2, delay: 0.17, attack: 0.008, gain: 1 },
      ],
    },
    // A soft low thump.
    ghoulRideThump: {
      layers: [
        { type: "sine", from: 80, to: 40, seconds: 0.2, attack: 0.008, gain: 1 },
        { type: "noise", seconds: 0.1, attack: 0.005, gain: 0.4, filter: { type: "lowpass", from: 300, to: 300, q: 1 } },
      ],
    },
    // The car braking hard: a falling screech over a dying saw.
    ghoulRideStop: {
      layers: [
        { type: "noise", seconds: 0.9, attack: 0.005, gain: 1, filter: { type: "bandpass", from: 2400, to: 300, q: 2 } },
        { type: "sawtooth", from: 140, to: 30, seconds: 0.8, attack: 0.008, gain: 0.33, filter: { type: "lowpass", from: 600, to: 600 } },
      ],
    },
    // The lights dying: a click and a falling sine.
    ghoulRideLightsOff: {
      layers: [
        { type: "noise", seconds: 0.12, attack: 0.005, gain: 1, filter: { type: "highpass", from: 2000, to: 2000, q: 1 } },
        { type: "sine", from: 160, to: 40, seconds: 0.5, attack: 0.008, gain: 1 },
      ],
    },
    // The lights coming back: a click and a rising sine.
    ghoulRideLightsOn: {
      layers: [
        { type: "noise", seconds: 0.12, attack: 0.005, gain: 1, filter: { type: "highpass", from: 2000, to: 2000, q: 1 } },
        { type: "sine", from: 60, to: 160, seconds: 0.5, attack: 0.008, gain: 1 },
      ],
    },
    // A board creaking (the prototype's random pitch fixed at the middle of its range).
    ghoulRideCreak: {
      layers: [
        { type: "sawtooth", from: 255, to: 125, seconds: 0.6, attack: 0.15, gain: 0.17, vibrato: { rate: 24, depth: 0.04 }, filter: { type: "lowpass", from: 700, to: 700 } },
      ],
    },
    // A tiny tick of a shot landing.
    ghoulRideHit: {
      layers: [
        { type: "square", from: 880, to: 400, seconds: 0.05, attack: 0.008, gain: 0.17 },
      ],
    },
    // The boss's roar: a scream at 180 Hz at 0.2 (1.3 s pulled in to the 1.2 s limit), a saw growl and a noise rumble.
    ghoulRideRoar: {
      layers: [
        { type: "sawtooth", from: 180, to: 270, seconds: 1.2, attack: 0.04, gain: 0.67, vibrato: { rate: 9, depth: 0.04 }, filter: { type: "lowpass", from: 3200, to: 3200 } },
        { type: "sawtooth", from: 271.8, to: 396, seconds: 1.2, attack: 0.06, gain: 0.4, vibrato: { rate: 11, depth: 0.04 }, filter: { type: "lowpass", from: 3000, to: 3000 } },
        { type: "noise", seconds: 1.2, attack: 0.005, gain: 0.33, filter: { type: "bandpass", from: 360, to: 540, q: 2 } },
        { type: "sawtooth", from: 48, to: 30, seconds: 1.2, attack: 0.008, gain: 0.73, vibrato: { rate: 20, depth: 0.04 }, filter: { type: "lowpass", from: 300, to: 300 } },
        { type: "noise", seconds: 1.2, attack: 0.005, gain: 1, filter: { type: "lowpass", from: 600, to: 100, q: 1 } },
      ],
    },
    // The camera flash: a hiss and a falling whine.
    ghoulRideFlash: {
      layers: [
        { type: "noise", seconds: 0.2, attack: 0.005, gain: 0.83, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
        { type: "sine", from: 2200, to: 600, seconds: 0.25, attack: 0.008, gain: 0.27 },
      ],
    },
    // The fanfare: four rising triangle notes and a held top note (the last note cut to 0.5 s for the 1.2 s limit).
    ghoulRideFan: {
      layers: [
        { type: "triangle", from: 523, to: 523, seconds: 0.5, attack: 0.008, gain: 0.33 },
        { type: "triangle", from: 659, to: 659, seconds: 0.5, delay: 0.16, attack: 0.008, gain: 0.33 },
        { type: "triangle", from: 784, to: 784, seconds: 0.5, delay: 0.32, attack: 0.008, gain: 0.33 },
        { type: "triangle", from: 1047, to: 1047, seconds: 0.5, delay: 0.48, attack: 0.008, gain: 0.33 },
        { type: "triangle", from: 1109, to: 1109, seconds: 0.5, delay: 0.7, attack: 0.008, gain: 0.2 },
      ],
    },
    // A low falling triangle.
    ghoulRideLow: {
      layers: [
        { type: "triangle", from: 110, to: 55, seconds: 0.6, attack: 0.008, gain: 0.5 },
      ],
    },
    // Glass breaking: a bright hiss and three falling shards.
    ghoulRideGlass: {
      layers: [
        { type: "noise", seconds: 0.25, attack: 0.005, gain: 1, filter: { type: "highpass", from: 3500, to: 3500, q: 1 } },
        { type: "triangle", from: 2400, to: 1680, seconds: 0.25, attack: 0.008, gain: 0.17 },
        { type: "triangle", from: 3100, to: 2170, seconds: 0.25, delay: 0.03, attack: 0.008, gain: 0.17 },
        { type: "triangle", from: 3900, to: 2730, seconds: 0.25, delay: 0.06, attack: 0.008, gain: 0.17 },
      ],
    },
    // Water: a falling band of noise and a sine drop.
    ghoulRideSplash: {
      layers: [
        { type: "noise", seconds: 0.5, attack: 0.005, gain: 0.83, filter: { type: "bandpass", from: 900, to: 300, q: 0.8 } },
        { type: "sine", from: 200, to: 70, seconds: 0.25, attack: 0.008, gain: 0.5 },
      ],
    },
    // A comic slip: a quick drop and a wobbling fall.
    ghoulRideOops: {
      layers: [
        { type: "sine", from: 1400, to: 900, seconds: 0.18, attack: 0.008, gain: 0.5 },
        { type: "triangle", from: 700, to: 300, seconds: 0.4, delay: 0.12, attack: 0.008, gain: 0.47, vibrato: { rate: 20, depth: 0.04 } },
      ],
    },
    // A web stuck to the car: a falling rasp and a wobbling triangle.
    ghoulRideWeb: {
      layers: [
        { type: "noise", seconds: 0.35, attack: 0.005, gain: 0.67, filter: { type: "bandpass", from: 1200, to: 200, q: 3 } },
        { type: "triangle", from: 300, to: 120, seconds: 0.4, attack: 0.008, gain: 0.2, vibrato: { rate: 30, depth: 0.04 } },
      ],
    },
    // A small tick.
    ghoulRideTick: {
      layers: [
        { type: "noise", seconds: 0.03, attack: 0.005, gain: 0.4, filter: { type: "bandpass", from: 1500, to: 1500, q: 3 } },
        { type: "square", from: 160, to: 90, seconds: 0.05, attack: 0.008, gain: 0.17 },
      ],
    },
    // A die landing: a thump, a click and two bell tones. Callers add a pitch per die; every part scales with it (0.8 to 2 is fine).
    ghoulRideDiceLand: {
      layers: [
        { type: "sine", from: 120, to: 60, seconds: 0.14, attack: 0.008, gain: 1 },
        { type: "noise", seconds: 0.06, attack: 0.005, gain: 0.5, filter: { type: "bandpass", from: 1800, to: 1800, q: 2 } },
        { type: "triangle", from: 1320, to: 1320, seconds: 0.4, delay: 0.05, attack: 0.008, gain: 0.33 },
        { type: "triangle", from: 1760, to: 1760, seconds: 0.5, delay: 0.12, attack: 0.008, gain: 0.23 },
      ],
    },
    // Healing: three rising triangle notes.
    ghoulRideHeal: {
      layers: [
        { type: "triangle", from: 660, to: 660, seconds: 0.3, attack: 0.008, gain: 0.27 },
        { type: "triangle", from: 880, to: 880, seconds: 0.3, delay: 0.08, attack: 0.008, gain: 0.27 },
        { type: "triangle", from: 1320, to: 1320, seconds: 0.3, delay: 0.16, attack: 0.008, gain: 0.27 },
      ],
    },
    // A rail joint clack: a bandpassed noise tick and a short sine thump.
    ghoulRideJoint: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0.005, gain: 0.23, filter: { type: "bandpass", from: 900, to: 900, q: 2 } },
        { type: "sine", from: 70, to: 45, seconds: 0.07, attack: 0.008, gain: 0.33 },
      ],
    },
    // The dark ride's creatures and cues picked by ear (prototypes/sounds/ghoul-rush/carnival-ride.html).
    // The car: Planny's ghost-train car on its rail: the joints in the track, the lift-hill chain, the drop, the stall, the brake and the jump over the top.
    // Rail clack: Dull wheel knock.
    ghoulRideCarClack: {
      layers: [
        { type: "sine", from: 150, to: 70, seconds: 0.09, attack: 0.003, gain: 0.72 },
        { type: "noise", seconds: 0.03, attack: 0.003, gain: 0.72, filter: { type: "bandpass", from: 2200, to: 1400, q: 3 } },
      ],
    },
    // Lift-hill chain click: Ratchet pawl.
    ghoulRideCarChain: {
      layers: [
        { type: "noise", seconds: 0.02, attack: 0.003, gain: 0.9, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
        { type: "square", from: 160, to: 90, seconds: 0.05, attack: 0.003, gain: 0.5, delay: 0.01 },
      ],
    },
    // The drop whoosh: Gut-drop swoop.
    ghoulRideCarDrop: {
      layers: [
        { type: "sine", from: 400, to: 40, seconds: 1, attack: 0.1, gain: 0.8 },
        { type: "noise", seconds: 0.9, attack: 0.32, gain: 0.48, filter: { type: "bandpass", from: 300, to: 1800, q: 1.5 } },
      ],
    },
    // Stall: Brakes shriek, wind down.
    ghoulRideCarStall: {
      layers: [
        { type: "noise", seconds: 0.9, attack: 0.1, gain: 0.8, filter: { type: "bandpass", from: 2400, to: 300, q: 2 } },
        { type: "sawtooth", from: 140, to: 30, seconds: 0.9, attack: 0.003, gain: 0.5, filter: { type: "lowpass", from: 600, to: 600, q: 1 } },
      ],
    },
    // Brake: Low gulp.
    ghoulRideCarBrake: {
      layers: [
        { type: "sine", from: 112, to: 84, seconds: 0.6, attack: 0.05, gain: 0.63, vibrato: { rate: 15, depth: 0.4 } },
        { type: "brown", seconds: 0.6, attack: 0.05, gain: 0.49, filter: { type: "lowpass", from: 700, to: 300, q: 1 } },
        { type: "sine", from: 168, to: 134, seconds: 0.42, delay: 0.09, attack: 0.03, gain: 0.28, vibrato: { rate: 9, depth: 0.5 } },
        { type: "sine", from: 77, to: 28, seconds: 0.25, attack: 0, gain: 0.6, delay: 0.3 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.48, filter: { type: "lowpass", from: 224, to: 224, q: 1 }, delay: 0.3 },
      ],
    },
    // Car jumps the top: Springs boing.
    ghoulRideCarJump: {
      layers: [
        { type: "triangle", from: 200, to: 700, seconds: 0.35, attack: 0.01, gain: 0.49, vibrato: { rate: 20, depth: 0.08 } },
        { type: "noise", seconds: 0.05, attack: 0.003, gain: 0.4, filter: { type: "bandpass", from: 2000, to: 2000, q: 2 } },
      ],
    },
    // Planny's blaster: The light-gun in his hands: the shot, the hit that lands, the miss and the aim assist that bends a near miss onto a target.
    // Fire: Arcade zap.
    ghoulRideBlasterFire: {
      layers: [
        { type: "square", from: 1100, to: 180, seconds: 0.09, attack: 0.003, gain: 0.5, filter: { type: "lowpass", from: 4000, to: 900, q: 1 } },
        { type: "noise", seconds: 0.03, attack: 0.003, gain: 0.5, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
        { type: "sine", from: 90, to: 50, seconds: 0.08, attack: 0.003, gain: 0.4 },
      ],
    },
    // Hit lands: Coin ding.
    ghoulRideBlasterHit: {
      layers: [
        { type: "sine", from: 1760, to: 1760, seconds: 0.2, attack: 0.006, gain: 0.56 },
        { type: "sine", from: 2640, to: 2640, seconds: 0.16, attack: 0.006, gain: 0.28 },
        { type: "sine", from: 3520, to: 3520, seconds: 0.1, attack: 0.006, gain: 0.16 },
      ],
    },
    // Miss: Soft puff.
    ghoulRideBlasterMiss: {
      layers: [
        { type: "noise", seconds: 0.12, attack: 0.01, gain: 0.32, filter: { type: "highpass", from: 2400, to: 5000, q: 1 } },
        { type: "pink", seconds: 0.12, attack: 0.05, gain: 0.2, filter: { type: "bandpass", from: 3200, to: 2200, q: 2 } },
      ],
    },
    // Aim-assist ping: Lock-on trill.
    ghoulRideBlasterAssist: {
      layers: [
        { type: "sine", from: 1200, to: 1200, seconds: 0.08, attack: 0.008, gain: 0.42 },
        { type: "sine", from: 1500, to: 1500, seconds: 0.08, attack: 0.008, gain: 0.42, delay: 0.04 },
        { type: "sine", from: 1800, to: 1800, seconds: 0.08, attack: 0.008, gain: 0.42, delay: 0.08 },
      ],
    },
    // Hurt and close calls: What the player feels: a heart lost, a duck, a close call, the flicker while invulnerable and the moment the last heart goes.
    // A heart lost: Scream and thump.
    ghoulRideHurtHeart: {
      layers: [
        { type: "sawtooth", from: 520, to: 312, seconds: 0.5, attack: 0.03, gain: 0.48, vibrato: { rate: 12, depth: 0.04 }, filter: { type: "bandpass", from: 1040, to: 1248, q: 4 } },
        { type: "sawtooth", from: 780, to: 468, seconds: 0.45, attack: 0.04, gain: 0.21, filter: { type: "bandpass", from: 1560, to: 1560, q: 5 } },
        { type: "noise", seconds: 0.4, attack: 0.03, gain: 0.18, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
        { type: "sine", from: 77, to: 28, seconds: 0.25, attack: 0, gain: 0.9 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.72, filter: { type: "lowpass", from: 224, to: 224, q: 1 } },
      ],
    },
    // Duck: Seat squeak.
    ghoulRideHurtDuck: {
      layers: [
        { type: "sine", from: 700, to: 910, seconds: 0.08, attack: 0.01, gain: 0.4, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 840, to: 1085, seconds: 0.07, delay: 0.1, attack: 0.01, gain: 0.3, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 176, to: 64, seconds: 0.25, attack: 0, gain: 0.4, delay: 0.1 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.32, filter: { type: "lowpass", from: 512, to: 512, q: 1 }, delay: 0.1 },
      ],
    },
    // Close call: Cymbal splash.
    ghoulRideHurtClose: {
      layers: [
        { type: "noise", seconds: 0.5, attack: 0.003, gain: 0.5, filter: { type: "highpass", from: 6000, to: 6000, q: 1 } },
        { type: "triangle", from: 5200, to: 4800, seconds: 0.4, attack: 0.003, gain: 0.2 },
      ],
    },
    // Invulnerable flicker: Heartbeat pulse.
    ghoulRideHurtFlicker: {
      layers: [
        { type: "sine", from: 58, to: 38, seconds: 0.18, attack: 0.003, gain: 0.72 },
        { type: "sine", from: 54, to: 36, seconds: 0.2, attack: 0.003, gain: 0.56, delay: 0.17 },
      ],
    },
    // Bonus lost: Death roar.
    ghoulRideHurtLost: {
      layers: [
        { type: "sawtooth", from: 126, to: 161, seconds: 0.39, attack: 0.05, gain: 0.81, vibrato: { rate: 8, depth: 0.1 }, filter: { type: "lowpass", from: 300, to: 4400, q: 4 } },
        { type: "sawtooth", from: 161, to: 98, seconds: 0.77, delay: 0.33, attack: 0.02, gain: 0.81, vibrato: { rate: 8, depth: 0.12 }, filter: { type: "lowpass", from: 4400, to: 260, q: 4 } },
        { type: "sawtooth", from: 70, to: 50, seconds: 1.1, attack: 0.08, gain: 0.54, filter: { type: "lowpass", from: 500, to: 500, q: 1 } },
        { type: "brown", seconds: 1.1, attack: 0.06, gain: 0.72, filter: { type: "lowpass", from: 900, to: 180, q: 1 } },
        { type: "sine", from: 70, to: 49, seconds: 1.1, attack: 0.05, gain: 0.63 },
      ],
    },
    // Wax figures: The museum's statues: they melt off their pedestals, then rise and lurch at the car.
    // Melt: Slow drip and sizzle.
    ghoulRideWaxMelt: {
      layers: [
        { type: "pink", seconds: 0.9, attack: 0.2, gain: 0.4, filter: { type: "highpass", from: 3500, to: 3500, q: 1 } },
        { type: "sine", from: 630, to: 1350, seconds: 0.07, attack: 0.004, gain: 0.42, delay: 0.2 },
        { type: "sine", from: 1350, to: 1170, seconds: 0.1, attack: 0.003, gain: 0.15, delay: 0.27 },
        { type: "sine", from: 490, to: 1050, seconds: 0.07, attack: 0.004, gain: 0.35, delay: 0.55 },
        { type: "sine", from: 1050, to: 910, seconds: 0.1, attack: 0.003, gain: 0.13, delay: 0.62 },
        { type: "brown", seconds: 0.3, attack: 0.01, gain: 0.4, filter: { type: "lowpass", from: 1040, to: 120, q: 1 }, delay: 0.1 },
        { type: "sine", from: 208, to: 48, seconds: 0.22, attack: 0.01, gain: 0.28, delay: 0.1 },
        { type: "noise", seconds: 0.12, attack: 0.01, gain: 0.16, filter: { type: "bandpass", from: 720, to: 240, q: 3 }, delay: 0.1 },
      ],
    },
    // Rise: Cracking joints.
    ghoulRideWaxRise: {
      layers: [
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.8, filter: { type: "bandpass", from: 1440, to: 960, q: 2 } },
        { type: "square", from: 720, to: 240, seconds: 0.05, attack: 0, gain: 0.32 },
        { type: "noise", seconds: 0.04, delay: 0.06, attack: 0, gain: 0.56, filter: { type: "bandpass", from: 2080, to: 1440, q: 3 } },
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2965, to: 2372, q: 6 } },
        { type: "square", from: 648, to: 420, seconds: 0.02, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.05, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2253, to: 1803, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.1, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1927, to: 1542, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.15, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2442, to: 1953, q: 6 } },
        { type: "sawtooth", from: 176, to: 275, seconds: 0.6, attack: 0.12, gain: 0.36, vibrato: { rate: 5, depth: 0.07 }, filter: { type: "lowpass", from: 1400, to: 700, q: 5 } },
        { type: "sawtooth", from: 177, to: 273, seconds: 0.6, attack: 0.14, gain: 0.2, filter: { type: "lowpass", from: 1120, to: 560, q: 3 } },
        { type: "brown", seconds: 0.6, attack: 0.1, gain: 0.24, filter: { type: "bandpass", from: 880, to: 660, q: 2 } },
      ],
    },
    // The Executioner: The Chamber of Torture's mini-boss: a hooded man with a great axe who swings three times at the car.
    // Axe wind-up: Blade whetting.
    ghoulRideExecWind: {
      layers: [
        { type: "noise", seconds: 0.8, attack: 0.1, gain: 0.6, filter: { type: "bandpass", from: 3500, to: 5000, q: 5 } },
        { type: "sine", from: 2000, to: 2400, seconds: 0.8, attack: 0.4, gain: 0.15 },
      ],
    },
    // Axe swing: Chop thunk.
    ghoulRideExecSwing: {
      layers: [
        { type: "noise", seconds: 0.1, attack: 0.003, gain: 0.8, filter: { type: "highpass", from: 1200, to: 1200, q: 1 } },
        { type: "sine", from: 110, to: 55, seconds: 0.12, attack: 0.003, gain: 0.8 },
      ],
    },
    // Shot lands on him: Hood tears, snarl.
    ghoulRideExecHit: {
      layers: [
        { type: "pink", seconds: 0.15, attack: 0.003, gain: 0.5, filter: { type: "highpass", from: 1500, to: 1500, q: 1 } },
        { type: "sawtooth", from: 144, to: 108, seconds: 0.3, attack: 0.03, gain: 0.63, vibrato: { rate: 9, depth: 0.2 }, filter: { type: "bandpass", from: 810, to: 450, q: 3 } },
        { type: "noise", seconds: 0.27, attack: 0.02, gain: 0.35, filter: { type: "bandpass", from: 1600, to: 700, q: 1.5 } },
        { type: "square", from: 72, to: 63, seconds: 0.3, attack: 0.03, gain: 0.24, filter: { type: "lowpass", from: 500, to: 500, q: 1 } },
      ],
    },
    // Dies: Headsman's last roar.
    ghoulRideExecDie: {
      layers: [
        { type: "sawtooth", from: 65, to: 83, seconds: 0.32, attack: 0.05, gain: 0.81, vibrato: { rate: 6, depth: 0.1 }, filter: { type: "lowpass", from: 300, to: 1980, q: 4 } },
        { type: "sawtooth", from: 83, to: 50, seconds: 0.63, delay: 0.27, attack: 0.02, gain: 0.81, vibrato: { rate: 6, depth: 0.12 }, filter: { type: "lowpass", from: 1980, to: 260, q: 4 } },
        { type: "sawtooth", from: 36, to: 26, seconds: 0.9, attack: 0.08, gain: 0.54, filter: { type: "lowpass", from: 500, to: 500, q: 1 } },
        { type: "brown", seconds: 0.9, attack: 0.06, gain: 0.72, filter: { type: "lowpass", from: 900, to: 180, q: 1 } },
        { type: "sine", from: 36, to: 25, seconds: 0.9, attack: 0.05, gain: 0.63 },
        { type: "sine", from: 66, to: 24, seconds: 0.25, attack: 0, gain: 0.8, delay: 0.7 },
        { type: "brown", seconds: 0.2, attack: 0, gain: 0.64, filter: { type: "lowpass", from: 192, to: 192, q: 1 }, delay: 0.7 },
      ],
    },
    // Iron maiden: An iron maiden in the Chamber of Torture bursts open, hands reaching out.
    // Door burst: Iron boom and scream.
    ghoulRideMaidenBurst: {
      layers: [
        { type: "sine", from: 90, to: 30, seconds: 0.5, attack: 0.003, gain: 1 },
        { type: "brown", seconds: 0.55, attack: 0.003, gain: 0.9, filter: { type: "lowpass", from: 500, to: 80, q: 1 } },
        { type: "sine", from: 500, to: 490, seconds: 0.7, attack: 0.003, gain: 0.36, delay: 0.02 },
        { type: "sine", from: 1380, to: 1350, seconds: 0.42, attack: 0.003, gain: 0.18, delay: 0.02 },
        { type: "noise", seconds: 0.03, attack: 0.003, gain: 0.3, delay: 0.02, filter: { type: "bandpass", from: 1500, to: 1500, q: 2 } },
        { type: "sawtooth", from: 450, to: 630, seconds: 0.6, attack: 0.03, gain: 0.32, vibrato: { rate: 12, depth: 0.04 }, filter: { type: "bandpass", from: 900, to: 1080, q: 4 }, delay: 0.1 },
        { type: "sawtooth", from: 675, to: 945, seconds: 0.54, attack: 0.04, gain: 0.14, filter: { type: "bandpass", from: 1350, to: 1350, q: 5 }, delay: 0.1 },
        { type: "noise", seconds: 0.48, attack: 0.03, gain: 0.12, filter: { type: "highpass", from: 3000, to: 3000, q: 1 }, delay: 0.1 },
      ],
    },
    // Carousel horses: The carousel's painted horses break off their poles and gallop at the car; impaled ones swing across the track (duck).
    // Gallop: Calliope gallop.
    ghoulRideHorseGallop: {
      layers: [
        { type: "square", from: 392, to: 392, seconds: 0.12, attack: 0.008, gain: 0.3 },
        { type: "square", from: 392, to: 392, seconds: 0.12, attack: 0.008, gain: 0.3, delay: 0.09 },
        { type: "square", from: 523, to: 523, seconds: 0.12, attack: 0.008, gain: 0.3, delay: 0.18 },
        { type: "square", from: 392, to: 392, seconds: 0.12, attack: 0.008, gain: 0.3, delay: 0.27 },
        { type: "square", from: 392, to: 392, seconds: 0.12, attack: 0.008, gain: 0.3, delay: 0.36 },
        { type: "square", from: 523, to: 523, seconds: 0.12, attack: 0.008, gain: 0.3, delay: 0.45 },
        { type: "pink", seconds: 0.04, attack: 0.003, gain: 0.2, filter: { type: "bandpass", from: 320, to: 200, q: 2 } },
        { type: "pink", seconds: 0.04, attack: 0.003, gain: 0.23, delay: 0.09, filter: { type: "bandpass", from: 320, to: 200, q: 2 } },
        { type: "pink", seconds: 0.04, attack: 0.003, gain: 0.26, delay: 0.18, filter: { type: "bandpass", from: 320, to: 200, q: 2 } },
        { type: "pink", seconds: 0.04, attack: 0.003, gain: 0.29, delay: 0.27, filter: { type: "bandpass", from: 320, to: 200, q: 2 } },
        { type: "pink", seconds: 0.04, attack: 0.003, gain: 0.33, delay: 0.36, filter: { type: "bandpass", from: 320, to: 200, q: 2 } },
        { type: "pink", seconds: 0.04, attack: 0.003, gain: 0.36, delay: 0.45, filter: { type: "bandpass", from: 320, to: 200, q: 2 } },
      ],
    },
    // Impaled horse swings: Wet drip, slow pendulum.
    ghoulRideHorseSwing: {
      layers: [
        { type: "brown", seconds: 0.3, attack: 0.01, gain: 0.4, filter: { type: "lowpass", from: 910, to: 105, q: 1 } },
        { type: "sine", from: 182, to: 42, seconds: 0.22, attack: 0.01, gain: 0.28 },
        { type: "noise", seconds: 0.12, attack: 0.01, gain: 0.16, filter: { type: "bandpass", from: 630, to: 210, q: 3 } },
        { type: "sine", from: 560, to: 1200, seconds: 0.07, attack: 0.004, gain: 0.35, delay: 0.3 },
        { type: "sine", from: 1200, to: 1040, seconds: 0.1, attack: 0.003, gain: 0.13, delay: 0.37 },
        { type: "sawtooth", from: 175, to: 84, seconds: 0.7, attack: 0.12, gain: 0.25, filter: { type: "lowpass", from: 490, to: 490, q: 1 }, vibrato: { rate: 24, depth: 0.05 } },
        { type: "pink", seconds: 0.56, attack: 0.1, gain: 0.15, filter: { type: "bandpass", from: 350, to: 210, q: 4 } },
      ],
    },
    // Breaks off: Pole bends, sproing.
    ghoulRideHorseSnap: {
      layers: [
        { type: "triangle", from: 300, to: 900, seconds: 0.2, attack: 0.01, gain: 0.49, vibrato: { rate: 30, depth: 0.08 } },
        { type: "noise", seconds: 0.05, attack: 0.003, gain: 0.7, delay: 0.18, filter: { type: "highpass", from: 2500, to: 2500, q: 1 } },
      ],
    },
    // Mirror ghoul: The Hall of Mirrors: one ghoul is solid and the rest are cyan reflections; shoot the real one, and a shot at a reflection cracks it.
    // The real ghoul: Funhouse laugh.
    ghoulRideMirrorGhoul: {
      layers: [
        { type: "sawtooth", from: 520, to: 416, seconds: 0.09, attack: 0.01, gain: 0.56, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 1300, to: 1040, q: 3 } },
        { type: "sawtooth", from: 494, to: 395, seconds: 0.09, delay: 0.12, attack: 0.01, gain: 0.56, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 1235, to: 988, q: 3 } },
        { type: "sawtooth", from: 468, to: 374, seconds: 0.09, delay: 0.24, attack: 0.01, gain: 0.56, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 1170, to: 936, q: 3 } },
        { type: "sawtooth", from: 442, to: 354, seconds: 0.09, delay: 0.36, attack: 0.01, gain: 0.56, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 1105, to: 884, q: 3 } },
        { type: "sawtooth", from: 416, to: 333, seconds: 0.09, delay: 0.48, attack: 0.01, gain: 0.56, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 1040, to: 832, q: 3 } },
      ],
    },
    // Reflection cracks: Tinkle and sad trombone.
    ghoulRideMirrorCrack: {
      layers: [
        { type: "noise", seconds: 0.25, attack: 0.003, gain: 0.45, filter: { type: "highpass", from: 4900, to: 4900, q: 1 } },
        { type: "triangle", from: 3360, to: 2380, seconds: 0.25, attack: 0.003, gain: 0.13 },
        { type: "triangle", from: 4340, to: 3080, seconds: 0.25, attack: 0.003, gain: 0.13, delay: 0.03 },
        { type: "triangle", from: 5460, to: 3780, seconds: 0.2, attack: 0.003, gain: 0.1, delay: 0.06 },
        { type: "triangle", from: 330, to: 200, seconds: 0.7, attack: 0.01, gain: 0.49, delay: 0.15, vibrato: { rate: 7, depth: 0.08 } },
      ],
    },
    // Freak-show jar: A pickled specimen in a lit jar on a chain: shoot the chain and the jar breaks.
    // Jar cracks: Cork pop, fizz.
    ghoulRideJarCrack: {
      layers: [
        { type: "sine", from: 500, to: 1400, seconds: 0.06, attack: 0.003, gain: 0.7 },
        { type: "noise", seconds: 0.04, attack: 0.003, gain: 0.25, delay: 0.08, filter: { type: "highpass", from: 2500, to: 2500, q: 1 } },
        { type: "noise", seconds: 0.04, attack: 0.003, gain: 0.4, delay: 0.13, filter: { type: "highpass", from: 3300, to: 3300, q: 1 } },
        { type: "noise", seconds: 0.04, attack: 0.003, gain: 0.25, delay: 0.17, filter: { type: "highpass", from: 4100, to: 4100, q: 1 } },
        { type: "noise", seconds: 0.04, attack: 0.003, gain: 0.4, delay: 0.19, filter: { type: "highpass", from: 2500, to: 2500, q: 1 } },
        { type: "noise", seconds: 0.04, attack: 0.003, gain: 0.25, delay: 0.23, filter: { type: "highpass", from: 3300, to: 3300, q: 1 } },
        { type: "noise", seconds: 0.04, attack: 0.003, gain: 0.4, delay: 0.28, filter: { type: "highpass", from: 4100, to: 4100, q: 1 } },
        { type: "noise", seconds: 0.04, attack: 0.003, gain: 0.25, delay: 0.29, filter: { type: "highpass", from: 2500, to: 2500, q: 1 } },
        { type: "noise", seconds: 0.04, attack: 0.003, gain: 0.4, delay: 0.34, filter: { type: "highpass", from: 3300, to: 3300, q: 1 } },
      ],
    },
    // The black swan boat: The Tunnel of Love's mini-boss: a black swan boat that pecks at the car (duck) and spits skulls (shoot them).
    // Peck: Honk and stab.
    ghoulRideSwanPeck: {
      layers: [
        { type: "square", from: 380, to: 304, seconds: 0.2, attack: 0.02, gain: 0.32, filter: { type: "bandpass", from: 1140, to: 760, q: 3 } },
        { type: "square", from: 384, to: 307, seconds: 0.2, attack: 0.02, gain: 0.24, filter: { type: "lowpass", from: 1520, to: 1520, q: 1 } },
        { type: "noise", seconds: 0.05, attack: 0.003, gain: 0.8, delay: 0.2, filter: { type: "highpass", from: 2500, to: 2500, q: 1 } },
        { type: "sine", from: 130, to: 60, seconds: 0.1, attack: 0.003, gain: 0.6, delay: 0.2 },
      ],
    },
    // Spits a skull: Cough and wet spit.
    ghoulRideSwanSpit: {
      layers: [
        { type: "sawtooth", from: 1170, to: 810, seconds: 0.16, attack: 0.01, gain: 0.54, vibrato: { rate: 7, depth: 0.1 }, filter: { type: "lowpass", from: 4620, to: 4620, q: 1 } },
        { type: "brown", seconds: 0.13, attack: 0.01, gain: 0.36, filter: { type: "lowpass", from: 750, to: 750, q: 1 } },
        { type: "noise", seconds: 0.1, attack: 0, gain: 0.64, filter: { type: "highpass", from: 1800, to: 1800, q: 1 }, delay: 0.1 },
        { type: "sine", from: 700, to: 150, seconds: 0.16, delay: 0.12, gain: 0.48 },
        { type: "brown", seconds: 0.12, attack: 0, gain: 0.4, filter: { type: "lowpass", from: 420, to: 420, q: 1 }, delay: 0.1 },
      ],
    },
    // Dies: Bubbling gurgle.
    ghoulRideSwanDie: {
      layers: [
        { type: "sine", from: 1200, to: 900, seconds: 0.9, attack: 0.05, gain: 0.63, vibrato: { rate: 15, depth: 0.4 } },
        { type: "brown", seconds: 0.9, attack: 0.05, gain: 0.49, filter: { type: "lowpass", from: 700, to: 300, q: 1 } },
        { type: "sine", from: 1800, to: 1440, seconds: 0.63, delay: 0.14, attack: 0.03, gain: 0.28, vibrato: { rate: 9, depth: 0.5 } },
        { type: "sine", from: 873, to: 1484, seconds: 0.05, delay: 0.67, attack: 0, gain: 0.21 },
        { type: "sine", from: 606, to: 1030, seconds: 0.05, delay: 0.89, attack: 0, gain: 0.21 },
        { type: "sine", from: 333, to: 566, seconds: 0.05, delay: 0.08, attack: 0, gain: 0.21 },
        { type: "sine", from: 425, to: 723, seconds: 0.05, delay: 0.54, attack: 0, gain: 0.21 },
        { type: "sine", from: 388, to: 659, seconds: 0.05, delay: 0.09, attack: 0, gain: 0.21 },
        { type: "sine", from: 510, to: 867, seconds: 0.05, delay: 0.19, attack: 0, gain: 0.21 },
        { type: "sine", from: 493, to: 838, seconds: 0.05, delay: 0.48, attack: 0, gain: 0.21 },
        { type: "sine", from: 543, to: 923, seconds: 0.05, delay: 0.8, attack: 0, gain: 0.21 },
      ],
    },
    // Water bubbles: The flooded tunnel: lit bubbles rise, and the ones you leave turn into grabbing hands (shoot them first).
    // Bubble rises: Single blip.
    ghoulRideBubblesRise: {
      layers: [
        { type: "sine", from: 490, to: 1050, seconds: 0.07, attack: 0.004, gain: 0.63 },
        { type: "sine", from: 1050, to: 910, seconds: 0.1, attack: 0.003, gain: 0.23, delay: 0.07 },
      ],
    },
    // Bubble pops: Plop and ripple.
    ghoulRideBubblesPop: {
      layers: [
        { type: "sine", from: 350, to: 750, seconds: 0.07, attack: 0.004, gain: 0.56 },
        { type: "sine", from: 750, to: 650, seconds: 0.1, attack: 0.003, gain: 0.2, delay: 0.07 },
        { type: "sine", from: 220, to: 180, seconds: 0.4, attack: 0.003, gain: 0.2, delay: 0.1, vibrato: { rate: 10, depth: 0.1 } },
      ],
    },
    // Hands come up: Fingers on the hull.
    ghoulRideBubblesHands: {
      layers: [
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2028, to: 1622, q: 6 } },
        { type: "square", from: 546, to: 397, seconds: 0.02, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.05, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2317, to: 1853, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.1, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 1979, to: 1583, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.16, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2181, to: 1745, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.21, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2462, to: 1969, q: 6 } },
        { type: "square", from: 588, to: 355, seconds: 0.02, delay: 0.21, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.25, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2517, to: 2014, q: 6 } },
        { type: "triangle", from: 500, to: 650, seconds: 0.7, attack: 0.25, gain: 0.36, vibrato: { rate: 5, depth: 0.03 }, filter: { type: "lowpass", from: 1400, to: 900, q: 1 } },
        { type: "sine", from: 1000, to: 1300, seconds: 0.7, attack: 0.3, gain: 0.12 },
        { type: "pink", seconds: 0.7, attack: 0.3, gain: 0.1, filter: { type: "bandpass", from: 2000, to: 1500, q: 6 } },
      ],
    },
    // The Widow: The Widow's Nest's mini-boss: a giant spider with an egg sac that spits webs, strikes with her fangs and bursts into spiderlings.
    // Web spit: Harp-string zing.
    ghoulRideWidowWeb: {
      layers: [
        { type: "triangle", from: 700, to: 500, seconds: 0.6, attack: 0.003, gain: 0.63, vibrato: { rate: 30, depth: 0.06 } },
        { type: "noise", seconds: 0.02, attack: 0.003, gain: 0.36, filter: { type: "bandpass", from: 4000, to: 3000, q: 3 } },
        { type: "triangle", from: 1050, to: 750, seconds: 0.5, attack: 0.003, gain: 0.28, delay: 0.05, vibrato: { rate: 30, depth: 0.06 } },
        { type: "noise", seconds: 0.02, attack: 0.003, gain: 0.16, delay: 0.05, filter: { type: "bandpass", from: 6000, to: 4500, q: 3 } },
      ],
    },
    // Fang strike: Venom spit and bite.
    ghoulRideWidowFang: {
      layers: [
        { type: "noise", seconds: 0.1, attack: 0, gain: 0.48, filter: { type: "highpass", from: 2160, to: 2160, q: 1 } },
        { type: "sine", from: 840, to: 180, seconds: 0.16, delay: 0.02, gain: 0.36 },
        { type: "brown", seconds: 0.12, attack: 0, gain: 0.3, filter: { type: "lowpass", from: 504, to: 504, q: 1 } },
        { type: "sawtooth", from: 358, to: 269, seconds: 0.3, attack: 0.03, gain: 0.63, vibrato: { rate: 13.5, depth: 0.2 }, filter: { type: "bandpass", from: 2016, to: 1120, q: 3 }, delay: 0.05 },
        { type: "noise", seconds: 0.27, attack: 0.02, gain: 0.35, filter: { type: "bandpass", from: 2240, to: 980, q: 1.5 }, delay: 0.05 },
        { type: "square", from: 179, to: 157, seconds: 0.3, attack: 0.03, gain: 0.24, filter: { type: "lowpass", from: 700, to: 700, q: 1 }, delay: 0.05 },
      ],
    },
    // Dies: Green gush.
    ghoulRideWidowDie: {
      layers: [
        { type: "noise", seconds: 0.28, attack: 0, gain: 0.81, filter: { type: "lowpass", from: 1820, to: 140, q: 1 } },
        { type: "square", from: 98, to: 28, seconds: 0.16, attack: 0, gain: 0.45, filter: { type: "lowpass", from: 420, to: 420, q: 1 } },
        { type: "sine", from: 630, to: 910, seconds: 0.05, delay: 0.2, gain: 0.23 },
        { type: "sine", from: 532, to: 770, seconds: 0.05, delay: 0.34, gain: 0.16 },
        { type: "sine", from: 320, to: 240, seconds: 0.8, attack: 0.05, gain: 0.45, vibrato: { rate: 15, depth: 0.4 }, delay: 0.1 },
        { type: "brown", seconds: 0.8, attack: 0.05, gain: 0.35, filter: { type: "lowpass", from: 700, to: 300, q: 1 }, delay: 0.1 },
        { type: "sine", from: 480, to: 384, seconds: 0.56, delay: 0.22, attack: 0.03, gain: 0.2, vibrato: { rate: 9, depth: 0.5 } },
      ],
    },
    // Spiderlings: Small spiders that come off the webs and the Widow in waves and jump at the car (one shot each).
    // Skitter and leap: Squeaky wind-up toy.
    ghoulRideSpiderlingSkitter: {
      layers: [
        { type: "sine", from: 1400, to: 1820, seconds: 0.08, attack: 0.01, gain: 0.48, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 1680, to: 2170, seconds: 0.07, delay: 0.1, attack: 0.01, gain: 0.36, vibrato: { rate: 40, depth: 0.08 } },
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 6996, to: 5597, q: 6 } },
        { type: "square", from: 2090, to: 1180, seconds: 0.02, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.04, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 7519, to: 6015, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.08, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 6560, to: 5248, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.12, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 7378, to: 5902, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.15, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 8878, to: 7102, q: 6 } },
        { type: "square", from: 2269, to: 1511, seconds: 0.02, delay: 0.15, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.19, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 6778, to: 5422, q: 6 } },
      ],
    },
    // Squashed: Squeak and pop.
    ghoulRideSpiderlingDie: {
      layers: [
        { type: "sine", from: 1600, to: 2080, seconds: 0.08, attack: 0.01, gain: 0.48, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 1920, to: 2480, seconds: 0.07, delay: 0.1, attack: 0.01, gain: 0.36, vibrato: { rate: 40, depth: 0.08 } },
        { type: "noise", seconds: 0.5, attack: 0, gain: 0.3, filter: { type: "lowpass", from: 8400, to: 300, q: 1 } },
        { type: "sine", from: 320, to: 70, seconds: 0.4, attack: 0, gain: 0.27 },
        { type: "brown", seconds: 0.6, attack: 0.01, gain: 0.21, filter: { type: "lowpass", from: 800, to: 800, q: 1 } },
      ],
    },
    // Lift hill bats: Bats swarm round the car on the climb and the drop: small and fast, they dive at the car.
    // Wing flap swarm: Paper-fan flutter, squeaks.
    ghoulRideBatFlap: {
      layers: [
        { type: "pink", seconds: 0.07, attack: 0.01, gain: 0.54, filter: { type: "bandpass", from: 1080, to: 468, q: 1 } },
        { type: "pink", seconds: 0.07, delay: 0.06, attack: 0.01, gain: 0.36, filter: { type: "bandpass", from: 1080, to: 468, q: 1 } },
        { type: "pink", seconds: 0.07, delay: 0.12, attack: 0.01, gain: 0.54, filter: { type: "bandpass", from: 1080, to: 468, q: 1 } },
        { type: "pink", seconds: 0.07, delay: 0.18, attack: 0.01, gain: 0.36, filter: { type: "bandpass", from: 1080, to: 468, q: 1 } },
        { type: "pink", seconds: 0.07, delay: 0.24, attack: 0.01, gain: 0.54, filter: { type: "bandpass", from: 1080, to: 468, q: 1 } },
        { type: "sine", from: 2500, to: 3250, seconds: 0.08, attack: 0.01, gain: 0.32, vibrato: { rate: 40, depth: 0.08 }, delay: 0.1 },
        { type: "sine", from: 3000, to: 3875, seconds: 0.07, delay: 0.2, attack: 0.01, gain: 0.24, vibrato: { rate: 40, depth: 0.08 } },
      ],
    },
    // Screech: Squeaky chorus.
    ghoulRideBatScreech: {
      layers: [
        { type: "sine", from: 2200, to: 2860, seconds: 0.08, attack: 0.01, gain: 0.48, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 2640, to: 3410, seconds: 0.07, delay: 0.1, attack: 0.01, gain: 0.36, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 2800, to: 3640, seconds: 0.08, attack: 0.01, gain: 0.4, vibrato: { rate: 40, depth: 0.08 }, delay: 0.07 },
        { type: "sine", from: 3360, to: 4340, seconds: 0.07, delay: 0.17, attack: 0.01, gain: 0.3, vibrato: { rate: 40, depth: 0.08 } },
        { type: "sine", from: 1900, to: 2470, seconds: 0.08, attack: 0.01, gain: 0.4, vibrato: { rate: 40, depth: 0.08 }, delay: 0.15 },
        { type: "sine", from: 2280, to: 2945, seconds: 0.07, delay: 0.25, attack: 0.01, gain: 0.3, vibrato: { rate: 40, depth: 0.08 } },
      ],
    },
    // Burning clowns and hoops: The Big Top's frenzy: clowns on fire run at the car, hounds leap through flaming hoops.
    // Burning clown: Cackle in flames.
    ghoulRideClownBurn: {
      layers: [
        { type: "sawtooth", from: 1280, to: 1024, seconds: 0.09, attack: 0.01, gain: 0.42, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 3200, to: 2560, q: 3 } },
        { type: "sawtooth", from: 1216, to: 973, seconds: 0.09, delay: 0.12, attack: 0.01, gain: 0.42, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 3040, to: 2432, q: 3 } },
        { type: "sawtooth", from: 1152, to: 922, seconds: 0.09, delay: 0.24, attack: 0.01, gain: 0.42, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 2880, to: 2304, q: 3 } },
        { type: "sawtooth", from: 1088, to: 870, seconds: 0.09, delay: 0.36, attack: 0.01, gain: 0.42, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 2720, to: 2176, q: 3 } },
        { type: "sawtooth", from: 1024, to: 819, seconds: 0.09, delay: 0.48, attack: 0.01, gain: 0.42, vibrato: { rate: 25, depth: 0.05 }, filter: { type: "bandpass", from: 2560, to: 2048, q: 3 } },
        { type: "noise", seconds: 0.04, attack: 0.003, gain: 0.25, filter: { type: "highpass", from: 2500, to: 2500, q: 1 } },
        { type: "noise", seconds: 0.04, attack: 0.003, gain: 0.4, delay: 0.09, filter: { type: "highpass", from: 3300, to: 3300, q: 1 } },
        { type: "noise", seconds: 0.04, attack: 0.003, gain: 0.25, delay: 0.18, filter: { type: "highpass", from: 4100, to: 4100, q: 1 } },
        { type: "noise", seconds: 0.04, attack: 0.003, gain: 0.4, delay: 0.24, filter: { type: "highpass", from: 2500, to: 2500, q: 1 } },
        { type: "noise", seconds: 0.04, attack: 0.003, gain: 0.25, delay: 0.33, filter: { type: "highpass", from: 3300, to: 3300, q: 1 } },
      ],
    },
    // Flaming hoop: Rope creak, flame lick.
    ghoulRideClownHoop: {
      layers: [
        { type: "sawtooth", from: 325, to: 156, seconds: 0.5, attack: 0.12, gain: 0.25, filter: { type: "lowpass", from: 910, to: 910, q: 1 }, vibrato: { rate: 24, depth: 0.05 } },
        { type: "pink", seconds: 0.4, attack: 0.1, gain: 0.15, filter: { type: "bandpass", from: 650, to: 390, q: 4 } },
        { type: "noise", seconds: 0.04, attack: 0.003, gain: 0.25, filter: { type: "highpass", from: 2500, to: 2500, q: 1 } },
        { type: "noise", seconds: 0.04, attack: 0.003, gain: 0.4, delay: 0.07, filter: { type: "highpass", from: 3300, to: 3300, q: 1 } },
        { type: "noise", seconds: 0.04, attack: 0.003, gain: 0.25, delay: 0.14, filter: { type: "highpass", from: 4100, to: 4100, q: 1 } },
        { type: "noise", seconds: 0.04, attack: 0.003, gain: 0.4, delay: 0.18, filter: { type: "highpass", from: 2500, to: 2500, q: 1 } },
        { type: "noise", seconds: 0.04, attack: 0.003, gain: 0.25, delay: 0.25, filter: { type: "highpass", from: 3300, to: 3300, q: 1 } },
        { type: "noise", seconds: 0.4, attack: 0.1, gain: 0.4, delay: 0.1, filter: { type: "bandpass", from: 900, to: 500, q: 1 } },
      ],
    },
    // The Exit twist: The fake exit full of friendly guests: lights flicker and growl (the tell), the marked guests turn into ghouls, and the gate slams.
    // Lights flicker: Power-down whine.
    ghoulRideExitFlicker: {
      layers: [
        { type: "sawtooth", from: 1500, to: 100, seconds: 0.8, attack: 0.003, gain: 0.4, filter: { type: "lowpass", from: 3000, to: 300, q: 1 } },
        { type: "noise", seconds: 0.1, attack: 0.003, gain: 0.5, filter: { type: "highpass", from: 2500, to: 2500, q: 1 } },
      ],
    },
    // The growl: Choir of sinister hums.
    ghoulRideExitGrowl: {
      layers: [
        { type: "sawtooth", from: 98, to: 88, seconds: 1, attack: 0.01, gain: 0.27, filter: { type: "lowpass", from: 600, to: 600, q: 1 } },
        { type: "sawtooth", from: 104, to: 94, seconds: 1, attack: 0.01, gain: 0.27, filter: { type: "lowpass", from: 600, to: 600, q: 1 } },
        { type: "sawtooth", from: 147, to: 132, seconds: 1, attack: 0.01, gain: 0.27, filter: { type: "lowpass", from: 600, to: 600, q: 1 } },
      ],
    },
    // The guests turn: Orchestra stab.
    ghoulRideExitTurn: {
      layers: [
        { type: "square", from: 440, to: 427, seconds: 0.5, attack: 0.01, gain: 0.3, filter: { type: "lowpass", from: 2400, to: 2400, q: 1 } },
        { type: "square", from: 466, to: 452, seconds: 0.5, attack: 0.01, gain: 0.3, filter: { type: "lowpass", from: 2400, to: 2400, q: 1 } },
        { type: "square", from: 622, to: 603, seconds: 0.5, attack: 0.01, gain: 0.3, filter: { type: "lowpass", from: 2400, to: 2400, q: 1 } },
        { type: "square", from: 659, to: 639, seconds: 0.5, attack: 0.01, gain: 0.3, filter: { type: "lowpass", from: 2400, to: 2400, q: 1 } },
        { type: "noise", seconds: 0.25, attack: 0.003, gain: 0.6, filter: { type: "highpass", from: 1500, to: 1500, q: 1 } },
      ],
    },
    // Gate slam: Iron gate boom.
    ghoulRideExitGate: {
      layers: [
        { type: "sine", from: 90, to: 30, seconds: 0.6, attack: 0.003, gain: 1 },
        { type: "brown", seconds: 0.65, attack: 0.003, gain: 0.9, filter: { type: "lowpass", from: 500, to: 80, q: 1 } },
        { type: "sine", from: 400, to: 392, seconds: 0.8, attack: 0.003, gain: 0.42, delay: 0.03 },
        { type: "sine", from: 1104, to: 1080, seconds: 0.48, attack: 0.003, gain: 0.21, delay: 0.03 },
        { type: "noise", seconds: 0.03, attack: 0.003, gain: 0.35, delay: 0.03, filter: { type: "bandpass", from: 1200, to: 1200, q: 2 } },
      ],
    },
    // The stall: The car is stalled in the dark: eyes open in the flashlight, something breathes, and the jaws close on the car (duck, one heart).
    // Eyes in the dark: Glint chime.
    ghoulRideStallEyes: {
      layers: [
        { type: "sine", from: 2637, to: 2637, seconds: 0.6, attack: 0.006, gain: 0.35 },
        { type: "sine", from: 3956, to: 3956, seconds: 0.48, attack: 0.006, gain: 0.18 },
        { type: "sine", from: 5274, to: 5274, seconds: 0.3, attack: 0.006, gain: 0.1 },
        { type: "sine", from: 70, to: 70, seconds: 0.6, attack: 0.2, gain: 0.3 },
      ],
    },
    // Breathing: Calliope sigh.
    ghoulRideStallBreath: {
      layers: [
        { type: "square", from: 196, to: 176, seconds: 0.9, attack: 0.02, gain: 0.2, filter: { type: "bandpass", from: 588, to: 392, q: 3 } },
        { type: "square", from: 198, to: 178, seconds: 0.9, attack: 0.02, gain: 0.15, filter: { type: "lowpass", from: 784, to: 784, q: 1 } },
        { type: "noise", seconds: 0.7, attack: 0.3, gain: 0.3, filter: { type: "bandpass", from: 600, to: 600, q: 1 } },
      ],
    },
    // Jaws slam: Boom and snap.
    ghoulRideStallJaws: {
      layers: [
        { type: "sine", from: 90, to: 30, seconds: 0.5, attack: 0.003, gain: 1 },
        { type: "brown", seconds: 0.55, attack: 0.003, gain: 0.9, filter: { type: "lowpass", from: 500, to: 80, q: 1 } },
        { type: "noise", seconds: 0.08, attack: 0.003, gain: 0.8, filter: { type: "highpass", from: 1800, to: 1800, q: 1 } },
        { type: "square", from: 160, to: 60, seconds: 0.12, attack: 0.003, gain: 0.4 },
      ],
    },
    // The Barker: The ride's finale: a giant clown face that spits hands, with an eye to shoot on each side, and a mouth the car drives into.
    // Opens an eye: Circus drum and sting.
    ghoulRideBarkerEye: {
      layers: [
        { type: "pink", seconds: 0.04, attack: 0.003, gain: 0.28, filter: { type: "bandpass", from: 400, to: 250, q: 2 } },
        { type: "pink", seconds: 0.04, attack: 0.003, gain: 0.32, delay: 0.05, filter: { type: "bandpass", from: 400, to: 250, q: 2 } },
        { type: "pink", seconds: 0.04, attack: 0.003, gain: 0.37, delay: 0.1, filter: { type: "bandpass", from: 400, to: 250, q: 2 } },
        { type: "pink", seconds: 0.04, attack: 0.003, gain: 0.41, delay: 0.15, filter: { type: "bandpass", from: 400, to: 250, q: 2 } },
        { type: "pink", seconds: 0.04, attack: 0.003, gain: 0.45, delay: 0.2, filter: { type: "bandpass", from: 400, to: 250, q: 2 } },
        { type: "pink", seconds: 0.04, attack: 0.003, gain: 0.5, delay: 0.25, filter: { type: "bandpass", from: 400, to: 250, q: 2 } },
        { type: "pink", seconds: 0.04, attack: 0.003, gain: 0.54, delay: 0.3, filter: { type: "bandpass", from: 400, to: 250, q: 2 } },
        { type: "pink", seconds: 0.04, attack: 0.003, gain: 0.59, delay: 0.35, filter: { type: "bandpass", from: 400, to: 250, q: 2 } },
        { type: "square", from: 392, to: 380, seconds: 0.5, attack: 0.01, gain: 0.24, delay: 0.4, filter: { type: "lowpass", from: 2400, to: 2400, q: 1 } },
        { type: "square", from: 415, to: 403, seconds: 0.5, attack: 0.01, gain: 0.24, delay: 0.4, filter: { type: "lowpass", from: 2400, to: 2400, q: 1 } },
        { type: "square", from: 587, to: 569, seconds: 0.5, attack: 0.01, gain: 0.24, delay: 0.4, filter: { type: "lowpass", from: 2400, to: 2400, q: 1 } },
      ],
    },
    // Spits hands: Cough and wet fling.
    ghoulRideBarkerSpit: {
      layers: [
        { type: "sawtooth", from: 73, to: 50, seconds: 0.16, attack: 0.01, gain: 0.54, vibrato: { rate: 7, depth: 0.1 }, filter: { type: "lowpass", from: 1386, to: 1386, q: 1 } },
        { type: "brown", seconds: 0.13, attack: 0.01, gain: 0.36, filter: { type: "lowpass", from: 350, to: 350, q: 1 } },
        { type: "noise", seconds: 0.1, attack: 0, gain: 0.72, filter: { type: "highpass", from: 1260, to: 1260, q: 1 }, delay: 0.1 },
        { type: "sine", from: 490, to: 105, seconds: 0.16, delay: 0.12, gain: 0.54 },
        { type: "brown", seconds: 0.12, attack: 0, gain: 0.45, filter: { type: "lowpass", from: 294, to: 294, q: 1 }, delay: 0.1 },
        { type: "brown", seconds: 0.3, attack: 0.01, gain: 0.4, filter: { type: "lowpass", from: 1040, to: 120, q: 1 }, delay: 0.15 },
        { type: "sine", from: 208, to: 48, seconds: 0.22, attack: 0.01, gain: 0.28, delay: 0.15 },
        { type: "noise", seconds: 0.12, attack: 0.01, gain: 0.16, filter: { type: "bandpass", from: 720, to: 240, q: 3 }, delay: 0.15 },
      ],
    },
    // Bite: Bloody chomp.
    ghoulRideBarkerBite: {
      layers: [
        { type: "noise", seconds: 0.28, attack: 0, gain: 0.81, filter: { type: "lowpass", from: 1560, to: 120, q: 1 } },
        { type: "square", from: 84, to: 24, seconds: 0.16, attack: 0, gain: 0.45, filter: { type: "lowpass", from: 360, to: 360, q: 1 } },
        { type: "sine", from: 540, to: 780, seconds: 0.05, delay: 0.2, gain: 0.23 },
        { type: "sine", from: 456, to: 660, seconds: 0.05, delay: 0.34, gain: 0.16 },
        { type: "noise", seconds: 0.05, attack: 0, gain: 0.7, filter: { type: "bandpass", from: 1260, to: 840, q: 2 }, delay: 0.04 },
        { type: "square", from: 630, to: 210, seconds: 0.05, attack: 0, gain: 0.28, delay: 0.04 },
        { type: "noise", seconds: 0.04, delay: 0.1, attack: 0, gain: 0.49, filter: { type: "bandpass", from: 1820, to: 1260, q: 3 } },
        { type: "sawtooth", from: 77, to: 58, seconds: 0.4, attack: 0.03, gain: 0.45, vibrato: { rate: 10.5, depth: 0.2 }, filter: { type: "bandpass", from: 432, to: 240, q: 3 }, delay: 0.1 },
        { type: "noise", seconds: 0.36, attack: 0.02, gain: 0.25, filter: { type: "bandpass", from: 960, to: 420, q: 1.5 }, delay: 0.1 },
        { type: "square", from: 38, to: 34, seconds: 0.4, attack: 0.03, gain: 0.18, filter: { type: "lowpass", from: 300, to: 300, q: 1 }, delay: 0.1 },
      ],
    },
    // Dies and swallows: Gory pop, calliope wheeze.
    ghoulRideBarkerDie: {
      layers: [
        { type: "noise", seconds: 0.5, attack: 0, gain: 0.9, filter: { type: "lowpass", from: 3360, to: 120, q: 1 } },
        { type: "sine", from: 128, to: 28, seconds: 0.4, attack: 0, gain: 0.81 },
        { type: "brown", seconds: 0.6, attack: 0.01, gain: 0.63, filter: { type: "lowpass", from: 320, to: 320, q: 1 } },
        { type: "square", from: 300, to: 120, seconds: 0.8, attack: 0.02, gain: 0.24, delay: 0.2, filter: { type: "bandpass", from: 900, to: 600, q: 3 } },
        { type: "square", from: 303, to: 121, seconds: 0.8, attack: 0.02, gain: 0.18, delay: 0.2, filter: { type: "lowpass", from: 1200, to: 1200, q: 1 } },
      ],
    },
    // Guests: Friendly guests with green hearts on the platforms: never shoot them.
    // Innocent hit (penalty): Sad descending bleeps.
    ghoulRideGuestHit: {
      layers: [
        { type: "square", from: 660, to: 660, seconds: 0.15, attack: 0.008, gain: 0.3 },
        { type: "square", from: 554, to: 554, seconds: 0.15, attack: 0.008, gain: 0.3, delay: 0.1 },
        { type: "square", from: 466, to: 466, seconds: 0.15, attack: 0.008, gain: 0.3, delay: 0.2 },
        { type: "square", from: 392, to: 392, seconds: 0.15, attack: 0.008, gain: 0.3, delay: 0.3 },
      ],
    },
    // Combo streak: Chain kills without a miss and the streak climbs: a tick on every step, brighter as the multiplier grows.
    // Streak tick: Coin pickup.
    ghoulRideComboTick: {
      layers: [
        { type: "square", from: 988, to: 988, seconds: 0.06, attack: 0.003, gain: 0.5 },
        { type: "square", from: 1319, to: 1319, seconds: 0.2, attack: 0.003, gain: 0.5, delay: 0.06 },
      ],
    },
    // The end card: The ride is over: a result card with a ride photo, the Lucky Dice tumble into the tray, a counter climbs, the fanfare, and the sting if the bonus was lost.
    // Result card: Drum flourish.
    ghoulRideEndCard: {
      layers: [
        { type: "pink", seconds: 0.04, attack: 0.003, gain: 0.32, filter: { type: "bandpass", from: 400, to: 250, q: 2 } },
        { type: "pink", seconds: 0.04, attack: 0.003, gain: 0.39, delay: 0.04, filter: { type: "bandpass", from: 400, to: 250, q: 2 } },
        { type: "pink", seconds: 0.04, attack: 0.003, gain: 0.45, delay: 0.08, filter: { type: "bandpass", from: 400, to: 250, q: 2 } },
        { type: "pink", seconds: 0.04, attack: 0.003, gain: 0.52, delay: 0.12, filter: { type: "bandpass", from: 400, to: 250, q: 2 } },
        { type: "pink", seconds: 0.04, attack: 0.003, gain: 0.59, delay: 0.16, filter: { type: "bandpass", from: 400, to: 250, q: 2 } },
        { type: "pink", seconds: 0.04, attack: 0.003, gain: 0.65, delay: 0.2, filter: { type: "bandpass", from: 400, to: 250, q: 2 } },
        { type: "sine", from: 1047, to: 1047, seconds: 0.5, attack: 0.006, gain: 0.42, delay: 0.25 },
        { type: "sine", from: 1571, to: 1571, seconds: 0.4, attack: 0.006, gain: 0.21, delay: 0.25 },
        { type: "sine", from: 2094, to: 2094, seconds: 0.25, attack: 0.006, gain: 0.12, delay: 0.25 },
      ],
    },
    // A die lands in the tray: Bone dice clatter.
    ghoulRideEndLand: {
      layers: [
        { type: "noise", seconds: 0.04, attack: 0, gain: 0.9, filter: { type: "bandpass", from: 2568, to: 2054, q: 6 } },
        { type: "square", from: 976, to: 582, seconds: 0.02, gain: 0.3 },
        { type: "noise", seconds: 0.04, delay: 0.04, attack: 0, gain: 0.77, filter: { type: "bandpass", from: 2886, to: 2308, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.09, attack: 0, gain: 0.63, filter: { type: "bandpass", from: 3910, to: 3128, q: 6 } },
        { type: "noise", seconds: 0.04, delay: 0.14, attack: 0, gain: 0.5, filter: { type: "bandpass", from: 4132, to: 3305, q: 6 } },
        { type: "sine", from: 1760, to: 1760, seconds: 0.35, attack: 0.006, gain: 0.42, delay: 0.12 },
        { type: "sine", from: 2640, to: 2640, seconds: 0.28, attack: 0.006, gain: 0.21, delay: 0.12 },
        { type: "sine", from: 3520, to: 3520, seconds: 0.18, attack: 0.006, gain: 0.12, delay: 0.12 },
      ],
    },
    // LUCKY DICE counter tick: Odometer click.
    ghoulRideEndCount: {
      layers: [
        { type: "noise", seconds: 0.02, attack: 0.003, gain: 0.8, filter: { type: "highpass", from: 3000, to: 3000, q: 1 } },
        { type: "square", from: 400, to: 200, seconds: 0.03, attack: 0.003, gain: 0.4 },
      ],
    },
    // Fanfare: Calliope parade.
    ghoulRideEndFanfare: {
      layers: [
        { type: "square", from: 523, to: 523, seconds: 0.2, attack: 0.02, gain: 0.32, filter: { type: "bandpass", from: 1569, to: 1046, q: 3 } },
        { type: "square", from: 528, to: 528, seconds: 0.2, attack: 0.02, gain: 0.24, filter: { type: "lowpass", from: 2092, to: 2092, q: 1 } },
        { type: "square", from: 659, to: 659, seconds: 0.2, attack: 0.02, gain: 0.32, delay: 0.12, filter: { type: "bandpass", from: 1977, to: 1318, q: 3 } },
        { type: "square", from: 666, to: 666, seconds: 0.2, attack: 0.02, gain: 0.24, delay: 0.12, filter: { type: "lowpass", from: 2636, to: 2636, q: 1 } },
        { type: "square", from: 784, to: 784, seconds: 0.2, attack: 0.02, gain: 0.32, delay: 0.24, filter: { type: "bandpass", from: 2352, to: 1568, q: 3 } },
        { type: "square", from: 792, to: 792, seconds: 0.2, attack: 0.02, gain: 0.24, delay: 0.24, filter: { type: "lowpass", from: 3136, to: 3136, q: 1 } },
        { type: "square", from: 1047, to: 1047, seconds: 0.5, attack: 0.02, gain: 0.32, delay: 0.36, filter: { type: "bandpass", from: 3141, to: 2094, q: 3 } },
        { type: "square", from: 1057, to: 1057, seconds: 0.5, attack: 0.02, gain: 0.24, delay: 0.36, filter: { type: "lowpass", from: 4188, to: 4188, q: 1 } },
      ],
    },
    // Bonus-lost sting: Fading music box.
    ghoulRideEndLost: {
      layers: [
        { type: "triangle", from: 659, to: 659, seconds: 0.35, attack: 0.008, gain: 0.36 },
        { type: "triangle", from: 587, to: 587, seconds: 0.35, attack: 0.008, gain: 0.36, delay: 0.22 },
        { type: "triangle", from: 523, to: 523, seconds: 0.35, attack: 0.008, gain: 0.36, delay: 0.44 },
        { type: "triangle", from: 440, to: 440, seconds: 0.35, attack: 0.008, gain: 0.36, delay: 0.66 },
      ],
    },
  },
  music: {
    // The Dark Ride: ghost-train organ chase. The classic ghost train at full
    // tilt: a band organ rattles the figure in eighths with a thinner twin an
    // octave down, the tuba runs on every beat and the chord stabs on the off
    // beats, and a gallop of hats keeps the car moving. The second section
    // turns to Cm, Gm, Ab, D, the third answers an octave up with the snare
    // running. At high dread a steam whistle shrieks, a siren climbs for the
    // lift hill, a cymbal crashes and the kick doubles for the burning big
    // top.
    ghoulRideTheme: {
      bpm: 144,
      rush: 8,
      voices: {
        organ: { wave: "pulse", duty: 0.5, gain: 0.1, decay: 0.05, sustain: 1, vibrato: { rate: 6, depth: 0.008, delay: 0 } },
        organ2: { wave: "pulse", duty: 0.25, gain: 0.07, decay: 0.05, sustain: 1, from: 0.3, vibrato: { rate: 4.8, depth: 0.012, delay: 0 } },
        tuba: { wave: "triangle", gain: 0.42, decay: 0.12, sustain: 0.45 },
        pah: { wave: "pulse", duty: 0.25, gain: 0.08, decay: 0.04, sustain: 0.25 },
        drum: { kit: true, gain: 0.3 },
        clack: { kit: true, gain: 0.12, from: 0.4 },
        whistle: { wave: "sine", gain: 0.08, decay: 0.4, sustain: 0.9, from: 0.8, vibrato: { rate: 6.5, depth: 0.015, delay: 0.1 } },
        siren: { wave: "sawtooth", gain: 0.04, decay: 0.3, sustain: 1, from: 0.9, vibrato: { rate: 0.6, depth: 0.04, delay: 0 } },
        crash: { kit: true, gain: 0.22, from: 0.85 },
        dk: { kit: true, gain: 0.24, from: 0.9 },
      },
      patterns: {
        A: {
          organ:
          "G4 - Bb4 - D5 - . . G4 - Bb4 - D5 - . . | Eb5 - D5 - C#5 - . . Eb5 - D5 - C#5 - . . | " +
          "C5 - Bb4 - G4 - . . C5 - Bb4 - G4 - . . | A4 - - - . . . . A4 - - - . . . .",
          organ2:
          "G3 - A#3 - D4 - . . G3 - A#3 - D4 - . . | D#4 - D4 - C#4 - . . D#4 - D4 - C#4 - . . | " +
          "C4 - A#3 - G3 - . . C4 - A#3 - G3 - . . | A3 - - - . . . . A3 - - - . . . .",
          tuba:
          "G2 - . . D3 - . . G2 - . . D3 - . . | Eb2 - . . A#2 - . . Eb2 - . . A#2 - . . | " +
          "C2 - . . G2 - . . C2 - . . G2 - . . | D2 - . . A2 - . . D2 - . . A2 - . .",
          pah:
          ". . G3^037 . . . G3^037 . . . G3^037 . . . G3^037 . | . . Eb3^047 . . . Eb3^047 . . . Eb3^047 . . . Eb3^047 . | " +
          ". . C3^037 . . . C3^037 . . . C3^037 . . . C3^037 . | . . D3^047 . . . D3^047 . . . D3^047 . . . D3^047 .",
          drum:
          "k . . . s . . . k . k . s . . . | k . . . s . . . k . k . s . . . | " +
          "k . . . s . . . k . k . s . . . | k . . . s . . . k . k . s . . .",
          clack:
          "h . h h . h . h h . h h . h . h | h . h h . h . h h . h h . h . h | " +
          "h . h h . h . h h . h h . h . h | h . h h . h . h h . h h . h . h",
          whistle:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | A5 - - - - - - - - - - - - - - -",
          siren:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          crash:
          "o . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          dk:
          "k . k . k . k . k . k . k . k . | k . k . k . k . k . k . k . k . | " +
          "k . k . k . k . k . k . k . k . | k . k . k . k . k . k . k . k .",
        },
        B: {
          organ:
          "Eb5 - D5 - C5 - . . Eb5 - D5 - C5 - . . | Bb4 - D5 - G5 - . . Bb4 - D5 - G5 - . . | " +
          "Ab5 - - G5 - Eb5 - . Ab5 - - G5 - Eb5 - . | F#5 - C#5 - A4 - . . F#5 - C#5 - A4 - . .",
          organ2:
          "D#4 - D4 - C4 - . . D#4 - D4 - C4 - . . | A#3 - D4 - G4 - . . A#3 - D4 - G4 - . . | " +
          "G#4 - - G4 - D#4 - . G#4 - - G4 - D#4 - . | F#4 - C#4 - A3 - . . F#4 - C#4 - A3 - . .",
          tuba:
          "C2 - . . G2 - . . C2 - . . G2 - . . | G2 - . . D3 - . . G2 - . . D3 - . . | " +
          "Ab2 - . . D#3 - . . Ab2 - . . D#3 - . . | D2 - . . A2 - . . D2 - . . A2 - . .",
          pah:
          ". . C3^037 . . . C3^037 . . . C3^037 . . . C3^037 . | . . G3^037 . . . G3^037 . . . G3^037 . . . G3^037 . | " +
          ". . Ab3^047 . . . Ab3^047 . . . Ab3^047 . . . Ab3^047 . | . . D3^047 . . . D3^047 . . . D3^047 . . . D3^047 .",
          drum:
          "k . . . s . . . k . k . s . . . | k . . . s . . . k . k . s . . . | " +
          "k . . . s . . . k . k . s . . . | k . . . s . . . k . k . s . . .",
          clack:
          "h . h h . h . h h . h h . h . h | h . h h . h . h h . h h . h . h | " +
          "h . h h . h . h h . h h . h . h | h . h h . h . h h . h h . h . h",
          whistle:
          "Ab5 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          siren:
          "G4 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -",
          crash:
          "o . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          dk:
          "k . k . k . k . k . k . k . k . | k . k . k . k . k . k . k . k . | " +
          "k . k . k . k . k . k . k . k . | k . k . k . k . k . k . k . k .",
        },
        C: {
          organ:
          "D5 - G5 - F5 - . . D5 - G5 - F5 - . . | Eb5 - - D5 - Bb4 - . Eb5 - - D5 - Bb4 - . | " +
          "C5 - Eb5 - D5 - . . C5 - Eb5 - D5 - . . | C#5 - - - A4 - . . C#5 - - - A4 - . .",
          organ2:
          "D4 - G4 - F4 - . . D4 - G4 - F4 - . . | D#4 - - D4 - A#3 - . D#4 - - D4 - A#3 - . | " +
          "C4 - D#4 - D4 - . . C4 - D#4 - D4 - . . | C#4 - - - A3 - . . C#4 - - - A3 - . .",
          tuba:
          "G2 - . . D3 - . . G2 - . . D3 - . . | Eb2 - . . A#2 - . . Eb2 - . . A#2 - . . | " +
          "C2 - . . G2 - . . C2 - . . G2 - . . | D2 - . . A2 - . . D2 - . . A2 - . .",
          pah:
          ". . G3^037 . . . G3^037 . . . G3^037 . . . G3^037 . | . . Eb3^047 . . . Eb3^047 . . . Eb3^047 . . . Eb3^047 . | " +
          ". . C3^037 . . . C3^037 . . . C3^037 . . . C3^037 . | . . D3^047 . . . D3^047 . . . D3^047 . . . D3^047 .",
          drum:
          "k . k . s . k . k . k . s . s s | k . k . s . k . k . k . s . s s | " +
          "k . k . s . k . k . k . s . s s | k k k k s s s s s s s s s s s s",
          clack:
          "h . h h . h . h h . h h . h . h | h . h h . h . h h . h h . h . h | " +
          "h . h h . h . h h . h h . h . h | h . h h . h . h h . h h . h . h",
          whistle:
          "G6 - - - - - - - - - - - - - - - | . . . . . . . . . . . . . . . . | " +
          "D6 - - - - - - - - - - - - - - - | . . . . . . . . . . . . . . . .",
          siren:
          "D4 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -",
          crash:
          "o . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          dk:
          "k . k . k . k . k . k . k . k . | k . k . k . k . k . k . k . k . | " +
          "k . k . k . k . k . k . k . k . | k . k . k . k . k . k . k . k .",
        },
        D: {
          organ:
          "G5 - A#5 - D6 - . . G5 - A#5 - D6 - . . | D#6 - D6 - C#6 - . . D#6 - D6 - C#6 - . . | " +
          "C6 - A#5 - G5 - . . C6 - A#5 - G5 - . . | A5 - - - . . . . A5 - - - . . . .",
          organ2:
          "G4 - A#4 - D5 - . . G4 - A#4 - D5 - . . | D#5 - D5 - C#5 - . . D#5 - D5 - C#5 - . . | " +
          "C5 - A#4 - G4 - . . C5 - A#4 - G4 - . . | A4 - - - . . . . A4 - - - . . . .",
          tuba:
          "G2 - . . D3 - . . G2 - . . D3 - . . | Eb2 - . . A#2 - . . Eb2 - . . A#2 - . . | " +
          "C2 - . . G2 - . . C2 - . . G2 - . . | D2 - . . A2 - . . D2 - . . A2 - . .",
          pah:
          ". . G3^037 . . . G3^037 . . . G3^037 . . . G3^037 . | . . Eb3^047 . . . Eb3^047 . . . Eb3^047 . . . Eb3^047 . | " +
          ". . C3^037 . . . C3^037 . . . C3^037 . . . C3^037 . | . . D3^047 . . . D3^047 . . . D3^047 . . . D3^047 .",
          drum:
          "k . k . s . k . k . k . s . s s | k . k . s . k . k . k . s . s s | " +
          "k . k . s . k . k . k . s . s s | k k k k s s s s s s s s s s s s",
          clack:
          "h . h h . h . h h . h h . h . h | h . h h . h . h h . h h . h . h | " +
          "h . h h . h . h h . h h . h . h | h . h h . h . h h . h h . h . h",
          whistle:
          "D6 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -",
          siren:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          crash:
          "o . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          dk:
          "k . k . k . k . k . k . k . k . | k . k . k . k . k . k . k . k . | " +
          "k . k . k . k . k . k . k . k . | k . k . k . k . k . k . k . k .",
        },
      },
      order: ["A", "B", "A", "C", "B", "D"],
    },
    // The Barker (the finale): taiko and calliope. A festival drummer hired
    // by a clown: huge taiko hits in a 3+3+2 rhythm with a rim click on the
    // off beats and a soft second drum answering, a pedal bass holding each
    // chord, and a sine chant of root and fifth, while a calliope plays the
    // figure with a thin double an octave up. The third section quickens the
    // drums, the last is the G major fanfare. At high dread a whistle cries,
    // a scream holds, a cymbal crashes and the kick doubles.
    ghoulBarker: {
      bpm: 116,
      rush: 20,
      voices: {
        taiko: { kit: true, gain: 0.4 },
        rim: { kit: true, gain: 0.2 },
        taiko2: { kit: true, gain: 0.22, from: 0.3 },
        cal: { wave: "pulse", duty: 0.25, gain: 0.14, decay: 0.08, sustain: 0.75, vibrato: { rate: 5.2, depth: 0.012, delay: 0.1 } },
        cal2: { wave: "pulse", duty: 0.125, gain: 0.08, decay: 0.06, sustain: 0.7, from: 0.4, vibrato: { rate: 5.6, depth: 0.012, delay: 0.1 } },
        bass: { wave: "triangle", gain: 0.45, decay: 0.3, sustain: 0.9 },
        chant: { wave: "sine", gain: 0.1, decay: 0.4, sustain: 1, from: 0.3, vibrato: { rate: 5, depth: 0.012, delay: 0.3 } },
        whistle: { wave: "sine", gain: 0.09, decay: 0.5, sustain: 0.9, from: 0.8, vibrato: { rate: 6, depth: 0.015, delay: 0.1 } },
        scream: { wave: "sawtooth", gain: 0.04, decay: 0.3, sustain: 1, from: 0.9, vibrato: { rate: 7, depth: 0.03, delay: 0 } },
        crash: { kit: true, gain: 0.25, from: 0.85 },
        dk: { kit: true, gain: 0.24, from: 0.9 },
      },
      patterns: {
        A: {
          taiko:
          "k . . k . . k . k . . k . . k . | k . . k . . k . k . . k . . k . | " +
          "k . . k . . k . k . . k . . k . | k . . k . . k . k . . k . . k .",
          rim:
          ". . . . s . . . . . . . s . s . | . . . . s . . . . . . . s . s . | " +
          ". . . . s . . . . . . . s . s . | . . . . s . . . . . . . s . s .",
          taiko2:
          ". . k . . . . . . . k . . . . . | . . k . . . . . . . k . . . . . | " +
          ". . k . . . . . . . k . . . . . | . . k . . . . . . . k . . . . .",
          cal:
          "G4 - - - Bb4 - - - D5 - - - . . . . | Eb5 - - - D5 - - - C#5 - - - . . . . | " +
          "C5 - - - Bb4 - - - G4 - - - . . . . | A4 - - - - - - - . . . . . . . .",
          cal2:
          "G5 - - - A#5 - - - D6 - - - . . . . | D#6 - - - D6 - - - C#6 - - - . . . . | " +
          "C6 - - - A#5 - - - G5 - - - . . . . | A5 - - - - - - - . . . . . . . .",
          bass:
          "G2 - - - - - - - - - - - - - - - | Eb2 - - - - - - - - - - - - - - - | " +
          "C2 - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - -",
          chant:
          "G3 - - - - - - - D4 - - - - - - - | Eb3 - - - - - - - A#3 - - - - - - - | " +
          "C3 - - - - - - - G3 - - - - - - - | D3 - - - - - - - A3 - - - - - - -",
          whistle:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | A5 - - - - - - - - - - - - - - -",
          scream:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          crash:
          "o . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          dk:
          "k . k . k . k . k . k . k . k . | k . k . k . k . k . k . k . k . | " +
          "k . k . k . k . k . k . k . k . | k . k . k . k . k . k . k . k .",
        },
        B: {
          taiko:
          "k . . k . . k . k . k . k . k k | k . . k . . k . k . k . k . k k | " +
          "k . . k . . k . k . k . k . k k | k . . k . . k . k . k . k . k k",
          rim:
          ". . . . s . . . . . . . s . s . | . . . . s . . . . . . . s . s . | " +
          ". . . . s . . . . . . . s . s . | . . . . s . . . . . . . s . s .",
          taiko2:
          ". . k . . . . . . . k . . . . . | . . k . . . . . . . k . . . . . | " +
          ". . k . . . . . . . k . . . . . | . . k . . . . . . . k . . . . .",
          cal:
          "Eb5 - - - D5 - - - C5 - - - . . . . | Bb4 - - - D5 - - - G5 - - - . . . . | " +
          "Ab5 - - - - - G5 - - Eb5 - - . . . . | F#5 - - - C#5 - - - A4 - - - . . . .",
          cal2:
          "D#6 - - - D6 - - - C6 - - - . . . . | A#5 - - - D6 - - - G6 - - - . . . . | " +
          "G#6 - - - - - G6 - - D#6 - - . . . . | F#6 - - - C#6 - - - A5 - - - . . . .",
          bass:
          "C2 - - - - - - - - - - - - - - - | G2 - - - - - - - - - - - - - - - | " +
          "Ab2 - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - -",
          chant:
          "C3 - - - - - - - G3 - - - - - - - | G3 - - - - - - - D4 - - - - - - - | " +
          "Ab3 - - - - - - - D#4 - - - - - - - | D3 - - - - - - - A3 - - - - - - -",
          whistle:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          scream:
          "Ab5 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -",
          crash:
          "o . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          dk:
          "k . k . k . k . k . k . k . k . | k . k . k . k . k . k . k . k . | " +
          "k . k . k . k . k . k . k . k . | k . k . k . k . k . k . k . k .",
        },
        C: {
          taiko:
          "k . . k . . k . k . k . k . k k | k . . k . . k . k . k . k . k k | " +
          "k . . k . . k . k . k . k . k k | k . . k . . k . k . k . k . k k",
          rim:
          ". . . . s . . . . . . . s . s . | . . . . s . . . . . . . s . s . | " +
          ". . . . s . . . . . . . s . s . | . . . . s . . . . . . . s . s .",
          taiko2:
          ". . k . . . . . . . k . . . . . | . . k . . . . . . . k . . . . . | " +
          ". . k . . . . . . . k . . . . . | . . k . . . . . . . k . . . . .",
          cal:
          "D5 - - - G5 - - - F5 - - - . . . . | Eb5 - - - - - D5 - - Bb4 - - . . . . | " +
          "C5 - - - Eb5 - - - D5 - - - . . . . | C#5 - - - - - - - A4 - - - . . . .",
          cal2:
          "D6 - - - G6 - - - F6 - - - . . . . | D#6 - - - - - D6 - - A#5 - - . . . . | " +
          "C6 - - - D#6 - - - D6 - - - . . . . | C#6 - - - - - - - A5 - - - . . . .",
          bass:
          "G2 - - - - - - - - - - - - - - - | Eb2 - - - - - - - - - - - - - - - | " +
          "C2 - - - - - - - - - - - - - - - | D2 - - - - - - - - - - - - - - -",
          chant:
          "G3 - - - - - - - D4 - - - - - - - | Eb3 - - - - - - - A#3 - - - - - - - | " +
          "C3 - - - - - - - G3 - - - - - - - | D3 - - - - - - - A3 - - - - - - -",
          whistle:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          "D6 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -",
          scream:
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          crash:
          "o . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          dk:
          "k . k . k . k . k . k . k . k . | k . k . k . k . k . k . k . k . | " +
          "k . k . k . k . k . k . k . k . | k . k . k . k . k . k . k . k .",
        },
        D: {
          taiko:
          "k . . k . . k . k . k . k . k k | k . . k . . k . k . k . k . k k | " +
          "k . . k . . k . k . k . k . k k | k . . k . . k . k . k . k . k k",
          rim:
          ". . . . s . . . . . . . s . s . | . . . . s . . . . . . . s . s . | " +
          ". . . . s . . . . . . . s . s . | . . . . s . . . . . . . s . s .",
          taiko2:
          ". . k . . . . . . . k . . . . . | . . k . . . . . . . k . . . . . | " +
          ". . k . . . . . . . k . . . . . | . . k . . . . . . . k . . . . .",
          cal:
          "G4 - B4 - D5 - G5 - - - - - . . . . | E5 - - - G5 - - - C6 - - - - - - - | " +
          "D6 - - - C#6 - - - A5 - - - - - - - | G5 - - - B5 - - - D6 - - - - - - -",
          cal2:
          "G5 - B5 - D6 - G6 - - - - - . . . . | E6 - - - G6 - - - C7 - - - - - - - | " +
          "D7 - - - C#7 - - - A6 - - - - - - - | G6 - - - B6 - - - D7 - - - - - - -",
          bass:
          "G2 - - - - - - - - - - - - - - - | C2 - - - - - - - - - - - - - - - | " +
          "D2 - - - - - - - - - - - - - - - | G2 - - - - - - - - - - - - - - -",
          chant:
          "G3 - - - - - - - D4 - - - - - - - | C3 - - - - - - - G3 - - - - - - - | " +
          "D3 - - - - - - - A3 - - - - - - - | G3 - - - - - - - D4 - - - - - - -",
          whistle:
          "G6 - - - - - - - - - - - - - - - | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | D7 - - - - - - - - - - - - - - -",
          scream:
          "G5 - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - | " +
          "- - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -",
          crash:
          "o . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | " +
          ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .",
          dk:
          "k . k . k . k . k . k . k . k . | k . k . k . k . k . k . k . k . | " +
          "k . k . k . k . k . k . k . k . | k . k . k . k . k . k . k . k .",
        },
      },
      order: ["A", "B", "A", "C", "D"],
    },
  },
});
