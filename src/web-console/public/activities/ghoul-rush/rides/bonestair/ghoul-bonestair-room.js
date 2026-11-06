// Plan2Code Web Console - Ghoul Rush's finale, the room for the finale's second ride, down The Bone Stair ahead of the collapse: data only, no imports. core/ghoul-rooms.js builds it through its room() helper and lists it in FINALE.rooms only once `ready` is true.
//
// The Bone Stair, the finale's second BONUS ROUND (see ghoul-bonestair.js and core/ghoul-bonus.js): a run, not a
// walk. After Kill II the House sinks into its cellar and a stairway of bones opens at the door. YOU run down
// an endless spiral stair of bones, about 30 seconds of it at RUN_V, with the house collapsing after YOU: 9
// flights wound round a column of vertebrae, 4 stretches of missing treads to jump, 3 stretches
// that give way under YOU (keep running), 3 hanging ribcages to duck, 4 skeletons climbing up
// at YOU (shoot them), 3 bone hands grabbing at the rail (jump them), 3 blocks of falling masonry
// with their shadows (jump the pile), 3 checkpoints, and off the last step into the Pit's dark.
// Three hearts of its own (`ride.hearts`). No candy and no pickups. The numbers are made by
// prototypes/ghoul-rush-tools/gen-bonestair.mjs.

export const BONESTAIR_ROOM = Object.freeze({
  ready: true,
  id: "bonestair",
  title: "The Bone Stair",
  sub: "Every step down is someone",
  // The room's spec, in the shape room() in core/ghoul-rooms.js takes.
  spec: {
    length: 1294,
    ground: [[0, 20, 36], [1242, 1294, 6]],
    start: 8,
    key: null,
    door: 1284,
    bonus: true,
    dark: false,
    candy: [],
    items: [],
    spawns: [],
    horde: [],
    ride: {
      runner: "bonestair",
      hearts: 3,
      time: 70000,
      finish: 1242,
      how: "UP jump, DOWN duck, hold SPACE to shoot. Never stop: the house is coming down after YOU",
      top: [0, 20, 36],
      flights: [[20, 160, 36, 14], [160, 300, 36, 14], [300, 440, 36, 14], [440, 580, 36, 14], [580, 720, 36, 14], [720, 860, 36, 14], [860, 1000, 36, 14], [1000, 1140, 36, 14], [1140, 1242, 36, 20]],
      gaps: [[60, 67], [476, 484], [772, 779], [1070, 1078]],
      rot: [[366, 414], [746, 802], [1196, 1232]],
      ribs: [[112, 25.1], [528, 25.8], [896, 33.9]],
      skels: [[352], [628], [958], [1182]],
      hands: [[198], [672], [1110]],
      stones: [[252], [830], [1038]],
      surge: [[1000, 1242, 4]],
      checks: [312, 592, 872],
    },
  },
});
