// Plan2Code Web Console - Ghoul Rush's dark ride (the Midnight Carnival's bonus round), shared basics: the field's numbers, the math helpers and the state every part of the ride reads; no imports.
//
// The ride is a side-view shooting gallery drawn in the game's 96 by 54 unit
// field (y counted down from the top, like the prototype it was ported from,
// prototypes/ghoul-rush-ride/gallery.html). Its rules (ghoul-ride.js) and its
// art (ghoul-ride-draw*.js) both read one state object, `G`, which is
// `round.gallery`: they call `bindG(round.gallery)` before they touch it, and
// every module that imports `G` from here sees the bound object (a live binding),
// so the ported code can say `G.p` and `X(e.x)` the way the prototype did.
//
// `G` (made by newRide in ghoul-ride.js): `p` how far the car has gone, `v` its
// speed, `clock` seconds of ride, `hp` hearts, `ents` the things on the field,
// `parts` blood and sparks, `floats`, `lens` (blood on the lens), `ret` the
// reticle {x, y}, `ducked`, `shake`, `flash`, `flashCol`, `inv`, `zi` the room
// the car is in, `card` {z, t} the room plaque, `st` per-room state, `stall` the
// dark's state, `tilt`, `tint`, and the counters for the grade. See newRide.

export const W = 96;
export const H = 54;
// Where the car sits across, the floor of the stage the animatronics stand on,
// the rail's top, and the duck zone: the reticle below DUCK_ON ducks Planny,
// and he stays ducked until it comes back above DUCK_OFF (a dead band).
export const CAR_X = 24;
export const STAGE = 40;
export const FLOOR = 48;
export const DUCK_Y = 41.5;
export const DUCK_ON = 44.5;
export const DUCK_OFF = 43;
export const TAU = Math.PI * 2;
export const MAXHP = 5;
// The reticle's limits.
export const RET_X0 = 4;
export const RET_X1 = 92;
export const RET_Y0 = 3;
export const RET_Y1 = 47;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = (t) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
export const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// The bound state: `G` is the ride's, `SH` the author-to-world shift of the room
// being drawn or spawned (a scene's `sh`).
export let G = null;
export let SH = 0;
export const bindG = (g) => {
  G = g;
};
export const setSH = (v) => {
  SH = v;
};

// The ride's own random numbers (a stream kept in the state, so a seeded ride
// plays the same every time): used by the rules only. The art's flicker uses
// `vrand`, which never touches the state.
export function rnd() {
  let t = (G.rs = (G.rs + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const rand = (a, b) => a + rnd() * (b - a);
export const pick = (a) => a[Math.floor(rnd() * a.length)];
export const vrand = (a, b) => a + Math.random() * (b - a);

// A world x on the screen, a screen-space thing's own x, and a scene's author
// x (shifted by the scene being worked on).
export const X = (wx) => CAR_X + (wx - G.p);
export const sx = (e) => (e.rel ? e.rx : X(e.x));
export const XS = (wx) => X(wx + SH);
