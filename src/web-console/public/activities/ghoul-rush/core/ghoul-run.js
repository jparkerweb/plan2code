// Plan2Code Web Console - Ghoul Rush's run flow: starting a round, setting up each room, the stage pick (stagesLeft, steerPick, pickStage), the stage select for testing (openSelect, steerSelect, takeSelect), out of a room into the next, the camera, a respawn, the arena lock and clearing a room, and the room's spawners, horde and hurry zombies.
//
// No imports: ghoul.js hands the rules here a kit of its own helpers and
// numbers (roomFor, makeBoss, timeFor, the room and stage tables and the
// timings), the way it hands a stage pack its KIT, so this file never
// reaches back into it. ghoul.js re-exports what it always exported from
// here (newRound, stagesLeft, steerPick, pickStage), binds the rest to its
// RUN_KIT, and calls them where the rules run.

// Everything in a room that comes back after a life lost: its monsters and
// what they threw, its spawners, its crumbling boards, the boss's place.
export function resetRoom(round, kit) {
  const { HURRY_MS, makeBoss } = kit;
  const spec = round.spec;
  round.monsters.length = 0;
  round.bones.length = 0;
  round.waves.length = 0;
  round.puddles.length = 0;
  round.hazards.length = 0;
  round.shots.length = 0;
  round.hordeMs = spec.hordeMs;
  round.spawns = spec.spawns.map(() => ({ over: false, on: false, done: 0, t: 0 }));
  round.shake = spec.shelves.map(() => 0);
  round.down = spec.shelves.map(() => 0);
  round.hurryMs = HURRY_MS;
  // The bell's freeze and a stage's twist state (the Chapel's bell, the
  // Sanatorium's lamps and their blackout) start over.
  round.stunMs = 0;
  round.twist = null;
  round.blackout = false;
  round.tap = null;
  round.fireMs = 0;
  round.heat = 0;
  round.coolMs = 0;
  if (round.boss && round.boss.state !== "down") {
    const hp = round.boss.hp;
    round.boss = Object.assign(makeBoss(round), { hp });
    round.lockX = -1;
  }
}

// Sets the round up in the room `id`, as deep as the stages already
// cleared: dark or lit (rolled from the run's seed and the room's count, so
// a seed always plays the same), Planny at its door in, the key back in
// place, every candy and power-up out (the room's `loot`, each placed one's
// kind), the bonus full.
export function setupRoom(round, id, kit) {
  const { CHANDELIER_Y, DARK_CHANCE, BONUS_START, roomFor, seeded, powerHere, pickPower, makeYou, makeBoss, groundAt, timeFor } = kit;
  const spec = roomFor(id, round.cleared.length);
  round.spec = spec;
  const roll = seeded((round.seed ^ Math.imul(round.room, 0x9e3779b1)) >>> 0);
  round.dark = spec.dark ?? roll() < DARK_CHANCE;
  round.loot = spec.items.map(([kind]) => (powerHere(round, kind) ? kind : pickPower(roll, round, "life")));
  round.you = Object.assign(makeYou(spec.start, groundAt(spec, spec.start)), round.you ? { garlic: round.you.garlic, hat: round.you.hat } : {});
  round.lockX = -1;
  round.boss = spec.boss ? makeBoss(round) : null;
  round.hasKey = false;
  round.candy = spec.candyAt.map(() => false);
  round.items = spec.items.map(() => false);
  round.sky = spec.sky.map(() => false);
  round.strays = 0;
  round.drops.length = 0;
  round.falls = spec.chandeliers.map((x) => ({ x, y: CHANDELIER_Y, vy: 0, shake: 0, state: "hang" }));
  round.bonus = BONUS_START;
  round.bonusMs = 0;
  round.timeMs = timeFor(spec);
  round.climbSeen = false;
  if (round.effects) round.effects.bell = 0;
  round.armGift = false;
  round.armBossDmg = 0;
  round.armCool = 0;
  round.hurry = false;
  round.roomLost = false;
  // Retry mercy counts the restarts of this room (ghoul-powers.js).
  round.retries = { room: round.room, n: 0 };
  round.clock = 0;
  // The Heart's HOLD FIRE is off until its pack says (ghoul-marrow-heart.js).
  round.flood = false;
  // A bonus room plays for hearts of its own (ghoul-bonus.js).
  round.bonusRound = spec.bonus ? kit.makeBonus(round) : null;
  kit.place(round);
  round.camX = camTarget(round, kit);
  round.input.jump = 0;
  resetRoom(round, kit);
}

export function newRound(seed, kit) {
  const { ROOMS, START_LIVES, START_DICE, TIMED } = kit;
  const round = {
    seed,
    // Rooms entered this run (the hall is 1), the stage being played (null
    // in the hall), how far into its rooms, the stages cleared in order, and
    // while you choose, the stages offered and the one picked out.
    room: 1,
    // Whether this room is dark, and what its placed power-ups are.
    dark: true,
    loot: [],
    stage: null,
    stageAt: 0,
    cleared: [],
    offer: null,
    pick: 0,
    won: false,
    spec: null,
    you: null,
    monsters: [],
    shots: [],
    bones: [],
    waves: [],
    puddles: [],
    // What a boss leaves on the field that hurts (a stone fist), by kind.
    hazards: [],
    drops: [],
    boss: null,
    lives: START_LIVES,
    // Lucky dice kept for the run, and the roll in hand while a life is at stake.
    dice: START_DICE,
    roll: null,
    ask: null,
    // The bonus room's own hearts and result, null elsewhere (ghoul-bonus.js).
    bonusRound: null,
    // The secondary weapons in the bag, the latest picked up first, and whether one has been used yet (ghoul-arms.js).
    arms: [],
    armUsed: false,
    score: 0,
    chain: 0,
    chainMs: 0,
    effects: Object.fromEntries(TIMED.map((k) => [k, 0])),
    phase: "play",
    phaseMs: 0,
    clock: 0,
    camX: 0,
    lockX: -1,
    hordeMs: 0,
    input: { up: false, down: false, left: false, right: false, fire: false, jump: 0 },
    events: [],
    over: false,
    stats: { kills: 0, bestChain: 0, headshots: 0, stomps: 0, candy: 0, crystals: 0, rooms: 0, bosses: 0, stages: 0, shots: 0 },
  };
  setupRoom(round, ROOMS[0].id, kit);
  return round;
}

// The stages not yet played this run, in STAGES order.
export const stagesLeft = (round, kit) => kit.STAGES.filter((st) => !round.cleared.includes(st.id) && st.id !== round.stage);

// Out of a room: the stage's next room, or, out of the hall or a boss's,
// the choice of what comes next; RUN_STAGES cleared (or none left to offer),
// the finale; out of the finale's last room, the win.
export function nextRoom(round, random, kit) {
  const { OFFER_N, PICK_HOLD_MS, RUN_STAGES, FINALE, stageById } = kit;
  const st = round.stage ? stageById(round.stage) : null;
  if (st && round.stageAt < st.rooms.length - 1) {
    round.stageAt++;
    enter(round, st.rooms[round.stageAt], kit);
    return;
  }
  if (st) {
    // The finale's end is the run's end, not one more stage cleared.
    if (st.id === FINALE.id) {
      round.stage = null;
      return finish(round, kit);
    }
    round.cleared.push(st.id);
    round.stats.stages++;
    round.stage = null;
    round.events.push({ type: "stageClear", stage: st.id, n: round.cleared.length, of: RUN_STAGES });
  }
  const left = stagesLeft(round, kit);
  if (round.cleared.length >= RUN_STAGES || !left.length) return enterFinale(round, kit);
  const pool = left.slice();
  const offer = [];
  while (offer.length < OFFER_N && pool.length) offer.push(pool.splice(Math.floor(random() * pool.length) % pool.length, 1)[0].id);
  round.offer = offer;
  round.pick = 0;
  round.phase = "pick";
  round.phaseMs = PICK_HOLD_MS;
  round.input.jump = 0;
  round.events.push({ type: "offer", offer: offer.slice() });
}

// Into the House itself, the way a picked stage is entered but never offered:
// its card, then its first room.
function enterFinale(round, kit) {
  const { FINALE, RUN_STAGES } = kit;
  round.offer = null;
  round.stage = FINALE.id;
  round.stageAt = 0;
  round.events.push({ type: "stage", stage: FINALE.id, n: RUN_STAGES, of: RUN_STAGES });
  enter(round, FINALE.rooms[0], kit);
  startIntro(round, kit);
}

// The House killed for good: the run is won. `n` is the record it sets: one
// past every stage, which the memo reads as the House beaten.
function finish(round, kit) {
  round.winN = kit.RUN_STAGES + 1;
  // The ending's pages first, when there are any (story/ghoul-ending.js); they win the run at their end.
  if (kit.beginEnding(round)) return;
  round.won = true;
  round.over = true;
  round.events.push({ type: "won", stages: round.cleared.length, n: round.winN });
}

// A stage's intro card (ghoul-intros.js, drawn by ghoul-intro-draw.js) holds
// the first room's "Ready?" back until YOU press a key: any move (left, right,
// up, down), fire, or a click moves it on, and not before INTRO_MIN_MS (so a
// key still held never skips it; a key repeat never counts). It never moves on
// by itself: it waits as long as YOU like (a pause holds it). Only entering a
// stage's first room.
export const INTRO_MIN_MS = 1200;

function startIntro(round, kit) {
  if (!kit.introFor(round.stage)) return;
  // The room's own announcement waits for the end of the card.
  const at = round.events.findIndex((e) => e.type === "room");
  if (at >= 0) round.events.splice(at, 1);
  round.phase = "intro";
  round.phaseMs = 0;
  round.introMs = 0;
  round.input.jump = 0;
  round.events.push({ type: "intro", stage: round.stage });
}

// Whether a full-field card (a stage's intro or a boss's) is up.
export const onCard = (round) => round.phase === "intro" || round.phase === "bossintro";

// A boss room's intro card (ghoul-boss-intros.js, drawn by ghoul-bossintro-draw.js):
// the same rules as the stage's card, shown once when the boss room is entered
// (after the last room or the bonus ride, or from the stage select), never on
// a respawn. The boss room is already set up behind it.
function startBossIntro(round, kit) {
  const id = round.spec && round.spec.boss;
  if (!id || !kit.bossIntroFor(id)) return;
  const at = round.events.findIndex((e) => e.type === "room");
  if (at >= 0) round.events.splice(at, 1);
  round.phase = "bossintro";
  round.phaseMs = 0;
  round.introMs = 0;
  round.input.jump = 0;
  round.events.push({ type: "bossIntro", boss: id, stage: round.stage });
}

function endIntro(round, kit) {
  round.phase = "ready";
  round.phaseMs = round.bonusRound ? (round.spec.ride && round.spec.ride.ready) || kit.BONUS_READY_MS : kit.READY_MS;
  round.input.jump = 0;
  round.events.push({ type: "room", room: round.room });
}

// One slice of the card: it only counts the time (the lockout and the animation).
export function stepIntro(round, ms) {
  round.introMs = (round.introMs || 0) + ms;
}

// A move key, fire or a click: on into the room, once the card has been up a moment.
export function takeIntro(round, kit) {
  if (!onCard(round) || (round.introMs || 0) < INTRO_MIN_MS) return false;
  // A stage that opens on its boss's room (the finale) shows the boss's card after its own.
  if (round.phase === "intro" && round.spec && round.spec.boss) {
    startBossIntro(round, kit);
    if (round.phase === "bossintro") return true;
  }
  endIntro(round, kit);
  return true;
}

function enter(round, id, kit) {
  round.room++;
  setupRoom(round, id, kit);
  round.phase = "ready";
  round.phaseMs = round.bonusRound ? (round.spec.ride && round.spec.ride.ready) || kit.BONUS_READY_MS : kit.READY_MS;
  // A bonus room announces itself before its name.
  if (round.bonusRound) round.events.push({ type: "bonusStart", hearts: round.bonusRound.hearts, max: round.bonusRound.max, how: round.spec.ride ? round.spec.ride.how : undefined });
  round.events.push({ type: "room", room: round.room });
  startBossIntro(round, kit);
}

// While choosing: `dir` -1 or 1 moves the pick between what is offered.
export function steerPick(round, dir) {
  if (round.phase !== "pick" || !round.offer || round.offer.length < 2) return false;
  const next = Math.max(0, Math.min(round.offer.length - 1, round.pick + Math.sign(dir)));
  if (next === round.pick) return false;
  round.pick = next;
  round.events.push({ type: "pickMove", pick: next });
  return true;
}

// The stage offered at `i` (the one picked out, by default) is taken: into
// its first room. Not while the offer is still settling (PICK_HOLD_MS), so a
// fire key still held from the fight never chooses blind.
export function pickStage(round, i = round.pick, kit) {
  const { RUN_STAGES, stageById } = kit;
  if (round.phase !== "pick" || !round.offer || round.phaseMs > 0) return false;
  const id = round.offer[i];
  const st = id && stageById(id);
  if (!st) return false;
  round.offer = null;
  round.stage = st.id;
  round.stageAt = 0;
  round.events.push({ type: "stage", stage: st.id, n: round.cleared.length + 1, of: RUN_STAGES });
  enter(round, st.rooms[0], kit);
  startIntro(round, kit);
  return true;
}

// The stage select (the window's stage code, for testing): every stage and
// each of its rooms to choose from, before anything moves. A round opened
// here is practice, and never kept as a record.
export function openSelect(round) {
  round.phase = "select";
  round.select = { at: 0, room: 0 };
  round.practice = true;
  round.events.push({ type: "offer", offer: [] });
}

// While on the stage select: `dStage` moves between the stages, `dRoom`
// between the rooms of the one picked out.
export function steerSelect(round, dStage, dRoom, kit) {
  const sel = round.select;
  if (round.phase !== "select" || !sel) return false;
  const at = Math.max(0, Math.min(kit.SELECTABLE.length - 1, sel.at + Math.sign(dStage)));
  const rooms = kit.SELECTABLE[at].rooms.length;
  const room = Math.max(0, Math.min(rooms - 1, (at === sel.at ? sel.room : Math.min(sel.room, rooms - 1)) + Math.sign(dRoom)));
  if (at === sel.at && room === sel.room) return false;
  sel.at = at;
  sel.room = room;
  round.events.push({ type: "pickMove", pick: at });
  return true;
}

// The stage and room picked out on the stage select are taken: straight into
// that room, the rest of its stage after it as usual.
export function takeSelect(round, kit) {
  const sel = round.select;
  if (round.phase !== "select" || !sel) return false;
  const st = kit.SELECTABLE[sel.at];
  round.select = null;
  round.stage = st.id;
  round.stageAt = sel.room;
  round.events.push({ type: "stage", stage: st.id, n: 1, of: kit.RUN_STAGES });
  enter(round, st.rooms[sel.room], kit);
  if (!sel.room) startIntro(round, kit);
  return true;
}

// Where the camera wants to be: a little behind you, leading the way you face.
function camTarget(round, kit) {
  const { FIELD_W, CAM_AT, CAM_LEAD, clamp } = kit;
  const spec = round.spec;
  const you = round.you;
  const lo = round.lockX >= 0 ? round.lockX : 0;
  return clamp(you.x - FIELD_W * CAM_AT + you.face * CAM_LEAD + (round.camLead || 0), lo, Math.max(lo, spec.length - FIELD_W));
}

export function camera(round, ms, kit) {
  const target = camTarget(round, kit);
  round.camX += (target - round.camX) * Math.min(1, (kit.CAM_EASE * ms) / 1000);
  if (round.lockX >= 0) round.camX = Math.max(round.camX, round.lockX);
}

// After a crash: out of lives, the round is over; else back at the room's
// start (or the arena's, in a locked boss fight), the room's monsters back
// where they began, safe for a moment, after a short hold.
export function respawn(round, kit) {
  const { BOSS_LOCK, SAFE_MS, READY_MS, groundAt, timeFor } = kit;
  // A bonus round with no hearts left ends with no dice; the run goes on, its lives untouched.
  if (round.bonusRound && round.bonusRound.hearts <= 0 && kit.endBonus(round, false)) return;
  if (round.lives <= 0) {
    round.over = true;
    return;
  }
  const spec = round.spec;
  // In a boss's arena (fighting it, or after it fell), back to the arena's
  // spot, never across the room.
  const inArena = round.lockX >= 0;
  const locked = inArena && round.boss && round.boss.state !== "down";
  resetRoom(round, kit);
  round.timeMs = timeFor(spec);
  const x = inArena ? spec.arena + BOSS_LOCK + 2 : spec.start;
  const you = round.you;
  Object.assign(you, { x, y: groundAt(spec, x), vx: 0, vy: 0, state: "run", shelf: -1, coyote: 0, drop: -1, out: 0, outKind: "", safeMs: SAFE_MS, face: 1, aliveMs: 0, flingMs: 0, heldMs: 0, dimMs: 0, dimBy: 0 });
  // A ride puts him back at its last checkpoint.
  kit.place(round);
  if (locked) lockArena(round);
  round.camX = camTarget(round, kit);
  round.phase = "ready";
  round.phaseMs = READY_MS;
  round.input.jump = 0;
  round.events.push({ type: "respawn", x: you.x, y: you.y, lives: round.lives, hearts: round.bonusRound ? round.bonusRound.hearts : undefined });
  // What a Lucky die's 3 or 2 left for this moment (ghoul-dice.js).
  kit.diceGift(round);
  if (round.quickLoss && !you.garlic) {
    you.garlic = true;
    round.events.push({ type: "power", kind: "garlic", x: you.x, y: you.y + 2.5, points: 0, gift: true });
  }
  round.quickLoss = false;
  // A power-up a few steps ahead, on every restart of the room (ghoul-powers.js).
  kit.mercy(round);
}

export function lockArena(round) {
  round.lockX = round.spec.arena;
  if (round.boss.state === "sleep") {
    round.boss.state = "intro";
    round.boss.t = 0;
    round.events.push({ type: "bossWake", kind: round.boss.kind, x: round.boss.x, y: round.boss.y });
  }
}

// Through the door: points for the room and the bonus left, then a hold.
export function clearRoom(round, kit) {
  if (round.bonusRound) {
    kit.endBonus(round, true);
    return;
  }
  const { ROOM_POINTS, FLAWLESS_POINTS, CLEAR_MS, award } = kit;
  const n = round.room;
  round.retries = null;
  const bonus = round.bonus;
  const flawless = !round.roomLost;
  const points = ROOM_POINTS * n + bonus + (flawless ? FLAWLESS_POINTS : 0);
  award(round, points);
  round.stats.rooms++;
  round.phase = "clear";
  round.phaseMs = CLEAR_MS;
  round.input.jump = 0;
  round.events.push({ type: "clear", room: n, points, bonus, flawless, x: round.you.x, y: round.you.y });
}

// The spawners the camera has reached wake, in their own ways.
export function spawners(round, ms, random, kit) {
  const { FIELD_W, SPAWN_AHEAD, DOOR_CLEAR, EMERGE_MS, CRAWL_NEAR, SPIDER_Y, GHOST_SHOW_MS, GHOST_HIDE_MS, MONSTERS, variant, spawnMonster, groundAt } = kit;
  const spec = round.spec;
  const you = round.you;
  const right = round.camX + FIELD_W + SPAWN_AHEAD;
  spec.spawns.forEach((s, i) => {
    const st = round.spawns[i];
    if (st.over) return;
    const [kind, x] = s;
    if (x > right) return;
    if (kind === "door") {
      if (x > round.camX + FIELD_W - 6) return;
      // A door left far behind lets nobody else out.
      if (x < round.camX - 20) {
        st.over = true;
        return;
      }
      if (!st.on) {
        st.on = true;
        st.t = 300;
      }
      st.t -= ms;
      if (st.t > 0 || Math.abs(you.x - x) < DOOR_CLEAR) return;
      if (spawnMonster(round, variant(s[4] || "zombie", random), x, groundAt(spec, x), { door: true, rise: EMERGE_MS })) {
        round.events.push({ type: "door", x, y: groundAt(spec, x) });
        st.done++;
      }
      st.t = s[3] * spec.every;
      if (st.done >= s[2] + spec.extra) st.over = true;
      return;
    }
    if (kind === "crawl") {
      if (Math.abs(you.x - x) > CRAWL_NEAR) return;
      st.over = Boolean(spawnMonster(round, "crawler", x, groundAt(spec, x)));
      return;
    }
    const k = variant(kind === "skel" ? "skeleton" : kind, random);
    const y = kind === "bat" || kind === "ghost" || kind === "skel" || kind === "wraith" || MONSTERS[k].perch ? s[2] : k === "spider" ? SPIDER_Y : groundAt(spec, x);
    // Ghosts in a room fade in and out out of step with each other.
    st.over = Boolean(spawnMonster(round, k, x, y, k === "ghost" ? { phase: (x * 97) % (GHOST_SHOW_MS + GHOST_HIDE_MS) } : {}));
  });
}

// The room's horde: every so often one of its kinds comes in from an edge
// of the view, mostly the one ahead. Never in a boss's room.
// Whether one coming in from the edge `side` (-1 left, 1 right) is let in:
// always, but for one behind you in a dark room DARK_BEHIND of the time.
const comesIn = (round, side, random, kit) => !round.dark || side !== -round.you.face || random() < kit.DARK_BEHIND;

export function horde(round, ms, random, kit) {
  const { FIELD_W, CHANDELIER_Y, MAX_MONSTERS, HORDE_ROOM, HORDE_WITH, MONSTERS, variant, spawnMonster, groundAt } = kit;
  const spec = round.spec;
  if (!spec.horde.length || round.boss) return;
  round.hordeMs -= ms;
  if (round.hordeMs > 0) return;
  round.hordeMs = spec.hordeMs * spec.every * (0.75 + random() * 0.5);
  if (round.monsters.length >= MAX_MONSTERS - HORDE_ROOM) return;
  const kind = variant(spec.horde[Math.floor(random() * spec.horde.length) % spec.horde.length], random);
  for (const side of random() < 0.7 ? [1, -1] : [-1, 1]) {
    const x = side > 0 ? round.camX + FIELD_W + 3 : round.camX - 3;
    if (x < 4 || x > spec.length - 8) continue;
    if (kind === "bat" || MONSTERS[kind].flies) {
      if (!comesIn(round, side, random, kit)) return;
      spawnMonster(round, kind, x, CHANDELIER_Y - 6, { horde: true, ...HORDE_WITH[kind] });
      return;
    }
    const g = groundAt(spec, x);
    if (g === -Infinity) continue;
    if (!comesIn(round, side, random, kit)) return;
    spawnMonster(round, kind, x, g, { horde: true });
    return;
  }
}

// With the bonus gone, a zombie shambles in from an edge every HURRY_MS.
export function hurry(round, ms, random, kit) {
  const { FIELD_W, HURRY_MS, variant, spawnMonster, groundAt } = kit;
  // A ride has its boulder for hurry: no zombies shamble in over its cave floors.
  if (!round.hurry || round.boss || round.spec.ride) return;
  round.hurryMs -= ms;
  if (round.hurryMs > 0) return;
  round.hurryMs = HURRY_MS * round.spec.every;
  const spec = round.spec;
  for (const x of [round.camX + FIELD_W + 2, round.camX - 2]) {
    const g = groundAt(spec, x);
    if (g > -Infinity && x > 2 && x < spec.length - 6) {
      if (comesIn(round, x > round.camX ? 1 : -1, random, kit)) spawnMonster(round, variant("zombie", random), x, g, { horde: true });
      return;
    }
  }
}
