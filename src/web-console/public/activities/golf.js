// Plan2Code Web Console - Mini golf, the second activity: six eighteen-hole courses seen from above, rules, physics and the game contract.
//
// The Activities window (screens/activities.js) drives everything, as it does
// for Snake: it ticks the game, hands it keys, key releases and pointer
// events, and pauses it. Play is arcade quick: the aim follows the pointer
// (or held arrows), one press starts the power meter and a second sets the
// power, and a shot clock starts the meter for a player who dawdles. The
// rules are plain functions over a round object (newRound, startSwing,
// setPower, strike, advance and helpers), exported so the unit suite can play
// exact shots without a canvas. Physics runs on a fixed sub-step and never reads the
// clock or Math.random(), so the same shot always rolls the same way. The
// courses are data (golf-holes.js lists them); the drawing lives in
// golf-draw.js, its scenery in golf-decor.js and each newer course's look in
// golf-looks.js. A round is played on one course, picked on the window's
// course dashboard (the module's `courses`), and its best is kept per course.

import { COURSE_W, COURSE_H, COURSES, FRONT_NINE, HOLE_COUNT, courseById } from "./golf-holes.js";
import { drawCourse, readColors } from "./golf-draw.js";

export { COURSE_W, COURSE_H, COURSES, FRONT_NINE, HOLE_COUNT, courseById };

// One physics step, in ms. tick() runs as many as the elapsed time holds and
// carries the rest to the next tick.
export const SUB_STEP_MS = 4;

// The most time one tick() plays, matching the window's own frame cap.
export const MAX_TICK_MS = 250;

export const BALL_R = 4;
export const CUP_R = 7;
export const TUNNEL_R = 9;
export const POWERUP_R = 9;

// The fastest a ball ever moves, in units a second. At SUB_STEP_MS it covers
// 2.4 units a step, under BALL_R, so no step can carry it through a wall. A
// cannon shot may go faster, still under BALL_R a step.
export const MAX_SPEED = 600;
export const CANNON_MAX = 900;

// A full-power putt's speed, in units a second. A MAX putt (MAX_BOOST) comes
// to 598, just under MAX_SPEED.
export const STRIKE_SPEED = 520;

// Rolling: a steady slowing plus a share of the speed, both multiplied in sand.
const FRICTION = 40;
const DRAG = 1.2;
export const SAND_FACTOR = 4;
// On ice the ball slows only this share as much.
export const ICE_FACTOR = 0.15;

// Under this speed, off any slope, the ball has stopped. High enough to cut
// the slow creep at the end of a roll.
const STOP_SPEED = 8;

// Over the cup under this speed, the ball drops; faster, it rolls over.
export const CAPTURE_SPEED = 130;

// The share of its speed into a wall the ball keeps coming off it.
const WALL_KEEP = 0.7;

// The speed a bumper adds on top of a full bounce.
const BUMPER_KICK = 60;

// A hit into a wall this fast or more gets the wall tone.
const FIRM_HIT = 60;

export const MAX_STROKES = 8;

// How long the scorecard waits between holes before moving on by itself.
export const CARD_MS = 1500;

// The power-ups: a pad the rolling ball runs over is held for the next putt,
// and that putt alone gets its help. One is held at a time; a new pad
// replaces the one held. A held power-up carries over to the next hole.
export const POWERUPS = Object.freeze({
  doubloon: Object.freeze({ name: "Lucky Doubloon", blurb: "the next putt is free" }),
  cannon: Object.freeze({ name: "Cannonball", blurb: "the next putt fires 1.6x as hard" }),
  ghost: Object.freeze({ name: "Ghost Ball", blurb: "the next putt floats over water, sand and bumpers" }),
  magnet: Object.freeze({ name: "Parrot Magnet", blurb: "the next putt homes in on the cup" }),
  bouncy: Object.freeze({ name: "Rubber Duck", blurb: "the next putt bounces off walls at full speed" }),
  bigcup: Object.freeze({ name: "Treasure Map", blurb: "the next putt aims at a HUGE cup" }),
  spyglass: Object.freeze({ name: "Spyglass", blurb: "see where the next putt will roll" }),
});

export const CANNON_BOOST = 1.6;
export const BIG_CUP = 2.4;
// The magnet turns the ball toward the cup inside this reach, by up to this
// many radians a second, never adding speed, so a ball under it still stops.
export const MAGNET_R = 110;
const MAGNET_TURN = 7;
// The magnet and the big cup let a faster ball drop.
const HELPED_CAPTURE = 1.7;

// How far ahead the spyglass looks, in ms of rolling.
const PREDICT_MS = 3000;

// The swing. A press starts the power meter and a second sets the power. The
// needle runs from empty to past full and back once every METER_MS, slow at
// the bottom and fast at the top (METER_CURVE), so a soft putt is easy to
// catch and a full one is not. The MAX band, just under full, putts
// MAX_BOOST as hard. Past full is the overswing: OVER_POWER, pulled off line
// by up to OVER_PULL, the more the deeper into it.
export const METER_MS = 1750;
const METER_CURVE = 1.6;
export const MAX_BAND = 0.12;
export const MAX_BOOST = 1.15;
export const OVER_BAND = 0.1;
export const OVER_POWER = 0.7;
const OVER_PULL = (14 * Math.PI) / 180;
// The softest putt a press can set.
const MIN_POWER = 0.03;

// The shot clock: a ball this long at rest starts the meter by itself, and a
// meter left running METER_TRIPS trips dribbles the ball off at DRIBBLE_POWER.
export const SHOT_CLOCK_MS = 6000;
export const METER_TRIPS = 3;
const DRIBBLE_POWER = 0.06;

// Holding the action key or the pointer down while the ball rolls plays the
// roll this many times as fast.
export const FAST_FORWARD = 3;

// Keyboard aiming: a press nudges the aim by AIM_NUDGE, and held, it turns
// from TURN_SLOW up to TURN_FAST radians a second over TURN_RAMP_MS.
const AIM_NUDGE = Math.PI / 180;
// How far, in CSS pixels, the pointer must move before the aim the cup set
// follows it again, so a hand that shakes on a click does not swing it.
const AIM_WAKE_PX = 6;
const TURN_SLOW = (35 * Math.PI) / 180;
const TURN_FAST = (220 * Math.PI) / 180;
const TURN_RAMP_MS = 700;

// Below this many CSS pixels the course is too small to play.
export const MIN_W = 320;
export const MIN_H = 240;

// How many recent positions the rolling ball's trail keeps.
const TRAIL = 12;

// How long a popped-up word stays on the board, in ms of the round's clock.
const TOAST_MS = 1300;

/* --------------------------------------------------------------- geometry */

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

export function inPolygon(points, x, y) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// The point on segment a-b closest to p.
function closest(x1, y1, x2, y2, px, py) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len)) : 0;
  return { x: x1 + t * dx, y: y1 + t * dy };
}

// A spinner's bar as a segment at the round's clock.
export function spinnerEnds(s, clockMs) {
  const a = s.speed * (clockMs / 1000);
  const cx = Math.cos(a) * s.arm;
  const cy = Math.sin(a) * s.arm;
  return { x1: s.x - cx, y1: s.y - cy, x2: s.x + cx, y2: s.y + cy };
}

// A mover's center and velocity at the round's clock: a smooth swing either
// side of where it rests.
export function moverAt(m, clockMs) {
  const turn = (2 * Math.PI) / m.period;
  const a = turn * clockMs + 2 * Math.PI * (m.phase || 0);
  const s = Math.sin(a);
  const c = Math.cos(a) * turn * 1000;
  return { x: m.x + m.dx * s, y: m.y + m.dy * s, vx: m.dx * c, vy: m.dy * c, r: m.r };
}

// How far through its period a gate is, 0 to 1, and whether it is shut.
export const gatePhase = (g, clockMs) => (((clockMs / g.period + (g.offset || 0)) % 1) + 1) % 1;
export const gateShut = (g, clockMs) => gatePhase(g, clockMs) >= g.open;

export const onSlope = (hole, x, y) => hole.slopes.some((s) => inPolygon(s.points, x, y));
// Where a well moves a resting ball: inside its reach, off its very center
// (where it pulls no way at all), and where its pull, fading toward the edge,
// still beats the rolling friction. Out in the faint rim a ball may stop.
export const inWell = (hole, x, y) => hole.wells.some((w) => {
  const d = dist(x, y, w.x, w.y);
  return d < w.r && d > 0.5 && Math.abs(w.pull) * (1 - d / w.r) > FRICTION;
});
// Somewhere a ball cannot rest: a slope or a well moves it.
export const onPush = (hole, x, y) => onSlope(hole, x, y) || inWell(hole, x, y);
export const inSand = (hole, x, y) => hole.sand.some((p) => inPolygon(p, x, y));
export const onIce = (hole, x, y) => hole.ice.some((p) => inPolygon(p, x, y));
export const onBridge = (hole, x, y) => hole.bridges.some((r) => inRect(r, x, y));
export const inWater = (hole, x, y) => hole.water.some((p) => inPolygon(p, x, y)) && !onBridge(hole, x, y);

/* ------------------------------------------------------------------ rules */

// The holes of the course the round is played on.
export const holesOf = (round) => courseById(round.course).holes;

const parTotal = (round, upTo) => holesOf(round).slice(0, upTo).reduce((n, h) => n + h.par, 0);

// A course's par for all eighteen.
export const coursePar = (c) => c.holes.reduce((n, h) => n + h.par, 0);

// The ball at rest, waiting for a putt: the shot clock starts again and the
// aim turns back toward the cup, so a straight putt needs no aiming at all.
// It stays on the cup until the pointer really moves (`aimHeld`).
function atRest(round) {
  const hole = holesOf(round)[round.hole];
  round.phase = "aim";
  round.restMs = 0;
  round.aimAngle = Math.atan2(hole.cup.y - round.ball.y, hole.cup.x - round.ball.x);
  round.aimHeld = true;
}

function placeOnTee(round) {
  const hole = holesOf(round)[round.hole];
  round.ball = { x: hole.tee.x, y: hole.tee.y, vx: 0, vy: 0, moving: false };
  round.from = { x: hole.tee.x, y: hole.tee.y };
  round.strokes = 0;
  round.putts = 0;
  round.tunnelLock = null;
  round.trail = [];
  round.active = null;
  round.taken = [];
  round.holeStart = round.clock;
  atRest(round);
}

// Hole 1 of the course `courseId` (the first course when none is given),
// the ball on its tee, nothing scored. `phase` is "aim" (the ball at
// rest, waiting for a putt), "swing" (the power meter running), "rolling",
// "card" (the scorecard between holes) or "done" (the round is over).
// `restMs` is how long the ball has waited (the shot clock), `swingMs` how
// long the meter has run, `swingAngle` the aim it locked, and `lastSwing`
// where the needle stopped last time. `held` is the power-up waiting for the
// next putt, `active` the one helping the putt in play, and `taken` the pads
// this hole has used up.
export function newRound(courseId = COURSES[0].id) {
  const round = {
    course: courseById(courseId).id,
    hole: 0,
    card: [],
    clock: 0,
    cardMs: 0,
    sunk: null,
    swingMs: 0,
    swingAngle: 0,
    lastSwing: null,
    held: null,
  };
  placeOnTee(round);
  return round;
}

// Every finished hole's strokes plus the hole in play.
export const total = (round) => round.card.reduce((n, s) => n + s, 0) + (round.phase === "card" || round.phase === "done" ? 0 : round.strokes);

// Against par for the holes played so far, the one in play counted once it is
// finished: negative is under par.
export const toPar = (round) => round.card.reduce((n, s) => n + s, 0) - parTotal(round, round.card.length);

// Putts from where the ball rests: power 0 to MAX_BOOST of STRIKE_SPEED, at
// an angle in radians (0 is along +x). A held power-up goes into this putt.
// Returns whether a putt was taken (a Lucky Doubloon putt is taken but not
// counted).
export function strike(round, angle, power) {
  if ((round.phase !== "aim" && round.phase !== "swing") || round.ball.moving || !(power > 0)) return false;
  round.active = round.held;
  round.held = null;
  const boost = round.active === "cannon" ? CANNON_BOOST : 1;
  const speed = STRIKE_SPEED * Math.min(MAX_BOOST, power) * boost;
  const ball = round.ball;
  round.from = { x: ball.x, y: ball.y };
  ball.vx = Math.cos(angle) * speed;
  ball.vy = Math.sin(angle) * speed;
  ball.moving = true;
  round.putts += 1;
  if (round.active !== "doubloon") round.strokes += 1;
  round.phase = "rolling";
  round.trail = [];
  return true;
}

// The needle `ms` into a swing: from 0 (empty) up to 1 + OVER_BAND (the top
// of the overswing) and back, once every METER_MS.
export function meterAt(ms) {
  const t = ((ms % METER_MS) + METER_MS) % METER_MS / METER_MS;
  const u = t < 0.5 ? t * 2 : 2 - t * 2;
  return (1 + OVER_BAND) * u ** METER_CURVE;
}

export const meterZone = (pos) => (pos > 1 ? "over" : pos >= 1 - MAX_BAND ? "max" : "normal");

// What a press at needle `pos` puts on a ball aimed at `angle`: { zone,
// angle, power }. An overswing pulls left and right on alternate putts (`n`),
// so the same swing always goes the same way.
export function swingShot(pos, angle, n) {
  const zone = meterZone(pos);
  if (zone === "max") return { zone, angle, power: MAX_BOOST };
  if (zone === "over") {
    const depth = Math.min(1, (pos - 1) / OVER_BAND);
    return { zone, angle: angle + (n % 2 ? 1 : -1) * (0.4 + 0.6 * depth) * OVER_PULL, power: OVER_POWER };
  }
  return { zone, angle, power: Math.max(MIN_POWER, pos) };
}

// Starts the power meter on a ball at rest, the aim locked where it points.
export function startSwing(round) {
  if (round.phase !== "aim" || round.ball.moving) return false;
  round.phase = "swing";
  round.swingMs = 0;
  round.swingAngle = round.aimAngle;
  return true;
}

// Sets the power where the needle is and putts. Returns the shot swingShot()
// made of it, or null when no meter was running.
export function setPower(round) {
  if (round.phase !== "swing") return null;
  const pos = meterAt(round.swingMs);
  const shot = swingShot(pos, round.swingAngle, round.putts);
  if (!strike(round, shot.angle, shot.power)) return null;
  round.lastSwing = pos;
  return shot;
}

// The scorecard for a finished hole, or the end of the round after the last.
// A water penalty on the last stroke can take the count past the cap, so the
// hole in play is capped too, not only its card entry. A hole always scores
// at least 1, however many doubloons went into it.
function finishHole(round, strokes, events) {
  round.strokes = Math.max(1, Math.min(round.strokes, MAX_STROKES));
  round.card.push(Math.max(1, Math.min(strokes, MAX_STROKES)));
  round.ball.vx = 0;
  round.ball.vy = 0;
  round.ball.moving = false;
  round.active = null;
  round.cardMs = 0;
  round.phase = round.hole === holesOf(round).length - 1 ? "done" : "card";
  if (round.phase === "done") events.push("done");
}

// Leaves the scorecard for the next hole's tee.
export function nextHole(round) {
  if (round.phase !== "card") return false;
  round.hole += 1;
  round.sunk = null;
  placeOnTee(round);
  return true;
}

// The ball off a fixed segment or a moving bar: pushed clear, and bounced
// with `keep` of its speed into the surface. `sx`, `sy` is how fast the
// surface itself moves at the contact (a spinner), 0 for a wall.
function bounceOffSegment(ball, seg, events, keep = WALL_KEEP, sx = 0, sy = 0) {
  const p = closest(seg.x1, seg.y1, seg.x2, seg.y2, ball.x, ball.y);
  let nx = ball.x - p.x;
  let ny = ball.y - p.y;
  let d = Math.hypot(nx, ny);
  if (d >= BALL_R) return false;
  if (d === 0) {
    // Dead on the line: back out the way it came, or, at rest, square off it.
    const v = Math.hypot(ball.vx, ball.vy);
    const len = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1) || 1;
    nx = v ? -ball.vx / v : -(seg.y2 - seg.y1) / len;
    ny = v ? -ball.vy / v : (seg.x2 - seg.x1) / len;
    d = 1;
  } else {
    nx /= d;
    ny /= d;
  }
  ball.x = p.x + nx * BALL_R;
  ball.y = p.y + ny * BALL_R;
  const into = (ball.vx - sx) * nx + (ball.vy - sy) * ny;
  if (into < 0) {
    ball.vx -= (1 + keep) * into * nx;
    ball.vy -= (1 + keep) * into * ny;
    if (-into >= FIRM_HIT) events.push("wall");
  }
  return true;
}

// A ball off a round bumper, standing or moving at (bvx, bvy): a full bounce
// plus a kick.
function bounceOffRound(ball, b, events, bvx = 0, bvy = 0) {
  let nx = ball.x - b.x;
  let ny = ball.y - b.y;
  const d = Math.hypot(nx, ny);
  if (d >= b.r + BALL_R || d === 0) return false;
  nx /= d;
  ny /= d;
  ball.x = b.x + nx * (b.r + BALL_R);
  ball.y = b.y + ny * (b.r + BALL_R);
  const into = (ball.vx - bvx) * nx + (ball.vy - bvy) * ny;
  if (into < 0) {
    ball.vx -= 2 * into * nx;
    ball.vy -= 2 * into * ny;
  }
  ball.vx += nx * BUMPER_KICK;
  ball.vy += ny * BUMPER_KICK;
  events.push("bump");
  return true;
}

// Sets a resting ball that something knocked off rolling.
function knocked(round) {
  const ball = round.ball;
  if (!ball.moving && Math.hypot(ball.vx, ball.vy) >= STOP_SPEED) {
    ball.moving = true;
    round.phase = "rolling";
  }
}

// What moves by itself sweeps a resting ball too, so this runs on every step:
// spinners' bars, movers and shut gates. A ghost ball slips through movers.
function sweepers(round, hole, events) {
  const ball = round.ball;
  for (const s of hole.spinners) {
    const seg = spinnerEnds(s, round.clock);
    const p = closest(seg.x1, seg.y1, seg.x2, seg.y2, ball.x, ball.y);
    // The bar's own speed where it touches: the turn rate times the distance
    // from the center, at right angles to it.
    const sx = -s.speed * (p.y - s.y);
    const sy = s.speed * (p.x - s.x);
    if (bounceOffSegment(ball, seg, events, WALL_KEEP, sx, sy)) knocked(round);
  }
  if (round.active !== "ghost") {
    for (const m of hole.movers) {
      const at = moverAt(m, round.clock);
      if (bounceOffRound(ball, at, events, at.vx, at.vy)) knocked(round);
    }
  }
  for (const g of hole.gates) {
    if (gateShut(g, round.clock)) bounceOffSegment(ball, g, events, wallKeep(round));
  }
}

const wallKeep = (round) => (round.active === "bouncy" ? 1 : WALL_KEEP);

function tunnels(round, hole, events) {
  const ball = round.ball;
  if (round.tunnelLock) {
    // Out of the mouth it came from before it can go in again.
    if (dist(ball.x, ball.y, round.tunnelLock.x, round.tunnelLock.y) < TUNNEL_R) return;
    round.tunnelLock = null;
  }
  for (const t of hole.tunnels) {
    for (const [from, to] of [[t.a, t.b], [t.b, t.a]]) {
      if (dist(ball.x, ball.y, from.x, from.y) < TUNNEL_R) {
        ball.x = to.x;
        ball.y = to.y;
        round.tunnelLock = to;
        round.trail = [];
        events.push("tunnel");
        return;
      }
    }
  }
}

// A pad the ball runs over is used up for the hole and held for the next putt.
function powerups(round, hole, events) {
  const ball = round.ball;
  hole.powerups.forEach((p, i) => {
    if (round.taken.includes(i) || dist(ball.x, ball.y, p.x, p.y) >= POWERUP_R) return;
    round.taken.push(i);
    round.held = p.kind;
    events.push("powerup");
  });
}

// The magnet bends the ball's path toward the cup without speeding it up.
function magnet(round, hole, dt) {
  const ball = round.ball;
  const speed = Math.hypot(ball.vx, ball.vy);
  const dx = hole.cup.x - ball.x;
  const dy = hole.cup.y - ball.y;
  const d = Math.hypot(dx, dy);
  if (!speed || !d || d > MAGNET_R) return;
  const pull = MAGNET_TURN * dt * (1 - d / MAGNET_R) * speed;
  const vx = ball.vx + (dx / d) * pull;
  const vy = ball.vy + (dy / d) * pull;
  const v = Math.hypot(vx, vy) || 1;
  ball.vx = (vx / v) * speed;
  ball.vy = (vy / v) * speed;
}

// The hole is over at MAX_STROKES without the ball in the cup: picked up.
function pickUpAtCap(round, events) {
  if (round.strokes < MAX_STROKES) return;
  events.push("pickup");
  finishHole(round, MAX_STROKES, events);
}

// How wide the cup is, and how slow a ball must be to drop, for this putt.
export const cupReach = (round) => CUP_R * (round.active === "bigcup" ? BIG_CUP : 1);
const captureSpeed = (round) => CAPTURE_SPEED * (round.active === "bigcup" || round.active === "magnet" ? HELPED_CAPTURE : 1);

// What wells do to the ball this step: each pulls it toward its center (or
// pushes it away), harder the nearer it is.
function wells(hole, ball, dt) {
  for (const w of hole.wells) {
    const dx = w.x - ball.x;
    const dy = w.y - ball.y;
    const d = Math.hypot(dx, dy);
    if (d >= w.r || d <= 0.5) continue;
    const a = w.pull * (1 - d / w.r) * dt;
    ball.vx += (dx / d) * a;
    ball.vy += (dy / d) * a;
  }
}

// One physics step of `dtMs` (SUB_STEP_MS from tick()). Returns what happened,
// as event names: "clock" (the shot clock started the meter), "dribble" (the
// meter ran out), "wall", "bump", "tunnel", "powerup", "splash", "cup",
// "ace", "stop", "pickup", "done", "hole".
export function advance(round, dtMs) {
  const events = [];
  if (round.phase === "done") return events;
  round.clock += dtMs;
  if (round.phase === "card") {
    round.cardMs += dtMs;
    if (round.cardMs >= CARD_MS && nextHole(round)) events.push("hole");
    return events;
  }
  const hole = holesOf(round)[round.hole];
  const ball = round.ball;
  const dt = dtMs / 1000;
  const ghost = round.active === "ghost";

  sweepers(round, hole, events);
  if (!ball.moving) {
    if (round.phase === "aim") {
      round.restMs += dtMs;
      if (round.restMs >= SHOT_CLOCK_MS && startSwing(round)) events.push("clock");
    } else if (round.phase === "swing") {
      round.swingMs += dtMs;
      if (round.swingMs >= METER_TRIPS * METER_MS) {
        strike(round, round.swingAngle, DRIBBLE_POWER);
        events.push("dribble");
        return events;
      }
    }
    // A ball left on a slope or in a well rolls off by itself.
    if (!onPush(hole, ball.x, ball.y)) return events;
    ball.moving = true;
    round.phase = "rolling";
  }

  for (const s of hole.slopes) {
    if (inPolygon(s.points, ball.x, ball.y)) {
      ball.vx += s.push.x * dt;
      ball.vy += s.push.y * dt;
    }
  }
  wells(hole, ball, dt);
  let speed = Math.hypot(ball.vx, ball.vy);
  const top = round.active === "cannon" ? CANNON_MAX : MAX_SPEED;
  if (speed > 0) {
    const ground = !ghost && inSand(hole, ball.x, ball.y) ? SAND_FACTOR : onIce(hole, ball.x, ball.y) ? ICE_FACTOR : 1;
    const slow = (FRICTION + DRAG * speed) * ground * dt;
    const next = Math.min(top, Math.max(0, speed - slow));
    ball.vx *= next / speed;
    ball.vy *= next / speed;
    speed = next;
  }
  if (round.active === "magnet") magnet(round, hole, dt);
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  for (const w of hole.walls) bounceOffSegment(ball, w, events, wallKeep(round));
  if (!ghost) for (const b of hole.bumpers) bounceOffRound(ball, b, events);
  sweepers(round, hole, events);
  speed = Math.hypot(ball.vx, ball.vy);
  if (speed > top) {
    ball.vx *= top / speed;
    ball.vy *= top / speed;
    speed = top;
  }
  tunnels(round, hole, events);
  powerups(round, hole, events);

  round.trail.push({ x: ball.x, y: ball.y });
  if (round.trail.length > TRAIL) round.trail.shift();

  if (dist(ball.x, ball.y, hole.cup.x, hole.cup.y) < cupReach(round) && speed < captureSpeed(round)) {
    events.push(round.putts === 1 ? "ace" : "cup");
    round.sunk = { x: ball.x, y: ball.y };
    ball.x = hole.cup.x;
    ball.y = hole.cup.y;
    finishHole(round, round.strokes, events);
    return events;
  }

  const stopping = speed < STOP_SPEED && !onPush(hole, ball.x, ball.y);
  // A ghost ball floats over water, but not once it runs out of puff there.
  if (inWater(hole, ball.x, ball.y) && (!ghost || stopping)) {
    events.push("splash");
    round.strokes += 1;
    ball.x = round.from.x;
    ball.y = round.from.y;
    ball.vx = 0;
    ball.vy = 0;
    ball.moving = false;
    atRest(round);
    round.active = null;
    round.tunnelLock = null;
    round.trail = [];
    pickUpAtCap(round, events);
    return events;
  }

  if (stopping) {
    ball.vx = 0;
    ball.vy = 0;
    ball.moving = false;
    atRest(round);
    round.active = null;
    events.push("stop");
    pickUpAtCap(round, events);
  }
  return events;
}

// Where a putt at `angle` and `power` would roll from the ball as it rests
// now, as points along its path (null where a tunnel jumps it), for the
// spyglass. Plays a copy of the round, so the round itself never changes.
export function predictPath(round, angle, power) {
  const sim = structuredClone(round);
  // The spyglass itself goes into the putt and does nothing to the roll.
  if (sim.held === "spyglass") sim.held = null;
  if (!strike(sim, angle, power)) return [];
  const points = [{ x: sim.ball.x, y: sim.ball.y }];
  for (let t = 0, n = 0; t < PREDICT_MS && sim.phase === "rolling"; t += SUB_STEP_MS, n++) {
    const events = advance(sim, SUB_STEP_MS);
    if (events.includes("splash")) break;
    if (events.includes("tunnel")) points.push(null);
    if (n % 5 === 0 || sim.phase !== "rolling") points.push({ x: sim.ball.x, y: sim.ball.y });
  }
  return points;
}

/* ------------------------------------------------------------------ gags */

// The words that pop up on the board, picked by a count so the same round
// always says the same things. A course's own words are its `voice`
// (golf-kit.js): { label, splash: { <liquid>: [...] }, splashTone?, bump,
// ace, turn, done, quips }; these are the ones every course shares.
const TUNNEL_WORDS = ["Whoosh!", "Wheee!", "Where'd it go?!"];
const MAX_WORDS = ["MAX POWER!", "CRUSHED IT!", "KA-BLAM!"];
const SHANK_WORDS = ["Overswing! Shanked it", "Whoa, too hard!", "Wild swing!"];
const DRIBBLE_WORDS = ["Too slow! Dribbled it", "Asleep at the tiller!", "Zzz... plop"];

const pick = (list, n) => list[n % list.length];

/* --------------------------------------------------------------- contract */

const TONE_FOR = Object.freeze({ wall: "wall", bump: "bump", cup: "cup", ace: "ace", tunnel: "tunnel", powerup: "power" });
// The tone a splash makes, by liquid, unless the course's voice names one.
const SPLASH_TONE = Object.freeze({ sea: "splash", pool: "splash", lava: "sizzle", chasm: "fall" });

// The first splash line of any list, for a liquid a voice forgot.
const firstSplash = (voice) => Object.values(voice.splash)[0] || ["Splash!"];

/* ----------------------------------------------------------------- sounds

   Sound only follows the round; nothing here changes it. Every event keeps
   its old blip (the suites listen for them) and gets a richer layer beside
   it from golf-sfx.js or the shared kit, picked by what the ball met. */

// What lands with a splash, by liquid, played over SPLASH_TONE's blip.
const SPLASH_LAYER = Object.freeze({ sea: "splashBig", pool: "splashBig", swamp: "splashBig", icewater: "splashBig", soda: "golfFizz", chocolate: "golfGloop", tar: "golfGloop", lava: "hiss", plasma: "hiss", chasm: "golfFallFar", void: "golfFallFar", crevasse: "golfFallFar" });

// What a bumper sounds like, by its look: wood, rubber, metal or stone.
const BUMPER_SOUND = Object.freeze({
  barrel: "golfBarrel", chest: "golfBarrel", nest: "golfBarrel",
  coin: "golfChime", crystal: "golfChime", ornament: "golfChime", star: "golfChime", amber: "golfChime", pole: "golfChime", lollipop: "golfChime",
  cannonball: "golfClack", rock: "golfClack", skull: "golfClack", boulder: "golfClack", asteroid: "golfClack", iceblock: "golfClack",
});

// What a mover says when it hits the ball, by its look.
const MOVER_SOUND = Object.freeze({
  shark: "golfChomp", crab: "golfPinch", trex: "golfRoar", raptor: "golfRoar", yeti: "golfRoar", penguin: "golfQuack",
  bat: "squeak", spider: "squish", cart: "clank", ufo: "laser", fireball: "hiss", meteor: "hiss",
  barrel: "golfBarrel", cannonball: "thud", boulder: "thud", sled: "thud", trike: "thud",
});

// The movers that hum as they go (pitch, so a cart's clatter runs fast).
const MOVER_HUM = Object.freeze({
  cart: { name: "train", pitch: 1.6 }, ufo: { name: "golfUfo", pitch: 1 }, fireball: { name: "golfFireball", pitch: 1 }, meteor: { name: "golfFireball", pitch: 0.8 },
  barrel: { name: "golfRoll", pitch: 0.6 }, boulder: { name: "golfRoll", pitch: 0.5 }, cannonball: { name: "golfRoll", pitch: 0.7 }, sled: { name: "golfIceGlide", pitch: 0.8 },
});

// A gate slamming shut, by its look.
const GATE_SOUND = Object.freeze({ crusher: "golfGateSlam", neck: "golfGateSlam", fire: "golfFlame", airlock: "golfAirlock", shield: "golfShieldGate", icicles: "golfIcicle", waffle: "knock" });

// A rail, by the ground it runs around.
const RAIL_SOUND = Object.freeze({ deck: "knock", waffle: "knock", stone: "golfClack", rock: "golfClack", crater: "golfClack", moss: "golfClack" });

// A power-up taken, over the old `power` blip.
const POWERUP_SOUND = Object.freeze({ doubloon: "coinUp", cannon: "clank", ghost: "wail", magnet: "shieldUp", bouncy: "golfQuack", bigcup: "sparkle", spyglass: "golfSpyglass" });

// Each course's air (a hum), and what passes through it now and then.
const AMBIENCE = Object.freeze({
  pirate: { hum: "golfAmbPirate", calls: ["golfGull"] },
  cave: { hum: "golfAmbCave", calls: ["golfDrip", "golfDrip", "gust"] },
  dino: { hum: "golfAmbDino", calls: ["golfJungleBird", "golfDinoCall"] },
  candy: { hum: "golfAmbCandy", calls: ["golfMusicBox"] },
  space: { hum: "golfAmbSpace", calls: ["golfRadio"] },
  frost: { hum: "golfAmbFrost", calls: ["gust", "golfIceCrack"] },
});

// A course's passing calls come about this often, in ms of the round.
const CALL_EVERY_MS = 7000;
// How near (in course units) a spinner, mover or well must be to be heard.
const HEAR_R = 160;

// A little pitch wobble, so a repeated hit never sounds stamped out.
const vary = () => 0.94 + Math.random() * 0.12;

function create({ canvas, tone = () => {}, hum = () => {}, onScore = () => {}, course: startCourse }) {
  const ctx = canvas.getContext("2d");
  let colors = null;
  let round = newRound(startCourse);
  let state = "ready";
  let scale = 1;
  let carry = 0;
  // How long each arrow has been held, in ms (0 is up), and whether the roll
  // is being fast-forwarded (the action key or the pointer held down).
  const held = { left: 0, right: 0 };
  let fast = false;
  // Words popped up on the board, and how many of each kind so far.
  let toasts = [];
  let said = 0;
  let lastBump = -Infinity;
  // Where the pointer was last seen on the board, in CSS pixels (null before
  // it has been), so a held aim can tell a real move from a shake.
  let lastPointer = null;
  // A board drawn as a course card's art: the hole alone, no pills or aim.
  let bare = false;
  // What the sounds remember between steps (never read by the rules): when
  // the last rail and bump sounded, whether the ball is over the cup's rim,
  // in sand or on ice, the meter's zone and trips, the shot clock's last
  // count, each gate's last state, when the course's next call comes, and
  // how far the held arrows have turned since their last tick.
  const sfx = {};
  const resetSfx = () => Object.assign(sfx, { wallAt: -Infinity, bumpAt: -Infinity, lip: false, sand: false, ice: false, zone: null, trips: METER_TRIPS, count: null, gates: null, gateHole: -1, callAt: CALL_EVERY_MS, calls: 0, turned: 0, turnCard: false });
  resetSfx();

  // The ball is at rest on a hole and waiting for a putt.
  const aiming = () => state === "running" && round.phase === "aim";

  const say = (text, x, y, big = false) => {
    toasts.push({ text, x, y, at: round.clock, big });
    said += 1;
  };

  // A round on screen: running, or paused where it stood.
  const live = () => state === "running" || state === "paused";

  // The aim in play, or null: { angle, needle, zone }, with the needle and
  // its zone only while the meter runs. Shown from the start of each hole, so
  // the first press is never blind.
  const currentAim = () => {
    if (!live()) return null;
    if (round.phase === "aim") return { angle: round.aimAngle, needle: null, zone: null };
    if (round.phase !== "swing") return null;
    const needle = meterAt(round.swingMs);
    return { angle: round.swingAngle, needle, zone: meterZone(needle) };
  };

  // What the drawing needs of this moment, worked out here so golf-draw.js
  // decides nothing.
  const view = () => {
    const holes = holesOf(round);
    const hole = holes[round.hole];
    const ball = round.ball;
    const aimView = currentAim();
    const card = round.phase === "card";
    // The ball waits for a putt: aimed, or the meter running.
    const waiting = round.phase === "aim" || round.phase === "swing";
    toasts = toasts.filter((t) => round.clock - t.at < TOAST_MS);
    // The spyglass follows the needle: the roll this press would make.
    const spyShot = aimView && aimView.needle !== null && round.held === "spyglass" ? swingShot(aimView.needle, aimView.angle, round.putts) : null;
    const spy = spyShot ? predictPath(round, spyShot.angle, spyShot.power) : null;
    return {
      course: { w: COURSE_W, h: COURSE_H },
      hole,
      holeNo: round.hole + 1,
      clock: round.clock,
      holeMs: round.clock - round.holeStart,
      spinners: hole.spinners.map((s) => ({ ...spinnerEnds(s, round.clock), x: s.x, y: s.y, look: s.look })),
      movers: hole.movers.map((m) => ({ ...moverAt(m, round.clock), look: m.look })),
      gates: hole.gates.map((g) => ({ ...g, shut: gateShut(g, round.clock), phase: gatePhase(g, round.clock) })),
      pads: hole.powerups.map((p, i) => ({ ...p, taken: round.taken.includes(i) })),
      ball,
      ballR: BALL_R,
      cupR: CUP_R,
      // The cup as this putt, or the one being aimed, will find it.
      cupDraw: round.active === "bigcup" || (round.held === "bigcup" && waiting) ? CUP_R * BIG_CUP : CUP_R,
      magnetR: round.active === "magnet" || (round.held === "magnet" && waiting) ? MAGNET_R : 0,
      tunnelR: TUNNEL_R,
      padR: POWERUP_R,
      trail: round.phase === "rolling" ? round.trail : [],
      aim: aimView,
      // The power meter while it runs: the needle, the top of the overswing,
      // where the MAX band starts, where the last swing stopped, and the
      // trips left before the ball dribbles.
      meter: aimView && aimView.needle !== null
        ? { needle: aimView.needle, zone: aimView.zone, top: 1 + OVER_BAND, maxFrom: 1 - MAX_BAND, last: round.lastSwing, tripsLeft: METER_TRIPS - Math.floor(round.swingMs / METER_MS) }
        : null,
      // The shot clock's share left, 1 to 0, while the ball waits.
      shotClock: live() && round.phase === "aim" ? Math.max(0, 1 - round.restMs / SHOT_CLOCK_MS) : null,
      fast: fast && round.phase === "rolling" ? FAST_FORWARD : 0,
      spy,
      held: round.held ? { kind: round.held, ...POWERUPS[round.held] } : null,
      active: round.active,
      toasts: toasts.map((t) => ({ ...t, age: (round.clock - t.at) / TOAST_MS })),
      // A picked-up ball is simply gone; a sunk one shrinks into the cup.
      sinking: card ? (round.sunk ? Math.min(1, round.cardMs / 350) : 1) : null,
      phase: round.phase,
      cardMs: round.cardMs,
      card: holes.map((h, i) => ({ par: h.par, strokes: i < round.card.length ? round.card[i] : null })),
      frontNine: FRONT_NINE,
      // The card after the front nine: the turn.
      turn: card && round.hole === FRONT_NINE - 1,
      total: total(round),
      parTotal: parTotal(round, holes.length),
      voice: courseById(round.course).voice,
      toPar: toPar(round),
      strokes: round.strokes,
      pickedUp: card && !round.sunk,
      ace: card && round.sunk !== null && round.card.at(-1) === 1,
      state,
      bare,
      colors,
    };
  };

  const paint = () => {
    if (!ctx) return;
    colors ||= readColors(canvas);
    drawCourse(ctx, view());
  };

  const start = () => {
    colors = null;
    round = newRound(round.course);
    carry = 0;
    held.left = 0;
    held.right = 0;
    fast = false;
    toasts = [];
    said = 0;
    lastBump = -Infinity;
    resetSfx();
    state = "running";
    tone("golfTeeUp");
    paint();
  };

  // The ball's speed now, in units a second.
  const ballSpeed = () => Math.hypot(round.ball.vx, round.ball.vy);

  // A rail, a spinner's sail or a shut gate just turned the ball: the old
  // blip, as loud as the hit was hard, and what it hit beneath it.
  const wallSound = (hole) => {
    const hard = Math.min(1, ballSpeed() / 350);
    tone("wall", 0.45 + 0.55 * hard, vary());
    if (round.clock - sfx.wallAt < 80) return;
    sfx.wallAt = round.clock;
    const { x, y } = round.ball;
    const touching = (seg) => {
      const p = closest(seg.x1, seg.y1, seg.x2, seg.y2, x, y);
      return dist(p.x, p.y, x, y) <= BALL_R + 0.5;
    };
    const sail = hole.spinners.some((s) => touching(spinnerEnds(s, round.clock)));
    tone(sail ? "golfWhack" : RAIL_SOUND[hole.ground] || "golfRail", 0.4 + 0.6 * hard, vary());
  };

  // A bumper or a mover just kicked the ball: the old blip, and the voice of
  // whichever is nearest (a shark bites, a duck quacks, a coin rings).
  const bumpSound = (hole) => {
    tone("bump", 0.8, vary());
    if (round.clock - sfx.bumpAt < 120) return;
    sfx.bumpAt = round.clock;
    const { x, y } = round.ball;
    let near = null;
    let gap = Infinity;
    for (const b of hole.bumpers) {
      const d = dist(b.x, b.y, x, y) - b.r;
      if (d < gap) [gap, near] = [d, BUMPER_SOUND[b.look] || "golfBoing"];
    }
    for (const m of hole.movers) {
      const at = moverAt(m, round.clock);
      const d = dist(at.x, at.y, x, y) - at.r;
      if (d < gap) [gap, near] = [d, MOVER_SOUND[m.look] || "golfBoing"];
    }
    if (near) tone(near, 0.7, vary());
  };

  // The hole just finished: a cheer for an ace, then a stinger for the
  // score against par, or the sad trombone for a ball picked up.
  const resultSound = (hole, events) => {
    if (events.includes("done")) return;
    if (events.includes("pickup")) {
      tone("golfWomp");
      tone("aww", 0.5);
      return;
    }
    const sunk = events.includes("ace") || events.includes("cup");
    if (!sunk) return;
    tone("golfCupRattle", 0.8);
    if (events.includes("ace")) {
      tone("cheer", 0.7);
      tone("applause", 0.8);
      return;
    }
    const diff = round.card.at(-1) - hole.par;
    if (diff <= -2) {
      tone("golfEagle");
      tone("applause", 0.7);
    } else if (diff === -1) {
      tone("golfBirdie");
      tone("applause", 0.5);
    } else if (diff === 0) tone("golfPar", 0.8);
    else if (diff === 1) tone("golfBogey", 0.7);
    else tone("golfWomp", 0.8);
  };

  const play = (events) => {
    const hole = holesOf(round)[round.hole];
    const { voice } = courseById(round.course);
    const { x, y } = round.ball;
    for (const e of events) {
      if (e === "splash") {
        tone((voice.splashTone && voice.splashTone[hole.liquid]) || SPLASH_TONE[hole.liquid] || "splash");
        tone(SPLASH_LAYER[hole.liquid] || "splashBig", 0.8, vary());
        tone("aww", 0.4);
        say(`${pick(voice.splash[hole.liquid] || firstSplash(voice), said)} (+1)`, x, y);
        continue;
      }
      if (e === "clock") {
        tone("swing");
        tone("warn", 0.4);
        say("Shot clock! Swing!", x, y - 14, true);
      }
      if (e === "dribble") {
        tone("shank");
        tone("golfPlop", 0.7);
        say(pick(DRIBBLE_WORDS, said), x, y - 12);
      }
      if (e === "wall") {
        wallSound(hole);
        continue;
      }
      if (e === "bump") bumpSound(hole);
      else if (TONE_FOR[e]) tone(TONE_FOR[e]);
      if (e === "tunnel") tone(hole.theme === "space" ? "warp" : "whoosh", 0.6, vary());
      if (e === "powerup" && round.held) tone(POWERUP_SOUND[round.held] || "sparkle", 0.6);
      if (e === "hole") tone("golfTeeUp", 0.8);
      // Stopped a whisker short of the cup: the crowd groans.
      if (e === "stop" && dist(round.ball.x, round.ball.y, hole.cup.x, hole.cup.y) < 22 && round.phase === "aim") tone("aww", 0.35);
      if (e === "bump" && round.clock - lastBump > 450) {
        lastBump = round.clock;
        say(pick(voice.bump, said), x, y - 8);
      }
      if (e === "tunnel") say(pick(TUNNEL_WORDS, said), x, y - 8);
      if (e === "powerup" && round.held) say(`${POWERUPS[round.held].name}!`, x, y - 10, true);
      // High, over the scorecard that is about to show.
      if (e === "ace") say(voice.ace, COURSE_W / 2, 54, true);
    }
    resultSound(hole, events);
    // A fast-forward ends with the roll.
    if (round.phase !== "rolling") fast = false;
    if (events.includes("done") && state === "running") {
      tone("golfCourseDone");
      tone("applause");
      tone("cheer", 0.8);
      state = "over";
      onScore(total(round));
    }
  };

  // The first press starts the meter, the second sets the power and putts.
  const swing = () => {
    if (round.phase === "aim") {
      if (!startSwing(round)) return false;
      tone("swing");
      paint();
      return true;
    }
    const shot = setPower(round);
    if (!shot) return false;
    const { x, y } = round.ball;
    const firm = 0.4 + 0.6 * Math.min(1, shot.power);
    tone(round.active === "cannon" ? "boom" : "putt", firm);
    tone(round.active === "cannon" ? "blast" : "golfThock", firm, 0.9 + 0.2 * Math.min(1, shot.power));
    if (round.active === "ghost") tone("wail", 0.4, 1.3);
    if (shot.zone === "max") {
      tone("max");
      tone("boost", 0.5);
      say(pick(MAX_WORDS, said), x, y - 12, true);
    }
    if (shot.zone === "over") {
      tone("shank");
      tone("golfWobble", 0.7);
      say(pick(SHANK_WORDS, said), x, y - 12);
    }
    if (round.active && POWERUPS[round.active]) say(round.active === "doubloon" ? "Free putt!" : `${POWERUPS[round.active].name} away!`, x, y - (shot.zone === "normal" ? 12 : 26));
    paint();
    return true;
  };

  // The roll played fast: a swoosh as it speeds up.
  const fastOn = () => {
    if (!fast) tone("swoosh", 0.35);
    fast = true;
  };

  // Everything that sounds for as long as it lasts, kept going each tick:
  // the course's air, the rolling ball, the power meter, a spinner, a mover
  // or a well near the ball, and a power-up at work; plus the cues that
  // follow the round's state rather than its events (the meter's MAX band,
  // its last trip, the shot clock's countdown, the rim of the cup, sand and
  // ice underfoot, gates slamming, the turn, the course's passing calls).
  const soundscape = () => {
    const hole = holesOf(round)[round.hole];
    const ball = round.ball;
    const amb = AMBIENCE[hole.theme] || AMBIENCE.pirate;
    const molten = (hole.liquid === "lava" || hole.liquid === "plasma") && hole.water.length > 0;
    hum("golf:air", molten ? "golfAmbLava" : amb.hum, 0.8);
    if (round.clock >= sfx.callAt) {
      sfx.calls += 1;
      // A spread that never repeats too evenly, without touching the rules.
      sfx.callAt = round.clock + CALL_EVERY_MS + ((sfx.calls * 2711) % 5000);
      tone(pick(amb.calls, sfx.calls), 0.3 + Math.random() * 0.15, vary());
    }

    // The ball rolling: its hum follows its speed, and the ground under it.
    const speed = ballSpeed();
    const rolling = round.phase === "rolling";
    const sand = rolling && round.active !== "ghost" && inSand(hole, ball.x, ball.y);
    const ice = rolling && onIce(hole, ball.x, ball.y);
    if (rolling) {
      const pace = Math.min(1, speed / 450);
      hum("golf:roll", sand ? "golfSandRoll" : ice ? "golfIceGlide" : "golfRoll", 0.15 + 0.85 * Math.sqrt(pace), (0.6 + 1.2 * pace) * (fast ? 1.25 : 1));
      if (round.active === "magnet") hum("golf:power", "golfMagnet", 0.8, 0.8 + pace);
      if (round.active === "ghost") hum("golf:power", "haunt", 0.7, 2);
    }
    if (sand && !sfx.sand && speed > 60) tone("golfSandPuff", Math.min(1, speed / 300), vary());
    if (ice && !sfx.ice && speed > 40) tone("golfIceSkate", 0.6, vary());
    sfx.sand = sand;
    sfx.ice = ice;

    // Over the cup too fast to drop: the rim rings once each pass.
    const overCup = rolling && dist(ball.x, ball.y, hole.cup.x, hole.cup.y) < cupReach(round);
    if (overCup && !sfx.lip) tone("golfLipOut", 0.7, vary());
    if (overCup) sfx.lip = true;
    else if (dist(ball.x, ball.y, hole.cup.x, hole.cup.y) > cupReach(round) + 4) sfx.lip = false;

    // The power meter: a tone that climbs with the needle, a ping into the
    // MAX band, and a warning as its last trip begins.
    if (round.phase === "swing") {
      const needle = meterAt(round.swingMs);
      const zone = meterZone(needle);
      hum("golf:meter", "meter", zone === "over" ? 1 : 0.75, 0.7 + 1.5 * needle);
      if (zone === "max" && sfx.zone === "normal") tone("golfNeedlePing", 0.6);
      sfx.zone = zone;
      const trips = METER_TRIPS - Math.floor(round.swingMs / METER_MS);
      if (trips < sfx.trips && trips === 1) tone("warn", 0.3);
      sfx.trips = trips;
    } else {
      sfx.zone = null;
      sfx.trips = METER_TRIPS;
    }

    // The shot clock's last three seconds tick, quicker in pitch as it runs out.
    if (round.phase === "aim" && round.restMs > SHOT_CLOCK_MS - 3000) {
      const left = Math.ceil((SHOT_CLOCK_MS - round.restMs) / 1000);
      if (left !== sfx.count) tone("tick", 0.4, 1 + (3 - left) * 0.15);
      sfx.count = left;
    } else sfx.count = null;

    // The nearest spinner whirs, the nearest humming mover hums, the
    // nearest well swirls, each louder as the ball comes near.
    const near = (list, at) => {
      let best = null;
      let gap = HEAR_R;
      for (const it of list) {
        const p = at(it);
        const d = dist(p.x, p.y, ball.x, ball.y);
        if (d < gap) [best, gap] = [it, d];
      }
      return best && { it: best, close: 1 - gap / HEAR_R };
    };
    const spin = near(hole.spinners, (s) => s);
    if (spin) hum("golf:spin", "golfSpin", 0.2 + 0.8 * spin.close, 0.5 + 0.3 * Math.abs(spin.it.speed));
    const mover = near(hole.movers.filter((m) => MOVER_HUM[m.look]), (m) => moverAt(m, round.clock));
    if (mover) {
      const how = MOVER_HUM[mover.it.look];
      const at = moverAt(mover.it, round.clock);
      const pace = Math.min(1, Math.hypot(at.vx, at.vy) / 150);
      hum("golf:mover", how.name, mover.close * (0.4 + 0.6 * pace), how.pitch * (0.8 + 0.4 * pace));
    }
    const well = near(hole.wells, (w) => w);
    if (well) hum("golf:well", "golfVortex", 0.3 + 0.7 * well.close, well.it.pull < 0 ? 1.6 : well.it.look === "blackhole" ? 0.5 : 0.9);

    // Gates: a slam as each shuts, as loud as it is near.
    if (sfx.gateHole !== round.hole || !sfx.gates) {
      sfx.gateHole = round.hole;
      sfx.gates = hole.gates.map((g) => gateShut(g, round.clock));
    }
    hole.gates.forEach((g, i) => {
      const shut = gateShut(g, round.clock);
      if (shut && !sfx.gates[i] && round.phase !== "card") {
        const loud = 1 - dist((g.x1 + g.x2) / 2, (g.y1 + g.y2) / 2, ball.x, ball.y) / 260;
        if (loud > 0.12) tone(GATE_SOUND[g.look] || "clank", 0.6 * loud, vary());
      }
      sfx.gates[i] = shut;
    });

    // The turn, once the front nine's card has been up a moment.
    const turnCard = round.phase === "card" && round.hole === FRONT_NINE - 1;
    if (turnCard && !sfx.turnCard && round.cardMs > 500) {
      tone("victory", 0.6);
      sfx.turnCard = true;
    }
    if (!turnCard) sfx.turnCard = false;
  };

  const skipCard = () => {
    if (state !== "running" || round.phase !== "card") return false;
    nextHole(round);
    tone("golfTeeUp", 0.8);
    paint();
    return true;
  };

  // Held arrows turn the aim, slowly at first and faster the longer they are
  // held.
  const turn = (ms) => {
    const dir = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    const ramp = Math.min(1, Math.max(held.left, held.right) / TURN_RAMP_MS);
    if (held.left) held.left += ms;
    if (held.right) held.right += ms;
    if (!dir || round.phase !== "aim") return;
    const step = (TURN_SLOW + (TURN_FAST - TURN_SLOW) * ramp * ramp) * (ms / 1000);
    round.aimAngle += dir * step;
    // A soft ratchet click every few degrees, quicker as the turn speeds up.
    sfx.turned += step;
    if (sfx.turned >= 0.12) {
      sfx.turned = 0;
      tone("tickSoft", 0.25, 1 + ramp * 0.4);
    }
  };

  return {
    get score() {
      return total(round);
    },
    get state() {
      return state;
    },
    // Not part of the contract: the round in play, so the unit suite can set
    // up a shot on any hole. The window never reads it.
    get round() {
      return round;
    },
    start,
    pause() {
      if (state !== "running") return;
      state = "paused";
      // Nothing held carries over a pause: its release may never arrive.
      held.left = 0;
      held.right = 0;
      fast = false;
      paint();
    },
    resume() {
      if (state === "paused") state = "running";
    },
    key(name) {
      if (name === "action") {
        if (state === "ready" || state === "over") start();
        else if (state === "paused") state = "running";
        else if (skipCard()) return true;
        else if (round.phase === "rolling") fastOn();
        else swing();
        return true;
      }
      if (name !== "left" && name !== "right") return false;
      if (!aiming()) return false;
      // A press nudges at once; the window's key repeats change nothing, as
      // the hold already turns the aim each tick.
      if (!held[name]) {
        held[name] = 1;
        round.aimAngle += (name === "left" ? -1 : 1) * AIM_NUDGE;
        tone("tickSoft", 0.25);
        paint();
      }
      return true;
    },
    release(name) {
      if (name === "action") fast = false;
      else if (name === "left" || name === "right") held[name] = 0;
      else return false;
      return true;
    },
    pointer(type, x, y) {
      const cx = x / scale;
      const cy = y / scale;
      // The aim points from the ball at the pointer, wherever it is.
      const aimAt = () => {
        const { ball } = round;
        if (!aiming() || Math.hypot(cx - ball.x, cy - ball.y) < 1) return false;
        round.aimAngle = Math.atan2(cy - ball.y, cx - ball.x);
        return true;
      };
      if (type === "up" || type === "cancel") {
        fast = false;
        return true;
      }
      if (type === "move") {
        // While the aim the cup set is held, a small move from where the
        // pointer sat is ignored and does not count as where it sits now.
        if (aiming() && round.aimHeld && lastPointer && Math.hypot(x - lastPointer.x, y - lastPointer.y) < AIM_WAKE_PX) return false;
        lastPointer = { x, y };
        if (!aimAt()) return false;
        round.aimHeld = false;
        paint();
        return true;
      }
      if (type !== "down") return false;
      lastPointer = { x, y };
      if (state === "ready" || state === "over") {
        start();
        return true;
      }
      if (state !== "running") return false;
      if (skipCard()) return true;
      if (round.phase === "rolling") {
        fastOn();
        return true;
      }
      // A press putts where the arrow points: the aim already followed every
      // move, and a press that did not move must not swing it.
      return swing();
    },
    tick(ms) {
      if (state !== "running") return;
      const step = Math.min(Math.max(0, ms), MAX_TICK_MS);
      turn(step);
      carry += step * (fast && round.phase === "rolling" ? FAST_FORWARD : 1);
      while (carry >= SUB_STEP_MS && state === "running") {
        carry -= SUB_STEP_MS;
        play(advance(round, SUB_STEP_MS));
      }
      if (state === "running") soundscape();
      paint();
    },
    // The course on screen, and a switch to another: a fresh round of it,
    // ready to start. The same course keeps its round, paused or not.
    get course() {
      return round.course;
    },
    setCourse(id) {
      const next = courseById(id).id;
      if (next === round.course && state !== "over") return true;
      round = newRound(next);
      state = "ready";
      carry = 0;
      held.left = 0;
      held.right = 0;
      fast = false;
      toasts = [];
      resetSfx();
      paint();
      return true;
    },
    // Not part of the contract: draws hole `index` of the course alone, with
    // the ball on its tee and its movers part way through their swing, at
    // `w` by `h` CSS pixels, as a course card's art on the dashboard.
    showcase(index, w, h) {
      bare = true;
      round.hole = Math.max(0, Math.min(holesOf(round).length - 1, index));
      placeOnTee(round);
      round.clock = 1700;
      round.holeStart = -10_000;
      fit(w, h);
    },
    resize(w, h) {
      if (!(w >= MIN_W && h >= MIN_H)) return false;
      fit(w, h);
      return true;
    },
  };

  // Sizes the board to w by h CSS pixels; everything is drawn in course units.
  function fit(w, h) {
    scale = Math.min(w / COURSE_W, h / COURSE_H);
    colors = null;
    const ratio = (typeof devicePixelRatio === "number" && devicePixelRatio > 0) ? devicePixelRatio : 1;
    const cssW = COURSE_W * scale;
    const cssH = COURSE_H * scale;
    canvas.width = Math.round(cssW * ratio);
    canvas.height = Math.round(cssH * ratio);
    if (canvas.style) {
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
    }
    if (ctx && typeof ctx.setTransform === "function") ctx.setTransform(ratio * scale, 0, 0, ratio * scale, 0, 0);
    paint();
  }
}

// The course dashboard's cards: each course's id, name, line and par, in
// the order golf-holes.js lists them. The window keeps a best per course.
const courses = Object.freeze(COURSES.map((c) => Object.freeze({ id: c.id, name: c.name, blurb: c.blurb, holes: c.holes.length, par: coursePar(c) })));

// Draws course `id`'s cover hole on `canvas` at `w` by `h` CSS pixels.
function preview(canvas, id, w, h) {
  const c = courseById(id);
  create({ canvas, course: c.id }).showcase(c.cover, w, h);
}

export default Object.freeze({ id: "golf", title: "Mini golf", lowerIsBetter: true, courses, preview, create });
