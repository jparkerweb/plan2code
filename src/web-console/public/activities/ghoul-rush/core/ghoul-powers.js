// Plan2Code Web Console - Ghoul Rush's power-ups and pickups: what each power-up does (POWERS), which can turn up where, picking one, and taking candy, power-ups, crystals and the key.
//
// No imports: ghoul.js hands the rules here a kit of its own helpers and
// numbers (landing, GRAVITY and the rest), the way it hands a
// stage pack its KIT, so this file never reaches back into it. ghoul.js
// re-exports what it always exported from here (POWERS, TIMED, powerHere,
// applyPower and the numbers), so its importers need not know.

// Power-ups: Spread shot, Rapid fire, the Lantern (the dark pulled back far
// around you, so only ever found in a dark room), Bat wings (one more jump in the air, a flap, each time you
// leave the ground, and a fall down a pit carries you back and spends them: wingSave in ghoul.js) and the Church bell (every monster but a boss stands
// frozen where it is, still deadly to touch, and none comes, till it stops
// or you go through the door), the Hedge shears (any shot kills a topiary
// beast or a rootling, and they are found only in The Grounds), Holy Water
// (bolts splash, hurt ghosts double and break stone, found only in The Chapel),
// the Smelling Salts (break an orderly's grab, light the flickers near you,
// found only in The Sanatorium) and the Bone Saw (bolts pierce, a gurney
// breaks in one hit, found only in The Sanatorium) and Wolfsbane (turned
// villagers and moonhounds shy away and take double damage, as does the Beast,
// found only in Hollow End Village) and Cotton Candy (bolts slow what they hit,
// found only in The Midnight Carnival) and Hot Cocoa (no sliding on the ice, no freezing, found only in The Frozen Lake) last their `ms`; the Hard Hat (`you.hat`,
// found only in The Deep Seam Mine) is worn till a rock bounces off it or an imp
// knocks it off;
// the secondary weapons (`arm: true`, see below) are not timed either; the Garlic shield shrugs off one hit (and sees off whatever
// touched you), a 1UP is a life (no limit), and the
// Hourglass puts HOURGLASS_MS on the room's clock (POWER_POINTS more where
// there is none). A Lucky die is kept for the run (ghoul-dice.js rolls it
// when a life would be lost), with no limit on how many, and
// turns up only as a drop (`drop: true`), as often as a 1UP. A kill (in
// ghoul.js) drops candy DROP_CANDY of the time and a power-up DROP_POWER, by
// `weight`.
export const POWERS = Object.freeze({
  spread: Object.freeze({ name: "Spread shot", blurb: "Three bolts at once", color: "#ff8a1f", ms: 8000, weight: 3 }),
  rapid: Object.freeze({ name: "Rapid fire", blurb: "65% more bolts", color: "#e04dd0", ms: 8000, weight: 3 }),
  garlic: Object.freeze({ name: "Garlic shield", blurb: "Shrugs off one hit", color: "#e6e0b8", weight: 2 }),
  life: Object.freeze({ name: "1UP", blurb: "An extra life", color: "#ff4fa3", weight: 1.5 }),
  lantern: Object.freeze({ name: "Lantern", blurb: "The dark pulls back", color: "#ffc857", ms: 15000, weight: 3, dark: true }),
  wings: Object.freeze({ name: "Bat wings", blurb: "Jump again, and catch a fall", color: "#a98bff", ms: 12000, weight: 3 }),
  bell: Object.freeze({ name: "Church bell", blurb: "The dead stand still", color: "#4fd1c5", ms: 4000, weight: 2 }),
  hourglass: Object.freeze({ name: "Hourglass", blurb: "More time on the clock", color: "#7fb4ff", weight: 2 }),
  // Found only as a drop from a kill, never placed in a room or swapped in for a placed one.
  die: Object.freeze({ name: "Lucky die", blurb: "Roll a 4 or better to cheat death", color: "#f4f1e8", weight: 1.5, drop: true }),
  // Never dropped: found only up high, where Bat wings reach (a room's `sky`).
  silver: Object.freeze({ name: "Silver bolts", blurb: "Bolts pass through the dead", color: "#d6e4f2", ms: 10000, weight: 0 }),
  // Found only in The Grounds: a shot that hits a topiary beast or a rootling kills it outright.
  shears: Object.freeze({ name: "Hedge shears", blurb: "Snip hedge beasts and roots", color: "#7fd86a", ms: 10000, weight: 3, stage: "grounds" }),
  // Found only in The Chapel: bolts splash, hurt ghosts double and break stone gargoyles.
  holy: Object.freeze({ name: "Holy Water", blurb: "Bolts splash and break stone", color: "#9fd8ff", ms: 10000, weight: 3, stage: "chapel" }),
  // Found only in The Sanatorium: breaks an orderly's grab, lights the flickers near you and doubles a bolt's damage to them.
  salts: Object.freeze({ name: "Smelling Salts", blurb: "Break grabs, light up flickers", color: "#c8f0d8", ms: 10000, weight: 3, stage: "sanatorium" }),
  // Found only in The Sanatorium: bolts pierce every monster in a line and a gurney breaks in one hit.
  saw: Object.freeze({ name: "Bone Saw", blurb: "Bolts pierce, gurneys break", color: "#e0d4b8", ms: 10000, weight: 3, stage: "sanatorium" }),
  // Found only in Hollow End Village: turned villagers and moonhounds shy away from you and take double damage, and so does the Beast.
  bane: Object.freeze({ name: "Wolfsbane", blurb: "Wolves shy away, double damage", color: "#a58ae0", ms: 10000, weight: 3, stage: "village" }),
  // Found only in the Deep Seam Mine: worn till a rock bounces off it or an imp knocks it off (no timer).
  hat: Object.freeze({ name: "Hard Hat", blurb: "Shrugs off one rock or imp", color: "#f2b630", weight: 3, stage: "mine" }),
  // Found only in The Midnight Carnival: a bolt that hits slows what it hits, for a while.
  floss: Object.freeze({ name: "Cotton Candy", blurb: "Sticky bolts slow what they hit", color: "#ff9ad5", ms: 10000, weight: 3, stage: "carnival" }),
  // Found only in The Frozen Lake: no sliding on the ice, no freezing, and thin ice you stand on cracks at half speed.
  cocoa: Object.freeze({ name: "Hot Cocoa", blurb: "No sliding, no freezing", color: "#c8793a", ms: 10000, weight: 3, stage: "frozen" }),
  // Found only in Gallows Bog: the sinking mud never slows or holds you.
  boots: Object.freeze({ name: "Stilt Boots", blurb: "The mud lets you go", color: "#b08d4f", ms: 10000, weight: 3, stage: "bog" }),
  // The secondary weapons, used by tapping fire twice (ghoul-arms.js has what each one does and ghoul-arms-draw.js how it looks).
  // Each is a bundle of `sticks` going into the bag up to `max`. Weight 0: pickPower never picks one, so they come
  // from a room's `items` and from their own band of a kill's drop roll (armDrop). No `stage`: common, anywhere.
  dyn: Object.freeze({ name: "Dynamite", blurb: "A lit stick and a wide blast", color: "#d9382c", weight: 0, arm: true, sticks: 2, max: 6, stageSticks: Object.freeze({ mine: 3 }) }),
  stake: Object.freeze({ name: "Iron Stake", blurb: "Goes through a whole line", color: "#9aa7b4", weight: 0, arm: true, sticks: 3, max: 6 }),
  rocket: Object.freeze({ name: "Bottle Rocket", blurb: "Three rockets: ahead, up and behind", color: "#ff5a4a", weight: 0, arm: true, sticks: 3, max: 6 }),
  // Each stage has one of its own, found only there, though what you pick up you keep.
  ball: Object.freeze({ name: "Billiard Ball", blurb: "Rolls along the floor", color: "#d8ccb0", weight: 0, arm: true, sticks: 2, max: 4, stage: "manor" }),
  skillet: Object.freeze({ name: "Cast-Iron Skillet", blurb: "Three pans circle, then fly out", color: "#b0603c", weight: 0, arm: true, sticks: 2, max: 4, stage: "wing" }),
  salt: Object.freeze({ name: "Grave Salt", blurb: "Burns the floor, the buried too", color: "#eef2f6", weight: 0, arm: true, sticks: 2, max: 3, stage: "graveyard" }),
  sickle: Object.freeze({ name: "Hedge Sickle", blurb: "Flies out and comes back", color: "#b6e05a", weight: 0, arm: true, sticks: 2, max: 4, stage: "grounds" }),
  fork: Object.freeze({ name: "Tuning Fork", blurb: "A ring that cracks stone", color: "#c9b8ff", weight: 0, arm: true, sticks: 2, max: 3, stage: "chapel" }),
  flash: Object.freeze({ name: "Flash Powder", blurb: "Dazes all near, shows the hidden", color: "#fff27a", weight: 0, arm: true, sticks: 2, max: 3, stage: "sanatorium" }),
  pie: Object.freeze({ name: "Custard Pie", blurb: "Splat and stun a crowd", color: "#f5e6a8", weight: 0, arm: true, sticks: 2, max: 4, stage: "carnival" }),
  trap: Object.freeze({ name: "Silver Bear Trap", blurb: "Set at your feet, it snaps", color: "#d0dcea", weight: 0, arm: true, sticks: 2, max: 3, stage: "village" }),
  flare: Object.freeze({ name: "Road Flare", blurb: "Burns a patch, melts the veil", color: "#ff4a2e", weight: 0, arm: true, sticks: 2, max: 4, stage: "frozen" }),
  harpoon: Object.freeze({ name: "Harpoon", blurb: "Pierces, reaches under water", color: "#7fa8b0", weight: 0, arm: true, sticks: 2, max: 4, stage: "bog" }),
});
const POWER_ORDER = Object.freeze(Object.keys(POWERS));
// The word on a timed power-up's pill.
export const PILL_WORDS = Object.freeze({ spread: "SPREAD", rapid: "RAPID", lantern: "LANTERN", wings: "WINGS", bell: "BELL", silver: "SILVER", shears: "SHEARS", holy: "HOLY", salts: "SALTS", saw: "SAW", bane: "BANE", hat: "HARD HAT", floss: "FLOSS", cocoa: "COCOA", boots: "BOOTS" });
// The power-ups that run on a timer, in the order their pills show.
export const TIMED = Object.freeze(POWER_ORDER.filter((k) => POWERS[k].ms));
// Bat wings never flap with a surface this close under a fall.
export const FLAP_CLEAR = 4;
export const HOURGLASS_MS = 20000;

// Each stage's own weapon (the Mine's own is Dynamite).
export const STAGE_ARMS = Object.freeze({ manor: "ball", wing: "skillet", graveyard: "salt", grounds: "sickle", chapel: "fork", sanatorium: "flash", village: "trap", mine: "dyn", carnival: "pie", frozen: "flare", bog: "harpoon" });
// A kill's drop roll (ghoul.js) goes to a weapon in a band of ARM_DROP past the
// power-ups and candy, no extra draw, so it shifts no other roll: about one every
// two rooms. Where in the band it fell picks which: the stage's own first
// (ARM_DROP_OWN of the band), then the common ones.
export const ARM_DROP = 0.05;
export const ARM_DROP_OWN = 0.4;
export function armDrop(round, t) {
  const own = STAGE_ARMS[round.stage];
  if (own && t < ARM_DROP_OWN) return own;
  const k = own ? (t - ARM_DROP_OWN) / (1 - ARM_DROP_OWN) : t;
  return k < 0.45 ? "stake" : k < 0.9 ? "rocket" : "dyn";
}

// How long the weapon's icons pop when the bag changes (`round.armPopMs`).
export const ARM_POP_MS = 450;

// A bundle of a weapon into the bag: it goes on top (the latest picked up comes
// out first). Returns whether any fitted: past its `max` it is points instead.
export function addArm(round, kind) {
  const def = POWERS[kind];
  const at = round.arms.findIndex((a) => a.kind === kind);
  const had = at < 0 ? 0 : round.arms[at].n;
  if (at >= 0) round.arms.splice(at, 1);
  round.arms.unshift({ kind, n: Math.min(def.max, had + (def.stageSticks?.[round.stage] ?? def.sticks)) });
  round.armPopMs = ARM_POP_MS;
  return had < def.max;
}

// Points for what you pick up (the rest are in ghoul.js): candy, and a
// power-up on top of what it does.
export const CANDY_POINTS = 10;
export const POWER_POINTS = 50;
// A crystal up where only Bat wings reach.
export const CRYSTAL_POINTS = 250;

const award = (round, points) => {
  round.score += points;
};

// Whether the power-up `kind` can turn up in the room as it is now. A rule of
// its own (like the Lantern's `dark`, or the Hedge shears' `stage`, the only
// stage they turn up in) goes in POWERS and is checked here.
export const powerHere = (round, kind) => (!POWERS[kind].dark || round.dark) && (!POWERS[kind].stage || round.stage === POWERS[kind].stage);

// A power-up by `weight`, of those that can turn up here, `skip` left out.
// Ones found only as a drop (`drop`) are picked only for `dropping`.
export function pickPower(random, round, skip = "", dropping = false) {
  const ok = POWER_ORDER.filter((k) => k !== skip && (dropping || !POWERS[k].drop) && powerHere(round, k));
  const total = ok.reduce((s, k) => s + POWERS[k].weight, 0);
  let r = random() * total;
  for (const k of ok) if ((r -= POWERS[k].weight) < 0) return k;
  return ok[0];
}

// A power-up taken: a timed one starts, or adds its time to what is left of
// the same one already running; the rest act at once. `kit` is ghoul.js's kit.
export function applyPower(round, kind, kit) {
  const you = round.you;
  if (TIMED.includes(kind)) round.effects[kind] = (round.effects[kind] || 0) + POWERS[kind].ms;
  else if (kind === "garlic") you.garlic = true;
  else if (kind === "hat") you.hat = true;
  else if (kind === "hourglass") {
    if (round.timeMs > 0) round.timeMs += HOURGLASS_MS;
    else award(round, POWER_POINTS);
  }
  else if (kind === "life") {
    round.lives++;
  } else if (kind === "die") {
    round.dice++;
  } else if (POWERS[kind].arm && !addArm(round, kind)) award(round, POWER_POINTS);
}

// Candy, power-ups and the key, taken by touching them; dropped ones fall
// to the floor first and fade after a while.
export function pickups(round, ms, kit) {
  const dt = ms / 1000;
  const you = round.you;
  const spec = round.spec;
  const near = (x, y, r) => Math.abs(x - you.x) < kit.HIT_W / 2 + r && y > you.y - r && y < you.y + kit.HIT_H + r;
  spec.candyAt.forEach((c, k) => {
    if (round.candy[k] || !near(c.x, c.y, 0.9)) return;
    round.candy[k] = true;
    eatCandy(round, c.x, c.y);
  });
  spec.items.forEach(([, x, y], k) => {
    if (round.items[k] || !near(x, y + 1.6, 1.2)) return;
    round.items[k] = true;
    takePower(round, round.loot[k], x, y + 1.6, kit);
  });
  spec.sky.forEach(([kind, x, y], k) => {
    if (round.sky[k] || !near(x, y, 1.2)) return;
    round.sky[k] = true;
    if (kind !== "crystal") return takePower(round, kind, x, y, kit);
    award(round, CRYSTAL_POINTS);
    round.stats.crystals++;
    round.events.push({ type: "crystal", x, y, points: CRYSTAL_POINTS });
  });
  let n = 0;
  for (const d of round.drops) {
    d.life -= ms;
    if (!d.rest) {
      d.vy = Math.max(-kit.FALL_MAX, d.vy - kit.GRAVITY * dt);
      const py = d.y;
      d.y += d.vy * dt;
      const f = d.vy < 0 ? kit.landing(round, d.x, py, d.y, -1) : null;
      if (f) {
        d.y = f.y + 1;
        d.rest = true;
      }
    }
    if (d.y < kit.PIT_Y || d.life <= 0) continue;
    if (near(d.x, d.y, 1)) {
      if (d.kind === "candy") eatCandy(round, d.x, d.y);
      else takePower(round, d.kind, d.x, d.y, kit);
      continue;
    }
    round.drops[n++] = d;
  }
  round.drops.length = n;
  if (spec.key && !round.hasKey && near(spec.key[0], spec.key[1] + 1.6, 1.2)) {
    round.hasKey = true;
    round.events.push({ type: "key", x: spec.key[0], y: spec.key[1] + 1.6 });
    if (spec.darkOnKey) {
      round.dark = true;
      round.events.push({ type: "keyDark", x: spec.key[0], y: spec.key[1] + 1.6 });
    }
  }
}

function eatCandy(round, x, y) {
  award(round, CANDY_POINTS);
  round.stats.candy++;
  round.events.push({ type: "candy", x, y, points: CANDY_POINTS });
}

function takePower(round, kind, x, y, kit) {
  applyPower(round, kind, kit);
  award(round, POWER_POINTS);
  // Till you have used a weapon, each one picked up says how.
  round.events.push({ type: "power", kind, x, y, points: POWER_POINTS, teach: Boolean(POWERS[kind].arm && !round.armUsed) });
}

/* ------------------------------------------------------------ retry mercy */

// Retry mercy: each time a room starts again after a loss in it (a crash or the
// clock running out, both end in respawn()), one power-up pickup is set a few steps
// ahead of Planny, again on every later restart of that room until it is cleared
// (setupRoom and clearRoom reset `round.retries = { room, n }`). Never in a ride or
// bonus room, which have checkpoints and hearts of their own.
//
// The kind comes from its own hash of (seed, room, retry count) through a fresh
// seeded stream, never the round's shared rng, so a run with no death rolls as it
// always did and a death shifts no later roll. It goes through pickPower, so
// stage-only power-ups turn up only in their stage and the Lantern only in the
// dark; the 1UP is skipped by hand (no free lives) and so is a pick that would be
// wasted just now (Hourglass where the clock is off, a Garlic shield or Hard Hat
// already worn). The Lucky die is drop-only and the weapons weigh 0, so
// pickPower never picks either.
export const MERCY_NEAR = 3;
export const MERCY_FAR = 9;
export const MERCY_LIFE_MS = 1e9;
const MERCY_TRIES = 8;

// A 32-bit mix of three numbers (a murmur-style finalizer).
export function mix3(a, b, c) {
  let h = (a ^ Math.imul(b + 1, 0x9e3779b1) ^ Math.imul(c + 1, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}

// The kind for retry `n` of this room: from (seed, room, n) and the room's rules alone.
export function mercyKind(round, n, kit) {
  const roll = kit.seeded(mix3(round.seed >>> 0, round.room, n));
  for (let i = 0; i < MERCY_TRIES; i++) {
    const kind = pickPower(roll, round, "life");
    if (kind === "life" || POWERS[kind].arm || POWERS[kind].drop) continue;
    if (kind === "hourglass" && !(round.timeMs > 0)) continue;
    if ((kind === "garlic" && round.you.garlic) || (kind === "hat" && round.you.hat)) continue;
    return kind;
  }
  return "spread";
}

// Where it sits: MERCY_FAR down to MERCY_NEAR ahead of Planny, the first spot
// that is firm on both sides (the ground or a standing shelf within a step of
// his height, not a crumbling board, not the edge of a pit, not over a belt or
// water the room marks), inside the room (or the boss's arena). Null if none.
export function mercySpot(round, kit) {
  const { spec, you } = round;
  const dir = you.face >= 0 ? 1 : -1;
  const bad = (x) => [...(spec.belts || []), ...(spec.water || []), ...(spec.mud || [])].some((s) => x >= s[0] - 1 && x <= s[1] + 1);
  const firm = (x) => {
    const s = kit.footing(round, x, you.y);
    return s && (s.shelf < 0 || spec.shelves[s.shelf][3] !== "crumble") ? s : null;
  };
  for (let d = MERCY_FAR; d >= MERCY_NEAR; d -= 0.5) {
    const x = you.x + dir * d;
    if (x < kit.leftEdge(round) + 1 || x > kit.rightEdge(round) - 1 || bad(x)) continue;
    const s = firm(x);
    if (s && firm(x - 1) && firm(x + 1)) return { x, y: s.y };
  }
  return null;
}

// Called by respawn() once Planny is back: counts the retry and sets out the
// pickup, taking away the last one nobody picked up.
export function retryMercy(round, kit) {
  if (round.bonusRound || round.spec.ride || round.spec.bonus) return false;
  if (!round.retries || round.retries.room !== round.room) round.retries = { room: round.room, n: 0 };
  const n = ++round.retries.n;
  round.drops = round.drops.filter((d) => !d.mercy);
  const spot = mercySpot(round, kit);
  if (!spot) return false;
  const kind = mercyKind(round, n, kit);
  round.drops.push({ id: 0, kind, x: spot.x, y: spot.y + 1, vx: 0, vy: 0, life: MERCY_LIFE_MS, rest: true, mercy: true });
  round.events.push({ type: "retry", kind, x: spot.x, y: spot.y + 1, n });
  return true;
}
