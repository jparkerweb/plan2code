// Plan2Code Web Console - mini golf's Frosty Peaks course: eighteen holes as data, in course units.
//
// Data only: no DOM. Built with golf-kit.js, which documents what a hole
// holds; listed in golf-holes.js; drawn with golf-look-frost.js. Soft snow,
// glassy ice that never wants to stop, holes in the frozen lake, sliding
// penguins, a yeti, a ski lift, falling icicles and a frozen waterfall.

import { course, hole, pt, rect, wall, bump, pad, deco } from "./golf-kit.js";

const h = (def) => hole(def, { theme: "frost", ground: "snow", liquid: "icewater" });

// A rounded patch (a pond, a hole in the ice, a drift): n points round an
// ellipse.
const blob = (cx, cy, rx, ry, n = 12) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2;
  return pt(Math.round((cx + Math.cos(a) * rx) * 10) / 10, Math.round((cy + Math.sin(a) * ry) * 10) / 10);
});

export default course({
  id: "frost",
  name: "Frosty Peaks",
  blurb: "Glide the ice past penguins, a yeti and a frozen waterfall.",
  cover: 15,
  voice: {
    label: "Run",
    splash: {
      icewater: ["SPLASH! Brrrrr!", "Polar plunge!", "The fish say hi"],
      crevasse: ["Aaaa... echo... echo...", "Lost in the glacier!", "See you in spring!"],
    },
    splashTone: { icewater: "splash", crevasse: "fall" },
    bump: ["Thwump!", "Poof!", "Boing!", "Crunch!"],
    ace: "HOLE IN ONE! An avalanche of applause!",
    turn: "Front nine done! Warm up with a cocoa for the back nine...",
    done: "King of the mountain!",
    quips: {
      pickedUp: "Lost in a snowdrift. See you in spring.",
      ace: "The penguins do a happy dance!",
      eagle: "Ice cold! Absolutely chilling.",
      birdie: "A snow bunny birdie!",
      par: "Cool, calm and collected.",
      bogey: "A touch of frostbite. Shake it off.",
      worse: "Somewhere, a yeti is laughing.",
    },
  },
  holes: [
    // 1: a gentle first run with one strip of ice across it, to feel the glide.
    h({
      name: "First Tracks",
      par: 2,
      quip: "Welcome to Frosty Peaks! That blue strip is ice. It never stops.",
      tee: pt(82, 165),
      cup: pt(318, 152),
      outline: [pt(40, 165), pt(78, 122), pt(325, 112), pt(362, 150), pt(328, 192), pt(78, 208)],
      ice: [[pt(178, 100), pt(212, 100), pt(232, 215), pt(198, 215)]],
      decor: [deco("pine", 38, 100), deco("pine", 62, 84, 0.8), deco("cabin", 355, 82, 0.9), deco("snowman", 62, 262), deco("skier", 200, 258), deco("pine", 362, 262), deco("pine", 384, 238, 0.7), deco("peak", 210, 92, 0.6)],
    }),

    // 2: an L round a frozen pond; bank off the corner and glide up to the cup.
    h({
      name: "Frozen Pond",
      par: 3,
      quip: "Skate it round the pond and bank it off the corner!",
      tee: pt(75, 235),
      cup: pt(300, 92),
      outline: [pt(40, 205), pt(245, 205), pt(245, 60), pt(355, 60), pt(355, 232), pt(322, 265), pt(40, 265)],
      ice: [blob(292, 222, 62, 46, 14)],
      bumpers: [bump(272, 140, 8, "snowball")],
      powerups: [pad(160, 222, "bouncy")],
      decor: [deco("polarbear", 140, 150), deco("pine", 55, 120), deco("pine", 85, 96, 0.8), deco("pine", 205, 82, 1.1), deco("penguin", 380, 150), deco("penguin", 376, 186, 0.8), deco("lamp", 225, 190)],
    }),

    // 3: a slanted slalom run: snowmen, candy poles and drifts to weave through.
    h({
      name: "Snowman Slalom",
      par: 3,
      quip: "Weave through the slalom. The snowmen don't move. Probably.",
      tee: pt(82, 160),
      cup: pt(322, 140),
      outline: [pt(30, 95), pt(310, 62), pt(372, 195), pt(92, 232)],
      bumpers: [
        bump(160, 152, 11, "snowman"),
        bump(255, 143, 11, "snowman"),
        bump(208, 104, 5, "pole"),
        bump(208, 192, 5, "pole"),
        bump(118, 112, 5, "pole"),
        bump(300, 190, 5, "pole"),
      ],
      sand: [blob(175, 212, 26, 11, 10), blob(268, 86, 24, 10, 10)],
      powerups: [pad(208, 148, "spyglass")],
      decor: [deco("snowman", 50, 262), deco("pine", 362, 248), deco("pine", 386, 272, 0.7), deco("skier", 110, 60), deco("pine", 362, 84), deco("pine", 380, 112, 0.7)],
    }),

    // 4: a staircase of two lanes; penguins slide across the icy middle.
    h({
      name: "Penguin Crossing",
      par: 3,
      quip: "Penguins have right of way. Time it, or grab the ghost ball.",
      tee: pt(65, 130),
      cup: pt(330, 200),
      outline: [pt(30, 70), pt(250, 70), pt(250, 130), pt(370, 130), pt(370, 250), pt(150, 250), pt(150, 190), pt(30, 190)],
      ice: [rect(150, 70, 100, 180)],
      movers: [
        { x: 180, y: 160, r: 8, dx: 0, dy: 72, period: 2600, look: "penguin" },
        { x: 222, y: 160, r: 8, dx: 0, dy: 72, period: 2600, phase: 0.5, look: "penguin" },
      ],
      powerups: [pad(110, 95, "ghost")],
      decor: [deco("igloo", 82, 245, 1.1), deco("xing", 300, 112), deco("penguin", 345, 100), deco("penguin", 362, 112, 0.7), deco("pine", 280, 60, 0.9), deco("penguin", 125, 268, 0.8)],
    }),

    // 5: a U round a mountain, or straight through it by the ice cave.
    h({
      name: "Ice Cave",
      par: 3,
      quip: "Go round the mountain... or straight up through the ice cave!",
      tee: pt(90, 235),
      cup: pt(305, 100),
      outline: [pt(40, 60), pt(150, 60), pt(150, 180), pt(250, 180), pt(250, 60), pt(360, 60), pt(360, 268), pt(40, 268)],
      ice: [rect(150, 180, 100, 88)],
      tunnels: [{ a: pt(110, 125), b: pt(285, 210) }],
      decor: [deco("peak", 200, 178, 1.35), deco("pine", 200, 98, 0.8), deco("pine", 22, 140, 0.8), deco("pine", 380, 92, 0.8), deco("penguin", 382, 200, 0.8), deco("flurry", 200, 120)],
    }),

    // 6: a frozen lake with fishing holes cut in it; glide between them.
    h({
      name: "Thin Ice",
      par: 3,
      quip: "Don't fall through the fishing holes. The water is COLD.",
      tee: pt(55, 158),
      cup: pt(345, 158),
      outline: [pt(60, 70), pt(340, 70), pt(375, 110), pt(375, 205), pt(340, 245), pt(60, 245), pt(25, 205), pt(25, 110)],
      ice: [blob(200, 158, 115, 82, 18)],
      water: [blob(200, 158, 16, 14, 16), blob(145, 110, 13, 11, 16), blob(150, 206, 14, 12, 16), blob(255, 108, 14, 12, 16), blob(258, 208, 13, 11, 16)],
      decor: [deco("fishhut", 340, 48, 0.9), deco("polarbear", 300, 274, 0.9), deco("fishhut", 105, 278, 0.9), deco("pine", 382, 62, 0.7), deco("pine", 20, 62, 0.7), deco("penguin", 25, 268, 0.8)],
    }),

    // 7: a cross with the ski lift turning in the middle.
    h({
      name: "Ski Lift",
      par: 3,
      quip: "Mind the chairlift! It keeps on turning, all day long.",
      tee: pt(65, 160),
      cup: pt(335, 160),
      outline: [pt(30, 120), pt(160, 120), pt(160, 52), pt(240, 52), pt(240, 120), pt(370, 120), pt(370, 200), pt(240, 200), pt(240, 280), pt(160, 280), pt(160, 200), pt(30, 200)],
      spinners: [{ x: 200, y: 160, arm: 36, speed: 1.5, look: "lift" }],
      sand: [blob(200, 256, 30, 16, 12)],
      powerups: [pad(200, 80, "bigcup")],
      decor: [deco("cabin", 92, 100), deco("pine", 40, 70, 0.8), deco("skier", 310, 82), deco("snowman", 90, 255), deco("pine", 312, 252), deco("pine", 345, 270, 0.8), deco("lamp", 140, 112, 0.8)],
    }),

    // 8: three avalanche chutes push the ball down into the drift below,
    // where a giant snowball rolls back and forth.
    h({
      name: "Avalanche Alley",
      par: 3,
      quip: "AVALANCHE! Punch it across before the snow sweeps you down.",
      tee: pt(55, 95),
      cup: pt(345, 95),
      outline: [pt(25, 65), pt(375, 65), pt(375, 140), pt(255, 272), pt(145, 272), pt(25, 140)],
      slopes: [
        { points: rect(95, 65, 50, 125), push: pt(0, 150) },
        { points: rect(175, 65, 50, 125), push: pt(0, 150) },
        { points: rect(255, 65, 50, 125), push: pt(0, 150) },
      ],
      movers: [{ x: 200, y: 214, r: 10, dx: 48, dy: 0, period: 3000, look: "boulder" }],
      sand: [blob(200, 245, 50, 20, 14)],
      powerups: [pad(70, 132, "cannon")],
      decor: [deco("peak", 55, 240, 0.9), deco("peak", 345, 240, 0.9), deco("pine", 30, 272, 0.8), deco("pine", 80, 278, 0.8), deco("snowman", 330, 284, 0.6), deco("pine", 370, 272, 0.8)],
    }),

    // 9: a ring track round a big igloo; its door is a tunnel to the far side.
    h({
      name: "Igloo Village",
      par: 3,
      quip: "Knock knock! Through the igloo, round the bend, into the cup.",
      tee: pt(200, 252),
      cup: pt(200, 80),
      outline: [pt(95, 48), pt(305, 48), pt(372, 110), pt(372, 212), pt(305, 274), pt(95, 274), pt(28, 212), pt(28, 110)],
      walls: [
        wall(160, 112, 240, 112), wall(240, 112, 262, 135), wall(262, 135, 262, 187), wall(262, 187, 240, 210),
        wall(240, 210, 160, 210), wall(160, 210, 138, 187), wall(138, 187, 138, 135), wall(138, 135, 160, 112),
      ],
      tunnels: [{ a: pt(200, 226), b: pt(318, 195) }],
      bumpers: [bump(83, 161, 9, "snowball")],
      movers: [{ x: 100, y: 242, r: 7, dx: 40, dy: 0, period: 3000, look: "penguin" }],
      powerups: [pad(70, 120, "spyglass")],
      decor: [deco("igloo", 200, 200, 2.5), deco("penguin", 155, 196, 0.8), deco("penguin", 246, 196, 0.8), deco("pine", 30, 62, 0.8), deco("pine", 372, 62, 0.8), deco("pine", 30, 268), deco("pine", 375, 268), deco("lamp", 200, 132, 0.8)],
    }),

    // 10: a bowtie with a yeti stomping back and forth across the waist.
    h({
      name: "Yeti Crossing",
      par: 3,
      quip: "Is that... a YETI? Sneak past while he isn't looking.",
      tee: pt(70, 161),
      cup: pt(330, 161),
      outline: [pt(30, 60), pt(170, 112), pt(230, 112), pt(370, 60), pt(370, 262), pt(230, 210), pt(170, 210), pt(30, 262)],
      movers: [{ x: 200, y: 161, r: 14, dx: 0, dy: 32, period: 2800, look: "yeti" }],
      bumpers: [bump(112, 120, 9, "snowball"), bump(112, 202, 9, "snowball"), bump(288, 120, 9, "snowball"), bump(288, 202, 9, "snowball")],
      sand: [blob(330, 102, 20, 9, 10), blob(330, 220, 20, 9, 10)],
      powerups: [pad(80, 225, "ghost")],
      decor: [deco("peak", 200, 104, 0.8), deco("snowman", 200, 252, 0.9), deco("footprints", 110, 284, 0.9), deco("footprints", 255, 40, 0.9), deco("pine", 20, 290, 0.7), deco("pine", 385, 290, 0.7)],
    }),

    // 11: a glacier split by a bottomless crevasse; two plank bridges over it,
    // glassy slabs of ice beyond.
    h({
      name: "The Crevasse",
      par: 4,
      quip: "A crevasse! Take a bridge. It's a long, long way down.",
      liquid: "crevasse",
      tee: pt(70, 180),
      cup: pt(330, 150),
      outline: [pt(30, 85), pt(360, 50), pt(375, 250), pt(45, 272)],
      water: [[pt(178, 40), pt(198, 100), pt(176, 160), pt(200, 220), pt(182, 290), pt(212, 290), pt(230, 220), pt(206, 160), pt(228, 100), pt(208, 40)]],
      bridges: [{ x: 165, y: 88, w: 78, h: 24 }, { x: 165, y: 205, w: 78, h: 24 }],
      ice: [[pt(245, 62), pt(320, 55), pt(300, 135), pt(240, 145)], [pt(240, 180), pt(330, 178), pt(345, 252), pt(240, 262)]],
      bumpers: [bump(275, 162, 9, "iceblock")],
      sand: [blob(110, 230, 26, 12, 10)],
      powerups: [pad(100, 110, "magnet")],
      decor: [deco("aurora", 200, 36), deco("peak", 78, 66, 0.7), deco("polarbear", 120, 290, 0.7), deco("penguin", 386, 160, 0.8), deco("pine", 385, 280, 0.7)],
    }),

    // 12: a long diagonal run under icicles that crash down in turn.
    h({
      name: "Icicle Alley",
      par: 3,
      quip: "Icicles! They drop on a beat. Glide through between them.",
      tee: pt(75, 92),
      cup: pt(316, 228),
      outline: [pt(71, 52), pt(361, 217), pt(359, 253), pt(329, 273), pt(39, 108), pt(41, 72)],
      ice: [[pt(147, 86), pt(292, 169), pt(253, 239), pt(108, 156)]],
      gates: [
        { x1: 131, y1: 162, x2: 165, y2: 103, period: 2400, open: 0.5, offset: 0, look: "icicles" },
        { x1: 183, y1: 192, x2: 217, y2: 133, period: 2400, open: 0.5, offset: 0.33, look: "icicles" },
        { x1: 235, y1: 222, x2: 269, y2: 163, period: 2400, open: 0.5, offset: 0.66, look: "icicles" },
      ],
      decor: [deco("cabin", 300, 92, 1.1), deco("pine", 230, 58), deco("pine", 362, 140, 0.9), deco("pine", 380, 170, 0.7), deco("snowman", 90, 225), deco("pine", 55, 170, 0.9), deco("lamp", 180, 255), deco("penguin", 130, 268, 0.8)],
    }),

    // 13: a hexagon lake with a whirlpool under a hole in the middle.
    h({
      name: "Whirlpool",
      par: 4,
      quip: "A whirlpool under the ice! Curl it round. Don't get sucked in.",
      tee: pt(95, 160),
      cup: pt(300, 160),
      outline: [pt(330, 160), pt(265, 52), pt(135, 52), pt(70, 160), pt(135, 268), pt(265, 268)],
      ice: [blob(200, 160, 88, 100, 18)],
      water: [blob(200, 160, 14, 14, 12)],
      wells: [{ x: 200, y: 160, r: 55, pull: 420, look: "whirlpool" }],
      bumpers: [bump(150, 96, 9, "iceblock"), bump(250, 224, 9, "iceblock")],
      decor: [deco("fishhut", 55, 82, 0.9), deco("polarbear", 345, 90, 0.8), deco("penguin", 58, 250), deco("penguin", 76, 266, 0.7), deco("pine", 350, 250), deco("pine", 372, 232, 0.8), deco("aurora", 200, 32, 0.9)],
    }),

    // 14: a bobsled run: three icy lanes with banked turns at each end.
    h({
      name: "Bobsled Run",
      par: 4,
      quip: "Bobsled run! Bank the turns and ride the ice all the way down.",
      ground: "piste",
      tee: pt(60, 85),
      cup: pt(330, 240),
      outline: [pt(45, 48), pt(330, 48), pt(378, 96), pt(378, 252), pt(355, 275), pt(70, 275), pt(22, 227), pt(22, 71)],
      walls: [wall(22, 121, 300, 121), wall(100, 201, 378, 201), wall(345, 201, 378, 168), wall(22, 175, 75, 121)],
      ice: [[pt(95, 40), pt(390, 40), pt(390, 201), pt(250, 201), pt(250, 285), pt(10, 285), pt(10, 121), pt(95, 121)]],
      sand: [blob(364, 238, 12, 26, 12)],
      movers: [{ x: 200, y: 161, r: 8, dx: 90, dy: 0, period: 3400, look: "sled" }],
      decor: [deco("pine", 390, 40, 0.6), deco("penguin", 390, 290, 0.6), deco("flake", 12, 290, 0.6), deco("flake", 12, 30, 0.5)],
    }),

    // 15: three floes in icy water: plank bridges between them, a penguin
    // patrolling the slippery middle one.
    h({
      name: "Ice Floes",
      par: 4,
      quip: "Floe to floe, bridge to bridge. Mind the penguin!",
      tee: pt(60, 160),
      cup: pt(335, 160),
      outline: [pt(25, 90), pt(80, 50), pt(320, 50), pt(375, 95), pt(375, 215), pt(320, 265), pt(80, 265), pt(25, 215)],
      ice: [rect(140, 45, 120, 225)],
      water: [
        [pt(118, 40), pt(108, 90), pt(122, 140), pt(106, 190), pt(120, 240), pt(110, 280), pt(150, 280), pt(158, 240), pt(144, 190), pt(160, 140), pt(146, 90), pt(156, 40)],
        [pt(248, 40), pt(240, 90), pt(256, 140), pt(242, 190), pt(254, 240), pt(244, 280), pt(284, 280), pt(292, 240), pt(278, 190), pt(294, 140), pt(280, 90), pt(290, 40)],
      ],
      bridges: [{ x: 100, y: 68, w: 66, h: 24 }, { x: 98, y: 205, w: 68, h: 24 }, { x: 232, y: 138, w: 68, h: 26 }],
      movers: [{ x: 200, y: 160, r: 8, dx: 0, dy: 70, period: 3000, look: "penguin" }],
      decor: [deco("fishhut", 362, 50, 0.9), deco("polarbear", 200, 287, 0.8), deco("pine", 30, 60, 0.8), deco("pine", 30, 262, 0.8), deco("penguin", 375, 255, 0.8)],
    }),

    // 16: a Christmas tree: ornaments to bounce off up the tiers, the cup
    // just under the star.
    h({
      name: "Tree Topper",
      par: 3,
      quip: "Climb the tree, bounce the baubles, sink it under the star!",
      ground: "needles",
      tee: pt(200, 262),
      cup: pt(200, 92),
      outline: [
        pt(200, 48), pt(262, 110), pt(238, 110), pt(300, 170), pt(268, 170), pt(338, 232), pt(225, 232), pt(225, 280),
        pt(175, 280), pt(175, 232), pt(62, 232), pt(132, 170), pt(100, 170), pt(162, 110), pt(138, 110),
      ],
      bumpers: [
        bump(200, 200, 8, "ornament"),
        bump(140, 212, 7, "ornament"),
        bump(260, 212, 7, "ornament"),
        bump(165, 150, 7, "ornament"),
        bump(235, 150, 7, "ornament"),
        bump(200, 132, 7, "ornament"),
      ],
      powerups: [pad(110, 220, "bouncy")],
      decor: [deco("star", 200, 36), deco("gift", 140, 262), deco("gift", 262, 266, 0.8), deco("gift", 290, 258, 1.1), deco("snowman", 60, 270), deco("flurry", 70, 90), deco("flurry", 330, 90), deco("lamp", 350, 280, 0.8)],
    }),

    // 17: a snow globe: the cup in the middle, a swirl pulling into it, and
    // four ice doors round it opening in turn.
    h({
      name: "Snow Globe",
      par: 4,
      quip: "Shake it up! The doors open in turn. The swirl does the rest.",
      tee: pt(200, 255),
      cup: pt(200, 160),
      outline: blob(200, 160, 112, 112, 20),
      ice: [blob(200, 160, 50, 50, 16)],
      wells: [{ x: 200, y: 160, r: 48, pull: 320, look: "globe" }],
      gates: [
        { x1: 200, y1: 126, x2: 234, y2: 160, period: 3200, open: 0.6, offset: 0, look: "icicles" },
        { x1: 234, y1: 160, x2: 200, y2: 194, period: 3200, open: 0.6, offset: 0.25, look: "icicles" },
        { x1: 200, y1: 194, x2: 166, y2: 160, period: 3200, open: 0.6, offset: 0.5, look: "icicles" },
        { x1: 166, y1: 160, x2: 200, y2: 126, period: 3200, open: 0.6, offset: 0.75, look: "icicles" },
      ],
      bumpers: [bump(130, 95, 9, "snowball"), bump(270, 95, 9, "snowball"), bump(130, 225, 9, "snowball"), bump(270, 225, 9, "snowball")],
      decor: [deco("plinth", 200, 288), deco("flurry", 120, 160, 0.8), deco("flurry", 280, 160, 0.8), deco("pine", 40, 80), deco("pine", 360, 80), deco("cabin", 50, 240, 0.9), deco("snowman", 355, 250)],
    }),

    // 18: the grand finale: over the river, through the icicles, up the
    // magic carpet, past the snowplow and home beside the frozen falls.
    h({
      name: "Frozen Falls",
      par: 5,
      quip: "The grand finale! Bridge, icicles, lift, plow... then the falls.",
      tee: pt(55, 242),
      cup: pt(150, 84),
      outline: [pt(22, 205), pt(305, 205), pt(305, 120), pt(110, 120), pt(110, 48), pt(378, 48), pt(378, 278), pt(22, 278)],
      water: [[pt(135, 200), pt(170, 200), pt(176, 240), pt(168, 283), pt(132, 283), pt(128, 240)]],
      bridges: [{ x: 122, y: 228, w: 60, h: 26 }],
      gates: [{ x1: 232, y1: 205, x2: 232, y2: 278, period: 2600, open: 0.55, look: "icicles" }],
      slopes: [{ points: rect(312, 130, 60, 135), push: pt(0, -160) }],
      ice: [rect(175, 48, 125, 72)],
      spinners: [{ x: 245, y: 84, arm: 30, speed: 1.8, look: "plow" }],
      powerups: [pad(268, 250, "doubloon"), pad(345, 70, "magnet")],
      decor: [deco("falls", 207, 160, 0.85), deco("cabin", 62, 102, 1.1), deco("lamp", 95, 195), deco("pine", 40, 185, 0.9), deco("aurora", 245, 32, 0.9), deco("penguin", 70, 155, 0.8)],
    }),
  ],
});
