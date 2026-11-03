// Plan2Code Web Console - Ghoul Rush, the twelfth activity: a dark haunted house seen side on, Planny running, jumping and blasting his flashlight through it room by room, the zombies, crawlers, bats, ghosts, skeletons, hellhounds, widows, wraiths, bloaters and bosses, and the game contract.
//
// The Activities window (screens/activities.js) drives everything: it ticks
// the game, hands it keys (and their releases) and pauses it. A game never
// runs a timer or listens for a key of its own, so a paused game cannot move.
// The rules are plain functions over a round object (newRound, roomFor,
// stagesLeft, steerPick, pickStage, steerSelect, takeSelect, groundAt,
// footing, jumpHeightAt, jump, moveYou, spawnMonster, hurt, kill, lose,
// applyPower, advance, underBanner), exported so the unit suite can
// drive them without a canvas; the rooms live in ghoul-rooms.js, the
// power-ups and pickups in ghoul-powers.js, the run flow (rounds, the stage
// pick, the camera, respawns and spawners) in ghoul-run.js and the drawing (and what each
// event looks and sounds like) in ghoul-draw.js, and
// the default export is the contract every listed game answers.
//
// Planny sprints left to right through a haunted mansion, the camera
// scrolling with him: held arrows run, up jumps (let go early for a short
// hop), space fires his flashlight blaster the way he faces (hold it to keep
// firing), and down ducks on the ground or drops through a shelf. Each room's door opens once he grabs its key. A run starts in a
// long hall, then goes stage by stage (three rooms, then a boss whose fall
// opens the door), each next stage picked from two not yet played that run;
// clearing every stage wins. Every other room keeps a horde pouring in from
// the edges of the view, so standing still is never safe. Kills in quick succession build a chain that multiplies their points
// and runs out fast; a shot to the head or a stomp from above doubles a
// kill. Souls (the `candy` in the rules), power-ups (spread shot, rapid
// fire, a garlic shield, an extra life, a lantern, bat wings, a church bell
// and an hourglass) and a time bonus per room add up. Every room but a boss's has
// a clock, and a crowd of the dead piles up to reach him on a shelf above. A
// hit, a fall or the clock running out costs one of seven lives and puts him
// back at the room's start, safe for a moment. Each stage cleared makes the
// next quicker and tougher, and the memo keeps the most stages ever cleared
// in one run.
//
// This file is only the game's public face, so the page and the tests have one
// place to import from. The game itself is in its parts:
//
//   core/ghoul-tables.js: numbers and tables: every timing and size the rules share, the monsters and bosses with each stage pack's joined in (PACKS), the seeded dice, and a room's numbers at a depth (roomFor).
//   core/ghoul-planny.js: ground and Planny: what stands where (surfaces, shelves and landing on them), and how Planny runs, jumps and falls.
//   core/ghoul-monsters.js: monsters: spawning them, how each kind walks, hops, climbs and swoops, and what they throw.
//   core/ghoul-fight.js: bosses and damage: a boss's fight and fall, hurting and killing a monster, and losing a life.
//   core/ghoul-play.js: play loop: the kits it hands its packs and ghoul-run.js (KIT, RUN_KIT), the blaster and bolts, hits, stomps and timers, one slice of play, and advance().
//   core/ghoul-window.js: window: the game's contract with the Activities page (create), its keys and pointer, what fx and sounds its events set off, each room's music (ROOM_MUSIC), and the view handed to the drawing.

export * from "./core/ghoul-tables.js";
export * from "./core/ghoul-planny.js";
export * from "./core/ghoul-monsters.js";
export * from "./core/ghoul-fight.js";
export * from "./core/ghoul-play.js";
export * from "./core/ghoul-window.js";
export { default } from "./core/ghoul-window.js";
