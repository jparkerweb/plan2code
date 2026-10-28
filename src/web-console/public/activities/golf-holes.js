// Plan2Code Web Console - mini golf's course: the eighteen holes as data, in course units.
//
// Data only: no DOM and no imports, so the game (activities/golf.js) and the
// unit suite both read it as it is. Every hole is drawn on a fixed course of
// COURSE_W by COURSE_H units, scaled to the board like Snake's fixed grid, so
// a resize never moves a ball.
//
// The front nine is Pirate Cove: greens afloat in a shark sea, wooden rails,
// barrels and cannonballs. The back nine is the Caves of Doom: mossy stone in
// the dark, glowing pools, lava, a bottomless pit, mine carts and crushers.
//
// A hole is { name, par, theme, quip, ground, liquid, tee, cup, outline,
// walls, bumpers, sand, water, slopes, bridges, spinners, tunnels, movers,
// gates, powerups, decor }:
//   theme      "pirate" or "cave": the palette, the lighting and the gags
//   quip       a line shown as the hole starts
//   ground     how the green is drawn: "grass", "deck", "moss" or "stone"
//   liquid     what the water is: "sea", "pool", "lava" or "chasm" (the rule
//              is the same, a stroke and back where the putt began)
//   tee, cup   points { x, y }
//   outline    the playing area as a polygon; its edges are the course edge,
//              and they lead the walls list
//   walls      line segments { x1, y1, x2, y2 }
//   bumpers    circles { x, y, r, look? } that kick the ball back faster
//   sand       polygons that slow the ball several times over
//   water      polygons that cost a stroke, unless the ball is on a bridge
//   slopes     { points, push: { x, y } }: a polygon that pushes the ball each
//              moment it is inside, in units per second per second (ramps,
//              currents and updrafts too)
//   bridges    rectangles { x, y, w, h }: safe ground over water
//   spinners   { x, y, arm, speed, look? }: a windmill-style bar through its
//              center, arm units each way, turning speed radians a second
//   tunnels    { a, b }: two mouths; entering one sends the ball out of the
//              other with its speed kept
//   movers     { x, y, r, dx, dy, period, phase?, look? }: a bumper that swings
//              dx, dy units each way from x, y, once every period ms
//   gates      { x1, y1, x2, y2, period, open, offset?, look? }: a wall that is
//              there for the last (1 - open) of every period ms
//   powerups   { x, y, kind }: a pad the rolling ball picks up, for its next
//              putt (the kinds are POWERUPS in golf.js)
//   decor      { kind, x, y, s? }: scenery that never touches the ball
// A polygon is a list of points { x, y }.

export const COURSE_W = 400;
export const COURSE_H = 300;

const pt = (x, y) => ({ x, y });

const rect = (x, y, w, h) => [pt(x, y), pt(x + w, y), pt(x + w, y + h), pt(x, y + h)];

const wall = (x1, y1, x2, y2) => ({ x1, y1, x2, y2 });

const bump = (x, y, r, look) => (look ? { x, y, r, look } : { x, y, r });

const pad = (x, y, kind) => ({ x, y, kind });

const deco = (kind, x, y, s = 1) => ({ kind, x, y, s });

// The outline's edges, closing back to its first point.
const edges = (outline) => outline.map((p, i) => {
  const q = outline[(i + 1) % outline.length];
  return wall(p.x, p.y, q.x, q.y);
});

function freezeDeep(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}

// Fills the empty lists and puts the outline's edges first among the walls.
function hole(def) {
  const theme = def.theme || "pirate";
  return {
    name: def.name,
    par: def.par,
    theme,
    quip: def.quip || "",
    ground: def.ground || (theme === "cave" ? "moss" : "grass"),
    liquid: def.liquid || (theme === "cave" ? "pool" : "sea"),
    tee: def.tee,
    cup: def.cup,
    outline: def.outline,
    walls: [...edges(def.outline), ...(def.walls || [])],
    bumpers: def.bumpers || [],
    sand: def.sand || [],
    water: def.water || [],
    slopes: def.slopes || [],
    bridges: def.bridges || [],
    spinners: def.spinners || [],
    tunnels: def.tunnels || [],
    movers: def.movers || [],
    gates: def.gates || [],
    powerups: def.powerups || [],
    decor: def.decor || [],
  };
}

const pirate = (def) => hole({ ...def, theme: "pirate" });
const cave = (def) => hole({ ...def, theme: "cave" });

export const HOLES = freezeDeep([
  /* ------------------------------------------- front nine: Pirate Cove */

  // 1: a straight plank over the sea, to learn the putt. The sharks wait.
  pirate({
    name: "Walk the Plank",
    par: 2,
    quip: "Arr! Straight down the plank, matey. The sharks be hungry.",
    ground: "deck",
    tee: pt(90, 150),
    cup: pt(310, 150),
    outline: rect(60, 110, 280, 80),
    decor: [deco("shark", 200, 62, 1), deco("shark", 140, 244, 0.8), deco("ship", 345, 52), deco("bottle", 40, 250), deco("palm", 30, 70, 0.8)],
  }),

  // 2: an L that turns left; a barrel splits the lane, and a doubloon waits in
  // the corner for whoever banks it there.
  pirate({
    name: "Shipwreck Cove",
    par: 3,
    quip: "Bank it off the corner. That doubloon makes yer next putt free!",
    tee: pt(75, 228),
    cup: pt(268, 75),
    outline: [pt(40, 195), pt(232, 195), pt(232, 40), pt(305, 40), pt(305, 262), pt(40, 262)],
    bumpers: [bump(268, 142, 10, "barrel")],
    powerups: [pad(268, 228, "doubloon")],
    decor: [deco("wreck", 125, 110), deco("crab", 70, 282), deco("parrot", 345, 70), deco("shark", 355, 200, 0.7), deco("palm", 20, 175, 0.9)],
  }),

  // 3: cannonballs across the straight line, a powder barrel rolling the
  // lane, and cannons firing from the shore.
  pirate({
    name: "Cannon Alley",
    par: 3,
    quip: "Fire in the hole! Grab the cannonball for a mighty blast.",
    tee: pt(70, 150),
    cup: pt(330, 150),
    outline: rect(40, 60, 320, 180),
    bumpers: [
      bump(160, 108, 12, "cannonball"),
      bump(160, 192, 12, "cannonball"),
      bump(222, 150, 14, "cannonball"),
      bump(278, 98, 10, "cannonball"),
      bump(278, 202, 10, "cannonball"),
    ],
    movers: [{ x: 110, y: 150, r: 9, dx: 0, dy: 62, period: 2600, look: "barrel" }],
    powerups: [pad(92, 80, "cannon")],
    decor: [deco("cannon", 120, 42), deco("cannon", 280, 42), deco("cannon", 200, 262, -1), deco("anchor", 380, 270)],
  }),

  // 4: two staggered traps; the straight line crosses both, a weave misses
  // them, and the treasure map waits beyond the second.
  pirate({
    name: "Treasure Beach",
    par: 3,
    quip: "X marks the spot! The map makes the next cup HUGE.",
    tee: pt(70, 150),
    cup: pt(330, 150),
    outline: rect(40, 70, 320, 160),
    sand: [
      rect(135, 112, 60, 118),
      rect(235, 70, 60, 118),
    ],
    bumpers: [bump(215, 150, 9, "chest")],
    powerups: [pad(165, 195, "doubloon"), pad(265, 210, "bigcup")],
    decor: [deco("palm", 28, 52), deco("palm", 372, 252), deco("crab", 200, 254), deco("island", 350, 40), deco("bottle", 60, 262)],
  }),

  // 5: the lagoon runs wall to wall; the bridge is the only dry way over, and
  // the kraken's tentacle sweeps the far bank. The ghost floats right across.
  pirate({
    name: "Kraken's Lagoon",
    par: 4,
    quip: "Release the kraken! Or grab the ghost ball and float over it.",
    tee: pt(65, 80),
    cup: pt(330, 80),
    outline: rect(30, 40, 340, 220),
    water: [rect(165, 40, 80, 220)],
    bridges: [{ x: 165, y: 190, w: 80, h: 40 }],
    spinners: [{ x: 305, y: 172, arm: 34, speed: -1.9, look: "tentacle" }],
    powerups: [pad(90, 240, "ghost")],
    decor: [deco("tentacle", 205, 95), deco("tentacle", 190, 150, 0.8), deco("kraken", 205, 280), deco("shark", 380, 140, 0.6)],
  }),

  // 6: a ghost ship's deck with an open hold amidships; around it by the
  // rails, or a rubber duck's bounce off them.
  pirate({
    name: "Ghost Ship",
    par: 3,
    quip: "Ooooo, a haunted deck. Mind the hold, it goes straight to the sea.",
    ground: "deck",
    tee: pt(75, 150),
    cup: pt(330, 150),
    outline: [pt(40, 90), pt(280, 70), pt(370, 150), pt(280, 230), pt(40, 210)],
    water: [rect(150, 118, 90, 64)],
    powerups: [pad(105, 118, "bouncy"), pad(105, 182, "magnet")],
    decor: [deco("ghost", 200, 40), deco("ghost", 300, 262, 0.7), deco("tentacle", 195, 160), deco("jolly", 60, 40)],
  }),

  // 7: a ship's wheel turns across the way to the cup; walls close the way
  // around it.
  pirate({
    name: "The Ship's Wheel",
    par: 3,
    quip: "Hard to starboard! Time yer putt through the spinning wheel.",
    tee: pt(70, 150),
    cup: pt(330, 150),
    outline: rect(40, 80, 320, 140),
    walls: [
      wall(240, 80, 240, 107),
      wall(240, 193, 240, 220),
    ],
    spinners: [{ x: 240, y: 150, arm: 40, speed: 1.6, look: "wheel" }],
    powerups: [pad(130, 105, "bouncy")],
    decor: [deco("parrot", 240, 60), deco("anchor", 30, 260), deco("shark", 200, 262, 0.9), deco("island", 360, 45)],
  }),

  // 8: a long U the slow way round, past a scuttling crab, or the skull's
  // tunnel straight across.
  pirate({
    name: "Skull Island",
    par: 3,
    quip: "Into the skull's mouth and out its ear. Totally normal.",
    tee: pt(75, 65),
    cup: pt(325, 125),
    outline: [pt(40, 40), pt(110, 40), pt(110, 195), pt(290, 195), pt(290, 40), pt(360, 40), pt(360, 262), pt(40, 262)],
    tunnels: [
      { a: pt(75, 170), b: pt(325, 62) },
    ],
    movers: [{ x: 200, y: 245, r: 8, dx: 60, dy: 0, period: 3000, look: "crab" }],
    powerups: [pad(160, 214, "magnet")],
    decor: [deco("skullrock", 200, 115), deco("shark", 200, 45, 0.7), deco("palm", 148, 175, 0.7), deco("palm", 255, 172, 0.8)],
  }),

  // 9: up the ramp, over the bridge, through the gold to the cup.
  pirate({
    name: "Captain's Plunder",
    par: 4,
    quip: "The captain's own treasure! Ramp, bridge, gold. Go!",
    tee: pt(70, 240),
    cup: pt(340, 60),
    outline: rect(30, 30, 340, 240),
    // The ramp climbs to the bridge: too soft a putt rolls back down it.
    slopes: [
      { points: rect(95, 55, 55, 50), push: pt(-110, 0) },
    ],
    water: [
      rect(150, 30, 90, 240),
    ],
    bridges: [
      { x: 150, y: 55, w: 90, h: 50 },
    ],
    bumpers: [
      bump(288, 118, 12, "coin"),
      bump(336, 132, 10, "coin"),
      bump(296, 200, 12, "coin"),
      bump(270, 40, 8, "coin"),
    ],
    movers: [{ x: 320, y: 250, r: 7, dx: 30, dy: 0, period: 2400, look: "crab" }],
    powerups: [pad(60, 150, "spyglass"), pad(270, 160, "doubloon")],
    decor: [deco("tentacle", 195, 180), deco("tentacle", 210, 240, 0.7), deco("chest", 385, 80), deco("jolly", 385, 250)],
  }),

  /* ---------------------------------------- back nine: Caves of Doom */

  // 10: a winding passage into the dark past a glowing pool, a mushroom on
  // the bend.
  cave({
    name: "Into the Dark",
    par: 3,
    quip: "Welcome to the Caves of Doom. Your ball is the only light. Gulp.",
    tee: pt(60, 230),
    cup: pt(340, 80),
    outline: [pt(30, 200), pt(230, 200), pt(230, 40), pt(370, 40), pt(370, 120), pt(300, 120), pt(300, 260), pt(30, 260)],
    water: [rect(115, 236, 75, 24)],
    bumpers: [bump(265, 160, 9, "mushroom")],
    powerups: [pad(265, 232, "spyglass")],
    decor: [deco("bat", 110, 90), deco("bat", 160, 130, 0.8), deco("eyes", 90, 150), deco("torch", 30, 185), deco("stalactite", 330, 0), deco("crystal", 380, 200), deco("eyes", 345, 230, 0.7)],
  }),

  // 11: a forest of stalagmites, with gaps a ball can thread.
  cave({
    name: "Stalagmite Forest",
    par: 3,
    quip: "Pointy rocks everywhere. Bounce through like a pinball.",
    ground: "stone",
    tee: pt(70, 150),
    cup: pt(335, 150),
    outline: rect(40, 50, 320, 200),
    bumpers: [
      bump(120, 90, 9, "rock"), bump(120, 150, 9, "rock"), bump(120, 210, 9, "rock"),
      bump(162, 120, 9, "rock"), bump(162, 180, 9, "rock"),
      bump(204, 90, 9, "rock"), bump(204, 150, 9, "rock"), bump(204, 210, 9, "rock"),
      bump(246, 120, 9, "rock"), bump(246, 180, 9, "rock"),
      bump(288, 90, 9, "rock"), bump(288, 210, 9, "rock"),
    ],
    powerups: [pad(225, 236, "bouncy")],
    decor: [deco("bat", 100, 30), deco("bat", 300, 270, 0.8), deco("stalactite", 80, 0), deco("stalactite", 250, 0, 1.2), deco("crystal", 20, 270), deco("skeleton", 375, 40)],
  }),

  // 12: a lava lake wall to wall, two thin stone bridges, and a fireball
  // bobbing up and down across both of them.
  cave({
    name: "Lava Lake",
    par: 4,
    quip: "The floor is lava. No, really. Fireball incoming!",
    liquid: "lava",
    ground: "stone",
    tee: pt(65, 150),
    cup: pt(335, 150),
    outline: rect(30, 40, 340, 220),
    water: [rect(130, 40, 140, 220)],
    bridges: [
      { x: 130, y: 70, w: 140, h: 28 },
      { x: 130, y: 205, w: 140, h: 28 },
    ],
    movers: [{ x: 200, y: 150, r: 8, dx: 0, dy: 95, period: 3600, look: "fireball" }],
    powerups: [pad(85, 235, "ghost")],
    decor: [deco("torch", 20, 100), deco("torch", 380, 100), deco("skeleton", 375, 270), deco("stalactite", 200, 0, 0.8)],
  }),

  // 13: three mine carts rattle up and down across the straight line.
  cave({
    name: "Mine Cart Madness",
    par: 3,
    quip: "Runaway mine carts! Time it... or blast through with the cannon.",
    ground: "stone",
    tee: pt(60, 150),
    cup: pt(345, 150),
    outline: rect(30, 40, 340, 220),
    movers: [
      { x: 140, y: 150, r: 12, dx: 0, dy: 85, period: 2200, look: "cart" },
      { x: 220, y: 150, r: 12, dx: 0, dy: 85, period: 2800, phase: 0.3, look: "cart" },
      { x: 300, y: 150, r: 12, dx: 0, dy: 85, period: 2000, phase: 0.6, look: "cart" },
    ],
    powerups: [pad(60, 70, "cannon")],
    decor: [deco("rails", 140, 150), deco("rails", 220, 150), deco("rails", 300, 150), deco("lantern", 20, 40), deco("gems", 385, 270), deco("bat", 200, 20)],
  }),

  // 14: crystals everywhere and two slingshot walls: pure pinball.
  cave({
    name: "Crystal Pinball",
    par: 3,
    quip: "TILT! Crystals, bumpers and a big treasure-map cup.",
    tee: pt(70, 230),
    cup: pt(330, 70),
    outline: rect(40, 40, 320, 220),
    walls: [
      wall(300, 252, 350, 215),
      wall(48, 150, 85, 122),
    ],
    bumpers: [
      bump(130, 110, 11, "crystal"),
      bump(200, 80, 11, "crystal"),
      bump(200, 170, 13, "crystal"),
      bump(270, 140, 11, "crystal"),
      bump(140, 200, 10, "crystal"),
      bump(330, 140, 9, "crystal"),
    ],
    powerups: [pad(205, 238, "bigcup")],
    decor: [deco("crystal", 22, 210, 1.2), deco("crystal", 380, 280), deco("crystal", 385, 120, 0.8), deco("bat", 200, 280, 0.7)],
  }),

  // 15: a bottomless pit wall to wall, one rope bridge over it, and an
  // updraft blowing across the bridge.
  cave({
    name: "The Bottomless Pit",
    par: 3,
    quip: "Don't look down. Seriously. There's an updraft on the bridge.",
    liquid: "chasm",
    ground: "stone",
    tee: pt(75, 150),
    cup: pt(325, 150),
    outline: rect(40, 50, 320, 200),
    water: [rect(150, 50, 100, 200)],
    bridges: [{ x: 150, y: 132, w: 100, h: 36 }],
    slopes: [{ points: rect(150, 132, 100, 36), push: pt(0, 70) }],
    powerups: [pad(100, 80, "magnet")],
    decor: [deco("spider", 330, 70), deco("web", 360, 230), deco("skeleton", 60, 230), deco("torch", 30, 150), deco("torch", 370, 150)],
  }),

  // 16: a winding grotto; the glowworm current carries the ball up and over.
  cave({
    name: "Glowworm Grotto",
    par: 3,
    quip: "Ride the glowworm current. They're friendly. Probably.",
    tee: pt(70, 90),
    cup: pt(310, 200),
    outline: rect(30, 60, 340, 180),
    walls: [
      wall(130, 60, 130, 180),
      wall(250, 120, 250, 240),
    ],
    slopes: [{ points: rect(140, 70, 100, 100), push: pt(0, -90) }],
    bumpers: [bump(190, 215, 10, "mushroom"), bump(310, 90, 10, "mushroom")],
    powerups: [pad(165, 195, "spyglass")],
    decor: [deco("glowworms", 200, 30), deco("glowworms", 100, 270), deco("mushroom", 20, 250), deco("mushroom", 385, 50), deco("eyes", 300, 270)],
  }),

  // 17: a corridor of stone crushers slamming down in turn, lava in its
  // corners.
  cave({
    name: "Crusher Corridor",
    par: 4,
    quip: "SMASH! SMASH! SMASH! Run the crushers... if you dare.",
    ground: "stone",
    liquid: "lava",
    tee: pt(60, 150),
    cup: pt(345, 150),
    outline: rect(30, 90, 340, 120),
    water: [rect(160, 90, 30, 24), rect(240, 186, 30, 24)],
    gates: [
      { x1: 130, y1: 90, x2: 130, y2: 210, period: 2400, open: 0.55, offset: 0, look: "crusher" },
      { x1: 210, y1: 90, x2: 210, y2: 210, period: 2400, open: 0.55, offset: 0.33, look: "crusher" },
      { x1: 290, y1: 90, x2: 290, y2: 210, period: 2400, open: 0.55, offset: 0.66, look: "crusher" },
    ],
    powerups: [pad(95, 195, "cannon"), pad(250, 105, "doubloon")],
    decor: [deco("skeleton", 200, 245), deco("torch", 100, 70), deco("torch", 300, 70), deco("stalactite", 200, 0, 1.3), deco("bat", 60, 260, 0.8)],
  }),

  // 18: the dragon's hoard: a lava lake, a portal over it, the dragon's tail
  // sweeping, gold everywhere, and the dragon himself asleep at the edge.
  cave({
    name: "The Dragon's Hoard",
    par: 5,
    quip: "SHHH! The dragon is sleeping. Grab the gold and sink it.",
    liquid: "lava",
    tee: pt(60, 240),
    cup: pt(305, 75),
    outline: rect(20, 45, 325, 230),
    water: [rect(130, 45, 80, 160)],
    tunnels: [{ a: pt(70, 80), b: pt(245, 70) }],
    spinners: [{ x: 275, y: 160, arm: 34, speed: 2.2, look: "tail" }],
    bumpers: [bump(300, 220, 9, "coin"), bump(235, 112, 9, "coin"), bump(95, 145, 9, "coin")],
    powerups: [pad(170, 240, "bigcup"), pad(65, 180, "ghost")],
    decor: [deco("dragon", 400, 160), deco("gems", 30, 290), deco("gems", 372, 270, 0.8), deco("torch", 10, 160), deco("stalactite", 200, 0)],
  }),
]);

// Where the front nine ends: the scorecard after it heads into the caves.
export const FRONT_NINE = 9;
