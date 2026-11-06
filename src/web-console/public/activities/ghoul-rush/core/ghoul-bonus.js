// Plan2Code Web Console - Ghoul Rush's bonus rounds: a room with `bonus: true` plays for hearts of its own, and a clean finish pays out Lucky Dice.
//
// A bonus room (the Runaway Cart; the Carnival's dark ride is meant to be the
// next) is a short, hard detour that costs the run nothing. On entering one,
// ghoul-run.js makes `round.bonusRound`, null in every other room:
//
//   { hearts, max, dice, over, won, perf }
//
// `hearts` are Planny's bonus hearts (BONUS_HEARTS of them; `max` is the same
// number, for the drawing). Anything that would cost a life in the room costs
// one heart instead, through the usual `struck`/`lose` (so Garlic and the safe
// moment still count, and the endless-lives code, `round.infinite`, spares
// them): the run's `lives` and the Lucky dice already in hand are never touched.
// A hit that is not the last heart never stops the ride (the Runaway Cart, like
// the dark ride): he blinks safe for BONUS_SAFE_MS and rolls on, and a derail puts
// the cart back on the nearest track (ghoul-cart.js). The
// last heart gone ends the round with nothing (`endBonus(round, false)`, no
// game over), and the run carries on to the next room. A room that is finished
// alive ends it with Lucky dice (`endBonus(round, true)`): `dice` is how many
// the round earned (BONUS_FLOOR at least, MAX_DICE at most, see `diceFor`) and
// they are added to `round.dice`, which has no limit.
//
// A room with its own grade (the dark ride) sets `perf.dice` (dice earned) and
// `perf.cardMs` (its card's length) before it finishes; `diceFor` is then not used.
//
// `perf` is where a bonus room's rules note how well it went, and is all
// `diceFor` reads of it: `total` obstacles the room holds, `hits` the ids of
// those that ever cost a heart (a list, each id once), `acts` things done on
// purpose (a crate broken), `goal` the acts worth a die, and `steady`, false
// once the player has done what the room asks him not to (braked too long).
// Kills count too (`kills0`, `round.stats.kills` at the start).
//
// Both ends hold the room in the phase "clear" (the card, drawn by
// ghoul-bonus-draw.js, shows from `over`), for CARD_MS (CARD_LOST_MS when lost),
// and then the run moves on as it always does. A win also pays the room's
// points (ROOM_POINTS a room, not the time bonus).
//
// Imports only the dice cap. No random numbers.

import { MAX_DICE } from "./ghoul-dice.js";

export const BONUS_HEARTS = 5;
// The dice a bonus pays: a floor of three, then up to six more for how it went.
export const BONUS_FLOOR = 3;
// The share of the extra dice each part of the performance can earn.
export const DIE_HEARTS = 2;
export const DIE_CLEAN = 2;
export const DIE_ACTS = 1;
export const DIE_STEADY = 1;
// How long the card holds (the dice land a beat apart), and the longer hold
// of the ready phase that shows the intro banner.
export const CARD_MS = 4600;
export const CARD_LOST_MS = 2400;
export const BONUS_READY_MS = 2400;
// A ride room that plays on after a heart (the Runaway Cart) blinks Planny safe this long.
export const BONUS_SAFE_MS = 1800;

// A fresh bonus round, for a room just entered: BONUS_HEARTS, or the ride's own
// `hearts` (the finale's short rides have three).
export function makeBonus(round) {
  const n = round.spec?.ride?.hearts ?? BONUS_HEARTS;
  return { hearts: n, max: n, dice: 0, over: false, won: false, cardMs: 0, perf: { total: 0, hits: [], acts: 0, goal: 8, steady: true, kills0: round.stats.kills } };
}

// The dice a finish is worth: BONUS_FLOOR, plus a share of the six more by
// hearts left (DIE_HEARTS: five hearts earn two, three or four one, fewer none), obstacles passed untouched
// (DIE_CLEAN), things done on purpose (DIE_ACTS: crates broken and monsters
// shot, `goal` of them) and a steady hand (DIE_STEADY). Never over MAX_DICE.
export function diceFor(b, kills = 0) {
  const p = b.perf;
  const hearts = Math.min(DIE_HEARTS, Math.floor((b.hearts - 1) / 2));
  const clean = p.total > 0 ? Math.round((DIE_CLEAN * Math.max(0, p.total - p.hits.length)) / p.total) : 0;
  const acts = p.acts + Math.max(0, kills - p.kills0) >= p.goal ? DIE_ACTS : 0;
  const steady = p.steady ? DIE_STEADY : 0;
  return Math.min(MAX_DICE, BONUS_FLOOR + hearts + clean + acts + steady);
}

// The round ends: won (alive at the end) or lost (the last heart gone). A win
// pays the dice and the room's points; both leave the phase "clear" for the
// card. Pushes `bonusEnd`. `kit.award` and `kit.ROOM_POINTS` come from ghoul.js.
export function endBonus(round, won, kit) {
  const b = round.bonusRound;
  if (!b || b.over) return false;
  b.over = true;
  b.won = won;
  let points = 0;
  if (won) {
    // A room that grades itself (the dark ride) sets `perf.dice` and `perf.cardMs`.
    b.dice = b.perf.dice !== undefined ? b.perf.dice : diceFor(b, round.stats.kills);
    const had = round.dice;
    round.dice = Math.min(kit.MAX_HELD_DICE ?? Infinity, round.dice + b.dice);
    points = kit.ROOM_POINTS * round.room;
    kit.award(round, points);
    round.stats.rooms++;
    b.gained = round.dice - had;
  } else {
    b.dice = 0;
    b.gained = 0;
  }
  // The one result the host reads: dice earned (0 on a loss); then the run goes on as usual.
  b.result = { won, dice: b.dice, gained: b.gained };
  b.cardMs = won ? b.perf.cardMs || CARD_MS : CARD_LOST_MS;
  round.phase = "clear";
  round.phaseMs = b.cardMs;
  round.input.jump = 0;
  round.events.push({ type: "bonusEnd", won, dice: b.dice, gained: b.gained, hearts: b.hearts, points, x: round.you.x, y: round.you.y, ride: !!round.gallery });
  return true;
}

// The pill's text: BONUS and a heart for every one left, an empty one for every one lost.
export function heartsText(b) {
  const left = Math.max(0, Math.min(b.max, b.hearts));
  return `BONUS ${"♥".repeat(left)}${"♡".repeat(b.max - left)}`;
}
