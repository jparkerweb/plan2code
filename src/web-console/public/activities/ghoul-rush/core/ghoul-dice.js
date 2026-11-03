// Plan2Code Web Console - Ghoul Rush's Lucky die: dice kept for the whole run, and the rolls that can turn a lost life into a second chance.
//
// No imports: ghoul.js hands the rules here a kit of its own helpers and
// numbers (SAFE_MS, footing, the edges and `takeLife`), the way it hands
// ghoul-powers.js its POWER_KIT, so this file never reaches back into it.
//
// A Lucky die turns up only as a drop from a kill (see ghoul-powers.js) and
// is kept, with no limit, through every room and stage until used. When
// Planny would lose a life, whatever the cause (a pit, the clock and the
// last life included), a round with dice holds in the phase "ask" and asks
// "Use a Lucky Die?" (Yes spends one, No keeps them all and lets the loss go
// ahead); on Yes it holds in the phase "roll" and rolls
// one on screen, for ROLL_MS: tumbling for TUMBLE_MS, then landing on its face
// for a beat to read. One die a death; the others are kept. DICE_FACES says
// what each face does. A 4, 5 or 6 saves him: he comes back where he died
// (after a pit, on the last solid ground he stood on), safe for SAFE_MS, with
// no life lost, the room as it was and the monsters where they stood. In an
// ordinary room every monster in view then blows apart, which clears whatever
// overlaps him; in a boss's room the safe moment covers him. A 3 or a 2 lets
// the loss go ahead and leaves a gift for when he comes back. A 1 only laughs.
// With no heart left to spare (the last life of the run), a 2, 3 or 4 instead
// pays one heart and lets the loss go ahead: he respawns as usual with it.
// The faces come from the `random` handed to advance(), so a seed plays the
// same. Endless lives never roll.

// The most one bonus round or ride can pay (a cap on what is earned, not on what is held).
export const MAX_DICE = 9;
// Every run starts with these dice in hand.
export const START_DICE = 3;
// What each face does: `revive` saves the life, `give` is handed over with the
// save, `gift` waits for the respawn after the life is lost. `line` is what the
// roll's panel says, `word` what floats up or the gift's banner.
export const DICE_FACES = Object.freeze({
  1: Object.freeze({ line: "Better Luck Next Time" }),
  2: Object.freeze({ gift: Object.freeze(["rocket", "garlic"]), line: "Next life: Rockets + Garlic", word: "Bottle Rockets + Garlic shield" }),
  3: Object.freeze({ gift: Object.freeze(["rapid", "garlic"]), line: "Next life: Rapid fire + Garlic", word: "Rapid fire + Garlic shield" }),
  4: Object.freeze({ revive: true, line: "Back to life!", word: "Back to life!" }),
  5: Object.freeze({ revive: true, give: Object.freeze(["life"]), line: "Back to life, +1 heart!", word: "+1 heart!" }),
  6: Object.freeze({ revive: true, give: Object.freeze(["life", "garlic"]), line: "Back to life, +1 heart + Garlic!", word: "+1 heart + Garlic!" }),
});
// The lead-in: the screen holds under a drone while a die flies from the HUD to the middle and grows into the panel.
export const LEAD_MS = 800;
export const TUMBLE_MS = LEAD_MS + 600;
export const ROLL_MS = LEAD_MS + 3200;
// The clock a saved time-up gets back.
export const SAVED_TIME_MS = 15000;
// The most a pit's revive spot may move along the ground to stand clear of
// the edge, and how much ground it wants on each side.
const CLEAR_REACH = 10;
const CLEAR_SIDE = 2;

// Where Planny stood on solid ground last: kept each slice he is on a
// surface, for the spot a pit fall comes back to.
export function markRest(you) {
  if (you.state !== "run") return;
  you.restX = you.x;
  you.restY = you.y;
}

// Where a saved Planny stands: where he died, or after a pit the last solid
// ground he stood on, moved the least along it to have ground to both sides.
export function reviveSpot(round, kit) {
  const you = round.you;
  if (you.y >= kit.PIT_Y) return { x: you.x, y: you.y, shelf: you.shelf, pit: false };
  const spec = round.spec;
  let x = you.restX;
  let y = you.restY;
  if (x === undefined) {
    x = spec.start;
    y = kit.groundAt(spec, x);
  }
  const holds = (cx) => {
    for (let k = -CLEAR_SIDE; k <= CLEAR_SIDE; k++) {
      const f = kit.footing(round, cx + k, y);
      if (!f || Math.abs(f.y - y) > 0.01) return false;
    }
    return true;
  };
  for (let d = 0; d <= CLEAR_REACH; d++) {
    const at = [x - d, x + d].find((cx) => cx >= kit.leftEdge(round) && cx <= kit.rightEdge(round) && holds(cx));
    if (at !== undefined) {
      x = at;
      break;
    }
  }
  const f = kit.footing(round, x, y);
  return { x, y: f ? f.y : y, shelf: f ? f.shelf : -1, pit: true };
}

// A life about to be lost: with dice in hand (and no endless lives) the round
// holds and ASKS whether to use one ("Use a Lucky Die?", the phase "ask"), since
// the player may want to keep it for later. Whether it did hold.
export function beginRoll(round, cause, kit) {
  if (round.infinite || !(round.dice > 0)) return false;
  const at = reviveSpot(round, kit);
  round.ask = { cause, yes: true, t: 0, x: at.x, y: at.y, shelf: at.shelf, pit: at.pit };
  round.phase = "ask";
  round.phaseMs = 0;
  round.input.jump = 0;
  round.events.push({ type: "diceAsk", cause, n: round.dice, x: at.x, y: at.y });
  return true;
}

// A press in the first ASK_GUARD_MS does nothing: the key that was held or
// mashed as Planny died must not answer for the player.
export const ASK_GUARD_MS = 600;

// One slice of the question: only its clock moves.
export function askStep(round, ms) {
  if (round.ask) round.ask.t += ms;
}

// Which answer is lit: true for "Yes", false for "No".
export function steerAsk(round, yes) {
  if (round.ask) round.ask.yes = yes;
}

// The answer. Yes spends a die and starts the roll; No keeps every die and
// lets the loss go ahead. Whether the answer was taken (not inside the guard).
export function answerAsk(round, yes, kit) {
  const a = round.ask;
  if (!a || a.t < ASK_GUARD_MS) return false;
  round.ask = null;
  round.phaseMs = 0;
  if (!yes) {
    round.phase = "play";
    round.events.push({ type: "diceKeep", cause: a.cause, n: round.dice, x: a.x, y: a.y });
    kit.takeLife(round, a.cause);
    return true;
  }
  round.dice--;
  round.roll = { cause: a.cause, t: 0, face: 0, landed: false, x: a.x, y: a.y, shelf: a.shelf, pit: a.pit };
  round.phase = "roll";
  round.events.push({ type: "diceStart", cause: a.cause, n: round.dice, x: a.x, y: a.y });
  return true;
}

// Whether this face, rolled on the last heart of a run, pays a heart instead.
export const heartFace = (round, face) => !round.bonusRound && round.lives <= 1 && face >= 2 && face <= 4;

// One slice of the roll: the die tumbles, lands on a face from `random`, and
// after its beat that face either saves Planny or lets the loss go ahead
// (`kit.takeLife`), leaving its gift, if any, for the respawn.
export function rollDice(round, ms, random, kit) {
  const r = round.roll;
  const was = r.t;
  r.t += ms;
  // The die leaves the HUD: the drone plays through the lead-in, and the rattle starts when it arrives.
  if (was < LEAD_MS && r.t >= LEAD_MS) round.events.push({ type: "diceRoll", n: round.dice, x: r.x, y: r.y });
  if (!r.landed && r.t >= TUMBLE_MS) {
    r.landed = true;
    r.face = 1 + Math.min(5, Math.floor(random() * 6));
    r.heart = heartFace(round, r.face);
    round.events.push({ type: "diceFace", face: r.face, x: r.x, y: r.y, heart: r.heart });
  }
  if (r.t < ROLL_MS) return;
  const face = DICE_FACES[r.face];
  // On the last heart a 2, 3 or 4 does not save him: it pays one heart, and the
  // loss then goes ahead, so he comes back with that heart the usual way.
  if (r.heart) {
    round.lives++;
    round.events.push({ type: "diceHeart", face: r.face, x: r.x, y: r.y });
    round.roll = null;
    kit.takeLife(round, r.cause);
    return;
  }
  if (face.revive) return revive(round, face, kit);
  round.events.push({ type: "diceFail", face: r.face, x: r.x, y: r.y });
  round.roll = null;
  round.diceGift = r.face;
  kit.takeLife(round, r.cause);
}

// Called by respawn() once Planny is back and the room reset (his shield goes
// with the life lost, so it must come after): a 3 or a 2's gift goes into his hands.
export function giveDiceGift(round, give) {
  const face = round.diceGift;
  const gift = DICE_FACES[face]?.gift;
  round.diceGift = 0;
  if (!gift) return;
  for (const kind of gift) give(round, kind);
  round.events.push({ type: "diceGift", face, x: round.you.x, y: round.you.y });
}

// In an ordinary room the saved life blows apart every monster in view
// (their points, chain and all, but nothing dropped) and what they threw; in
// a boss's room nothing is touched and the safe moment covers him. Monsters a blast leaves behind (a rotter's legs) go with the next
// pass. Returns how many fell.
function blast(round, kit) {
  const lo = round.camX - 2;
  const hi = round.camX + kit.FIELD_W + 2;
  let n = 0;
  for (let pass = 0; pass < 3; pass++) {
    const hit = round.monsters.filter((m) => !m.dead && m.x > lo && m.x < hi);
    if (!hit.length) break;
    for (const m of hit) {
      round.events.push({ type: "diceBlast", kind: m.kind, x: m.x, y: m.y + m.h / 2 });
      kit.kill(round, m, "luck", () => 1);
      n++;
    }
    round.monsters = round.monsters.filter((m) => !m.dead);
  }
  round.bones = round.bones.filter((b) => b.x < lo || b.x > hi);
  return n;
}

// Back on his feet where he died, safe a moment, with what the face gives. A
// shield he already held (a pit, the clock) stays.
function revive(round, face, kit) {
  const r = round.roll;
  const you = round.you;
  round.roll = null;
  Object.assign(you, { x: r.x, y: r.y, vx: 0, out: 0, outKind: "", safeMs: kit.SAFE_MS });
  if (r.pit) Object.assign(you, { vy: 0, state: "run", shelf: r.shelf, coyote: 0, drop: -1, cuttable: false, flapped: false });
  if (r.cause === "time") round.timeMs = SAVED_TIME_MS;
  for (const kind of face.give || []) kit.give(round, kind);
  round.phase = "play";
  round.input.jump = 0;
  const blasted = round.spec.boss ? 0 : blast(round, kit);
  round.events.push({ type: "diceSaved", face: r.face, x: r.x, y: r.y, left: round.dice, blasted });
}
