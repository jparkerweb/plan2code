// Plan2Code Web Console - Mini golf, the second activity: eighteen holes seen from above, rules, physics and the game contract.
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
// course is data (golf-holes.js); the drawing lives in golf-draw.js and its
// scenery in golf-decor.js.

import { COURSE_W, COURSE_H, FRONT_NINE, HOLES } from "./golf-holes.js";
import { drawCourse, readColors } from "./golf-draw.js";

export { COURSE_W, COURSE_H, FRONT_NINE, HOLES };

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
export const inSand = (hole, x, y) => hole.sand.some((p) => inPolygon(p, x, y));
export const onBridge = (hole, x, y) => hole.bridges.some((r) => inRect(r, x, y));
export const inWater = (hole, x, y) => hole.water.some((p) => inPolygon(p, x, y)) && !onBridge(hole, x, y);

/* ------------------------------------------------------------------ rules */

const parTotal = (upTo) => HOLES.slice(0, upTo).reduce((n, h) => n + h.par, 0);

// The ball at rest, waiting for a putt: the shot clock starts again and the
// aim turns back toward the cup, so a straight putt needs no aiming at all.
function atRest(round) {
  const hole = HOLES[round.hole];
  round.phase = "aim";
  round.restMs = 0;
  round.aimAngle = Math.atan2(hole.cup.y - round.ball.y, hole.cup.x - round.ball.x);
}

function placeOnTee(round) {
  const hole = HOLES[round.hole];
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

// Hole 1, the ball on its tee, nothing scored. `phase` is "aim" (the ball at
// rest, waiting for a putt), "swing" (the power meter running), "rolling",
// "card" (the scorecard between holes) or "done" (the round is over).
// `restMs` is how long the ball has waited (the shot clock), `swingMs` how
// long the meter has run, `swingAngle` the aim it locked, and `lastSwing`
// where the needle stopped last time. `held` is the power-up waiting for the
// next putt, `active` the one helping the putt in play, and `taken` the pads
// this hole has used up.
export function newRound() {
  const round = {
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
export const toPar = (round) => round.card.reduce((n, s) => n + s, 0) - parTotal(round.card.length);

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
  round.phase = round.hole === HOLES.length - 1 ? "done" : "card";
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
  const hole = HOLES[round.hole];
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
    // A ball left on a slope rolls off it by itself.
    if (!onSlope(hole, ball.x, ball.y)) return events;
    ball.moving = true;
    round.phase = "rolling";
  }

  for (const s of hole.slopes) {
    if (inPolygon(s.points, ball.x, ball.y)) {
      ball.vx += s.push.x * dt;
      ball.vy += s.push.y * dt;
    }
  }
  let speed = Math.hypot(ball.vx, ball.vy);
  const top = round.active === "cannon" ? CANNON_MAX : MAX_SPEED;
  if (speed > 0) {
    const slow = (FRICTION + DRAG * speed) * (!ghost && inSand(hole, ball.x, ball.y) ? SAND_FACTOR : 1) * dt;
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

  const stopping = speed < STOP_SPEED && !onSlope(hole, ball.x, ball.y);
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
// always says the same things.
const SPLASH_WORDS = Object.freeze({
  sea: ["SPLOOSH! Davy Jones says thanks", "Shark snack! Yum", "Man overboard!"],
  pool: ["Bloop!", "Glub glub glub", "Something down there liked that"],
  lava: ["SIZZLE! Extra crispy", "Toasty!", "Marshmallow, anyone?"],
  chasm: ["Aaaaaaaaa...", "Bye bye, ball!", "Still falling..."],
});
const BUMP_WORDS = Object.freeze({
  pirate: ["Bonk!", "Arr!", "Clunk!", "Yo ho!"],
  cave: ["Boing!", "Clang!", "Ping!", "Bwomp!"],
});
const TUNNEL_WORDS = ["Whoosh!", "Wheee!", "Where'd it go?!"];
const MAX_WORDS = ["MAX POWER!", "CRUSHED IT!", "KA-BLAM!"];
const SHANK_WORDS = ["Overswing! Shanked it", "Whoa, too hard!", "Wild swing!"];
const DRIBBLE_WORDS = ["Too slow! Dribbled it", "Asleep at the tiller!", "Zzz... plop"];

const pick = (list, n) => list[n % list.length];

/* --------------------------------------------------------------- contract */

const TONE_FOR = Object.freeze({ wall: "wall", bump: "bump", cup: "cup", ace: "ace", tunnel: "tunnel", powerup: "power" });
const SPLASH_TONE = Object.freeze({ sea: "splash", pool: "splash", lava: "sizzle", chasm: "fall" });

function create({ canvas, tone = () => {}, onScore = () => {} }) {
  const ctx = canvas.getContext("2d");
  let colors = null;
  let round = newRound();
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
    const hole = HOLES[round.hole];
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
      card: HOLES.map((h, i) => ({ par: h.par, strokes: i < round.card.length ? round.card[i] : null })),
      frontNine: FRONT_NINE,
      // The card after the front nine heads into the caves.
      turn: card && round.hole === FRONT_NINE - 1,
      total: total(round),
      parTotal: parTotal(HOLES.length),
      toPar: toPar(round),
      strokes: round.strokes,
      pickedUp: card && !round.sunk,
      ace: card && round.sunk !== null && round.card.at(-1) === 1,
      state,
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
    round = newRound();
    carry = 0;
    held.left = 0;
    held.right = 0;
    fast = false;
    toasts = [];
    said = 0;
    lastBump = -Infinity;
    state = "running";
    paint();
  };

  const play = (events) => {
    const hole = HOLES[round.hole];
    const { x, y } = round.ball;
    for (const e of events) {
      if (e === "splash") {
        tone(SPLASH_TONE[hole.liquid] || "splash");
        say(`${pick(SPLASH_WORDS[hole.liquid] || SPLASH_WORDS.sea, said)} (+1)`, x, y);
        continue;
      }
      if (e === "clock") {
        tone("swing");
        say("Shot clock! Swing!", x, y - 14, true);
      }
      if (e === "dribble") {
        tone("shank");
        say(pick(DRIBBLE_WORDS, said), x, y - 12);
      }
      if (TONE_FOR[e]) tone(TONE_FOR[e]);
      if (e === "bump" && round.clock - lastBump > 450) {
        lastBump = round.clock;
        say(pick(BUMP_WORDS[hole.theme] || BUMP_WORDS.pirate, said), x, y - 8);
      }
      if (e === "tunnel") say(pick(TUNNEL_WORDS, said), x, y - 8);
      if (e === "powerup" && round.held) say(`${POWERUPS[round.held].name}!`, x, y - 10, true);
      // High, over the scorecard that is about to show.
      if (e === "ace") say(hole.theme === "cave" ? "HOLE IN ONE! The cave echoes: one... one... one..." : "SHIVER ME TIMBERS! HOLE IN ONE!", COURSE_W / 2, 54, true);
    }
    // A fast-forward ends with the roll.
    if (round.phase !== "rolling") fast = false;
    if (events.includes("done") && state === "running") {
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
    tone(round.active === "cannon" ? "boom" : "putt", 0.4 + 0.6 * Math.min(1, shot.power));
    if (shot.zone === "max") {
      tone("max");
      say(pick(MAX_WORDS, said), x, y - 12, true);
    }
    if (shot.zone === "over") {
      tone("shank");
      say(pick(SHANK_WORDS, said), x, y - 12);
    }
    if (round.active && POWERUPS[round.active]) say(round.active === "doubloon" ? "Free putt!" : `${POWERUPS[round.active].name} away!`, x, y - (shot.zone === "normal" ? 12 : 26));
    paint();
    return true;
  };

  const skipCard = () => {
    if (state !== "running" || round.phase !== "card") return false;
    nextHole(round);
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
    round.aimAngle += dir * (TURN_SLOW + (TURN_FAST - TURN_SLOW) * ramp * ramp) * (ms / 1000);
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
        else if (round.phase === "rolling") fast = true;
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
        if (!aimAt()) return false;
        paint();
        return true;
      }
      if (type !== "down") return false;
      if (state === "ready" || state === "over") {
        start();
        return true;
      }
      if (state !== "running") return false;
      if (skipCard()) return true;
      if (round.phase === "rolling") {
        fast = true;
        return true;
      }
      aimAt();
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
      paint();
    },
    resize(w, h) {
      if (!(w >= MIN_W && h >= MIN_H)) return false;
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
      // Everything is drawn in course units.
      if (ctx && typeof ctx.setTransform === "function") ctx.setTransform(ratio * scale, 0, 0, ratio * scale, 0, 0);
      paint();
      return true;
    },
  };
}

export default Object.freeze({ id: "golf", title: "Mini golf", lowerIsBetter: true, create });
