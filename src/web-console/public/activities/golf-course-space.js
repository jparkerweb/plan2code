// Plan2Code Web Console - mini golf's Cosmic Glow course: eighteen holes as data, in course units.
//
// Data only: no DOM. Built with golf-kit.js, which documents what a hole
// holds; listed in golf-holes.js; drawn with golf-look-space.js. A black-light
// glow golf hall in deep space: neon walls, black holes that swallow the
// ball, planets that push it away, wormholes, UFOs, airlocks and an alien
// mothership.

import { course, hole, pt, rect, wall, bump, pad, deco } from "./golf-kit.js";

const h = (def) => hole(def, { theme: "space", ground: "neon", liquid: "void" });

// A round polygon of n points, for craters, voids and the like.
const disc = (x, y, r, n = 16) => Array.from({ length: n }, (_, i) => pt(x + Math.cos((i / n) * Math.PI * 2) * r, y + Math.sin((i / n) * Math.PI * 2) * r));

// A black hole: its void at the center (the look draws it 11 across) and
// its pull.
const blackHole = (x, y, r, pull) => ({ water: [disc(x, y, 11, 12)], well: { x, y, r, pull, look: "blackhole" } });

const HOLE_4 = blackHole(200, 150, 62, 340);
const HOLE_12A = blackHole(128, 165, 48, 380);
const HOLE_12B = blackHole(272, 165, 48, 380);

export default course({
  id: "space",
  name: "Cosmic Glow",
  blurb: "Black holes, wormholes and UFOs, all glowing in the dark.",
  cover: 16,
  voice: {
    label: "Orbit",
    splash: {
      void: ["Spaghettified!", "Lost in the void...", "Swallowed whole!"],
      plasma: ["ZAP! Plasma burn", "Fried in the nebula!", "Space goo. Gross!"],
    },
    splashTone: { void: "fall", plasma: "sizzle" },
    bump: ["Boing!", "Zap!", "Bleep!", "Zwoop!"],
    ace: "HOLE IN ONE! Houston, we have a winner!",
    turn: "Front nine orbited! Refuel for the back nine...",
    done: "Mission accomplished!",
    quips: {
      pickedUp: "Lost in space. Mission control sighs.",
      ace: "The aliens are beaming with pride!",
      eagle: "Out of this world!",
      birdie: "Stellar putt!",
      par: "Steady orbit.",
      bogey: "A small course correction needed.",
      worse: "Houston, we have a problem.",
    },
  },
  holes: [
    // 1: a rocket-shaped lane straight to the cup, to learn the putt.
    h({
      name: "Liftoff",
      par: 2,
      quip: "3, 2, 1... liftoff! A nice straight putt to the stars.",
      tee: pt(90, 165),
      cup: pt(315, 165),
      outline: [pt(45, 165), pt(85, 125), pt(325, 125), pt(365, 165), pt(325, 205), pt(85, 205)],
      decor: [deco("rocket", 200, 262), deco("planet", 340, 72), deco("moon", 62, 76, 0.8), deco("twinkle", 200, 92), deco("comet", 90, 262, 0.8), deco("twinkle", 360, 255, 0.8)],
    }),

    // 2: a slanted lane through a belt of tumbling asteroids.
    h({
      name: "Asteroid Belt",
      par: 3,
      quip: "Thread the asteroid belt. Or bounce off a few, they don't mind.",
      tee: pt(80, 215),
      cup: pt(320, 100),
      outline: [pt(30, 250), pt(90, 70), pt(370, 70), pt(310, 250)],
      bumpers: [
        bump(140, 180, 10, "asteroid"), bump(175, 130, 12, "asteroid"), bump(205, 205, 9, "asteroid"),
        bump(222, 100, 9, "asteroid"), bump(252, 160, 13, "asteroid"), bump(282, 218, 10, "asteroid"),
        bump(262, 86, 7, "asteroid"),
      ],
      powerups: [pad(205, 238, "bouncy")],
      decor: [deco("planet", 32, 70, 0.9), deco("satellite", 372, 170), deco("twinkle", 372, 268), deco("comet", 200, 280, 0.7)],
    }),

    // 3: an L of moon rock with dusty craters on the bend and the way home.
    h({
      name: "Moon Dust",
      par: 3,
      quip: "Moon dust slows you down. One small putt for a ball...",
      ground: "crater",
      tee: pt(95, 95),
      cup: pt(330, 240),
      outline: [pt(40, 60), pt(170, 60), pt(170, 200), pt(360, 200), pt(360, 275), pt(40, 275)],
      sand: [disc(100, 238, 26, 14), disc(255, 222, 16, 12)],
      powerups: [pad(135, 150, "magnet")],
      decor: [deco("moon", 270, 118, 1.5), deco("astronaut", 360, 70), deco("rocket", 22, 250, 0.7), deco("twinkle", 200, 290, 0.7)],
    }),

    // 4: the first black hole, right beside the straight line: swing wide.
    h({
      name: "Black Hole Sun",
      par: 3,
      quip: "A black hole! Too close and it eats your ball. Swing wide.",
      tee: pt(75, 165),
      cup: pt(325, 165),
      outline: [pt(40, 165), pt(110, 70), pt(290, 70), pt(360, 165), pt(290, 260), pt(110, 260)],
      water: HOLE_4.water,
      wells: [HOLE_4.well],
      powerups: [pad(200, 240, "bigcup")],
      decor: [deco("galaxy", 52, 78, 0.8), deco("ufo", 350, 62, 0.8), deco("twinkle", 60, 262), deco("astronaut", 360, 262, 0.8)],
    }),

    // 5: a U the long way round, or a wormhole from one leg to the other.
    h({
      name: "Wormhole Express",
      par: 3,
      quip: "Dive into the wormhole and pop out by the cup. Physics!",
      tee: pt(85, 85),
      cup: pt(315, 135),
      outline: [pt(40, 60), pt(130, 60), pt(130, 200), pt(270, 200), pt(270, 60), pt(360, 60), pt(360, 275), pt(40, 275)],
      tunnels: [{ a: pt(85, 175), b: pt(315, 76) }],
      bumpers: [bump(200, 238, 10, "planet")],
      powerups: [pad(130, 248, "doubloon")],
      decor: [deco("planet", 200, 128, 1.3), deco("twinkle", 385, 40), deco("comet", 30, 288, 0.7)],
    }),

    // 6: a Z, with a comet's icy tail down the middle: it slides a long way.
    h({
      name: "Comet Tail",
      par: 3,
      quip: "Ride the comet's icy tail. It's slippery out here!",
      tee: pt(75, 88),
      cup: pt(325, 238),
      outline: [pt(40, 55), pt(330, 55), pt(200, 205), pt(360, 205), pt(360, 270), pt(70, 270), pt(200, 120), pt(40, 120)],
      ice: [[pt(200, 120), pt(273, 120), pt(200, 205), pt(127, 205)]],
      bumpers: [bump(255, 82, 9, "star"), bump(160, 242, 9, "star")],
      powerups: [pad(240, 240, "spyglass")],
      decor: [deco("comet", 350, 120, 1.2), deco("planet", 62, 205, 0.9), deco("twinkle", 230, 285, 0.8), deco("twinkle", 385, 290, 0.6)],
    }),

    // 7: two flying saucers patrol the lane, beams down. Time the gap.
    h({
      name: "UFO Abduction",
      par: 3,
      quip: "UFOs on patrol! Time your putt or get beamed up.",
      tee: pt(70, 155),
      cup: pt(330, 155),
      outline: [pt(40, 110), pt(80, 70), pt(320, 70), pt(360, 110), pt(360, 200), pt(320, 240), pt(80, 240), pt(40, 200)],
      movers: [
        { x: 150, y: 155, r: 10, dx: 0, dy: 68, period: 2600, look: "ufo" },
        { x: 250, y: 155, r: 10, dx: 0, dy: 68, period: 2200, phase: 0.5, look: "ufo" },
      ],
      powerups: [pad(200, 98, "ghost")],
      decor: [deco("cow", 372, 50, 0.9), deco("alien", 30, 262), deco("twinkle", 200, 268), deco("planet", 30, 52, 0.7)],
    }),

    // 8: up a booster ramp onto a light bridge over a plasma river; too
    // soft and the ramp rolls the ball straight back.
    h({
      name: "Rocket Ramp",
      par: 4,
      quip: "Hit the booster ramp hard, or roll right back down. Zoom!",
      liquid: "plasma",
      tee: pt(60, 155),
      cup: pt(335, 205),
      outline: [pt(30, 90), pt(150, 50), pt(370, 50), pt(370, 260), pt(150, 260), pt(30, 220)],
      walls: [wall(110, 120, 170, 120), wall(110, 160, 170, 160)],
      slopes: [{ points: rect(110, 120, 60, 40), push: pt(-130, 0) }],
      water: [rect(170, 50, 70, 210)],
      bridges: [{ x: 168, y: 120, w: 74, h: 40 }],
      bumpers: [bump(290, 140, 13, "planet"), bump(318, 88, 8, "asteroid"), bump(270, 225, 9, "asteroid")],
      powerups: [pad(80, 205, "cannon")],
      decor: [deco("rocket", 22, 262, 0.8), deco("twinkle", 60, 52), deco("jelly", 205, 285, 0.7), deco("twinkle", 385, 280, 0.6)],
    }),

    // 9: a lap of Saturn's rings: over the top past a satellite, or round the
    // icy bottom through the moonlets.
    h({
      name: "Saturn's Rings",
      par: 4,
      quip: "Lap the rings of Saturn. Over the top, or the icy bottom?",
      tee: pt(65, 165),
      cup: pt(335, 165),
      outline: [pt(110, 45), pt(290, 45), pt(370, 110), pt(370, 220), pt(290, 282), pt(110, 282), pt(30, 220), pt(30, 110)],
      walls: [
        wall(150, 110, 250, 110), wall(250, 110, 290, 140), wall(290, 140, 290, 190), wall(290, 190, 250, 220),
        wall(250, 220, 150, 220), wall(150, 220, 110, 190), wall(110, 190, 110, 140), wall(110, 140, 150, 110),
      ],
      ice: [rect(140, 225, 120, 60)],
      bumpers: [bump(178, 252, 7, "asteroid"), bump(225, 246, 7, "asteroid")],
      spinners: [{ x: 200, y: 78, arm: 26, speed: 1.8, look: "satellite" }],
      powerups: [pad(75, 232, "bigcup")],
      decor: [deco("planet", 200, 165, 1.9), deco("twinkle", 25, 40), deco("moon", 378, 40, 0.6), deco("twinkle", 385, 285, 0.8)],
    }),

    // 10: a planet in the middle that pushes everything away: curve round
    // it, or blast straight over the top of its push.
    h({
      name: "Gravity Assist",
      par: 3,
      quip: "That planet pushes back! Curve around it, or punch through.",
      tee: pt(72, 165),
      cup: pt(325, 165),
      outline: [pt(40, 165), pt(200, 45), pt(360, 165), pt(200, 285)],
      wells: [{ x: 200, y: 165, r: 60, pull: -480, look: "repulsor" }],
      bumpers: [bump(265, 120, 8, "star"), bump(265, 210, 8, "star")],
      powerups: [pad(200, 255, "cannon")],
      decor: [deco("rocket", 62, 78, 0.8), deco("astronaut", 340, 72), deco("galaxy", 62, 252, 0.9), deco("satellite", 345, 258)],
    }),

    // 11: a station corridor in steps, with three airlocks cycling shut.
    h({
      name: "Airlock Alley",
      par: 3,
      quip: "Airlocks cycling! Wait for the doors, or get spaced.",
      ground: "grid",
      tee: pt(65, 100),
      cup: pt(335, 225),
      outline: [pt(30, 60), pt(240, 60), pt(240, 180), pt(370, 180), pt(370, 270), pt(160, 270), pt(160, 140), pt(30, 140)],
      gates: [
        { x1: 125, y1: 60, x2: 125, y2: 140, period: 2600, open: 0.55, offset: 0, look: "airlock" },
        { x1: 160, y1: 165, x2: 240, y2: 165, period: 2600, open: 0.55, offset: 0.33, look: "airlock" },
        { x1: 275, y1: 180, x2: 275, y2: 270, period: 2600, open: 0.55, offset: 0.66, look: "airlock" },
      ],
      powerups: [pad(200, 100, "doubloon")],
      decor: [deco("station", 315, 110), deco("astronaut", 80, 215), deco("twinkle", 30, 285, 0.7), deco("twinkle", 385, 290, 0.7)],
    }),

    // 12: a bowtie with a black hole in each wing: round the first, through
    // the waist between them, and round the second.
    h({
      name: "Event Horizon",
      par: 4,
      quip: "Two black holes! Round one, through the middle, round the other.",
      tee: pt(60, 165),
      cup: pt(340, 165),
      outline: [pt(30, 60), pt(200, 110), pt(370, 60), pt(370, 270), pt(200, 220), pt(30, 270)],
      water: [...HOLE_12A.water, ...HOLE_12B.water],
      wells: [HOLE_12A.well, HOLE_12B.well],
      powerups: [pad(85, 232, "ghost")],
      decor: [deco("galaxy", 200, 68, 0.9), deco("astronaut", 200, 262, 0.8), deco("twinkle", 385, 40, 0.8), deco("twinkle", 18, 290, 0.6)],
    }),

    // 13: meteors streak across a tilted field of moon rock and craters.
    h({
      name: "Meteor Shower",
      par: 3,
      quip: "Meteor shower! Duck, weave and dodge the falling rocks.",
      ground: "crater",
      tee: pt(75, 175),
      cup: pt(325, 150),
      outline: [pt(40, 75), pt(360, 50), pt(360, 250), pt(40, 275)],
      movers: [
        { x: 150, y: 165, r: 8, dx: 36, dy: -68, period: 2400, look: "meteor" },
        { x: 240, y: 150, r: 9, dx: -36, dy: -68, period: 3000, phase: 0.4, look: "meteor" },
      ],
      sand: [disc(190, 232, 17, 12), disc(270, 86, 15, 12)],
      powerups: [pad(110, 112, "spyglass")],
      decor: [deco("comet", 110, 38, 0.9), deco("comet", 300, 282, 0.8), deco("planet", 385, 282, 0.7), deco("twinkle", 18, 40)],
    }),

    // 14: a cross-shaped station; dock past its spinning hub and the
    // turning arm in the east wing.
    h({
      name: "Space Station",
      par: 4,
      quip: "The station spins! Slip between its arms to dock.",
      ground: "grid",
      tee: pt(200, 255),
      cup: pt(340, 165),
      outline: [
        pt(165, 40), pt(235, 40), pt(235, 130), pt(370, 130), pt(370, 200), pt(235, 200),
        pt(235, 285), pt(165, 285), pt(165, 200), pt(30, 200), pt(30, 130), pt(165, 130),
      ],
      spinners: [
        { x: 200, y: 165, arm: 30, speed: 1.3, look: "station" },
        { x: 290, y: 165, arm: 28, speed: -2, look: "satellite" },
      ],
      powerups: [pad(60, 165, "bouncy"), pad(200, 70, "doubloon")],
      decor: [deco("planet", 92, 80), deco("satellite", 310, 78), deco("moon", 92, 250, 0.9), deco("rocket", 310, 262, 0.7)],
    }),

    // 15: an arch over a blazing sun, a plasma flare across its top and a
    // light bridge over it where the solar wind blows.
    h({
      name: "Solar Flare",
      par: 3,
      quip: "Solar wind on the bridge! Cross fast or get blown off.",
      liquid: "plasma",
      tee: pt(65, 255),
      cup: pt(335, 255),
      outline: [
        ...[180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345, 360].map((a) => pt(200 + Math.cos((a * Math.PI) / 180) * 175, 275 + Math.sin((a * Math.PI) / 180) * 175)),
        ...[0, 345, 330, 315, 300, 285, 270, 255, 240, 225, 210, 195, 180].map((a) => pt(200 + Math.cos((a * Math.PI) / 180) * 95, 275 + Math.sin((a * Math.PI) / 180) * 95)),
      ],
      water: [rect(175, 90, 50, 100)],
      bridges: [{ x: 172, y: 112, w: 56, h: 28 }],
      slopes: [{ points: rect(172, 112, 56, 28), push: pt(0, 90) }],
      powerups: [pad(70, 195, "ghost")],
      decor: [deco("sun", 200, 262, 1.1), deco("twinkle", 30, 52), deco("comet", 350, 52, 0.8), deco("twinkle", 385, 150, 0.6)],
    }),

    // 16: three islands in a glowing nebula, joined by light bridges, a
    // saucer guarding the last one.
    h({
      name: "Nebula Islands",
      par: 4,
      quip: "Hop the nebula islands. Light bridges only, no swimming!",
      liquid: "plasma",
      tee: pt(65, 160),
      cup: pt(335, 215),
      outline: [pt(30, 105), pt(80, 50), pt(370, 50), pt(370, 275), pt(80, 275), pt(30, 220)],
      water: [rect(120, 40, 60, 250), rect(250, 40, 50, 250)],
      bridges: [{ x: 118, y: 220, w: 64, h: 28 }, { x: 248, y: 70, w: 54, h: 28 }],
      bumpers: [bump(215, 160, 9, "star")],
      movers: [{ x: 335, y: 145, r: 9, dx: 20, dy: 0, period: 2400, look: "ufo" }],
      powerups: [pad(70, 240, "magnet")],
      decor: [deco("jelly", 150, 120), deco("jelly", 275, 200, 0.8), deco("twinkle", 25, 40), deco("twinkle", 385, 290, 0.7)],
    }),

    // 17: a star with the cup at its heart, a friendly black hole round the
    // cup, and a pulsar shield whose sides flicker on and off in turn.
    h({
      name: "Pulsar Shield",
      par: 3,
      quip: "A pulsar shield guards the cup. Wait for a gap, then dive in!",
      tee: pt(128, 235),
      cup: pt(200, 163),
      outline: [
        pt(200, 43), pt(245.2, 118.5), pt(359.7, 125.9), pt(273.2, 180), pt(298.7, 260.1),
        pt(200, 218), pt(101.3, 260.1), pt(126.8, 180), pt(40.3, 125.9), pt(154.8, 118.5),
      ],
      wells: [{ x: 200, y: 163, r: 38, pull: 220, look: "tractor" }],
      gates: [
        { x1: 200, y1: 133, x2: 230, y2: 163, period: 2400, open: 0.3, offset: 0, look: "shield" },
        { x1: 230, y1: 163, x2: 200, y2: 193, period: 2400, open: 0.3, offset: 0.25, look: "shield" },
        { x1: 200, y1: 193, x2: 170, y2: 163, period: 2400, open: 0.3, offset: 0.5, look: "shield" },
        { x1: 170, y1: 163, x2: 200, y2: 133, period: 2400, open: 0.3, offset: 0.75, look: "shield" },
      ],
      powerups: [pad(200, 76, "bigcup")],
      decor: [deco("pulsar", 62, 62), deco("galaxy", 338, 62, 0.8), deco("alien", 200, 262), deco("planet", 345, 245, 0.8), deco("twinkle", 50, 228)],
    }),

    // 18: the mothership's spiral: past the asteroids, the solar wind and a
    // saucer, along the top past a satellite, through the airlock, and into
    // the tractor beam that pulls the ball home. A wormhole skips a lap.
    h({
      name: "Alien Mothership",
      par: 5,
      quip: "The mothership! Run the gauntlet and get beamed into the cup.",
      tee: pt(55, 252),
      cup: pt(245, 176),
      outline: [pt(20, 70), pt(380, 70), pt(380, 285), pt(20, 285)],
      walls: [wall(20, 222, 305, 222), wall(305, 222, 305, 130), wall(305, 130, 100, 130)],
      bumpers: [bump(130, 240, 9, "asteroid"), bump(250, 248, 10, "asteroid")],
      wells: [
        { x: 343, y: 254, r: 26, pull: -360, look: "repulsor" },
        { x: 245, y: 176, r: 40, pull: 320, look: "tractor" },
      ],
      movers: [{ x: 342, y: 170, r: 9, dx: 20, dy: 0, period: 2200, look: "ufo" }],
      spinners: [{ x: 200, y: 100, arm: 24, speed: 2, look: "satellite" }],
      tunnels: [{ a: pt(205, 270), b: pt(60, 100) }],
      gates: [{ x1: 20, y1: 130, x2: 100, y2: 130, period: 2600, open: 0.55, offset: 0, look: "airlock" }],
      powerups: [pad(343, 100, "doubloon"), pad(60, 185, "magnet")],
      decor: [deco("mothership", 200, 45, 0.85), deco("twinkle", 12, 292, 0.6), deco("twinkle", 390, 40, 0.7)],
    }),
  ],
});
