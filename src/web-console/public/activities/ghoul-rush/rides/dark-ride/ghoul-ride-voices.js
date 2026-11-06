// Plan2Code Web Console - Ghoul Rush's dark ride, what its events sound like: the voices, the words and sounds of a heart lost, the room's look and the react hook; data and one small function.
//
// ghoul-draw.js plugs it in (VOICES, LOSE_WORDS, LOSE_SOUNDS, LOOKS and the pack
// art's `react`). Every sound the ride makes is an event `ride<Name>`
// (ghoul-ride.js SOUNDS) that plays the tone `ghoulRide<Name>`
// (ghoul-sfx-ride.js) at the event's `level` and `pitch`. A heart lost is the
// game's own `lose` event with one of the ride's causes (ghoul-ride.js CAUSES).

import { CAUSES, EVENTS, SOUNDS } from "./ghoul-ride.js";

const freeze = (o) => Object.freeze(o);
const cap = (s) => s[0].toUpperCase() + s.slice(1);

// The room's look: the ride draws the whole field itself (ghoul-ride-draw.js), so
// these colors only serve what the game asks of any look.
export const LOOKS = freeze({
  darkride: freeze({ pack: "ride", custom: true, noMoon: true, pit: "#050308", wallTop: "#12080e", wallLow: "#2a1a14", paper: "#2a1a14", wainscot: "#4a0f1a", floorTop: "#3a2a30", floor: "#14080c", floorEdge: "#050205", shelf: "#4a0f1a", shelfTop: "#8a2a3a", window: "#ffcf70", decor: "none", color: "#ff4a3a", dark: false }),
});

// kind "ride", act = the sound's name: `say`-style lookup for the tests.
// The ride sounds the user picked by ear (carnival-ride.html), one act each, over the default row.
const PICKED = freeze({
  joint: "ghoulRideCarClack",
  tick: "ghoulRideCarChain",
  stop: "ghoulRideCarStall",
  low: "ghoulRideCarBrake",
  shoot: "ghoulRideBlasterFire",
  hit: "ghoulRideBlasterHit",
  hurt: "ghoulRideHurtHeart",
  clank: "ghoulRideHurtClose",
  roar: "ghoulRideHurtLost",
  pop: "ghoulRideWaxRise",
  whoosh: "ghoulRideExecWind",
  chop: "ghoulRideExecSwing",
  splat: "ghoulRideExecHit",
  gib: "ghoulRideExecDie",
  bang: "ghoulRideMaidenBurst",
  creak: "ghoulRideHorseSwing",
  snap: "ghoulRideHorseSnap",
  glass: "ghoulRideMirrorCrack",
  splash: "ghoulRideBubblesPop",
  web: "ghoulRideWidowWeb",
  scream: "ghoulRideBatScreech",
  sparks: "ghoulRideClownBurn",
  lightsOff: "ghoulRideExitFlicker",
  growl: "ghoulRideExitGrowl",
  stab: "ghoulRideExitTurn",
  breath: "ghoulRideStallBreath",
  oops: "ghoulRideGuestHit",
  ding: "ghoulRideComboTick",
  diceLand: "ghoulRideEndLand",
  fan: "ghoulRideEndFanfare",
});
export const VOICES = freeze({ ride: freeze({ ...Object.fromEntries(SOUNDS.map((n) => [n, `ghoulRide${cap(n)}`])), ...PICKED }) });
export const EVENT_VOICE = freeze(Object.fromEntries(SOUNDS.map((n) => [`ride${cap(n)}`, ["ride", n]])));

export const LOSE_WORDS = freeze({
  ridegrab: "Grabbed", ridecleaver: "Chopped", rideblade: "Sliced", ridecrash: "Crushed", ridehand: "Clawed", ridehead: "Bitten",
  rideeyes: "Stared down", ridemouth: "Swallowed", ridebeak: "Pecked", ridefang: "Stung", ridejaws: "Devoured",
});
export const LOSE_SOUNDS = freeze({
  ridegrab: ["ghoulRideSnap", 0.6, 1], ridecleaver: ["ghoulRideChop", 0.7, 1], rideblade: ["ghoulRideChop", 0.7, 1.2], ridecrash: ["ghoulRideBang", 0.6, 1],
  ridehand: ["ghoulRideSnap", 0.6, 0.9], ridehead: ["ghoulRideSnap", 0.6, 1.1], rideeyes: ["ghoulRideSnap", 0.6, 0.7], ridemouth: ["ghoulRideRoar", 0.6, 1],
  ridebeak: ["ghoulRideSnap", 0.6, 1.3], ridefang: ["ghoulRideSnap", 0.6, 1], ridejaws: ["ghoulRideBang", 0.7, 0.8],
});

// The ride's events; true when one is its own.
export function react(e, k) {
  if (!EVENT_VOICE[e.type]) return false;
  const name = VOICES.ride[EVENT_VOICE[e.type][1]];
  k.tone(name, Math.min(1, 0.55 * (e.level ?? 1)), (e.pitch ?? 1) * (0.97 + Math.random() * 0.06));
  return true;
}
export const RIDE_EVENTS = EVENTS;
export const RIDE_CAUSES = CAUSES;
