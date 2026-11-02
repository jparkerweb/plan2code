// Plan2Code Web Console - mini golf's Caves of Doom course: eighteen holes as data, in course units.
//
// Data only: no DOM. Built with golf-kit.js, which documents what a hole
// holds; listed in golf-holes.js. Mossy stone in the dark, glowing
// pools, lava, a bottomless pit, mine carts, crushers and a sleeping dragon.

import { course, hole, pt, rect, wall, bump, pad, deco } from "./golf-kit.js";

const h = (def) => hole(def, { theme: "cave", ground: "moss", liquid: "pool" });

export default course({
  id: "cave",
  name: "Caves of Doom",
  blurb: "Lava, mine carts, crushers and a sleeping dragon, all in the dark.",
  cover: 2,
  voice: {
    label: "Cave",
    splash: {
      pool: ["Bloop!", "Glub glub glub", "Something down there liked that"],
      lava: ["SIZZLE! Extra crispy", "Toasty!", "Marshmallow, anyone?"],
      chasm: ["Aaaaaaaaa...", "Bye bye, ball!", "Still falling..."],
    },
    bump: ["Boing!", "Clang!", "Ping!", "Bwomp!"],
    ace: "HOLE IN ONE! The cave echoes: one... one... one...",
    turn: "Halfway down! Grab a fresh torch: it only gets darker...",
    done: "You survived!",
    quips: {
      pickedUp: "The cave keeps that one. Forever.",
      ace: "The bats are applauding. Eerily.",
      eagle: "Legendary! The dragon stirs...",
      birdie: "A birdie! Well, a bat. Close enough.",
      par: "Steady as stone.",
      bogey: "The skeletons chuckle softly.",
      worse: "Did something in the dark just laugh?",
    },
  },
  holes: [
    // 1: a winding passage into the dark past a glowing pool, a mushroom on
    // the bend.
    h({
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

    // 2: a forest of stalagmites, with gaps a ball can thread.
    h({
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

    // 3: a lava lake wall to wall, two thin stone bridges, and a fireball
    // bobbing up and down across both of them.
    h({
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

    // 4: three mine carts rattle up and down across the straight line.
    h({
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

    // 5: crystals everywhere and two slingshot walls: pure pinball.
    h({
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

    // 6: a bottomless pit wall to wall, one rope bridge over it, and an
    // updraft blowing across the bridge.
    h({
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

    // 7: a winding grotto; the glowworm current carries the ball up and over.
    h({
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

    // 8: a corridor of stone crushers slamming down in turn, lava in its
    // corners.
    h({
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

    // 9: a frozen grotto: a sheet of ice that barely slows the ball, crystals
    // on it, and glowing pools in the far corners for whoever slides too far.
    h({
      name: "The Frozen Grotto",
      par: 3,
      quip: "Brrr! The ice keeps it sliding. A tap goes a LONG way.",
      tee: pt(60, 150),
      cup: pt(335, 150),
      outline: [pt(30, 150), pt(90, 55), pt(310, 55), pt(370, 150), pt(310, 245), pt(90, 245)],
      ice: [rect(100, 55, 190, 190)],
      water: [
        [pt(290, 55), pt(310, 55), pt(340, 103), pt(290, 103)],
        [pt(290, 197), pt(340, 197), pt(310, 245), pt(290, 245)],
      ],
      bumpers: [bump(165, 105, 9, "crystal"), bump(165, 195, 9, "crystal"), bump(230, 150, 11, "crystal")],
      powerups: [pad(200, 75, "magnet")],
      decor: [deco("icicles", 110, 52), deco("icicles", 220, 52, 1.1), deco("icicles", 150, 272, 0.9), deco("icicles", 280, 272), deco("stalactite", 330, 0, 0.9), deco("bat", 200, 280, 0.6), deco("eyes", 30, 60, 0.8)],
    }),

    // 10: an underground river runs across the cave and down into a pool;
    // a soft putt rides the current to a splash.
    h({
      name: "Underground River",
      par: 3,
      quip: "The river runs downhill into the pool. Cross it with gusto!",
      tee: pt(70, 230),
      cup: pt(330, 80),
      outline: rect(30, 45, 340, 215),
      slopes: [{ points: rect(150, 45, 100, 165), push: pt(0, 150) }],
      water: [rect(150, 210, 100, 50)],
      bumpers: [bump(95, 130, 9, "mushroom"), bump(305, 175, 9, "mushroom")],
      powerups: [pad(105, 75, "spyglass"), pad(300, 235, "doubloon")],
      decor: [deco("glowworms", 200, 278), deco("torch", 18, 110), deco("torch", 382, 200), deco("mushroom", 18, 265), deco("crystal", 385, 60, 0.8), deco("stalactite", 90, 0)],
    }),

    // 11: a figure eight of two caverns joined by a narrow neck, with bats
    // flapping their beats across both and through the neck.
    h({
      name: "Bat Cavern",
      par: 3,
      quip: "Shh, the bats are... nope, they're awake. Duck!",
      tee: pt(70, 150),
      cup: pt(330, 150),
      outline: [pt(65, 60), pt(160, 60), pt(200, 112), pt(240, 60), pt(335, 60), pt(370, 100), pt(370, 200), pt(335, 240), pt(240, 240), pt(200, 188), pt(160, 240), pt(65, 240), pt(30, 200), pt(30, 100)],
      movers: [
        { x: 200, y: 150, r: 9, dx: 0, dy: 28, period: 2000, look: "bat" },
        { x: 122, y: 150, r: 8, dx: 32, dy: 50, period: 3000, look: "bat" },
        { x: 285, y: 150, r: 8, dx: -35, dy: 45, period: 2600, phase: 0.3, look: "bat" },
      ],
      powerups: [pad(120, 215, "magnet")],
      decor: [deco("eyes", 200, 82), deco("eyes", 200, 220, 0.8), deco("bat", 200, 270, 0.7), deco("stalactite", 110, 0), deco("stalactite", 290, 0, 0.9), deco("crystal", 385, 255, 0.8), deco("torch", 15, 150)],
    }),

    // 12: a garden of giant mushrooms: spore puffs blow the ball away, and the
    // caps bounce it about.
    h({
      name: "Mushroom Garden",
      par: 3,
      quip: "PFFT! The spore puffs blow you off course. Fun guys, these.",
      tee: pt(65, 150),
      cup: pt(335, 150),
      outline: [pt(70, 50), pt(330, 50), pt(370, 95), pt(370, 205), pt(330, 250), pt(70, 250), pt(30, 205), pt(30, 95)],
      wells: [
        { x: 150, y: 110, r: 34, pull: -900 },
        { x: 150, y: 190, r: 34, pull: -900 },
        { x: 250, y: 150, r: 34, pull: -900 },
      ],
      bumpers: [
        bump(200, 72, 9, "mushroom"), bump(200, 228, 9, "mushroom"),
        bump(300, 95, 9, "mushroom"), bump(300, 205, 9, "mushroom"),
        bump(100, 78, 8, "mushroom"), bump(100, 222, 8, "mushroom"),
      ],
      powerups: [pad(200, 150, "bouncy")],
      decor: [deco("mushroom", 20, 60), deco("mushroom", 385, 250), deco("mushroom", 18, 255), deco("glowworms", 200, 280), deco("eyes", 385, 60, 0.7), deco("bat", 200, 25, 0.6)],
    }),

    // 13: two mine galleries, one above the other: ride the lift up the shaft,
    // or take the elevator portal, past the mine carts.
    h({
      name: "Mine Shaft Elevator",
      par: 3,
      quip: "Going up! Take the lift, or the elevator if you're brave.",
      ground: "stone",
      tee: pt(65, 225),
      cup: pt(335, 80),
      outline: [pt(30, 45), pt(370, 45), pt(370, 115), pt(80, 115), pt(80, 185), pt(370, 185), pt(370, 260), pt(30, 260)],
      slopes: [{ points: rect(30, 125, 50, 50), push: pt(0, -110) }],
      tunnels: [{ a: pt(205, 222), b: pt(120, 80) }],
      movers: [
        { x: 135, y: 222, r: 10, dx: 0, dy: 24, period: 2000, look: "cart" },
        { x: 260, y: 80, r: 10, dx: 0, dy: 22, period: 2200, phase: 0.4, look: "cart" },
      ],
      powerups: [pad(300, 225, "cannon")],
      decor: [deco("torch", 120, 158), deco("gems", 200, 155), deco("skeleton", 280, 150), deco("torch", 350, 158), deco("stalactite", 220, 0, 0.9), deco("bat", 200, 280, 0.6)],
    }),

    // 14: a hall of crystal shards: a chevron to thread, a big crystal behind
    // it, and a shard wall in front of the cup to bank around.
    h({
      name: "The Crystal Maze",
      par: 3,
      quip: "Shiny! Thread the shards, bank off the corners, find the cup.",
      tee: pt(60, 150),
      cup: pt(335, 150),
      outline: rect(30, 45, 340, 215),
      walls: [
        wall(110, 95, 150, 135),
        wall(110, 205, 150, 165),
        wall(270, 100, 270, 200),
        wall(325, 45, 370, 90),
        wall(325, 260, 370, 215),
      ],
      bumpers: [bump(200, 150, 13, "crystal"), bump(230, 72, 8, "crystal"), bump(230, 233, 8, "crystal")],
      powerups: [pad(75, 85, "spyglass"), pad(75, 215, "bouncy")],
      decor: [deco("crystal", 15, 275), deco("crystal", 385, 40, 0.9), deco("crystal", 388, 280, 0.8), deco("bat", 200, 282, 0.7), deco("stalactite", 110, 0), deco("stalactite", 290, 0, 1.1)],
    }),

    // 15: the goblin market: an arch round the stalls, a cart on the top row,
    // a rug of dust to cross, and the market gate that slams.
    h({
      name: "The Goblin Market",
      par: 4,
      quip: "Psst! Gems, cheap! Mind the cart, the rug and the gate.",
      tee: pt(75, 230),
      cup: pt(325, 230),
      outline: [pt(30, 262), pt(30, 45), pt(370, 45), pt(370, 262), pt(280, 262), pt(280, 130), pt(120, 130), pt(120, 262)],
      walls: [
        wall(30, 95, 80, 45),
        wall(320, 45, 370, 95),
      ],
      sand: [rect(30, 150, 90, 28)],
      movers: [{ x: 200, y: 90, r: 10, dx: 70, dy: 0, period: 3400, look: "cart" }],
      gates: [{ x1: 280, y1: 160, x2: 370, y2: 160, period: 2400, open: 0.55 }],
      bumpers: [bump(200, 118, 7, "skull")],
      powerups: [pad(200, 60, "doubloon"), pad(75, 115, "bigcup")],
      decor: [deco("goblin", 162, 222), deco("goblin", 240, 222, 0.9), deco("gems", 200, 250), deco("torch", 200, 165), deco("eyes", 200, 196, 0.7), deco("stalactite", 330, 0, 0.8)],
    }),

    // 16: rope bridges over a bottomless pit that turn two corners: stop on
    // each corner, or fall.
    h({
      name: "The Rickety Rope Walk",
      par: 4,
      quip: "Rope bridges with corners. Who builds these?! Stop, turn, go.",
      liquid: "chasm",
      ground: "stone",
      tee: pt(60, 207),
      cup: pt(335, 93),
      outline: rect(30, 45, 340, 215),
      water: [rect(100, 45, 200, 215)],
      bridges: [
        { x: 100, y: 190, w: 90, h: 34 },
        { x: 156, y: 76, w: 34, h: 148 },
        { x: 156, y: 76, w: 144, h: 34 },
      ],
      powerups: [pad(60, 110, "ghost")],
      decor: [deco("eyes", 245, 180), deco("eyes", 125, 120, 0.8), deco("eyes", 250, 245, 0.6), deco("torch", 18, 207), deco("torch", 382, 93), deco("stalactite", 240, 0), deco("bat", 200, 280, 0.7)],
    }),

    // 17: the spider's lair: a spiral of passages, sticky webs in the corners,
    // spiders dropping in, and a web at the center pulling into the cup. A
    // portal cuts straight there, for the brave.
    h({
      name: "The Spider's Lair",
      par: 5,
      quip: "Welcome to my parlor, said the spider. Webs are sticky!",
      tee: pt(55, 232),
      cup: pt(240, 150),
      outline: rect(25, 40, 350, 220),
      walls: [
        wall(85, 95, 315, 95),
        wall(315, 95, 315, 205),
        wall(85, 205, 315, 205),
        wall(85, 95, 85, 150),
        wall(25, 205, 85, 205),
      ],
      sand: [rect(315, 205, 60, 55), rect(25, 40, 60, 55)],
      wells: [{ x: 240, y: 150, r: 45, pull: 500 }],
      tunnels: [{ a: pt(205, 232), b: pt(55, 178) }],
      movers: [
        { x: 140, y: 232, r: 8, dx: 0, dy: 16, period: 1500, look: "spider" },
        { x: 345, y: 150, r: 8, dx: 0, dy: 40, period: 2600, look: "spider" },
        { x: 200, y: 67, r: 8, dx: 0, dy: 14, period: 1900, phase: 0.5, look: "spider" },
      ],
      powerups: [pad(100, 232, "spyglass"), pad(130, 150, "magnet")],
      decor: [deco("web", 345, 232), deco("web", 55, 67), deco("web", 240, 150), deco("skeleton", 140, 280), deco("eyes", 385, 280, 0.7), deco("torch", 388, 120)],
    }),

    // 18: the dragon's hoard: a lava lake, a portal over it, the dragon's tail
    // sweeping, gold everywhere, and the dragon himself asleep at the edge.
    h({
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
  ],
});
