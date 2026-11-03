// Plan2Code Web Console - Ghoul Rush's Chapel stage, its rules: the monsters of the church (stone gargoyles that dive, choir ghosts whose song quickens the rest, censer monks and their smoke, bats in the bells), the bell toll that freezes everything, Holy Water, and its boss, the Choirmaster, as a stage pack that ghoul.js plugs in.
//
// Like the other stage packs (see ghoul-graveyard.js for what a pack holds),
// every rule here is handed a kit `k` of ghoul.js's own helpers, so this file
// has no imports. The pack adds a few fields of its own that ghoul.js reads:
//
// - `stone`: by kind, `(monster) => true` while a shot glances off it (and a
//   stomp does nothing); Holy Water breaks it.
// - `tick(round, ms, k)`: a stage-wide twist, run first in every slice of
//   play (here the bell). It may set `round.stunMs`, which freezes you and
//   every monster, boss, hazard and missile for that long (bolts in flight
//   still fly and hit), and keep its own state in `round.twist` (cleared with
//   the room).
// - `shot(round, m, s, k, random)`: the damage multiplier of a bolt that has
//   just hit monster `m` (Holy Water's double on ghosts), free to do more (its
//   splash).
// - `target(round, s, k)`: true when a bolt `s` struck something of the
//   pack's own that is no monster (an organ pipe) and is spent.
// - a monster may carry `hasteMs` and `haste`: while `hasteMs` is over 0 its
//   time runs `haste` times as fast (a choir ghost's song).
//
// A gargoyle perches on its ledge as stone (`perch`; shots glance off, a
// stomp does nothing). When you pass under it, it shakes loose (`wake`), dives
// at where your chest was (`dive`), flies back to its perch (`return`) and
// turns to stone again (`perch`). A choir ghost drifts slowly toward you and
// now and then sings (`sing`), and while it does every monster near it moves
// faster; kill it first. A censer monk walks at you and now and then puffs a
// cloud of smoke (a harmless `smoke` hazard that hides what is inside it for a
// while). A bell bat roosts in a bell (`roost`: harmless, in the way of
// nothing) until the bell tolls, then a flock of three bursts out and swoops
// at you like the house bat (`swoop`).
//
// The bell: in a room with a `toll` (ms), every so often the bell swings
// (`bellSwing`, a `bell` hazard drawn while it does), then tolls (`toll`) and
// everything on screen freezes for TOLL_STUN_MS, you included: frozen, you
// ignore every key (gravity still takes you down) and the monsters stand still,
// but a bolt already flying still hits. Bell bats burst out of every bell in
// view at each toll.
//
// Holy Water (a stage-only power-up, see ghoul-powers.js): bolts splash,
// one damage to every monster near what they hit, do double to ghosts, and
// break a stone gargoyle.
//
// The Choirmaster, a gaunt ghostly conductor at his organ, glides to his place
// at the room's end. Four organ pipes (shot targets with hp of their own) stand
// in the arena: a sounding pipe spews a ghost now and then (never more than
// GHOST_CAP alive), and while any pipe sounds he cannot be hurt. Shoot a
// pipe to nothing to silence it; with all four silent he is open. He conducts
// columns of notes (`note` hazards) that fly along the room at the heights of
// the lines of a staff, each column missing one note: be at the gap's height
// when it passes (the floor for the lowest gap, a board for each higher one).
// He raises his baton first (`cue`). Each column flies at a speed of its own,
// some far faster than others, and never so fast that it catches the column
// ahead (you always get time between two gaps). Once all four pipes are silent
// he is open for PIPES_BACK columns, then fresh pipes drop in from the roof at
// full hp and he is guarded until you silence them again. At half his hp
// (`rage`) the notes come faster and now and then two columns come close
// together.

const freeze = (o) => Object.freeze(o);

export const MONSTERS = freeze({
  gargoyle: freeze({ name: "Gargoyle", w: 3.6, h: 4.4, hp: 4, speed: 40, points: 240, stomp: true, head: false, perch: true, color: "#7c8088" }),
  chorister: freeze({ name: "Choir Ghost", w: 3, h: 4.6, hp: 3, speed: 6, points: 200, stomp: false, head: false, perch: true, flies: true, color: "#c9d6f2" }),
  monk: freeze({ name: "Censer Monk", w: 3, h: 5.4, hp: 4, speed: 8, points: 180, stomp: true, head: true, color: "#6a4a32" }),
  bellbat: freeze({ name: "Bell Bat", w: 2.6, h: 1.6, hp: 1, speed: 26, points: 60, stomp: true, head: false, perch: true, flies: true, color: "#5a2a6a" }),
});

// A gargoyle wakes when you are within GARGOYLE_NEAR across of its perch and
// lower than it, shakes loose for GARGOYLE_WAKE_MS, dives at GARGOYLE_DIVE_V on
// where your chest was and GARGOYLE_PAST beyond it (or to the floor), flies
// home at GARGOYLE_HOME_V and rests GARGOYLE_REST_MS on its perch before it
// wakes again.
export const GARGOYLE_NEAR = 13;
export const GARGOYLE_WAKE_MS = 500;
export const GARGOYLE_DIVE_V = 44;
export const GARGOYLE_PAST = 8;
export const GARGOYLE_HOME_V = 26;
export const GARGOYLE_REST_MS = 1500;
// A choir ghost sings SONG_MS every SONG_EVERY_MS or so (the first after
// SONG_FIRST_MS), within SONG_RANGE of you and in view; while it does, every
// other monster within HASTE_RANGE of it runs HASTE_MULT times as fast
// (HASTE_HOLD_MS is how long that sticks after the song).
export const SONG_MS = 2500;
export const SONG_EVERY_MS = 6000;
export const SONG_FIRST_MS = 1800;
export const SONG_RANGE = 70;
export const HASTE_RANGE = 16;
export const HASTE_MULT = 1.4;
export const HASTE_HOLD_MS = 150;
// A monk within MONK_RANGE of you puffs a cloud every PUFF_EVERY_MS or so,
// swinging its censer CENSER_WIND_MS first; a cloud is SMOKE_W wide and
// SMOKE_H tall, lasts SMOKE_MS, and no more than SMOKE_CAP are about.
export const MONK_RANGE = 44;
export const PUFF_EVERY_MS = 5200;
export const CENSER_WIND_MS = 450;
export const SMOKE_W = 10;
export const SMOKE_H = 8;
export const SMOKE_MS = 4000;
export const SMOKE_CAP = 3;
// A bell bat swoops as the house bat does (BAT_STEER, BAT_TURN); a toll lets
// BAT_FLOCK out of each roost in view, never more than BAT_CAP flying.
export const BAT_FLOCK = 3;
export const BAT_CAP = 6;
const BAT_STEER = 60;
const BAT_TURN = 18;

// The bell: it first swings TOLL_FIRST of a `toll` into the room (or the
// fight), swings for SWING_MS and tolls; everything then freezes for
// TOLL_STUN_MS.
export const TOLL_FIRST = 0.7;
export const SWING_MS = 1200;
export const TOLL_STUN_MS = 1000;
// Holy Water: a bolt splashes HOLY_SPLASH around what it hit, for one
// damage, and does HOLY_DOUBLE times the damage to HOLY_GHOSTS.
export const HOLY_SPLASH = 4;
export const HOLY_DOUBLE = 2;
export const HOLY_GHOSTS = freeze(["ghost", "chorister", "wraith"]);

// The Choirmaster. He glides to HOME_FROM_END short of the room's end at
// GLIDE_V. The four pipes stand PIPE_AT into the arena, PIPE_W wide and PIPE_H
// tall, each PIPE_HP of hp; a sounding one spews a ghost every PIPE_SPEW_MS or
// so. His columns are made of notes NOTE across at the heights ROWS over the
// floor (a staff's five lines, ROW_GAP apart), one of the first GAPS rows
// missing; a column flies at NOTE_V a second (NOTE_V_RAGE at half hp) times one
// of NOTE_PACE, drawn afresh for each column, but slowed if it would reach the
// arena's far end less than NOTE_SEP_MS behind the column ahead. A column comes
// every COLUMN_MS (COLUMN_RAGE_MS), his baton up CUE_MS first. At half his hp
// (RAGE) PAIR_CHANCE of the columns have a second PAIR_MS behind, as fast as
// the first, its gap next to the first's. With every pipe silent, the
// PIPES_BACK'th column (a pair is one) brings them all back: each falls for
// PIPE_DROP_MS, PIPE_DROP_STAGGER_MS after the one before, and cannot be shot
// until it lands.
export const BOSSES = freeze({
  choirmaster: freeze({ name: "The Choirmaster", sub: "Silence the pipes one by one", w: 8, h: 17, hp: 100, points: 3500, color: "#d8b0b8" }),
});
export const HOME_FROM_END = 12;
export const GLIDE_V = 14;
export const PIPE_AT = freeze([28, 42, 56, 70]);
export const PIPE_H = freeze([14, 18, 16, 20]);
export const PIPE_W = 3.2;
export const PIPE_HP = 8;
export const PIPE_SPEW_MS = 5400;
export const GHOST_CAP = 3;
export const NOTE = 1.6;
export const ROW_GAP = 5.2;
export const ROW_0 = 2.2;
export const ROWS = freeze([0, 1, 2, 3, 4].map((i) => ROW_0 + i * ROW_GAP));
export const GAPS = 4;
export const NOTE_V = 22;
export const NOTE_V_RAGE = 28;
export const NOTE_PACE = freeze([0.55, 0.8, 1, 1.35, 1.75]);
export const NOTE_SEP_MS = 1500;
export const IDLE_MS = 1400;
export const CUE_MS = 700;
export const COLUMN_MS = 3200;
export const COLUMN_RAGE_MS = 2300;
export const PAIR_MS = 1100;
export const PAIR_CHANCE = 0.4;
export const RAGE = 0.5;
export const PIPES_BACK = 4;
export const PIPE_DROP_MS = 600;
export const PIPE_DROP_STAGGER_MS = 150;

const SHOT_R = 0.5;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const inView = (round, m, k) => m.x > round.camX - 2 && m.x < round.camX + k.FIELD_W + 2;

/* ------------------------------------------------------------ monsters */

function moveGargoyle(round, m, ms, k) {
  const you = round.you;
  const spec = round.spec;
  const dt = ms / 1000;
  const pace = spec.pace;
  if (m.px === undefined) m.px = m.x;
  if (m.act === "perch") {
    m.wait = Math.max(0, m.wait - ms);
    // Passing under it (lower than the ledge, near across) shakes it loose.
    if (m.wait || Math.abs(you.x - m.px) > GARGOYLE_NEAR || you.y > m.y - 1 || you.out > 0) return;
    m.act = "wake";
    m.wait = GARGOYLE_WAKE_MS;
    m.dir = Math.sign(you.x - m.x) || m.dir;
    round.events.push({ type: "gargoyleWake", kind: m.kind, x: m.x, y: m.y + m.h / 2 });
    return;
  }
  if (m.act === "wake") {
    m.wait = Math.max(0, m.wait - ms);
    if (m.wait) return;
    // Aim at your chest from here and dive straight there.
    const ty = you.y + k.SHOT_Y - m.h / 2;
    const dx = you.x - m.x;
    const d = Math.hypot(dx, ty - m.y) || 1;
    const v = GARGOYLE_DIVE_V * pace;
    m.vx = (dx / d) * v;
    m.vy = ((ty - m.y) / d) * v;
    m.dive = Math.sign(dx) || m.dir;
    m.act = "dive";
    round.events.push({ type: "gargoyleDive", kind: m.kind, x: m.x, y: m.y + m.h / 2 });
    return;
  }
  if (m.act === "dive") {
    m.x += m.vx * dt;
    m.y = clamp(m.y + m.vy * dt, k.groundAt(spec, m.x) + 0.8, k.CHANDELIER_Y);
    m.dir = Math.sign(m.vx) || m.dir;
    if ((m.x - you.x) * m.dive > GARGOYLE_PAST || m.y <= k.groundAt(spec, m.x) + 1.2) m.act = "return";
    return;
  }
  // Home to its perch, and stone again.
  const dx = m.px - m.x;
  const dy = m.home - m.y;
  const d = Math.hypot(dx, dy);
  const step = GARGOYLE_HOME_V * pace * dt;
  m.dir = Math.sign(dx) || m.dir;
  if (d > step) {
    m.x += (dx / d) * step;
    m.y += (dy / d) * step;
    return;
  }
  m.x = m.px;
  m.y = m.home;
  m.act = "perch";
  m.wait = GARGOYLE_REST_MS;
  round.events.push({ type: "gargoylePerch", kind: m.kind, x: m.x, y: m.y + m.h / 2 });
}

// Every other monster near a singer runs faster for a moment.
function quicken(round, m) {
  for (const o of round.monsters) {
    if (o === m || o.dead || Math.hypot(o.x - m.x, o.y - m.y) > HASTE_RANGE) continue;
    o.hasteMs = HASTE_HOLD_MS;
    o.haste = HASTE_MULT;
  }
}

function moveChorister(round, m, ms, k) {
  const you = round.you;
  const spec = round.spec;
  const dt = ms / 1000;
  const dx = you.x - m.x;
  const ty = you.y + 1;
  const d = Math.hypot(dx, ty - m.y) || 1;
  // Drifting toward you, through walls, and a stop short of you.
  if (d > 3) {
    const step = MONSTERS.chorister.speed * spec.pace * dt;
    m.x += (dx / d) * step;
    m.y += ((ty - m.y) / d) * step;
  }
  m.dir = Math.sign(dx) || m.dir;
  m.y = clamp(m.y, k.groundAt(spec, m.x) + 0.5, k.CHANDELIER_Y);
  if (m.sing > 0) {
    m.sing = Math.max(0, m.sing - ms);
    quicken(round, m);
    if (!m.sing) round.events.push({ type: "choirHush", kind: m.kind, x: m.x, y: m.y + m.h / 2 });
    return;
  }
  m.songIn = (m.songIn ?? SONG_FIRST_MS * (0.7 + (m.id % 4) * 0.2)) - ms;
  if (m.songIn > 0 || !inView(round, m, k) || Math.abs(dx) > SONG_RANGE) return;
  m.songIn = SONG_EVERY_MS * (0.85 + (m.id % 4) * 0.1);
  m.sing = SONG_MS;
  round.events.push({ type: "choirSing", kind: m.kind, x: m.x, y: m.y + m.h / 2 });
}

function moveMonk(round, m, ms, k) {
  const you = round.you;
  const spec = round.spec;
  if (m.windup > 0) {
    m.windup = Math.max(0, m.windup - ms);
    if (m.windup) return;
    if (round.hazards.filter((h) => h.kind === "smoke").length < SMOKE_CAP) {
      round.hazards.push({ kind: "smoke", x: m.x + m.dir * 1.5, y: m.y, w: SMOKE_W, h: SMOKE_H, live: 0, life: SMOKE_MS, age: 0, cause: "smoke" });
      round.events.push({ type: "smokePuff", kind: m.kind, x: m.x + m.dir * 1.5, y: m.y + 2, w: SMOKE_W });
    }
    return;
  }
  k.walk(round, m, k.towardYou(round, m), MONSTERS.monk.speed * spec.pace, ms / 1000);
  if (!inView(round, m, k) || Math.abs(you.x - m.x) > MONK_RANGE) return;
  m.throwIn -= ms * spec.pace;
  if (m.throwIn > 0) return;
  m.throwIn = PUFF_EVERY_MS * (0.85 + (m.id % 4) * 0.1);
  m.windup = CENSER_WIND_MS;
  round.events.push({ type: "censerWind", kind: m.kind, x: m.x, y: m.y + m.h * 0.5 });
}

// The house bat's swoops: level passes at your chest, turning BAT_TURN past
// you and climbing a little before coming back down.
function moveBellbat(round, m, ms, k) {
  if (m.act === "roost") return;
  const you = round.you;
  const spec = round.spec;
  const dt = ms / 1000;
  const dx = you.x - m.x;
  const toward = k.towardYou(round, m);
  const speed = MONSTERS.bellbat.speed * spec.pace;
  if (!m.pass) m.pass = toward;
  if ((m.x - you.x) * m.pass > BAT_TURN) {
    m.pass = -m.pass;
    m.climb = 300;
  }
  m.climb = Math.max(0, (m.climb || 0) - ms);
  const ty = m.climb > 0 ? you.y + 12 : you.y + k.SHOT_Y - MONSTERS.bellbat.h / 2;
  const close = Math.abs(dx) <= 9 && m.climb <= 0;
  const steer = close ? 0 : clamp((ty - m.y) * 5, -BAT_STEER, BAT_STEER);
  m.vx = clamp(m.vx + m.pass * BAT_STEER * 2 * dt, -speed, speed);
  m.vy = clamp(m.vy + (steer - m.vy) * Math.min(1, (close ? 20 : 6) * dt), -speed * 0.8, speed * 0.8);
  m.x += m.vx * dt;
  m.y = Math.max(k.groundAt(spec, m.x) + 0.6, Math.min(k.CHANDELIER_Y, m.y + (m.vy + Math.sin(m.t / 140) * 1.5) * dt));
  m.dir = Math.sign(m.vx) || m.dir;
}

// A cloud of smoke: it only waits out its time. Returns whether it is still
// on the field.
function stepSmoke(round, h, ms) {
  h.age += ms;
  h.life -= ms;
  return h.life > 0;
}

/* ------------------------------------------------------------- the bell */

// The bell as a hazard to draw while it swings (`p`: 0 to 1 through the
// swing), kept at the middle of the view. Returns whether it is still on.
function stepBell(round, h, ms, k) {
  const tw = round.twist;
  if (!tw || !(tw.swing || tw.frozen)) return false;
  h.x = round.camX + k.FIELD_W / 2;
  h.p = tw.swing ? clamp(1 - tw.next / SWING_MS, 0, 1) : 1;
  return true;
}

// A flock of BAT_FLOCK out of every roost in view, as many as BAT_CAP allows.
function burstBells(round, k) {
  let flying = round.monsters.filter((m) => !m.dead && m.kind === "bellbat" && m.act !== "roost").length;
  for (const r of [...round.monsters]) {
    if (r.dead || r.kind !== "bellbat" || r.act !== "roost" || !inView(round, r, k)) continue;
    if (flying + BAT_FLOCK > BAT_CAP) break;
    flying += BAT_FLOCK;
    for (let i = 0; i < BAT_FLOCK; i++) k.spawnMonster(round, "bellbat", r.x + (i - 1) * 1.2, r.y - i * 0.6, { act: "swoop", force: true, vx: (i - 1) * 10, vy: -4 });
    round.events.push({ type: "bellBurst", kind: r.kind, x: r.x, y: r.y, n: BAT_FLOCK });
  }
}

// The bell, every `toll` ms of a room that has one (of a boss's fight, once it
// begins): it swings, tolls, and freezes everything for TOLL_STUN_MS.
function tick(round, ms, k) {
  const spec = round.spec;
  if (!spec.toll) return;
  const b = round.boss;
  if (b && b.state !== "fight") return;
  const tw = (round.twist ||= { next: spec.toll * TOLL_FIRST, swing: false, frozen: false });
  if (tw.frozen && !(round.stunMs > 0)) {
    tw.frozen = false;
    round.events.push({ type: "tollEnd", x: round.camX + k.FIELD_W / 2, y: k.CHANDELIER_Y });
  }
  tw.next -= ms;
  const at = { x: round.camX + k.FIELD_W / 2, y: k.CHANDELIER_Y - 2 };
  if (!tw.swing && !tw.frozen && tw.next <= SWING_MS && tw.next > 0) {
    tw.swing = true;
    round.hazards.push({ kind: "bell", x: at.x, y: at.y, w: 0, h: 0, live: 0, p: 0, cause: "bell" });
    round.events.push({ type: "bellSwing", ...at, ms: SWING_MS });
  }
  if (tw.next > 0) return;
  tw.next = spec.toll;
  tw.swing = false;
  tw.frozen = true;
  round.stunMs = TOLL_STUN_MS;
  round.events.push({ type: "toll", ...at, ms: TOLL_STUN_MS });
  burstBells(round, k);
}

/* ---------------------------------------------------------- holy water */

const guardOf = (b) => !b.pipes || b.pipes.some((p) => p.on);

// What a bolt does beside its own damage under Holy Water: one damage to
// every monster (and the Choirmaster, when his pipes are quiet) near what it
// hit, and double to a ghost kind.
function holyShot(round, m, s, k, random) {
  if (!(round.effects.holy > 0)) return 1;
  const cx = m.x;
  const cy = m.y + m.h / 2;
  let n = 0;
  for (const o of [...round.monsters]) {
    if (o === m || o.dead || !k.solid(o) || Math.hypot(o.x - cx, o.y + o.h / 2 - cy) > HOLY_SPLASH) continue;
    k.hurt(round, o, 1, "splash", random);
    n++;
  }
  const b = round.boss;
  if (b && b.kind === "choirmaster" && b.state === "fight" && !guardOf(b) && Math.hypot(clamp(cx, b.x - b.w / 2, b.x + b.w / 2) - cx, clamp(cy, b.y, b.y + b.h) - cy) <= HOLY_SPLASH) {
    k.hurtBoss(round, 1, "splash");
    n++;
  }
  round.events.push({ type: "holySplash", x: cx, y: cy, n });
  return HOLY_GHOSTS.includes(m.kind) ? HOLY_DOUBLE : 1;
}

/* ------------------------------------------------------ the Choirmaster */

const rage = (b) => b.hp <= b.max * RAGE;

function makePipes(round, k) {
  return PIPE_AT.map((dx, i) => {
    const x = round.spec.arena + dx;
    return { i, x, y: k.groundAt(round.spec, x), w: PIPE_W, h: PIPE_H[i], hp: PIPE_HP, max: PIPE_HP, on: true, spewIn: PIPE_SPEW_MS * (0.45 + 0.2 * i), hurt: 0 };
  });
}

// A bolt `s` into the leftmost sounding pipe it is level with (pipes stand in
// a row, so a silent one lets the bolt on to the next).
function pipeShot(round, s, k) {
  const b = round.boss;
  if (!b || b.kind !== "choirmaster" || b.state !== "fight" || !b.pipes) return false;
  for (const p of b.pipes) {
    if (!p.on || p.dropMs > 0 || Math.abs(s.x - p.x) > p.w / 2 + SHOT_R || s.y < p.y - SHOT_R || s.y > p.y + p.h) continue;
    // A thrown weapon strikes harder than a bolt (ghoul-arms.js).
    p.hp = Math.max(0, p.hp - (s.pipeDmg || 1));
    p.hurt = 120;
    round.events.push({ type: "pipeHit", kind: b.kind, x: s.x, y: s.y, pipe: p.i, hp: p.hp });
    if (p.hp > 0) return true;
    p.on = false;
    const left = b.pipes.filter((q) => q.on).length;
    round.events.push({ type: "pipeSilence", kind: b.kind, x: p.x, y: p.y + p.h / 2, pipe: p.i, left });
    if (!left) round.events.push({ type: "choirOpen", kind: b.kind, x: b.x, y: b.y + b.h * 0.6 });
    return true;
  }
  return false;
}

// Where a note leaves the field, past the arena's far end.
const noteEnd = (round) => round.spec.arena - 6;

// The speed of a new column from `x`: drawn from NOTE_PACE, then held down so
// it reaches the arena's far end NOTE_SEP_MS or more behind the last column
// still flying. It starts behind that column, so it is that far behind or
// further at every spot on the way.
function columnSpeed(round, base, x, random) {
  const v = base * NOTE_PACE[Math.floor(random() * NOTE_PACE.length) % NOTE_PACE.length];
  const end = noteEnd(round);
  let ahead = 0;
  for (const h of round.hazards) if (h.kind === "note" && h.v > 0) ahead = Math.max(ahead, (h.x - end) / h.v);
  return Math.min(v, (x - end) / (ahead + NOTE_SEP_MS / 1000));
}

// A column of notes at the staff over the floor under him, row `gap` left out.
// A pair's second column keeps the first's speed, and with it the gap between.
function launch(round, b, gap, k, pair, random) {
  const base = k.groundAt(round.spec, b.x);
  const x = b.x - b.w / 2 - 1;
  const usual = (rage(b) ? NOTE_V_RAGE : NOTE_V) * round.spec.pace;
  const v = pair ? b.noteV : columnSpeed(round, usual, x, random);
  b.noteV = v;
  ROWS.forEach((row, i) => {
    if (i !== gap) round.hazards.push({ kind: "note", x, y: base + row - NOTE / 2, w: NOTE, h: NOTE, row: i, v, pace: v / usual, live: 1, life: 12000, cause: "note" });
  });
  round.events.push({ type: "notes", kind: b.kind, x, y: base, gap, pair, v, rows: ROWS.length });
}

// A column (or a pair) is away. While every pipe is silent it counts toward
// their return: the last but one warns you, the last drops them in.
function columnDone(round, b) {
  b.act = "idle";
  b.wait = (rage(b) ? COLUMN_RAGE_MS : COLUMN_MS) / round.spec.pace;
  if (b.quiet === null) return;
  b.quiet -= 1;
  if (b.quiet === 1) round.events.push({ type: "pipesStir", kind: b.kind, x: b.x, y: b.y + b.h * 0.6 });
  if (b.quiet > 0) return;
  b.pipes.forEach((p, i) => Object.assign(p, { on: true, hp: p.max, hurt: 0, dropMs: PIPE_DROP_MS + i * PIPE_DROP_STAGGER_MS, spewIn: PIPE_SPEW_MS * 0.5 }));
  b.quiet = null;
}

// The gap next to `gap`, one step up or down, whichever is on the staff.
function sideGap(gap, random) {
  const step = random() < 0.5 ? -1 : 1;
  return gap + step >= 0 && gap + step < GAPS ? gap + step : gap - step;
}

// The next gap: the same height or one step either side of the last (a
// column is always reachable from the one before).
function nextGap(b, random) {
  const g = clamp((b.gap ?? 0) + Math.floor(random() * 3) - 1, 0, GAPS - 1);
  b.gap = g;
  return g;
}

function moveChoirmaster(round, b, ms, random, k) {
  const spec = round.spec;
  const dt = ms / 1000;
  const pace = spec.pace;
  if (!b.pipes) {
    b.pipes = makePipes(round, k);
    b.act = "glide";
    b.wait = 0;
    b.quiet = null;
  }
  b.dir = -1;
  if (!b.raged && rage(b)) {
    b.raged = true;
    round.events.push({ type: "choirRage", kind: b.kind, x: b.x, y: b.y + b.h / 2 });
  }
  // Columns left before the pipes come back, counted only while all are silent.
  if (b.pipes.some((p) => p.on)) b.quiet = null;
  else b.quiet ??= PIPES_BACK;
  // The pipes: one on its way down lands, one sounding spews a ghost now and
  // then.
  const ghosts = () => round.monsters.filter((m) => !m.dead && m.kind === "ghost").length;
  for (const p of b.pipes) {
    p.hurt = Math.max(0, p.hurt - ms);
    if (!p.on) continue;
    if (p.dropMs > 0) {
      p.dropMs = Math.max(0, p.dropMs - ms);
      if (!p.dropMs) round.events.push({ type: "pipeSound", kind: b.kind, x: p.x, y: p.y + p.h / 2, pipe: p.i });
      continue;
    }
    p.spewIn -= ms * pace;
    if (p.spewIn > 0) continue;
    if (ghosts() >= GHOST_CAP) {
      p.spewIn = 1000;
      continue;
    }
    p.spewIn = PIPE_SPEW_MS * (0.85 + random() * 0.3);
    k.spawnMonster(round, "ghost", p.x, p.y + p.h * 0.75, { force: true, phase: (p.x * 97) % 3100 });
    round.events.push({ type: "pipeSpew", kind: b.kind, x: p.x, y: p.y + p.h * 0.75, pipe: p.i });
  }
  if (b.act === "glide") {
    const home = spec.length - HOME_FROM_END;
    const step = GLIDE_V * dt;
    if (Math.abs(home - b.x) > step) {
      b.x += Math.sign(home - b.x) * step;
      return;
    }
    b.x = home;
    b.act = "idle";
    b.wait = IDLE_MS / pace;
  }
  b.wait -= ms;
  if (b.wait > 0) return;
  if (b.act === "idle") {
    const gap = nextGap(b, random);
    b.second = rage(b) && random() < PAIR_CHANCE ? sideGap(gap, random) : null;
    b.act = "cue";
    b.wait = CUE_MS / pace;
    round.events.push({ type: "notesCue", kind: b.kind, x: b.x - b.w / 2, y: b.y + b.h * 0.75, gap, second: b.second });
  } else if (b.act === "cue") {
    launch(round, b, b.gap, k, false, random);
    if (b.second !== null) {
      b.act = "pair";
      b.wait = PAIR_MS / pace;
    } else columnDone(round, b);
  } else if (b.act === "pair") {
    b.gap = b.second;
    launch(round, b, b.second, k, true, random);
    b.second = null;
    columnDone(round, b);
  }
}

// A note: it flies along the room and is gone past the arena's far end.
function stepNote(round, h, ms) {
  h.x -= h.v * (ms / 1000);
  h.life -= ms;
  return h.life > 0 && h.x > noteEnd(round);
}

export const CHAPEL = freeze({
  id: "chapel",
  monsters: MONSTERS,
  walkers: freeze(["monk"]),
  zombies: freeze([]),
  stackers: freeze([]),
  climbers: freeze(["monk"]),
  act: freeze({ gargoyle: "perch", bellbat: "roost" }),
  swoops: freeze({ gargoyle: (m) => m.act === "dive" || m.act === "return", bellbat: (m) => m.act === "swoop" }),
  // A perched gargoyle is stone (shots glance off it, nothing touches it) and
  // a bell bat in its bell is harmless.
  solid: freeze({
    gargoyle: (m) => m.act !== "perch" && m.act !== "wake",
    bellbat: (m) => m.act !== "roost",
  }),
  stone: freeze({ gargoyle: (m) => m.act === "perch" || m.act === "wake" }),
  move: freeze({ gargoyle: moveGargoyle, chorister: moveChorister, monk: moveMonk, bellbat: moveBellbat }),
  kill: freeze({}),
  horde: freeze({ bellbat: freeze({ act: "swoop" }) }),
  tick,
  shot: holyShot,
  target: pipeShot,
  bosses: BOSSES,
  boss: freeze({ choirmaster: moveChoirmaster }),
  // He cannot be hurt while any pipe sounds.
  guard: freeze({ choirmaster: guardOf }),
  cause: freeze({ choirmaster: () => "choirmaster" }),
  hazards: freeze({ smoke: stepSmoke, bell: stepBell, note: stepNote }),
});
