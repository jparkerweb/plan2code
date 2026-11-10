// Plan2Code Web Console - Ghoul Rush's dark ride, its rules: the Midnight Carnival's bonus round, a side-view shooting gallery on rails where Planny sits in a ghost-train car and the animatronics go wrong; the pack (`RIDE`) that ghoul.js plugs in.
//
// Ported from prototypes/ghoul-rush-ride/gallery.html. The room (`darkride`,
// ghoul-rooms.js) has `bonus: true` and a room field `ride: { gallery: true,
// time, ready, how }`; the scene table (12 rooms, the exact seconds) is
// ghoul-ride-scenes.js and the art is ghoul-ride-draw*.js. Like the Runaway
// Cart's pack (ghoul-cart.js) this adds a `ride` hook (run each slice of play
// before the walking rules; it returns true, so Planny never walks), a `place`
// hook (the ride is made when the room is set up) and, new here, a `pointer`
// hook (a canvas press or move in the room, handed on by ghoul.js's `pointer`).
//
// The ride is `round.gallery` (null in every other room), the same state object
// the prototype called `G`, bound for the art through ghoul-ride-core.js. It runs
// in steps of STEP_MS (the prototype's 60 frames a second) whatever the slice.
// Controls: the arrows move the reticle with acceleration (`round.input`), Space
// fires (`round.input.fire`; ghoul.js's key sets `G.trigger` too, so a tap shorter
// than a step still shoots, and does not fire the blaster or use a weapon in the
// bag), the mouse moves it and a press fires (`pointer`). The reticle below
// DUCK_ON ducks Planny until it is back above DUCK_OFF; a ducked Planny cannot fire.
//
// Hearts: the bonus round's five (ghoul-bonus.js). Everything that hurts goes
// through `kit.lose(round, cause)` (the bonus round's `takeLife`, so
// `round.infinite` spares it), which in this room does not crash Planny unless
// it was the last heart (ghoul.js's takeLife). A hit gives INVULN seconds of
// safety. The last heart gone ends the bonus with no dice; the ride's finish
// (the Barker done) hands the bonus its dice (`perf.dice`, the prototype's grade:
// RIDE_FLOOR to MAX_DICE) and walks Planny to the door, where `clearRoom` ends it.
//
// Nothing here draws a number from Math.random: the ride keeps its own seeded
// stream (`G.rs`).

import { CAR_X, DUCK_OFF, DUCK_ON, G, MAXHP, RET_X0, RET_X1, RET_Y0, RET_Y1, STAGE, TAU, W, X, bindG, clamp, ease, lerp, pick, rand, rnd, sx } from "./ghoul-ride-core.js";
import { DARK_A, SCENES, sceneIndexAt } from "./ghoul-ride-scenes.js";

const freeze = (o) => Object.freeze(o);

// Seconds of the ride per step, how long a hit protects, the car's speed
// multiplier (the prototype's SPD), the pace of fire and the dice of a finish.
export const STEP_MS = 16;
export const INVULN = 2.2;
export const SPD = 2.1;
export const FIRE_GAP = 0.16;
export const RIDE_FLOOR = 5;
export const RIDE_EXTRA = 4;

/* ------------------------------------------------------------- sounds */

// Every sound the ride makes is an event `ride<Name>` ({ level, pitch }); the art
// plays the tone `ghoulRide<Name>` (ghoul-sfx-ride.js) from ghoul-ride-draw.js's react.
export const SOUNDS = freeze([
  "shoot", "splat", "gib", "scream", "stab", "bang", "clank", "ding", "pop", "growl", "hurt", "whoosh", "chop", "sparks", "snap", "breath", "heart", "thump",
  "stop", "lightsOff", "lightsOn", "creak", "hit", "roar", "flash", "fan", "low", "glass", "splash", "oops", "web", "tick", "diceLand", "heal", "joint",
  // The second set the user picked (wire-ride-sounds.cjs), one act each, `<creature><Act>`. endCard, endCount and endLost
  // play from the cleared card's tick (ghoul-ride-draw.js) and the lost card (ghoul-ride-voices.js), not from here.
  "carDrop", "carJump", "blasterMiss", "blasterAssist", "hurtDuck", "hurtFlicker", "waxMelt", "horseGallop", "mirrorGhoul", "jarCrack", "swanPeck", "swanSpit", "swanDie",
  "bubblesRise", "bubblesHands", "widowFang", "widowDie", "spiderlingSkitter", "spiderlingDie", "batFlap", "clownHoop", "exitGate", "stallEyes", "stallJaws",
  "barkerEye", "barkerSpit", "barkerBite", "barkerDie", "endCard", "endCount", "endLost",
]);
const cap = (s) => s[0].toUpperCase() + s.slice(1);
export const EVENTS = freeze(SOUNDS.map((n) => `ride${cap(n)}`));
// What costs a heart, one cause for each way the ride hurts you.
export const CAUSES = freeze(["ridegrab", "ridecleaver", "rideblade", "ridecrash", "ridehand", "ridehead", "rideeyes", "ridemouth", "ridebeak", "ridefang", "ridejaws"]);

// The round and the kit of the call in progress.
let RD = null;
let KT = null;
const snd = (name, level = 1, pitch = 1) => RD.events.push({ type: `ride${cap(name)}`, level, pitch });
// A sound that may come in a burst plays at most once every `gap` seconds of the ride's own clock (never the frame rate).
const gate = (name, gap, level = 1) => {
  const t = G.gt[name];
  if (t !== undefined && G.clock - t < gap) return;
  G.gt[name] = G.clock;
  snd(name, level);
};
const sfx = {
  shoot: () => snd("shoot"),
  splat: (s = 1) => snd("splat", Math.min(1, 0.5 + s * 0.35)),
  gib: () => snd("gib"),
  scream: (f = 650, d = 0.8, v = 0.13) => snd("scream", clamp(v / 0.13, 0.3, 1.6), clamp(f / 650, 0.28, 1.6)),
  stab: () => snd("stab"),
  bang: () => snd("bang"),
  clank: () => snd("clank"),
  ding: () => snd("ding"),
  pop: () => snd("pop"),
  growl: () => snd("growl"),
  hurt: () => snd("hurt"),
  whoosh: () => snd("whoosh"),
  chop: () => snd("chop"),
  sparks: () => snd("sparks"),
  snap: () => snd("snap"),
  breath: (v = 1) => snd("breath", v),
  heart: () => snd("heart"),
  thump: () => snd("thump"),
  stop: () => snd("stop"),
  lights: (on) => snd(on ? "lightsOn" : "lightsOff"),
  creak: () => snd("creak"),
  hit: () => snd("hit"),
  roar: () => snd("roar"),
  flash: () => snd("flash"),
  heal: () => snd("heal"),
  low: () => snd("low"),
  glass: () => snd("glass"),
  splash: () => snd("splash"),
  oops: () => snd("oops"),
  web: () => snd("web"),
  tick: () => snd("tick"),
  carDrop: () => snd("carDrop"),
  carJump: () => snd("carJump"),
  blasterMiss: () => gate("blasterMiss", 0.12),
  blasterAssist: () => snd("blasterAssist", 0.7),
  hurtDuck: () => snd("hurtDuck"),
  hurtFlicker: () => snd("hurtFlicker", 0.7),
  waxMelt: () => snd("waxMelt"),
  horseGallop: () => snd("horseGallop"),
  mirrorGhoul: () => snd("mirrorGhoul"),
  jarCrack: () => snd("jarCrack"),
  swanPeck: () => snd("swanPeck"),
  swanSpit: () => snd("swanSpit"),
  swanDie: () => snd("swanDie"),
  bubblesRise: () => gate("bubblesRise", 0.25),
  bubblesHands: () => gate("bubblesHands", 0.12),
  widowFang: () => snd("widowFang"),
  widowDie: () => snd("widowDie"),
  spiderlingSkitter: () => gate("spiderlingSkitter", 0.15),
  spiderlingDie: () => gate("spiderlingDie", 0.06),
  batFlap: () => gate("batFlap", 0.12),
  clownHoop: () => snd("clownHoop"),
  exitGate: () => snd("exitGate"),
  stallEyes: () => snd("stallEyes"),
  stallJaws: () => snd("stallJaws"),
  barkerEye: () => snd("barkerEye"),
  barkerSpit: () => snd("barkerSpit"),
  barkerBite: () => snd("barkerBite"),
  barkerDie: () => snd("barkerDie"),
};

/* ------------------------------------------------------------- score, damage */

const K = {};
const BLOOD = ["#c4121c", "#9c0b14", "#e8283a", "#7a0910"];
function award(pts, x, y) {
  G.combo++;
  G.best = Math.max(G.best, G.combo);
  const m = 1 + Math.min(3, Math.floor(G.combo / 5));
  G.score += pts * m;
  G.floats.push({ s: "+" + pts * m + (m > 1 ? " x" + m : ""), x, y, t: 0 });
}
// A heart lost to `cause`: the bonus round takes it (ghoul.js's lose, which
// spares it under the endless-lives code), the car shakes and bleeds, and a
// moment of safety follows. The last heart ends the ride.
function hurt(cause) {
  if (G.mode !== "ride" || G.inv > 0) return;
  G.inv = INVULN;
  sfx.hurtFlicker();
  G.shake = 1;
  G.flash = 1;
  G.flashCol = "#a00010";
  G.combo = 0;
  G.hurts++;
  G.hurtT = 0.8;
  for (let i = 0; i < 2; i++) lensSplat();
  sfx.hurt();
  blood(CAR_X, 40, 22, { sp: 18, vy: -8, sz: 1.4 });
  KT.lose(RD, cause);
  const b = RD.bonusRound;
  if (b) G.hp = b.hearts;
  if (b && b.hearts <= 0) {
    G.mode = "dead";
    G.deadT = 0;
    sfx.roar();
  }
}

function healHeart() {
  const b = RD.bonusRound;
  if (b) b.hearts = Math.min(b.max, b.hearts + 1);
  G.hp = b ? b.hearts : Math.min(MAXHP, G.hp + 1);
}

/* ------------------------------------------------------------- the kinds */

const POPS = {
  ghoul: { hp: 1, L: 2.2, pts: 150, s: 0.95 }, skeleton: { hp: 1, L: 1.8, pts: 150, s: 0.95 }, butcher: { hp: 7, L: 3.4, pts: 1500, s: 1.05, swing: true },
  corpse: { hp: 2, L: 2.5, pts: 250, s: 0.95 }, host: { hp: 5, L: 3.2, pts: 900, s: 1.05 }, headless: { hp: 3, L: 2.6, pts: 500, s: 1.0 },
  wax: { hp: 2, L: 2.4, pts: 250, s: 0.95 }, hood: { hp: 7, L: 3.6, pts: 2500, s: 1.2, swing: true, nSw: 3, cyc: 1.75 },
  clown: { hp: 1, L: 1.5, pts: 180, s: 0.95 }, hound: { hp: 1, L: 1.25, pts: 200, s: 1.0, beast: true }, horse: { hp: 2, L: 2.0, pts: 300, s: 1.0, beast: true },
  spiderling: { hp: 1, L: 1.3, pts: 100, s: 0.85, beast: true }, bat: { hp: 1, L: 1.0, pts: 120, s: 0.9, beast: true },
  mourner: { hp: 1, L: 2.6, pts: 200, s: 0.95 }, patient: { hp: 2, L: 2.4, pts: 250, s: 0.95 }, bride: { hp: 6, L: 3.6, pts: 2000, s: 1.25, dmg: 2 }
};
function mkPop(t, x, o = {}) { const d = POPS[t]; return { k: "pop", t, x, y: o.y ?? STAGE, hp: d.hp, maxhp: d.hp, boss: o.boss || null, ph: "hid", pt: 0, age: rnd() * 9, trig: o.trig || 56, wait: o.wait || rand(0.6, 1.2), L: d.L * 0.9, rel: false, rx: 0, ry: 0, sc: 1, sc0: 1, flinch: 0, slump: !!o.slump, stand: !!o.stand, chop: !!o.chop, orbit: o.orbit || null, burn: !!o.burn, atk: 0, swings: 0, lastSwing: 0, alive: true, dying: 0 }; }
function mkLant(x, y, v, delay = 0, o = {}) { return { k: "lant", x, y, v, lit: false, lt: 0, hp: 1, delay, alive: true, dying: 0, age: rnd() * 9, sway: rnd() * 6, lightAt: o.lightAt, maxLit: o.maxLit, onExpire: o.onExpire }; }
function mkAxe(x, ph, v = "axe", o = {}) { return { k: "axe", x, ph, v, T: o.T || 2.1, len: o.len || 38, alive: true, cool: 0, cut: 0, ang: 0, age: 0, hp: 1, warned: false }; }
function mkChand(x, v = "chand") { return { k: "chand", x, v, y: 14, st: "hang", t: 0, age: 0, alive: true, hp: 1, fall: 0, hit: false }; }
function mkDoor(x, hands, v, at) { return { k: "door", x, v, at: at || 46, st: "shut", t: 0, hands, alive: true, knock: 0, hp: 99 }; }
function mkHand(x, by, delay) { return { k: "hand", x, y: by, bx: 0, rel: false, prog: -delay, dur: 3.3, hp: 1, alive: true, dying: 0, grab: false, seed: rnd() * 9 }; }
function mkHead(rx, ry, o = {}) { return { k: "head", rel: true, rx, ry, x0: rx, y0: ry, t: 0, L: o.L || 2.0, hp: 1, spin: rnd() * 6, alive: true, dying: 0, skin: o.skin || "#c9b49a", skull: !!o.skull, web: !!o.web }; }
function mkEyes(rx, ry, dur) { return { k: "eyes", rel: true, rx, ry, t: 0, dur, hp: 2, alive: true, dying: 0, seed: rnd() * 9, late: true }; }
function mkBoss(x) { return { k: "boss", x, eyes: [{ hp: 5, hurt: 0 }, { hp: 5, hurt: 0 }], alive: true, t: 0, spit: 3, dead: 0, hp: 99, age: 0, open: 0.3, bit: false, awake: false, opened: 0, eyeT: 0 }; }
function lensSplat(x, y, r) { G.lens.push({ x: x ?? rand(4, 92), y: y ?? rand(2, 40), r: r ?? rand(1.6, 5), t: 0, drip: rand(2, 9), seed: rnd() * 9 }); if (G.lens.length > 16) G.lens.shift(); }
function blood(x, y, n, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU, sp = rnd() * (o.sp || 12);
    G.parts.push({ x, y, vx: Math.cos(a) * sp + (o.vx || 0), vy: Math.sin(a) * sp - rnd() * 6 + (o.vy || 0), g: o.g ?? 46, life: 0.5 + rnd() * 0.8, t: 0, col: o.col || pick(BLOOD), s: (0.18 + rnd() * 0.34) * (o.sz || 1), w: !!o.w, ch: o.ch && rnd() < 0.3 });
  }
  if (G.parts.length > 700) G.parts.splice(0, G.parts.length - 700);
}
function sparks(x, y, n) { for (let i = 0; i < n; i++) G.parts.push({ x, y, vx: rand(-14, 14), vy: rand(-16, 2), g: 40, life: 0.4 + rnd() * 0.4, t: 0, col: pick(["#fff3a0", "#ffb040", "#ffffff"]), s: 0.16, w: false, sp: true }); }

function die(e, pts, big, quiet) {
  e.dying = 0.0001; e.alive = true; G.kills++;
  award(pts, sx(e), (e.rel ? e.ry : e.y) - 6);
  blood(sx(e), (e.rel ? e.ry : e.y) - 5, big ? 40 : 18, { sp: big ? 24 : 16, sz: big ? 1.5 : 1, ch: true, w: !e.rel });
  if (e.rel && e.sc > 1.1) lensSplat(sx(e), e.ry - 5, rand(2, 4));
  if (!quiet) big ? sfx.gib() : sfx.splat(1.2);
  if (big) { G.shake = 0.7; }
}

function startLunge(e, x) { e.ph = "lunge"; e.pt = 0; e.rel = true; e.rx = x; e.ry = e.y; e.sx0 = x; e.sy0 = e.y; e.sc0 = e.sc || 1; }
K.pop = {
  update(e, dt) {
    e.age += dt; e.flinch -= dt; e.pt += dt;
    if (e.dying) { e.dying += dt; if (e.dying > 0.45) e.alive = false; return; }
    const d = POPS[e.t], bu = e.t === "butcher";
    if (e.orbit && (e.ph === "idle" || e.ph === "rise")) { const o = e.orbit, th = o.ph + G.clock * o.w; e.x = o.cx + o.R * Math.cos(th); e.y = STAGE - 1.5 - Math.abs(Math.sin(e.age * 5)) * 0.8; e.sc = 0.8 + 0.35 * Math.sin(th); }
    const x = sx(e);
    if (e.ph === "hid") {
      if (e.x - G.p < e.trig) {
        if (bu) { e.ph = "glitch"; e.pt = 0; sfx.stab(); sfx.sparks(); }
        else { e.ph = "rise"; e.pt = 0; if (e.t === "bat") sfx.batFlap(); else sfx.pop(); if (e.t === "ghoul" || e.t === "headless") sfx.creak(); if (e.t === "wax") sfx.waxMelt(); if (e.t === "bride") { sfx.stab(); sfx.scream(500, 1, 0.12); } }
      }
    } else if (e.ph === "rise") { if (e.pt > 0.45) { e.ph = "idle"; e.pt = 0; } }
    else if (e.ph === "glitch") {
      if (rnd() < dt * 14) { sparks(x + rand(-1.5, 1.5), STAGE - 9, 4); }
      if (rnd() < dt * 3.2) sfx.sparks();
      if (e.pt > 1.5) { startLunge(e, x); sfx.growl(); }
    }
    else if (e.ph === "idle") {
      if (e.pt > e.wait || x < CAR_X + 24) { startLunge(e, x); if (e.t === "skeleton") sfx.clank(); else if (e.t === "spiderling") sfx.spiderlingSkitter(); else if (e.t === "hound" || e.t === "bat") sfx.snap(); else if (e.t === "horse") sfx.horseGallop(); else sfx.growl(); }
    } else if (e.ph === "lunge") {
      const u = clamp(e.pt / e.L, 0, 1), k = Math.pow(u, 1.5);
      e.rx = lerp(e.sx0, CAR_X + 5.5, k); e.ry = lerp(e.sy0, e.t === "hound" ? 40 : e.t === "spiderling" ? 38.5 : 41.5, k) - Math.sin(u * Math.PI * (e.t === "skeleton" || e.t === "hound" || e.t === "spiderling" ? 3 : 1.5)) * 1.8;
      if (e.t === "bat") e.ry = lerp(e.sy0, 38, k) - Math.sin(u * 9) * 2;
      e.sc = lerp(e.sc0, e.t === "spiderling" ? 1.3 : 1.6, k);
      if (u >= 1) {
        if (d.swing) { e.ph = "atk"; e.pt = 0; e.swings = 0; e.atk = 0; G.duckWarn = 1.2; sfx.whoosh(); }
        else { G.missed++; hurt("ridegrab"); sfx.snap(); e.alive = false; blood(CAR_X + 3, 40, 14, { sp: 16 }); if (e.t === "bride") { sfx.scream(700, 1, 0.2); lensSplat(); lensSplat(); } }
      }
    } else if (e.ph === "atk") {
      // a windup, a swing and a recovery, a few times, then he is left behind
      e.sc = 1.6; e.rx = CAR_X + 5.5 + Math.sin(e.pt * 5) * 0.4; e.ry = 41.5;
      const f = (d.cyc || 1.7) / 1.7 * (e.boss && e.hp <= e.maxhp / 2 ? 0.75 : 1), T = e.pt / f;
      if (T < 0.8) { e.atk = ease(T / 0.8) * -1; G.duckWarn = Math.max(G.duckWarn, 0.2); }
      else if (T < 0.95) { e.atk = lerp(-1, 1, ease((T - 0.8) / 0.15)); if (!e.swung) { e.swung = true; sfx.chop(); if (!G.ducked && G.clock - G.duckAt > 0.12) { hurt("ridecleaver"); } else { sfx.clank(); G.ducksOK++; } } }
      else if (T < 1.7) { e.atk = lerp(1, 0, ease((T - 0.95) / 0.5)); }
      else { e.swings++; e.swung = false; e.pt = 0; sfx.whoosh(); if (e.swings >= (d.nSw || 3)) { e.ph = "leave"; e.pt = 0; G.missed++; } }
    } else if (e.ph === "leave") {
      e.rx -= dt * 14; e.sc = Math.max(0.7, e.sc - dt * 0.5); if (e.rx < -10) e.alive = false;
    }
  },
  rect(e) { const d = POPS[e.t], s = d.s * (e.sc || 1), x = sx(e), y = e.rel ? e.ry : e.y, bs = d.beast, hh = bs ? (e.t === "horse" ? 9 : e.t === "hound" ? 8.5 : e.t === "spiderling" ? 7 : 6.5) : 10.8; return { x: x - (bs ? 3.8 : 2.8) * s - 0.9, y: y - hh * s - 0.9, w: (bs ? 7.6 : 5.6) * s + 1.8, h: hh * s + 1.8 }; },
  hit(e, mx, my) {
    if (e.dying || e.ph === "hid" || e.ph === "rise" || (e.t === "butcher" && e.ph === "hid")) return false;
    const r = K.pop.rect(e); return mx > r.x && mx < r.x + r.w && my > r.y && my < r.y + r.h;
  },
  onHit(e, mx, my) {
    const squash = e.t === "spiderling";
    e.hp--; e.flinch = 0.14; blood(mx, my, 10, { sp: 14, w: !e.rel }); if (!squash) sfx.splat(0.6); lensSplatMaybe(e);
    if (e.ph === "idle" || e.ph === "glitch") e.pt = Math.max(0, e.pt - 0.15);
    if (e.hp <= 0) {
      const early = e.ph === "idle" || e.ph === "glitch", big = e.t === "butcher" || e.t === "host" || e.boss || e.t === "bride";
      die(e, POPS[e.t].pts + (early ? 100 : 0), big, squash);
      const cry = big ? 300 : rand(500, 900); // drawn either way, so the ride's stream is the same
      if (squash) sfx.spiderlingDie(); else if (big) sfx.scream(cry, 0.9, 0.18); else sfx.scream(cry, 0.45, 0.1);
      if (e.boss) bossDown(e.boss, sx(e), e.ry);
    }
  },
};
function lensSplatMaybe(e) { if (e.rel && (e.sc || 1) > 1.25 && rnd() < 0.5) lensSplat(sx(e) + rand(-4, 4), e.ry - rand(2, 9), rand(1, 2.6)); }
K.lant = {
  update(e, dt) {
    e.age += dt;
    if (e.dying) { e.dying += dt; if (e.dying > 0.3) e.alive = false; return; }
    const x = X(e.x);
    if (!e.lit && e.x - G.p < (e.lightAt || 56) && x > 14) { e.delay -= dt; if (e.delay <= 0) { e.lit = true; e.lt = 0; if (e.v === "bubble") sfx.bubblesRise(); else sfx.ding(); } }
    if (e.lit) { e.lt += dt; const to = e.maxLit && e.lt > e.maxLit; if (x < 6 || to) { e.lit = false; G.missed++; if (to && e.onExpire) e.onExpire(e); e.alive = to ? false : e.x - G.p > -30; } }
    if (e.x - G.p < -30) e.alive = false;
  },
  hit(e, mx, my) { if (!e.lit || e.dying) return false; const x = X(e.x), cy = e.y + 1.8; return (mx - x) ** 2 + (my - cy) ** 2 < 4.8 * 4.8; },
  onHit(e, mx, my) { const x = X(e.x); die(e, e.lt < 1.2 ? 200 : 100, false, e.v === "jar"); if (e.v === "jar") sfx.jarCrack(); blood(x, e.y + 2, 12, { sp: 14, w: true }); e.dying = 0.0001; },
};

K.axe = {
  update(e, dt) {
    e.age += dt; e.cool -= dt;
    const x = X(e.x);
    if (e.cut) { e.cut += dt; if (e.cut > 1.2) e.alive = false; return; }
    e.ang = 0.9 * Math.sin(e.age * TAU / e.T + e.ph);
    const tx = x + e.len * Math.sin(e.ang), ty = -1 + e.len * Math.cos(e.ang);
    e.tx = tx; e.ty = ty;
    const vel = Math.cos(e.age * TAU / e.T + e.ph);
    if (x < CAR_X + 34 && x > CAR_X - 6) {
      const nearC = Math.abs(tx - CAR_X) < 12 && ty > 34;
      if (nearC) G.duckWarn = Math.max(G.duckWarn, 0.25);
    }
    if (Math.abs(tx - CAR_X) < 3.4 && ty > 36 && e.cool <= 0 && Math.abs(vel) > 0.15) {
      if (!G.ducked && G.clock - G.duckAt > 0.1) { hurt("rideblade"); e.cool = 1.4; blood(CAR_X, 38, 8, { sp: 10 }); sfx.chop(); } else { e.cool = 0.7; sfx.whoosh(); G.ducksOK++; }
    }
    if (e.age % e.T < dt && x > 0 && x < W) { if (e.v === "hoop") sfx.clownHoop(); else sfx.whoosh(); }
    if (x < -40) e.alive = false;
  },
  hit(e, mx, my) { if (e.cut || e.tx == null) return false; return (mx - e.tx) ** 2 + (my - (e.ty + 0.5)) ** 2 < 4.6 * 4.6; },
  onHit(e, mx, my) { e.cut = 0.0001; award(150, mx, my - 3); sparks(mx, my, 14); sfx.clank(); sfx.clank(); },
};

K.chand = {
  update(e, dt) {
    e.age += dt; const x = X(e.x);
    if (e.st === "hang") {
      if (x < CAR_X + 30 && !e.warned) { e.warned = true; sfx.creak(); sfx.creak(); }
      if (x < CAR_X + 13) { e.st = "warn"; e.t = 0; sfx.clank(); }
    } else if (e.st === "warn") {
      e.t += dt; G.duckWarn = Math.max(G.duckWarn, 0.2); if (rnd() < dt * 12) sparks(x + rand(-3, 3), 8, 3);
      if (e.t > 0.85) { e.st = "fall"; e.t = 0; sfx.whoosh(); }
    } else if (e.st === "fall") {
      e.t += dt; e.fall = e.t * e.t * 46;
      if (e.t > 0.5) {
        e.st = "crash"; e.t = 0; sfx.bang(); sfx.clank(); G.shake = 0.9; G.flash = 0.5; G.flashCol = "#ffb040";
        sparks(x, STAGE, 40); blood(x, STAGE - 2, 14, { sp: 20, w: true });
        if (Math.abs(x - CAR_X) < 14) { if (!G.ducked) hurt("ridecrash"); else G.ducksOK++; }
        killNear(e.x, 15, false);
      }
    } else if (e.st === "shot") {
      e.t += dt; e.fall = e.t * e.t * 52;
      if (e.t > 0.5) { e.st = "crash"; e.t = 0; sfx.bang(); sfx.clank(); G.shake = 0.9; sparks(x, STAGE, 40); killNear(e.x, 20, true); award(500, x, STAGE - 12); }
    } else if (e.st === "crash") { e.t += dt; if (e.t > 8) e.alive = false; }
    if (x < -40) e.alive = false;
  },
  hit(e, mx, my) { if (e.st !== "hang" && e.st !== "warn") return false; const x = X(e.x); return Math.abs(mx - x) < 2.6 && my > 0 && my < 11 || (mx - x) ** 2 + (my - 14) ** 2 < 4.6 * 4.6; },
  onHit(e) { e.st = "shot"; e.t = 0; sfx.clank(); sfx.whoosh(); sparks(X(e.x), 6, 16); },
};
function killNear(wx, r, glorious) {
  for (const o of G.ents) if (o.k === "pop" && !o.rel && Math.abs(o.x - wx) < r && !o.dying && o.ph !== "lunge" && o.ph !== "atk") {
    if (o.ph === "hid" && !o.slump) continue;
    o.hp = 0; o.ph = "idle"; die(o, glorious ? 150 : 0, false);
  }
}

K.door = {
  update(e, dt) {
    const x = X(e.x);
    if (e.st === "shut") {
      if (x < CAR_X + 66 && rnd() < dt * 1.6) { e.knock = 0.2; if (x > 10 && x < 90) sfx.thump(); }
      e.knock -= dt;
      if (x < CAR_X + e.at) { e.st = "open"; e.t = 0; sfx.bang(); sfx.scream(rand(300, 460), 0.9, 0.15); G.shake = 0.8; G.flash = 0.6; G.flashCol = "#ff4030"; lensSplat(); for (let i = 0; i < e.hands; i++) G.ents.push(mkHand(e.x, STAGE - 14 + i * 3.5, i * 0.5)); blood(x, STAGE - 8, 16, { sp: 14, w: true }); }
    } else e.t += dt;
    if (x < -30) e.alive = false;
  },
  hit() { return false },
};

K.hand = {
  update(e, dt) {
    e.bx = X(e.x);
    if (e.dying) { e.dying += dt; if (e.dying > 0.4) e.alive = false; return; }
    e.prog += dt / e.dur;
    if (e.prog >= 1 && !e.grab) { e.grab = true; hurt("ridehand"); sfx.snap(); blood(CAR_X + 3, 40, 12, { sp: 12 }); lensSplat(); e.dying = 0.0001; }
    if (e.bx < -20) e.alive = false;
  },
  tip(e) { const k = Math.pow(clamp(e.prog, 0, 1), 1.4), bx = e.rel ? e.rx : e.bx; return { x: lerp(bx, CAR_X + 3, k), y: lerp(e.y, 39, k) + Math.sin(G.clock * 7 + e.seed) * 0.5 * (1 - k), k }; },
  hit(e, mx, my) { if (e.prog < 0 || e.dying) return false; const t = K.hand.tip(e); return (mx - t.x) ** 2 + (my - t.y) ** 2 < (4 + t.k * 1.5) ** 2; },
  onHit(e, mx, my) { const t = K.hand.tip(e); die(e, 120 + (e.prog < 0.5 ? 80 : 0), false); blood(t.x, t.y, 14, { sp: 14 }); sfx.scream(rand(700, 1000), 0.3, 0.08); },
};

K.head = {
  update(e, dt) {
    if (e.dying) { e.dying += dt; if (e.dying > 0.3) e.alive = false; return; }
    e.t += dt; const u = clamp(e.t / e.L, 0, 1);
    e.rx = lerp(e.x0, CAR_X + 1, u); e.ry = lerp(e.y0, 40, u * u) - Math.sin(u * Math.PI) * 8; e.sc = lerp(0.5, 1.5, u);
    if (rnd() < dt * 20) blood(e.rx, e.ry, 1, { sp: 3, g: 30 });
    if (u >= 1) { G.missed++; hurt("ridehead"); sfx.snap(); lensSplat(); blood(CAR_X, 40, 12, { sp: 14 }); e.alive = false; }
  },
  hit(e, mx, my) { return !e.dying && (mx - e.rx) ** 2 + (my - e.ry) ** 2 < (2.4 * e.sc + 1.8) ** 2; },
  onHit(e, mx, my) { die(e, 150, false); sfx.scream(rand(900, 1300), 0.25, 0.07); },
};

K.eyes = {
  update(e, dt) {
    if (e.dying) { e.dying += dt; if (e.dying > 0.35) e.alive = false; return; }
    e.t += dt; e.sc = lerp(0.7, 2.6, Math.pow(e.t / e.dur, 1.6));
    if (e.t >= e.dur) { G.missed++; hurt("rideeyes"); sfx.snap(); sfx.scream(300, 0.5, 0.15); e.alive = false; lensSplat(e.rx, e.ry, 5); }
  },
  hit(e, mx, my) { return !e.dying && (mx - e.rx) ** 2 + (my - e.ry) ** 2 < (3.2 * e.sc + 2) ** 2; },
  onHit(e, mx, my) { e.hp--; blood(e.rx, e.ry, 8, { sp: 10, g: 20 }); sfx.splat(0.6); if (e.hp <= 0) { die(e, 200, false); sfx.scream(rand(200, 330), 0.5, 0.1); } else e.t = Math.max(0, e.t - 0.7); },
};

K.boss = {
  update(e, dt) {
    e.age += dt; const x = X(e.x);
    const dead = e.eyes[0].hp <= 0 && e.eyes[1].hp <= 0;
    for (const ey of e.eyes) ey.hurt -= dt;
    if (dead && !e.dead) { e.dead = 0.0001; G.bossDead = true; G.score += 2000; G.floats.push({ s: "+2000", x: x, y: 20, t: 0 }); G.shake = 1.4; G.flash = 0.8; G.flashCol = "#ffffff"; sfx.barkerDie(); blood(x, 18, 80, { sp: 30, sz: 1.6, ch: true }); for (let i = 0; i < 3; i++) lensSplat(); }
    if (e.dead) { e.dead += dt; e.open = lerp(e.open, 1, dt * 2); return; }
    if (!e.awake && x < W + 24) { e.awake = true; G.shake = 0.8; }
    // His two eyes roll open one after the other (0.4 s apart).
    if (e.awake && e.opened < 2) { e.eyeT += dt; if (e.eyeT >= e.opened * 0.4) { e.opened++; sfx.barkerEye(); } }
    e.open = 0.45 + 0.25 * Math.sin(e.age * 1.3) + (e.spit < 0.5 ? 0.3 : 0);
    if (e.awake && x < W + 10 && x > CAR_X - 4) {
      e.spit -= dt;
      if (e.spit <= 0) {
        e.spit = rand(2.0, 2.8); sfx.barkerSpit();
        const mx = x, my = 40;
        if (rnd() < 0.55) G.ents.push(mkHead(mx - 6, my - 4, { L: 2.5, skull: rnd() < 0.5 }));
        else { const h = mkHand(e.x - 3, 30, 0); h.dur = 3.3; G.ents.push(h); }
      }
    }
    if (x < CAR_X + 3 && !e.bit && !dead) { e.bit = true; hurt("ridemouth"); sfx.barkerBite(); G.shake = 1; }
  },
  hit(e, mx, my) { if (e.dead) return false; const x = X(e.x); for (let i = 0; i < 2; i++) { if (e.eyes[i].hp <= 0) continue; const ex = x + (i ? 10 : -10); if ((mx - ex) ** 2 + (my - 16) ** 2 < 6.4 * 6.4) { e.pick = i; return true; } } return false; },
  onHit(e, mx, my) { const ey = e.eyes[e.pick]; ey.hp--; ey.hurt = 0.18; blood(mx, my, 12, { sp: 16, sz: 1.2 }); sfx.splat(1); sfx.scream(110, 0.5, 0.12); award(ey.hp <= 0 ? 600 : 80, mx, my - 4); if (ey.hp <= 0) { blood(mx, my, 40, { sp: 22, sz: 1.4, ch: true }); sfx.gib(); lensSplat(); G.shake = 0.6; } },
};

/* ---- innocents: do not shoot ---- */
function mkInno(x, v = "kid") { return { k: "inno", x, y: STAGE, v, bad: rnd() < 0.5, hp: 1, alive: true, dying: 0, age: rnd() * 9 }; }
K.inno = {
  update(e, dt) { e.age += dt; if (e.dying) { e.dying += dt; if (e.dying > 0.5) e.alive = false; return; } if (X(e.x) < -12) e.alive = false; },
  hit(e, mx, my) { const x = X(e.x); return !e.dying && Math.abs(mx - x) < 2.6 && my > STAGE - 9 && my < STAGE + 0.6; },
  onHit(e, mx, my) { G.innoHits++; G.combo = 0; G.score = Math.max(0, G.score - 300); G.floats.push({ s: "-300 OOPS", x: X(e.x), y: STAGE - 11, t: 0 }); sfx.oops(); e.dying = 0.0001; G.shake = 0.3; blood(X(e.x), STAGE - 4, 10, { sp: 10, w: true }); G.hits--; },
};

/* ---- the hall of mirrors: reflections cannot be shot ---- */
const MIR_SP = 12.5;
function mkMir(x, n, reals) { return { k: "mir", x, n, reals, pops: [], cracked: new Array(n).fill(false), hp: 99, alive: true, age: 0, spawned: false, done: false, shat: 0, pick: 0 }; }
function mirRect(e, i) { const px = X(e.x) + (i - (e.n - 1) / 2) * MIR_SP; return { x: px - 4.6, y: STAGE - 25, w: 9.2, h: 25, cx: px }; }
K.mir = {
  update(e, dt) {
    e.age += dt; const x = X(e.x);
    if (!e.spawned && x < CAR_X + 62) { e.spawned = true; e.reals.forEach((ri, j) => { const p = mkPop("ghoul", e.x + (ri - (e.n - 1) / 2) * MIR_SP, { trig: 1e9 }); p.ph = "idle"; p.wait = 1.3 + j * 0.5; p.pt = 0; e.pops.push(p); G.ents.push(p); }); sfx.mirrorGhoul(); }
    if (e.spawned && !e.done && e.pops.every((p) => !p.alive || p.ph === "lunge" && p.pt > 0.6)) { e.done = true; e.shat = 0.0001; }
    if (e.shat) { e.shat += dt; if (e.shat < 0.1) { sfx.glass(); blood(x, STAGE - 12, 10, { sp: 12, col: "#cfe8ff", w: true }); } }
    if (x < -50) e.alive = false;
  },
  hit(e, mx, my) { if (!e.spawned || e.done) return false; for (let i = 0; i < e.n; i++) { if (e.reals.includes(i) || e.cracked[i]) continue; const r = mirRect(e, i); if (mx > r.x && mx < r.x + r.w && my > r.y && my < r.y + r.h) { e.pick = i; return true; } } return false; },
  onHit(e, mx, my) { e.cracked[e.pick] = true; sfx.glass(); G.combo = 0; G.hits--; G.score = Math.max(0, G.score - 150); G.floats.push({ s: "-150 DECOY", x: mx, y: my - 3, t: 0 }); G.shake = 0.3; blood(mx, my, 14, { sp: 14, col: "#cfe8ff" }); for (const p of e.pops) if (p.alive && p.ph === "idle") p.wait = Math.min(p.wait, p.pt + 0.4); },
};

/* ---- a web across the rail: cut it or be stuck ---- */
function mkWeb(x, y = 26) { return { k: "web", x, y, hp: 3, alive: true, st: "up", t: 0, age: 0 }; }
K.web = {
  update(e, dt) {
    e.age += dt; const x = X(e.x); e.t += dt;
    if (e.st === "up" && x < CAR_X + 3.5) { e.st = "stuck"; e.t = 0; G.stuck = 2.0; G.combo = 0; sfx.web(); for (let i = 0; i < 3; i++) { const p = mkPop("spiderling", e.x + 3 + i * 1.5, { trig: 1e9 }); p.ph = "idle"; p.wait = 0.2 + i * 0.5; p.y = e.y + 12; G.ents.push(p); } }
    if (e.st === "stuck" && e.t > 2.0) { e.st = "torn"; e.t = 0; sfx.snap(); }
    if ((e.st === "cut" || e.st === "torn") && e.t > 1.2) e.alive = false;
    if (x < -30) e.alive = false;
  },
  hit(e, mx, my) { return e.st === "up" && (mx - X(e.x)) ** 2 + (my - e.y) ** 2 < 7 * 7; },
  onHit(e, mx, my) { e.hp--; sfx.snap(); sparks(mx, my, 6); blood(mx, my, 5, { sp: 8, col: "#e8e8f0", g: 10 }); if (e.hp <= 0) { e.st = "cut"; e.t = 0; award(250, mx, my - 3); sfx.web(); G.hp = G.hp; } },
};

/* ---- mini-bosses ---- */
function bossDown(name, x, y) { healHeart(); G.floats.push({ s: "+1 HEART", x: CAR_X + 8, y: 36, t: 0 }); sfx.heal(); G.flash = 0.6; G.flashCol = "#ffffff"; G.shake = 1.2; G.bossesDown++; }
function bossActive() { return G.ents.some((e) => e.boss && e.alive && !e.dying && (e.k === "mini" ? e.active && !e.dead : e.ph !== "hid")); }
function mkMini(id, x) {
  const d = MINI[id];
  return { k: "mini", id, x, y: 24, boss: d.name, spots: d.spots.map((s) => ({ hp: s.hp, max: s.hp, r: s.r, hurt: 0, x: 0, y: 0 })), alive: true, active: false, dead: 0, age: 0, st: "idle", t: 0, cd: 1.6, n: 0, hx: 0, hy: 0, pick: 0, hp: 1, maxhp: d.spots.reduce((a, s) => a + s.hp, 0), hitDone: false };
}
const miniHp = (e) => e.spots.reduce((a, s) => a + Math.max(0, s.hp), 0);
K.mini = {
  update(e, dt) {
    e.age += dt; e.hp = miniHp(e); const x = X(e.x);
    for (const sp of e.spots) sp.hurt -= dt;
    if (e.dead) { e.dead += dt; if (e.dead > 3) e.alive = false; return; }
    if (!e.active) { if (x < CAR_X + 66) { e.active = true; e.st = "idle"; sfx.roar(); G.shake = 0.9; } else { MINI[e.id].upd(e, 0, x); return; } }
    MINI[e.id].upd(e, dt, x);
    if (x < -30) { e.alive = false; G.missed += 3; }
  },
  hit(e, mx, my) { if (!e.active || e.dead) return false; for (let i = 0; i < e.spots.length; i++) { const s = e.spots[i]; if (s.hp > 0 && (mx - s.x) ** 2 + (my - s.y) ** 2 < (s.r + 1.8) ** 2) { e.pick = i; return true; } } return false; },
  onHit(e, mx, my) {
    const s = e.spots[e.pick]; s.hp--; s.hurt = 0.16; blood(mx, my, 8, { sp: 14, sz: 1.2 }); sfx.splat(0.8); sfx.hit(); award(s.hp <= 0 ? 400 : 60, mx, my - 3);
    if (s.hp <= 0) { blood(mx, my, 40, { sp: 22, sz: 1.5, ch: true }); sfx.gib(); lensSplat(); G.shake = 0.6; if (MINI[e.id].spotDown) MINI[e.id].spotDown(e, e.pick, X(e.x)); }
    if (miniHp(e) <= 0) { e.dead = 0.0001; die(e, 3000, true); bossDown(e.boss, mx, my); if (e.id === "swan") sfx.swanDie(); else if (e.id === "spider") sfx.widowDie(); else sfx.roar(); for (let i = 0; i < 3; i++) lensSplat(); }
  },
};
const MINI = {
  swan: {
    name: "THE BLACK SWAN", spots: [{ hp: 10, r: 3.3 }],
    upd(e, dt, x) {
      e.t += dt; const half = e.spots[0].hp < 5, bx = x - 14;
      if (!e.active) { e.hx = bx; e.hy = 30; e.spots[0].x = -99; return; }
      if (e.st === "idle") { e.hx = bx + Math.sin(e.age * 1.3) * 2.5; e.hy = 15 + Math.sin(e.age * 1.9) * 1.8; e.cd -= dt; if (e.cd <= 0) { e.n++; e.t = 0; if (e.n % 3 === 0) { e.st = "spit"; sfx.growl(); } else { e.st = "warn"; sfx.creak(); G.duckWarn = 1.1; } } }
      else if (e.st === "warn") { const u = ease(e.t / (half ? 0.7 : 0.95)); e.hx = lerp(bx, x - 2, u); e.hy = lerp(15, 7, u); G.duckWarn = Math.max(G.duckWarn, 0.2); if (e.t > (half ? 0.7 : 0.95)) { e.st = "strike"; e.t = 0; sfx.swanPeck(); } }
      else if (e.st === "strike") { const u = ease(e.t / 0.22); e.hx = lerp(x - 2, CAR_X + 2, u); e.hy = lerp(7, 41, u); if (e.t >= 0.22 && !e.hitDone) { e.hitDone = true; sfx.snap(); G.shake = 0.6; if (!G.ducked && G.clock - G.duckAt > 0.1) hurt(1); else { G.ducksOK++; sfx.clank(); } blood(CAR_X + 2, 42, 10, { sp: 10 }); sfx.splash(); } if (e.t > 0.6) { e.st = "rec"; e.t = 0; e.hitDone = false; } }
      else if (e.st === "rec") { const u = ease(e.t / 0.9); e.hx = lerp(CAR_X + 2, bx, u); e.hy = lerp(41, 15, u); if (e.t > 0.9) { e.st = "idle"; e.cd = rand(1.5, 2.1) * (half ? 0.85 : 1); } }
      else if (e.st === "spit") { e.hx = bx; e.hy = 13; if (e.t > 0.7 && !e.sp) { e.sp = true; G.ents.push(mkHead(e.hx - 3, e.hy + 3, { L: 2.3, skull: true })); sfx.swanSpit(); } if (e.t > 1.2) { e.sp = false; e.st = "idle"; e.cd = rand(1.1, 1.6); } }
      e.spots[0].x = e.hx - 2.0; e.spots[0].y = e.hy - 0.8;
    },
  },
  spider: {
    name: "THE WIDOW", spots: [{ hp: 7, r: 3.6 }, { hp: 4, r: 5.2 }],
    upd(e, dt, x) {
      e.t += dt; const half = miniHp(e) < 5;
      if (!e.active) { e.hx = x; e.hy = 16; e.spots[0].x = e.spots[1].x = -99; return; }
      if (e.st === "idle") { e.hx = x + Math.sin(e.age * 0.9) * 3; e.hy = 17 + Math.sin(e.age * 1.5) * 1.5; e.cd -= dt; if (e.cd <= 0) { e.n++; e.t = 0; if (e.n % 3 === 0) { e.st = "warn"; sfx.creak(); G.duckWarn = 1.2; } else { e.st = "spit"; sfx.web(); } } }
      else if (e.st === "spit") { if (e.t > 0.5 && !e.sp) { e.sp = true; G.ents.push(mkHead(e.hx - 7, e.hy + 1, { L: 2.4, web: true })); sfx.pop(); } if (e.t > 0.9) { e.sp = false; e.st = "idle"; e.cd = rand(1.6, 2.2) * (half ? 0.85 : 1); } }
      else if (e.st === "warn") { const u = ease(e.t / 0.95); e.hx = lerp(x, x - 1, u); e.hy = lerp(17, 8, u); G.duckWarn = Math.max(G.duckWarn, 0.2); if (e.t > 0.95) { e.st = "strike"; e.t = 0; sfx.widowFang(); } }
      else if (e.st === "strike") { const u = ease(e.t / 0.22); e.hx = lerp(x - 1, CAR_X + 8, u); e.hy = lerp(8, 36, u); if (e.t >= 0.22 && !e.hitDone) { e.hitDone = true; sfx.snap(); G.shake = 0.6; if (!G.ducked && G.clock - G.duckAt > 0.1) hurt(1); else { G.ducksOK++; sfx.clank(); } blood(CAR_X + 3, 40, 10, { sp: 10, col: "#8dff4a" }); } if (e.t > 0.6) { e.st = "rec"; e.t = 0; e.hitDone = false; } }
      else if (e.st === "rec") { const u = ease(e.t / 1.0); e.hx = lerp(CAR_X + 8, x, u); e.hy = lerp(36, 17, u); if (e.t > 1.0) { e.st = "idle"; e.cd = rand(1.2, 1.7); } }
      e.spots[0].x = e.hx - 4.6; e.spots[0].y = e.hy + 0.2; e.spots[1].x = e.hx + 4.8; e.spots[1].y = e.hy + 1.2;
    },
    spotDown(e, i, x) { if (i === 1) { sfx.scream(200, 0.8, 0.15); for (let k = 0; k < 5; k++) { const p = mkPop("spiderling", e.x + 4 + k, { trig: 1e9 }); p.ph = "idle"; p.wait = 0.1 + k * 0.35; p.x = e.x; p.y = e.hy + 4; G.ents.push(p); } blood(e.spots[1].x, e.spots[1].y, 40, { sp: 24, sz: 1.5, col: "#8dff4a", ch: true }); } },
  }
};
function updateStall(dt) {
  const s = G.stall, p = G.p;
  if (s.st === 0 && !s.done && p >= DARK_A + 3) { s.st = 1; sfx.stop(); G.jolt = 0.4; }
  if (s.st === 1) { if (G.v < 0.4) { s.st = 2; s.t = 0; G.v = 0; sfx.lights(false); sfx.low(); } }
  if (s.st === 2) {
    s.t += dt; G.dark = lerp(G.dark, 1, Math.min(1, dt * 2.4));
    if (s.t > 0.4 && !s.b1) { s.b1 = true; sfx.breath(0.5); }
    const times = [0.9, 1.6, 2.2, 2.8];
    while (s.n < times.length && s.t >= times[s.n]) {
      let x, y, ok, tries = 0;
      do { x = rand(30, 90); y = rand(7, 36); ok = G.ents.every((e) => e.k !== "eyes" || !e.alive || Math.hypot(e.rx - x, e.ry - y) > 14); tries++; } while (!ok && tries < 12);
      const ey = mkEyes(x, y, 2.4 - s.n * 0.08); if (s.n < 2) ey.hp = 1; G.ents.push(ey); sfx.breath(0.35); sfx.stallEyes(); s.n++;
    }
    if (s.t > 2.9 && !s.b2) { s.b2 = true; sfx.heart(); }
    if (s.t > 3.0 && !s.b3) { s.b3 = true; s.giant = 0.01; sfx.breath(1.2); }
    if (s.giant > 0) s.giant = Math.min(1, s.giant + dt * 1.2);
    if (s.t > 3.0 && Math.floor(s.t * 2) !== Math.floor((s.t - dt) * 2) && s.t < 4.2) sfx.heart();
    if (s.t > 3.5 && !s.b4) { s.b4 = true; s.tell = 1; sfx.roar(); G.duckWarn = 1.2; }
    if (s.tell > 0) { s.tell += dt; G.duckWarn = Math.max(G.duckWarn, 0.2); }
    if (s.t > 4.4 && !s.b5) { s.b5 = true; s.slam = 0.0001; sfx.stallJaws(); G.shake = 1.2; if (!G.ducked) { hurt("ridejaws"); } else { sfx.clank(); } lensSplat(CAR_X, 30, 6); lensSplat(CAR_X + 8, 28, 4); }
    if (s.slam > 0) s.slam += dt;
    if (s.t > 5.1 && !s.done) { s.done = true; s.st = 3; s.tell = 0; s.giant = 0; s.slam = 0; G.v = 13; G.jolt = 0.6; sfx.lights(true); sfx.stab(); G.flash = 0.9; G.flashCol = "#ffffff"; }
  }
  if (s.st === 3) { G.dark = lerp(G.dark, 0, Math.min(1, dt * 6)); if (G.dark < 0.02) { G.dark = 0; s.st = 4; } }
}


/* --------------------------------------------------------------- scenes */

// A spawn row of a scene's table (ghoul-ride-scenes.js) made into things on the
// field, `o` the scene's shift from its author coordinates to the ride's.
const range = (w) => (Array.isArray(w) ? rand(w[0], w[1]) : w);
function make(row, o) {
  const E = G.ents;
  const kind = row[0];
  if (kind === "lant") {
    const [, l, y, v, delay = 0, op = {}] = row;
    const opt = { lightAt: op.lightAt, maxLit: op.maxLit };
    if (op.expire === "hand") {
      opt.onExpire = (e) => {
        const h = mkHand(e.x, e.y + 2, 0);
        h.dur = 1.8;
        G.ents.push(h);
        sfx.bubblesHands();
      };
    }
    E.push(mkLant(o + l, y, v, delay, opt));
  } else if (kind === "pop") {
    const [, t, l, op = {}] = row;
    const opt = { trig: op.trig, stand: op.stand, slump: op.slump, burn: op.burn, boss: op.boss };
    if (op.y !== undefined) opt.y = op.y;
    if (op.dy !== undefined) opt.y = STAGE + op.dy;
    if (op.wait !== undefined) opt.wait = range(op.wait);
    if (op.orbit) opt.orbit = { ...op.orbit, cx: o + op.orbit.cx };
    E.push(mkPop(t, o + l, opt));
  } else if (kind === "inno") {
    const [, l, v, op = {}] = row;
    E.push(mkInno(o + l + (op.jitter ? rand(0, op.jitter) : 0), op.pick ? pick(op.pick) : v));
  } else if (kind === "door") E.push(mkDoor(o + row[1], row[2], row[3], row[4]));
  else if (kind === "axe") E.push(mkAxe(o + row[1], row[2], row[3], row[4]));
  else if (kind === "chand") E.push(mkChand(o + row[1], row[2]));
  else if (kind === "mir") E.push(mkMir(o + row[1], row[2], row[3]));
  else if (kind === "web") E.push(mkWeb(o + row[1], row[2]));
  else if (kind === "mini") E.push(mkMini(row[1], o + row[2]));
  else if (kind === "boss") {
    G.boss = mkBoss(row[1] + o);
    E.push(G.boss);
  }
}
// Scenes spawn when the car is 125 away from their start.
function ensureSpawn() {
  for (let i = 0; i < SCENES.length; i++) {
    const s = SCENES[i];
    if (!G.sp[i] && G.p + 125 > s.a) {
      G.sp[i] = true;
      for (const row of s.spawn) make(row, s.sh);
    }
  }
}

// How fast each room that is not a flat number wants the car to go, by the
// author coordinate `l` under the car.
const SPEEDS = {
  bay: (l) => (l < 14 ? 6 + 0.5 * l : 9),
  torture: () => (bossActive() ? 5 : 8.5),
  tunnel: () => (bossActive() ? 4.4 : 7.5),
  web: () => (bossActive() ? 4.4 : 7.5),
  lift: () => {
    const st = G.st.lift || { ph: "climb" };
    return st.ph === "climb" ? 5 : st.ph === "top" ? 0.4 : st.ph === "drop" ? 16 : 9;
  },
  barker: (l) => (l < 84 ? (G.bossDead ? 11 : 5.2) : l >= 132 ? 0 : l >= 118 ? 6 : 9),
};
const ACCEL = { lift: () => (G.st.lift && G.st.lift.ph === "drop" ? 40 : 14) };
// What a room does as the car rolls through it (`l` the author coordinate).
const TICKS = {
  bay(dt, l) {
    if (!G.doorDone && l > 21) {
      G.doorDone = true;
      G.doorOpen = 0.0001;
      sfx.bang();
      sfx.scream(380, 0.7, 0.14);
      G.shake = 0.7;
      G.flash = 0.6;
      G.flashCol = "#ffd0a0";
    }
  },
  lift(dt, l) {
    const st = G.st.lift || (G.st.lift = { ph: "climb", t: 0, k: 0, h: 0 });
    if (st.ph === "climb") {
      G.tilt = lerp(G.tilt, -0.26, dt * 3);
      const k = Math.floor(G.p / 1.7);
      if (k !== st.k) {
        st.k = k;
        sfx.tick();
      }
      if (l >= 36) {
        st.ph = "top";
        st.t = 0;
        sfx.carJump();
      }
    } else if (st.ph === "top") {
      st.t += dt;
      G.tilt = lerp(G.tilt, -0.03, dt * 3);
      if (st.t > 0.4 && st.h === 0) {
        st.h = 1;
        sfx.heart();
      }
      if (st.t > 1.0 && st.h === 1) {
        st.h = 2;
        sfx.heart();
      }
      if (st.t > 1.5) {
        st.ph = "drop";
        st.t = 0;
        sfx.carDrop();
        G.shake = 1;
      }
    } else if (st.ph === "drop") {
      st.t += dt;
      G.tilt = lerp(G.tilt, 0.36, dt * 5);
      G.shake = Math.max(G.shake, 0.35);
      if (rnd() < dt * 4) sfx.scream(rand(500, 900), 0.6, 0.06);
      if (l >= 86) st.ph = "run";
    } else G.tilt = lerp(G.tilt, 0, dt * 3);
  },
  // The tell: the lights flicker, a growl, and the guests who will turn get a
  // red halo and red eyes (green ones stay friendly). The answer: the red ones
  // turn one by one and lunge as plain ghouls (shoot them); green guests never turn.
  exit(dt, l) {
    const st = G.st.exit || (G.st.exit = { tell: false, turned: false, t: 0, gate: 0 });
    if (!st.tell && l > 30) {
      st.tell = true;
      sfx.growl();
      sfx.lights(false);
      G.floats.push({ s: "RED HALO = ABOUT TO TURN", x: 48, y: 20, t: 0 });
    }
    if (st.tell && !st.turned) G.tint = 0.12 + 0.12 * Math.sin(G.clock * 18);
    if (!st.turned && l > 44) {
      st.turned = true;
      sfx.stab();
      G.flash = 0.4;
      G.flashCol = "#fff";
      for (const e of G.ents) {
        if (e.k === "inno" && e.alive && e.bad) {
          const p = mkPop("ghoul", e.x, { trig: 1e9 });
          p.ph = "idle";
          p.wait = 0.6 + rnd() * 2.0;
          G.ents.push(p);
          e.alive = false;
        }
      }
    }
    if (st.turned) {
      st.t += dt;
      G.tint = Math.min(0.5, st.t * 0.8);
    }
    if (l > 76 && !st.gate) {
      st.gate = 0.0001;
      sfx.exitGate();
      G.shake = 1;
    }
    if (st.gate) st.gate += dt;
  },
  barker(dt, l) {
    if (l >= 90 && !G.photoDone) takePhoto();
    if (G.mode === "ride" && l >= 132 && G.v < 0.3) finish();
  },
};
function sceneTick(dt) {
  const s = SCENES[G.zi];
  const tick = TICKS[s.id];
  if (tick) tick(dt, G.p - s.a + (s.skip || 0));
  if (s.id !== "lift") G.tilt = lerp(G.tilt, 0, Math.min(1, dt * 3));
  if (s.id !== "exit") G.tint = Math.max(0, (G.tint || 0) - dt * 0.5);
}
function enterScene(i) {
  G.card = { z: i, t: 0 };
  // The Barker: the finale loop takes over (ghoul.js plays `gallery.track`); it lives and dies with this round.
  if (SCENES[i].id === "barker") G.track = "ghoulBarker";
  sfx.ding();
}
function takePhoto() {
  G.photoDone = true;
  G.photoWant = true;
  G.flash = 1;
  G.flashCol = "#ffffff";
  sfx.flash();
}

/* ---------------------------------------------------------- the grade */

// The cascade's timing, in ms (the art draws it: ghoul-ride-draw.js): the first
// die pops at CARD_LEAD_MS, then one every CARD_STEP_MS, each falls for CARD_FALL_MS,
// and the card holds CARD_HOLD_MS after the last lands.
export const CARD_LEAD_MS = 2000;
export const CARD_STEP_MS = 220;
export const CARD_FALL_MS = 450;
export const CARD_HOLD_MS = 2600;

// Alive at the end: RIDE_FLOOR dice, plus up to RIDE_EXTRA more by how it went,
// so a good clean ride is MAX_DICE (9).
//   performance (0..100) = 15 * clamp((accuracy - 0.3) / 0.6) + 15 * clamp((kill rate - 0.4) / 0.6)
//                          + 45 * hearts left / 5 + 10 * min(1, close-call ducks / 4)
//                          + 15 * min(1, best streak / 20) - 2 per guest shot
//   extra dice = round(4 * clamp((performance - 52) / 40, 0, 1)); letter grade S 85+, A 70+, B 50+, C 30+.
export function gradeOf(s) {
  const acc = s.shots ? clamp(s.hits / s.shots, 0, 1) : 0;
  const kr = s.kills + s.missed > 0 ? s.kills / (s.kills + s.missed) : 0;
  let pts = 15 * clamp((acc - 0.3) / 0.6, 0, 1) + 15 * clamp((kr - 0.4) / 0.6, 0, 1) + 45 * (s.hp / MAXHP) + 10 * clamp(s.ducksOK / 4, 0, 1) + 15 * clamp(s.best / 20, 0, 1) - 2 * s.innoHits;
  pts = clamp(Math.round(pts), 0, 100);
  const extra = clamp(Math.round(4 * clamp((pts - 52) / 40, 0, 1)), 0, RIDE_EXTRA);
  return { perf: pts, grade: pts >= 85 ? "S" : pts >= 70 ? "A" : pts >= 50 ? "B" : pts >= 30 ? "C" : "D", extra, dice: RIDE_FLOOR + extra, acc, kr };
}
function finishGrade() {
  const g = gradeOf(G);
  G.perf = g.perf;
  G.grade = g.grade;
  G.extra = g.extra;
  G.dice = g.dice;
  const why = ["5 for surviving"];
  if (g.extra > 0) why.push("+" + g.extra + " for performance");
  const good = [];
  if (g.acc >= 0.55) good.push("aim " + Math.round(g.acc * 100) + "%");
  if (g.kr >= 0.75) good.push("few got through");
  if (G.hp >= 3) good.push(G.hp + " hearts left");
  if (G.ducksOK >= 4) good.push(G.ducksOK + " close calls");
  if (G.best >= 15) good.push("streak " + G.best);
  G.reason = why.join(", ") + (good.length ? "  (" + good.slice(0, 3).join(", ") + ")" : "");
  G.diceSnd = [];
}
// The Barker is done and the car has stopped in his mouth: the grade, the dice
// the bonus will pay and the door for Planny to reach, where `clearRoom` ends it.
function finish() {
  G.mode = "end";
  G.endT = 0;
  finishGrade();
  const b = RD.bonusRound;
  if (b) {
    b.perf.dice = G.dice;
    b.perf.cardMs = Math.round(CARD_LEAD_MS + (G.dice - 1) * CARD_STEP_MS + CARD_FALL_MS + CARD_HOLD_MS);
  }
  const spec = RD.spec;
  RD.hasKey = true;
  Object.assign(RD.you, { x: spec.door, y: KT.groundAt(spec, spec.door), vx: 0, vy: 0, state: "run", shelf: -1 });
}

/* ---------------------------------------------------------- the dark */

function groundSpeedWant() {
  const s = G.stall;
  const sc = SCENES[G.zi];
  if (G.mode === "dead") return 0;
  if (s.st === 1 || s.st === 2) return 0;
  let w = typeof sc.speed === "number" ? sc.speed : SPEEDS[sc.id](G.p - sc.a + (sc.skip || 0));
  if (w > 0) w *= SPD;
  if (G.stuck > 0) w = Math.min(w, 0.8);
  return w;
}

/* -------------------------------------------------------------- the step */

// One step of the ride, `dt` seconds (the prototype's update()). The arrows move
// the reticle with acceleration; the car's speed follows the room; everything
// on the field is stepped; Space or a press fires.
function update(dt) {
  G.clock += dt;
  const inp = RD.input;
  const kx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  const ky = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
  G.hx = kx ? Math.min(1, (G.hx || 0) + dt * 4) : 0;
  G.hy = ky ? Math.min(1, (G.hy || 0) + dt * 4) : 0;
  if (G.mode === "ride") {
    G.ret.x = clamp(G.ret.x + kx * (50 + 55 * (G.hx || 0)) * dt, RET_X0, RET_X1);
    G.ret.y = clamp(G.ret.y + ky * (42 + 48 * (G.hy || 0)) * dt, RET_Y0, RET_Y1);
    const was = G.ducked;
    G.ducked = G.ducked ? G.ret.y > DUCK_OFF : G.ret.y > DUCK_ON;
    if (G.ducked && !was) sfx.hurtDuck();
    if (G.ducked) G.duckAt = G.clock;
    G.fireCd -= dt;
    if ((inp.fire || G.ptrDown || G.trigger) && G.fireCd <= 0) fire();
    G.trigger = false;
  }
  const want = groundSpeedWant();
  const sc = SCENES[G.zi];
  const a = want < G.v ? (G.stall.st === 1 ? 16 : 10) : ACCEL[sc.id] ? ACCEL[sc.id]() : 7;
  G.v += clamp(want - G.v, -a * dt, a * dt);
  if (G.mode === "dead") G.v = Math.max(0, G.v - 14 * dt);
  const dp = G.v * dt;
  G.p += dp;
  G.wheel += dp * 0.9;
  const zi = sceneIndexAt(G.p);
  if (zi !== G.zi) {
    G.zi = zi;
    enterScene(zi);
  }
  G.card.t += dt;
  // The joints in the rail.
  const j = Math.floor(G.p / 4.4);
  if (j !== G.rumbleJoint) {
    G.rumbleJoint = j;
    if (G.v > 0.5) snd("joint", clamp(G.v / 10, 0.2, 1));
  }
  ensureSpawn();
  sceneTick(dt);
  if (G.mode === "end") return;
  if (G.doorOpen > 0 && G.doorOpen < 1) G.doorOpen = Math.min(1, G.doorOpen + dt * 3.5);
  G.stuck -= dt;
  updateStall(dt);
  for (const e of G.ents) {
    if (e.alive && (e.rel || Math.abs(e.x - G.p) < 110 || e.k === "boss" || (e.k === "axe" && Math.abs(e.x - G.p) < 140))) K[e.k].update(e, dt);
  }
  G.ents = G.ents.filter((e) => e.alive);
  for (const p of G.parts) {
    p.t += dt;
    p.vy += p.g * dt;
    p.x += p.vx * dt - (p.w ? dp : 0);
    p.y += p.vy * dt;
  }
  G.parts = G.parts.filter((p) => p.t < p.life && p.y < 54);
  for (const f of G.floats) f.t += dt;
  G.floats = G.floats.filter((f) => f.t < 1.1);
  for (const l of G.lens) l.t += dt;
  G.lens = G.lens.filter((l) => l.t < 7);
  G.inv -= dt;
  G.shake = Math.max(0, G.shake - dt * 1.6);
  G.flash = Math.max(0, G.flash - dt * 1.8);
  G.hurtT -= dt;
  G.muzzle -= dt;
  G.jolt -= dt;
  G.duckWarn -= dt;
  G.hint -= dt;
  if (G.tracer) {
    G.tracer.t -= dt;
    if (G.tracer.t <= 0) G.tracer = null;
  }
  if (G.hp === 1 && Math.floor(G.clock * 1.2) !== Math.floor((G.clock - dt) * 1.2)) sfx.heart();
}

/* -------------------------------------------------------------- firing */

// The reticle's point once the world tilts (the lift hill).
export function aimPt() {
  if (!G.tilt) return G.ret;
  const dx = G.ret.x - CAR_X;
  const dy = G.ret.y - 47;
  const a = -G.tilt;
  const co = Math.cos(a);
  const si = Math.sin(a);
  return { x: CAR_X + dx * co - dy * si, y: 47 + dx * si + dy * co };
}
// Whether the reticle is over something a shot would hit (the art reddens it).
export function overTarget() {
  const ap = aimPt();
  return G.ents.some((e) => e.alive && K[e.k].hit && K[e.k].hit(e, ap.x, ap.y));
}
// A shot: nothing while ducked. The nearest hit under the reticle, screen-space
// things first, hands, heads and eyes before the rest, a guest last; a miss
// still hits a target within 3 to 5.5 units (the aim assist), never a guest or a
// decoy mirror.
function fire() {
  if (G.ducked || G.fireCd > 0 || G.mode !== "ride") return;
  G.fireCd = FIRE_GAP;
  G.shots++;
  G.muzzle = 0.07;
  G.tracer = { x: G.ret.x, y: G.ret.y, t: 0.07 };
  sfx.shoot();
  let best = null;
  let bestPri = -1;
  const ap = aimPt();
  for (const e of G.ents) {
    if (!e.alive || !K[e.k].hit || !K[e.k].hit(e, ap.x, ap.y)) continue;
    const pri = (e.rel ? 3 : 1) + (e.k === "hand" || e.k === "head" || e.k === "eyes" ? 1 : 0) + (e.k === "inno" ? -2 : 0);
    if (pri > bestPri) {
      best = e;
      bestPri = pri;
    }
  }
  let hx = ap.x;
  let hy = ap.y;
  let assisted = false;
  if (!best) {
    outer: for (const rad of [3, 5.5]) {
      for (let a = 0; a < 8; a++) {
        const px = ap.x + Math.cos(a * 0.785) * rad;
        const py = ap.y + Math.sin(a * 0.785) * rad;
        for (const e of G.ents) {
          if (!e.alive || e.k === "inno" || e.k === "mir" || !K[e.k].hit) continue;
          if (K[e.k].hit(e, px, py)) {
            best = e;
            hx = px;
            hy = py;
            assisted = true;
            break outer;
          }
        }
      }
    }
  }
  if (best) {
    G.hits++;
    K[best.k].onHit(best, hx, hy);
    sfx.hit();
    if (assisted) sfx.blasterAssist();
  } else {
    sfx.blasterMiss();
    G.combo = 0;
    sparks(G.ret.x, G.ret.y, 4);
  }
}

/* ------------------------------------------------------- the ride's state */

// A fresh ride (the prototype's newGame): five hearts, the car at the start of
// the Load Bay with nothing spawned yet.
export function newRide(round) {
  const g = {
    waiting: true, room: round.room, mode: "title", p: 0, v: 0, clock: 0, t: 0, hp: MAXHP, score: 0, combo: 0, best: 0, shots: 0, hits: 0, kills: 0, hurts: 0,
    ents: [], parts: [], floats: [], lens: [], ret: { x: 62, y: 26 }, ducked: false, duckAt: -9, fireCd: 0, muzzle: 0, tracer: null,
    inv: 0, shake: 0, flash: 0, flashCol: "#fff", hurtT: 0, dark: 0, zi: 0, card: { z: 0, t: 0 }, doorOpen: 0, doorDone: false,
    stall: { st: 0, t: 0, n: 0, giant: 0, tell: 0, slam: 0, done: false }, duckWarn: 0, jolt: 0, guil: { prev: 0, heads: 3, n: 0 },
    photo: null, photoDone: false, photoWant: false, endT: 0, deadT: 0, rumbleJoint: 0, boss: null, bossDead: false, hint: 9, wheel: 0, grade: "", shotFlash: 0,
    sp: [], st: {}, ducksOK: 0, missed: 0, innoHits: 0, stuck: 0, tilt: 0, quiet: false, dice: 0, extra: 0, tint: 0, bossesDown: 0, perf: 0, reason: "", diceSnd: [],
    hx: 0, hy: 0, gt: {}, acc: 0, trigger: false, ptrDown: false, rs: ((round.score * 31 + round.room * 7919 + 0x5eed) >>> 0) || 1,
  };
  return g;
}

/* ------------------------------------------------------------- the pack */

// Planny is put down in the room: the ride is made (null in any other room).
function place(round) {
  const spec = round.spec;
  if (!spec.ride || !spec.ride.gallery) {
    round.gallery = null;
    return;
  }
  if (!round.gallery || round.gallery.room !== round.room) {
    round.gallery = newRide(round);
    round.gallery.mode = "title";
  }
  const you = round.you;
  you.x = spec.start;
  round.camLead = 0;
  const b = round.bonusRound;
  if (b && !b.perf.total) b.perf.total = 0;
}

// The ride's hook, run each slice of play: true (Planny never walks) in the room.
function ride(round, ms, kit) {
  const spec = round.spec;
  if (!spec.ride || !spec.ride.gallery || !round.gallery) return false;
  RD = round;
  KT = kit;
  bindG(round.gallery);
  if (G.mode === "title") G.mode = "ride";
  // The room's clock follows the ride; it never runs out on a slow one.
  round.timeMs = Math.max(1000, spec.ride.time - Math.round(G.clock * 1000));
  const b = round.bonusRound;
  if (b && G.mode !== "dead") G.hp = b.hearts;
  G.acc += ms;
  while (G.acc >= STEP_MS && round.phase === "play" && G.mode !== "end") {
    G.acc -= STEP_MS;
    update(STEP_MS / 1000);
  }
  return true;
}

// Whether the ride's title screen is holding for a key or a press.
export const isWaiting = (round) => round.phase === "ready" && !!round.gallery?.waiting;

// A key or a press on the title screen: the ride goes on the next slice. Whether it did.
export function startRide(round) {
  if (!isWaiting(round)) return false;
  round.gallery.waiting = false;
  round.phaseMs = 0;
  return true;
}

// A canvas press or move in the field's units (ghoul.js's `pointer`): the mouse
// aims, a press or hold fires. True when the ride took it.
function pointer(round, type, x, y) {
  const g = round.gallery;
  const spec = round.spec;
  if (!g || !spec.ride || !spec.ride.gallery) return false;
  if (type === "up" || type === "cancel") {
    g.ptrDown = false;
    return true;
  }
  // The title screen holds until a press, which starts the ride and does not fire.
  if (isWaiting(round)) {
    g.ret.x = clamp(x, RET_X0, RET_X1);
    g.ret.y = clamp(y, RET_Y0, RET_Y1);
    return type === "down" && startRide(round);
  }
  if (round.phase !== "play" || g.mode !== "ride") return false;
  g.ret.x = clamp(x, RET_X0, RET_X1);
  g.ret.y = clamp(y, RET_Y0, RET_Y1);
  if (type === "down") {
    g.ptrDown = true;
    g.trigger = true;
  }
  return true;
}

export const RIDE = freeze({
  id: "ride",
  monsters: freeze({}),
  walkers: freeze([]),
  zombies: freeze([]),
  stackers: freeze([]),
  climbers: freeze([]),
  act: freeze({}),
  move: freeze({}),
  kill: freeze({}),
  horde: freeze({}),
  ride: freeze([ride]),
  place: freeze([place]),
  pointer: freeze([pointer]),
});

// What the art and the tests read of the rules.
export { K, bossActive, miniHp, mirRect, groundSpeedWant, update as stepRide };
export const handTip = (e) => K.hand.tip(e);
