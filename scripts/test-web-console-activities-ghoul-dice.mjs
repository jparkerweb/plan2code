// Web console tests, Ghoul Rush's Lucky die: it comes only from a kill, stacks to nine and lasts the run; when a life would be lost one rolls: a 4 to 6 brings Planny back (the monsters in view blown apart in an ordinary room, a boss's room untouched; a 5 adds a heart, a 6 a heart and a Garlic shield), a 3 or 2 costs the life and leaves a gift for the respawn, a 1 only laughs.
import "./seed-random.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul-rush/ghoul.js";
import { pickPower } from "../src/web-console/public/activities/ghoul-rush/core/ghoul-powers.js";
import { react } from "../src/web-console/public/activities/ghoul-rush/draw/ghoul-draw.js";
import { toneNames } from "../src/web-console/public/tones.js";

const steady = () => 0.5;
// Answer "Use a Lucky Die?" once the guard is past (nothing happens when no question is up).
const accept = (round, yes = true) => {
  if (round.phase !== "ask") return false;
  round.ask.t = ghoul.ASK_GUARD_MS;
  return ghoul.answerDie(round, yes);
};
// A life lost, the question answered Yes: the old automatic roll.
const lose = (round, cause) => {
  const r = ghoul.lose(round, cause);
  accept(round);
  return r;
};
const events = (round, type) => round.events.filter((e) => e.type === type);
// A random that plays `values` in order, then 0.5.
const rolls = (...values) => {
  const rest = values.slice();
  return () => (rest.length ? rest.shift() : 0.5);
};
const SIX = 0.99;
const FIVE = 0.7;
const FOUR = 0.55;
const THREE = 0.4;
const TWO = 0.2;
const ONE = 0;

function through(round) {
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, steady);
}

function stand(round, x) {
  Object.assign(round.you, { x, y: ghoul.groundAt(round.spec, x), vx: 0, vy: 0, state: "run", shelf: -1, coyote: 0, drop: -1, out: 0, safeMs: 0 });
  round.camX = Math.max(0, Math.min(round.spec.length - ghoul.FIELD_W, x - 30));
}

// A quiet round in the hall, Planny standing at x = 100, nothing awake.
function hall(dice = 0) {
  const round = ghoul.newRound(5);
  round.lives = 3;
  for (const st of round.spawns) st.over = true;
  round.monsters.length = 0;
  round.hordeMs = Infinity;
  stand(round, 100);
  round.dice = dice;
  round.events.length = 0;
  return round;
}

function zombie(round, x) {
  return ghoul.spawnMonster(round, "zombie", x, ghoul.groundAt(round.spec, x), { rise: 0, awake: true });
}

// Into the stage `id`, up to its room `room`, quiet, Planny safe.
function inRoom(round, id, room) {
  through(round);
  round.offer = [id];
  round.phaseMs = 0;
  ghoul.pickStage(round, 0);
  while (round.spec.id !== room) through(round);
  round.phase = "play";
  for (const st of round.spawns) st.over = true;
  round.monsters.length = 0;
  round.hordeMs = Infinity;
  round.events.length = 0;
  return round;
}

test("Ghoul Rush: a Lucky die is as common as a 1UP, comes only as a drop, and is never placed in a room or swapped in for a placed power-up", () => {
  assert.equal(ghoul.POWERS.die.weight, ghoul.POWERS.life.weight);
  assert.equal(ghoul.POWERS.die.drop, true);
  assert.equal(ghoul.POWERS.die.ms, undefined, "not a timed power-up");
  for (const room of ghoul.ROOMS) {
    const spec = ghoul.roomFor(room.id);
    assert.ok(![...spec.items, ...spec.sky].some(([kind]) => kind === "die"), `${room.id} places none`);
  }
  const round = hall();
  let dropped = 0;
  for (let k = 0; k < 400; k++) {
    const r = k / 400;
    assert.notEqual(pickPower(() => r, round), "die", "never picked for a placed one");
    assert.notEqual(pickPower(() => r, round, "life"), "die");
    if (pickPower(() => r, round, "", true) === "die") dropped++;
  }
  assert.ok(dropped > 0, "but dropped now and then");
  for (let seed = 1; seed <= 40; seed++) assert.ok(!ghoul.newRound(seed).loot.includes("die"));
  // A kill whose roll lands on the die's slice drops it.
  const dark = hall();
  dark.dark = true;
  const m = zombie(dark, 120);
  const values = [0, 0.99];
  ghoul.kill(dark, m, "shot", () => values.shift() ?? 0);
  assert.equal(dark.drops.length, 1, "a kill drops a power-up on a low roll");
});

test("Ghoul Rush: picking up Lucky dice stacks them to MAX_HELD_DICE (13), then pays points like a 1UP at its cap, and the dice show in a pill", () => {
  const round = hall();
  const drop = { id: 1, kind: "die", x: round.you.x, y: round.you.y + 1, vx: 0, vy: 0, life: 9000, rest: true };
  round.drops.push(drop);
  ghoul.advance(round, 4, steady);
  assert.equal(round.dice, 1);
  assert.equal(round.drops.length, 0);
  assert.equal(events(round, "power")[0].kind, "die");
  assert.equal(ghoul.MAX_HELD_DICE, 13);
  for (let k = 0; k < 20; k++) ghoul.applyPower(round, "die");
  assert.equal(round.dice, ghoul.MAX_HELD_DICE, "stacks to the cap");
  const score = round.score;
  ghoul.applyPower(round, "die");
  assert.equal(round.dice, ghoul.MAX_HELD_DICE, "no more past it");
  assert.equal(round.score, score + ghoul.POWER_POINTS, "points instead");
  const canvas = { getContext: () => null };
  const game = ghoul.default.create({ canvas });
  game.start();
  game.round.dice = 0;
  assert.ok(!game.hud.effects.some((e) => /DICE/.test(e.text)), "no pill without dice");
  game.round.dice = 3;
  const pill = game.hud.effects.find((e) => /DICE/.test(e.text));
  assert.equal(pill.text, "DICE x3");
  assert.equal(pill.color, ghoul.POWERS.die.color);
});

test("Ghoul Rush: dice carry over to the next room and the next stage, and a new round starts with three", () => {
  const round = hall(4);
  round.hasKey = true;
  through(round);
  assert.equal(round.phase, "pick");
  assert.equal(round.dice, 4);
  round.offer = ["manor"];
  round.phaseMs = 0;
  ghoul.pickStage(round, 0);
  assert.equal(round.dice, 4, "into the stage");
  through(round);
  assert.equal(round.dice, 4, "into its next room");
  assert.equal(ghoul.newRound(9).dice, ghoul.START_DICE);
});

test("Ghoul Rush: a fresh run holds 3 Lucky dice, a lost life with one in hand starts the roll, and the dice carry into the hall and the first stage pick", () => {
  assert.equal(ghoul.START_DICE, 3);
  const round = ghoul.newRound(5);
  assert.equal(round.dice, 3, "a run starts with three");
  assert.equal(round.spec.id, "hall");
  for (const st of round.spawns) st.over = true;
  round.monsters.length = 0;
  round.hordeMs = Infinity;
  stand(round, 100);
  lose(round, "zombie");
  assert.equal(round.phase, "roll", "a lost life with a die in hand rolls");
  assert.equal(round.dice, 2, "the roll spends one");
  const next = ghoul.newRound(5);
  next.hasKey = true;
  through(next);
  assert.equal(next.phase, "pick");
  assert.equal(next.dice, 3, "into the first stage pick");
  next.offer = ["manor"];
  next.phaseMs = 0;
  ghoul.pickStage(next, 0);
  assert.equal(next.dice, 3, "into the stage");
});

test("Ghoul Rush: a death with dice holds and rolls just one; a six saves Planny where he stood with a heart and the Garlic shield, the room not reset, and the other dice are kept", () => {
  const round = hall(3);
  const far = zombie(round, round.camX + ghoul.FIELD_W + 40);
  far.hp = 3;
  const x = round.you.x;
  assert.equal(lose(round, "zombie"), true);
  assert.equal(round.phase, "roll");
  assert.equal(round.lives, 3, "no life lost yet");
  assert.equal(round.dice, 2, "the die is in hand");
  assert.equal(events(round, "diceStart").length, 1);
  assert.equal(events(round, "diceRoll").length, 0, "the die is still flying in from the HUD");
  assert.equal(events(round, "lose").length, 0, "not lost");
  const random = rolls(SIX);
  // The lead-in: the die flies in, then the rattle starts.
  ghoul.advance(round, ghoul.LEAD_MS + 8, random);
  assert.equal(events(round, "diceRoll").length, 1);
  assert.equal(events(round, "diceFace").length, 0);
  // Half way through: tumbling, no face yet.
  ghoul.advance(round, (ghoul.TUMBLE_MS - ghoul.LEAD_MS) / 2, random);
  assert.equal(round.phase, "roll");
  assert.equal(events(round, "diceFace").length, 0);
  // It lands, and holds its beat.
  ghoul.advance(round, (ghoul.TUMBLE_MS - ghoul.LEAD_MS) / 2, random);
  assert.deepEqual(events(round, "diceFace").map((e) => e.face), [6]);
  assert.equal(round.phase, "roll");
  ghoul.advance(round, ghoul.ROLL_MS - ghoul.TUMBLE_MS + 8, random);
  assert.equal(events(round, "diceRoll").length, 1, "no second die");
  assert.equal(events(round, "diceSaved").length, 1);
  assert.equal(events(round, "diceFail").length, 0);
  assert.equal(round.phase, "play", "back in play at once");
  assert.equal(round.dice, 2, "the others are kept");
  assert.equal(round.lives, 4, "a heart on top");
  assert.equal(round.you.x, x);
  assert.equal(round.you.garlic, true);
  assert.ok(round.you.safeMs > 0 && round.you.safeMs <= ghoul.SAFE_MS);
  assert.equal(round.you.out, 0);
  assert.equal(round.roll, null);
  assert.equal(events(round, "lose").length, 0);
  assert.equal(events(round, "respawn").length, 0);
  assert.equal(round.roomLost, false);
  assert.ok(round.monsters.includes(far) && !far.dead, "a monster out of view is left where it stands");
  assert.equal(far.hp, 3);
});

test("Ghoul Rush: the same random rolls the same face, and each slice of the die lands on its face", () => {
  const face = (value) => {
    const round = hall(5);
    lose(round, "bone");
    ghoul.advance(round, ghoul.ROLL_MS, rolls(value));
    return events(round, "diceFace").map((e) => e.face);
  };
  assert.deepEqual(face(0.4), face(0.4));
  assert.deepEqual([ONE, 0.2, 0.4, 0.6, 0.8, SIX].flatMap(face), [1, 2, 3, 4, 5, 6]);
});

test("Ghoul Rush: a 5 saves him with a heart and no shield, a 4 just saves him, and a heart has no cap", () => {
  const five = hall(1);
  lose(five, "zombie");
  ghoul.advance(five, ghoul.ROLL_MS + 8, rolls(FIVE));
  assert.equal(five.phase, "play");
  assert.equal(five.lives, 4);
  assert.equal(five.you.garlic, false);
  const four = hall(1);
  lose(four, "zombie");
  ghoul.advance(four, ghoul.ROLL_MS + 8, rolls(FOUR));
  assert.equal(four.phase, "play");
  assert.equal(four.lives, 3);
  assert.equal(four.you.garlic, false);
  assert.ok(four.you.safeMs > 0, "still safe a moment");
  const held = hall(1);
  held.you.garlic = true;
  lose(held, "pit");
  ghoul.advance(held, ghoul.ROLL_MS + 8, rolls(FOUR));
  assert.equal(held.you.garlic, true, "a shield he already held stays");
  const some = hall(1);
  some.lives = 9;
  lose(some, "zombie");
  ghoul.advance(some, ghoul.ROLL_MS + 8, rolls(FIVE));
  assert.equal(some.lives, 10, "a heart under the cap");
  const full = hall(1);
  full.lives = ghoul.MAX_LIVES;
  const score = full.score;
  lose(full, "zombie");
  ghoul.advance(full, ghoul.ROLL_MS + 8, rolls(FIVE));
  assert.equal(full.lives, ghoul.MAX_LIVES, "never past MAX_LIVES (13)");
  assert.equal(full.score, score + ghoul.POWER_POINTS, "points instead");
});

test("Ghoul Rush: a 3 costs the life and he comes back with Rapid fire and a Garlic shield, a 2 with Bottle Rockets and a Garlic shield", () => {
  for (const [value, check] of [
    [THREE, (round) => assert.equal(round.effects.rapid, ghoul.POWERS.rapid.ms)],
    [TWO, (round) => assert.deepEqual(round.arms.map((a) => [a.kind, a.n]), [["rocket", ghoul.POWERS.rocket.sticks]])],
  ]) {
    const round = hall(2);
    lose(round, "zombie");
    ghoul.advance(round, ghoul.ROLL_MS + 8, rolls(value));
    assert.equal(round.phase, "crash", "the life is lost");
    assert.equal(round.lives, 2);
    assert.equal(round.dice, 1, "and no second die is rolled");
    assert.equal(round.you.garlic, false, "not until he is back");
    assert.equal(events(round, "diceGift").length, 0);
    ghoul.advance(round, ghoul.CRASH_MS + 8, steady);
    assert.equal(round.phase, "ready");
    assert.equal(round.you.garlic, true);
    check(round);
    assert.equal(events(round, "diceGift").length, 1);
    assert.equal(round.diceGift, 0, "spent");
    // The next loss, with no die, leaves him nothing (long enough alive to earn no quick-fall shield).
    round.you.aliveMs = 1e9;
    round.dice = 0;
    round.phase = "play";
    round.you.garlic = false;
    round.you.safeMs = 0;
    lose(round, "zombie");
    ghoul.advance(round, ghoul.CRASH_MS + 8, steady);
    assert.equal(round.you.garlic, false, "the gift comes once");
    assert.equal(events(round, "diceGift").length, 1);
    check(round);
  }
});

test("Ghoul Rush: a 1 costs the life and leaves nothing, with its laugh and its words", () => {
  const round = hall(2);
  lose(round, "zombie");
  ghoul.advance(round, ghoul.ROLL_MS - 8, rolls(ONE));
  assert.equal(round.phase, "roll", "the beat has not finished");
  ghoul.advance(round, 16, steady);
  assert.deepEqual(events(round, "diceFace").map((e) => e.face), [1]);
  assert.equal(events(round, "diceFail").length, 1);
  assert.equal(events(round, "diceSaved").length, 0);
  assert.equal(round.dice, 1);
  assert.equal(round.lives, 2);
  assert.equal(round.phase, "crash");
  assert.equal(events(round, "lose").length, 1);
  ghoul.advance(round, ghoul.CRASH_MS + 8, steady);
  assert.equal(round.phase, "ready", "and the room starts over");
  assert.equal(events(round, "diceGift").length, 0);
  assert.equal(round.arms.length, 0);
  assert.equal(round.effects.rapid || 0, 0);
  assert.equal(ghoul.DICE_FACES[1].line, "Better Luck Next Time");
});

test("Ghoul Rush: on the last heart a 5 or 6 saves him in place, a 2, 3 or 4 pays one heart and he respawns as usual, a 1 loses the run", () => {
  const saved = hall(1);
  saved.lives = 1;
  lose(saved, "zombie");
  ghoul.advance(saved, ghoul.ROLL_MS + 8, rolls(FIVE));
  assert.equal(saved.lives, 2, "saved in place, with the 5's heart");
  assert.equal(saved.over, false);
  assert.equal(saved.phase, "play");
  for (const face of [TWO, THREE, FOUR]) {
    const mercy = hall(1);
    mercy.lives = 1;
    lose(mercy, "zombie");
    ghoul.advance(mercy, ghoul.ROLL_MS + 8, rolls(face));
    assert.equal(events(mercy, "diceHeart").length, 1, "a heart is paid");
    assert.equal(mercy.phase, "crash", "the loss goes ahead");
    ghoul.advance(mercy, ghoul.CRASH_MS + 40, steady);
    assert.notEqual(mercy.phase, "crash", "past the crash");
    assert.equal(mercy.lives, 1, "one heart left");
    assert.equal(mercy.over, false);
    assert.ok(["ready", "play"].includes(mercy.phase), `respawned as usual (${mercy.phase})`);
    assert.equal(mercy.diceGift, 0, "no gift on top");
  }
  // Not on the last heart: a 3 is a gift, a 4 a save, as ever.
  const plenty = hall(1);
  plenty.lives = 2;
  lose(plenty, "zombie");
  ghoul.advance(plenty, ghoul.ROLL_MS + 8, rolls(FOUR));
  assert.equal(plenty.lives, 2);
  assert.equal(events(plenty, "diceHeart").length, 0);
  const lost = hall(1);
  lost.lives = 1;
  lose(lost, "zombie");
  ghoul.advance(lost, ghoul.ROLL_MS + ghoul.CRASH_MS + 40, rolls(ONE));
  assert.equal(lost.lives, 0);
  assert.equal(lost.over, true);
});

test("Ghoul Rush: endless lives never roll the dice", () => {
  const round = hall(3);
  round.infinite = true;
  lose(round, "zombie");
  assert.equal(round.phase, "crash");
  assert.equal(round.dice, 3, "kept");
  assert.equal(round.lives, 3);
  assert.equal(events(round, "diceStart").length, 0);
});

test("Ghoul Rush: the clock running out can be saved too, with some time back", () => {
  const round = hall(1);
  round.timeMs = 5;
  ghoul.advance(round, 8, steady);
  assert.equal(round.phase, "ask", "the clock running out asks too");
  accept(round);
  assert.equal(round.phase, "roll");
  ghoul.advance(round, ghoul.ROLL_MS + 8, rolls(SIX));
  assert.equal(round.phase, "play");
  assert.ok(round.timeMs > ghoul.SAVED_TIME_MS - 100 && round.timeMs <= ghoul.SAVED_TIME_MS);
  assert.equal(round.lives, 4, "and a six's heart");
});

test("Ghoul Rush: a pit fall rolls too, and a save puts Planny back on the last solid ground he stood on, clear of the edge", () => {
  const pitRoom = ghoul.ROOMS.find((r) => ghoul.roomFor(r.id).ground.some((p, i, all) => i + 1 < all.length && p[1] < all[i + 1][0]));
  assert.ok(pitRoom, "some room has a pit");
  const stage = ghoul.STAGES.find((st) => st.rooms.includes(pitRoom.id));
  const round = inRoom(ghoul.newRound(5), stage.id, pitRoom.id);
  round.lives = 3;
  round.dice = 1;
  const g = round.spec.ground;
  const at = g.findIndex((p, i) => i + 1 < g.length && p[1] < g[i + 1][0]);
  const edge = g[at][1] - 0.2;
  const y = g[at][2];
  stand(round, edge);
  round.input.right = true;
  ghoul.advance(round, 4, steady);
  assert.equal(round.you.restX, round.you.x);
  // Off the edge and down.
  Object.assign(round.you, { x: g[at][1] + 2, y: ghoul.PIT_Y - 1, state: "air", vy: -20 });
  round.input.right = false;
  round.you.safeMs = 1e9;
  ghoul.advance(round, 4, steady);
  assert.equal(round.phase, "ask", "a pit asks too");
  accept(round);
  assert.equal(round.phase, "roll");
  assert.equal(events(round, "diceStart")[0].cause, "pit");
  assert.equal(round.lives, 3);
  ghoul.advance(round, ghoul.ROLL_MS + 8, rolls(FOUR));
  assert.equal(round.phase, "play");
  const you = round.you;
  assert.equal(you.y, y);
  assert.equal(you.state, "run");
  assert.ok(you.x < g[at][1] - 1.9, "back from the edge");
  assert.ok(ghoul.groundAt(round.spec, you.x - 2) === y && ghoul.groundAt(round.spec, you.x + 2) === y, "with ground to both sides");
  assert.equal(you.garlic, false, "a 4 gives no shield");
  assert.equal(round.lives, 3);
  // A low roll and the fall costs the life.
  const lost = inRoom(ghoul.newRound(5), stage.id, pitRoom.id);
  lost.dice = 1;
  Object.assign(lost.you, { y: ghoul.PIT_Y - 1, state: "air", vy: -20 });
  lost.lives = 3;
  lost.you.safeMs = 1e9;
  ghoul.advance(lost, 4, steady);
  accept(lost);
  ghoul.advance(lost, ghoul.ROLL_MS + 8, rolls(0.2));
  assert.equal(lost.lives, 2);
  assert.equal(lost.phase, "crash");
});

test("Ghoul Rush: in an ordinary room a saved life blows apart every monster in view, for their points but with nothing dropped, and leaves the ones out of view", () => {
  const round = hall(1);
  round.you.x = 100;
  const near = [zombie(round, 110), zombie(round, 130), zombie(round, round.camX + 5)];
  const far = zombie(round, round.camX + ghoul.FIELD_W + 40);
  const score = round.score;
  lose(round, "zombie");
  ghoul.advance(round, ghoul.ROLL_MS + 8, rolls(SIX));
  assert.equal(round.phase, "play");
  assert.ok(near.every((m) => m.dead), "all in view are dead");
  assert.ok(!far.dead && round.monsters.includes(far), "the one out of view lives");
  assert.deepEqual(round.monsters, [far], "the dead are cleared away");
  assert.equal(events(round, "diceBlast").length, 3);
  assert.equal(events(round, "diceSaved")[0].blasted, 3);
  assert.equal(events(round, "kill").length, 3);
  assert.ok(round.score > score, "their points count");
  assert.equal(round.drops.length, 0, "and they leave nothing");
  assert.equal(round.you.garlic, true, "the shield stays too");
  // Any saving face blows them apart, not only a six.
  const four = hall(1);
  const by = zombie(four, 110);
  lose(four, "zombie");
  ghoul.advance(four, ghoul.ROLL_MS + 8, rolls(FOUR));
  assert.ok(by.dead);
});

test("Ghoul Rush: in a boss's room a saved life blows nothing apart, and the boss is untouched", () => {
  const round = inRoom(ghoul.newRound(5), "wing", "crypt");
  round.you.safeMs = 0;
  round.boss.state = "fight";
  round.boss.t = -1e9;
  const hp = round.boss.hp;
  const m = ghoul.spawnMonster(round, "zombie", round.you.x + 6, ghoul.groundAt(round.spec, round.you.x + 6), { rise: 0, awake: true });
  round.dice = 1;
  round.events.length = 0;
  lose(round, "bones");
  ghoul.advance(round, ghoul.ROLL_MS + 8, rolls(SIX));
  assert.equal(round.phase, "play");
  assert.ok(!m.dead && round.monsters.includes(m), "the monster stands");
  assert.equal(round.boss.hp, hp);
  assert.equal(round.boss.state, "fight");
  assert.equal(events(round, "diceBlast").length, 0);
  assert.equal(events(round, "diceSaved")[0].blasted, 0);
  assert.equal(round.you.garlic, true);
  assert.ok(round.you.safeMs > 0, "the safe moment covers him");
});

test("Ghoul Rush: every step of the roll has a look and a sound, and the revive's jingle plays once", () => {
  const round = hall(3);
  zombie(round, 110);
  lose(round, "zombie");
  ghoul.advance(round, ghoul.ROLL_MS + 8, rolls(SIX));
  const played = [];
  const fx = {};
  const kit = {
    tone: (name) => played.push(name),
    burst() {},
    float() {},
    ring() {},
    banner() {},
    shake() {},
    flash() {},
    glow() {},
    splat() {},
    floorAt: () => 6,
    markFurthest() {},
    roomBanner() {},
    fx,
    monsters: ghoul.MONSTERS,
    powers: ghoul.POWERS,
    bosses: ghoul.BOSSES,
    g: { READY_MS: ghoul.READY_MS, BOSS_INTRO_MS: ghoul.BOSS_INTRO_MS, CLEAR_MS: ghoul.CLEAR_MS },
  };
  for (const e of round.events) react(e, kit);
  assert.equal(played.filter((n) => n === "ghoulLuckySave").length, 1);
  for (const type of ["diceStart", "diceRoll", "diceFace", "diceSaved", "diceBlast", "diceFail", "diceGift"]) {
    const sounds = [];
    const face = type === "diceSaved" ? 5 : 3;
    react({ type, face, x: 10, y: 6, n: 1 }, { ...kit, tone: (n) => sounds.push(n) });
    if (type !== "diceBlast") assert.ok(sounds.length, `${type} has a sound`);
  }
  // A 1 laughs, with the mechanical laugh, and the toll stays out of its way.
  const laugh = [];
  react({ type: "diceFace", face: 1, x: 10, y: 6 }, { ...kit, tone: (n) => laugh.push(n) });
  assert.deepEqual(laugh, ["ghoulDiceLaugh"]);
  const after = [];
  react({ type: "diceFail", face: 1, x: 10, y: 6 }, { ...kit, tone: (n) => after.push(n) });
  assert.deepEqual(after, []);
  assert.ok(toneNames().includes("ghoulDiceLaugh"), "the laugh is a tone");
  assert.ok(fx.lucky && fx.lucky.life > 0, "the word starts to sweep");
});
