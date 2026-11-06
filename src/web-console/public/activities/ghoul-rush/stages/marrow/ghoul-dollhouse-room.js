// Plan2Code Web Console - Ghoul Rush's finale, the room for the finale's second kill, Marrow, Every Room at Once (the Eye): data only, no imports. core/ghoul-rooms.js builds it through its room() helper and lists it in FINALE.rooms only once `ready` is true.
//
// A short landing (where the mat ride left YOU), then the dollhouse filling the arena
// (its last FIELD_W, 36 on): three floors, the ground at 6 and two full-width floors at
// 20 and 34 (shelves: jumped up through, dropped through with down, the fast way down),
// three rooms of 32 across each, and a stair of landings at 13 and 27 at each end, since
// a jump tops out at 12. The right end's stair stands clear of the front door at 119.5,
// which stays shut until the Eye is dead and the house has sunk (ghoul-marrow-eye.js).
// These must agree with EYE_FLOORS, EYE_ROOM_W and EYE_COLS there (the suite checks).

export const DOLLHOUSE_ROOM = Object.freeze({
  ready: true,
  id: "dollhouse",
  title: "Every Room at Once",
  sub: "Make yourself at home",
  // The room's spec, in the shape room() in core/ghoul-rooms.js takes.
  spec: {
    length: 132,
    ground: [[0, 132, 6]],
    shelves: [[36, 132, 20], [36, 132, 34], [37, 43, 13], [37, 43, 27], [125, 131, 13], [125, 131, 27]],
    key: null,
    door: 119.5,
    dark: false,
    candy: [[8, 8.5, 4]],
    items: [["garlic", 18, 6], ["dyn", 28, 6]],
    spawns: [],
    boss: "marroweye",
  },
});
