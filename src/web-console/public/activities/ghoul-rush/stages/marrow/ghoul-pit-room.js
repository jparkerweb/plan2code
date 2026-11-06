// Plan2Code Web Console - Ghoul Rush's finale, the room for the finale's third kill, The Heart of Marrow in the Pit: data only, no imports. core/ghoul-rooms.js builds it through its room() helper and lists it in FINALE.rooms once `ready` is true.
//
// The House's true basement, always dark: a short walk in from where the Bone Stair
// drops YOU, then the arena (its last 96 units). The heart stands on a plinth of roots
// between two pits (118 to 124 and 140 to 146; its rules are in ghoul-marrow-heart.js),
// with the floor and three stone ledges on its left to fight from. The door at the end
// is shut until the daylight comes down to it after the heart has stopped.

export const PIT_ROOM = Object.freeze({
  ready: true,
  id: "pit",
  title: "The Pit",
  sub: "It has never once skipped a beat",
  // The room's spec, in the shape room() in core/ghoul-rooms.js takes.
  spec: {
    length: 160,
    ground: [[0, 118, 6], [124, 140, 6], [146, 160, 6]],
    // Stone ledges up the left of the arena, hung with roots.
    shelves: [[80, 90, 13], [94, 104, 19], [106, 114, 13]],
    key: null,
    door: 154,
    dark: true,
    candy: [[16, 8.5, 5], [40, 8.5, 5]],
    items: [["wings", 28, 6], ["garlic", 52, 6]],
    spawns: [],
    boss: "marrowheart",
  },
});
