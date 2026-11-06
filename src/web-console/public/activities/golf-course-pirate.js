// Plan2Code Web Console - mini golf's Pirate Cove course: eighteen holes as data, in course units.
//
// Data only: no DOM. Built with golf-kit.js, which documents what a hole
// holds; listed in golf-holes.js. Greens afloat in a shark sea, wooden
// rails, barrels and cannonballs, a kraken and a ghost ship.

import { course, hole, pt, rect, wall, bump, pad, deco } from "./golf-kit.js";

const h = (def) => hole(def, { theme: "pirate", ground: "grass", liquid: "sea" });

export default course({
  id: "pirate",
  name: "Pirate Cove",
  blurb: "Sharks, cannons, a kraken and the captain's own gold.",
  cover: 4,
  voice: {
    label: "Cove",
    splash: { sea: ["SPLOOSH! Davy Jones says thanks", "Shark snack! Yum", "Man overboard!"] },
    bump: ["Bonk!", "Arr!", "Clunk!", "Yo ho!"],
    ace: "SHIVER ME TIMBERS! HOLE IN ONE!",
    turn: "Front nine plundered! Hoist the sails for the back nine...",
    done: "Yer a true buccaneer!",
    quips: {
      pickedUp: "Fed to the fishes. Next!",
      ace: "The whole crew does a jig!",
      eagle: "Captain material, that is!",
      birdie: "The parrot approves. SQUAWK!",
      par: "Shipshape and proper.",
      bogey: "Arr, nearly had it.",
      worse: "Swab the deck and try again.",
    },
  },
  holes: [
    // 1: a straight plank over the sea, to learn the putt. The sharks wait.
    h({
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
    h({
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
    h({
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
    h({
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
    h({
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
    h({
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
    h({
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
    h({
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

    // 9: an octagon round a lagoon; the mermaid sits in the middle, so the
    // putt goes round her, past a buoy or through the sand.
    h({
      name: "Mermaid Lagoon",
      par: 3,
      quip: "Don't stare at the mermaid. Round the lagoon, not through it!",
      tee: pt(70, 150),
      cup: pt(330, 150),
      outline: [pt(100, 45), pt(300, 45), pt(365, 105), pt(365, 195), pt(300, 255), pt(100, 255), pt(35, 195), pt(35, 105)],
      water: [[pt(165, 95), pt(235, 95), pt(260, 125), pt(260, 175), pt(235, 205), pt(165, 205), pt(140, 175), pt(140, 125)]],
      sand: [rect(175, 218, 50, 37)],
      bumpers: [bump(200, 70, 8, "buoy")],
      powerups: [pad(110, 205, "magnet")],
      decor: [deco("mermaid", 200, 152, 1.2), deco("gull", 70, 30, 0.8), deco("shark", 40, 272, 0.7), deco("palm", 380, 62, 0.8), deco("bottle", 372, 240)],
    }),

    // 10: a whirlpool in the middle of the green: everything near it is pulled
    // in, so the putt skirts its reach.
    h({
      name: "The Whirlpool",
      par: 3,
      quip: "Round and round she goes. Get too close and down ye go!",
      tee: pt(70, 150),
      cup: pt(330, 150),
      outline: [pt(40, 150), pt(100, 45), pt(300, 45), pt(360, 150), pt(300, 255), pt(100, 255)],
      water: [[pt(191, 128), pt(209, 128), pt(222, 141), pt(222, 159), pt(209, 172), pt(191, 172), pt(178, 159), pt(178, 141)]],
      wells: [{ x: 200, y: 150, r: 72, pull: 900 }],
      bumpers: [bump(290, 92, 7, "buoy"), bump(290, 208, 7, "buoy")],
      powerups: [pad(200, 58, "doubloon"), pad(200, 242, "bouncy")],
      decor: [deco("ship", 362, 282), deco("gull", 60, 40, 0.8), deco("shark", 42, 252, 0.8), deco("bottle", 380, 60)],
    }),

    // 11: up the mast to the crow's nest; the wind blows down the rigging, so
    // a soft putt comes straight back down.
    h({
      name: "The Crow's Nest",
      par: 3,
      quip: "Climb the rigging! Too soft and the wind blows ye back down.",
      ground: "deck",
      tee: pt(80, 245),
      cup: pt(200, 84),
      outline: [pt(45, 215), pt(180, 215), pt(180, 127), pt(115, 127), pt(115, 55), pt(285, 55), pt(285, 127), pt(220, 127), pt(220, 215), pt(355, 215), pt(355, 274), pt(45, 274)],
      slopes: [{ points: rect(180, 127, 40, 88), push: pt(0, 95) }],
      bumpers: [bump(145, 90, 8, "barrel"), bump(255, 90, 8, "barrel")],
      powerups: [pad(140, 245, "spyglass"), pad(320, 245, "cannon")],
      decor: [deco("mermaid", 100, 180), deco("lighthouse", 305, 190, 0.9), deco("parrot", 315, 85), deco("jolly", 85, 75), deco("gull", 60, 140, 0.7), deco("shark", 200, 290, 0.6)],
    }),

    // 12: a long bridge over the shark tank, and two sharks swimming right
    // across it.
    h({
      name: "Shark Tank",
      par: 3,
      quip: "Mind the sharks on the bridge. They don't bite, they BUMP.",
      tee: pt(65, 150),
      cup: pt(335, 150),
      outline: rect(30, 60, 340, 180),
      water: [rect(110, 60, 180, 180)],
      bridges: [{ x: 110, y: 128, w: 180, h: 44 }],
      movers: [
        { x: 165, y: 150, r: 9, dx: 0, dy: 68, period: 2600, look: "shark" },
        { x: 235, y: 150, r: 9, dx: 0, dy: 68, period: 3100, phase: 0.5, look: "shark" },
      ],
      powerups: [pad(75, 90, "ghost")],
      decor: [deco("shark", 200, 92, 0.8), deco("shark", 200, 212, 0.7), deco("palm", 385, 48, 0.8), deco("anchor", 15, 262), deco("jolly", 12, 72), deco("chest", 380, 262)],
    }),

    // 13: a diamond between two ships at war; cannonballs fly up and down
    // across the deck between them.
    h({
      name: "Cannon Duel",
      par: 3,
      quip: "Broadsides! Duck the cannonballs and run for the cup.",
      tee: pt(70, 150),
      cup: pt(330, 150),
      outline: [pt(30, 150), pt(200, 40), pt(370, 150), pt(200, 260)],
      movers: [
        { x: 150, y: 150, r: 7, dx: 0, dy: 70, period: 1800, look: "cannonball" },
        { x: 200, y: 150, r: 7, dx: 0, dy: 92, period: 2300, phase: 0.25, look: "cannonball" },
        { x: 250, y: 150, r: 7, dx: 0, dy: 70, period: 1800, phase: 0.5, look: "cannonball" },
      ],
      sand: [[pt(260, 150), pt(300, 128), pt(300, 172)]],
      powerups: [pad(105, 150, "cannon")],
      decor: [deco("cannon", 150, 52), deco("cannon", 250, 52), deco("cannon", 150, 250, -1), deco("cannon", 250, 250, -1), deco("ship", 62, 282), deco("ship", 340, 70), deco("jolly", 30, 60)],
    }),

    // 14: a deck of slanted planks to zigzag under, over and under again.
    h({
      name: "The Plank Maze",
      par: 4,
      quip: "Under the plank, over the plank, under the plank. Yo ho!",
      tee: pt(70, 90),
      cup: pt(330, 100),
      outline: rect(35, 45, 330, 215),
      walls: [
        wall(115, 45, 135, 200),
        wall(195, 260, 215, 105),
        wall(275, 45, 295, 200),
      ],
      movers: [{ x: 167, y: 150, r: 8, dx: 0, dy: 45, period: 2600, look: "barrel" }],
      bumpers: [bump(245, 228, 8, "barrel")],
      powerups: [pad(245, 72, "bouncy")],
      decor: [deco("jolly", 12, 40), deco("palm", 382, 62, 0.8), deco("bottle", 385, 205), deco("shark", 200, 282, 0.8), deco("gull", 120, 28, 0.7)],
    }),

    // 15: three islands in the strait; one bridge at the top, one at the
    // bottom, and a sea serpent coiled across the middle island.
    h({
      name: "Serpent Strait",
      par: 4,
      quip: "Here be serpents! Hop the islands while it isn't looking.",
      tee: pt(60, 215),
      cup: pt(335, 90),
      outline: rect(25, 45, 350, 215),
      water: [rect(100, 45, 70, 215), rect(230, 45, 70, 215)],
      bridges: [
        { x: 100, y: 70, w: 70, h: 34 },
        { x: 230, y: 200, w: 70, h: 34 },
      ],
      spinners: [{ x: 200, y: 152, arm: 42, speed: 1.7, look: "serpent" }],
      powerups: [pad(60, 140, "ghost"), pad(200, 240, "doubloon")],
      decor: [deco("bottle", 135, 180), deco("mermaid", 265, 125, 0.9), deco("tentacle", 135, 245, 0.7), deco("gull", 200, 28, 0.8)],
    }),

    // 16: the treasure vault: two iron doors slam in turn, a crab guards the
    // hall between them, and the gold waits inside.
    h({
      name: "The Treasure Vault",
      par: 4,
      quip: "The vault doors open and slam. Time it, and the gold is yours!",
      tee: pt(70, 150),
      cup: pt(330, 150),
      outline: [pt(30, 45), pt(250, 45), pt(250, 95), pt(370, 95), pt(370, 205), pt(250, 205), pt(250, 255), pt(30, 255)],
      walls: [
        wall(165, 45, 165, 122),
        wall(165, 178, 165, 255),
        wall(250, 95, 250, 128),
        wall(250, 172, 250, 205),
      ],
      gates: [
        { x1: 165, y1: 122, x2: 165, y2: 178, period: 2600, open: 0.5, offset: 0 },
        { x1: 250, y1: 128, x2: 250, y2: 172, period: 2600, open: 0.5, offset: 0.5 },
      ],
      movers: [{ x: 207, y: 150, r: 8, dx: 0, dy: 60, period: 3000, look: "crab" }],
      bumpers: [bump(298, 118, 8, "coin"), bump(298, 182, 8, "coin"), bump(352, 150, 7, "chest")],
      powerups: [pad(60, 70, "doubloon"), pad(207, 238, "bigcup")],
      decor: [deco("jolly", 300, 72), deco("chest", 330, 76), deco("parrot", 305, 240), deco("anchor", 345, 240), deco("shark", 200, 282, 0.7), deco("palm", 20, 280, 0.7)],
    }),

    // 17: Davy Jones' locker: a whirlpool by the tee, a deep channel with
    // one bridge, and a second whirlpool guarding the cup.
    h({
      name: "Davy Jones' Locker",
      par: 5,
      quip: "Two whirlpools, one bridge, no mercy. Davy Jones awaits!",
      tee: pt(65, 75),
      cup: pt(330, 84),
      outline: rect(25, 40, 350, 225),
      water: [
        rect(150, 40, 100, 225),
        [pt(88, 159), pt(102, 159), pt(111, 168), pt(111, 182), pt(102, 191), pt(88, 191), pt(79, 182), pt(79, 168)],
        [pt(305, 149), pt(319, 149), pt(328, 158), pt(328, 172), pt(319, 181), pt(305, 181), pt(296, 172), pt(296, 158)],
      ],
      wells: [
        { x: 95, y: 175, r: 50, pull: 900 },
        { x: 312, y: 165, r: 50, pull: 900 },
      ],
      bridges: [{ x: 150, y: 205, w: 100, h: 36 }],
      movers: [{ x: 312, y: 114, r: 7, dx: 36, dy: 0, period: 2800, look: "crab" }],
      powerups: [pad(110, 60, "spyglass"), pad(345, 240, "magnet")],
      decor: [deco("tentacle", 200, 100), deco("tentacle", 185, 160, 0.8), deco("ghost", 200, 70, 0.9), deco("skullrock", 200, 300), deco("jolly", 385, 50)],
    }),

    // 18: up the ramp, over the bridge, through the gold to the cup.
    h({
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

  ],
});
