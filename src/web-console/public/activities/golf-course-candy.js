// Plan2Code Web Console - mini golf's Candy Carnival course: eighteen holes as data, in course units.
//
// Data only: no DOM. Built with golf-kit.js, which documents what a hole
// holds; listed in golf-holes.js; drawn with golf-look-candy.js. Frosting
// greens on a sugar-sky fairground, candy cane rails, gumdrops and gummy
// bears, caramel traps, a hard-candy glaze, a soda whirlpool, licorice
// conveyors and a chocolate fountain to finish.

import { course, hole, pt, rect, wall, bump, pad, deco } from "./golf-kit.js";

const h = (def) => hole(def, { theme: "candy", ground: "frosting", liquid: "chocolate" });

// A round pool as a polygon: `n` points on a circle.
const ring = (x, y, r, n = 14) => Array.from({ length: n }, (_, i) => pt(Math.round((x + Math.cos((i / n) * Math.PI * 2) * r) * 10) / 10, Math.round((y + Math.sin((i / n) * Math.PI * 2) * r) * 10) / 10));

// A heart, its dip at the top center: the classic curve, sx and sy units a step.
const heart = (x, y, sx, sy, n = 32) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2;
  return pt(Math.round(x + sx * 16 * Math.sin(a) ** 3), Math.round(y - sy * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a))));
});

export default course({
  id: "candy",
  name: "Candy Carnival",
  blurb: "Gummy bears, a soda whirlpool and a chocolate fountain. Yum!",
  cover: 17,
  voice: {
    label: "Treat",
    splash: {
      chocolate: ["SPLORCH! Chocolate-dipped", "Into the fudge!", "Mmm, extra chocolatey"],
      soda: ["FIZZ! Down the soda", "Glug glug, POP!", "Sugar rush, splash!"],
    },
    bump: ["Boing!", "Sproing!", "Squish!", "Pop!"],
    ace: "SWEET! HOLE IN ONE!",
    turn: "Front nine devoured! Save room for dessert...",
    done: "You're one smart cookie!",
    quips: {
      pickedUp: "That one melted. On to the next treat!",
      ace: "Sprinkles for everyone!",
      eagle: "The sweetest putt at the carnival!",
      birdie: "A sugar-coated birdie!",
      par: "Sweet and steady.",
      bogey: "A little half-baked.",
      worse: "Ooh, that one was sour.",
    },
  },
  holes: [
    // 1: a slanted frosting lane between two gumdrops, to learn the putt.
    h({
      name: "Sugar Rush Lane",
      par: 2,
      quip: "Welcome to the Candy Carnival! Putt it down the frosting.",
      tee: pt(95, 162),
      cup: pt(312, 138),
      outline: [pt(50, 125), pt(330, 100), pt(355, 175), pt(75, 200)],
      bumpers: [bump(180, 125, 8, "gumdrop"), bump(240, 170, 8, "gumdrop")],
      decor: [deco("lollipop", 60, 70), deco("cupcake", 130, 245), deco("cone", 260, 250), deco("balloon", 360, 60), deco("cane", 30, 240), deco("cloud", 210, 55, 0.9)],
    }),

    // 2: an L with a slanted bend, a gumdrop on the corner and a gold coin
    // chocolate in the far corner for whoever banks it there.
    h({
      name: "Gumdrop Bend",
      par: 3,
      quip: "Bank it round the bend. That chocolate coin makes a putt free!",
      tee: pt(75, 228),
      cup: pt(305, 85),
      outline: [pt(40, 190), pt(225, 190), pt(255, 45), pt(350, 45), pt(350, 230), pt(315, 265), pt(40, 265)],
      bumpers: [bump(302, 165, 10, "gumdrop"), bump(180, 228, 8, "gumdrop")],
      powerups: [pad(300, 232, "doubloon")],
      decor: [deco("gingerman", 140, 140), deco("lollipop", 60, 95, 1.1), deco("cupcake", 200, 95), deco("cone", 378, 160), deco("cloud", 110, 45, 0.8)],
    }),

    // 3: two slanted caramel puddles across the straight line; weave between
    // them, and the map beyond the second makes the cup huge.
    h({
      name: "Caramel Crossing",
      par: 3,
      quip: "Sticky caramel! Weave between the puddles, don't wade.",
      tee: pt(75, 150),
      cup: pt(322, 150),
      outline: [pt(70, 70), pt(330, 70), pt(360, 100), pt(360, 200), pt(330, 230), pt(70, 230), pt(40, 200), pt(40, 100)],
      sand: [
        [pt(130, 70), pt(175, 70), pt(205, 165), pt(160, 165)],
        [pt(215, 135), pt(260, 135), pt(290, 230), pt(245, 230)],
      ],
      bumpers: [bump(232, 95, 10, "donut")],
      powerups: [pad(300, 205, "bigcup")],
      decor: [deco("wrapped", 60, 45), deco("wrapped", 345, 262, 0.9), deco("donut", 200, 262), deco("lollipop", 380, 60), deco("cane", 20, 140)],
    }),

    // 4: a long U the slow way round past a gummy bear, or the licorice pipe
    // straight across to the top of the far arm.
    h({
      name: "Licorice Loop",
      par: 3,
      quip: "Into the licorice pipe and out the other side. Wheee!",
      tee: pt(77, 70),
      cup: pt(322, 172),
      outline: [pt(40, 45), pt(115, 45), pt(115, 195), pt(285, 195), pt(285, 45), pt(360, 45), pt(360, 265), pt(40, 265)],
      tunnels: [{ a: pt(77, 165), b: pt(322, 75) }],
      movers: [{ x: 200, y: 232, r: 9, dx: 60, dy: 0, period: 3000, look: "gummy" }],
      powerups: [pad(150, 248, "magnet")],
      decor: [deco("gingerhouse", 200, 120), deco("cupcake", 150, 75, 0.8), deco("cupcake", 250, 75, 0.8), deco("cane", 380, 230)],
    }),

    // 5: a chocolate river wall to wall; a wafer bridge is the only dry way
    // over, and a gummy bear patrols it.
    h({
      name: "Chocolate River",
      par: 3,
      quip: "A river of chocolate! Cross the wafer, mind the gummy bear.",
      tee: pt(85, 150),
      cup: pt(315, 150),
      outline: [pt(40, 150), pt(80, 60), pt(320, 60), pt(360, 150), pt(320, 240), pt(80, 240)],
      water: [[pt(170, 40), pt(230, 40), pt(242, 100), pt(232, 150), pt(244, 200), pt(228, 260), pt(166, 260), pt(178, 200), pt(166, 150), pt(176, 100)]],
      bridges: [{ x: 156, y: 132, w: 98, h: 36 }],
      movers: [{ x: 205, y: 150, r: 7, dx: 0, dy: 12, period: 2400, look: "gummy" }],
      bumpers: [bump(282, 108, 8, "lollipop"), bump(282, 192, 8, "lollipop")],
      decor: [deco("peppermint", 205, 38, 0.9), deco("peppermint", 205, 266, 0.9), deco("cone", 40, 60), deco("cupcake", 365, 245), deco("balloon", 370, 70, 0.9)],
    }),

    // 6: a diamond split by a candy wall; a peppermint pinwheel turns in the
    // only gap.
    h({
      name: "Peppermint Pinwheel",
      par: 3,
      quip: "Time your putt through the spinning peppermint!",
      tee: pt(95, 150),
      cup: pt(305, 150),
      outline: [pt(55, 150), pt(200, 42), pt(345, 150), pt(200, 262)],
      walls: [wall(200, 42, 200, 112), wall(200, 188, 200, 262)],
      spinners: [{ x: 200, y: 150, arm: 34, speed: 1.8, look: "pinwheel" }],
      powerups: [pad(150, 115, "bouncy")],
      decor: [deco("lollipop", 60, 60, 1.1), deco("lollipop", 340, 245, 1.1), deco("cupcake", 75, 250), deco("cone", 330, 60), deco("wrapped", 380, 150, 0.9), deco("wrapped", 20, 150, 0.9)],
    }),

    // 7: a Z over hard-candy glaze: the ball barely slows on it, so a firm
    // putt slides right past the bend.
    h({
      name: "Hard Candy Glaze",
      par: 3,
      quip: "Slippery glaze! Barely a tap and it slides forever.",
      tee: pt(70, 75),
      cup: pt(322, 230),
      outline: [pt(40, 45), pt(340, 45), pt(340, 105), pt(160, 200), pt(360, 200), pt(360, 260), pt(60, 260), pt(60, 200), pt(240, 105), pt(40, 105)],
      ice: [rect(140, 45, 200, 60), rect(60, 200, 210, 60)],
      bumpers: [bump(323, 62, 8, "gumball")],
      powerups: [pad(95, 230, "spyglass")],
      decor: [deco("cone", 60, 160, 1.1), deco("cupcake", 120, 150), deco("lollipop", 330, 150, 1.1), deco("cane", 385, 100), deco("balloon", 22, 250, 0.9)],
    }),

    // 8: a gummy bear parade marching up and down across the straight line.
    h({
      name: "Gummy Bear Parade",
      par: 3,
      quip: "The gummy bears are on parade! Squeeze through the gaps.",
      tee: pt(70, 150),
      cup: pt(335, 150),
      outline: [pt(40, 90), pt(80, 50), pt(320, 50), pt(360, 90), pt(360, 210), pt(320, 250), pt(80, 250), pt(40, 210)],
      movers: [
        { x: 140, y: 150, r: 10, dx: 0, dy: 75, period: 2200, look: "gummy" },
        { x: 210, y: 150, r: 11, dx: 0, dy: 75, period: 2700, phase: 0.35, look: "gummy" },
        { x: 280, y: 150, r: 12, dx: 0, dy: 75, period: 2000, phase: 0.7, look: "gummy" },
      ],
      powerups: [pad(78, 82, "cannon")],
      decor: [deco("tent", 200, 285), deco("balloon", 30, 45), deco("balloon", 375, 255, 0.9), deco("cupcake", 375, 45, 0.8), deco("cane", 22, 260)],
    }),

    // 9: the gingerbread house: the waffle door slams open and shut, and a
    // gingerbread man paces the attic where the cup hides.
    h({
      name: "Gingerbread House",
      par: 4,
      quip: "Knock knock! Slip through the waffle door while it's open.",
      tee: pt(85, 238),
      cup: pt(200, 95),
      outline: [pt(50, 140), pt(200, 42), pt(350, 140), pt(350, 265), pt(50, 265)],
      walls: [wall(50, 150, 165, 150), wall(235, 150, 350, 150)],
      gates: [{ x1: 165, y1: 150, x2: 235, y2: 150, period: 2600, open: 0.5, look: "waffle" }],
      sand: [rect(150, 218, 100, 47)],
      bumpers: [bump(125, 195, 9, "gumdrop"), bump(275, 195, 9, "gumdrop")],
      movers: [{ x: 200, y: 128, r: 7, dx: 45, dy: 0, period: 3200, look: "gingerman" }],
      powerups: [pad(318, 238, "doubloon")],
      decor: [deco("cane", 40, 120, 1.2), deco("cane", 360, 120, 1.2), deco("lollipop", 30, 255), deco("lollipop", 372, 255), deco("cupcake", 90, 60), deco("cupcake", 310, 60)],
    }),

    // 10: cotton candy islands in a strawberry soda sea, joined by two wafers.
    // The ghost ball floats straight across.
    h({
      name: "Cotton Candy Isles",
      par: 3,
      quip: "Island hopping on cotton candy! Wafer, wafer, cup.",
      ground: "cotton",
      liquid: "soda",
      tee: pt(75, 150),
      cup: pt(325, 150),
      outline: [pt(35, 80), pt(60, 55), pt(340, 55), pt(365, 80), pt(365, 230), pt(340, 255), pt(60, 255), pt(35, 230)],
      water: [
        [pt(130, 40), pt(170, 40), pt(160, 100), pt(175, 160), pt(165, 270), pt(125, 270), pt(135, 160), pt(122, 100)],
        [pt(240, 40), pt(282, 40), pt(272, 100), pt(285, 160), pt(278, 270), pt(238, 270), pt(246, 160), pt(232, 100)],
      ],
      bridges: [{ x: 120, y: 190, w: 60, h: 30 }, { x: 226, y: 80, w: 64, h: 30 }],
      bumpers: [bump(205, 150, 9, "gumdrop")],
      powerups: [pad(85, 220, "ghost")],
      decor: [deco("cloud", 100, 30), deco("cloud", 300, 280, 1.1), deco("balloon", 20, 150), deco("balloon", 385, 140, 0.9), deco("wrapped", 200, 280)],
    }),

    // 11: a soda whirlpool in the middle pulls in anything that strays close;
    // round it by the rails.
    h({
      name: "Soda Whirlpool",
      par: 3,
      quip: "The soda whirlpool is thirsty. Don't feed it your ball!",
      ground: "grape",
      liquid: "soda",
      tee: pt(70, 150),
      cup: pt(330, 150),
      outline: [pt(80, 50), pt(320, 50), pt(365, 95), pt(365, 205), pt(320, 250), pt(80, 250), pt(35, 205), pt(35, 95)],
      water: [ring(200, 150, 18)],
      wells: [{ x: 200, y: 150, r: 60, pull: 1100, look: "whirl" }],
      bumpers: [bump(125, 80, 9, "donut"), bump(275, 220, 9, "donut")],
      powerups: [pad(200, 236, "magnet")],
      decor: [deco("wrapped", 30, 50), deco("wrapped", 372, 252), deco("cone", 380, 60), deco("cupcake", 25, 255), deco("balloon", 200, 285, 0.8)],
    }),

    // 12: three licorice conveyor belts across the lane, pushing up and down
    // into chocolate: putt firm enough to ride over them.
    h({
      name: "Licorice Conveyor",
      par: 3,
      quip: "Conveyor belts! Too slow and they dump you in the chocolate.",
      ground: "waffle",
      tee: pt(72, 150),
      cup: pt(330, 150),
      outline: [pt(35, 150), pt(75, 68), pt(325, 68), pt(365, 150), pt(325, 232), pt(75, 232)],
      water: [rect(110, 60, 200, 30), rect(110, 210, 200, 30)],
      slopes: [
        { points: rect(130, 90, 34, 120), push: pt(0, -110) },
        { points: rect(193, 90, 34, 120), push: pt(0, 110) },
        { points: rect(256, 90, 34, 120), push: pt(0, -110) },
      ],
      powerups: [pad(95, 120, "cannon")],
      decor: [deco("gingerman", 30, 60), deco("gingerman", 370, 245, -1), deco("cupcake", 210, 270), deco("lollipop", 380, 50), deco("cane", 20, 260)],
    }),

    // 13: a diagonal waffle-iron run: three presses slam shut in turn.
    h({
      name: "Waffle Iron Works",
      par: 3,
      quip: "CRUNCH! The waffle irons slam in turn. Time it!",
      ground: "waffle",
      tee: pt(80, 230),
      cup: pt(318, 102),
      outline: [pt(28, 212), pt(334, 48), pt(372, 118), pt(66, 282)],
      gates: [
        { x1: 124.2, y1: 158, x2: 163.8, y2: 232, period: 2400, open: 0.55, offset: 0, look: "waffle" },
        { x1: 180.2, y1: 128, x2: 219.8, y2: 202, period: 2400, open: 0.55, offset: 0.33, look: "waffle" },
        { x1: 236.2, y1: 98, x2: 275.8, y2: 172, period: 2400, open: 0.55, offset: 0.66, look: "waffle" },
      ],
      powerups: [pad(184, 202, "doubloon")],
      decor: [deco("cupcake", 70, 80), deco("cone", 130, 60, 1.1), deco("donut", 300, 230), deco("lollipop", 360, 190), deco("cloud", 230, 270, 0.9), deco("wrapped", 30, 280, 0.9)],
    }),

    // 14: a heart. Its dip blocks the straight putt from lobe to lobe, so bank
    // it round the bottom past the gummy bear and the sprinkles.
    h({
      name: "Sweetheart",
      par: 3,
      quip: "Love at first putt! Round the bottom of the heart.",
      ground: "cotton",
      tee: pt(110, 95),
      cup: pt(290, 95),
      outline: heart(200, 148, 10, 8),
      sand: [[pt(160, 222), pt(240, 222), pt(200, 284)]],
      bumpers: [bump(200, 152, 12, "heart")],
      movers: [{ x: 200, y: 192, r: 8, dx: 45, dy: 0, period: 2600, look: "gummy" }],
      powerups: [pad(105, 160, "magnet")],
      decor: [deco("lollipop", 40, 215, 1.1), deco("lollipop", 360, 215, 1.1), deco("cupcake", 110, 270), deco("cupcake", 290, 270), deco("wrapped", 200, 45, 0.8)],
    }),

    // 15: a gumball machine's globe full of gumballs: pure pinball, tee at the
    // bottom and the cup up top.
    h({
      name: "Gumball Machine",
      par: 3,
      quip: "Ding ding! Bounce through the gumballs to the top.",
      ground: "grape",
      tee: pt(200, 242),
      cup: pt(200, 78),
      outline: ring(200, 156, 112, 20),
      bumpers: [
        bump(200, 152, 13, "gumball"),
        bump(155, 120, 9, "gumball"),
        bump(245, 120, 9, "gumball"),
        bump(148, 190, 9, "gumball"),
        bump(252, 190, 9, "gumball"),
        bump(200, 110, 8, "gumball"),
        bump(118, 150, 7, "gumball"),
        bump(282, 150, 7, "gumball"),
      ],
      powerups: [pad(200, 196, "bouncy")],
      decor: [deco("cupcake", 40, 60), deco("cone", 360, 70, 1.1), deco("lollipop", 45, 260, 1.1), deco("cane", 360, 250, 1.2), deco("balloon", 385, 165, 0.8)],
    }),

    // 16: an S of three lanes; a candy cane spins at each turn.
    h({
      name: "Candy Cane Twister",
      par: 4,
      quip: "Two candy canes twirl at the turns. Don't get swatted!",
      tee: pt(70, 82),
      cup: pt(325, 228),
      outline: [pt(55, 45), pt(345, 45), pt(365, 65), pt(365, 245), pt(345, 265), pt(55, 265), pt(35, 245), pt(35, 65)],
      walls: [wall(35, 118, 280, 118), wall(120, 192, 365, 192)],
      spinners: [
        { x: 322, y: 118, arm: 34, speed: 2, look: "candycane" },
        { x: 78, y: 192, arm: 34, speed: -2, look: "candycane" },
      ],
      bumpers: [bump(200, 140, 8, "gumdrop"), bump(160, 170, 8, "gumdrop"), bump(245, 168, 8, "gumdrop")],
      sand: [rect(185, 210, 55, 55)],
      powerups: [pad(240, 82, "spyglass")],
      decor: [deco("balloon", 15, 150), deco("cane", 388, 280, 1.1), deco("peppermint", 386, 150), deco("peppermint", 15, 285), deco("cloud", 200, 287, 0.8)],
    }),

    // 17: a candy-wrapper bowtie: soda sinkholes slurp at the pinch and in
    // the far lobe, and a sugar swirl round the cup pulls a near miss in.
    h({
      name: "Fizzy Sinkholes",
      par: 3,
      quip: "Soda sinkholes slurp up strays. The sugar swirl pulls you in!",
      liquid: "soda",
      tee: pt(65, 150),
      cup: pt(325, 150),
      outline: [pt(35, 45), pt(150, 85), pt(250, 85), pt(365, 45), pt(365, 255), pt(250, 215), pt(150, 215), pt(35, 255)],
      water: [ring(200, 150, 11, 12), ring(285, 110, 9, 12)],
      wells: [
        { x: 200, y: 150, r: 30, pull: 900, look: "whirl" },
        { x: 285, y: 110, r: 26, pull: 900, look: "whirl" },
        { x: 325, y: 150, r: 26, pull: 900, look: "sugar" },
      ],
      bumpers: [bump(100, 102, 8, "gumdrop"), bump(100, 198, 8, "gumdrop"), bump(292, 202, 8, "lollipop")],
      powerups: [pad(118, 150, "spyglass")],
      decor: [deco("wrapped", 200, 58, 1.2), deco("wrapped", 200, 244, 1.2), deco("cupcake", 20, 275, 0.8), deco("cone", 382, 272), deco("balloon", 15, 150, 0.9)],
    }),

    // 18: the chocolate fountain: a river splits the green round the fountain
    // and its pull; over the wafer, past the gummy bear, through the
    // peppermint to the cup. The ghost ball floats across.
    h({
      name: "Chocolate Fountain",
      par: 5,
      quip: "The grand finale! A chocolate fountain. Try not to get dipped.",
      tee: pt(62, 245),
      cup: pt(322, 222),
      outline: [pt(25, 70), pt(55, 40), pt(345, 40), pt(375, 70), pt(375, 245), pt(345, 275), pt(55, 275), pt(25, 245)],
      water: [rect(185, 30, 30, 130), ring(200, 160, 34, 24), rect(185, 160, 30, 125)],
      wells: [{ x: 200, y: 160, r: 62, pull: 1000, look: "whirl" }],
      bridges: [{ x: 172, y: 48, w: 56, h: 28 }],
      walls: [wall(215, 132, 257, 132), wall(333, 132, 375, 132)],
      spinners: [{ x: 295, y: 132, arm: 34, speed: 1.7, look: "pinwheel" }],
      movers: [{ x: 95, y: 150, r: 9, dx: 0, dy: 62, period: 2800, look: "gummy" }],
      sand: [[pt(25, 95), pt(70, 95), pt(85, 125), pt(25, 125)]],
      bumpers: [bump(140, 90, 8, "gumdrop"), bump(262, 215, 8, "donut")],
      powerups: [pad(48, 175, "ghost"), pad(345, 70, "bigcup")],
      decor: [deco("fountain", 200, 160), deco("peppermint", 290, 287, 0.8), deco("cone", 12, 30), deco("cupcake", 388, 270, 0.8), deco("lollipop", 120, 290, 0.9), deco("balloon", 388, 120, 0.8)],
    }),
  ],
});
