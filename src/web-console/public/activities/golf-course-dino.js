// Plan2Code Web Console - mini golf's Dino Valley course: eighteen holes as data, in course units.
//
// Data only: no DOM. Built with golf-kit.js, which documents what a hole
// holds; listed in golf-holes.js; drawn with golf-look-dino.js. A prehistoric
// jungle valley: egg nests, a fossil dig, swamps and tar pits, geysers,
// stomping dinosaurs, obsidian slicks, lava rivers, a meteor crater and a
// volcano to finish on.

import { course, hole, pt, rect, wall, bump, pad, deco } from "./golf-kit.js";

const h = (def) => hole(def, { theme: "dino", ground: "jungle", liquid: "swamp" });

// A rounded patch of `n` points round x, y, for ponds, pits and patches;
// `wob` makes its edge wobble a little, the same every time.
const blob = (x, y, rx, ry, n = 16, wob = 0) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2;
  const k = 1 + wob * Math.sin(i * 2.3);
  return pt(x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k);
});

// A ring of water round an island, as one polygon: the outer edge one way,
// the inner edge back the other, joined by a seam straight down from the
// center (hide it under a bridge).
const moat = (x, y, outer, inner, n = 20) => {
  const at = (r, i) => pt(x + Math.cos(Math.PI / 2 + (i / n) * Math.PI * 2) * r, y + Math.sin(Math.PI / 2 + (i / n) * Math.PI * 2) * r);
  const out = Array.from({ length: n + 1 }, (_, i) => at(outer, i));
  const back = Array.from({ length: n + 1 }, (_, i) => at(inner, n - i));
  return [...out, ...back];
};

export default course({
  id: "dino",
  name: "Dino Valley",
  blurb: "Tar pits, T-rex stomps and a smoking volcano finale.",
  cover: 17,
  voice: {
    label: "Hole",
    splash: {
      swamp: ["Sploosh! Swamp snack", "Glorp!", "A frog ate it"],
      tar: ["Stuck in the tar!", "Gloop... gone", "Future fossil!"],
      lava: ["SIZZLE! Dino toast", "Roasted!", "Too hot to handle!"],
    },
    splashTone: { swamp: "splash", tar: "fall" },
    bump: ["Boing!", "Crack!", "Thunk!", "Rawr!"],
    ace: "HOLE IN ONE! The whole valley goes ROAR!",
    turn: "Front nine done! The volcano rumbles...",
    done: "You survived Dino Valley!",
    quips: {
      pickedUp: "A raptor ran off with that one.",
      ace: "Jurassic-level putting!",
      eagle: "Eagle! Well, pterodactyl.",
      birdie: "A birdie! Birds are dinosaurs, you know.",
      par: "Steady as a stegosaurus.",
      bogey: "The T-rex snickers. Tiny arms, big laugh.",
      worse: "An extinction-level event.",
    },
  },
  holes: [
    // 1: an L past the nesting grounds, eggs to bank off, the volcano
    // smoking in the corner.
    h({
      name: "Nesting Grounds",
      par: 3,
      quip: "Welcome to Dino Valley! Mind the eggs. Mama is watching.",
      tee: pt(75, 215),
      cup: pt(305, 95),
      outline: [pt(40, 180), pt(250, 180), pt(250, 55), pt(360, 55), pt(360, 250), pt(40, 250)],
      bumpers: [bump(170, 230, 8, "egg"), bump(215, 198, 8, "egg"), bump(330, 222, 12, "nest"), bump(285, 150, 8, "egg")],
      powerups: [pad(130, 200, "spyglass")],
      decor: [deco("volcano", 140, 120, 1.1), deco("tracks", 90, 236, 0.8), deco("fern", 22, 205), deco("cycad", 385, 120), deco("fern", 230, 272, 0.9), deco("nest", 330, 274, 0.8)],
    }),

    // 2: a six-sided dig site with a fossil pit in the middle: around it,
    // or through the sand past the skull.
    h({
      name: "Fossil Dig",
      par: 3,
      quip: "Careful, that sand is full of very old bones.",
      tee: pt(70, 150),
      cup: pt(330, 150),
      outline: [pt(35, 150), pt(100, 60), pt(300, 60), pt(365, 150), pt(300, 240), pt(100, 240)],
      sand: [[pt(140, 105), pt(260, 105), pt(285, 150), pt(260, 195), pt(140, 195), pt(115, 150)]],
      bumpers: [bump(205, 150, 12, "skull"), bump(200, 82, 7, "boulder"), bump(200, 218, 7, "boulder")],
      powerups: [pad(110, 200, "magnet")],
      decor: [deco("ribs", 160, 150, 0.9), deco("ribs", 250, 132, -0.6), deco("rocks", 30, 70), deco("cycad", 375, 255), deco("fern", 375, 50), deco("tracks", 300, 270, -0.7)],
    }),

    // 3: a bow tie of a lagoon, swamp ponds in each lobe and one right in
    // the narrows.
    h({
      name: "Lily Pad Lagoon",
      par: 3,
      quip: "Hop it past the ponds. The frogs are rooting for you.",
      tee: pt(70, 120),
      cup: pt(325, 195),
      outline: [pt(35, 80), pt(150, 60), pt(200, 110), pt(250, 60), pt(365, 80), pt(365, 230), pt(250, 250), pt(200, 195), pt(150, 250), pt(35, 230)],
      water: [
        blob(122, 196, 38, 28, 16, 0.08),
        blob(288, 116, 44, 25, 16, 0.08),
        blob(200, 154, 20, 13, 14),
      ],
      powerups: [pad(130, 88, "ghost")],
      decor: [deco("lily", 118, 196), deco("lily", 290, 115, 0.9), deco("lily", 200, 154, 0.6), deco("dragonfly", 200, 60), deco("fern", 200, 270), deco("cycad", 20, 265, 0.9), deco("fern", 385, 255, 0.8)],
    }),

    // 4: a U of mud: slide down the left side, bank round the bottom and
    // climb the slippery slope up the right to the cup.
    h({
      name: "Mud Slide",
      par: 3,
      quip: "Wheee! Down the mud slide... then back up the other one.",
      tee: pt(85, 75),
      cup: pt(315, 75),
      outline: [pt(40, 50), pt(130, 50), pt(130, 180), pt(270, 180), pt(270, 50), pt(360, 50), pt(360, 260), pt(40, 260)],
      walls: [wall(40, 200, 100, 260), wall(300, 260, 360, 200)],
      slopes: [
        { points: rect(40, 95, 90, 65), push: pt(0, 90) },
        { points: rect(270, 100, 90, 60), push: pt(0, 110) },
      ],
      bumpers: [bump(200, 222, 9, "boulder")],
      powerups: [pad(165, 240, "cannon")],
      decor: [deco("brachio", 200, 125), deco("fern", 145, 70, 0.8), deco("fern", 255, 165, 0.7), deco("cycad", 385, 50, 0.9), deco("rocks", 20, 280, 0.8)],
    }),

    // 5: a diamond of hot springs: the geysers blow a ball off its line, the
    // biggest right in the middle.
    h({
      name: "Geyser Gulch",
      par: 3,
      quip: "Thar she blows! The geysers push back. Go around them.",
      ground: "dirt",
      tee: pt(75, 150),
      cup: pt(325, 150),
      outline: [pt(200, 40), pt(365, 150), pt(200, 265), pt(35, 150)],
      wells: [
        { x: 200, y: 150, r: 42, pull: -260, look: "geyser" },
        { x: 130, y: 125, r: 22, pull: -260, look: "geyser" },
        { x: 270, y: 175, r: 22, pull: -260, look: "geyser" },
      ],
      bumpers: [bump(200, 82, 8, "egg"), bump(200, 218, 8, "egg")],
      powerups: [pad(110, 170, "bigcup")],
      decor: [deco("volcano", 330, 240, 0.9), deco("fern", 60, 60), deco("cycad", 55, 250), deco("rocks", 340, 60), deco("ptero", 90, 90)],
    }),

    // 6: a wide meadow narrows to a throat where a stegosaurus spins on the
    // spot, plates up, tail swinging.
    h({
      name: "Stegosaurus Spin",
      par: 3,
      quip: "Steggy is doing a little dance. Time your putt past the tail.",
      tee: pt(75, 170),
      cup: pt(330, 170),
      outline: [pt(35, 70), pt(170, 70), pt(230, 110), pt(365, 110), pt(365, 230), pt(230, 230), pt(170, 270), pt(35, 270)],
      spinners: [{ x: 230, y: 170, arm: 48, speed: 1.7, look: "stego" }],
      bumpers: [bump(130, 110, 8, "egg"), bump(130, 230, 8, "egg")],
      powerups: [pad(95, 100, "bouncy")],
      decor: [deco("fern", 300, 85), deco("cycad", 250, 60, 1.1), deco("fern", 300, 258), deco("rocks", 380, 270, 0.8), deco("tracks", 60, 252, 0.7)],
    }),

    // 7: a swamp river wall to wall; the only way over is the big old bone
    // up top, while a brontosaurus wades below.
    h({
      name: "Brontosaurus Bridge",
      par: 3,
      quip: "Cross on the giant bone. Don't wake the brontosaurus.",
      tee: pt(75, 210),
      cup: pt(320, 200),
      outline: [pt(35, 60), pt(365, 45), pt(365, 240), pt(35, 255)],
      water: [[pt(160, 20), pt(240, 20), pt(240, 280), pt(160, 280)]],
      bridges: [{ x: 156, y: 72, w: 88, h: 24 }],
      powerups: [pad(90, 110, "spyglass")],
      decor: [deco("bone", 200, 84), deco("bronto", 200, 195), deco("lily", 185, 130, 0.8), deco("lily", 220, 245, 0.7), deco("fern", 20, 140), deco("cycad", 385, 150, 0.9), deco("dragonfly", 300, 120)],
    }),

    // 8: three raptors dart up and down across the run; a ghost ball slips
    // straight through them.
    h({
      name: "Raptor Run",
      par: 3,
      quip: "Clever girls. Wait for a gap, then GO!",
      tee: pt(70, 150),
      cup: pt(330, 150),
      outline: [pt(35, 90), pt(120, 60), pt(280, 60), pt(365, 90), pt(365, 210), pt(280, 240), pt(120, 240), pt(35, 210)],
      movers: [
        { x: 140, y: 150, r: 9, dx: 0, dy: 70, period: 2000, look: "raptor" },
        { x: 200, y: 150, r: 9, dx: 0, dy: 70, period: 2600, phase: 0.35, look: "raptor" },
        { x: 260, y: 150, r: 9, dx: 0, dy: 70, period: 1800, phase: 0.7, look: "raptor" },
      ],
      powerups: [pad(95, 100, "ghost")],
      decor: [deco("nest", 200, 268, 0.9), deco("fern", 30, 50), deco("fern", 375, 255), deco("cycad", 380, 55, 0.9), deco("rocks", 25, 260, 0.8)],
    }),

    // 9: a sticky blob of a hole with three tar pits that suck in a slow
    // ball, and a fossil bunker by the cup.
    h({
      name: "La Brea Tar Pits",
      par: 4,
      quip: "The tar pits are hungry. Roll fast or become a fossil.",
      liquid: "tar",
      ground: "dirt",
      tee: pt(70, 140),
      cup: pt(320, 190),
      outline: [pt(30, 120), pt(80, 55), pt(220, 45), pt(330, 70), pt(370, 140), pt(350, 230), pt(260, 265), pt(110, 260), pt(40, 215)],
      water: [blob(165, 110, 17, 15, 14, 0.06), blob(235, 205, 17, 15, 14, 0.06), blob(110, 200, 14, 12, 14, 0.06)],
      wells: [
        { x: 165, y: 110, r: 45, pull: 150, look: "tarpit" },
        { x: 235, y: 205, r: 45, pull: 150, look: "tarpit" },
        { x: 110, y: 200, r: 36, pull: 150, look: "tarpit" },
      ],
      sand: [[pt(270, 100), pt(320, 95), pt(345, 130), pt(300, 140)]],
      powerups: [pad(170, 215, "magnet")],
      decor: [deco("ribs", 300, 118, 0.6), deco("rocks", 375, 70), deco("fern", 30, 270), deco("cycad", 385, 245, 0.9), deco("fern", 250, 20, 0.8)],
    }),

    // 10: a lightning step of black glass: bank off the corners and slide
    // to the cup, but not into the lava past it.
    h({
      name: "Obsidian Slick",
      par: 3,
      quip: "Volcanic glass! Slippery as a raptor. Lava at the end.",
      liquid: "lava",
      ground: "rock",
      tee: pt(65, 80),
      cup: pt(322, 222),
      outline: [pt(35, 45), pt(250, 45), pt(250, 185), pt(365, 185), pt(365, 255), pt(180, 255), pt(180, 115), pt(35, 115)],
      walls: [wall(212, 45, 250, 83), wall(180, 217, 218, 255)],
      ice: [[pt(150, 45), pt(250, 45), pt(250, 185), pt(310, 185), pt(310, 255), pt(180, 255), pt(180, 115), pt(150, 115)]],
      water: [rect(348, 185, 20, 72)],
      powerups: [pad(110, 95, "doubloon")],
      decor: [deco("volcano", 100, 205, 1.3), deco("rocks", 300, 140), deco("rocks", 345, 280, 0.7), deco("fern", 20, 145, 0.8), deco("meteor", 320, 60)],
    }),

    // 11: a swamp river cuts the island in two, no bridge: pick a hollow
    // log and roll through it to the far bank.
    h({
      name: "Hollow Log Hop",
      par: 3,
      quip: "No bridge? No problem. Roll through a hollow log!",
      tee: pt(70, 160),
      cup: pt(330, 150),
      outline: [pt(50, 70), pt(150, 45), pt(250, 45), pt(350, 70), pt(370, 150), pt(350, 235), pt(250, 260), pt(150, 260), pt(50, 235), pt(30, 150)],
      water: [[pt(195, 20), pt(255, 20), pt(205, 290), pt(145, 290)]],
      tunnels: [
        { a: pt(115, 95), b: pt(275, 215) },
        { a: pt(130, 215), b: pt(285, 80) },
      ],
      powerups: [pad(95, 225, "bigcup")],
      decor: [deco("lily", 215, 80, 0.8), deco("lily", 180, 190, 0.7), deco("dragonfly", 210, 140), deco("fern", 20, 60), deco("cycad", 380, 265), deco("fern", 385, 45, 0.8)],
    }),

    // 12: a lightning bolt of a pass, two pterodactyls flapping in its
    // narrows.
    h({
      name: "Pterodactyl Pass",
      par: 4,
      quip: "SKREEE! Duck under the wings, then up the pass.",
      ground: "rock",
      tee: pt(70, 222),
      cup: pt(340, 92),
      outline: [pt(35, 190), pt(150, 190), pt(230, 60), pt(365, 60), pt(365, 125), pt(250, 125), pt(170, 255), pt(35, 255)],
      spinners: [
        { x: 212, y: 138, arm: 20, speed: 2.4, look: "ptero" },
        { x: 280, y: 92, arm: 27, speed: -2, look: "ptero" },
      ],
      powerups: [pad(100, 205, "bouncy")],
      decor: [deco("volcano", 305, 215, 1.2), deco("ptero", 100, 110), deco("cycad", 30, 130), deco("rocks", 160, 60, 0.9), deco("fern", 375, 160, 0.8)],
    }),

    // 13: three brachiosaurs lower their long necks across the way in
    // turn; puddles wait between them.
    h({
      name: "Brachiosaurus Crossing",
      par: 3,
      quip: "Necks down, necks up. Putt between the munching.",
      tee: pt(65, 150),
      cup: pt(335, 150),
      outline: [pt(35, 150), pt(80, 80), pt(320, 80), pt(365, 150), pt(320, 220), pt(80, 220)],
      water: [rect(150, 80, 40, 20), rect(215, 200, 40, 20)],
      gates: [
        { x1: 110, y1: 80, x2: 140, y2: 220, period: 2600, open: 0.5, offset: 0, look: "neck" },
        { x1: 220, y1: 80, x2: 190, y2: 220, period: 2600, open: 0.5, offset: 0.33, look: "neck" },
        { x1: 270, y1: 80, x2: 300, y2: 220, period: 2600, open: 0.5, offset: 0.66, look: "neck" },
      ],
      powerups: [pad(95, 110, "cannon")],
      decor: [deco("fern", 45, 70), deco("cycad", 30, 250), deco("fern", 375, 245), deco("tracks", 210, 262, 0.8), deco("dragonfly", 360, 70)],
    }),

    // 14: a big C round the T-rex's patch: he stomps up and down the bend,
    // and his nest sits by the cup.
    h({
      name: "T-Rex Territory",
      par: 4,
      quip: "STOMP. STOMP. He can't see you if you putt really fast.",
      ground: "dirt",
      tee: pt(70, 80),
      cup: pt(70, 220),
      outline: [pt(35, 45), pt(365, 45), pt(365, 255), pt(35, 255), pt(35, 185), pt(290, 185), pt(290, 115), pt(35, 115)],
      movers: [{ x: 327, y: 150, r: 16, dx: 10, dy: 50, period: 3000, look: "trex" }],
      bumpers: [bump(190, 220, 11, "nest"), bump(130, 203, 7, "egg"), bump(130, 238, 7, "egg")],
      powerups: [pad(340, 65, "ghost")],
      decor: [deco("tracks", 120, 80, 1), deco("tracks", 240, 230, -1), deco("ribs", 160, 150, 0.9), deco("fern", 250, 150, 0.8), deco("cycad", 20, 150, 0.8), deco("rocks", 380, 280, 0.7)],
    }),

    // 15: two lava rivers, a bone bridge over each at opposite ends, and a
    // triceratops pacing between them.
    h({
      name: "Lava River Run",
      par: 4,
      quip: "Two lava rivers, two bone bridges, one cranky triceratops.",
      liquid: "lava",
      ground: "dirt",
      tee: pt(65, 215),
      cup: pt(335, 85),
      outline: [pt(30, 60), pt(60, 40), pt(340, 40), pt(370, 60), pt(370, 240), pt(340, 260), pt(60, 260), pt(30, 240)],
      water: [
        [pt(115, 20), pt(160, 20), pt(150, 280), pt(105, 280)],
        [pt(245, 20), pt(290, 20), pt(300, 280), pt(255, 280)],
      ],
      bridges: [
        { x: 100, y: 52, w: 72, h: 24 },
        { x: 240, y: 212, w: 72, h: 26 },
      ],
      movers: [{ x: 205, y: 150, r: 11, dx: 0, dy: 60, period: 2600, look: "trike" }],
      powerups: [pad(205, 62, "spyglass")],
      decor: [deco("bone", 136, 64, 0.82), deco("bone", 276, 225, 0.82), deco("ribs", 130, 170, 0.6), deco("ribs", 275, 120, -0.6), deco("fern", 20, 280, 0.8), deco("fern", 385, 25, 0.8)],
    }),

    // 16: a pinball table of amber: bumpers with bugs stuck inside, and
    // slingshot banks in the bottom corners.
    h({
      name: "Amber Pinball",
      par: 3,
      quip: "TILT! Bounce off the amber. Yes, those are real mosquitoes.",
      ground: "rock",
      tee: pt(95, 235),
      cup: pt(300, 95),
      outline: [pt(60, 260), pt(40, 120), pt(120, 45), pt(280, 45), pt(360, 120), pt(340, 260)],
      walls: [wall(53, 205, 90, 252), wall(308, 255, 344, 218)],
      bumpers: [
        bump(150, 140, 11, "amber"),
        bump(215, 100, 11, "amber"),
        bump(205, 185, 13, "amber"),
        bump(265, 150, 11, "amber"),
        bump(320, 190, 10, "amber"),
        bump(250, 225, 9, "amber"),
      ],
      powerups: [pad(200, 240, "magnet")],
      decor: [deco("fern", 30, 60), deco("cycad", 375, 60, 0.9), deco("rocks", 20, 270, 0.8), deco("fern", 380, 270, 0.8), deco("dragonfly", 70, 80)],
    }),

    // 17: a meteor crater of black glass funnels into the cup, geysers guard
    // it either side, and lava waits past it.
    h({
      name: "Meteor Crater",
      par: 3,
      quip: "A meteor dug this cup for you. The crater does the rest.",
      liquid: "lava",
      ground: "rock",
      tee: pt(75, 150),
      cup: pt(275, 150),
      outline: [pt(40, 150), pt(70, 70), pt(160, 45), pt(300, 50), pt(365, 110), pt(360, 215), pt(290, 262), pt(150, 262), pt(65, 230)],
      ice: [blob(275, 150, 52, 52, 18, 0.05)],
      water: [[pt(340, 122), pt(358, 116), pt(363, 150), pt(358, 186), pt(340, 178), pt(334, 150)]],
      wells: [
        { x: 275, y: 150, r: 38, pull: 150, look: "crater" },
        { x: 195, y: 100, r: 26, pull: -280, look: "geyser" },
        { x: 195, y: 200, r: 26, pull: -280, look: "geyser" },
      ],
      bumpers: [bump(200, 150, 10, "boulder")],
      powerups: [pad(120, 215, "bigcup")],
      decor: [deco("meteor", 90, 40), deco("rocks", 30, 70), deco("cycad", 25, 250, 0.9), deco("fern", 380, 250, 0.8), deco("rocks", 380, 70, 0.7)],
    }),

    // 18: the finale up the volcano: past the pterodactyl, through the lava
    // tube, down the mud slide past the fire vent and the T-rex, and over the
    // bone bridge to the summit cup in its moat of lava.
    h({
      name: "Volcano Summit",
      par: 5,
      quip: "The big one! Lava, a T-rex and a summit cup. ROAR!",
      liquid: "lava",
      ground: "rock",
      tee: pt(60, 232),
      cup: pt(275, 150),
      outline: [pt(25, 60), pt(110, 40), pt(300, 40), pt(375, 70), pt(375, 240), pt(300, 270), pt(110, 270), pt(25, 240)],
      water: [
        [pt(118, 20), pt(150, 20), pt(152, 290), pt(120, 290)],
        moat(275, 150, 58, 24),
      ],
      bridges: [{ x: 263, y: 168, w: 24, h: 44 }],
      tunnels: [{ a: pt(70, 85), b: pt(190, 62) }],
      spinners: [{ x: 70, y: 160, arm: 34, speed: 2.2, look: "ptero" }],
      slopes: [{ points: rect(158, 105, 54, 55), push: pt(0, 85) }],
      gates: [{ x1: 150, y1: 188, x2: 236, y2: 188, period: 2400, open: 0.5, look: "fire" }],
      movers: [{ x: 275, y: 236, r: 13, dx: 42, dy: 0, period: 3400, look: "trex" }],
      sand: [[pt(165, 215), pt(210, 212), pt(215, 250), pt(170, 255)]],
      powerups: [pad(100, 215, "doubloon"), pad(345, 95, "cannon")],
      decor: [deco("summit", 275, 150), deco("bone", 275, 190, -0.5), deco("meteor", 330, 20), deco("ribs", 135, 120, 0.5), deco("fern", 10, 280, 0.7), deco("rocks", 390, 280, 0.7)],
    }),
  ],
});
