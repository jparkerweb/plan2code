// Plan2Code Web Console - Ghoul Rush's Gallows Bog stage, its rules: the monsters that haunt it (a lurker's eyes in the water, a drifting leech swarm, a will-o'-wisp whose light lures the rest toward you, and a bog body risen from the muck) and its boss, Old Mother Bog, as a stage pack that ghoul.js plugs in.
//
// No imports: ghoul.js hands every rule here a kit `k` of its own helpers
// (walk, throwBone, spawnMonster, groundAt, struck, hurt and the numbers they
// need), so this file never reaches back into it. A pack is plain data and
// functions:
//
// - `monsters`: each kind's numbers, as in ghoul.js's MONSTERS (`perch`: its
//   spawn names the height it waits at; `flies`: a horde one comes in high).
// - `walkers`, `zombies`: kinds that join ghoul.js's sets of the same names
//   (a bog body is a zombie in every way but how it rises).
// - `act`: what a kind starts out doing; `solid`: whether one can hurt and be
//   hit just now; `swoops`: whether a kind is diving low enough to duck
//   under; `unseen`: kinds out of sight just now, so shots go through and a
//   touch does nothing; `harmless`: kinds that never hurt by touch (the leech
//   latches instead); `move`: one slice of a kind's moving; `kill`: what a
//   death leaves; `horde`: what a kind comes in from the edge with.
// - `tick`: the stage's own twist, run each slice (the wisp's lure).
// - `shot`: what a bolt that hit a monster does besides its damage (a bright
//   wisp is shot out, never hit); `target`: what else a bolt can strike (a
//   harpoon finds a lurker's eyes under the water).
// - `bosses`, `boss` (one slice of a boss's fight), `guard` (true while
//   shots and stomps glance off), `weak` (the damage multiplier of a shot
//   that has just hit), `cause` (what its touch is called) and `hazards` (by
//   kind, one slice of something it left on the field).
//
// A lurker is two eyes at the waterline until you cross it: then it snaps
// out of the water, solid and lunging, and sinks back. A leech swarm drifts
// through the wet spans toward you and latches on contact, one heart and it
// drops off. A wisp is a drifting light: near it the dead pull toward you a
// step quicker (the lure), until a bolt puts it out and it rekindles
// somewhere else. A bog body rises out of the mud and walks.
//
// OLD MOTHER BOG drifts along her planks (never half off them) and picks her
// next move by weight (`pickAttack`: never one move three times running, the
// slow ones on a cooldown, a summon only while her adds are under their cap).
// Every move has a wind-up pose, a sound and an event before it can hurt.
// Her fight has three phases:
//
// - Full health: the mud WAVE (jump it), the SPIT (a muck patch where you
//   stand, step off), the BOG HANDS (`hands`: ripples where you stand and a
//   step either side, hands burst up from them, cause `boghand`; step between
//   or off), the SURGE (`surge`: she sinks to her waist and charges along and
//   past you through planks and water alike; jump her or stand on a shelf),
//   the MUD SHELL (`shell`: shots chip it instead of her, SHELL_HP of them
//   break it and leave her reeling with the cauldron open, `stagger`; left
//   alone she ladles stew and heals SHELL_HEAL) and the DIVE (`dive`: she goes
//   under and comes up somewhere else, the bubbles first). Under three
//   quarters of her hp the DOUBLE wave, the VOLLEY of three patches and the
//   LEECH BROOD (`brood`: she tips the cauldron and a swarm or two pours onto
//   the planks, at most BROOD_CAP of hers alive) join them.
// - Under half (after her first dive): the STOMP (`stomp`: a shadow where you
//   stand, she leaps and lands there, then two mud waves roll out both ways;
//   leave the shadow, then jump the wave), the TIDE (`tide`: the water rises
//   over every plank for TIDE_MS after a long warning, cause `tide`; be on a
//   shelf or in the air), the DROWNING PULL (`pull`: the water drags you on the
//   planks toward her; run, jump or climb), and CALL THE DROWNED (`drowned`:
//   mud boils, bog bodies climb out, at most BODIES_CAP of hers alive). Her
//   dives come up with a mud wave each way.
// - Under a quarter (after her second dive), furious: the WISP LANTERN
//   (`wisps`: two wisps of hers drift at you and lure her adds; a bolt puts one
//   out for good) and the COMBO: a move that ends in an idle may go straight
//   into the next (`motherCombo`, her eye flares first). Every wait is
//   MOTHER_FURY as long, the hands come four at a time.
//
// The cauldron opens late in each rest (after a wave, a surge, a stomp or a
// rise) and stays open while she reels from a broken shell: a shot into her
// then counts triple (`weak`). She is `guard`ed while under water or shelled.

const freeze = (o) => Object.freeze(o);

export const MONSTERS = freeze({
  lurker: freeze({ name: "Lurker", w: 3.4, h: 2.6, hp: 3, speed: 16, points: 150, stomp: true, head: false, color: "#2a3a18" }),
  leech: freeze({ name: "Leech Swarm", w: 3, h: 1.8, hp: 2, speed: 9, points: 90, stomp: true, head: false, color: "#3d2a24" }),
  wisp: freeze({ name: "Will-o'-Wisp", w: 1.6, h: 1.6, hp: 1, speed: 12, points: 70, stomp: false, head: false, perch: true, flies: true, color: "#9adfc0" }),
  bogbody: freeze({ name: "Bog Body", w: 3, h: 5, hp: 4, speed: 7, lurch: 14, points: 120, stomp: true, head: true, color: "#4a3a22" }),
});

export const BOSSES = freeze({
  motherbog: freeze({ name: "Old Mother Bog", sub: "Keep to the planks, she owns the water", w: 7, h: 10, hp: 360, points: 3000, color: "#5a4a2a" }),
});

// A lurker's eyes snap when you are within SNAP_RANGE across (and SNAP_HIGH
// up or down): it lunges at SNAP_V for SNAP_MS, then sinks for LURKER_SINK_MS
// back to eyes.
export const SNAP_RANGE = 9;
export const SNAP_HIGH = 5;
export const SNAP_V = 34;
export const SNAP_MS = 900;
export const LURKER_SINK_MS = 500;
// A latched leech swarm costs one heart, then it drops off for
// LEECH_DROP_MS and cannot latch again for LEECH_AGAIN_MS.
export const LEECH_DROP_MS = 350;
export const LEECH_AGAIN_MS = 1400;
// A bog body takes BOG_RISE_MS to climb out of the mud (one out of the
// horde's edge, or out of a door, is already up), then lurches like a zombie
// inside LURCH_RANGE.
export const BOG_RISE_MS = 600;
const LURCH_RANGE = 20;
// A wisp put out stays dim for WISP_RELIGHT_MS, then glows at its seeded
// spot for WISP_REKINDLE_MS before it burns bright again. While it is
// bright, every monster within WISP_LURE of it is pulled toward you and
// runs at WISP_HASTE times its speed.
export const WISP_RELIGHT_MS = 6000;
export const WISP_REKINDLE_MS = 600;
export const WISP_LURE = 10;
export const WISP_HASTE = 1.2;
const LURE_HOLD_MS = 120;
// Old Mother Bog keeps MOTHER_KEEP of plank between you, drifting at
// MOTHER_WALK. Between moves she idles MOTHER_IDLE_MS; the mud wave winds up
// MOTHER_WIND_MS and rests MOTHER_REST_MS after, its cauldron open for the
// last MOTHER_OPEN_MS; the spit winds up SPIT_WIND_MS and lands MUCK_LAND_MS
// later, a patch MUCK_W wide and MUCK_H high burning for MUCK_MS. At
// MOTHER_RAGE of her hp she sinks for MOTHER_SINK_MS, bubbles for
// BUBBLE_MS where she will surface, and rises over RESURFACE_MS near you
// (RESURFACE_NEAR or further); after it her waits are MOTHER_QUICK times as
// long and the spit also lands a patch MUCK_LEAD ahead of where you run.
//
// What keeps her from being learned by heart: the idle wait varies by
// IDLE_JITTER either way and the next move is a weighted pick (never one move
// three times running, see `pickAttack`), not a turn. The wave comes first,
// and a DOUBLE wave (a second one DOUBLE_GAP_MS behind the first) and a VOLLEY
// (three patches at once, staggered VOLLEY_STAGGER_MS, spread MUCK_SPREAD) join
// it once she is under three quarters of her hp. Raged, she crowds you
// (MOTHER_KEEP_RAGED), walks faster and favors those two. At MOTHER_FURY_AT of
// her hp she goes under a second time and comes back furious: waits
// MOTHER_FURY times as long as a calm one's, keeping MOTHER_KEEP_FURY away.
// She stands only where planks hold her whole body (`planked`), never half
// out over the water.
export const MOTHER_KEEP = 14;
export const MOTHER_KEEP_RAGED = 10;
export const MOTHER_KEEP_FURY = 7;
export const MOTHER_WALK = 6;
export const MOTHER_IDLE_MS = 800;
export const IDLE_JITTER = 0.3;
export const MOTHER_WIND_MS = 600;
export const MOTHER_REST_MS = 1000;
export const MOTHER_OPEN_MS = 460;
export const SPIT_WIND_MS = 550;
export const DOUBLE_GAP_MS = 520;
export const VOLLEY_STAGGER_MS = 260;
export const MUCK_SPREAD = 9;
export const NEW_MOVES_AT = 0.75;
export const MOTHER_FURY_AT = 0.25;
export const MOTHER_FURY = 0.55;
export const MUCK_LAND_MS = 650;
export const MUCK_MS = 3000;
export const MUCK_W = 5;
export const MUCK_H = 3;
export const MUCK_LEAD = 11;
export const MOTHER_RAGE = 0.5;
export const MOTHER_QUICK = 0.7;
export const MOTHER_SINK_MS = 600;
export const BUBBLE_MS = 700;
export const RESURFACE_MS = 450;
const RESURFACE_NEAR = 14;
// The new moves' numbers, by move (each wind-up is the time between its
// event and the first moment it can hurt).
//
// Bog hands: HANDS_WIND_MS of her arms going into the water, then each ripple
// warns HAND_WARN_MS more (the later ones HAND_STAGGER_MS after) and a hand
// HAND_W wide and HAND_H tall is up for HAND_UP_MS. HANDS_N by phase, HAND_GAP
// apart.
export const HANDS_WIND_MS = 450;
export const HAND_WARN_MS = 750;
export const HAND_STAGGER_MS = 140;
export const HAND_UP_MS = 650;
export const HAND_W = 2.6;
export const HAND_H = 5.5;
export const HAND_GAP = 7;
export const HANDS_N = freeze([2, 3, 4]);
// The surge: SURGE_WIND_MS of a crouch, then she runs SURGE_SINK down in the
// water at SURGE_V to SURGE_PAST beyond where you stood.
export const SURGE_WIND_MS = 750;
export const SURGE_SINK = 4.5;
export const SURGE_V = 46;
export const SURGE_PAST = 16;
// The mud shell: SHELL_WIND_MS to pull it up, SHELL_HP shots (by phase) to
// break it within SHELL_MS, else she heals SHELL_HEAL; broken, she reels
// STAGGER_MS with the cauldron open.
export const SHELL_WIND_MS = 600;
export const SHELL_MS = 3200;
export const SHELL_HP = freeze([14, 16, 18]);
export const SHELL_HEAL = 14;
export const STAGGER_MS = 1200;
// The leech brood: BROOD_WIND_MS tipping the cauldron, BROOD_N swarms out, at
// most BROOD_CAP of hers alive.
export const BROOD_WIND_MS = 700;
export const BROOD_N = 2;
export const BROOD_CAP = 3;
// The stomp: STOMP_WIND_MS of a crouch with the shadow showing, STOMP_AIR_MS
// in the air STOMP_APEX high, and the two waves SLAM_WAVE_MS after she lands.
export const STOMP_WIND_MS = 600;
export const STOMP_AIR_MS = 800;
export const STOMP_APEX = 14;
export const SLAM_WAVE_MS = 260;
// The tide: TIDE_WARN_MS of warning, then the water over the planks TIDE_MS.
export const TIDE_WARN_MS = 1500;
export const TIDE_MS = 3200;
// The drowning pull: PULL_WIND_MS of stirring, then PULL_MS of the water
// dragging you on the planks toward her at PULL_V (PULL_V_FURY furious).
export const PULL_WIND_MS = 650;
export const PULL_MS = 2200;
export const PULL_V = 15;
export const PULL_V_FURY = 19;
// Call the drowned: CALL_WIND_MS of boiling mud, then a bog body out of each
// spot, CALL_FAR from you, at most BODIES_CAP of hers alive.
export const CALL_WIND_MS = 800;
export const CALL_FAR = 11;
export const BODIES_CAP = 2;
// The wisp lantern: LANTERN_WIND_MS raising it, then WISPS_N of her wisps, at
// most WISPS_CAP alive.
export const LANTERN_WIND_MS = 700;
export const WISPS_N = 2;
export const WISPS_CAP = 2;
// The combo, furious only: a move that ends in an idle goes straight on after
// COMBO_GAP_MS, COMBO_CHANCE of the time, never twice in a row.
export const COMBO_GAP_MS = 260;
export const COMBO_CHANCE = 0.5;
// How many picks a move sits out after it is used.
export const COOLDOWN = freeze({ shell: 3, tide: 4, dive: 2, brood: 3, drowned: 4, wisps: 4, pull: 2 });
// Each move's weight by phase (full health, under half, under a quarter); a
// MORE move waits for NEW_MOVES_AT in the first phase.
export const WEIGHTS = freeze({
  wave: freeze([3, 2, 1.5]),
  spit: freeze([3, 2, 1.5]),
  hands: freeze([3, 2.5, 2.5]),
  surge: freeze([2, 2.5, 2.5]),
  shell: freeze([2.2, 2, 2.4]),
  dive: freeze([1.6, 1.8, 1.8]),
  double: freeze([2, 2.5, 2.5]),
  volley: freeze([2, 2.5, 2.5]),
  brood: freeze([1.6, 1.6, 1.6]),
  stomp: freeze([0, 3, 3]),
  tide: freeze([0, 1.6, 1.6]),
  pull: freeze([0, 2, 2.5]),
  drowned: freeze([0, 1.6, 1.6]),
  wisps: freeze([0, 0, 2]),
});
const MORE = new Set(["double", "volley", "brood"]);

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ------------------------------------------------------------ monsters */

// Two eyes at the waterline: unseen till you cross it, then a snap out of
// the water, solid and lunging, and a sink back to eyes.
function moveLurker(round, m, ms, k) {
  const you = round.you;
  const dt = ms / 1000;
  if (m.act === "snap") {
    m.wait = Math.max(0, m.wait - ms);
    k.walk(round, m, k.towardYou(round, m), SNAP_V * round.spec.pace, dt);
    if (m.wait) return;
    m.act = "sink";
    m.wait = LURKER_SINK_MS;
    round.events.push({ type: "lurkerSink", kind: m.kind, x: m.x, y: m.y });
    return;
  }
  if (m.act === "sink") {
    m.wait = Math.max(0, m.wait - ms);
    if (m.wait) return;
    m.act = "eyes";
    return;
  }
  m.dir = k.towardYou(round, m);
  if (Math.abs(you.x - m.x) < SNAP_RANGE && Math.abs(you.y - m.y) < SNAP_HIGH && you.out <= 0) {
    m.act = "snap";
    m.wait = SNAP_MS;
    round.events.push({ type: "lurkerSnap", kind: m.kind, x: m.x, y: m.y + 1, dir: m.dir });
  }
}

// Drifting along its floor toward you; contact is a latch (one heart, cause
// `leeches`, then it drops off and drifts again once it can).
function moveLeech(round, m, ms, k) {
  const you = round.you;
  const spec = round.spec;
  const dt = ms / 1000;
  m.latchIn = Math.max(0, (m.latchIn || 0) - ms);
  if (m.act === "drop") {
    m.wait = Math.max(0, m.wait - ms);
    if (m.wait) return;
    m.act = "drift";
    return;
  }
  const hitH = you.ducking ? k.DUCK_H : k.HIT_H;
  const touch = Math.abs(you.x - m.x) < (k.HIT_W + m.w * 0.8) / 2 && you.y < m.y + m.h * 0.9 && you.y + hitH > m.y + m.h * 0.1;
  if (touch && !(m.latchIn > 0) && you.out <= 0) {
    m.act = "drop";
    m.wait = LEECH_DROP_MS;
    m.latchIn = LEECH_AGAIN_MS;
    round.events.push({ type: "leechLatch", kind: m.kind, x: m.x, y: m.y });
    k.struck(round, "leeches");
    return;
  }
  const dir = k.towardYou(round, m);
  k.walk(round, m, dir, MONSTERS.leech.speed * spec.pace, dt);
  m.dir = dir;
}

// A mud-caked riser: it climbs out of the muck (harmless till up, the
// zombie rule), then shambles and lurches like one. A horde one, or one out
// of a door, is already up.
function moveBogbody(round, m, ms, k) {
  const you = round.you;
  if (m.act === "rise") {
    if (m.horde) {
      m.act = "walk";
    } else {
      if (!(m.rise > 0)) {
        m.rise = BOG_RISE_MS;
        round.events.push({ type: "bogRise", kind: m.kind, x: m.x, y: m.y });
      }
      m.rise = Math.max(0, m.rise - ms);
      if (!m.rise) m.act = "walk";
      return;
    }
  }
  const near = Math.abs(you.x - m.x) < LURCH_RANGE && Math.abs(you.y - m.y) < 6;
  k.walk(round, m, k.towardYou(round, m), (near ? MONSTERS.bogbody.lurch : MONSTERS.bogbody.speed) * round.spec.pace, ms / 1000);
  m.lurching = near;
}

// A drifting light: while bright it wanders toward your chest (its dips are
// duckable), while dim it sinks and waits out its relight, and while
// rekindling it glows where it will burn again.
function moveWisp(round, m, ms, k) {
  const you = round.you;
  const spec = round.spec;
  const dt = ms / 1000;
  if (m.act === "dim") {
    m.wait = Math.max(0, m.wait - ms);
    const floor = k.groundAt(spec, m.x);
    if (Number.isFinite(floor)) m.y = Math.max(floor + 0.6, m.y - 18 * dt);
    if (m.wait) return;
    if (m.relight) {
      m.x = m.relight.x;
      m.y = m.relight.y;
    }
    m.act = "rekindle";
    m.wait = WISP_REKINDLE_MS;
    round.events.push({ type: "wispRelight", kind: m.kind, x: m.x, y: m.y });
    return;
  }
  if (m.act === "rekindle") {
    m.wait = Math.max(0, m.wait - ms);
    if (m.wait) return;
    m.act = "bright";
    round.events.push({ type: "wispOn", kind: m.kind, x: m.x, y: m.y });
    return;
  }
  const speed = MONSTERS.wisp.speed * spec.pace;
  const ty = you.y + k.SHOT_Y - m.h / 2;
  const dx = you.x - m.x;
  const dy = ty - m.y;
  const d = Math.hypot(dx, dy) || 1;
  m.x += (dx / d) * speed * dt;
  m.y += (dy / d) * speed * dt;
  m.y += Math.sin(m.t / 190 + m.id) * 4 * dt;
  m.dir = Math.sign(dx) || m.dir;
  m.y = Math.max(k.groundAt(spec, m.x) + 0.6, Math.min(k.CHANDELIER_Y, m.y));
}

// A bolt puts a bright wisp out (never hurt: it is light), starting its
// rekindle clock and seeding the spot it will burn again from its id.
function wispShot(round, m, s, k) {
  if (m.kind !== "wisp" || m.act !== "bright") return 1;
  m.act = "dim";
  m.wait = WISP_RELIGHT_MS;
  m.vx = 0;
  m.vy = 0;
  const spec = round.spec;
  const rx = clamp(m.x + (((m.id * 37) % 23) - 11), 4, spec.length - 4);
  m.relight = { x: rx, y: Math.min(k.CHANDELIER_Y, Math.max(k.groundAt(spec, rx) + 7, 10)) };
  round.events.push({ type: "wispOut", kind: m.kind, x: m.x, y: m.y + m.h / 2 });
  return 0;
}

// A dispersed swarm is told so (its voice lands with the art).
function leechDies(round, m) {
  round.events.push({ type: "leechDie", kind: m.kind, x: m.x, y: m.y + m.h / 2 });
}

/* --------------------------------------------------------- the wisp lure */

// The stage's twist, run each slice: the dead inside a bright wisp's light
// are pulled toward you and run quicker, till the wisp dims or they drift
// out of it. In another stage's room it never touches `lure` or `hasteMs`:
// those fields are another pack's there (the grounds' moth call).
function bogTick(round, ms) {
  if (round.stage !== "bog") return;
  const wisps = [];
  for (const w of round.monsters) if (!w.dead && w.kind === "wisp" && w.act === "bright") wisps.push(w);
  for (const m of round.monsters) {
    if (m.dead || m.kind === "wisp") continue;
    let near = false;
    for (const w of wisps) {
      if (Math.hypot(m.x - w.x, m.y - w.y) <= WISP_LURE) {
        near = true;
        break;
      }
    }
    if (near) {
      if (!(m.lure > 0)) round.events.push({ type: "wispLure", kind: m.kind, x: m.x, y: m.y + m.h });
      m.lure = LURE_HOLD_MS;
      m.hasteMs = LURE_HOLD_MS;
      m.haste = WISP_HASTE;
    } else if (m.lure > 0) {
      m.lure = 0;
      m.hasteMs = 0;
      m.haste = 1;
    }
  }
}

/* ------------------------------------------------------------ the hag */

const motherWait = (round, b, v) => (v * (b.fury ? MOTHER_FURY : b.raged ? MOTHER_QUICK : 1)) / round.spec.pace;

// Her phase: 0 at full health, 1 once she has gone under at half, 2 furious.
export const phaseOf = (b) => (b.fury ? 2 : b.raged ? 1 : 0);

// Her whole body on one plank height: the middle and both sides, so she is
// never drawn hanging over a gap.
const planked = (spec, x, w, y, k) => [-0.45, 0, 0.45].every((f) => k.groundAt(spec, x + f * w) === y);

// The acts in which she is not standing on the boards: under the water, rising
// out of it, charging waist deep or in the air. Everywhere else she is planked.
export const UNSTOOD = freeze(["sink", "under", "surge", "stompAir"]);
// The acts she keeps her facing through (the way she dived, charged or leapt).
const FIXED = new Set(["sink", "under", "resurface", "surge", "stompAir"]);
// The acts a dive at half (or a quarter) of her hp waits for the end of.
const NO_DIVE = new Set(["sink", "under", "resurface", "surge", "stompAir"]);

// How many of her own adds of `kind` are alive.
export const hagAdds = (round, kind) => round.monsters.filter((m) => !m.dead && m.hag && m.kind === kind).length;
const CAPS = freeze({ brood: ["leech", BROOD_CAP], drowned: ["bogbody", BODIES_CAP], wisps: ["wisp", WISPS_CAP] });

// Her next move: the wave to open, then a weighted pick by phase that favors a
// change (the same move again is possible, a third time running is not), with
// the slow moves sitting out COOLDOWN picks and a summon only while her adds
// are under their cap (`round`, when given, is where they are counted).
// `b.plan` forces one (tests, scripted fights). It keeps its own count:
// `b.picks`, `b.last`, `b.streak` and `b.cool` (the pick each move is free again).
export function pickAttack(b, random, round = null) {
  let pick = null;
  if (b.plan) {
    pick = b.plan;
    b.plan = null;
  } else if (!b.picks) pick = "wave";
  else {
    const p = phaseOf(b);
    const more = b.hp <= b.max * NEW_MOVES_AT || p > 0;
    const w = {};
    for (const [n, by] of Object.entries(WEIGHTS)) {
      let v = by[p];
      if (MORE.has(n) && !more) v = 0;
      if (b.cool && b.cool[n] > b.picks) v = 0;
      if (round && CAPS[n] && hagAdds(round, CAPS[n][0]) >= CAPS[n][1]) v = 0;
      if (n === b.last) v *= b.streak >= 2 ? 0 : 0.35;
      w[n] = v;
    }
    const names = Object.keys(w).filter((n) => w[n] > 0);
    let r = random() * names.reduce((s, n) => s + w[n], 0);
    pick = names[0] || "wave";
    for (const n of names) {
      pick = n;
      if ((r -= w[n]) < 0) break;
    }
  }
  b.picks = (b.picks || 0) + 1;
  b.streak = pick === b.last ? (b.streak || 1) + 1 : 1;
  b.last = pick;
  if (COOLDOWN[pick]) b.cool = { ...(b.cool || {}), [pick]: b.picks + COOLDOWN[pick] + 1 };
  return pick;
}

// The plank nearest `x` within reach, as { x, y }, or null over open water.
function plankAt(spec, x, k) {
  for (const d of [0, 2, -2, 4, -4, 6, -6]) {
    const g = k.groundAt(spec, x + d);
    if (Number.isFinite(g)) return { x: x + d, y: g };
  }
  return null;
}

// The nearest spot to `x` inside the arena where her whole body is on the
// planks, searching out to `reach` either way (first toward `toward`), or null.
function standAt(round, b, x, k, reach = 24, toward = x) {
  const spec = round.spec;
  const lo = k.arenaMin(round, b);
  const hi = k.arenaMax(round, b);
  const s = Math.sign(toward - x) || 1;
  for (let d = 0; d <= reach; d += 0.5) {
    for (const c of [x + s * d, x - s * d]) if (c >= lo && c <= hi && planked(spec, c, b.w, b.floor, k)) return c;
  }
  return null;
}

// A mud wave off her edge, rolling `dir` along the planks.
function sendWave(round, b, dir, k, extra = {}) {
  const x = b.x + dir * (b.w / 2);
  const floor = k.groundAt(round.spec, x);
  if (!Number.isFinite(floor)) return;
  round.waves.push({ x, y: floor, dir, life: 6000, kind: "mudwave", cause: "mudwave" });
  round.events.push({ type: "mudWave", kind: b.kind, x, y: floor, dir, ...extra });
}

// A muck patch on the plank nearest `x`, landing after `warn`; returns it.
function sendMuck(round, x, warn, sx, sy, k) {
  const spec = round.spec;
  const spot = plankAt(spec, clamp(x, spec.arena + 2, spec.length - 2), k);
  if (!spot) return null;
  const h = { kind: "muck", x: spot.x, y: spot.y, w: MUCK_W, h: MUCK_H, warn, live: 0, cause: "muck", sx, sy };
  round.hazards.push(h);
  return h;
}

// Her own wisps, once put out, are gone for good (a room's wisps relight).
function snuffWisps(round) {
  if (!round.monsters.some((m) => m.hag && m.kind === "wisp" && m.act !== "bright")) return;
  for (const m of round.monsters) if (m.hag && m.kind === "wisp" && m.act !== "bright") m.dead = true;
  round.monsters = round.monsters.filter((m) => !m.dead);
}

// Goes under: from a dive at half or a quarter of her hp, or her own `dive`
// move. Down at once: a box she slides through you with while nothing can
// hurt her is a hit you could not answer.
function dive(round, b, relocate) {
  b.relocate = relocate;
  b.act = "sink";
  b.wait = MOTHER_SINK_MS;
  b.hidden = true;
  b.lit = false;
  b.shell = 0;
  b.echo = 0;
  b.slam = 0;
  b.y = b.floor - (b.h + 4);
  round.events.push({ type: "motherSink", kind: b.kind, x: b.x, y: b.floor, relocate });
}

// Back to drifting: a quick idle, or, furious, now and then straight on into
// the next move (never twice running), her eye flaring first.
function toIdle(round, b, random, idle) {
  b.act = "idle";
  if (b.fury && !b.combo && random() < COMBO_CHANCE) {
    b.combo = true;
    b.wait = COMBO_GAP_MS;
    b.comboMs = COMBO_GAP_MS + 200;
    round.events.push({ type: "motherCombo", kind: b.kind, x: b.x, y: b.y + b.h });
    return;
  }
  b.combo = false;
  b.wait = idle();
}

// What each move does as it starts, from idle: its wind-up act, its wait and
// its event (the telegraph), and anything placed now that warns before it hurts.
function startMove(round, b, move, k, wait) {
  const you = round.you;
  const spec = round.spec;
  const p = phaseOf(b);
  const ev = (type, extra = {}) => round.events.push({ type, kind: b.kind, x: b.x, y: b.y + b.h * 0.6, dir: b.dir, ...extra });
  b.move = move;
  if (move === "wave" || move === "double") {
    b.act = "wind";
    b.double = move === "double";
    b.wait = wait(MOTHER_WIND_MS);
    ev("motherWind");
  } else if (move === "spit" || move === "volley") {
    b.act = "throwWind";
    b.volley = move === "volley";
    b.wait = wait(SPIT_WIND_MS);
    round.events.push({ type: "spitWind", kind: b.kind, x: b.x + b.dir * b.w * 0.3, y: b.y + b.h * 0.55, dir: b.dir });
  } else if (move === "hands") {
    // Ripples where you stand and HAND_GAP either side (the way you run
    // first), each warning before its hand bursts up.
    b.act = "hands";
    const ahead = Math.sign(you.vx) || you.face || 1;
    const offs = [0, ahead * HAND_GAP, -ahead * HAND_GAP, ahead * HAND_GAP * 2].slice(0, HANDS_N[p]);
    const xs = [];
    offs.forEach((o, i) => {
      const spot = plankAt(spec, clamp(you.x + o, spec.arena + 2, spec.length - 2), k);
      if (!spot || xs.some((x) => Math.abs(x - spot.x) < HAND_W) || Math.abs(spot.x - b.x) < b.w / 2 + HAND_W / 2) return;
      xs.push(spot.x);
      const warn = HANDS_WIND_MS + HAND_WARN_MS + i * HAND_STAGGER_MS;
      round.hazards.push({ kind: "boghand", x: spot.x, y: spot.y, w: HAND_W, h: HAND_H, warn, full: warn, live: 0, cause: "boghand", id: i });
    });
    b.wait = HANDS_WIND_MS + HAND_WARN_MS + HAND_STAGGER_MS * Math.max(0, xs.length - 1) + HAND_UP_MS;
    ev("handsWind", { xs });
  } else if (move === "surge") {
    b.act = "surgeWind";
    b.wait = wait(SURGE_WIND_MS);
    ev("surgeWind");
  } else if (move === "shell") {
    b.act = "shellWind";
    b.wait = wait(SHELL_WIND_MS);
    ev("shellWind");
  } else if (move === "dive") {
    dive(round, b, true);
  } else if (move === "brood") {
    b.act = "broodWind";
    b.wait = wait(BROOD_WIND_MS);
    ev("broodWind", { x: b.x + b.dir * (b.w * 0.5 + 1.6), y: b.y + 2 });
  } else if (move === "stomp") {
    // The shadow shows where she will come down: where you stand now.
    b.act = "stompWind";
    b.landX = standAt(round, b, you.x, k, 24, b.x) ?? b.x;
    b.wait = wait(STOMP_WIND_MS);
    ev("stompWind", { landX: b.landX });
  } else if (move === "tide") {
    // The warning is never cut short: it is the time to reach a shelf.
    b.act = "tideWind";
    b.wait = TIDE_WARN_MS;
    const x0 = spec.arena;
    round.hazards.push({ kind: "tide", x: (x0 + spec.length) / 2, y: b.floor - 1, w: spec.length - x0 + 8, h: 1.6, x0, x1: spec.length, warn: TIDE_WARN_MS, live: 0, cause: "tide" });
    ev("tideWarn");
  } else if (move === "pull") {
    b.act = "pullWind";
    b.wait = wait(PULL_WIND_MS);
    ev("pullWind", { y: b.floor });
  } else if (move === "drowned") {
    // Mud boils CALL_FAR either side of you, on planks, off her and off you.
    b.act = "callWind";
    b.wait = wait(CALL_WIND_MS);
    const n = Math.max(0, BODIES_CAP - hagAdds(round, "bogbody"));
    const xs = [];
    for (const o of [CALL_FAR, -CALL_FAR, CALL_FAR * 1.6, -CALL_FAR * 1.6]) {
      if (xs.length >= n) break;
      const spot = plankAt(spec, clamp(you.x + o, spec.arena + 3, spec.length - 3), k);
      if (spot && Math.abs(spot.x - you.x) >= 6 && Math.abs(spot.x - b.x) >= b.w && !xs.some((x) => Math.abs(x - spot.x) < 4)) xs.push(spot.x);
    }
    b.callXs = xs;
    ev("callWind", { xs, y: b.floor });
  } else if (move === "wisps") {
    b.act = "lanternWind";
    b.wait = wait(LANTERN_WIND_MS);
    ev("lanternWind", { x: b.x - b.dir * 1.2, y: b.y + b.h + 3 });
  }
}

function moveMother(round, b, ms, random, k) {
  const you = round.you;
  const spec = round.spec;
  const dt = ms / 1000;
  const wait = (v) => motherWait(round, b, v);
  // An idle wait that never comes out the same twice.
  const idle = () => wait(MOTHER_IDLE_MS * (1 - IDLE_JITTER + 2 * IDLE_JITTER * random()));
  // The plank height she stands on, kept through every dive and charge.
  if (b.floor === undefined) b.floor = b.home ?? b.y;
  b.home = b.floor;
  if (!b.act) {
    b.act = "idle";
    b.wait = idle();
  }
  b.wait -= ms;
  b.comboMs = Math.max(0, (b.comboMs || 0) - ms);
  snuffWisps(round);
  if (!FIXED.has(b.act)) b.dir = Math.sign(you.x - b.x) || b.dir;
  // At half her hp she goes under, and comes back up meaner; at a quarter she
  // does it again and comes back furious (never cutting off a dive, a charge
  // or a leap in progress).
  const first = !b.sank && b.hp <= b.max * MOTHER_RAGE && !NO_DIVE.has(b.act);
  const second = b.sank && !b.sank2 && (b.act === "idle" || b.act === "rest") && b.hp <= b.max * MOTHER_FURY_AT;
  if (first || second) {
    b.sank = true;
    b.raged = true;
    if (second) {
      b.sank2 = true;
      b.fury = true;
    }
    if (b.act === "surge" || b.act === "stompAir") b.y = b.floor;
    dive(round, b, false);
    return;
  }
  // The cauldron opens late in a rest, and stays open while she reels from a
  // broken shell: a shot then counts triple (see `weak`).
  const open = (b.act === "rest" && b.wait <= wait(MOTHER_OPEN_MS)) || b.act === "stagger";
  if (open && !b.lit) round.events.push({ type: "cauldronOpen", kind: b.kind, x: b.x + b.dir * b.w * 0.3, y: b.y + b.h * 0.35 });
  b.lit = open;
  if (b.act === "idle") {
    // She drifts to keep some plank between her and you (closer the angrier
    // she is), never stepping off the boards onto open water: her whole body
    // stays on one plank, and if she is ever put down half over a gap she
    // walks to the nearest plank that holds her.
    const keep = b.fury ? MOTHER_KEEP_FURY : b.raged ? MOTHER_KEEP_RAGED : MOTHER_KEEP;
    const speed = MOTHER_WALK * spec.pace * (b.fury ? 1.7 : b.raged ? 1.3 : 1);
    const side = Math.sign(b.x - you.x) || 1;
    const lo = k.arenaMin(round, b);
    const hi = k.arenaMax(round, b);
    let goal = clamp(you.x + side * keep, lo, hi);
    if (!planked(spec, b.x, b.w, b.y, k)) goal = standAt(round, b, b.x, k, 14) ?? b.x;
    if (Math.abs(goal - b.x) > 0.05 && planked(spec, goal, b.w, b.y, k)) {
      const nx = b.x + Math.sign(goal - b.x) * Math.min(Math.abs(goal - b.x), speed * dt);
      if (planked(spec, nx, b.w, b.y, k) || !planked(spec, b.x, b.w, b.y, k)) b.x = nx;
    }
    if (b.wait > 0) return;
    // Her next move: a weighted pick, not a turn (the wave opens the fight).
    const move = pickAttack(b, random, round);
    b.attacks++;
    startMove(round, b, move, k, wait);
    return;
  }
  if (b.act === "wind") {
    if (b.wait > 0) return;
    sendWave(round, b, b.dir, k);
    // A double wave sends a second one behind the first, from her rest.
    b.echo = b.double ? wait(DOUBLE_GAP_MS) : 0;
    b.double = false;
    b.act = "rest";
    b.wait = wait(MOTHER_REST_MS);
    return;
  }
  if (b.act === "throwWind") {
    if (b.wait > 0) return;
    const sx = b.x + b.dir * b.w * 0.35;
    const sy = b.y + b.h * 0.55;
    const at = { type: "cauldronSpit", kind: b.kind, x: sx, y: sy };
    const x = clamp(you.x, spec.arena + 2, spec.length - 2);
    const spot = sendMuck(round, x, MUCK_LAND_MS, sx, sy, k);
    if (spot) Object.assign(at, { tx: spot.x, ty: spot.y });
    // A volley: three patches at once, one on you and one a spread either
    // side, landing a beat apart so there is no standing still and no single
    // safe step.
    if (b.volley) {
      b.volley = false;
      const ahead = (Math.sign(you.vx) || you.face || 1) * MUCK_SPREAD;
      for (const [px, n] of [[x + ahead, 1], [x - ahead, 2]]) {
        const p = plankAt(spec, clamp(px, spec.arena + 2, spec.length - 2), k);
        if (!p || (spot && Math.abs(p.x - spot.x) < MUCK_W)) continue;
        sendMuck(round, p.x, MUCK_LAND_MS + n * VOLLEY_STAGGER_MS, sx, sy, k);
        Object.assign(at, n === 1 ? { tx2: p.x, ty2: p.y } : { tx3: p.x, ty3: p.y });
      }
    } else if (b.raged) {
      // Meaner: a second patch lands ahead of where you run.
      const ahead = (Math.sign(you.vx) || you.face || 1) * MUCK_LEAD;
      let x2 = clamp(x + ahead, spec.arena + 2, spec.length - 2);
      if (Math.abs(x2 - x) < MUCK_W) x2 = clamp(x - ahead, spec.arena + 2, spec.length - 2);
      const p = plankAt(spec, x2, k);
      if (p && (!spot || p.x !== spot.x)) {
        sendMuck(round, p.x, MUCK_LAND_MS, sx, sy, k);
        Object.assign(at, { tx2: p.x, ty2: p.y });
      }
    }
    round.events.push(at);
    b.act = "idle";
    b.wait = wait(MOTHER_REST_MS);
    return;
  }
  if (b.act === "hands") {
    // Her arms are in the water while the hands are up: a still target.
    if (b.wait > 0) return;
    toIdle(round, b, random, idle);
    return;
  }
  if (b.act === "surgeWind") {
    if (b.wait > 0) return;
    // Waist deep, she charges at and past where you stand, through planks and
    // water alike, and stops on a plank that holds her.
    const dir = Math.sign(you.x - b.x) || b.dir;
    b.dir = dir;
    const lo = k.arenaMin(round, b);
    const hi = k.arenaMax(round, b);
    let to = clamp(you.x + dir * SURGE_PAST, lo, hi);
    // Pinned in a corner, she stops short of you instead.
    if (Math.abs(to - you.x) < 6) to = clamp(you.x - dir * 8, lo, hi);
    b.surgeTo = standAt(round, b, to, k, 30, b.x) ?? b.x;
    b.y = b.floor - SURGE_SINK;
    b.act = "surge";
    b.wait = 4000;
    round.events.push({ type: "motherSurge", kind: b.kind, x: b.x, y: b.floor, dir, to: b.surgeTo });
    return;
  }
  if (b.act === "surge") {
    const v = SURGE_V * spec.pace * (b.fury ? 1.2 : 1);
    const d = b.surgeTo - b.x;
    b.x += Math.sign(d) * Math.min(Math.abs(d), v * dt);
    if (Math.abs(b.surgeTo - b.x) > 0.01 && b.wait > 0) return;
    b.x = b.surgeTo;
    b.y = b.floor;
    b.act = "rest";
    b.wait = wait(MOTHER_REST_MS);
    return;
  }
  if (b.act === "shellWind") {
    if (b.wait > 0) return;
    b.act = "shell";
    b.shell = SHELL_HP[phaseOf(b)];
    b.shellMax = b.shell;
    b.wait = wait(SHELL_MS);
    return;
  }
  if (b.act === "shell") {
    // Not broken in time (see shellShot): she ladles herself a feed.
    if (b.wait > 0) return;
    const heal = Math.min(SHELL_HEAL, b.max - b.hp);
    b.hp += heal;
    b.shell = 0;
    round.events.push({ type: "motherFeed", kind: b.kind, x: b.x + b.dir * (b.w * 0.5 + 1.6), y: b.y + 3, heal });
    toIdle(round, b, random, idle);
    return;
  }
  if (b.act === "stagger") {
    if (b.wait > 0) return;
    toIdle(round, b, random, idle);
    return;
  }
  if (b.act === "broodWind") {
    if (b.wait > 0) return;
    const n = Math.min(BROOD_N, BROOD_CAP - hagAdds(round, "leech"));
    const out = [];
    for (let i = 0; i < n; i++) {
      const spot = plankAt(spec, clamp(b.x + b.dir * (b.w * 0.5 + 2 + i * 3.5), spec.arena + 2, spec.length - 2), k);
      if (!spot) continue;
      const m = k.spawnMonster(round, "leech", spot.x, spot.y, { hag: true, force: true, latchIn: 300 });
      if (m) out.push(m.x);
    }
    round.events.push({ type: "broodPour", kind: b.kind, x: b.x + b.dir * (b.w * 0.5 + 1.6), y: b.y + 2, n: out.length });
    toIdle(round, b, random, idle);
    return;
  }
  if (b.act === "stompWind") {
    if (b.wait > 0) return;
    b.act = "stompAir";
    b.fromX = b.x;
    b.airMs = 0;
    b.dir = Math.sign(b.landX - b.x) || b.dir;
    b.wait = 4000;
    round.events.push({ type: "motherLeap", kind: b.kind, x: b.x, y: b.floor, landX: b.landX });
    return;
  }
  if (b.act === "stompAir") {
    b.airMs += ms;
    const air = STOMP_AIR_MS / spec.pace;
    const p = Math.min(1, b.airMs / air);
    b.x = b.fromX + (b.landX - b.fromX) * p;
    b.y = b.floor + 4 * STOMP_APEX * p * (1 - p);
    if (p < 1) return;
    b.x = b.landX;
    b.y = b.floor;
    b.slam = SLAM_WAVE_MS;
    b.act = "rest";
    b.wait = wait(MOTHER_REST_MS);
    round.events.push({ type: "motherSlam", kind: b.kind, x: b.x, y: b.floor });
    return;
  }
  if (b.act === "tideWind") {
    if (b.wait > 0) return;
    b.act = "tideHold";
    b.wait = TIDE_MS;
    return;
  }
  if (b.act === "tideHold") {
    if (b.wait > 0) return;
    toIdle(round, b, random, idle);
    return;
  }
  if (b.act === "pullWind") {
    if (b.wait > 0) return;
    b.act = "pull";
    b.wait = PULL_MS;
    round.events.push({ type: "motherPull", kind: b.kind, x: b.x, y: b.floor, dir: b.dir });
    return;
  }
  if (b.act === "pull") {
    // The water drags you along the planks toward her while you stand on
    // them (never over the edge of one: the boards hold you there). The air
    // or a shelf is out of its reach.
    if (you.state === "run" && you.shelf < 0 && you.out <= 0 && you.x > spec.arena) {
      const v = (b.fury ? PULL_V_FURY : PULL_V) * spec.pace;
      const nx = you.x + Math.sign(b.x - you.x) * Math.min(Math.abs(b.x - you.x), v * dt);
      if (k.groundAt(spec, nx) === you.y && k.groundAt(spec, nx + Math.sign(b.x - you.x) * 1.2) === you.y) you.x = nx;
      you.pulled = true;
    } else you.pulled = false;
    if (b.wait > 0) return;
    you.pulled = false;
    toIdle(round, b, random, idle);
    return;
  }
  if (b.act === "callWind") {
    if (b.wait > 0) return;
    const xs = (b.callXs || []).slice(0, Math.max(0, BODIES_CAP - hagAdds(round, "bogbody")));
    for (const x of xs) k.spawnMonster(round, "bogbody", x, k.groundAt(spec, x), { hag: true, force: true, act: "rise" });
    b.callXs = [];
    round.events.push({ type: "motherCall", kind: b.kind, x: b.x, y: b.floor, xs });
    toIdle(round, b, random, idle);
    return;
  }
  if (b.act === "lanternWind") {
    if (b.wait > 0) return;
    const n = Math.min(WISPS_N, WISPS_CAP - hagAdds(round, "wisp"));
    for (let i = 0; i < n; i++) {
      const x = clamp(b.x - b.dir * (1.2 + i * 3), spec.arena + 2, spec.length - 2);
      k.spawnMonster(round, "wisp", x, b.floor + b.h + 2 + i * 2.5, { hag: true, force: true, act: "bright" });
    }
    round.events.push({ type: "motherLantern", kind: b.kind, x: b.x - b.dir * 1.2, y: b.floor + b.h + 3, n });
    toIdle(round, b, random, idle);
    return;
  }
  if (b.act === "rest") {
    // The second wave of a double, and the two of a stomp's landing.
    if (b.echo > 0 && (b.echo -= ms) <= 0) {
      b.echo = 0;
      sendWave(round, b, b.dir, k, { echo: true });
    }
    if (b.slam > 0 && (b.slam -= ms) <= 0) {
      b.slam = 0;
      for (const d of [-1, 1]) sendWave(round, b, d, k, { slam: true });
    }
    if (b.wait > 0) return;
    b.act = "idle";
    b.wait = idle();
    return;
  }
  if (b.act === "sink") {
    if (b.wait > 0) return;
    // Where she comes back up: on a plank near you, never on top of you.
    const lo = spec.arena + 4 + b.w / 2;
    const hi = spec.length - 4 - b.w / 2;
    let spot = null;
    // The near spots in an order that starts somewhere different each dive,
    // so she is not always up on the same side of you.
    const near = [RESURFACE_NEAR, -RESURFACE_NEAR, RESURFACE_NEAR * 1.7, -RESURFACE_NEAR * 1.7, RESURFACE_NEAR * 2.4, -RESURFACE_NEAR * 2.4];
    const from = Math.floor(random() * near.length) % near.length;
    for (const d of [...near.slice(from), ...near.slice(0, from)]) {
      const x = clamp(you.x + d, lo, hi);
      if (Math.abs(x - you.x) >= 6 && planked(spec, x, b.w, b.floor, k)) {
        spot = x;
        break;
      }
    }
    if (spot === null) for (const d of [0, 8, -8]) {
      const x = clamp(b.x + d, lo, hi);
      if (Math.abs(x - you.x) >= 6 && planked(spec, x, b.w, b.floor, k)) {
        spot = x;
        break;
      }
    }
    b.sinkX = spot ?? clamp(b.x, lo, hi);
    b.act = "under";
    b.wait = BUBBLE_MS;
    round.events.push({ type: "motherBubble", kind: b.kind, x: b.sinkX, y: b.floor });
    return;
  }
  if (b.act === "under") {
    if (b.wait > 0) return;
    // Up at once where the bubbles showed, touchable and hittable again.
    b.x = b.sinkX;
    b.y = b.floor;
    b.hidden = false;
    b.act = "resurface";
    b.wait = RESURFACE_MS;
    round.events.push({ type: "motherRise", kind: b.kind, x: b.x, y: b.floor });
    return;
  }
  if (b.act === "resurface") {
    if (b.wait > 0) return;
    // Meaner, a dive of her own comes up with a mud wave each way.
    if (b.relocate && b.raged) for (const d of [-1, 1]) sendWave(round, b, d, k, { rise: true });
    b.relocate = false;
    b.act = "rest";
    b.wait = wait(MOTHER_REST_MS);
    return;
  }
}

// A muck patch: a glob in the air for `warn`, then burning for MUCK_MS
// where it came down. Returns whether it is still on the field.
function stepMuck(round, h, ms) {
  if (h.warn > 0) {
    h.warn = Math.max(0, h.warn - ms);
    if (h.warn > 0) return true;
    h.live = MUCK_MS;
    round.events.push({ type: "muckLand", x: h.x, y: h.y });
    return true;
  }
  h.live -= ms;
  return h.live > 0;
}

// A bog hand: a ripple for `warn`, then up out of the planks for HAND_UP_MS.
function stepHand(round, h, ms) {
  if (h.warn > 0) {
    h.warn = Math.max(0, h.warn - ms);
    if (h.warn > 0) return true;
    h.live = HAND_UP_MS;
    round.events.push({ type: "handsUp", kind: "motherbog", x: h.x, y: h.y });
    return true;
  }
  h.live -= ms;
  return h.live > 0;
}

// The tide: the water swelling for `warn`, then over every plank for TIDE_MS.
function stepTide(round, h, ms) {
  if (h.warn > 0) {
    h.warn = Math.max(0, h.warn - ms);
    if (h.warn > 0) return true;
    h.live = TIDE_MS;
    round.events.push({ type: "tideRise", kind: "motherbog", x: round.you.x, y: h.y + 1 });
    return true;
  }
  h.live -= ms;
  return h.live > 0;
}

// A bolt into her mud shell chips it instead of her; the last chip breaks it
// and leaves her reeling with the cauldron open (`stagger`).
function shellShot(round, s) {
  const b = round.boss;
  if (!b || b.kind !== "motherbog" || b.state !== "fight" || b.act !== "shell" || !(b.shell > 0)) return false;
  if (Math.abs(s.x - b.x) > b.w / 2 + 0.5 || s.y < b.y - 0.5 || s.y > b.y + b.h + 0.5) return false;
  b.shell = Math.max(0, b.shell - 1);
  b.hurt = 80;
  if (b.shell > 0) {
    round.events.push({ type: "shellChip", kind: b.kind, x: s.x, y: s.y, left: b.shell });
    return true;
  }
  b.act = "stagger";
  b.wait = STAGGER_MS;
  round.events.push({ type: "shellBreak", kind: b.kind, x: b.x, y: b.y + b.h / 2 });
  return true;
}

// A harpoon is the one bolt that reaches a lurker's eyes under the water:
// every other shot goes through them (they are `unseen`).
function harpoonShot(round, s, k) {
  if (s.arm !== "harpoon") return false;
  for (const m of round.monsters) {
    if (m.dead || m.kind !== "lurker" || !m.unseen || (s.hit || []).includes(m.id)) continue;
    if (Math.abs(s.x - m.x) > m.w / 2 + 0.5 || s.y < m.y - 0.5 || s.y > m.y + m.h + 0.5) continue;
    s.hit = [...(s.hit || []), m.id];
    k.hurt(round, m, s.dmg || 1, "harpoon");
    round.events.push({ type: "harpoonHit", kind: m.kind, x: s.x, y: s.y });
  }
  return false;
}

export const BOG = freeze({
  id: "bog",
  monsters: MONSTERS,
  walkers: freeze(["lurker", "leech"]),
  zombies: freeze(["bogbody"]),
  stackers: freeze(["bogbody"]),
  climbers: freeze(["bogbody"]),
  act: freeze({ lurker: "eyes", leech: "drift", wisp: "bright", bogbody: "rise" }),
  swoops: freeze({ wisp: (m) => m.act === "bright" }),
  // A lurker can hurt and be hit only while it is snapping; a dim or
  // rekindling wisp can do neither.
  solid: freeze({
    lurker: (m) => m.act === "snap",
    wisp: (m) => m.act === "bright",
  }),
  // A lurker's eyes are never solid: a stomp or a bolt passes over them.
  unseen: freeze({ lurker: (round, m) => m.act !== "snap" }),
  // The swarm never hurts by touch: it latches instead (see moveLeech).
  harmless: freeze({ leech: () => true }),
  move: freeze({ lurker: moveLurker, leech: moveLeech, wisp: moveWisp, bogbody: moveBogbody }),
  kill: freeze({ leech: leechDies }),
  horde: freeze({}),
  tick: freeze([bogTick]),
  shot: wispShot,
  // A harpoon finds a lurker's eyes; any bolt into her mud shell chips it.
  target: (round, s, k) => harpoonShot(round, s, k) || shellShot(round, s),
  bosses: BOSSES,
  boss: freeze({ motherbog: moveMother }),
  // She is gone while she is under, and shelled her mud takes the shots (see
  // shellShot) and a stomp glances off.
  guard: freeze({ motherbog: (b) => Boolean(b.hidden) || b.act === "shell" }),
  // A shot into the open cauldron counts triple.
  weak: freeze({ motherbog: (b) => (b.lit ? 3 : 1) }),
  cause: freeze({ motherbog: () => "motherbog" }),
  hazards: freeze({ muck: stepMuck, boghand: stepHand, tide: stepTide }),
});
