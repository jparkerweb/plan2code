// Plan2Code Web Console - Ghoul Rush's window: the game's contract with the Activities page (create), its keys and pointer, what fx and sounds its events set off, each room's music (ROOM_MUSIC), and the view handed to the drawing.
//
// One of the parts of ghoul.js (see its header and the list of parts there).

import { armOnTop, pressFire as pressFireWith, releaseFire, resetTap } from "../arms/ghoul-arms.js";
import { GOLD, bonusTick, drawScene, lookOf, react, readColors } from "../draw/ghoul-draw.js";
import { isWaiting, startRide } from "../rides/dark-ride/ghoul-ride.js";
import { lanternHums } from "../rides/lantern/ghoul-lantern.js";
import { BONES_WINDUP_MS } from "../stages/wing/ghoul-bones.js";
import { beginStory, pressStory, releaseStory, takeStory } from "../story/ghoul-story.js";
import { ENDING_TRACK, pressEnding, releaseEnding, takeEnding } from "../story/ghoul-ending.js";
import { heartsText } from "./ghoul-bonus.js";
import { answerAsk, steerAsk } from "./ghoul-dice.js";
import { ARM_POP_MS, PILL_WORDS, POWERS, TIMED } from "./ghoul-powers.js";
import { CEILING_Y, FIELD_H, FIELD_W, FINALE, RUN_STAGES, SELECTABLE, roomById, stageById } from "./ghoul-rooms.js";
import { onCard, openSelect, steerPick } from "./ghoul-run.js";
import { DICE_KIT } from "./ghoul-fight.js";
import { POINTERS, ghostSight, solid } from "./ghoul-monsters.js";
import { groundAt, shelfThere } from "./ghoul-planny.js";
import { KIT } from "./ghoul-kit.js";
import { advance, bannerY, fire, newRound, pickStage, steerSelect, stomps, takeIntro, takeSelect, underBanner } from "./ghoul-play.js";
import { BANNER_FADE_MS, BANNER_SEE_THROUGH, BANNER_STRETCH, BOSSES, BOSS_INTRO_MS, CHAIN_MS, CHANDELIER_SHAKE_MS, CHANDELIER_W, CLEAR_MS, CRASH_MS, CRUMBLE_BACK_MS, DUCK_SHOT_Y, EMERGE_MS, GOURD_WAIT_MS, H, HEAT_FREE, HEAT_MAX, HEAT_SHOWN, HOUND_CROUCH_MS, HUD_H, JUMP_BUFFER_MS, MIN_CELL, MONSTERS, OFFER_N, PAD, PUDDLE_MS, PUDDLE_W, READY_MS, RISE_MS, SHOT_Y, SKEL_WINDUP_MS, SPIT_WINDUP_MS, TIME_WARN_MS, W, WAVE_H, WRAITH_WIND_MS, YOU_H, YOU_W, ZOMBIES, chainMult, roomFor, roomName } from "./ghoul-tables.js";

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
  if (most < RUN_STAGES) return `Best: ${most} of ${RUN_STAGES} stages. Then the House.`;
  if (most === RUN_STAGES) return "Best: every stage. The House still stands.";
  return "You have killed the House before. Can you do it again?";
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
export const ROOM_MUSIC = Object.freeze({ banister: "ghoulBanister", hall: "ghoulHall", darkride: "ghoulRideTheme", lychgate: "ghoulLychgate", graves: "ghoulGraves", mausoleums: "ghoulMausoleums", angel: "ghoulAngel", maze: "ghoulMaze", topiary: "ghoulTopiary", gazebo: "ghoulGazebo", yard: "ghoulYard", nave: "ghoulNave", tower: "ghoulTower", loft: "ghoulLoft", choir: "ghoulChoir", shaft: "ghoulShaft", tunnels: "ghoulTunnels", collapse: "ghoulCollapse", seam: "ghoulSeam", cart: "ghoulCart", midway: "ghoulMidway", mirrors: "ghoulMirrors", funhouse: "ghoulFunhouse", bigtop: "ghoulBigTop", admissions: "ghoulAdmissions", baths: "ghoulBaths", theater: "ghoulTheater", ward: "ghoulWard", street: "ghoulStreet", inn: "ghoulInn", square: "ghoulSquare", green: "ghoulGreen", foyer: "ghoulFoyer", gallery: "ghoulGallery", library: "ghoulLibrary", ballroom: "ghoulBallroom", kitchen: "ghoulKitchen", conservatory: "ghoulConservatory", attic: "ghoulAttic", crypt: "ghoulCrypt", huts: "ghoulHuts", lodge: "ghoulLodge", blackice: "ghoulBlackIce", sled: "ghoulSledRide", codeblue: "ghoulBlueRide", pew: "ghoulPewDirge", mower: "ghoulMowerRide", wagon: "ghoulWagonRide", hearse: "ghoulHearseRide", tray: "ghoulTrayRide", widow: "ghoulWidow", boardwalk: "ghoulBoardwalk", hollow: "ghoulHollow", stilts: "ghoulStilts", lantern: "ghoulLanternTheme", drowning: "ghoulDrowning", lawn: "ghoulMarrowLawn", mat: "ghoulMarrowMat", dollhouse: "ghoulMarrowRooms", bonestair: "ghoulMarrowStair", pit: "ghoulMarrowPit" });
// The House is killed three times over (Kill I on the lawn, II through every room, III in the Pit).
export const HOUSE_KILLS = 3;
const DREAD_ROOM = 0.7;
const DREAD_CLOCK = 0.2;
const DREAD_EASE_MS = 900;

// How full the music is right now, 0 to 1: the target the music eases toward.
export function dread(round) {
  // The Heart's HOLD FIRE opens the music all the way (the Pit's track turns major only at full dread).
  if (round.flood) return 1;
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
    // RUN_STAGES + 1 means the House has been beaten.
    most = Math.min(RUN_STAGES + 1, Math.max(0, memo ? Number(memo.get()) | 0 : 0));
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
    if (b) b.tag = `NEW RECORD: ${n} OF ${RUN_STAGES} STAGES`;
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
    // A room under the ground (its look's `noLightning`, the Pit) never flashes.
    if (fx.nextBolt <= 0 && lookOf(round.spec.id).noLightning) fx.nextBolt = BOLT_EVERY_MS;
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
    hud.stage = round.stage === FINALE.id ? `THE HOUSE: KILL ${houseKill()} OF ${HOUSE_KILLS}` : `STAGE ${round.cleared.length} OF ${RUN_STAGES}`;
    hud.bonus = round.bonus;
    hud.hearts = round.bonusRound ? heartsText(round.bonusRound) : "";
    hud.time = round.timeMs > 0 ? Math.ceil(round.timeMs / 1000) : 0;
    hud.timeLow = round.timeMs > 0 && round.timeMs <= TIME_WARN_MS;
    hud.chain = round.chain > 1 ? chainMult(round.chain) : 0;
    hud.chainFill = round.chainMs / CHAIN_MS;
    // "have" once found, "need" until then; a room with no key (a boss, a bonus ride) shows nothing.
    hud.key = round.spec.key && !round.spec.boss && !round.spec.bonus ? (round.hasKey ? "have" : "need") : "";
    // The Drowned Lantern has no blaster (SPACE flares the lantern, its oil drawn by the room's own art): no gauge.
    hud.gauge = round.runner && round.runner.id === "lantern" ? null : gauge;
    // The weapon that comes out next, its count, and how many other kinds wait under it.
    const top = armOnTop(round);
    hud.arm = top ? { kind: top.kind, n: top.n, more: round.arms.length - 1, text: `x${top.n}${round.arms.length > 1 ? ` +${round.arms.length - 1}` : ""}${round.armUsed ? "" : " TAP TAP"}`, color: POWERS[top.kind].color, fresh: !round.armUsed, pop: (round.armPopMs || 0) / ARM_POP_MS } : null;
    return hud;
  };

  // In the finale, which of the House's three kills is under way: the boss rooms up to this one (at least the first).
  const houseKill = () => Math.max(1, FINALE.rooms.slice(0, round.stageAt + 1).filter((id) => roomById(id)?.boss).length);

  // The view ghoul-draw.js draws from: one object, refilled each frame.
  const view = { g: Object.freeze({ W, H, HUD_H, PAD, FIELD_W, FIELD_H, YOU_W, YOU_H, CRASH_MS, CRUMBLE_BACK_MS, RISE_MS, SKEL_WINDUP_MS, BONES_WINDUP_MS, WAVE_H, CHANDELIER_W, CHANDELIER_SHAKE_MS, SHOT_Y, DUCK_SHOT_Y, GOURD_WAIT_MS, EMERGE_MS, PUDDLE_W, PUDDLE_MS, HOUND_CROUCH_MS, WRAITH_WIND_MS, SPIT_WINDUP_MS, CEILING_Y, ZOMBIES }), powers: POWERS, monsters: MONSTERS, bosses: BOSSES, groundAt, shelfThere, solid, ghostSight, roomFor, roomById, stages: SELECTABLE, runStages: RUN_STAGES, stageById, OFFER_N };
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
    // The kill under way in the finale (the boss bar's skull pips), null elsewhere.
    view.houseKill = round.stage === FINALE.id ? houseKill() : null;
    // A dot per stage along the start and end screens: those cleared this
    // run in their colors (or, before one, as many as the record, in gold).
    view.dots = Array.from({ length: RUN_STAGES }, (_, i) => (state === "ready" ? (i < most ? GOLD : null) : round.cleared[i] || null));
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
    const record = most > RUN_STAGES ? "You have killed the House" : `Best: ${most} of ${RUN_STAGES} stages`;
    if (state === "ready") view.tally = [`Run. Shoot. Clear ${RUN_STAGES} stages, then kill the house`, `Arrows run, up jumps, hold space to fire, tap it twice to throw what you find. ${record}`];
    else if (state === "over") {
      const st = round.stats;
      view.big = String(round.score);
      const how = `${st.kills} ghouls (${st.headshots} headshots, ${st.stomps} stomps), best chain x${chainMult(st.bestChain)}, ${st.candy} souls.`;
      if (round.won) view.tally = [`You escaped! Marrow starves${beaten ? ". A new best!" : ""}`, how];
      else view.tally = [`Cleared ${round.cleared.length} of ${RUN_STAGES} stages, out in ${roomName(round.spec, round.room)}${further ? ". A new record!" : ""}${beaten ? " A new best!" : ""}`, `${how} ${round.practice ? "A practice run: nothing kept." : teaser(most)}`];
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
    releaseEnding(round);
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
    // The ending plays its own track, if it has one.
    if (round.phase === "ending") {
      if (ENDING_TRACK) music(ENDING_TRACK, 0.7);
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
    // The Drowned Lantern's own: the Lurker near, Mother awake.
    for (const [id, name, level, pitch] of lanternHums(round)) hum(id, name, level, pitch);
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
      if (round.phase === "ending") return type === "down" ? takeEnding(round) || true : true;
      // Use a Lucky die? A click lights its half (Yes on the left, No on the right); a click on the lit half answers.
      if (round.phase === "ask") {
        if (type === "down") {
          const yes = fx < FIELD_W / 2;
          if (round.ask.yes === yes) answerAsk(round, yes, DICE_KIT);
          else steerAsk(round, yes);
        }
        return true;
      }
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
        } else if (state === "running" && round.phase === "ask") {
          if (!repeat) answerAsk(round, round.ask.yes, DICE_KIT);
        } else if (state === "running" && round.phase === "pick") {
          if (!repeat) pickStage(round);
        } else if (state === "running" && onCard(round)) {
          if (!repeat) takeIntro(round);
        } else if (state === "running" && round.phase === "story") {
          pressStory(round, repeat);
        } else if (state === "running" && round.phase === "ending") {
          pressEnding(round, repeat);
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
      // Use a Lucky die? Left and up light Yes, right and down No; the action key answers.
      if (round.phase === "ask") {
        steerAsk(round, name === "left" || name === "up");
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
      // The ending: the same, a fresh move key turns its page.
      if (round.phase === "ending") {
        if (!repeat) takeEnding(round);
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
        releaseEnding(round);
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
