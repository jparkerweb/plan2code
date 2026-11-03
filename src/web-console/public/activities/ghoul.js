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

import { CEILING_Y, CHANDELIER_Y, FIELD_H, FIELD_W, FLOOR_Y, ROOMS, STAGES, roomById, stageById } from "./ghoul-rooms.js";
import { GOLD, bonusTick, drawScene, lookOf, react, readColors } from "./ghoul-draw.js";
import { BONES, BONES_WINDUP_MS } from "./ghoul-bones.js";
import { GRAVEYARD, SLOW_SHARE } from "./ghoul-graveyard.js";
import { GROUNDS } from "./ghoul-grounds.js";
import { CHAPEL } from "./ghoul-chapel.js";
import { SANATORIUM } from "./ghoul-sanatorium.js";
import { VILLAGE } from "./ghoul-village.js";
import { MINE } from "./ghoul-mine.js";
import { CART } from "./ghoul-cart.js";
import { SLED } from "./ghoul-sled.js";
import { GURNEY } from "./ghoul-gurney.js";
import { PEW } from "./ghoul-pew.js";
import { BANISTER } from "./ghoul-banister.js";
import { MOWER } from "./ghoul-mower.js";
import { WAGON } from "./ghoul-wagon.js";
import { HEARSE } from "./ghoul-hearse.js";
import { TRAY } from "./ghoul-tray.js";
import { RIDE, isWaiting, startRide } from "./ghoul-ride.js";
import { CARNIVAL } from "./ghoul-carnival.js";
import { FROZEN as FROZEN_LAKE, iceRun } from "./ghoul-frozen.js";
import { BOG } from "./ghoul-bog.js";
import { BOGBOAT } from "./ghoul-bogboat.js";
import { ARM_DROP, ARM_POP_MS, FLAP_CLEAR, PILL_WORDS, POWERS, TIMED, applyPower as applyPowerWith, armDrop, pickPower, pickups, powerHere, retryMercy } from "./ghoul-powers.js";
import { ARMS, armBossDamage, armOnTop, fillBag, pressFire as pressFireWith, releaseFire, resetTap } from "./ghoul-arms.js";
import { MAX_DICE, START_DICE, beginRoll, giveDiceGift, markRest, reviveSpot, rollDice } from "./ghoul-dice.js";
import { BONUS_READY_MS, BONUS_SAFE_MS, endBonus as endBonusWith, heartsText, makeBonus } from "./ghoul-bonus.js";
import {
  camera as cameraWith,
  clearRoom as clearRoomWith,
  lockArena,
  newRound as newRoundWith,
  nextRoom as nextRoomWith,
  openSelect,
  pickStage as pickStageWith,
  horde as hordeWith,
  hurry as hurryWith,
  respawn as respawnWith,
  spawners as spawnersWith,
  stagesLeft as stagesLeftWith,
  steerPick,
  steerSelect as steerSelectWith,
  onCard,
  stepIntro as stepIntroWith,
  takeIntro as takeIntroWith,
  takeSelect as takeSelectWith,
} from "./ghoul-run.js";
import { introFor } from "./ghoul-intros.js";
import { bossIntroFor } from "./ghoul-boss-intros.js";
import { beginStory, pressStory, releaseStory, stepStory, takeStory } from "./ghoul-story.js";

export { FIELD_H, FIELD_W, FLOOR_Y, ROOMS, STAGES, roomById, stageById };
export { FLAP_CLEAR, POWERS, TIMED, powerHere };
export { INTRO_MIN_MS } from "./ghoul-run.js";
// The double tap, for the tests (the game calls it from key()).
export const pressFire = (round) => pressFireWith(round, KIT);
export { releaseFire };
// The stage pick, which moved to ghoul-run.js.
export { steerPick };
export { CANDY_POINTS, CRYSTAL_POINTS, HOURGLASS_MS, POWER_POINTS } from "./ghoul-powers.js";
// The Lucky die's numbers, which the tests read from here.
export { DICE_FACES, LEAD_MS, MAX_DICE, START_DICE, ROLL_MS, SAVED_TIME_MS, TUMBLE_MS } from "./ghoul-dice.js";
// The bonus rounds' numbers (the Runaway Cart is the first), which the tests read from here.
export { BONUS_FLOOR, BONUS_HEARTS, BONUS_SAFE_MS, CARD_LOST_MS, CARD_MS, diceFor } from "./ghoul-bonus.js";
// Old Rattlebones' numbers, which the tests read from here.
export { BONES_KEEP, BONES_MS, BONES_RAGE_MS, BONES_WINDUP_MS, VOLLEY } from "./ghoul-bones.js";

// The board: the strip of pills along the top, then the field. The strip is
// one row of pills tall (ghoul-draw.js's hudLayout shrinks the pills to keep
// them in one row), so the field gets the room. The field runs to the
// canvas's edges with no frame (PAD 0), so full screen shows all play. The
// canvas scales a unit in quarter-pixel steps.
export const HUD_H = 4.5;
export const PAD = 0;
export const W = PAD * 2 + FIELD_W;
export const H = HUD_H + FIELD_H + PAD;

// Below this many pixels a unit, Planny and the monsters are too small to
// read; the window shows its bigger-window note.
export const MIN_CELL = 3;

// Planny, in units: YOU_W across and YOU_H tall as drawn, his feet at his y.
// Monsters hit a smaller box, HIT_W by HIT_H, so a graze never counts.
export const YOU_W = 3.6;
export const YOU_H = 5;
export const HIT_W = 2.4;
export const HIT_H = 4.4;
// Ducking (down, on the ground, not running): HIT_H falls to DUCK_H, and his
// bolts fly from DUCK_SHOT_Y. A swooper (a pack's `swoops`) ramps up over a
// ducked Planny, its underside SWOOP_CLEAR above his feet by the time it can
// touch him, starting SWOOP_NEAR short of that: so duck before it arrives and it
// passes overhead, whatever the angle of its dive. Standing, it still hits him.
export const DUCK_H = 2.4;
export const DUCK_SHOT_Y = 1.4;
export const SWOOP_CLEAR = 2.6;
export const SWOOP_NEAR = 3;
// Half his width, where his front edge meets a wall.
const EDGE = 1.2;

// Moving, in units and seconds. Running is RUN_SPEED at once, on the ground
// and in the air alike (no slide, no drift: an arcade's grip). A jump leaves
// at JUMP_V against GRAVITY (12 units high and about 0.61 s in the air, a
// snappy arc); letting up go while still rising cuts the jump to CUT_V.
// Landing on a monster bounces you up at STOMP_V. Nothing falls faster than
// FALL_MAX.
export const RUN_SPEED = 36;
export const GRAVITY = 260;
export const JUMP_V = 79;
export const CUT_V = 28;
// A jump always rises CUT_AFTER_MS before letting go of up can cut it, so a
// press saved for a landing and let go before it never comes out as a twitch.
export const CUT_AFTER_MS = 50;
export const STOMP_V = 58;
export const FALL_MAX = 120;
// Knee-deep water (a room's `water` spans of floor, the Mine's tunnels): on the
// floor in one Planny runs at WATER_SPEED of his speed and a jump leaves at
// WATER_JUMP of its speed; `you.wet` says so (ghoul-mine.js reads it).
export const WATER_SPEED = 0.65;
export const WATER_JUMP = 0.93;
// Sinking mud (a room's `mud` spans, Gallows Bog): on the floor in one,
// `you.mudMs` climbs toward MUD_MS and the run sags from WATER_SPEED down to
// MUD_SPEED_MIN, a jump from WATER_JUMP down to MUD_JUMP_MIN; dry floor or
// the air lets it go again (`you.mud`, `you.mudMs`).
export const MUD_MS = 2400;
export const MUD_SPEED_MIN = 0.25;
export const MUD_JUMP_MIN = 0.7;
const mudSpeed = (ms) => WATER_SPEED + (MUD_SPEED_MIN - WATER_SPEED) * Math.min(1, ms / MUD_MS);
const mudJump = (ms) => WATER_JUMP + (MUD_JUMP_MIN - WATER_JUMP) * Math.min(1, ms / MUD_MS);
// A step of STEP_UP or less between two surfaces is walked, not jumped.
export const STEP_UP = 3;
// Forgiving edges: a jump pressed up to COYOTE_MS after running off an edge
// still leaves it, and a press up to JUMP_BUFFER_MS before landing jumps as
// you land.
export const COYOTE_MS = 100;
export const JUMP_BUFFER_MS = 120;
// Under this height a fall has gone down a pit.
export const PIT_Y = -8;
// Bat wings save a fall down a pit: Planny flies back over WING_SAVE_MS to the
// last solid ground he stood on, swooping WING_SAVE_ARC over the straight line,
// safe till a moment after he lands, and the wings are spent (see wingSave).
export const WING_SAVE_MS = 700;
export const WING_SAVE_ARC = 7;

// Nothing moves more than FALL_MAX * SLICE_MS / 1000 units (0.48) in a
// slice, and a landing is found by crossing a surface's line, so no fall
// goes through one.
export const SLICE_MS = 4;

// The flashlight blaster: a bolt every FIRE_MS while fire is held (RAPID_MS
// with Rapid fire), flying SHOT_SPEED level with Planny's chest (SHOT_Y over
// his feet) until it hits something, a wall, or has gone SHOT_RANGE. Spread
// shot adds two more, SPREAD_ANGLE up and down.
export const FIRE_MS = 100;
export const RAPID_MS = 48;
export const SHOT_SPEED = 130;
export const SHOT_RANGE = 80;
export const SHOT_Y = 2.4;
export const SHOT_R = 0.5;

// The blaster heats up, so holding or hammering fire is not the whole game.
// Each bolt adds a shot of heat: the first HEAT_FREE go at the full rate,
// then each waits longer, until from HEAT_MAX on it fires one bolt every
// SLOW_FIRE_MS. Let go of fire and, once COOL_DELAY_MS has passed without
// firing (so tapping it does not cool it), it sheds COOL_RATE shots of heat a
// second. So about three seconds of fire go at the full rate, a held blaster
// is down to one bolt a second some fifteen seconds in, and the hottest one
// is cool again a couple of seconds after it is let go. Rapid fire's bolts
// add no heat and ignore it.
export const HEAT_FREE = 30;
export const HEAT_MAX = 50;
export const SLOW_FIRE_MS = 1000;
export const COOL_DELAY_MS = 200;
export const COOL_RATE = 25;
// The blaster fizzes from half of HEAT_FREE on.
export const HEAT_SHOWN = HEAT_FREE / 2;

// The wait after a bolt fired at `heat`: FIRE_MS while cool, rising in a
// line to SLOW_FIRE_MS at HEAT_MAX.
export function fireGap(heat) {
  const t = clamp((heat - HEAT_FREE) / (HEAT_MAX - HEAT_FREE), 0, 1);
  return Math.round(FIRE_MS + (SLOW_FIRE_MS - FIRE_MS) * t);
}

export const SPREAD_ANGLE = 0.13;
// A little help aiming: a bolt tilts toward the nearest monster ahead within
// AIM_RANGE whose middle is within AIM_DY of your chest, by up to AIM_MAX.
export const AIM_RANGE = 50;
export const AIM_DY = 9;
export const AIM_MAX = 0.5;

// The monsters: a box `w` across and `h` tall standing on (or flying with
// its bottom at) its y, the shots it takes, its speed, the points a kill is
// worth, whether a stomp from above kills it and whether its head (the top
// HEAD_SHARE of it) doubles a kill. A zombie (a runner, a glutton) sprints at
// `lurch` once you are within LURCH_RANGE on its level. `stompDamage`, where
// set, is all a stomp takes off (a glutton is too soft to burst at once).
// `color` is what spills when it dies.
// The stage packs: each stage past the house's own two brings its monsters,
// its boss and their rules (see ghoul-graveyard.js for what a pack holds).
// Their tables join this file's own, and their rules run where its own do.
const PACKS = Object.freeze([BONES, GRAVEYARD, GROUNDS, CHAPEL, SANATORIUM, VILLAGE, MINE, ARMS, CART, SLED, GURNEY, PEW, MOWER, WAGON, HEARSE, TRAY, CARNIVAL, FROZEN_LAKE, BOG, BOGBOAT, RIDE, BANISTER]);
const fromPacks = (key) => Object.assign({}, ...PACKS.map((pk) => pk[key] || {}));
const listPacks = (key) => PACKS.flatMap((pk) => pk[key] || []);

export const MONSTERS = Object.freeze({
  ...fromPacks("monsters"),
  zombie: Object.freeze({ name: "Zombie", w: 3, h: 5, hp: 3, speed: 9, lurch: 20, points: 100, stomp: true, head: true, color: "#7a1010" }),
  runner: Object.freeze({ name: "Runner", w: 2.4, h: 5.2, hp: 1, speed: 24, lurch: 34, points: 120, stomp: true, head: true, color: "#7a1010" }),
  glutton: Object.freeze({ name: "Glutton", w: 4.8, h: 5.4, hp: 15, speed: 5, lurch: 7, points: 250, stomp: true, stompDamage: 3, head: true, color: "#6a1a10" }),
  crawler: Object.freeze({ name: "Crawler", w: 3, h: 2.4, hp: 2, speed: 16, points: 75, stomp: true, head: false, color: "#7a1010" }),
  bat: Object.freeze({ name: "Bat", w: 2.6, h: 1.6, hp: 1, speed: 26, points: 50, stomp: true, head: false, color: "#5a0c14" }),
  ghost: Object.freeze({ name: "Ghost", w: 3.2, h: 4, hp: 3, speed: 10, points: 150, stomp: false, head: false, color: "#b8e6d0" }),
  skeleton: Object.freeze({ name: "Skeleton", w: 3, h: 5.2, hp: 4, speed: 0, points: 200, stomp: true, head: true, color: "#cfc4a6" }),
  seed: Object.freeze({ name: "Gourdling", w: 2.2, h: 2, hp: 1, speed: 14, points: 40, stomp: true, head: false, color: "#8a4a12" }),
  hound: Object.freeze({ name: "Hellhound", w: 3.8, h: 2.6, hp: 2, speed: 13, points: 150, stomp: true, head: false, color: "#8a0e0e" }),
  spider: Object.freeze({ name: "Widow", w: 3.2, h: 2, hp: 2, speed: 18, points: 120, stomp: true, head: false, color: "#3d5a1a" }),
  huntsman: Object.freeze({ name: "Huntsman", w: 4.8, h: 2.8, hp: 4, speed: 20, points: 300, stomp: true, head: false, color: "#3a2a12" }),
  wraith: Object.freeze({ name: "Wraith", w: 3, h: 4.2, hp: 2, speed: 12, points: 200, stomp: false, head: false, color: "#9fb2c4" }),
  spitter: Object.freeze({ name: "Bloater", w: 4.2, h: 4.8, hp: 5, speed: 3, points: 250, stomp: false, head: true, color: "#8fa82a" }),
});
export const HEAD_SHARE = 0.3;
// The zombies and their kin, which shamble, lurch and come out of doors alike.
export const ZOMBIES = new Set(["zombie", "runner", "glutton", ...listPacks("zombies")]);
// Now and then a zombie that comes is a Runner (RUNNER_CHANCE: fast, and
// down in one bolt) or a Glutton (GLUTTON_CHANCE: slow, 15 bolts to kill, and
// it never leaps or climbs), and a widow or a hellhound is a Huntsman
// (HUNTSMAN_CHANCE): a big spider on the floor that springs at you.
export const RUNNER_CHANCE = 0.14;
// A runner shrieks once as it comes within RUNNER_WARN of the view, a
// "runner" event with the x on screen nearest it, so one coming up from
// behind is heard before it is on you.
export const RUNNER_WARN = 14;
export const GLUTTON_CHANCE = 0.07;
export const HUNTSMAN_CHANCE = 0.12;
export function variant(kind, random) {
  if (kind === "zombie") {
    const r = random();
    return r < GLUTTON_CHANCE ? "glutton" : r < GLUTTON_CHANCE + RUNNER_CHANCE ? "runner" : "zombie";
  }
  if (kind === "spider" || kind === "hound") return random() < HUNTSMAN_CHANCE ? "huntsman" : kind;
  return kind;
}
// A Huntsman runs at you, and within HUNT_RANGE across (and no higher than
// HUNT_HIGH over it) crouches HUNT_CROUCH_MS, then springs to come down on
// where you are from HUNT_UP above, as high as you are, no faster across
// than HUNT_VX, and rests HUNT_REST_MS where it lands.
export const HUNT_RANGE = 26;
export const HUNT_HIGH = 26;
export const HUNT_CROUCH_MS = 380;
export const HUNT_UP = 3;
export const HUNT_VX = 60;
export const HUNT_REST_MS = 700;
export const LURCH_RANGE = 20;
// A crawler takes RISE_MS to come up through the boards (harmless till up),
// woken once you are within CRAWL_NEAR. A bat wakes within BAT_NEAR and
// steers toward your chest at BAT_STEER a second. A ghost is solid (it can
// hurt and be hit) from GHOST_APPEAR_MS to GHOST_SHOW_MS of its cycle and
// faded the rest, GHOST_HIDE_MS; a faded one within GHOST_CLEAR of you stays
// faded till you are clear. A skeleton throws a bone every SKEL_MS,
// raising its arm for SKEL_WINDUP_MS first, when you are within SKEL_RANGE.
export const RISE_MS = 450;
export const CRAWL_NEAR = 26;
export const BAT_NEAR = 44;
const BAT_STEER = 60;
const BAT_TURN = 18;
export const GHOST_APPEAR_MS = 300;
export const GHOST_SHOW_MS = 2200;
export const GHOST_HIDE_MS = 900;
export const GHOST_CLEAR = 4;
export const SKEL_MS = 1500;
export const SKEL_WINDUP_MS = 350;
export const SKEL_RANGE = 60;
// Closer than SKEL_NEAR a skeleton holds its bone (it would only go straight up).
export const SKEL_NEAR = 6;
// A thrown bone (or a glob of acid): up at BONE_V against BONE_G, never
// across faster than BONE_VX; shot down for BONE_POINTS.
export const BONE_V = 40;
export const BONE_G = 110;
const BONE_VX = 42;
const BONE_R = 0.8;
export const BONE_POINTS = 25;
// A hellhound prowls at its speed; within HOUND_RANGE on your level it
// crouches for HOUND_CROUCH_MS (growling), then lunges at HOUND_LUNGE_VX,
// up at HOUND_LUNGE_V, and needs HOUND_REST_MS after it lands.
export const HOUND_RANGE = 16;
export const HOUND_CROUCH_MS = 320;
export const HOUND_LUNGE_VX = 40;
export const HOUND_LUNGE_V = 40;
export const HOUND_REST_MS = 600;
// A widow hangs from the ceiling at SPIDER_Y until you come within
// SPIDER_NEAR across, then drops on its thread at SPIDER_DROP_V and skitters
// after you.
export const SPIDER_Y = CEILING_Y - 4;
export const SPIDER_NEAR = 22;
export const SPIDER_DROP_V = 70;
// A wraith waits unseen until you are within WRAITH_NEAR, then hovers
// WRAITH_KEEP ahead of you at its height (never more than WRAITH_ABOVE over
// you, where a tilted bolt still finds it) for WRAITH_HOVER_MS, shrieks for
// WRAITH_WIND_MS, and dives at where your chest was at WRAITH_DIVE_V, on
// WRAITH_PAST beyond it before it climbs back.
export const WRAITH_NEAR = 60;
export const WRAITH_KEEP = 26;
export const WRAITH_ABOVE = 12;
export const WRAITH_HOVER_MS = 1400;
export const WRAITH_WIND_MS = 450;
export const WRAITH_DIVE_V = 48;
export const WRAITH_PAST = 18;
// A bloater wades toward you till SPIT_KEEP away and lobs a glob of acid
// every SPIT_MS within SPIT_RANGE, swelling for SPIT_WINDUP_MS first. Acid
// that lands leaves a puddle PUDDLE_W wide for PUDDLE_MS that burns whoever
// stands in it, and a bloater bursts into globs when it dies.
export const SPIT_KEEP = 22;
export const SPIT_MS = 2000;
export const SPIT_WINDUP_MS = 450;
export const SPIT_RANGE = 54;
export const PUDDLE_W = 4;
export const PUDDLE_MS = 1800;
// A wall door holds its zombies while you are within DOOR_CLEAR of it, and
// each one steps out over EMERGE_MS, harmless till it is through.
export const DOOR_CLEAR = 14;
export const EMERGE_MS = 350;
// Monsters wake a little off screen; no more than MAX_MONSTERS at once (the
// horde stops HORDE_ROOM short of that, leaving room for the rest).
const SPAWN_AHEAD = 4;
const MAX_MONSTERS = 18;
const HORDE_ROOM = 4;

// The bosses, in a room's last FIELD_W. The arena locks once you are
// BOSS_LOCK into it, and the boss wakes after BOSS_INTRO_MS. Its hp grows
// BOSS_DEPTH_HP for each stage already cleared that run (up to
// BOSS_DEPTH_MAX of them); a stomp deals STOMP_DAMAGE, a shot one (two to
// Rattlebones' skull).
export const BOSSES = Object.freeze({
  gourd: Object.freeze({ name: "The Rotting Gourd", sub: "Watch its shadow, then run", w: 14, h: 12, hp: 65, points: 2000, color: "#d0631c" }),
  ...fromPacks("bosses"),
});
export const BOSS_LOCK = 10;
export const BOSS_INTRO_MS = 1000;
export const BOSS_DEPTH_HP = 0.12;
export const BOSS_DEPTH_MAX = 12;
// Each stage cleared makes the monsters a little quicker and lets them out a
// little sooner (see roomFor).
export const DEPTH_PACE = 0.03;
export const DEPTH_EVERY = 0.95;
export const STOMP_DAMAGE = 3;
// Old Rattlebones' skull starts SKULL_FROM of the way up it: a level bolt
// from the Crypt's shelf reaches it.
export const SKULL_FROM = 0.72;
// The Rotting Gourd waits GOURD_WAIT_MS (shaking the last part of it), then
// picks its next move at random, never one three times running: a hop at
// GOURD_HOP_V (every third hop GOURD_BIG_V) to land where you stood,
// shaking the floor and letting gourdlings loose; a spit, winding up
// GOURD_SPIT_MS, then lobbing a glob of acid at each GOURD_SPIT scale of the
// throw that lands on you; or a quake, a leap straight up at GOURD_QUAKE_V
// that sends a shockwave along the floor both ways as it lands.
export const GOURD_WAIT_MS = 850;
export const GOURD_HOP_V = 95;
export const GOURD_BIG_V = 110;
export const GOURD_ACTS = Object.freeze(["hop", "spit", "quake"]);
export const GOURD_SPIT_MS = 500;
export const GOURD_SPIT = Object.freeze([1, 1.35]);
export const GOURD_QUAKE_V = 100;
// A gourdling lands and finds its feet for SEED_LAND_MS before it can hurt.
export const SEED_LAND_MS = 300;
// No more than MAX_SEEDS gourdlings run about at once: one a hop, two a big one.
export const MAX_SEEDS = 4;
// Old Rattlebones' fight (his volleys, slams, skull, bone rain and skeletons)
// lives in ghoul-bones.js; a shockwave runs along the floor at WAVE_SPEED,
// WAVE_H high.
export const WAVE_SPEED = 40;
export const WAVE_H = 2.2;

// A chandelier shakes CHANDELIER_SHAKE_MS once you run within CHANDELIER_NEAR
// under it, then drops; whatever it lands on is crushed.
export const CHANDELIER_NEAR = 6;
export const CHANDELIER_SHAKE_MS = 350;
export const CHANDELIER_W = 7;
// A crumbling board shakes CRUMBLE_MS once stood on, then is gone for
// CRUMBLE_BACK_MS.
export const CRUMBLE_MS = 500;
export const CRUMBLE_BACK_MS = 3500;

// The power-ups (POWERS, TIMED, FLAP_CLEAR, HOURGLASS_MS), which can turn up
// where, and picking up candy, power-ups, crystals and the key live in
// ghoul-powers.js.

// A room is dark DARK_CHANCE of the times it is entered (unless its spec
// says which); a lit one never has a Lantern, its placed ones swapped for
// another power-up (never a 1UP).
export const DARK_CHANCE = 0.6;
// In a dark room only DARK_BEHIND of what comes in from the edge behind
// you (the horde, the stragglers once the bonus is gone) gets in.
export const DARK_BEHIND = 0.5;
export const DROP_CANDY = 0.3;
export const DROP_POWER = 0.07;
// Stragglers: the horde (and the dead that come once the bonus is gone)
// never ends, so each of its kills in a room is worth STRAY_FADE of the last
// (never under STRAY_MIN of its points) and leaves nothing behind. Holding a
// doorway to farm them pays next to nothing.
export const STRAY_FADE = 0.8;
export const STRAY_MIN = 0.1;
const DROP_MS = 9000;
const GARLIC_SAFE_MS = 1200;

// Points: a kill is its points times the chain (kills each within CHAIN_MS
// of the last, the multiplier capped at MAX_MULT), doubled for a headshot or
// a stomp. Candy is CANDY_POINTS, a power-up POWER_POINTS. Through a door,
// ROOM_POINTS times the room plus the time bonus left (BONUS_START, dropping
// BONUS_STEP a second) and FLAWLESS_POINTS with no life lost; a boss is its
// points, more the deeper into the run (see roomFor), and a life up to
// MAX_LIVES.
export const CHAIN_MS = 1200;
export const MAX_MULT = 10;
// CANDY_POINTS, POWER_POINTS and CRYSTAL_POINTS are in ghoul-powers.js.
export const ROOM_POINTS = 300;
export const BONUS_START = 1500;
export const BONUS_STEP = 50;
export const FLAWLESS_POINTS = 500;
// With the bonus run out, a zombie shambles in from the edge every HURRY_MS.
export const HURRY_MS = 1500;

// The clock: every room but a boss's gives TIME_BASE_S plus TIME_PER_UNIT_S
// a unit of its length, to the nearest 5 seconds (70 to 80), to get out. At
// none a life goes, and the room starts over with a full clock. The last
// TIME_WARN_MS tick away out loud.
export const TIME_BASE_S = 30;
export const TIME_PER_UNIT_S = 0.09;
export const TIME_WARN_MS = 10000;
export const timeFor = (spec) => (spec.boss ? 0 : spec.ride ? spec.ride.time : Math.round((TIME_BASE_S + spec.length * TIME_PER_UNIT_S) / 5) * 5000);

// Piling up: STACK_MIN or more walkers (zombies, crawlers, gourdlings) each
// within STACK_NEAR of the next on the same floor are a pile, and once you
// are above them and within STACK_REACH across they climb over each other to
// reach you: the oldest stays at the bottom and each one more stands
// STACK_STEP of its height over the one below, rising at CLIMB_V, only as
// high as it takes to reach your feet. A pile that breaks up, or that you
// leave, drops back at UNSTACK_V. So waiting on a shelf over a crowd for a
// run of stomps is never safe.
export const STACK_MIN = 2;
export const STACK_NEAR = 2.2;
export const STACK_REACH = 12;
export const STACK_STEP = 0.8;
export const CLIMB_V = 14;
export const UNSTACK_V = 30;
const STACKERS = new Set(["zombie", "runner", "crawler", "seed", ...listPacks("stackers")]);
// A walker climbing (a pile or a wall) reaches up with both arms, ARMS_UP
// over its head: landing on them hurts you. Only a landing within HEAD_BONK
// of its middle comes down on its head between them, for a stomp.
export const ARMS_UP = 1.4;
export const HEAD_BONK = 0.9;
export const reaching = (m) => m.lift > 0.5 || Boolean(m.scale);

// Hopping a pit: a walker that comes to the edge of a pit, or of a drop to
// a lower floor, stops and thinks about it for PONDER_MS (PONDER_STEP_MS
// more for some, so a crowd does not leap as one), then leaps, rising at
// HOP_V and landing HOP_IN past the far edge. Across to floor about its own
// height it clears HOP_GAP; down to a lower one it is longer in the air and
// so clears more, as far as the same leap carries. Floor higher than a step
// up, or a pit too wide, stops it for good. Anything on four legs (a hound, a
// topiary beast, a wolf-man) leaps BOUND_REACH times as far and twice as high
// (rising at BOUND_V), so it also lands on floor up to BOUND_UP above it across
// a gap. A wall with no gap before it still stops one: it never climbs.
export const HOP_GAP = 10.5;
export const BOUND_REACH = 2;
export const HOP_V = 50;
export const BOUND_V = HOP_V * Math.SQRT2;
export const BOUND_UP = 9;
export const HOP_IN = 1.5;
export const PONDER_MS = 900;
export const PONDER_STEP_MS = 150;
// Climbing a wall: a zombie, a runner or a crawler stopped by floor more than
// a step up (no more than WALL_MAX) thinks about it the same way, then
// climbs its face at WALL_V and steps on at the top. A glutton is too heavy
// to leap a pit or climb, but steps off a ledge onto the floor below.
export const WALL_MAX = 8;
export const WALL_V = 7;
const CLIMBERS = new Set(["zombie", "runner", "crawler", ...listPacks("climbers")]);
const HEAVY = new Set(["glutton"]);
const FOUR_LEGGED = new Set(["hound", ...listPacks("fourLegged")]);
// A turned villager is a villager until the moon says otherwise, so it goes by
// `m.turned`, not kind.
const bounds = (m) => FOUR_LEGGED.has(m.kind) || Boolean(m.turned);
// How far across a monster's leap clears, on the level.
export const hopReach = (m) => HOP_GAP * (bounds(m) ? BOUND_REACH : 1);
// Everything that walks the floor with walk(), and so can stand on a bridge.
const WALKERS = new Set(["zombie", "runner", "glutton", "crawler", "seed", "spitter", "hound", "huntsman", ...listPacks("walkers"), ...listPacks("zombies")]);

// A life lost holds CRASH_MS, then puts you back at the room's start (in a
// boss room, the arena's) for READY_MS, safe for SAFE_MS. A door gone through
// holds CLEAR_MS.
export const START_LIVES = 7;
export const MAX_LIVES = 9;
export const CRASH_MS = 900;
export const READY_MS = 500;
export const SAFE_MS = 1200;
// A life lost within QUICK_LOSS_MS (12 s) of coming in (into a room, or back after
// the last life lost) brings Planny back holding the Garlic shield.
export const QUICK_LOSS_MS = 12000;
export const CLEAR_MS = 1200;
// Stages offered at each choice, and how long the offer settles before a
// press takes one.
export const OFFER_N = 2;
export const PICK_HOLD_MS = 700;
export const BANNER_STRETCH = 2;
export const DOOR_REACH = 2.5;

// A banner fades to BANNER_SEE_THROUGH over BANNER_FADE_MS while something
// that matters to you is in its strip, BANNER_REACH either side of its middle.
const BANNER_SEE_THROUGH = 0.12;
const BANNER_FADE_MS = 140;
export const BANNER_REACH = 8;

// The camera eases toward a spot CAM_LEAD ahead of the way you face.
const CAM_EASE = 9;
const CAM_AT = 0.32;
const CAM_LEAD = 12;

export const chainMult = (chain) => Math.max(1, Math.min(MAX_MULT, chain));

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// A small seeded random (mulberry32), handed to advance() so a seed always
// plays the same drops, throws and hops (the rooms themselves are fixed).
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// How high a jump is, `dx` across from where it left, at RUN_SPEED: the
// unit suite's measure of which gaps and ledges a jump can clear.
export function jumpHeightAt(dx) {
  const t = Math.abs(dx) / RUN_SPEED;
  return JUMP_V * t - (GRAVITY * t * t) / 2;
}
export const JUMP_TOP = (JUMP_V * JUMP_V) / (2 * GRAVITY);

/* -------------------------------------------------------------- rooms */

// A room's numbers, built once each for the room `id` (as ghoul-rooms.js
// lays it out) played `depth` stages into a run: the deeper, the quicker and
// tougher its monsters, the sooner they are let out, and the more hp (and
// points) its boss has, each capped.
const BUILT = new Map();

export function roomFor(id, depth = 0) {
  const base = roomById(id) || ROOMS[0];
  const d = Math.max(0, Math.floor(depth) || 0);
  const k = `${base.id}:${d}`;
  if (BUILT.has(k)) return BUILT.get(k);
  const candy = [];
  for (const [x0, y, count] of base.candy) for (let i = 0; i < count; i++) candy.push(Object.freeze({ x: x0 + i * 3, y }));
  const spec = Object.freeze({
    ...base,
    depth: d,
    base,
    name: base.title,
    pace: Math.min(1.4, 1 + DEPTH_PACE * d),
    every: Math.max(0.55, DEPTH_EVERY ** d),
    tough: Math.min(2, Math.floor(d / 3)),
    // Doors in the wall let this many more out.
    extra: Math.min(2, Math.floor(d / 2)),
    bossHp: base.boss ? Math.round(BOSSES[base.boss].hp * (1 + BOSS_DEPTH_HP * Math.min(d, BOSS_DEPTH_MAX))) : 0,
    bossPoints: base.boss ? Math.round(BOSSES[base.boss].points * (1 + d / 4)) : 0,
    candyAt: Object.freeze(candy),
    arena: base.boss ? base.length - FIELD_W : -1,
  });
  BUILT.set(k, spec);
  return spec;
}

// "Library (room 3)": room `n` of a run.
export const roomName = (spec, n) => `${spec.name} (room ${n})`;

/* ----------------------------------------------------------- surfaces */

// The top of the ground at `x`, or -Infinity over a pit. Pieces are
// [x0, x1); the last one takes its end too.
export function groundAt(spec, x) {
  const g = spec.ground;
  for (let i = 0; i < g.length; i++) {
    const [x0, x1, y] = g[i];
    if (x >= x0 && (x < x1 || (i === g.length - 1 && x <= x1))) return y;
  }
  return -Infinity;
}

// Whether shelf `i` is there (a crumbled board is not, for a while).
export const shelfThere = (round, i) => !(round.down[i] > 0);

// What something walking at height `y` stands on at `x`: the highest
// surface (the ground or a shelf there) within STEP_UP of `y` either way,
// as { y, shelf } (shelf -1 for the ground), or null. `skip` is a shelf to
// ignore (one being dropped through).
export function footing(round, x, y, skip = -1) {
  const spec = round.spec;
  let best = null;
  const g = groundAt(spec, x);
  if (g >= y - STEP_UP && g <= y + STEP_UP) best = { y: g, shelf: -1 };
  spec.shelves.forEach(([x0, x1, top], i) => {
    if (i === skip || !shelfThere(round, i) || x < x0 || x > x1) return;
    if (top >= y - STEP_UP && top <= y + STEP_UP && (!best || top > best.y)) best = { y: top, shelf: i };
  });
  return best;
}

// The surface a fall from (x, py) to (x, y) lands on: the highest one whose
// top it crossed going down, as { y, shelf }, or null.
function landing(round, x, py, y, skip) {
  const spec = round.spec;
  let best = null;
  const g = groundAt(spec, x);
  if (py >= g - 0.05 && y <= g) best = { y: g, shelf: -1 };
  spec.shelves.forEach(([x0, x1, top], i) => {
    if (i === skip || !shelfThere(round, i) || x < x0 || x > x1) return;
    if (py >= top - 0.05 && y <= top && (!best || top > best.y)) best = { y: top, shelf: i };
  });
  return best;
}

// Like footing() and landing() for Planny alone: a monster the pack says is a
// floor just now (a parked gurney) counts as one more surface, its top.
function standing(round, x, y) {
  let best = footing(round, x, y);
  for (const m of round.monsters) {
    if (m.dead || !PLATFORMS[m.kind] || !PLATFORMS[m.kind](m) || Math.abs(x - m.x) > m.w / 2) continue;
    const top = m.y + m.h;
    if (top >= y - STEP_UP && top <= y + STEP_UP && (!best || top > best.y)) best = { y: top, shelf: -1 };
  }
  return best;
}

function landOn(round, x, py, y, skip) {
  let best = landing(round, x, py, y, skip);
  for (const m of round.monsters) {
    if (m.dead || !PLATFORMS[m.kind] || !PLATFORMS[m.kind](m) || Math.abs(x - m.x) > m.w / 2) continue;
    const top = m.y + m.h;
    if (py >= top - 0.05 && y <= top && (!best || top > best.y)) best = { y: top, shelf: -1 };
  }
  return best;
}

// Whether the ground at `x` stands above `y`: a wall to anything there.
const wallAt = (spec, x, y) => groundAt(spec, x) > y;

// How far left and right Planny may go: the room, or the arena once locked.
const leftEdge = (round) => Math.max(1.5, round.lockX >= 0 ? round.lockX + 1.5 : 1.5);
const rightEdge = (round) => round.spec.length - 1.5;

/* -------------------------------------------------------------- Planny */

function makeYou(x, y) {
  return { x, y, vx: 0, vy: 0, state: "run", shelf: -1, face: 1, coyote: 0, drop: -1, cuttable: false, airMs: 0, out: 0, outKind: "", safeMs: 0, garlic: false, hat: false, aliveMs: 0, runMs: 0, fireFx: 0, flapped: false, flingMs: 0, flingVx: 0, heldMs: 0, wet: false, mud: false, mudMs: 0, belt: 0, dimMs: 0, dimBy: 0, slide: 0, glide: false, onIce: false };
}

// The conveyor belts (a room's `belts`, the Funhouse's) push him along the floor: the speed of the one he stands on, or 0.
const beltAt = (spec, you) => {
  if (!spec.belts || !spec.belts.length || you.state !== "run" || you.shelf >= 0 || you.y > groundAt(spec, you.x) + 0.01) return 0;
  const b = spec.belts.find(([x0, x1]) => you.x >= x0 && you.x <= x1);
  return b ? b[2] : 0;
};

// Whether Planny stands on the floor in one of the room's water spans.
const wetAt = (spec, you) => Boolean(spec.water && spec.water.length) && you.state === "run" && you.shelf < 0 && you.y <= groundAt(spec, you.x) + 0.01 && spec.water.some(([x0, x1]) => you.x >= x0 && you.x <= x1);

// Whether Planny stands on the floor in one of the room's mud spans.
const mudAt = (spec, you) => Boolean(spec.mud && spec.mud.length) && you.state === "run" && you.shelf < 0 && you.y <= groundAt(spec, you.x) + 0.01 && spec.mud.some(([x0, x1]) => you.x >= x0 && you.x <= x1);

// Leaves the ground at JUMP_V, or bounces off a stomp at STOMP_V.
export function jump(round, v = JUMP_V) {
  const you = round.you;
  if (you.out > 0) return false;
  you.vy = v === JUMP_V ? JUMP_V * (you.wet ? WATER_JUMP : 1) * (you.mud ? mudJump(you.mudMs) : 1) : v;
  you.state = "air";
  you.ducking = false;
  you.shelf = -1;
  you.coyote = 0;
  you.drop = -1;
  // Only a jump from a press is cut short by letting up go, and only once it
  // has risen CUT_AFTER_MS.
  you.cuttable = v === JUMP_V;
  you.airMs = 0;
  if (v === JUMP_V) round.events.push({ type: "jump", x: you.x, y: you.y });
  return true;
}

// One slice of your moving: running along the ground or a shelf (walking a
// step, or off an edge into a fall), dropping through a shelf with down,
// ducking with down on the ground (a direction held runs instead), or
// flying, blocked by any wall in the way.
export function moveYou(round, ms) {
  const dt = ms / 1000;
  const you = round.you;
  // Frozen by the bell, held by an orderly or thrown: no key does anything.
  const flung = you.flingMs > 0;
  const inp = round.stunMs > 0 || you.heldMs > 0 || flung ? FROZEN : round.input;
  const spec = round.spec;
  const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  if (dir) you.face = dir;
  you.runMs = dir && you.state === "run" ? you.runMs + ms : 0;
  // A mourner's wail leaves you running at SLOW_SHARE of your speed a while.
  // Knee-deep water (a room's `water` spans): slower on the floor in it.
  you.wet = wetAt(spec, you);
  // Sinking mud: it grabs harder the longer he stands in it, and lets go on
  // dry floor or in the air. Stilt Boots wade free of it (ghoul-powers.js).
  you.mud = mudAt(spec, you) && !(round.effects.boots > 0);
  you.mudMs = you.mud ? you.mudMs + ms : Math.max(0, you.mudMs - ms);
  const speed = RUN_SPEED * (you.slowMs > 0 ? SLOW_SHARE : 1) * (you.wet ? WATER_SPEED : 1) * (you.mud ? mudSpeed(you.mudMs) : 1);
  you.belt = beltAt(spec, you);
  // Slippery ice (a room's `ice`, the Frozen Lake's): his run eases and slides (ghoul-frozen.js).
  const run = spec.ice && spec.ice.length ? iceRun(round, dir, speed, dt, you.state === "run" && you.shelf < 0 && you.y <= groundAt(spec, you.x) + 0.01) : dir * speed;
  const want = you.x + (run + you.belt) * dt;
  let nx = clamp(want, leftEdge(round), rightEdge(round));
  if (nx !== want) you.slide = 0;
  if (you.state === "run") {
    if (you.shelf >= 0 && !shelfThere(round, you.shelf)) return fall(you, 0);
    if (inp.down && you.shelf >= 0 && !dir) {
      you.drop = you.shelf;
      you.ducking = false;
      return fall(you, 0);
    }
    const duck = Boolean(inp.down) && !dir && you.shelf < 0;
    if (duck && !you.ducking) round.events.push({ type: "duck", x: you.x, y: you.y });
    you.ducking = duck;
    const way = Math.sign(nx - you.x);
    if (way && wallAt(spec, nx + way * EDGE, you.y + STEP_UP)) {
      nx = you.x;
      you.slide = 0;
    }
    const f = standing(round, nx, you.y);
    you.x = nx;
    if (f) {
      you.y = f.y;
      you.shelf = f.shelf;
      return;
    }
    return fall(you, COYOTE_MS);
  }
  // In the air: no wall passed, gravity, then a landing.
  if (flung) nx = clamp(you.x + you.flingVx * dt, leftEdge(round), rightEdge(round));
  const push = flung ? Math.sign(you.flingVx) : dir || Math.sign(nx - you.x);
  if (push && wallAt(spec, nx + push * EDGE, you.y + 0.05)) {
    nx = you.x;
    you.slide = 0;
  }
  you.coyote = Math.max(0, you.coyote - ms);
  you.vy = Math.max(-FALL_MAX, you.vy - GRAVITY * dt);
  const py = you.y;
  you.x = nx;
  you.y += you.vy * dt;
  if (you.drop >= 0 && you.y < spec.shelves[you.drop][2] - 1) you.drop = -1;
  if (you.vy > 0) return;
  const f = landOn(round, you.x, py, you.y, you.drop);
  if (!f) return;
  you.y = f.y;
  you.vy = 0;
  you.flingMs = 0;
  you.state = "run";
  you.shelf = f.shelf;
  you.drop = -1;
  you.cuttable = false;
  you.flapped = false;
  round.events.push({ type: "land", x: you.x, y: you.y });
}

function fall(you, coyote) {
  you.state = "air";
  you.ducking = false;
  you.vy = 0;
  you.shelf = -1;
  you.coyote = coyote;
}

/* ------------------------------------------------------------ monsters */

let serial = 0;

// A monster of `kind` at (x, y), facing you; `over` adds or replaces fields.
export function spawnMonster(round, kind, x, y, over = {}) {
  if (round.monsters.length >= MAX_MONSTERS && !over.force) return null;
  const def = MONSTERS[kind];
  const spec = round.spec;
  const extra = ZOMBIES.has(kind) || kind === "skeleton" || kind === "hound" || kind === "spitter" || kind === "huntsman" ? spec.tough : 0;
  const m = {
    id: ++serial,
    kind,
    x,
    y,
    w: def.w,
    h: def.h,
    hp: def.hp + extra,
    max: def.hp + extra,
    vx: 0,
    vy: 0,
    dir: round.you.x < x ? -1 : 1,
    t: 0,
    rise: kind === "crawler" ? RISE_MS : 0,
    awake: kind !== "bat",
    act: ACT_START[kind] || "",
    wait: 0,
    phase: 0,
    throwIn: (kind === "spitter" ? SPIT_MS : SKEL_MS) * 0.45,
    windup: 0,
    hurt: 0,
    home: y,
    lift: 0,
    ...over,
  };
  delete m.force;
  round.monsters.push(m);
  round.events.push({ type: "spawn", kind, x, y });
  return m;
}

// What a hellhound, a widow and a wraith start out doing.
const ACT_START = Object.freeze({ hound: "prowl", spider: "hang", wraith: "idle", huntsman: "prowl", ...fromPacks("act") });
// The packs' rules by kind: whether one is solid, its moving, what its death
// leaves, what a horde one comes in with; a boss's fight, whether it shrugs
// off a hit, and each kind of hazard a boss leaves on the field.
const SOLIDS = fromPacks("solid");
const MOVERS = fromPacks("move");
const ON_KILL = fromPacks("kill");
const HORDE_WITH = fromPacks("horde");
const BOSS_MOVERS = fromPacks("boss");
const GUARDS = fromPacks("guard");
const HAZARDS = fromPacks("hazards");
// Kinds the Hedge Shears kill outright, a boss's weak spot (the damage
// multiplier of a shot) and what a boss's touch is called when it costs a life.
const CUT = new Set(listPacks("cut"));
const WEAK = fromPacks("weak");
const CAUSES = fromPacks("cause");
// Kinds that are stone just now (a shot glances off), a stage-wide twist run
// each slice (the Chapel's bell, which may set `round.stunMs`), what a bolt
// that hit a monster does besides its damage, and what else a bolt can strike.
const STONE = fromPacks("stone");
const TICKS = listPacks("tick");
const SHOTS = listPacks("shot");
const TARGETS = listPacks("target");
// What a pack does to carry Planny itself (the Runaway Cart's ride: a hook that
// returns true has moved him), and when he is put down in a room (a room set up,
// a respawn).
const RIDES = listPacks("ride");
const PLACES = listPacks("place");
const POINTERS = listPacks("pointer");
// Kinds that are out of sight just now (a shot goes through, a touch does
// nothing), that hurt nothing by touch, that Planny can stand on, and what a
// missile of a kind does where it lands (see ghoul-sanatorium.js).
const UNSEEN = fromPacks("unseen");
const HARMLESS = fromPacks("harmless");
const PLATFORMS = fromPacks("platform");
const LANDS = fromPacks("land");
// Your keys while the bell has frozen you: none.
const FROZEN = Object.freeze({});
// Whether the boss shrugs off shots and stomps just now.
const guarded = (b) => Boolean(GUARDS[b.kind] && GUARDS[b.kind](b));

// Whether a monster can be hit and can hurt: a crawler or a door's zombie
// still coming up, a gourdling still in the air, a faded ghost and a wraith
// not yet come cannot.
export function solid(m) {
  if (m.unseen) return false;
  if (SOLIDS[m.kind]) return SOLIDS[m.kind](m);
  if (m.kind === "crawler" || ZOMBIES.has(m.kind)) return m.rise <= 0;
  // A gourdling flung out of the Gourd is harmless till it lands and finds its feet.
  if (m.kind === "seed") return m.vy === 0 && m.rise <= 0;
  if (m.kind === "ghost") {
    const t = (m.t + m.phase) % (GHOST_SHOW_MS + GHOST_HIDE_MS);
    return t >= GHOST_APPEAR_MS && t < GHOST_SHOW_MS;
  }
  if (m.kind === "wraith") return m.act !== "idle";
  return true;
}

// Whether a monster is up and after you: solid, and not a roosting bat or a
// widow still on the ceiling.
export const roused = (m) => (m.kind !== "bat" || m.awake) && !(m.kind === "spider" && m.act === "hang") && solid(m);

// The ghost's share of full sight, 0 to 1, for the drawing.
export function ghostSight(m) {
  const t = (m.t + m.phase) % (GHOST_SHOW_MS + GHOST_HIDE_MS);
  if (t < GHOST_APPEAR_MS) return t / GHOST_APPEAR_MS;
  if (t < GHOST_SHOW_MS) return 1;
  const fade = Math.min(1, (t - GHOST_SHOW_MS) / 250);
  return 1 - fade * 0.88;
}

// Within UNDER_DX of straight under (or over) you a monster stops where it
// is, still facing the way it went, rather than turning back and forth
// every frame; once you move off it turns and comes on.
export const UNDER_DX = 1;
export const towardYou = (round, m) => (Math.abs(round.you.x - m.x) < UNDER_DX ? m.dir : Math.sign(round.you.x - m.x) || m.dir);

// A walker's step toward `dx` (the sign of the way it goes) at `speed`:
// never off an edge or up a wall; it stands and sways instead, or at a pit
// narrow enough, thinks about it and then leaps (ponder). Under you, it
// stands (UNDER_DX).
function walk(round, m, dir, speed, dt) {
  // One up a pile is moved by the pile.
  if (!dir || m.lift > 0 || Math.abs(round.you.x - m.x) < UNDER_DX) return;
  if (m.dir !== dir) m.ponder = 0;
  m.dir = dir;
  const nx = m.x + dir * speed * dt;
  if (wallAt(round.spec, nx + dir * m.w * 0.4, m.y + STEP_UP)) return wall(round, m, nx + dir * m.w * 0.4, dir, dt);
  // Walkers keep to the ground, but cross a board laid level with it over a
  // pit (a bridge) while it is there; never up onto a shelf.
  const f = footing(round, nx, m.y);
  // A gourdling runs straight off a shelf's end after you.
  if (!f && m.kind === "seed" && Number.isFinite(groundAt(round.spec, nx)) && groundAt(round.spec, nx) < m.y) {
    m.hop = { vx: dir * speed, vy: 6 };
    return;
  }
  if (!f) return ponder(round, m, nx, dir, dt);
  if (f.shelf >= 0 && Math.abs(f.y - m.y) > 0.01) return;
  m.ponder = 0;
  m.x = nx;
  m.y = f.y;
}

// A leap's time in the air, rising at `v`, to come down `drop` below where it
// left (a negative drop is floor above it).
const hopTime = (drop, v) => (v + Math.sqrt(v * v + 2 * GRAVITY * drop)) / GRAVITY;

// Where a leap from the edge at `nx` going `dir` lands, as { x, y, t, v }:
// HOP_IN past the first floor no higher than a step up (BOUND_UP on four legs) that a leap reaches
// (hopReach across on the level, more the further down); null for floor out
// of reach, too high, or past the arena's wall.
export function farSide(round, m, nx, dir) {
  const spec = round.spec;
  if (groundAt(spec, nx) >= m.y - STEP_UP) return null;
  const bound = bounds(m);
  const v = bound ? BOUND_V : HOP_V;
  const up = bound ? BOUND_UP : STEP_UP;
  const flat = hopTime(0, v);
  const reach = hopReach(m);
  for (let d = 0; d <= reach * 2; d += 0.5) {
    const x = nx + dir * d;
    const g = groundAt(spec, x);
    if (!Number.isFinite(g)) continue;
    if (g > m.y + up) return null;
    const t = hopTime(bound ? m.y - g : Math.max(0, m.y - g), v);
    if (d > (reach * t) / flat) return null;
    const to = x + dir * HOP_IN;
    const left = round.lockX >= 0 ? round.lockX + 2 : 2;
    return to >= left && to <= spec.length - 2 && groundAt(spec, to) === g ? { x: to, y: g, t, v } : null;
  }
  return null;
}

// Whether a walker has stood thinking long enough (a "ponder" event as it
// starts).
function thought(round, m, dt) {
  if (!m.ponder) round.events.push({ type: "ponder", x: m.x, y: m.y + m.h });
  m.ponder = (m.ponder || 0) + dt * 1000;
  if (m.ponder < PONDER_MS + (m.id % 4) * PONDER_STEP_MS) return false;
  m.ponder = 0;
  return true;
}

// A walker at a pit's edge: it stands thinking, then leaps across. One too
// heavy to leap still steps off a ledge onto the floor below.
function ponder(round, m, nx, dir, dt) {
  const below = groundAt(round.spec, nx);
  if (HEAVY.has(m.kind) && Number.isFinite(below) && below < m.y) {
    m.ponder = 0;
    m.hop = { vx: dir * MONSTERS[m.kind].speed * round.spec.pace, vy: 0 };
    return;
  }
  const to = HEAVY.has(m.kind) ? null : farSide(round, m, nx, dir);
  if (!to) {
    m.ponder = 0;
    return;
  }
  if (!thought(round, m, dt)) return;
  m.hop = { vx: (to.x - m.x) / to.t, vy: to.v };
  round.events.push({ type: "leap", kind: m.kind, x: m.x, y: m.y });
}

// A climber at a wall (its face at `wx`): it stands thinking, then climbs.
function wall(round, m, wx, dir, dt) {
  const spec = round.spec;
  const top = groundAt(spec, wx);
  if (!CLIMBERS.has(m.kind) || !Number.isFinite(top) || top - m.y > WALL_MAX) {
    m.ponder = 0;
    return;
  }
  if (!thought(round, m, dt)) return;
  const on = wx + dir * (m.w / 2 + 0.3);
  m.scale = { top, x: groundAt(spec, on) === top ? on : wx + dir * 0.5 };
  round.events.push({ type: "scale", kind: m.kind, x: m.x, y: m.y });
}

// A walker up a wall: on up its face, then onto the floor at its top.
function scaleOn(m, dt) {
  m.y += WALL_V * dt;
  if (m.y < m.scale.top) return;
  m.y = m.scale.top;
  m.x = m.scale.x;
  m.scale = null;
}

// A walker in the air: down onto the floor or shelf it crosses, or into
// the dark below.
function hopOn(round, m, dt) {
  const py = m.y;
  m.hop.vy = Math.max(-FALL_MAX, m.hop.vy - GRAVITY * dt);
  m.x += m.hop.vx * dt;
  m.y += m.hop.vy * dt;
  const f = m.hop.vy < 0 ? landing(round, m.x, py, m.y, -1) : null;
  if (f) {
    m.y = f.y;
    m.hop = null;
  } else if (m.y < PIT_Y) m.dead = true;
}

// Gourdlings chase you up and down the shelves: with you above, one under a
// shelf no more than SEED_REACH over it crouches SEED_CROUCH_MS and jumps up
// onto it (toward where you are along it), SEED_JUMP_MS between jumps; with
// you below, it runs off its shelf's end and drops (see walk).
export const SEED_REACH = 13;
export const SEED_CROUCH_MS = 250;
export const SEED_JUMP_MS = 700;
function seedJump(round, m, ms) {
  const you = round.you;
  m.jumpIn = Math.max(0, (m.jumpIn || 0) - ms);
  if (m.crouch > 0) {
    m.crouch = Math.max(0, m.crouch - ms);
    if (m.crouch > 0) return true;
    const vy = Math.sqrt(2 * GRAVITY * (m.to.top - m.y + 2));
    const t = (vy + Math.sqrt(2 * GRAVITY * 2)) / GRAVITY;
    m.hop = { vx: (m.to.x - m.x) / t, vy };
    m.dir = Math.sign(m.to.x - m.x) || m.dir;
    m.jumpIn = SEED_JUMP_MS;
    round.events.push({ type: "leap", kind: m.kind, x: m.x, y: m.y });
    return true;
  }
  if (m.jumpIn > 0 || you.y < m.y + 2.5 || Math.abs(you.x - m.x) > 40) return false;
  let to = null;
  round.spec.shelves.forEach(([x0, x1, top], i) => {
    if (!shelfThere(round, i) || top <= m.y + 2 || top > m.y + SEED_REACH || top > you.y + 1) return;
    const x = clamp(you.x, x0 + 1.2, x1 - 1.2);
    if (Math.abs(x - m.x) > 12) return;
    if (!to || Math.abs(top - you.y) < Math.abs(to.top - you.y)) to = { top, x };
  });
  if (!to) return false;
  m.to = to;
  m.crouch = SEED_CROUCH_MS;
  return true;
}

// A thrown bone (or glob of acid, `kind`) from (x, y) at your chest: its
// flight timed to come down there, across no faster than BONE_VX. `by`, the
// thrower's kind, rides on the "throw" event so each thrower sounds its own.
export function throwBone(round, x, y, scale = 1, kind = "bone", by = null) {
  const you = round.you;
  const dy = you.y + 2 - y;
  const disc = BONE_V * BONE_V - 2 * BONE_G * dy;
  const t = disc > 0 ? (BONE_V + Math.sqrt(disc)) / BONE_G : (2 * BONE_V) / BONE_G;
  const vx = clamp(((you.x - x) / t) * scale, -BONE_VX * scale, BONE_VX * scale);
  const b = { id: ++serial, kind, x, y, vx, vy: BONE_V, spin: 0, life: 4000 };
  round.bones.push(b);
  round.events.push({ type: "throw", kind, by, x, y });
  return b;
}

// One slice of each monster's moving, by kind.
function moveMonsters(round, slice, random) {
  const you = round.you;
  const spec = round.spec;
  const pace = spec.pace;
  for (const m of round.monsters) {
    // A choir ghost's song (`hasteMs`) runs a monster's time `haste` times as fast.
    const ms = m.hasteMs > 0 ? slice * m.haste : slice;
    const dt = ms / 1000;
    if (UNSEEN[m.kind]) m.unseen = Boolean(UNSEEN[m.kind](round, m));
    if (m.hasteMs > 0) m.hasteMs -= slice;
    // A faded ghost never turns solid on top of you: it waits till you are clear.
    if (!(m.kind === "ghost" && !solid(m) && Math.abs(you.x - m.x) < GHOST_CLEAR && Math.abs(you.y + YOU_H / 2 - (m.y + m.h / 2)) < GHOST_CLEAR)) m.t += ms;
    m.hurt = Math.max(0, m.hurt - ms);
    // Dazed by Flash Powder or held by a Bear Trap (ghoul-arms.js): shown a while, and still deadly to touch.
    if (m.litMs > 0) m.litMs -= slice;
    if (m.stunMs > 0) {
      m.stunMs -= slice;
      continue;
    }
    if (m.hop) {
      hopOn(round, m, dt);
      continue;
    }
    if (m.scale) {
      scaleOn(m, dt);
      continue;
    }
    // A bridge gone from under a walker: it drops into the pit.
    if (WALKERS.has(m.kind) && m.rise <= 0 && !m.vy && !(m.lift > 0) && !footing(round, m.x, m.y)) {
      m.hop = { vx: 0, vy: 0 };
      hopOn(round, m, dt);
      continue;
    }
    if (MOVERS[m.kind]) {
      MOVERS[m.kind](round, m, ms, KIT);
      continue;
    }
    const dx = you.x - m.x;
    const toward = towardYou(round, m);
    if (ZOMBIES.has(m.kind)) {
      if (m.kind === "runner" && !m.warned && m.x > round.camX - RUNNER_WARN && m.x < round.camX + FIELD_W + RUNNER_WARN) {
        m.warned = true;
        round.events.push({ type: "runner", x: clamp(m.x, round.camX + 3, round.camX + FIELD_W - 3), y: m.y + m.h, side: Math.sign(m.x - you.x) || 1 });
      }
      if (m.rise > 0) {
        m.rise = Math.max(0, m.rise - ms);
        continue;
      }
      const near = Math.abs(dx) < LURCH_RANGE && Math.abs(you.y - m.y) < 6;
      walk(round, m, toward, (near ? MONSTERS[m.kind].lurch : MONSTERS[m.kind].speed) * pace, dt);
      m.lurching = near;
    } else if (m.kind === "crawler" || m.kind === "seed") {
      if (m.rise > 0) {
        m.rise = Math.max(0, m.rise - ms);
        continue;
      }
      if (m.kind === "seed" && m.vy !== 0) {
        // Flung out of the Gourd: in the air till it lands.
        m.vy -= GRAVITY * dt;
        const py = m.y;
        const nx = clamp(m.x + m.vx * dt, round.lockX >= 0 ? round.lockX + 2 : 2, spec.length - 2);
        m.x = nx;
        m.y += m.vy * dt;
        const f = m.vy < 0 ? landing(round, m.x, py, m.y, -1) : null;
        if (f) {
          m.y = f.y;
          m.vy = 0;
          m.vx = 0;
          // A moment to find its feet before it runs at you.
          m.rise = SEED_LAND_MS;
        }
        if (m.y < PIT_Y) m.dead = true;
        continue;
      }
      if (m.kind === "seed" && seedJump(round, m, ms)) continue;
      walk(round, m, toward, MONSTERS[m.kind].speed * pace, dt);
    } else if (m.kind === "bat") {
      if (!m.awake) {
        if (Math.abs(dx) < BAT_NEAR) {
          m.awake = true;
          round.events.push({ type: "bat", x: m.x, y: m.y });
        }
        continue;
      }
      // Swoops: level passes at your chest, turning BAT_TURN past you and
      // climbing a little before it comes back down for the next.
      const speed = MONSTERS.bat.speed * pace;
      if (!m.pass) m.pass = toward;
      const ahead = (m.x - you.x) * m.pass;
      if (ahead > BAT_TURN) {
        m.pass = -m.pass;
        m.climb = 300;
      }
      m.climb = Math.max(0, (m.climb || 0) - ms);
      const ty = m.climb > 0 ? you.y + 12 : you.y + SHOT_Y - MONSTERS.bat.h / 2;
      // Once close it holds its height: it never drops onto your head.
      const close = Math.abs(dx) <= 9 && m.climb <= 0;
      const steer = close ? 0 : clamp((ty - m.y) * 5, -BAT_STEER, BAT_STEER);
      m.vx = clamp(m.vx + m.pass * BAT_STEER * 2 * dt, -speed, speed);
      m.vy = clamp(m.vy + (steer - m.vy) * Math.min(1, (close ? 20 : 6) * dt), -speed * 0.8, speed * 0.8);
      m.x += m.vx * dt;
      m.y = Math.max(groundAt(spec, m.x) + 0.6, Math.min(CHANDELIER_Y, m.y + (m.vy + Math.sin(m.t / 140) * 1.5) * dt));
      m.dir = Math.sign(m.vx) || m.dir;
    } else if (m.kind === "ghost") {
      const speed = MONSTERS.ghost.speed * pace;
      const ty = you.y + 1;
      const d = Math.hypot(dx, ty - m.y) || 1;
      m.x += (dx / d) * speed * dt;
      m.y += ((ty - m.y) / d) * speed * dt;
      m.dir = toward;
    } else if (m.kind === "hound") moveHound(round, m, ms, toward);
    else if (m.kind === "spider") moveSpider(round, m, ms, toward);
    else if (m.kind === "huntsman") moveHuntsman(round, m, ms, toward);
    else if (m.kind === "wraith") moveWraith(round, m, ms);
    else if (m.kind === "spitter") {
      m.dir = toward;
      if (m.windup > 0) {
        m.windup = Math.max(0, m.windup - ms);
        if (!m.windup) throwBone(round, m.x + m.dir * 1.8, m.y + m.h * 0.7, 0.9 + random() * 0.2, "acid", m.kind);
        continue;
      }
      if (Math.abs(dx) > SPIT_KEEP) walk(round, m, toward, MONSTERS.spitter.speed * pace, dt);
      const inView = m.x > round.camX - 2 && m.x < round.camX + FIELD_W + 2;
      if (!inView || Math.abs(dx) > SPIT_RANGE || Math.abs(dx) < SKEL_NEAR) continue;
      m.throwIn -= ms * pace;
      if (m.throwIn <= 0) {
        m.throwIn = SPIT_MS * (0.85 + random() * 0.3);
        m.windup = SPIT_WINDUP_MS;
        round.events.push({ type: "spit", kind: m.kind, x: m.x, y: m.y });
      }
    } else if (m.kind === "skeleton") {
      m.dir = toward;
      const inView = m.x > round.camX - 2 && m.x < round.camX + FIELD_W + 2;
      if (m.windup > 0) {
        m.windup = Math.max(0, m.windup - ms);
        if (!m.windup) throwBone(round, m.x + m.dir * 1.2, m.y + m.h * 0.85, 0.9 + random() * 0.2, "bone", m.kind);
        continue;
      }
      if (!inView || Math.abs(dx) > SKEL_RANGE || Math.abs(dx) < SKEL_NEAR) continue;
      m.throwIn -= ms * pace;
      if (m.throwIn <= 0) {
        m.throwIn = SKEL_MS * (0.85 + random() * 0.3);
        m.windup = SKEL_WINDUP_MS;
        round.events.push({ type: "windup", x: m.x, y: m.y });
      }
    }
  }
  skimOver(round);
}

// What swoops, and when: a ducked Planny is passed overhead (see SWOOP_CLEAR).
const SWOOPS = Object.freeze({ bat: () => true, wraith: (m) => m.act === "dive", ...fromPacks("swoops") });

// Holds each swooper near a ducked Planny on a ramp up over his head. A ramp by
// distance, not a rate, so no dive is too fast for it.
function skimOver(round) {
  const you = round.you;
  if (!you.ducking) return;
  for (const m of round.monsters) {
    if (m.dead || !SWOOPS[m.kind]?.(m)) continue;
    const short = Math.abs(m.x - you.x) - (HIT_W + m.w * 0.8) / 2;
    if (short > SWOOP_NEAR || m.y < you.y - 1) continue;
    m.y = Math.max(m.y, you.y + SWOOP_CLEAR - Math.max(0, short));
  }
}

// The piles: walkers on the same floor in a run each within STACK_NEAR of
// the next, STACK_MIN or more of them, climb over each other toward you
// while you are above and near; every walker not in a climbing pile comes
// back down. Returns the piles found, oldest walker first in each, for the
// unit suite.
export function piles(round, ms) {
  const dt = ms / 1000;
  const you = round.you;
  const floorOf = (m) => m.y - (m.lift || 0);
  const walkers = round.monsters.filter((m) => STACKERS.has(m.kind) && !m.dead && solid(m) && !m.vy && !m.hop && !m.scale);
  walkers.sort((a, b) => a.x - b.x);
  const found = [];
  let run = [];
  const close = () => {
    if (run.length >= STACK_MIN) found.push(run.slice().sort((a, b) => a.id - b.id));
    run = [];
  };
  for (const m of walkers) {
    const last = run[run.length - 1];
    if (last && (m.x - last.x > STACK_NEAR || Math.abs(floorOf(m) - floorOf(last)) > 0.5)) close();
    run.push(m);
  }
  close();
  const target = new Map();
  const pileOf = new Map();
  for (const pile of found) {
    const base = pile[0];
    const floor = floorOf(base);
    const need = you.y - floor;
    if (need < base.h * 0.5 || Math.abs(you.x - base.x) > STACK_REACH || you.out > 0) continue;
    let lift = 0;
    pile.forEach((m, i) => {
      if (i > 0 && lift + STACK_STEP * pile[i - 1].h <= need) lift += STACK_STEP * pile[i - 1].h;
      target.set(m, lift);
      pileOf.set(m, pile);
    });
    if (!round.climbSeen && pile.some((m) => m.lift > 1)) {
      round.climbSeen = true;
      round.events.push({ type: "climb", x: base.x, y: floor + lift });
    }
  }
  for (const m of round.monsters) {
    if (!STACKERS.has(m.kind) || m.dead) continue;
    const want = target.get(m) ?? 0;
    if (!m.lift && !want) continue;
    const floor = floorOf(m);
    m.lift = want > m.lift ? Math.min(want, m.lift + CLIMB_V * dt) : Math.max(want, m.lift - UNSTACK_V * dt);
    m.y = floor + m.lift;
    if (want > 0 && m.lift > 0) {
      // Up the pile: drawn in over the one at the bottom, a little to one side.
      const pile = pileOf.get(m);
      const sway = pile.indexOf(m) % 2 ? 0.35 : -0.35;
      m.x += (pile[0].x + sway - m.x) * Math.min(1, 6 * dt);
      m.dir = towardYou(round, m);
    }
  }
  return found;
}

// A hellhound: prowls toward you, crouches growling once close on your
// level, lunges in a low arc, and rests a moment after it lands. One that
// lunges into a pit is gone.
function moveHound(round, m, ms, toward) {
  const dt = ms / 1000;
  const you = round.you;
  const spec = round.spec;
  const pace = spec.pace;
  if (m.act === "leap") {
    const py = m.y;
    const nx = m.x + m.vx * dt;
    if (!wallAt(spec, nx + Math.sign(m.vx) * m.w * 0.4, m.y + 0.05)) m.x = nx;
    m.vy = Math.max(-FALL_MAX, m.vy - GRAVITY * dt);
    m.y += m.vy * dt;
    const g = groundAt(spec, m.x);
    if (m.vy < 0 && py >= g && m.y <= g) Object.assign(m, { y: g, vx: 0, vy: 0, act: "rest", wait: HOUND_REST_MS });
    if (m.y < PIT_Y) m.dead = true;
    return;
  }
  if (m.wait > 0) {
    m.wait = Math.max(0, m.wait - ms * (m.act === "crouch" ? 1 : pace));
    if (m.wait > 0) return;
    if (m.act === "crouch") {
      Object.assign(m, { act: "leap", vx: m.dir * HOUND_LUNGE_VX * pace, vy: HOUND_LUNGE_V });
      round.events.push({ type: "lunge", x: m.x, y: m.y });
      return;
    }
  }
  if (Math.abs(you.x - m.x) < HOUND_RANGE && Math.abs(you.y - m.y) < 5) {
    Object.assign(m, { dir: toward, act: "crouch", wait: HOUND_CROUCH_MS });
    round.events.push({ type: "growl", x: m.x, y: m.y });
    return;
  }
  m.act = "prowl";
  walk(round, m, toward, MONSTERS.hound.speed * pace, dt);
}

// A Huntsman: runs at you along the floor, crouches once close, and springs
// at you, high and fast; one that springs into a pit is gone.
function moveHuntsman(round, m, ms, toward) {
  const dt = ms / 1000;
  const you = round.you;
  const spec = round.spec;
  const pace = spec.pace;
  if (m.act === "leap") {
    const py = m.y;
    const nx = m.x + m.vx * dt;
    if (!wallAt(spec, nx + Math.sign(m.vx) * m.w * 0.4, m.y + 0.05)) m.x = nx;
    m.vy = Math.max(-FALL_MAX, m.vy - GRAVITY * dt);
    m.y += m.vy * dt;
    const g = groundAt(spec, m.x);
    if (m.vy < 0 && py >= g && m.y <= g) Object.assign(m, { y: g, vx: 0, vy: 0, act: "rest", wait: HUNT_REST_MS });
    if (m.y < PIT_Y) m.dead = true;
    return;
  }
  if (m.wait > 0) {
    m.wait = Math.max(0, m.wait - ms * (m.act === "crouch" ? 1 : pace));
    if (m.wait > 0) return;
    if (m.act === "crouch") return springAt(round, m);
  }
  const up = you.y - m.y;
  if (Math.abs(you.x - m.x) < HUNT_RANGE && up > -3 && up < HUNT_HIGH && you.out <= 0) {
    Object.assign(m, { dir: toward, act: "crouch", wait: HUNT_CROUCH_MS });
    round.events.push({ type: "growl", kind: m.kind, x: m.x, y: m.y });
    return;
  }
  m.act = "prowl";
  walk(round, m, toward, MONSTERS.huntsman.speed * pace, dt);
}

// A Huntsman's spring: up to HUNT_UP over your height, coming down on where
// you are now.
export function springAt(round, m) {
  const you = round.you;
  const rise = Math.max(0, you.y + 1 - m.y);
  const vy = Math.sqrt(2 * GRAVITY * (rise + HUNT_UP));
  const t = (vy + Math.sqrt(2 * GRAVITY * HUNT_UP)) / GRAVITY;
  const vx = clamp((you.x - m.x) / t, -HUNT_VX, HUNT_VX);
  Object.assign(m, { act: "leap", vx, vy, dir: Math.sign(vx) || m.dir, y: m.y + 0.01 });
  round.events.push({ type: "lunge", kind: m.kind, x: m.x, y: m.y });
}

// A widow: hangs from the ceiling till you come near, drops on its thread
// onto whatever is under it, then skitters after you.
function moveSpider(round, m, ms, toward) {
  const you = round.you;
  if (m.act === "hang") {
    if (Math.abs(you.x - m.x) < SPIDER_NEAR && you.y < m.y - 4) {
      m.act = "drop";
      round.events.push({ type: "skitter", x: m.x, y: m.y });
    }
    return;
  }
  if (m.act === "drop") {
    const py = m.y;
    m.y -= SPIDER_DROP_V * round.spec.pace * (ms / 1000);
    const f = landing(round, m.x, py, m.y, -1);
    if (f) {
      m.y = f.y;
      m.act = "walk";
    } else if (m.y < PIT_Y) m.dead = true;
    return;
  }
  walk(round, m, toward, MONSTERS.spider.speed * round.spec.pace, ms / 1000);
}

// A wraith: unseen till you come near, then hovers ahead of you, shrieks,
// dives straight at where your chest was and on past, and climbs back to
// hover again. Walls never stop it; the floor turns it.
function moveWraith(round, m, ms) {
  const dt = ms / 1000;
  const you = round.you;
  const spec = round.spec;
  const pace = spec.pace;
  if (m.act === "idle") {
    if (Math.abs(you.x - m.x) < WRAITH_NEAR) {
      Object.assign(m, { act: "hover", wait: WRAITH_HOVER_MS * 0.6 });
      round.events.push({ type: "wraith", x: m.x, y: m.y });
    }
    return;
  }
  if (m.act === "hover" || m.act === "rise") {
    const side = Math.sign(m.x - you.x) || 1;
    const tx = you.x + side * WRAITH_KEEP;
    const ty = Math.min(m.home, you.y + WRAITH_ABOVE) + Math.sin(m.t / 400) * 1.5;
    const step = MONSTERS.wraith.speed * pace * (m.act === "rise" ? 1.8 : 1) * dt;
    m.x += clamp(tx - m.x, -step * 3, step * 3);
    m.y += clamp(ty - m.y, -step, step);
    m.dir = -side;
    if (m.act === "rise") {
      if (Math.abs(ty - m.y) < 1.5) Object.assign(m, { act: "hover", wait: WRAITH_HOVER_MS });
      return;
    }
    m.wait -= ms * pace;
    const inView = m.x > round.camX + 2 && m.x < round.camX + FIELD_W - 2;
    if (m.wait <= 0 && inView) {
      Object.assign(m, { act: "wind", wait: WRAITH_WIND_MS });
      round.events.push({ type: "shriek", x: m.x, y: m.y });
    }
    return;
  }
  if (m.act === "wind") {
    m.wait -= ms;
    if (m.wait > 0) return;
    const tx = you.x - m.x;
    const ty = you.y + (YOU_H - m.h) / 2 - m.y;
    const d = Math.hypot(tx, ty) || 1;
    Object.assign(m, { act: "dive", vx: (tx / d) * WRAITH_DIVE_V * pace, vy: (ty / d) * WRAITH_DIVE_V * pace, left: d + WRAITH_PAST, dir: Math.sign(tx) || m.dir });
    round.events.push({ type: "dive", x: m.x, y: m.y });
    return;
  }
  m.x += m.vx * dt;
  m.y += m.vy * dt;
  m.left -= Math.hypot(m.vx, m.vy) * dt;
  const floor = groundAt(spec, m.x);
  if (floor > -Infinity && m.y < floor + 0.3) {
    m.y = floor + 0.3;
    m.vy = Math.max(0, m.vy);
  }
  if (m.left <= 0) m.act = "rise";
}

// One slice of the thrown bones and acid, the puddles and the shockwaves.
function moveMissiles(round, ms) {
  const dt = ms / 1000;
  const spec = round.spec;
  let n = 0;
  for (const b of round.bones) {
    b.vy -= BONE_G * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.spin += dt * 12 * (Math.sign(b.vx) || 1);
    b.life -= ms;
    const g = groundAt(spec, b.x);
    if (b.vy < 0 && b.y <= g) {
      if (b.kind === "acid") {
        round.puddles.push({ id: ++serial, x: b.x, y: g, life: PUDDLE_MS });
        round.events.push({ type: "splash", x: b.x, y: g });
      } else if (!(LANDS[b.kind] && LANDS[b.kind](round, b, g, KIT))) round.events.push({ type: "clatter", x: b.x, y: g });
      continue;
    }
    if (b.life > 0 && b.y > PIT_Y && b.x > round.camX - 20 && b.x < round.camX + FIELD_W + 20) round.bones[n++] = b;
  }
  round.bones.length = n;
  n = 0;
  for (const p of round.puddles) if ((p.life -= ms) > 0) round.puddles[n++] = p;
  round.puddles.length = n;
  n = 0;
  for (const w of round.waves) {
    w.x += w.dir * WAVE_SPEED * spec.pace * dt;
    w.life -= ms;
    if (w.life > 0 && groundAt(spec, w.x) === w.y && w.x > leftEdge(round) - 2 && w.x < spec.length) round.waves[n++] = w;
  }
  round.waves.length = n;
}

/* --------------------------------------------------------------- bosses */

// One slice of each hazard by its kind's rule; gone once its rule says so.
function moveHazards(round, ms) {
  if (!round.hazards.length) return;
  let n = 0;
  for (const h of round.hazards) if (HAZARDS[h.kind] && HAZARDS[h.kind](round, h, ms, KIT)) round.hazards[n++] = h;
  // A hazard that felled the boss has just emptied the list.
  round.hazards.length = Math.min(n, round.hazards.length);
}

function makeBoss(round) {
  const spec = round.spec;
  const def = BOSSES[spec.boss];
  const x = spec.length - 24;
  return { kind: spec.boss, x, y: groundAt(spec, x), vx: 0, vy: 0, w: def.w, h: def.h, hp: spec.bossHp, max: spec.bossHp, state: "sleep", t: 0, wait: GOURD_WAIT_MS, hops: 0, attacks: 0, windup: 0, act: "", run: 0, landX: x, hurt: 0, dir: -1 };
}

// The arena's ends for the boss: it keeps ARENA_POCKET clear of each, so
// a corner is always somewhere a hop cannot land on you.
export const ARENA_POCKET = 6;
const arenaMin = (round, b) => round.spec.arena + ARENA_POCKET + b.w / 2;
const arenaMax = (round, b) => round.spec.length - ARENA_POCKET - b.w / 2;

// The Gourd's next move: any of GOURD_ACTS at random, but never one three
// times running (and only a spit at you up on a balcony over its head).
export function gourdAct(b, random) {
  let act = GOURD_ACTS[Math.floor(random() * GOURD_ACTS.length) % GOURD_ACTS.length];
  if (act === b.act && b.run >= 2) act = GOURD_ACTS[(GOURD_ACTS.indexOf(act) + 1 + Math.floor(random() * 2)) % GOURD_ACTS.length];
  b.run = act === b.act ? b.run + 1 : 1;
  return act;
}

function moveBoss(round, ms, random) {
  const b = round.boss;
  if (!b || b.state === "sleep") return;
  if (b.state === "down") {
    b.t += ms;
    return;
  }
  const dt = ms / 1000;
  const you = round.you;
  const spec = round.spec;
  const pace = spec.pace;
  b.t += ms;
  b.hurt = Math.max(0, b.hurt - ms);
  if (b.state === "intro") {
    if (b.t >= BOSS_INTRO_MS) {
      b.state = "fight";
      round.events.push({ type: "bossGo", kind: b.kind });
    }
    return;
  }
  // Dazed by Flash Powder or pinned by a Bear Trap (ghoul-arms.js).
  if (b.stunMs > 0) {
    b.stunMs -= ms;
    return;
  }
  if (BOSS_MOVERS[b.kind]) return BOSS_MOVERS[b.kind](round, b, ms, random, KIT);
  const floor = groundAt(spec, b.x);
  if (b.kind === "gourd") {
    if (b.vy !== 0 || b.y > floor) {
      b.vy -= GRAVITY * dt;
      const py = b.y;
      b.x = clamp(b.x + b.vx * dt, arenaMin(round, b), arenaMax(round, b));
      b.y += b.vy * dt;
      if (b.vy < 0 && py >= floor && b.y <= floor) {
        b.y = floor;
        b.vy = 0;
        b.vx = 0;
        b.wait = GOURD_WAIT_MS / pace;
        if (b.act === "quake") {
          for (const d of [-1, 1]) round.waves.push({ x: b.x + d * (b.w / 2), y: floor, dir: d, life: 6000, kind: "gourd" });
          round.events.push({ type: "slam", kind: "gourd", x: b.x, y: b.y, big: true });
          return;
        }
        const big = b.hops % 3 === 0;
        round.events.push({ type: "slam", kind: "gourd", x: b.x, y: b.y, big });
        const seeds = round.monsters.filter((m) => m.kind === "seed").length;
        for (let k = 0; k < (big ? 2 : 1) && seeds + k < MAX_SEEDS; k++) {
          const side = k % 2 ? 1 : -1;
          spawnMonster(round, "seed", b.x + side * (b.w / 2), b.y + 4, { vx: side * (8 + random() * 10), vy: 26 + random() * 14, dir: side, force: true });
        }
      }
      return;
    }
    b.dir = Math.sign(you.x - b.x) || b.dir;
    if (b.windup > 0) {
      b.windup = Math.max(0, b.windup - ms);
      if (b.windup > 0) return;
      for (const s of GOURD_SPIT) throwBone(round, b.x + b.dir * b.w * 0.3, b.y + b.h * 0.6, s, "acid", b.kind);
      round.events.push({ type: "spit", kind: b.kind, x: b.x, y: b.y + b.h * 0.6 });
      b.wait = GOURD_WAIT_MS / pace;
      return;
    }
    b.wait -= ms;
    if (b.wait > 0) return;
    // Up on a balcony over its head, you are out of a hop's reach: it spits.
    const high = you.state === "run" && you.shelf >= 0 && you.y >= floor + b.h + 2;
    b.act = high ? "spit" : gourdAct(b, random);
    if (high) b.run = 0;
    if (b.act === "spit") {
      b.windup = GOURD_SPIT_MS / pace;
      round.events.push({ type: "windup", x: b.x, y: b.y, boss: true, act: b.act });
      return;
    }
    if (b.act === "quake") {
      b.vx = 0;
      b.vy = GOURD_QUAKE_V;
      b.y += 0.01;
      round.events.push({ type: "hop", kind: "gourd", x: b.x, y: b.y, landX: b.x });
      return;
    }
    b.hops++;
    const v = b.hops % 3 === 0 ? GOURD_BIG_V : GOURD_HOP_V;
    const air = (2 * v) / GRAVITY;
    b.landX = clamp(you.x, arenaMin(round, b), arenaMax(round, b));
    b.vx = (b.landX - b.x) / air;
    b.vy = v;
    b.y += 0.01;
    round.events.push({ type: "hop", kind: "gourd", x: b.x, y: b.y, landX: b.landX });
    return;
  }
}

// Damage to the boss; at none it falls and the door opens.
function hurtBoss(round, dmg, how) {
  const b = round.boss;
  if (!b || b.state !== "fight") return false;
  b.hp = Math.max(0, b.hp - dmg);
  b.hurt = 120;
  round.events.push({ type: "bossHit", kind: b.kind, x: b.x, y: b.y + b.h / 2, how, weak: how === "weak" });
  if (b.hp > 0) return true;
  b.state = "down";
  b.t = 0;
  const points = round.spec.bossPoints;
  award(round, points);
  round.stats.bosses++;
  round.hasKey = true;
  const life = round.lives < MAX_LIVES;
  if (life) round.lives++;
  for (const m of round.monsters) round.events.push({ type: "poof", kind: m.kind, x: m.x, y: m.y + m.h / 2 });
  round.monsters.length = 0;
  round.bones.length = 0;
  round.waves.length = 0;
  round.puddles.length = 0;
  round.hazards.length = 0;
  round.events.push({ type: "bossDown", kind: b.kind, x: b.x, y: b.y + b.h / 2, points, life });
  return true;
}

/* ---------------------------------------------------------- hits, kills */

const award = (round, points) => {
  round.score += points;
};

// A shot, a stomp or a chandelier on monster `m`: hp off, and at none a kill.
export function hurt(round, m, dmg, how, random = Math.random) {
  if (m.dead) return false;
  m.hp -= dmg;
  m.hurt = 110;
  if (m.hp > 0) {
    round.events.push({ type: "hit", kind: m.kind, x: m.x, y: m.y + m.h / 2, how });
    return false;
  }
  kill(round, m, how, random);
  return true;
}

// A monster gone: its points times the chain, doubled for a headshot, a
// stomp or a chandelier, and now and then candy or a power-up left behind.
export function kill(round, m, how = "shot", random = Math.random) {
  m.dead = true;
  round.chain = round.chainMs > 0 ? round.chain + 1 : 1;
  round.chainMs = CHAIN_MS;
  const mult = chainMult(round.chain);
  const bonus = how === "head" || how === "stomp" || how === "crush" ? 2 : 1;
  const fade = m.horde ? Math.max(STRAY_MIN, STRAY_FADE ** round.strays++) : 1;
  const points = Math.round(MONSTERS[m.kind].points * mult * bonus * fade);
  award(round, points);
  round.stats.kills++;
  if (how === "head") round.stats.headshots++;
  if (how === "stomp") round.stats.stomps++;
  round.stats.bestChain = Math.max(round.stats.bestChain, round.chain);
  round.events.push({ type: "kill", kind: m.kind, x: m.x, y: m.y + m.h / 2, points, mult, how });
  // A bloater bursts in a harmless splash: only the acid it spits burns.
  if (m.kind === "spitter") round.events.push({ type: "burst", x: m.x, y: m.y + m.h / 2 });
  if (ON_KILL[m.kind]) ON_KILL[m.kind](round, m, how, KIT);
  if (m.horde) return points;
  const r = random();
  if (r < DROP_POWER) dropItem(round, pickPower(random, round, "", true), m.x, m.y + m.h / 2);
  else if (r < DROP_POWER + DROP_CANDY) dropItem(round, "candy", m.x, m.y + m.h / 2);
  // A weapon: its own band of the same roll, so no later roll shifts (ghoul-powers.js).
  else if (r < DROP_POWER + DROP_CANDY + ARM_DROP) dropItem(round, armDrop(round, (r - DROP_POWER - DROP_CANDY) / ARM_DROP), m.x, m.y + m.h / 2);
  return points;
}

// A weapon's drop takes no monster serial, so it shifts nothing later (a monster's id sets how long it ponders).
function dropItem(round, kind, x, y) {
  round.drops.push({ id: POWERS[kind]?.arm ? 0 : ++serial, kind, x, y, vx: 0, vy: 22, life: DROP_MS, rest: false });
}

// A life lost: with Lucky dice in hand the round first holds to roll one
// (ghoul-dice.js); else, or when it lands on 3 or lower, it holds while Planny
// tumbles, then puts him back.
export function lose(round, cause) {
  if (round.phase !== "play" || round.you.out > 0) return false;
  round.you.lift = null;
  // A bonus room's hearts are its own: no Lucky die is rolled for one.
  if (!round.bonusRound && beginRoll(round, cause, DICE_KIT)) return true;
  return takeLife(round, cause);
}

function takeLife(round, cause) {
  const you = round.you;
  if (!round.infinite) round.bonusRound ? round.bonusRound.hearts-- : round.lives--;
  round.chain = 0;
  round.chainMs = 0;
  round.roomLost = true;
  // The dark ride and the Runaway Cart play on after a hit that is not the last heart
  // (ghoul-ride.js; the cart blinks safe a moment, and a derail is re-seated by ghoul-cart.js).
  const b = round.bonusRound;
  const rolling = round.gallery || (round.cart && !round.cart.done) || (round.sled && !round.sled.done) || (round.runner && !round.runner.done);
  if (rolling && b && (round.infinite || b.hearts > 0)) {
    if (!round.gallery) you.safeMs = Math.max(you.safeMs, BONUS_SAFE_MS);
    round.events.push({ type: "lose", cause, x: you.x, y: you.y, lives: round.lives, hearts: b.hearts });
    return true;
  }
  you.out = CRASH_MS;
  you.outKind = cause;
  round.quickLoss = (you.aliveMs || 0) < QUICK_LOSS_MS;
  round.phase = "crash";
  round.phaseMs = CRASH_MS;
  round.input.jump = 0;
  round.events.push({ type: "lose", cause, x: you.x, y: you.y, lives: round.lives, hearts: round.bonusRound ? round.bonusRound.hearts : undefined });
  return true;
}

// Something touched you: the Garlic shield takes it (seeing off the monster
// that touched you), else a life.
function struck(round, cause, m = null) {
  const you = round.you;
  if (you.safeMs > 0) return false;
  if (you.garlic) {
    you.garlic = false;
    you.safeMs = GARLIC_SAFE_MS;
    if (m && !m.dead && MONSTERS[m.kind]) {
      kill(round, m, "garlic", () => 1);
      round.monsters = round.monsters.filter((q) => !q.dead);
    }
    round.events.push({ type: "garlic", x: you.x, y: you.y });
    return false;
  }
  return lose(round, cause);
}

/* ------------------------------------------------------------- powers */

// What ghoul-powers.js needs from here, handed to its rules the way KIT is
// handed to a stage pack.
const POWER_KIT = Object.freeze({ footing, leftEdge, rightEdge, seeded, landing, MAX_LIVES, MAX_DICE, GRAVITY, FALL_MAX, PIT_Y, HIT_W, HIT_H });
// And what ghoul-dice.js needs.
const DICE_KIT = Object.freeze({ SAFE_MS, PIT_Y, FIELD_W, footing, groundAt, leftEdge, rightEdge, takeLife, kill, give: (round, kind) => applyPowerWith(round, kind, POWER_KIT) });

export const applyPower = (round, kind) => applyPowerWith(round, kind, POWER_KIT);

/* ---------------------------------------------------------------- run */

// What ghoul-run.js needs from here: the room and stage tables, the timings
// and the helpers that set a room up, handed to its rules the way KIT is
// handed to a stage pack.
const RUN_KIT = Object.freeze({
  ROOMS, STAGES, stageById, FIELD_W, CHANDELIER_Y, START_LIVES, START_DICE, TIMED, DARK_CHANCE, BONUS_START, HURRY_MS, OFFER_N, PICK_HOLD_MS,
  READY_MS, BONUS_READY_MS, makeBonus, endBonus: (round, won) => endBonusWith(round, won, { award, ROOM_POINTS }), SAFE_MS, CLEAR_MS, BOSS_LOCK, ROOM_POINTS, FLAWLESS_POINTS, CAM_AT, CAM_LEAD, CAM_EASE,
  SPAWN_AHEAD, DOOR_CLEAR, EMERGE_MS, CRAWL_NEAR, SPIDER_Y, GHOST_SHOW_MS, GHOST_HIDE_MS, DARK_BEHIND, MAX_MONSTERS, HORDE_ROOM, HORDE_WITH, MONSTERS,
  roomFor, seeded, powerHere, pickPower, makeYou, makeBoss, groundAt, timeFor, award, clamp, variant, spawnMonster, introFor, bossIntroFor,
  mercy: (round) => retryMercy(round, POWER_KIT),
  diceGift: (round) => giveDiceGift(round, DICE_KIT.give),
  place: (round) => PLACES.forEach((f) => f(round, KIT)),
});

export const newRound = (seed = (Math.random() * 2 ** 31) >>> 0) => newRoundWith(seed, RUN_KIT);
export const stagesLeft = (round) => stagesLeftWith(round, RUN_KIT);
export const pickStage = (round, i = round.pick) => pickStageWith(round, i, RUN_KIT);
export const steerSelect = (round, dStage, dRoom) => steerSelectWith(round, dStage, dRoom, RUN_KIT);
export const takeSelect = (round) => {
  if (!takeSelectWith(round, RUN_KIT)) return false;
  fillBag(round, round.stage);
  return true;
};
const nextRoom = (round, random) => nextRoomWith(round, random, RUN_KIT);
// A stage's intro card moves on (ghoul-run.js): a move key, fire or a click.
export const takeIntro = (round) => takeIntroWith(round, RUN_KIT);
const camera = (round, ms) => cameraWith(round, ms, RUN_KIT);
const respawn = (round) => respawnWith(round, RUN_KIT);
const clearRoom = (round) => clearRoomWith(round, RUN_KIT);
const spawners = (round, ms, random) => spawnersWith(round, ms, random, RUN_KIT);
const horde = (round, ms, random) => hordeWith(round, ms, random, RUN_KIT);
const hurry = (round, ms, random) => hurryWith(round, ms, random, RUN_KIT);

// The tilt for your next bolt: toward the nearest monster (or bone) ahead
// whose middle is near your chest's height (a wraith anywhere the tilt
// reaches), never more than AIM_MAX; 0 for none.
export function aimAt(round) {
  const you = round.you;
  let best = AIM_RANGE;
  let aim = 0;
  for (const m of round.monsters) {
    if (m.dead || !roused(m)) continue;
    const dx = (m.x - you.x) * you.face;
    const dy = m.y + m.h / 2 - (you.y + shotY(you));
    const reach = m.kind === "wraith" ? Math.max(AIM_DY, dx * Math.tan(AIM_MAX)) : AIM_DY;
    if (dx <= 0 || dx >= best || Math.abs(dy) > reach) continue;
    best = dx;
    aim = clamp(Math.atan2(dy, dx), -AIM_MAX, AIM_MAX);
  }
  for (const b of round.bones) {
    const dx = (b.x - you.x) * you.face;
    const dy = b.y - (you.y + shotY(you));
    if (b.dead || dx <= 0 || dx >= best || Math.abs(dy) > AIM_DY) continue;
    best = dx;
    aim = clamp(Math.atan2(dy, dx), -AIM_MAX, AIM_MAX);
  }
  return aim;
}

// The blaster: while fire is held, a bolt (or three) every fireGap() of its
// heat (RAPID_MS with Rapid fire), and while it is not, it cools.
function fire(round, ms) {
  round.fireMs = Math.max(0, round.fireMs - ms);
  const you = round.you;
  if (!round.input.fire || you.out > 0 || round.gallery) {
    round.coolMs += ms;
    const cooling = Math.min(ms, round.coolMs - COOL_DELAY_MS);
    if (cooling > 0) round.heat = Math.max(0, round.heat - (COOL_RATE * cooling) / 1000);
    return;
  }
  round.coolMs = 0;
  if (round.fireMs > 0) return;
  if (round.effects.rapid > 0) round.fireMs = RAPID_MS;
  else {
    round.heat = Math.min(HEAT_MAX, round.heat + 1);
    round.fireMs = fireGap(round.heat);
  }
  const aim = aimAt(round);
  const angles = round.effects.spread > 0 ? [0, SPREAD_ANGLE, -SPREAD_ANGLE] : [0];
  for (const a of angles) round.shots.push({ x: you.x + you.face * 1.8, y: you.y + shotY(you), vx: Math.cos(a + aim) * SHOT_SPEED * you.face, vy: Math.sin(a + aim) * SHOT_SPEED, gone: 0 });
  you.fireFx = 90;
  round.stats.shots++;
  round.events.push({ type: "fire", x: you.x, y: you.y + shotY(you), face: you.face, spread: angles.length > 1 });
}

// Whether a circle at (x, y) of radius r touches a box w by h standing at (bx, by).
const touchBox = (x, y, r, bx, by, w, h) => {
  const cx = clamp(x, bx - w / 2, bx + w / 2);
  const cy = clamp(y, by, by + h);
  return Math.hypot(x - cx, y - cy) < r;
};

// One slice of the bolts: each flies until it hits a monster, a bone, the
// boss or a wall, or has gone SHOT_RANGE.
function moveShots(round, ms, random) {
  const dt = ms / 1000;
  const spec = round.spec;
  let n = 0;
  for (const s of round.shots) {
    const step = Math.hypot(s.vx, s.vy) * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.gone += step;
    let used = false;
    if (wallAt(spec, s.x, s.y)) {
      round.events.push({ type: "puff", x: s.x, y: s.y });
      continue;
    }
    // A silver bolt (or the Bone Saw's) goes on through every monster it hits, once each.
    const silver = round.effects.silver > 0 || round.effects.saw > 0;
    for (const m of round.monsters) {
      const stone = !m.dead && STONE[m.kind]?.(m);
      if (m.dead || !(stone || solid(m)) || (s.hit && s.hit.includes(m.id)) || !touchBox(s.x, s.y, SHOT_R, m.x, m.y, m.w, m.h)) continue;
      // Stone: a shot glances off, Holy Water breaks it.
      if (stone) {
        if (round.effects.holy > 0) hurt(round, m, 99, "holy", random);
        else round.events.push({ type: "glance", kind: m.kind, x: s.x, y: s.y });
        used = true;
        break;
      }
      const head = MONSTERS[m.kind].head && s.y > m.y + m.h * (1 - HEAD_SHARE);
      const cut = round.effects.shears > 0 && CUT.has(m.kind);
      const mult = SHOTS.reduce((d, f) => d * f(round, m, s, KIT, random), 1) * (s.dmg || 1);
      hurt(round, m, cut ? 99 : mult, cut ? "shears" : head ? "head" : "shot", random);
      if (silver || s.pierce) {
        s.hit = [...(s.hit || []), m.id];
        continue;
      }
      used = true;
      break;
    }
    if (!used) {
      for (const b of round.bones) {
        if (b.dead || Math.hypot(b.x - s.x, b.y - s.y) > BONE_R + SHOT_R) continue;
        b.dead = true;
        award(round, BONE_POINTS);
        round.events.push({ type: "bone", kind: b.kind, x: b.x, y: b.y, points: BONE_POINTS });
        // A thrown weapon breaks what it meets and flies on.
        used = !s.arm;
        break;
      }
    }
    if (!used) used = TARGETS.some((f) => f(round, s, KIT));
    const boss = round.boss;
    if (!used && boss && boss.state === "fight" && touchBox(s.x, s.y, SHOT_R, boss.x, boss.y, boss.w, boss.h) && guarded(boss)) {
      round.events.push({ type: "bossBlock", kind: boss.kind, x: s.x, y: s.y });
      used = true;
    }
    if (!used && boss && boss.state === "fight" && touchBox(s.x, s.y, SHOT_R, boss.x, boss.y, boss.w, boss.h)) {
      const skull = boss.kind === "bones" && !boss.headless && s.y > boss.y + boss.h * SKULL_FROM;
      const weak = WEAK[boss.kind] ? WEAK[boss.kind](boss, s, round, KIT) : 1;
      const dmg = (skull ? 2 : 1) * weak;
      hurtBoss(round, s.arm ? armBossDamage(round, dmg * s.bossDmg, KIT) : dmg, weak > 1 ? "weak" : skull ? "head" : "shot");
      used = true;
    }
    if (!used && s.gone < (s.range || SHOT_RANGE) && (s.free || (s.x > round.camX - 4 && s.x < round.camX + FIELD_W + 4))) round.shots[n++] = s;
  }
  round.shots.length = n;
  if (round.bones.some((b) => b.dead)) round.bones = round.bones.filter((b) => !b.dead);
  if (round.monsters.some((m) => m.dead)) round.monsters = round.monsters.filter((m) => !m.dead);
}

// Your feet came down on a monster's head (or the boss's): it is stomped
// and you bounce. A ghost cannot be stomped. Returns true for a stomp.
function stomps(round, py, random) {
  const you = round.you;
  if (you.vy >= 0 && !(you.state === "run" && py > you.y)) return false;
  if (you.out > 0) return false;
  for (const m of round.monsters) {
    if (m.dead || !MONSTERS[m.kind].stomp || !solid(m)) continue;
    const top = m.y + m.h;
    if (py < top - 0.9 || you.y > top + 0.01 || Math.abs(you.x - m.x) > (reaching(m) ? HEAD_BONK : (HIT_W + m.w) / 2)) continue;
    hurt(round, m, MONSTERS[m.kind].stompDamage ?? 99, "stomp", random);
    round.events.push({ type: "stomp", x: m.x, y: top });
    jump(round, round.input.up ? JUMP_V : STOMP_V);
    round.monsters = round.monsters.filter((q) => !q.dead);
    return true;
  }
  const b = round.boss;
  if (b && b.state === "fight") {
    const top = b.y + b.h;
    if (py >= top - 1.2 && you.y <= top + 0.01 && Math.abs(you.x - b.x) <= (HIT_W + b.w) / 2) {
      if (guarded(b)) round.events.push({ type: "bossBlock", kind: b.kind, x: you.x, y: top });
      else hurtBoss(round, STOMP_DAMAGE, "stomp");
      round.events.push({ type: "stomp", x: b.x, y: top });
      jump(round, STOMP_V + 8);
      return true;
    }
  }
  return false;
}

// How tall you are to what hits you, and where your bolts fly from.
const hitH = (you) => (you.ducking ? DUCK_H : HIT_H);
const shotY = (you) => (you.ducking ? DUCK_SHOT_Y : SHOT_Y);

// Whether a box (the monster's, shrunk a little) overlaps your hit box.
const boxHits = (you, x, y, w, h) => Math.abs(you.x - x) < (HIT_W + w * 0.8) / 2 && you.y < y + h * 0.9 && you.y + hitH(you) > y + h * 0.1;

// Whether a climbing walker's raised arms, ARMS_UP over its head either side
// of it, reach you.
const armsHit = (you, m) => {
  const dx = Math.abs(you.x - m.x);
  return reaching(m) && dx > HEAD_BONK && dx < (HIT_W + m.w * 0.8) / 2 && you.y < m.y + m.h + ARMS_UP && you.y + hitH(you) > m.y + m.h * 0.9;
};

// The first thing touching you, unless you are safe for a moment.
function hits(round) {
  const you = round.you;
  if (you.safeMs > 0 || you.out > 0) return;
  for (const m of round.monsters) {
    if (m.dead || !solid(m) || HARMLESS[m.kind]?.(m) || !(boxHits(you, m.x, m.y, m.w, m.h) || armsHit(you, m))) continue;
    struck(round, m.kind, m);
    return;
  }
  for (const b of round.bones) {
    if (!touchBox(b.x, b.y, BONE_R, you.x, you.y, HIT_W, hitH(you))) continue;
    b.dead = true;
    round.bones = round.bones.filter((q) => !q.dead);
    struck(round, b.cause || (b.kind === "acid" ? "acid" : b.kind === "stone" ? "stone" : "bone"));
    return;
  }
  for (const h of round.hazards) {
    if (!(h.live > 0) || Math.abs(you.x - h.x) >= (h.w + HIT_W) / 2 || you.y >= h.y + h.h || you.y + hitH(you) <= h.y) continue;
    struck(round, h.cause);
    return;
  }
  for (const p of round.puddles) {
    if (you.state !== "run" || you.y !== p.y || Math.abs(you.x - p.x) >= (PUDDLE_W + HIT_W) / 2 - 0.6) continue;
    struck(round, "acid");
    return;
  }
  for (const w of round.waves) {
    if (Math.abs(w.x - you.x) < 1.4 && you.y < w.y + WAVE_H) {
      struck(round, w.cause || "wave");
      return;
    }
  }
  const b = round.boss;
  if (b && (b.state === "fight" || b.state === "intro") && boxHits(you, b.x, b.y, b.w, b.h)) struck(round, CAUSES[b.kind] ? CAUSES[b.kind](b) : b.kind);
}

// The chandeliers: one shakes as you run under it, then drops and crushes
// whatever is under it where it lands.
function chandeliers(round, ms, random) {
  const dt = ms / 1000;
  const you = round.you;
  const spec = round.spec;
  for (const c of round.falls) {
    if (c.state === "hang") {
      if (Math.abs(you.x - c.x) < CHANDELIER_NEAR && you.y < c.y - 6) {
        c.state = "shake";
        c.shake = CHANDELIER_SHAKE_MS;
        round.events.push({ type: "creak", x: c.x, y: c.y });
      }
      continue;
    }
    if (c.state === "shake") {
      c.shake -= ms;
      if (c.shake <= 0) c.state = "fall";
      continue;
    }
    if (c.state !== "fall") continue;
    c.vy -= GRAVITY * dt;
    c.y += c.vy * dt;
    const bottom = c.y - 2;
    for (const m of round.monsters) {
      if (m.dead || Math.abs(m.x - c.x) > (CHANDELIER_W + m.w) / 2 || bottom > m.y + m.h || bottom < m.y) continue;
      hurt(round, m, 99, "crush", random);
    }
    round.monsters = round.monsters.filter((m) => !m.dead);
    if (Math.abs(you.x - c.x) < (CHANDELIER_W + HIT_W) / 2 - 0.4 && bottom < you.y + HIT_H && bottom > you.y) struck(round, "chandelier");
    const g = groundAt(spec, c.x);
    if (bottom <= g) {
      c.y = g + 2;
      c.state = "down";
      round.events.push({ type: "crash", x: c.x, y: g });
    }
  }
}

// The crumbling boards: one you stand on shakes, then falls away, then
// comes back.
function crumble(round, ms) {
  const { shelves } = round.spec;
  const you = round.you;
  for (let i = 0; i < shelves.length; i++) {
    if (shelves[i][3] !== "crumble") continue;
    if (round.down[i] > 0) {
      round.down[i] = Math.max(0, round.down[i] - ms);
      if (!round.down[i]) round.events.push({ type: "back", shelf: i });
    } else if (round.shake[i] > 0) {
      round.shake[i] = Math.max(0, round.shake[i] - ms);
      if (!round.shake[i]) {
        round.down[i] = CRUMBLE_BACK_MS;
        round.events.push({ type: "drop", shelf: i });
      }
    } else if (you.state === "run" && you.shelf === i) {
      round.shake[i] = CRUMBLE_MS;
      round.events.push({ type: "crumble", shelf: i, x: you.x, y: you.y });
    }
  }
}

// The clocks that run while you play: the bonus, the power-ups, being safe,
// the chain's window.
function timers(round, ms) {
  const you = round.you;
  round.bonusMs += ms;
  while (round.bonusMs >= 1000) {
    round.bonusMs -= 1000;
    if (round.bonus > 0) {
      round.bonus = Math.max(0, round.bonus - BONUS_STEP);
      if (!round.bonus && !round.hurry && !round.bonusRound) {
        round.hurry = true;
        round.events.push({ type: "hurry" });
      }
    }
  }
  if (round.timeMs > 0) {
    const was = Math.ceil(round.timeMs / 1000);
    round.timeMs = Math.max(0, round.timeMs - ms);
    const now = Math.ceil(round.timeMs / 1000);
    if (now < was && round.timeMs > 0 && round.timeMs <= TIME_WARN_MS) round.events.push({ type: "tick", left: now });
    if (!round.timeMs) {
      round.events.push({ type: "timeUp", x: you.x, y: you.y });
      lose(round, "time");
      return;
    }
  }
  for (const k of TIMED) {
    if (round.effects[k] > 0) {
      round.effects[k] = Math.max(0, round.effects[k] - ms);
      if (!round.effects[k]) round.events.push({ type: "expire", kind: k });
    }
  }
  round.stunMs = Math.max(0, (round.stunMs || 0) - ms);
  you.heldMs = Math.max(0, (you.heldMs || 0) - ms);
  you.flingMs = Math.max(0, (you.flingMs || 0) - ms);
  you.safeMs = Math.max(0, you.safeMs - ms);
  you.aliveMs = (you.aliveMs || 0) + ms;
  you.slowMs = Math.max(0, (you.slowMs || 0) - ms);
  you.dimMs = Math.max(0, (you.dimMs || 0) - ms);
  you.fireFx = Math.max(0, you.fireFx - ms);
  if (round.chainMs > 0) {
    round.chainMs = Math.max(0, round.chainMs - ms);
    if (!round.chainMs) round.chain = 0;
  }
}

// The top of the highest surface under you (the ground, or a shelf there),
// or -Infinity over a pit.
function surfaceBelow(round) {
  const you = round.you;
  let top = groundAt(round.spec, you.x);
  if (top > you.y) top = -Infinity;
  round.spec.shelves.forEach(([x0, x1, y], i) => {
    if (shelfThere(round, i) && i !== you.drop && you.x >= x0 && you.x <= x1 && y <= you.y && y > top) top = y;
  });
  return top;
}

// A jump press, first in its slice: from the ground or a shelf, from the
// air a moment after running off an edge, or saved a moment for the landing.
function takeOff(round, ms) {
  const you = round.you;
  const inp = round.input;
  if (inp.jump <= 0) return false;
  if (you.state === "run" || you.coyote > 0) {
    inp.jump = 0;
    return jump(round);
  }
  // With Bat wings, a press in the air flaps once for another jump, unless
  // you are coming down within FLAP_CLEAR of a surface: then it is a press
  // saved for the landing, as without them.
  if (round.effects.wings > 0 && !you.flapped && you.out <= 0 && !(you.vy < 0 && you.y - surfaceBelow(round) < FLAP_CLEAR)) {
    inp.jump = 0;
    you.flapped = true;
    jump(round);
    round.events.push({ type: "flap", x: you.x, y: you.y });
    return true;
  }
  inp.jump = Math.max(0, inp.jump - ms);
  return false;
}

// Whether you are at the open door, standing.
function atDoor(round) {
  const you = round.you;
  return round.hasKey && you.state === "run" && Math.abs(you.x - round.spec.door) < DOOR_REACH && you.y === groundAt(round.spec, round.spec.door);
}

// Your keys for one slice of walking: a jump press, a short hop (up let go
// while a jump still rises), then moveYou.
function walkYou(round, ms, frozen) {
  const you = round.you;
  if (frozen || you.heldMs > 0 || you.flingMs > 0) round.input.jump = 0;
  else takeOff(round, ms);
  if (you.state === "air") you.airMs = (you.airMs || 0) + ms;
  if (you.cuttable && !round.input.up && you.vy > CUT_V && you.airMs >= CUT_AFTER_MS) {
    you.vy = CUT_V;
    you.cuttable = false;
  }
  moveYou(round, ms);
}

function play(round, ms, random) {
  for (const f of TICKS) f(round, ms, KIT);
  timers(round, ms);
  if (round.phase !== "play") return;
  // The bell has frozen you (see moveYou) and everything else on the field,
  // but for the bolts in flight: no key does anything till it passes.
  const frozen = round.stunMs > 0;
  const you = round.you;
  const py = you.y;
  if (you.lift) stepLift(round, ms);
  else if (frozen || !RIDES.some((f) => f(round, ms, KIT))) walkYou(round, ms, frozen);
  markRest(you);
  if (atDoor(round)) return clearRoom(round);
  const spec = round.spec;
  if (round.boss && round.lockX < 0 && you.x > spec.arena + BOSS_LOCK) lockArena(round);
  if (!frozen) fire(round, ms);
  // While the Church bell rings, the dead stand still and no more come.
  if (!(round.effects.bell > 0 || frozen)) {
    spawners(round, ms, random);
    horde(round, ms, random);
    hurry(round, ms, random);
    moveMonsters(round, ms, random);
    piles(round, ms);
  }
  if (!frozen) {
    moveBoss(round, ms, random);
    moveHazards(round, ms);
    moveMissiles(round, ms);
  }
  moveShots(round, ms, random);
  stomps(round, py, random);
  chandeliers(round, ms, random);
  if (round.phase !== "play") return;
  hits(round);
  if (round.phase !== "play") return;
  pickups(round, ms, POWER_KIT);
  crumble(round, ms);
  if (you.y < PIT_Y && !you.lift && !wingSave(round)) {
    struckFall(round);
    return;
  }
  // Monsters far behind the camera are let go.
  if (round.monsters.some((m) => m.x < round.camX - 30 || m.y < PIT_Y)) round.monsters = round.monsters.filter((m) => m.x >= round.camX - 30 && m.y >= PIT_Y);
  camera(round, ms);
}

// What a stage pack's rules may use of this file's.
const KIT = Object.freeze({ BOSSES, shotY, aimAt, dropItem, guarded, weakOf: (b, s, round) => (WEAK[b.kind] ? WEAK[b.kind](b, s, round, KIT) : 1), stone: (m) => Boolean(STONE[m.kind]?.(m)), strike: (round, s) => TARGETS.some((f) => f(round, s, KIT)), harmlessNow: (m) => Boolean(HARMLESS[m.kind]?.(m)), walk, towardYou, throwBone, spawnMonster, groundAt, footing, struck, hurt, hurtBoss, fling, arenaMin, arenaMax, solid, FIELD_W, CHANDELIER_Y, SHOT_Y, YOU_H, HIT_W, HIT_H, GRAVITY, FALL_MAX, PIT_Y, BONE_G, DUCK_H, lose });

// Throws Planny: up at `v` and `dx` units across (signed) by the time he is
// back at the height he left, no key doing anything till he lands. What he
// lands on (a pit, a monster) is what it costs, never the throw.
function fling(round, dx, v) {
  const you = round.you;
  const t = (2 * v) / GRAVITY;
  Object.assign(you, { vy: v, state: "air", shelf: -1, coyote: 0, drop: -1, cuttable: false, airMs: 0, flapped: false, flingVx: dx / t, flingMs: Math.round(t * 1000) + 200 });
  return true;
}

// Bat wings catch a fall down a pit, before a life or a Lucky die is at stake:
// no key works while they carry him back. A ride has no ground to go back to.
function wingSave(round) {
  if (!(round.effects.wings > 0) || round.spec.ride) return false;
  const you = round.you;
  const at = reviveSpot(round, DICE_KIT);
  round.effects.wings = 0;
  round.input.jump = 0;
  Object.assign(you, { lift: { x0: you.x, y0: you.y, x: at.x, y: at.y, shelf: at.shelf, t: 0 }, vy: 0, state: "air", shelf: -1, coyote: 0, drop: -1, cuttable: false, flapped: false, flingMs: 0, ducking: false, safeMs: Math.max(you.safeMs, WING_SAVE_MS + SAFE_MS) });
  if (at.x !== you.x) you.face = Math.sign(at.x - you.x);
  round.events.push({ type: "wingSave", x: you.x, y: 1 });
  return true;
}

// One slice of the flight back, and setting him down at the end of it.
function stepLift(round, ms) {
  const you = round.you;
  const l = you.lift;
  l.t += ms;
  const k = Math.min(1, l.t / WING_SAVE_MS);
  const ease = k * (2 - k);
  you.x = l.x0 + (l.x - l.x0) * ease;
  you.y = l.y0 + (l.y - l.y0) * ease + Math.sin(Math.PI * k) * WING_SAVE_ARC;
  if (k < 1) return;
  Object.assign(you, { lift: null, x: l.x, y: l.y, shelf: l.shelf, state: "run", vy: 0 });
  round.events.push({ type: "land", x: you.x, y: you.y });
}

// A fall down a pit: always a life, garlic or not.
function struckFall(round) {
  round.you.garlic = false;
  lose(round, "pit");
}

export function advance(round, ms, random = Math.random) {
  let left = ms;
  while (left > 0 && !round.over) {
    const slice = Math.min(left, SLICE_MS);
    left -= slice;
    if (round.phase === "ready") {
      // The dark ride's title screen holds for a key or a press, its clock running on for the art.
      if (round.gallery?.waiting) {
        round.phaseMs += slice;
        continue;
      }
      round.phaseMs -= slice;
      if (round.phaseMs <= 0) {
        round.phase = "play";
        round.input.jump = 0;
        round.events.push({ type: "go" });
      }
      continue;
    }
    if (round.phase === "clear") {
      round.phaseMs -= slice;
      if (round.phaseMs <= 0) nextRoom(round, random);
      continue;
    }
    // Waiting on a choice of stage: nothing moves.
    if (round.phase === "pick") {
      round.phaseMs = Math.max(0, round.phaseMs - slice - left);
      return "pick";
    }
    if (round.phase === "select") return "select";
    if (onCard(round)) {
      stepIntroWith(round, slice);
      continue;
    }
    // The intro story, before the first room: only its pages move.
    if (round.phase === "story") {
      stepStory(round, slice);
      continue;
    }
    round.clock += slice;
    // Rolling the Lucky dice for a life: nothing else moves.
    if (round.phase === "roll") {
      rollDice(round, slice, random, DICE_KIT);
      continue;
    }
    if (round.phase === "crash") {
      round.phaseMs -= slice;
      round.you.out = Math.max(1, round.phaseMs);
      moveMonsters(round, slice, random);
      moveMissiles(round, slice);
      if (round.phaseMs <= 0) respawn(round);
      continue;
    }
    play(round, slice, random);
  }
  return round.over ? "over" : round.phase;
}

/* ------------------------------------------------------------- banners */

// Whether anything that matters to you is in a banner's strip, its middle
// `y` units down from the field's top: you, a monster on screen that can
// hurt you (not a roosting bat, a widow still on the ceiling, a faded ghost
// or one still coming up), the boss, a bone, a glob of acid, a puddle or a
// shockwave.
export function underBanner(round, y) {
  const lo = round.camX - 2;
  const hi = round.camX + FIELD_W + 2;
  const inStrip = (x, bottom, h) => x > lo && x < hi && FIELD_H - (bottom + h) < y + BANNER_REACH && FIELD_H - bottom > y - BANNER_REACH;
  const you = round.you;
  if (inStrip(you.x, you.y, YOU_H)) return true;
  // A roosting bat, or anything not yet able to hurt you, does not count.
  if (round.monsters.some((m) => roused(m) && inStrip(m.x, m.y, m.h))) return true;
  if (round.bones.some((b) => inStrip(b.x, b.y - BONE_R, BONE_R * 2))) return true;
  if (round.puddles.some((p) => inStrip(p.x, p.y, 1))) return true;
  if (round.waves.some((w) => inStrip(w.x, w.y, WAVE_H))) return true;
  const b = round.boss;
  return Boolean(b && b.state !== "sleep" && b.state !== "down" && inStrip(b.x, b.y, b.h));
}

// Where a banner goes: high on the field while you are low on it, low
// while you are high.
export const bannerY = (round) => (round.you.y > FIELD_H * 0.42 ? FIELD_H * 0.72 : FIELD_H * 0.3);

/* ------------------------------------------------------------- contract */

const MAX_PARTS = 320;
// Flares of light and floor stains kept at once, and how long a stain lasts.
const MAX_GLOWS = 24;
const MAX_SPLATS = 40;
const SPLAT_MS = 14000;
// Lightning: the first a few seconds in, then every BOLT_EVERY_MS or so,
// each BOLT_MS long.
const BOLT_FIRST_MS = 4000;
const BOLT_EVERY_MS = 11000;
const BOLT_MS = 650;

// How far a flash of lightning `left` ms from its end lifts the dark, 0 to
// 1: a bright flash, a flicker off, a second flash, then a fade.
export function lightning(left) {
  if (!(left > 0)) return 0;
  const p = 1 - left / BOLT_MS;
  if (p < 0.1) return 1;
  if (p < 0.2) return 0.15;
  if (p < 0.3) return 0.85;
  return Math.max(0, (1 - p) / 0.7) * 0.4;
}

// The end screen's nudge to play again, by the most stages ever cleared.
function teaser(most) {
  if (most < STAGES.length) return `Best: ${most} of ${STAGES.length} stages. Clear them all to escape.`;
  return "You have escaped the house before. Can you do it again?";
}

// The held sounds under play (no drone under the house: every room has its
// own music). The nearest monster within NEAR_SOUND (its hum by kind,
// louder the closer); a footstep every STEP_MS while you run; the heart
// pounding on the last life, quicker with a monster within HEART_NEAR.
const NEAR_HUMS = Object.freeze({ zombie: "ghoulMoan", runner: "ghoulMoan", glutton: "ghoulMoan", huntsman: "ghoulSnarl", crawler: "ghoulMoan", spitter: "ghoulMoan", bat: "ghoulFlutter", ghost: "ghoulSpecter", wraith: "ghoulSpecter", hound: "ghoulSnarl", spider: "ghoulSnarl" });
const NEAR_PITCH = Object.freeze({ runner: 1.35, glutton: 0.6, huntsman: 0.75, crawler: 1.25, spitter: 0.7, wraith: 0.8, spider: 1.4 });
const NEAR_SOUND = 36;
const STEP_MS = 270;
const HEART_MS = 1000;
const HEART_FAST_MS = 600;
const HEART_NEAR = 16;
// Each room's music, from ghoul-sfx.js, at one steady level whatever the
// monsters are doing: DREAD_ROOM brings in everything but a track's top
// layers (its melody and drums included), the clock's last seconds add
// DREAD_CLOCK, and a boss fight plays all of it. The level eases toward its
// target over about DREAD_EASE_MS, so a change never lands as a jolt.
export const ROOM_MUSIC = Object.freeze({ banister: "ghoulBanister", hall: "ghoulHall", darkride: "ghoulRideTheme", lychgate: "ghoulLychgate", graves: "ghoulGraves", mausoleums: "ghoulMausoleums", angel: "ghoulAngel", maze: "ghoulMaze", topiary: "ghoulTopiary", gazebo: "ghoulGazebo", yard: "ghoulYard", nave: "ghoulNave", tower: "ghoulTower", loft: "ghoulLoft", choir: "ghoulChoir", shaft: "ghoulShaft", tunnels: "ghoulTunnels", collapse: "ghoulCollapse", seam: "ghoulSeam", cart: "ghoulCart", midway: "ghoulMidway", mirrors: "ghoulMirrors", funhouse: "ghoulFunhouse", bigtop: "ghoulBigTop", admissions: "ghoulAdmissions", baths: "ghoulBaths", theater: "ghoulTheater", ward: "ghoulWard", street: "ghoulStreet", inn: "ghoulInn", square: "ghoulSquare", green: "ghoulGreen", foyer: "ghoulFoyer", gallery: "ghoulGallery", library: "ghoulLibrary", ballroom: "ghoulBallroom", kitchen: "ghoulKitchen", conservatory: "ghoulConservatory", attic: "ghoulAttic", crypt: "ghoulCrypt", huts: "ghoulHuts", lodge: "ghoulLodge", blackice: "ghoulBlackIce", sled: "ghoulSledRide", codeblue: "ghoulBlueRide", pew: "ghoulPewDirge", mower: "ghoulMowerRide", wagon: "ghoulWagonRide", hearse: "ghoulHearseRide", tray: "ghoulTrayRide", widow: "ghoulWidow", boardwalk: "ghoulGraves", hollow: "ghoulMaze", stilts: "ghoulMausoleums", bogboat: "ghoulBoatRide", drowning: "ghoulYard" });
const DREAD_ROOM = 0.7;
const DREAD_CLOCK = 0.2;
const DREAD_EASE_MS = 900;

// How full the music is right now, 0 to 1: the target the music eases toward.
export function dread(round) {
  const b = round.boss;
  if (b && round.lockX >= 0 && (b.state === "fight" || b.state === "intro")) return 0.9 + 0.1 * (1 - b.hp / Math.max(1, b.max));
  if (round.gallery && round.gallery.track) return 0.9;
  let level = DREAD_ROOM;
  if (round.timeMs > 0 && round.timeMs <= TIME_WARN_MS) level += DREAD_CLOCK;
  return Math.min(1, level);
}

// A sound's pitch a little either side of 1, so it never repeats exactly.
const vary = (n = 0.1) => 1 - n / 2 + Math.random() * n;

function create({ canvas, tone = () => {}, hum = () => {}, music = () => {}, onScore = () => {}, best = () => 0, memo = null }) {
  const ctx = canvas.getContext("2d");
  let colors = null;
  let round = newRound();
  let state = "ready";
  let u = MIN_CELL;
  let bestAtStart = 0;
  let beaten = false;
  // A jump press waits for the first tick after a start or a play-on, so the
  // key that plays on never also jumps; and up must be let go between jumps.
  let armed = false;
  let upHeld = false;
  // The most stages ever cleared in one run, and whether this run beat it.
  // Without a memo (the unit suite) it lasts as long as the game.
  let most = 0;
  let further = false;
  try {
    most = Math.max(0, memo ? Number(memo.get()) | 0 : 0);
  } catch {}
  // Particles, floating words, rings, banners, the chain's big number, the
  // shake and the flash, the flares of light and the stains on the floor,
  // and the lightning, in room units (y up) and ms.
  let fx = null;
  const resetFx = () => (fx = { parts: [], floats: [], banners: [], rings: [], glows: [], splats: [], shake: 0, shakeMag: 0, flash: null, clock: 0, cheer: 0, combo: null, candyRun: 0, candyMs: 0, step: 0, bolt: 0, nextBolt: BOLT_FIRST_MS, stepMs: 0, foot: 0, beatMs: 0, hot: false, dread: 0 });
  resetFx();

  const burst = (x, y, color, n, speed = 14, life = 500) => {
    for (let i = 0; i < n && fx.parts.length < MAX_PARTS; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.6 + Math.random() * 0.4), max: life, color, size: 0.45 + Math.random() * 0.55 });
    }
  };
  const float = (x, y, text, color, size = 2.4) => fx.floats.push({ x, y, rise: 0, text, color, size, life: 900, max: 900 });
  const ring = (x, y, color, r0, grow, ms = 420) => fx.rings.push({ x, y, color, r0, grow, life: ms, max: ms });
  // A flare of light that lifts the dark around (x, y) and fades over `ms`.
  const glow = (x, y, r, s, ms) => fx.glows.length < MAX_GLOWS && fx.glows.push({ x, y, r, s, life: ms, max: ms });
  // A stain on the floor at (x, y), the oldest gone once there are too many.
  const splat = (x, y, r, color) => {
    if (fx.splats.length >= MAX_SPLATS) fx.splats.shift();
    fx.splats.push({ x, y, r, color, life: SPLAT_MS });
  };
  const floorAt = (x) => groundAt(round.spec, x);
  // A banner waits its turn behind the one showing, three at most. One
  // tied to a phase (`phase`: "Ready?" to the hold before play) is dropped
  // once that phase has passed; a full queue makes room for a more
  // important one (`rank`: "New best!") by dropping the least important one
  // waiting, and otherwise drops the newcomer.
  // Every banner is up BANNER_STRETCH times as long as its caller asks, so the words can be read.
  const banner = (title, sub, color, ms = 1800, { phase = "", rank = 0 } = {}) => {
    ms *= BANNER_STRETCH;
    if (fx.banners.some((b) => b.title === title)) return null;
    if (fx.banners.length >= 3) {
      let low = -1;
      for (let i = 1; i < fx.banners.length; i++) if (fx.banners[i].rank < rank && (low < 0 || fx.banners[i].rank < fx.banners[low].rank)) low = i;
      if (low < 0) return null;
      fx.banners.splice(low, 1);
    }
    const b = { title, sub, color, life: ms, max: ms, tag: "", y: null, see: 1, phase, rank };
    fx.banners.push(b);
    return b;
  };
  // A shake still running keeps the stronger of the two; a new one starts
  // from its own strength, so one big hit never loudens every later shake.
  const shake = (ms, mag) => {
    fx.shakeMag = Math.max(fx.shake > 0 ? fx.shakeMag : 0, mag);
    fx.shake = Math.max(fx.shake, ms);
  };
  const flash = (color, ms = 220) => (fx.flash = { color, life: ms, max: ms });

  // A stage cleared: a new record (most stages in a run) is saved, and
  // named on the banner `b`.
  const markFurthest = (n, b) => {
    if (n <= most || round.practice) return;
    most = n;
    further = true;
    try {
      if (memo) memo.set(most);
    } catch {}
    if (b) b.tag = `NEW RECORD: ${n} OF ${STAGES.length} STAGES`;
  };

  // A room's banner, named for its stage and how far into it.
  const roomBanner = (n) => {
    const spec = round.spec;
    const b = banner(`Room ${n}: ${spec.name}`, spec.sub, lookOf(spec.id).color, 2000);
    const st = round.stage && stageById(round.stage);
    if (b && st) b.tag = `${st.title.toUpperCase()}, ${round.stageAt + 1} OF ${st.rooms.length}`;
    return b;
  };

  const kit = { tone, burst, float, ring, banner, shake, flash, glow, splat, floorAt, get fx() { return fx; }, roomBanner, markFurthest, monsters: MONSTERS, powers: POWERS, bosses: BOSSES, g: Object.freeze({ READY_MS, BOSS_INTRO_MS, CLEAR_MS }) };
  const handle = (e) => react(e, kit);

  // A score past the best this round began with: once a round, a fanfare.
  const checkBest = () => {
    if (beaten || round.practice || !(bestAtStart > 0) || round.score <= bestAtStart) return;
    beaten = true;
    tone("best");
    tone("fanfare", 0.45);
    banner("New best!", "Every point from here is a record", GOLD, 1700, { rank: 2 });
  };

  const drain = () => {
    colors ||= readColors(canvas);
    for (const e of round.events.splice(0)) handle(e);
    checkBest();
  };

  // Banners tied to a phase that has passed ("Ready?" once play is on) go,
  // wherever they wait in the queue.
  const dropPassed = () => {
    if (fx.banners.some((b) => b.phase && b.phase !== round.phase)) fx.banners = fx.banners.filter((b) => !b.phase || b.phase === round.phase);
  };

  const runFx = (ms) => {
    fx.clock += ms;
    const s = ms / 1000;
    fx.parts = fx.parts.filter((p) => {
      p.life -= ms;
      p.x += p.vx * s;
      p.y += p.vy * s;
      const drag = 0.9 ** (ms / 16);
      p.vx *= drag;
      p.vy = p.vy * drag - 12 * s;
      return p.life > 0;
    });
    fx.floats = fx.floats.filter((f) => {
      f.life -= ms;
      f.rise += 5 * s;
      return f.life > 0;
    });
    fx.rings = fx.rings.filter((r) => (r.life -= ms) > 0);
    fx.glows = fx.glows.filter((gl) => (gl.life -= ms) > 0);
    fx.splats = fx.splats.filter((sp) => (sp.life -= ms) > 0);
    // Lightning now and then, the thunder with it.
    fx.bolt = Math.max(0, fx.bolt - ms);
    fx.nextBolt -= ms;
    if (fx.nextBolt <= 0) {
      fx.bolt = BOLT_MS;
      fx.nextBolt = BOLT_EVERY_MS * (0.6 + Math.random() * 0.8);
      const deep = 0.8 + Math.random() * 0.4;
      tone("ghoulThunder", 0.5, deep);
      tone("ghoulCrack", 0.3, deep);
      tone("rumbleLong", 0.5, deep);
    }
    if (fx.combo && (fx.combo.life -= ms) <= 0) fx.combo = null;
    if (fx.lucky && (fx.lucky.life -= ms) <= 0) fx.lucky = null;
    fx.cheer = Math.max(0, fx.cheer - ms);
    fx.candyMs = Math.max(0, fx.candyMs - ms);
    dropPassed();
    if (fx.banners.length) {
      const b = fx.banners[0];
      if (b.y == null) b.y = bannerY(round);
      const target = underBanner(round, b.y) ? BANNER_SEE_THROUGH : 1;
      b.see += (target - b.see) * Math.min(1, ms / BANNER_FADE_MS);
      b.life -= ms;
      if (b.life <= 0) fx.banners.shift();
      dropPassed();
    }
    fx.shake = Math.max(0, fx.shake - ms);
    if (fx.flash && (fx.flash.life -= ms) <= 0) fx.flash = null;
  };

  // The pills' numbers: the stage and how many are cleared, lives, the bonus, the chain while it runs,
  // the key once held, and the power-ups held (a timed one emptying as it runs).
  const effects = [];
  const gauge = { fill: 0, free: HEAT_FREE / HEAT_MAX, rapid: null };
  const hud = { room: "", stage: "", time: 0, timeLow: false, bonus: 0, chain: 0, chainFill: 1, key: "", effects, gauge, arm: null };
  const hudOf = () => {
    const you = round.you;
    effects.length = 0;
    for (const k of TIMED) if (round.effects[k] > 0) effects.push({ text: PILL_WORDS[k], color: POWERS[k].color, fill: Math.min(1, round.effects[k] / POWERS[k].ms) });
    if (you.garlic) effects.push({ text: "GARLIC", color: POWERS.garlic.color, fill: 1 });
    if (you.hat) effects.push({ text: PILL_WORDS.hat, color: POWERS.hat.color, fill: 1 });
    if (round.dice > 0) effects.push({ text: `DICE x${round.dice}`, color: POWERS.die.color, fill: 1 });
    // The blaster's heat for the gauge, the notch where its bolts slow.
    gauge.fill = round.heat / HEAT_MAX;
    gauge.rapid = round.effects.rapid > 0 ? POWERS.rapid.color : null;
    // The stage (or the hall) by name, and how many stages are cleared of
    // all there are.
    const st = round.stage && stageById(round.stage);
    hud.room = (st ? st.title : round.spec.name).toUpperCase();
    hud.stage = `STAGE ${round.cleared.length} OF ${STAGES.length}`;
    hud.bonus = round.bonus;
    hud.hearts = round.bonusRound ? heartsText(round.bonusRound) : "";
    hud.time = round.timeMs > 0 ? Math.ceil(round.timeMs / 1000) : 0;
    hud.timeLow = round.timeMs > 0 && round.timeMs <= TIME_WARN_MS;
    hud.chain = round.chain > 1 ? chainMult(round.chain) : 0;
    hud.chainFill = round.chainMs / CHAIN_MS;
    // "have" once found, "need" until then; a room with no key (a boss, a bonus ride) shows nothing.
    hud.key = round.spec.key && !round.spec.boss && !round.spec.bonus ? (round.hasKey ? "have" : "need") : "";
    // The weapon that comes out next, its count, and how many other kinds wait under it.
    const top = armOnTop(round);
    hud.arm = top ? { kind: top.kind, n: top.n, more: round.arms.length - 1, text: `x${top.n}${round.arms.length > 1 ? ` +${round.arms.length - 1}` : ""}${round.armUsed ? "" : " TAP TAP"}`, color: POWERS[top.kind].color, fresh: !round.armUsed, pop: (round.armPopMs || 0) / ARM_POP_MS } : null;
    return hud;
  };

  // The view ghoul-draw.js draws from: one object, refilled each frame.
  const view = { g: Object.freeze({ W, H, HUD_H, PAD, FIELD_W, FIELD_H, YOU_W, YOU_H, CRASH_MS, CRUMBLE_BACK_MS, RISE_MS, SKEL_WINDUP_MS, BONES_WINDUP_MS, WAVE_H, CHANDELIER_W, CHANDELIER_SHAKE_MS, SHOT_Y, DUCK_SHOT_Y, GOURD_WAIT_MS, EMERGE_MS, PUDDLE_W, PUDDLE_MS, HOUND_CROUCH_MS, WRAITH_WIND_MS, SPIT_WINDUP_MS, CEILING_Y, ZOMBIES }), powers: POWERS, monsters: MONSTERS, bosses: BOSSES, groundAt, shelfThere, solid, ghostSight, roomFor, roomById, stages: STAGES, stageById, OFFER_N };
  const shakeAt = { x: 0, y: 0 };

  const paint = () => {
    if (!ctx) return;
    colors ||= readColors(canvas);
    // A banner takes its place on its first frame: a frame painted before the
    // next tick (the start's, held through the 3, 2, 1) would draw it at the top.
    dropPassed();
    const head = fx.banners[0] || null;
    if (head && head.y == null) head.y = bannerY(round);
    view.u = u;
    view.clock = fx.clock;
    view.state = state;
    view.colors = colors;
    view.round = round;
    view.spec = round.spec;
    view.fx = fx;
    view.pillH = Math.max(12 / u, 2.4);
    view.hud = hudOf();
    view.cheer = fx.cheer > 0 || round.phase === "clear";
    view.combo = fx.combo;
    view.flash = fx.flash;
    view.banner = head;
    view.lightning = lightning(fx.bolt);
    view.furthest = most;
    view.won = round.won;
    // A dot per stage along the start and end screens: those cleared this
    // run in their colors (or, before one, as many as the record, in gold).
    view.dots = STAGES.map((_, i) => (state === "ready" ? (i < most ? GOLD : null) : round.cleared[i] || null));
    view.lost = state === "over";
    view.overMs = fx.clock - (fx.overAt || 0);
    view.shake = null;
    if (fx.shake > 0 && state === "running") {
      shakeAt.x = (Math.random() - 0.5) * 2 * fx.shakeMag;
      shakeAt.y = (Math.random() - 0.5) * 2 * fx.shakeMag;
      view.shake = shakeAt;
    }
    view.tally = null;
    view.big = null;
    const record = most >= STAGES.length ? "You have escaped before" : `Best: ${most} of ${STAGES.length} stages`;
    if (state === "ready") view.tally = ["Run. Shoot. Clear every stage and escape before the house gets you", `Arrows run, up jumps, hold space to fire, tap it twice to throw what you find. ${record}`];
    else if (state === "over") {
      const st = round.stats;
      view.big = String(round.score);
      const how = `${st.kills} ghouls (${st.headshots} headshots, ${st.stomps} stomps), best chain x${chainMult(st.bestChain)}, ${st.candy} souls.`;
      if (round.won) view.tally = [`You escaped! Every stage cleared${beaten ? ". A new best!" : ""}`, how];
      else view.tally = [`Cleared ${round.cleared.length} of ${STAGES.length} stages, out in ${roomName(round.spec, round.room)}${further ? ". A new record!" : ""}${beaten ? " A new best!" : ""}`, `${how} ${round.practice ? "A practice run: nothing kept." : teaser(most)}`];
    }
    drawScene(ctx, view);
  };

  // Nothing held carries over a pause or a new round: a release may never
  // arrive, and a jump pressed early is dropped.
  const letGo = () => {
    const inp = round.input;
    inp.up = inp.down = inp.left = inp.right = inp.fire = false;
    resetTap(round);
    inp.jump = 0;
    upHeld = false;
    releaseStory(round);
  };

  // A new round. A real run opens on the intro story (ghoul-story.js) and the hall is announced when it ends; the stage select skips it.
  const begin = (story) => {
    colors = readColors(canvas);
    round = newRound();
    if (story) beginStory(round);
    state = "running";
    further = false;
    armed = false;
    upHeld = false;
    resetFx();
    try {
      bestAtStart = Number(best()) || 0;
    } catch {
      bestAtStart = 0;
    }
    beaten = false;
    if (!story) roomBanner(1);
    paint();
  };
  const start = () => begin(true);

  // The held sounds and the ones kept to a beat, each tick of a round still
  // running: a hum not asked for again fades by itself, so a pause or the
  // end goes quiet. Sounds only: nothing here touches the round.
  const sounds = (ms) => {
    const you = round.you;
    const spec = round.spec;
    const playing = round.phase === "play";
    // The story has its own drone under its own sounds, and the hall's music waits for the hall.
    if (round.phase === "story") {
      hum("ghoul:story", "ghoulStoryDrone", 0.6, 1);
      return;
    }
    const b = round.boss;
    const fight = Boolean(b && round.lockX >= 0 && (b.state === "fight" || b.state === "intro"));
    // The room's music, its dread eased toward where play is now.
    fx.dread += (dread(round) - fx.dread) * Math.min(1, ms / DREAD_EASE_MS);
    // A pack may switch the room's track mid-room with round.gallery.track (the dark ride's finale).
    const track = (round.gallery && round.gallery.track) || ROOM_MUSIC[spec.id];
    if (track) music(track, fx.dread);
    // The nearest monster that can be heard.
    let near = null;
    let nearD = Infinity;
    for (const m of round.monsters) {
      if (m.dead || !NEAR_HUMS[m.kind] || (m.kind === "bat" && !m.awake)) continue;
      const d = Math.hypot(m.x - you.x, m.y - you.y);
      if (d < nearD) {
        near = m;
        nearD = d;
      }
    }
    if (near && nearD < NEAR_SOUND) {
      const close = (1 - nearD / NEAR_SOUND) ** 1.5;
      hum("ghoul:near", NEAR_HUMS[near.kind], close * (solid(near) ? 1 : 0.5), (NEAR_PITCH[near.kind] ?? 1) * (1 + (near.id % 5) * 0.04));
    }
    // The boss heaving, its breath quickening as its hp runs down.
    if (fight) hum("ghoul:boss", "ghoulBoss", b.state === "intro" ? 0.6 : 0.9, 1 + 0.5 * (1 - b.hp / Math.max(1, b.max)));
    // A chandelier shaking loose rattles its chains.
    if (round.falls.some((c) => c.state === "shake")) hum("ghoul:chains", "ghoulChains", 0.8, 1);
    // The blaster's heat fizzing, a hiss once it starts to slow.
    if (round.heat >= HEAT_SHOWN && round.effects.rapid <= 0) {
      hum("ghoul:heat", "ghoulHeat", round.heat / HEAT_MAX, 0.7 + round.heat / HEAT_MAX);
      if (!fx.hot && round.heat > HEAT_FREE) {
        fx.hot = true;
        tone("hiss", 0.25, 1.2);
      }
    }
    if (round.heat < HEAT_FREE * 0.8) fx.hot = false;
    if (you.garlic) hum("ghoul:garlic", "ghoulGarlic", 0.8, 1);
    // Footsteps on the boards, left and right, higher on a shelf, now and
    // then a board creaking under you.
    if (playing && you.state === "run" && you.runMs > 0) {
      fx.stepMs -= ms;
      if (fx.stepMs <= 0) {
        fx.stepMs = STEP_MS;
        fx.foot ^= 1;
        tone("ghoulStep", 0.3, (you.shelf >= 0 ? 1.25 : 1) * (fx.foot ? 1.05 : 0.95) * vary(0.06));
        if (Math.random() < 0.08) tone("creakBoard", 0.12, vary(0.5));
      }
    } else fx.stepMs = 0;
    // The last life: a heartbeat, quicker with something close.
    if (playing && round.lives === 1) {
      fx.beatMs -= ms;
      if (fx.beatMs <= 0) {
        const close = nearD < HEART_NEAR || fight;
        fx.beatMs = close ? HEART_FAST_MS : HEART_MS;
        tone("heartbeat", close ? 0.55 : 0.4);
      }
    } else fx.beatMs = 0;
  };

  const end = () => {
    if (round.won) {
      tone("victory", 0.8);
      tone("fanfare", 0.6);
      flash(GOLD, 500);
    } else {
      tone("gameOver", 0.7);
      tone("ghoulToll", 0.45, 0.7);
      tone("ghoulLaughTrack", 0.55);
      fx.overAt = fx.clock;
      fx.laugh = 1;
    }
    state = "over";
    letGo();
    if (!round.practice) onScore(round.score);
  };

  const MOVES = Object.freeze({ left: true, right: true, up: true, down: true });

  return {
    get score() {
      return round.score;
    },
    get state() {
      return state;
    },
    // The lost end screen animates, so the window keeps ticking it.
    get animating() {
      return state === "over" && !round.won;
    },
    // For the tests only: the window never reads it.
    get round() {
      return round;
    },
    // Endless lives for this round (the Activities window's code), or not.
    cheat(on) {
      round.infinite = Boolean(on);
    },
    // The stage select (the window's stage code, for testing): a new round
    // that opens on every stage and room to choose from, kept as practice
    // (no best score, no record). Endless lives already on carry over.
    stageSelect() {
      const endless = Boolean(round.infinite);
      begin(false);
      round.infinite = endless;
      fx.banners.length = 0;
      openSelect(round);
      paint();
    },
    // And the pills' numbers, the blaster's gauge among them.
    get hud() {
      return hudOf();
    },
    start,
    pause() {
      if (state === "running") state = "paused";
      letGo();
      paint();
    },
    resume() {
      if (state !== "paused") return;
      state = "running";
      armed = false;
    },
    // The mouse (the window hands a press, a move and a let-go in CSS pixels): it
    // starts a round, and in the dark ride it aims and fires (ghoul-ride.js).
    // Any other key the window does not use: whether it started a ride waiting on one.
    anyKey() {
      return state === "running" && startRide(round);
    },
    pointer(type, x, y) {
      if (state === "ready" || state === "over") {
        if (type !== "down") return false;
        start();
        return true;
      }
      if (state !== "running") return false;
      const fx = x / u - PAD;
      const fy = y / u - HUD_H - PAD;
      if (onCard(round)) return type === "down" ? takeIntro(round) || true : true;
      if (round.phase === "story") return type === "down" ? takeStory(round) || true : true;
      return POINTERS.some((f) => f(round, type, fx, fy));
    },
    // Held arrows run until let go (their key repeats, held through the
    // countdown, keep them held). Up jumps once a press: never on a repeat,
    // never again until it is let go, never with the press that plays on.
    // Space starts a round (with fire off) or fires while held; while
    // paused it does nothing, since only the window plays on, through
    // resume().
    key(name, repeat = false) {
      if (state === "running" && isWaiting(round)) {
        if (!repeat) startRide(round);
        return true;
      }
      if (name === "action") {
        if (state === "ready" || state === "over") start();
        else if (state === "running" && round.phase === "select") {
          if (!repeat) takeSelect(round);
        } else if (state === "running" && round.phase === "pick") {
          if (!repeat) pickStage(round);
        } else if (state === "running" && onCard(round)) {
          if (!repeat) takeIntro(round);
        } else if (state === "running" && round.phase === "story") {
          pressStory(round, repeat);
        } else if (state === "running") {
          round.input.fire = true;
          // The dark ride's trigger: a tap shorter than a step still fires; no weapon.
          if (round.gallery) round.gallery.trigger = true;
          else if (!repeat) pressFireWith(round, KIT);
        }
        return true;
      }
      if (!MOVES[name]) return false;
      if (state !== "running") return true;
      // On the stage select: up and down pick a stage out, left and right
      // one of its rooms.
      if (round.phase === "select") {
        if (name === "up" || name === "down") steerSelect(round, name === "up" ? -1 : 1, 0);
        else steerSelect(round, 0, name === "left" ? -1 : 1);
        return true;
      }
      // Choosing a stage: left and right pick one out, up takes it.
      if (round.phase === "pick") {
        if (name === "left" || name === "right") steerPick(round, name === "left" ? -1 : 1);
        else if (name === "up" && !repeat) pickStage(round);
        return true;
      }
      // The intro story: any fresh move key turns the page.
      if (round.phase === "story") {
        if (!repeat) takeStory(round);
        return true;
      }
      // A stage's intro card: any fresh move key walks in (a repeat never does).
      if (onCard(round)) {
        if (!repeat) takeIntro(round);
        return true;
      }
      round.input[name] = true;
      if (name === "up") {
        if (!repeat && armed && !upHeld && round.phase === "play") round.input.jump = JUMP_BUFFER_MS;
        upHeld = true;
      }
      return true;
    },
    // A key let go: stop running that way, cut a rising jump short, or stop
    // firing.
    release(name) {
      if (name === "action") {
        round.input.fire = false;
        releaseFire(round);
        releaseStory(round);
      }
      else if (MOVES[name]) round.input[name] = false;
      if (name === "up") upHeld = false;
    },
    tick(ms) {
      // The lost end screen animates its "G A M E - O V E R"; the rest hold still.
      if (state === "over" && !round.won) {
        fx.clock += ms;
        // The rest of the laugh track, a second a part.
        if (fx.laugh && fx.laugh < 3 && fx.clock - fx.overAt >= fx.laugh * 1000) tone(`ghoulLaughTrack${++fx.laugh}`, 0.55);
        paint();
        return;
      }
      if (state !== "running") return;
      runFx(ms);
      advance(round, ms);
      drain();
      bonusTick(round, kit);
      if (round.over) end();
      else sounds(ms);
      paint();
      armed = true;
    },
    resize(w, h) {
      const next = Math.floor(Math.min(w / W, h / H) * 4) / 4;
      if (!(next >= MIN_CELL)) return false;
      u = next;
      colors = null;
      const ratio = typeof devicePixelRatio === "number" && devicePixelRatio > 0 ? devicePixelRatio : 1;
      canvas.width = Math.round(W * u * ratio);
      canvas.height = Math.round(H * u * ratio);
      if (canvas.style) {
        canvas.style.width = `${Math.round(W * u)}px`;
        canvas.style.height = `${Math.round(H * u)}px`;
      }
      if (ctx && typeof ctx.setTransform === "function") ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      paint();
      return true;
    },
  };
}

export default Object.freeze({ id: "ghoul", title: "Ghoul Rush", create });
