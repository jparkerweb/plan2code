// Plan2Code Web Console - Ghoul Rush's numbers and tables: every timing and size the rules share, the monsters and bosses with each stage pack's joined in (PACKS), the seeded dice, and a room's numbers at a depth (roomFor).
//
// One of the parts of ghoul.js (see its header and the list of parts there).

import { ARMS, releaseFire } from "../arms/ghoul-arms.js";
import { BANISTER } from "../rides/banister/ghoul-banister.js";
import { CART } from "../rides/cart/ghoul-cart.js";
import { RIDE } from "../rides/dark-ride/ghoul-ride.js";
import { GURNEY } from "../rides/gurney/ghoul-gurney.js";
import { HEARSE } from "../rides/hearse/ghoul-hearse.js";
import { LANTERN } from "../rides/lantern/ghoul-lantern.js";
import { MOWER } from "../rides/mower/ghoul-mower.js";
import { PEW } from "../rides/pew/ghoul-pew.js";
import { SLED } from "../rides/sled/ghoul-sled.js";
import { TRAY } from "../rides/tray/ghoul-tray.js";
import { WAGON } from "../rides/wagon/ghoul-wagon.js";
import { BOG } from "../stages/bog/ghoul-bog.js";
import { CARNIVAL } from "../stages/carnival/ghoul-carnival.js";
import { CHAPEL } from "../stages/chapel/ghoul-chapel.js";
import { FROZEN as FROZEN_LAKE } from "../stages/frozen/ghoul-frozen.js";
import { GRAVEYARD } from "../stages/graveyard/ghoul-graveyard.js";
import { GROUNDS } from "../stages/grounds/ghoul-grounds.js";
import { MINE } from "../stages/mine/ghoul-mine.js";
import { SANATORIUM } from "../stages/sanatorium/ghoul-sanatorium.js";
import { VILLAGE } from "../stages/village/ghoul-village.js";
import { MARROW } from "../stages/marrow/ghoul-marrow.js";
import { EYE } from "../stages/marrow/ghoul-marrow-eye.js";
import { HEART } from "../stages/marrow/ghoul-marrow-heart.js";
import { MAT } from "../rides/mat/ghoul-mat.js";
import { BONESTAIR } from "../rides/bonestair/ghoul-bonestair.js";
import { BONES } from "../stages/wing/ghoul-bones.js";
import { FLAP_CLEAR, POWERS, TIMED, powerHere } from "./ghoul-powers.js";
import { CEILING_Y, FIELD_H, FIELD_W, FINALE, FLOOR_Y, ROOMS, RUN_STAGES, SELECTABLE, STAGES, roomById, stageById } from "./ghoul-rooms.js";
import { steerPick } from "./ghoul-run.js";

export { FIELD_H, FIELD_W, FINALE, FLOOR_Y, ROOMS, RUN_STAGES, SELECTABLE, STAGES, roomById, stageById };
export { FLAP_CLEAR, POWERS, TIMED, powerHere };
export { MAX_HELD_DICE, MAX_LIVES } from "./ghoul-powers.js";
export { INTRO_MIN_MS } from "./ghoul-run.js";
export { releaseFire };
// The stage pick, which moved to ghoul-run.js.
export { steerPick };
export { CANDY_POINTS, CRYSTAL_POINTS, HOURGLASS_MS, POWER_POINTS } from "./ghoul-powers.js";
// The Lucky die's numbers, which the tests read from here.
export { ASK_GUARD_MS, DICE_FACES, LEAD_MS, MAX_DICE, START_DICE, ROLL_MS, SAVED_TIME_MS, TUMBLE_MS } from "./ghoul-dice.js";
// The bonus rounds' numbers (the Runaway Cart is the first), which the tests read from here.
export { BONUS_FLOOR, BONUS_HEARTS, BONUS_SAFE_MS, CARD_LOST_MS, CARD_MS, diceFor } from "./ghoul-bonus.js";
// Old Rattlebones' numbers, which the tests read from here.
export { BONES_KEEP, BONES_MS, BONES_RAGE_MS, BONES_WINDUP_MS, VOLLEY } from "../stages/wing/ghoul-bones.js";

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
export const EDGE = 1.2;

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
export const mudSpeed = (ms) => WATER_SPEED + (MUD_SPEED_MIN - WATER_SPEED) * Math.min(1, ms / MUD_MS);
export const mudJump = (ms) => WATER_JUMP + (MUD_JUMP_MIN - WATER_JUMP) * Math.min(1, ms / MUD_MS);
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
// The blaster at its quickest: a bolt every FIRE_MS (about 80% of the old 100 ms rate; a whole number of
// 4 ms slices, so the rate is exact); Rapid fire keeps about 1.65 times that.
export const FIRE_MS = 124;
export const RAPID_MS = 76;
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
const PACKS = Object.freeze([BONES, GRAVEYARD, GROUNDS, CHAPEL, SANATORIUM, VILLAGE, MINE, ARMS, CART, SLED, GURNEY, PEW, MOWER, WAGON, HEARSE, TRAY, CARNIVAL, FROZEN_LAKE, BOG, LANTERN, RIDE, MARROW, EYE, HEART, MAT, BONESTAIR, BANISTER]);
export const fromPacks = (key) => Object.assign({}, ...PACKS.map((pk) => pk[key] || {}));
export const listPacks = (key) => PACKS.flatMap((pk) => pk[key] || []);

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
export const BAT_STEER = 60;
export const BAT_TURN = 18;
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
export const BONE_VX = 42;
export const BONE_R = 0.8;
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
export const SPAWN_AHEAD = 4;
export const MAX_MONSTERS = 18;
export const HORDE_ROOM = 4;

// The bosses, in a room's last FIELD_W. The arena locks once you are
// BOSS_LOCK into it, and the boss wakes after BOSS_INTRO_MS. Its hp grows
// BOSS_DEPTH_HP for each step of depth (two a stage already cleared that run,
// up to BOSS_DEPTH_MAX steps); a stomp deals STOMP_DAMAGE, a shot one (two to
// Rattlebones' skull).
export const BOSSES = Object.freeze({
  gourd: Object.freeze({ name: "The Rotting Gourd", sub: "Watch its shadow, then run", w: 14, h: 12, hp: 65, points: 2000, color: "#d0631c" }),
  ...fromPacks("bosses"),
});
export const BOSS_LOCK = 10;
export const BOSS_INTRO_MS = 1000;
export const BOSS_DEPTH_HP = 0.12;
export const BOSS_DEPTH_MAX = 12;
// Each step of depth makes the monsters a little quicker and lets them out a
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
export const DROP_MS = 9000;
export const GARLIC_SAFE_MS = 1200;

// Points: a kill is its points times the chain (kills each within CHAIN_MS
// of the last, the multiplier capped at MAX_MULT), doubled for a headshot or
// a stomp. Candy is CANDY_POINTS, a power-up POWER_POINTS. Through a door,
// ROOM_POINTS times the room plus the time bonus left (BONUS_START, dropping
// BONUS_STEP a second) and FLAWLESS_POINTS with no life lost; a boss is its
// points, more the deeper into the run (see roomFor), and a life.
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
export const STACKERS = new Set(["zombie", "runner", "crawler", "seed", ...listPacks("stackers")]);
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
export const CLIMBERS = new Set(["zombie", "runner", "crawler", ...listPacks("climbers")]);
export const HEAVY = new Set(["glutton"]);
const FOUR_LEGGED = new Set(["hound", ...listPacks("fourLegged")]);
// A turned villager is a villager until the moon says otherwise, so it goes by
// `m.turned`, not kind.
export const bounds = (m) => FOUR_LEGGED.has(m.kind) || Boolean(m.turned);
// How far across a monster's leap clears, on the level.
export const hopReach = (m) => HOP_GAP * (bounds(m) ? BOUND_REACH : 1);
// Everything that walks the floor with walk(), and so can stand on a bridge.
export const WALKERS = new Set(["zombie", "runner", "glutton", "crawler", "seed", "spitter", "hound", "huntsman", ...listPacks("walkers"), ...listPacks("zombies")]);

// A life lost holds CRASH_MS, then puts you back at the room's start (in a
// boss room, the arena's) for READY_MS, safe for SAFE_MS. A door gone through
// holds CLEAR_MS.
export const START_LIVES = 7;
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
export const BANNER_SEE_THROUGH = 0.12;
export const BANNER_FADE_MS = 140;
export const BANNER_REACH = 8;

// The camera eases toward a spot CAM_LEAD ahead of the way you face.
export const CAM_EASE = 9;
export const CAM_AT = 0.32;
export const CAM_LEAD = 12;

export const chainMult = (chain) => Math.max(1, Math.min(MAX_MULT, chain));

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

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
  // A run is RUN_STAGES stages now: each counts for two of the old ones.
  const steps = d * 2;
  const candy = [];
  for (const [x0, y, count] of base.candy) for (let i = 0; i < count; i++) candy.push(Object.freeze({ x: x0 + i * 3, y }));
  const spec = Object.freeze({
    ...base,
    depth: d,
    base,
    name: base.title,
    pace: Math.min(1.4, 1 + DEPTH_PACE * steps),
    every: Math.max(0.55, DEPTH_EVERY ** steps),
    tough: Math.min(2, Math.floor(steps / 3)),
    // Doors in the wall let this many more out.
    extra: Math.min(2, Math.floor(steps / 2)),
    bossHp: base.boss ? Math.round(BOSSES[base.boss].hp * (1 + BOSS_DEPTH_HP * Math.min(steps, BOSS_DEPTH_MAX))) : 0,
    bossPoints: base.boss ? Math.round(BOSSES[base.boss].points * (1 + steps / 4)) : 0,
    candyAt: Object.freeze(candy),
    arena: base.boss ? base.length - FIELD_W : -1,
  });
  BUILT.set(k, spec);
  return spec;
}

// "Library (room 3)": room `n` of a run.
export const roomName = (spec, n) => `${spec.name} (room ${n})`;

export const PLATFORMS = fromPacks("platform");
// Your keys while the bell has frozen you: none.
export const FROZEN = Object.freeze({});
