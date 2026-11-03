// Plan2Code Web Console - Ghoul Rush's Frozen Lake stage, its rules: slippery ice and cracking floors, the monsters of the lake (under-ice hands, snow shades you only see by their footprints, frozen ghouls that slide and shatter, ice wraiths whose dive leaves you frozen), Hot Cocoa, and its boss, the Frost Widow, as a stage pack that ghoul.js plugs in.
//
// Like the other stage packs (see ghoul-graveyard.js for what a pack holds,
// ghoul-sanatorium.js for `unseen`, ghoul-carnival.js for `swoops` and `guard`),
// every rule here is handed a kit `k` of ghoul.js's own helpers. The only import
// is `burrow` from the Graveyard, the way the Grounds' rootlings use it. The pack
// uses the fields `tick`, `place`, `unseen`, `solid`, `kill`, `target`, `land`,
// `weak`, `cause`, `guard`, `swoops`, `slides`, and draws NO random number, so
// every seed plays as it always did and a fight is the same every time.
//
// The stage's rooms, in order, are FROZEN_ROOMS; the bonus sled ride, the Coffin
// Sled (`sled`, ghoul-sled.js), comes between `blackice` and `widow`.
//
// TWO GENERIC ROOM RULES (they work in any room that has the field):
//
// - Slippery ice: a room's `ice` is a list of [x0, x1] spans of the floor. On the
//   floor in one, Planny's run speed eases toward the held direction at ICE_ACCEL a
//   second squared (ICE_BRAKE when he turns round) and, with no key held, decays at
//   ICE_FRICTION, so he slides about 8 units from a full run. A jump keeps what he
//   had (`you.glide`; with a key held the air eases toward it at ICE_AIR_ACCEL); a
//   wall stops it. Hot Cocoa (`round.effects.cocoa`) turns it off. ghoul.js asks
//   `iceRun` for his run each slice and keeps `you.slide` (units a second, signed),
//   `you.onIce` and `you.glide` for the art. A monster that is listed in `slides`
//   (a Frozen Ghoul) eases the same way over ICE_M_ACCEL and ICE_M_FRICTION (`m.sv`).
// - Thin ice: a room's `thin` is a list of [x0, x1] tiles of the floor (each on one
//   level piece of ground, with solid floor either side, narrow enough to jump as
//   a gap). `round.thin = { ground0, tiles }` holds each tile as { x0, x1, y, t,
//   state: "ok" | "crack" | "broken", back, hand }. Standing on a tile (on the
//   floor, running) adds time to `t`; stepping off lets it heal at THIN_HEAL of
//   the rate; Hot Cocoa halves how fast it grows (THIN_COCOA). At THIN_WARN_MS the
//   tile shows a crack (`iceCrack`); at THIN_MS it breaks (`iceBreak`): the floor
//   there is a pit until THIN_BACK_MS later (`iceBack`). The pit is real: the tile
//   is cut out of `round.spec.ground` (a new spec object, `spec.base.ground` keeps the
//   whole floor: the art must draw a tile from `round.thin`, not from `spec.ground`),
//   so walkers on it fall and leapers see a gap. Planny on it when it breaks
//   loses a life with the cause `ice` ("went through the ice", `lose`, so Lucky dice
//   and the endless-lives code treat it like any other); in the air he falls in as
//   into a pit. A hand (`crackTile`) can crack a tile early: it then breaks on its
//   own whether or not anyone stands there.
//
// The two together: `round.spec.ice` and `round.spec.thin` come from the room (the
// room builder in ghoul-rooms.js copies them).
//
// MONSTERS (acts, `m.act`):
//
// - Under-Ice Hand (`hand`): `trail`s under the ice toward you while
//   you are within HAND_NEAR on its floor (it cannot cross a pit or a step), `warn`
//   HAND_WARN_MS (`handWarn`), then, if a thin tile is over it, cracks that tile
//   (`iceCrack` with `by: "hand"`) and sinks; with none it bursts up (`grab`,
//   HAND_UP_MS, `handUp`; solid, hurts, can be shot or stomped), `sink`, `trail`.
// - Snow Shade (`shade`): out of sight (`m.unseen`, so it is not solid: bolts and
//   touch go through) except by its footprints (`m.prints`: { x, y, age } of the
//   last PRINT_KEEP steps, age in ms, drawn only while unseen). It stalks you at
//   its speed within SHADE_NEAR, then within SHADE_LUNGE_RANGE winds up
//   (`shadeWind`, SHADE_WIND_MS) and lunges (`shadeLunge`, SHADE_LUNGE_MS at
//   SHADE_LUNGE_V), rests SHADE_REST_MS. It is shown (`m.shownMs`, also Flash
//   Powder's and a flare's `m.litMs`) for SHADE_SHOW_MS whenever a bolt of yours is
//   coming at it (`shadeShow`, a bolt within SHADE_ALERT) or it attacks. Only a shown
//   one can hurt or be hurt. hp 3.
// - Frozen Ghoul (`frozen`): a zombie that slides on ice. Dying, it shatters
//   (`shatter`) into SHARDS: two `shard` hazards, after SHARD_WARN_MS one flies each way
//   at chest height (duck them or jump high), each for SHARD_LIFE_MS at SHARD_V,
//   cause `shard`. A flare burns it down with no shards.
// - Ice Wraith (`icewraith`): a wraith (hovers, shrieks, dives) that is a swooper,
//   so a ducked Planny is passed over. A dive that has gone CHILL_PAST beyond you
//   and is still within CHILL_R of you freezes you FREEZE_MS (`you.heldMs`, `freezeHit`): it leaves its chill as it
//   goes past, so a dodge is not free. Hot Cocoa is immune (`freezeHit` with
//   `immune`). A hit still costs a life (cause `icewraith`), a Garlic shield is
//   spent and the chill comes after.
//
// Hot Cocoa (`cocoa`, a stage-only power-up, ghoul-powers.js): no sliding, no
// freezing, thin ice cracks at half speed. The Road Flare is in ghoul-flare.js.
//
// THE FROST WIDOW hangs from the top of the cavern (`b.y` is her bottom edge:
// HANG_OVER over the floor while she hangs, the floor when she is `low`) and works
// in a cycle: `hang` (skitters along the roof toward you at HANG_V), `drop` to the
// floor LAND_AWAY from you (`widowDrop`), `low` (walks at you at LOW_V, stopping
// LOW_KEEP short), `rise` (`widowRise`), `hang`. Her touch costs a life (cause
// `frostwidow`) wherever her body is.
//
// - The veil (`b.veil`): while it is up, or she is off the floor, shots and stomps
//   glance off (`guard`: `bossBlock`). Three fire barrels (`barrel` hazards: a still
//   one is a `target` of your bolts, which kick it the way the bolt flew: it rolls at
//   BARREL_V, burning, along the floor (`barrelKick`), through monsters (BARREL_DMG,
//   once each) and into a wall (`barrelBurst`) or out of fuel) stand at BARREL_SPOTS
//   from the arena's start. A rolling barrel that touches her with the veil up melts
//   it (`veilMelt`, `veilDown`; the veil is down VEIL_DOWN_MS, VEIL_DOWN_RAGE_MS in a
//   rage): a barrel that meets her veil-less deals BARREL_BOSS instead. A flare's
//   fire does the same (`b.melt`). She stays low while the veil is down. When it grows
//   back (`veilUp`) the barrels that were used are set out again (`barrelPlace`).
// - While the veil is down and she is low, any shot hurts her (1). Her heart is her
//   underside (the lower HEART_TOP of her body, where a standing blaster's bolts
//   fly): it takes MOUTH_MULT times the damage (a `weak` hit, as the Keeper's lantern)
//   while her mouth is open (`b.mouth`: a web spit's wind-up and MOUTH_HOLD_MS after).
// - The blizzard (`round.twist.wind` = { state: "calm" | "warn" | "blow", ms, dir }):
//   the first BLIZZARD_FIRST_MS into the fight and then every BLIZZARD_EVERY_MS she
//   calls a wind (`blizzard`, state `warn` for BLIZZARD_WARN_MS), then it blows
//   BLIZZARD_MS (`blizzardBlow`, `blizzardEnd`): Planny is pushed away from her at
//   BLIZZARD_PUSH units a second on top of his own running (running into it nets 14),
//   half that (BLIZZARD_COVER) while he ducks or stands within COVER_NEAR of a barrel
//   that is between him and her. It is no damage: the danger is where it carries him.
// - Ice spikes (`spike` hazards): `spikeWarn` (a cracking line at your x,
//   SPIKE_WARN_MS), then `spikeUp`: SPIKE_UP_MS of a spike SPIKE_H high, SPIKE_W wide
//   (cause `spike`; jump it, step out of it, or stand on a board over its top). She
//   sends one at your x every SPIKE_EVERY_MS (SPIKE_LOW_MS while low); a rage sends a
//   second SPIKE_AHEAD in front of you at the same time.
// - Web spit (`webWind`, SPIT_WIND_MS with her mouth open, then `webShot`): a slow
//   `webGlob` hazard (WEB_FLIGHT_MS) that lands (`webLand`) as a `webPatch` WEB_W wide
//   for WEB_LIFE_MS. It hurts nothing; standing or walking in a patch keeps `you.slowMs`
//   up (the mourner's wail, half speed). A bolt can shoot a glob down.
// - Rage at WIDOW_RAGE of her hp (`widowRage`): every wait is RAGE_QUICK as long, two
//   spikes at once, the veil grows back sooner, the barrels are set out again, and she
//   calls Ice Wraiths (`wraithCall`) up to WRAITH_CAP alive, once at the rage and again
//   at each `drop`.
//
// WHAT THE ART READS: `round.you`: `slide`, `onIce`, `glide`, `heldMs` (frozen);
// `round.thin.tiles`; `round.spec.ice`; a shade's `m.unseen`, `m.shownMs`, `m.prints`;
// `m.act` for the hand (`lurk`, `trail`, `warn`, `grab`, `sink`) and the wraith
// (`idle`, `hover`, `wind`, `dive`, `rise`), a frozen ghoul's `m.sv`; hazards `shard`,
// `spike` (`warn` ms left, `live`), `webGlob`, `webPatch`, `barrel` (`state`: `still` |
// `roll`, `roll` the turn); the boss's `act`, `veil`, `veilMs`, `mouth`, `melt`; and
// `round.twist.wind`. The events are in EVENTS; the causes are `ice`, `shard`,
// `spike`, `frostwidow`, `icewraith`, `hand`, `frozen`, `shade`.

import { burrow } from "./ghoul-graveyard.js";

const freeze = (o) => Object.freeze(o);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const approach = (a, b, d) => (a < b ? Math.min(a + d, b) : Math.max(a - d, b));
// A kill that leaves nothing behind (a trap of the stage's own).
const NO_DROPS = () => 1;

export const MONSTERS = freeze({
  hand: freeze({ name: "Under-Ice Hand", w: 3, h: 3.2, hp: 2, speed: 16, points: 120, stomp: true, head: false, color: "#8fc4dc" }),
  shade: freeze({ name: "Snow Shade", w: 3, h: 5, hp: 3, speed: 7, points: 240, stomp: true, head: false, color: "#e8f2f8" }),
  frozen: freeze({ name: "Frozen Ghoul", w: 3, h: 5, hp: 4, speed: 9, lurch: 18, points: 130, stomp: true, head: true, color: "#a8d4e6" }),
  icewraith: freeze({ name: "Ice Wraith", w: 3, h: 4.2, hp: 2, speed: 12, points: 260, stomp: false, head: false, perch: true, flies: true, color: "#bfe9ff" }),
});

export const BOSSES = freeze({
  frostwidow: freeze({ name: "The Frost Widow", sub: "Melt her veil, then her heart", w: 10, h: 15, hp: 90, points: 3000, color: "#bfe4f2" }),
});

// Every event this pack puts on the field, for the art and the sounds to answer
// (a hit, a kill, a spawn, a throw and a boss's wake, hit and fall are the game's
// own; the Road Flare's are in ghoul-flare.js: `flareThrow`, `flareLand`).
export const EVENTS = freeze([
  "iceCrack", "iceBreak", "iceBack", "handWarn", "handUp", "shadeShow", "shadeWind", "shadeLunge", "shatter", "frozenMelt",
  "iceWraithWake", "iceWraithWind", "iceWraithDive", "freezeHit",
  "widowDrop", "widowRise", "widowRage", "veilMelt", "veilDown", "veilUp", "barrelPlace", "barrelKick", "barrelKnock", "barrelBurst",
  "blizzard", "blizzardBlow", "blizzardEnd", "spikeWarn", "spikeUp", "webWind", "webShot", "webLand", "wraithCall",
]);

// The stage's rooms, in order.
export const FROZEN_ROOMS = freeze(["huts", "lodge", "blackice", "sled", "widow"]);
const IN_FROZEN = new Set(FROZEN_ROOMS);

// Ice. Planny's run eases toward the held direction at ICE_ACCEL (ICE_BRAKE when he
// turns round), decays at ICE_FRICTION with no key held, and in the air a held key
// eases at ICE_AIR_ACCEL (units a second squared). A monster that slides uses the
// ICE_M_ pair and brakes at ICE_M_BRAKE.
export const ICE_ACCEL = 90;
export const ICE_BRAKE = 110;
export const ICE_FRICTION = 82.5;
export const ICE_AIR_ACCEL = 100;
export const ICE_M_ACCEL = 40;
export const ICE_M_BRAKE = 70;
export const ICE_M_FRICTION = 24;
// Thin ice: a crack shows at THIN_WARN_MS of standing on a tile and it breaks at
// THIN_MS, to come back THIN_BACK_MS later. Stepped off it heals at THIN_HEAL of the
// rate it grew; under Hot Cocoa it grows at THIN_COCOA of it.
export const THIN_WARN_MS = 500;
export const THIN_MS = 1300;
export const THIN_BACK_MS = 6000;
export const THIN_HEAL = 0.5;
export const THIN_COCOA = 0.5;

// An Under-Ice Hand tracks you within HAND_NEAR (and HAND_HIGH up or down) for up
// to HAND_TRAIL_MS or until it is under you, warns HAND_WARN_MS, is up HAND_UP_MS and
// sinks HAND_SINK_MS.
export const HAND_NEAR = 22;
export const HAND_HIGH = 4;
export const HAND_TRAIL_MS = 1500;
export const HAND_WARN_MS = 500;
export const HAND_UP_MS = 1000;
export const HAND_SINK_MS = 300;
// A Snow Shade: described above. Footprints are left every PRINT_STEP of travel.
export const SHADE_NEAR = 40;
export const SHADE_LUNGE_RANGE = 13;
export const SHADE_WIND_MS = 500;
export const SHADE_LUNGE_V = 28;
export const SHADE_LUNGE_MS = 650;
export const SHADE_REST_MS = 1400;
export const SHADE_SHOW_MS = 600;
export const SHADE_ALERT = 14;
export const PRINT_STEP = 2.2;
export const PRINT_KEEP = 7;
// A Frozen Ghoul sprints at `lurch` within LURCH_RANGE of you on its level.
export const LURCH_RANGE = 20;
// Its shards: SHARD_WARN_MS of tinkling, then they run at SHARD_V across the whole screen (a wall, a pit or the screen's edge ends one; SHARD_LIFE_MS is only a backstop); both ride
// SHARD_HIGH_Y over the floor, SHARD_HIGH_H tall (duck them).
// No more than SHARD_CAP at once.
export const SHARD_WARN_MS = 220;
export const SHARD_LIFE_MS = 6000;
export const SHARD_V = 26;
export const SHARD_W = 1.8;
export const SHARD_HIGH_Y = 2.8;
export const SHARD_HIGH_H = 1.2;
export const SHARD_CAP = 9;
// An Ice Wraith: like the house wraith (waits unseen till you are within
// ICEW_NEAR, hovers ICEW_KEEP ahead at no more than ICEW_ABOVE over you for
// ICEW_HOVER_MS, shrieks ICEW_WIND_MS, dives at ICEW_DIVE_V and on ICEW_PAST past
// you), but it hovers low enough for a tilted bolt to find it, and only one dives
// at a time (none while you are still frozen). As it passes you
// within CHILL_R it freezes you FREEZE_MS.
export const ICEW_NEAR = 60;
export const ICEW_KEEP = 26;
export const ICEW_ABOVE = 8.5;
export const ICEW_HOVER_MS = 1400;
export const ICEW_WIND_MS = 450;
export const ICEW_DIVE_V = 48;
export const ICEW_PAST = 18;
export const CHILL_R = 5.5;
export const CHILL_PAST = 3;
export const FREEZE_MS = 700;

// The Frost Widow.
export const HANG_OVER = 20;
export const HANG_V = 10;
export const FIRST_HANG_MS = 4200;
export const HANG_MS = 5200;
export const DROP_MS = 700;
export const RISE_MS = 800;
export const LOW_MS = 9000;
export const LOW_V = 4;
export const LOW_KEEP = 14;
export const LAND_AWAY = 32;
export const WIDOW_RAGE = 0.5;
export const RAGE_QUICK = 0.75;
export const WRAITH_CAP = 1;
// After a call, no wraith is called again for this long (ms): the rage's first one, then one every so often.
export const WRAITH_GAP_MS = 20000;
// A called wraith hovers this long (ms) before its first shriek, so it can be shot first.
export const WRAITH_CALL_MS = 1600;
// The veil, the heart and the mouth.
export const VEIL_DOWN_MS = 6000;
export const VEIL_DOWN_RAGE_MS = 4500;
export const HEART_TOP = 0.38;
export const MOUTH_MULT = 3;
// The barrels: at these offsets from the arena's start, rolling at BARREL_V for no
// more than BARREL_LIFE_MS, BARREL_DMG to each monster they meet, BARREL_BOSS to a
// veil-less Widow.
export const BARREL_SPOTS = freeze([30, 48, 66]);
export const BARREL_W = 3;
export const BARREL_H = 3.4;
export const BARREL_V = 34;
export const BARREL_LIFE_MS = 5000;
export const BARREL_DMG = 3;
export const BARREL_BOSS = 3;
// A still barrel shrugs off a stray bolt: it takes this many bolts to topple it (a thrown weapon kicks it at once).
export const BARREL_HITS = 4;
// The blizzard.
export const BLIZZARD_FIRST_MS = 7000;
export const BLIZZARD_EVERY_MS = 12000;
export const BLIZZARD_WARN_MS = 1000;
export const BLIZZARD_MS = 3000;
export const BLIZZARD_PUSH = 22;
export const BLIZZARD_COVER = 0.5;
export const COVER_NEAR = 5;
// The spikes.
export const SPIKE_FIRST_MS = 2200;
export const SPIKE_EVERY_MS = 3600;
export const SPIKE_LOW_MS = 4400;
export const SPIKE_WARN_MS = 800;
export const SPIKE_UP_MS = 1000;
export const SPIKE_W = 4;
export const SPIKE_H = 9.5;
export const SPIKE_AHEAD = 9;
// A spike waits this long (ms) at least after a wraith has begun to dive.
export const SPIKE_HOLD_MS = 900;
// The web.
export const SPIT_FIRST_MS = 3000;
export const SPIT_EVERY_MS = 5200;
export const SPIT_WIND_MS = 600;
export const MOUTH_HOLD_MS = 250;
export const WEB_FLIGHT_MS = 1500;
export const WEB_W = 5;
export const WEB_LIFE_MS = 6000;
export const WEB_SLOW_MS = 150;

const spanAt = (spans, x) => Boolean(spans) && spans.some(([x0, x1]) => x >= x0 && x <= x1);

/* ------------------------------------------------------ slippery ice (ghoul.js) */

// Planny's run for this slice, in units a second: `dir` the held direction (-1, 0 or
// 1), `speed` his top speed, `floor` whether he stands on the floor (not a shelf, not
// in the air). Off the ice, and on it under Hot Cocoa, it is the plain run.
export function iceRun(round, dir, speed, dt, floor) {
  const you = round.you;
  const target = dir * speed;
  if (floor && !(round.effects.cocoa > 0) && spanAt(round.spec.ice, you.x)) {
    you.glide = false;
    you.onIce = true;
    you.slide = approach(you.slide || 0, target, (!dir ? ICE_FRICTION : (you.slide || 0) * dir >= 0 ? ICE_ACCEL : ICE_BRAKE) * dt);
    return you.slide;
  }
  if (!floor) {
    // Left the ice by a jump or a fall: the speed he had carries on.
    if (you.onIce) {
      you.glide = true;
      you.onIce = false;
    }
    if (you.glide) {
      if (dir) you.slide = approach(you.slide || 0, target, ICE_AIR_ACCEL * dt);
      return you.slide || 0;
    }
  }
  you.glide = false;
  you.onIce = false;
  you.slide = target;
  return target;
}

// A monster that slides (a kind in `slides`) walks toward `dir` at `speed` with the
// same easing on the ice; off it, a plain walk.
export function slideWalk(round, m, dir, speed, dt, k) {
  const on = m.y === k.groundAt(round.spec, m.x) && spanAt(round.spec.ice, m.x);
  const target = dir * speed;
  if (!on) {
    m.sv = target;
    k.walk(round, m, dir, speed, dt);
    return;
  }
  const sv = m.sv || 0;
  m.sv = approach(sv, target, (!dir ? ICE_M_FRICTION : sv * dir >= 0 ? ICE_M_ACCEL : ICE_M_BRAKE) * dt);
  if (!m.sv) return;
  const was = m.x;
  k.walk(round, m, Math.sign(m.sv), Math.abs(m.sv), dt);
  if (m.x === was) m.sv = 0;
  if (dir) m.dir = dir;
}

/* --------------------------------------------------------------- thin ice */

// The floor `ground` with the broken tiles' spans cut out.
function cutGround(ground, holes) {
  const out = [];
  for (const [x0, x1, y] of ground) {
    let a = x0;
    for (const [h0, h1] of holes) {
      if (h1 <= a || h0 >= x1) continue;
      if (h0 > a) out.push([a, h0, y]);
      a = Math.max(a, h1);
    }
    if (a < x1) out.push([a, x1, y]);
  }
  return out;
}

// Whether Planny stands on the floor over the tile.
const onTile = (you, t) => you.out <= 0 && you.state === "run" && you.shelf < 0 && you.x >= t.x0 && you.x <= t.x1 && you.y <= t.y + 0.01;

// A tile cracked early (a hand's work): it goes on cracking by itself and breaks.
export function crackTile(round, t, by = "hand") {
  if (t.state === "broken" || t.hand) return false;
  t.hand = true;
  t.t = Math.max(t.t, THIN_WARN_MS);
  if (t.state !== "crack") {
    t.state = "crack";
    round.events.push({ type: "iceCrack", x: (t.x0 + t.x1) / 2, y: t.y, by });
  }
  return true;
}

// The thin tile (not yet broken) that has `x` over it, with a little to spare.
export const thinOver = (round, x) => (round.thin ? round.thin.tiles.find((t) => t.state !== "broken" && x >= t.x0 - 1 && x <= t.x1 + 1) || null : null);

function stepThin(round, ms, k) {
  const thin = round.thin;
  if (!thin) return;
  const you = round.you;
  const cocoa = round.effects.cocoa > 0;
  let changed = false;
  let under = null;
  for (const t of thin.tiles) {
    const mid = (t.x0 + t.x1) / 2;
    if (t.state === "broken") {
      t.back -= ms;
      if (t.back <= 0) {
        Object.assign(t, { state: "ok", t: 0, hand: false, back: 0 });
        changed = true;
        round.events.push({ type: "iceBack", x: mid, y: t.y });
      }
      continue;
    }
    if (onTile(you, t)) t.t += ms * (cocoa ? THIN_COCOA : 1);
    else if (t.hand) t.t += ms;
    else t.t = Math.max(0, t.t - ms * THIN_HEAL);
    if (t.t >= THIN_MS) {
      const here = onTile(you, t);
      Object.assign(t, { state: "broken", back: THIN_BACK_MS });
      changed = true;
      round.events.push({ type: "iceBreak", x: mid, y: t.y, under: here });
      if (here) under = t;
      continue;
    }
    const was = t.state;
    t.state = t.t >= THIN_WARN_MS ? "crack" : "ok";
    if (was === "ok" && t.state === "crack") round.events.push({ type: "iceCrack", x: mid, y: t.y, by: "you" });
  }
  if (!changed) return;
  round.spec = { ...round.spec, ground: cutGround(thin.ground0, thin.tiles.filter((t) => t.state === "broken").map((t) => [t.x0, t.x1])) };
  // Through the ice: a life, like a pit.
  if (under) k.lose(round, "ice");
}

/* ------------------------------------------------------------- the monsters */

function moveHand(round, m, ms, k) {
  const you = round.you;
  m.wait = Math.max(0, m.wait - ms);
  if (m.act === "warn") {
    if (m.wait) return;
    const tile = thinOver(round, m.x);
    if (tile) {
      crackTile(round, tile, "hand");
      m.act = "sink";
      m.wait = HAND_SINK_MS;
      return;
    }
    m.act = "grab";
    m.wait = HAND_UP_MS;
    round.events.push({ type: "handUp", kind: m.kind, x: m.x, y: m.y });
  } else if (m.act === "grab") {
    if (m.wait) return;
    m.act = "sink";
    m.wait = HAND_SINK_MS;
  } else if (m.act === "sink") {
    if (m.wait) return;
    m.act = "trail";
    m.wait = HAND_TRAIL_MS;
  } else {
    if (!m.go) {
      m.go = true;
      m.wait = HAND_TRAIL_MS;
    }
    // The hand only follows you while you are near on its floor.
    if (Math.abs(you.x - m.x) >= HAND_NEAR || Math.abs(you.y - m.y) >= HAND_HIGH || you.out > 0) {
      m.wait = HAND_TRAIL_MS;
      return;
    }
    const there = burrow(round, m, k, you.x, MONSTERS.hand.speed * round.spec.pace, ms / 1000);
    if (!there && m.wait) return;
    m.act = "warn";
    m.wait = HAND_WARN_MS;
    round.events.push({ type: "handWarn", kind: m.kind, x: m.x, y: m.y });
  }
}

// Whether a shade is out of sight just now: unless it was shot at, is attacking, or is lit.
const shadeUnseen = (round, m) => !(m.shownMs > 0 || m.litMs > 0);

function showShade(round, m, ms = SHADE_SHOW_MS) {
  if (!(m.shownMs > 0) && !(m.litMs > 0)) round.events.push({ type: "shadeShow", kind: m.kind, x: m.x, y: m.y + m.h / 2 });
  m.shownMs = Math.max(m.shownMs || 0, ms);
}

// A shade stalks, winds up, lunges and rests; its footprints are kept as it walks.
function moveShade(round, m, ms, k) {
  const you = round.you;
  const dt = ms / 1000;
  const dx = you.x - m.x;
  m.shownMs = Math.max(0, (m.shownMs || 0) - ms);
  m.prints ||= [];
  for (const p of m.prints) p.age += ms;
  if (m.prints.length && m.prints[0].age > 5000) m.prints.shift();
  m.dir = k.towardYou(round, m);
  if (m.act === "wind") {
    m.wait -= ms;
    m.shownMs = Math.max(m.shownMs, 200);
    if (m.wait > 0) return;
    m.act = "lunge";
    m.wait = SHADE_LUNGE_MS;
    round.events.push({ type: "shadeLunge", kind: m.kind, x: m.x, y: m.y + m.h / 2 });
    return;
  }
  if (m.act === "lunge") {
    m.wait -= ms;
    m.shownMs = Math.max(m.shownMs, 200);
    k.walk(round, m, m.dir, SHADE_LUNGE_V * round.spec.pace, dt);
    if (m.wait <= 0) {
      m.act = "rest";
      m.wait = SHADE_REST_MS;
    }
    return;
  }
  if (m.act === "rest") {
    m.wait -= ms;
    if (m.wait <= 0) m.act = "stalk";
    return;
  }
  if (Math.abs(dx) > SHADE_NEAR || you.out > 0) return;
  const was = m.x;
  k.walk(round, m, m.dir, MONSTERS.shade.speed * round.spec.pace, dt);
  m.walked = (m.walked || 0) + Math.abs(m.x - was);
  if (m.walked >= PRINT_STEP) {
    m.walked = 0;
    m.prints.push({ x: m.x, y: m.y, age: 0 });
    if (m.prints.length > PRINT_KEEP) m.prints.shift();
  }
  if (Math.abs(dx) < SHADE_LUNGE_RANGE && Math.abs(you.y - m.y) < 4) {
    m.act = "wind";
    m.wait = SHADE_WIND_MS;
    showShade(round, m);
    round.events.push({ type: "shadeWind", kind: m.kind, x: m.x, y: m.y + m.h / 2 });
  }
}

// A bolt of yours flying at a shade shows it for a moment, so the next one can hit.
function revealShades(round) {
  if (!round.shots.length) return;
  for (const m of round.monsters) {
    if (m.dead || m.kind !== "shade" || m.shownMs > 0) continue;
    for (const s of round.shots) {
      if ((m.x - s.x) * s.vx > 0 && Math.abs(m.x - s.x) < SHADE_ALERT && Math.abs(s.y - (m.y + m.h / 2)) < 3.5) {
        showShade(round, m);
        break;
      }
    }
  }
}

function moveFrozen(round, m, ms, k) {
  if (m.rise > 0) {
    m.rise = Math.max(0, m.rise - ms);
    return;
  }
  const you = round.you;
  const near = Math.abs(you.x - m.x) < LURCH_RANGE && Math.abs(you.y - m.y) < 6;
  slideWalk(round, m, k.towardYou(round, m), (near ? MONSTERS.frozen.lurch : MONSTERS.frozen.speed) * round.spec.pace, ms / 1000, k);
  m.lurching = near;
}

// It shatters, unless it was burned: two shards fly out at chest height, one each way, both ducked.
function frozenDies(round, m, how) {
  if (how === "flare") {
    round.events.push({ type: "frozenMelt", kind: m.kind, x: m.x, y: m.y + m.h / 2 });
    return;
  }
  round.events.push({ type: "shatter", kind: m.kind, x: m.x, y: m.y + m.h / 2 });
  if (round.hazards.filter((h) => h.kind === "shard").length > SHARD_CAP - 2) return;
  const toward = Math.sign(round.you.x - m.x) || 1;
  for (const dir of [toward, -toward]) {
    round.hazards.push({ kind: "shard", x: m.x + dir * 1.5, y: m.y + SHARD_HIGH_Y, off: SHARD_HIGH_Y, vx: dir * SHARD_V, w: SHARD_W, h: SHARD_HIGH_H, warn: SHARD_WARN_MS, life: SHARD_LIFE_MS, live: 0, cause: "shard" });
  }
}

// A shard: tinkles where it fell, then runs along the floor (a pit or a wall ends it).
function stepShard(round, h, ms, k) {
  if (h.warn > 0) {
    h.warn = Math.max(0, h.warn - ms);
    if (h.warn > 0) return true;
    h.live = 1;
  }
  h.life -= ms;
  if (h.life <= 0) return false;
  const nx = h.x + h.vx * (ms / 1000);
  const g = k.groundAt(round.spec, nx);
  if (g === -Infinity || g > h.y - h.off + 2) return false;
  if (nx < round.camX - 6 || nx > round.camX + k.FIELD_W + 6) return false;
  h.x = nx;
  h.y = g + h.off;
  return true;
}

function moveIceWraith(round, m, ms, k) {
  const dt = ms / 1000;
  const you = round.you;
  const spec = round.spec;
  const pace = spec.pace;
  if (m.act === "idle") {
    if (Math.abs(you.x - m.x) < ICEW_NEAR) {
      Object.assign(m, { act: "hover", wait: ICEW_HOVER_MS * 0.6 });
      round.events.push({ type: "iceWraithWake", kind: m.kind, x: m.x, y: m.y });
    }
    return;
  }
  if (m.act === "hover" || m.act === "rise") {
    const side = Math.sign(m.x - you.x) || 1;
    const tx = you.x + side * ICEW_KEEP;
    const ty = Math.min(m.home, you.y + ICEW_ABOVE) + Math.sin(m.t / 400) * 1.5;
    const step = MONSTERS.icewraith.speed * pace * (m.act === "rise" ? 1.8 : 1) * dt;
    m.x += clamp(tx - m.x, -step * 3, step * 3);
    m.y += clamp(ty - m.y, -step, step);
    m.dir = -side;
    if (m.act === "rise") {
      if (Math.abs(ty - m.y) < 1.5) Object.assign(m, { act: "hover", wait: ICEW_HOVER_MS });
      return;
    }
    m.wait -= ms * pace;
    const inView = m.x > round.camX + 2 && m.x < round.camX + k.FIELD_W - 2;
    // One dives at a time, and none at a Planny that is still frozen from the last.
    const busy = you.heldMs > 0 || round.monsters.some((o) => o !== m && o.kind === "icewraith" && !o.dead && (o.act === "wind" || o.act === "dive"));
    if (m.wait <= 0 && inView && !busy) {
      Object.assign(m, { act: "wind", wait: ICEW_WIND_MS });
      round.events.push({ type: "iceWraithWind", kind: m.kind, x: m.x, y: m.y });
    }
    return;
  }
  if (m.act === "wind") {
    m.wait -= ms;
    if (m.wait > 0) return;
    const tx = you.x - m.x;
    const ty = you.y + (k.YOU_H - m.h) / 2 - m.y;
    const d = Math.hypot(tx, ty) || 1;
    Object.assign(m, { act: "dive", vx: (tx / d) * ICEW_DIVE_V * pace, vy: (ty / d) * ICEW_DIVE_V * pace, left: d + ICEW_PAST, dir: Math.sign(tx) || m.dir, chilled: false });
    round.events.push({ type: "iceWraithDive", kind: m.kind, x: m.x, y: m.y });
    return;
  }
  m.x += m.vx * dt;
  m.y += m.vy * dt;
  m.left -= Math.hypot(m.vx, m.vy) * dt;
  const floor = k.groundAt(spec, m.x);
  if (floor > -Infinity && m.y < floor + 0.3) {
    m.y = floor + 0.3;
    m.vy = Math.max(0, m.vy);
  }
  // Gone past you (clear of where he stands, so a ducked Planny is not stood up under it), close: the chill.
  if (!m.chilled && (m.x - you.x) * Math.sign(m.vx || m.dir) > CHILL_PAST && you.out <= 0 && Math.hypot(m.x - you.x, m.y + m.h / 2 - (you.y + k.YOU_H / 2)) < CHILL_R) {
    m.chilled = true;
    if (round.effects.cocoa > 0) round.events.push({ type: "freezeHit", kind: m.kind, x: you.x, y: you.y + 2.4, immune: true });
    else {
      you.heldMs = Math.max(you.heldMs || 0, FREEZE_MS);
      round.events.push({ type: "freezeHit", kind: m.kind, x: you.x, y: you.y + 2.4, immune: false });
    }
  }
  if (m.left <= 0) m.act = "rise";
}

/* ------------------------------------------------------------ the Frost Widow */

const rage = (b) => b.hp <= b.max * WIDOW_RAGE;
const quick = (b, ms, round) => (ms * (b.raged ? RAGE_QUICK : 1)) / round.spec.pace;
const lerp = (a, b, t) => a + (b - a) * t;

// Her state, set when the room starts (and again after each life lost: the boss is
// made anew then): hanging, the veil up, the first of each wait running.
function initWidow(round, b, k) {
  const spec = round.spec;
  const floor = k.groundAt(spec, b.x);
  Object.assign(b, { fw: true, floor, act: "hang", wait: FIRST_HANG_MS, y: floor + HANG_OVER, veil: true, veilMs: 0, mouth: false, melt: false, raged: false, spikeIn: SPIKE_FIRST_MS, spitIn: SPIT_FIRST_MS, spitWind: 0, mouthMs: 0, lowMs: 0, fromY: 0, toX: b.x });
  round.twist = { wind: { state: "calm", ms: BLIZZARD_FIRST_MS, dir: 1 } };
  placeBarrels(round, b, k, { quiet: true });
}

// Every barrel spot without a barrel on it gets one; `fresh` first takes away every
// barrel there is (the rage's new set), `quiet` is the room's first set (no event).
function placeBarrels(round, b, k, { quiet = false, fresh = false } = {}) {
  const spec = round.spec;
  if (fresh) round.hazards = round.hazards.filter((h) => h.kind !== "barrel");
  for (const off of BARREL_SPOTS) {
    const x = spec.arena + off;
    if (round.hazards.some((h) => h.kind === "barrel" && h.state === "still" && Math.abs(h.x - x) < 1)) continue;
    round.hazards.push({ kind: "barrel", x, y: k.groundAt(spec, x), spot: off, state: "still", vx: 0, roll: 0, life: BARREL_LIFE_MS, hit: [], w: BARREL_W, h: BARREL_H, live: 0, cause: "" });
    if (!quiet) round.events.push({ type: "barrelPlace", x, y: k.groundAt(spec, x) });
  }
}

// A rolling barrel meets her: the veil melts. (A flare does the same through `b.melt`.)
function veilMelt(round, b, by) {
  if (!b.veil) return false;
  b.veil = false;
  b.veilMs = b.raged ? VEIL_DOWN_RAGE_MS : VEIL_DOWN_MS;
  round.events.push({ type: "veilMelt", kind: b.kind, x: b.x, y: b.y + b.h * 0.5, by });
  round.events.push({ type: "veilDown", kind: b.kind, x: b.x, y: b.y + b.h * 0.5, ms: b.veilMs });
  return true;
}

const spikeAt = (round, b, k, x) => {
  const spec = round.spec;
  const sx = clamp(x, spec.arena + 2, spec.length - 2);
  const y = k.groundAt(spec, sx);
  if (y === -Infinity) return;
  round.hazards.push({ kind: "spike", x: sx, y, w: SPIKE_W, h: SPIKE_H, warn: SPIKE_WARN_MS, up: SPIKE_UP_MS, live: 0, cause: "spike" });
  round.events.push({ type: "spikeWarn", kind: b.kind, x: sx, y });
};

// A spike: its cracking line for `warn`, then up for `up`, crushing what is in it.
function stepSpike(round, h, ms, k) {
  if (h.warn > 0) {
    h.warn = Math.max(0, h.warn - ms);
    if (h.warn > 0) return true;
    h.live = h.up;
    round.events.push({ type: "spikeUp", x: h.x, y: h.y });
    for (const m of round.monsters) if (!m.dead && Math.abs(m.x - h.x) < (h.w + m.w) / 2 && m.y < h.y + h.h && m.y + m.h > h.y && !k.stone(m)) k.hurt(round, m, 99, "crush", NO_DROPS);
    return true;
  }
  h.live -= ms;
  return h.live > 0;
}

// The glob of web flies slowly at where you stood, and lands as a patch.
function spit(round, b, k) {
  const you = round.you;
  const x0 = b.x + b.dir * b.w * 0.4;
  const y0 = b.y + b.h * 0.5;
  const spec = round.spec;
  const t = WEB_FLIGHT_MS / 1000;
  const tx = clamp(you.x, spec.arena + 2, spec.length - 2);
  const floor = k.groundAt(spec, tx);
  const dy = (Number.isFinite(floor) ? floor : b.floor) + 0.4 - y0;
  round.hazards.push({ kind: "webGlob", x: x0, y: y0, vx: (tx - x0) / t, vy: (dy + (k.BONE_G * t * t) / 2) / t, spin: 0, life: WEB_FLIGHT_MS * 2, w: 1.6, h: 1.6, live: 0, cause: "" });
  round.events.push({ type: "webShot", kind: b.kind, x: x0, y: y0 });
}

function stepGlob(round, h, ms, k) {
  const dt = ms / 1000;
  const spec = round.spec;
  const py = h.y;
  h.vy -= k.BONE_G * dt;
  h.x += h.vx * dt;
  h.y += h.vy * dt;
  h.spin += dt * 6;
  h.life -= ms;
  if (h.life <= 0 || h.y < k.PIT_Y) return false;
  if (h.vy >= 0) return true;
  let top = k.groundAt(spec, h.x);
  for (const [x0, x1, t] of spec.shelves) if (h.x >= x0 && h.x <= x1 && py >= t - 0.05 && t > top) top = t;
  if (h.y > top || py < top - 0.05) return true;
  round.hazards.push({ kind: "webPatch", x: h.x, y: top, life: WEB_LIFE_MS, max: WEB_LIFE_MS, w: WEB_W, h: 0.8, live: 0, cause: "" });
  round.events.push({ type: "webLand", x: h.x, y: top });
  return false;
}

// A patch of web: while you stand or walk in it (on its surface) you stay slowed.
function stepPatch(round, h, ms) {
  h.life -= ms;
  const you = round.you;
  if (you.out <= 0 && you.state === "run" && Math.abs(you.y - h.y) < 0.6 && Math.abs(you.x - h.x) < (h.w + 1.2) / 2) you.slowMs = Math.max(you.slowMs || 0, WEB_SLOW_MS);
  return h.life > 0;
}

// A barrel: still till a bolt kicks it, then it rolls burning along the floor.
function stepBarrel(round, h, ms, k) {
  if (h.state === "still") return true;
  const dt = ms / 1000;
  h.life -= ms;
  const burst = (why) => {
    round.events.push({ type: "barrelBurst", x: h.x, y: h.y, why });
    return false;
  };
  if (h.life <= 0) return burst("out");
  const dir = Math.sign(h.vx);
  const nx = h.x + h.vx * dt;
  const g = k.groundAt(round.spec, nx + dir * (h.w / 2));
  if (g === -Infinity || g > h.y + 1) return burst(g === -Infinity ? "pit" : "wall");
  // The arena's ends are walls.
  if (nx - h.w / 2 < round.spec.arena + 1 || nx + h.w / 2 > round.spec.length - 1) return burst("wall");
  h.x = nx;
  h.y = g;
  h.roll += h.vx * dt;
  for (const m of round.monsters) {
    if (m.dead || h.hit.includes(m.id) || !(k.solid(m) || k.stone(m)) || Math.abs(m.x - h.x) > (m.w + h.w) / 2 || m.y > h.y + h.h || m.y + m.h < h.y) continue;
    h.hit.push(m.id);
    k.hurt(round, m, BARREL_DMG, "burn", NO_DROPS);
  }
  if (round.monsters.some((m) => m.dead)) round.monsters = round.monsters.filter((m) => !m.dead);
  const b = round.boss;
  if (b && b.kind === "frostwidow" && b.state === "fight" && Math.abs(b.x - h.x) < (b.w + h.w) / 2 && b.y < h.y + h.h && b.y + b.h > h.y) {
    if (!veilMelt(round, b, "barrel")) k.hurtBoss(round, BARREL_BOSS, "burn");
    return burst("boss");
  }
  return true;
}

// A bolt (or a thrown weapon) that meets a web glob or a still barrel: the glob is
// shot down, the barrel is kicked the way the bolt flew.
function target(round, s) {
  for (const h of round.hazards) {
    if (h.kind !== "barrel" && h.kind !== "webGlob") continue;
    if (h.kind === "barrel" && h.state !== "still") continue;
    if (Math.abs(s.x - h.x) > h.w / 2 + 0.5 || s.y < h.y - 0.5 || s.y > h.y + h.h + 0.5) continue;
    if (h.kind === "webGlob") {
      h.life = 0;
      round.events.push({ type: "webLand", x: h.x, y: h.y, shot: true });
    } else if (!s.arm && (h.knocks = (h.knocks || 0) + 1) < BARREL_HITS) {
      round.events.push({ type: "barrelKnock", x: h.x, y: h.y, n: h.knocks });
    } else {
      h.state = "roll";
      h.vx = (Math.sign(s.vx) || 1) * BARREL_V;
      h.life = BARREL_LIFE_MS;
      round.events.push({ type: "barrelKick", x: h.x, y: h.y, dir: Math.sign(h.vx) });
    }
    return !s.arm;
  }
  return false;
}

// Up to WRAITH_CAP ice wraiths come in from the arena's edges.
function callWraiths(round, b, k) {
  const spec = round.spec;
  if (round.clock < (b.wraithAt || 0)) return;
  let alive = round.monsters.filter((m) => m.kind === "icewraith" && !m.dead).length;
  for (const [x, side] of [[spec.arena + 6, 1], [spec.length - 6, -1]]) {
    if (alive >= WRAITH_CAP) break;
    const y = b.floor + 22;
    if (k.spawnMonster(round, "icewraith", x, y, { act: "hover", wait: WRAITH_CALL_MS, home: y, dir: -side, force: true })) {
      alive++;
      b.wraithAt = round.clock + WRAITH_GAP_MS;
      round.events.push({ type: "wraithCall", kind: b.kind, x, y });
    }
  }
}

// The wind, once a fight is on: calm, a warning, then a push away from her.
function stepWind(round, b, ms, k) {
  const tw = round.twist;
  if (!tw || !tw.wind || b.state !== "fight") return;
  const w = tw.wind;
  const you = round.you;
  w.ms -= ms;
  if (w.state === "calm") {
    if (w.ms > 0) return;
    Object.assign(w, { state: "warn", ms: BLIZZARD_WARN_MS });
    round.events.push({ type: "blizzard", kind: b.kind, x: b.x, y: b.y + b.h * 0.5 });
    return;
  }
  if (w.state === "warn") {
    if (w.ms > 0) return;
    Object.assign(w, { state: "blow", ms: BLIZZARD_MS, dir: Math.sign(you.x - b.x) || w.dir });
    round.events.push({ type: "blizzardBlow", kind: b.kind, x: b.x, y: b.y + b.h * 0.5, dir: w.dir });
    return;
  }
  if (w.ms <= 0) {
    Object.assign(w, { state: "calm", ms: quick(b, BLIZZARD_EVERY_MS - BLIZZARD_WARN_MS - BLIZZARD_MS, round) });
    round.events.push({ type: "blizzardEnd", kind: b.kind });
    return;
  }
  if (you.out > 0 || round.stunMs > 0) return;
  // Cover: a crouch, or a barrel between him and her within COVER_NEAR.
  const covered = you.ducking || round.hazards.some((h) => h.kind === "barrel" && h.state === "still" && Math.abs(h.x - you.x) < COVER_NEAR && (h.x - you.x) * (b.x - you.x) > 0);
  const nx = you.x + w.dir * BLIZZARD_PUSH * (covered ? BLIZZARD_COVER : 1) * (ms / 1000);
  const lo = round.lockX >= 0 ? round.lockX + 1.5 : 1.5;
  const hi = round.spec.length - 1.5;
  if (k.groundAt(round.spec, nx + w.dir * 1.2) > you.y + 3) return;
  you.x = clamp(nx, lo, hi);
}

function moveWidow(round, b, ms, random, k) {
  if (!b.fw) initWidow(round, b, k);
  const you = round.you;
  const spec = round.spec;
  const dt = ms / 1000;
  b.dir = Math.sign(you.x - b.x) || b.dir;
  const lo = k.arenaMin(round, b);
  const hi = k.arenaMax(round, b);
  if (!b.raged && rage(b)) {
    b.raged = true;
    round.events.push({ type: "widowRage", kind: b.kind, x: b.x, y: b.y + b.h * 0.5 });
    placeBarrels(round, b, k, { fresh: true });
    callWraiths(round, b, k);
  }
  if (!b.veil) {
    b.veilMs -= ms;
    if (b.veilMs <= 0) {
      b.veil = true;
      round.events.push({ type: "veilUp", kind: b.kind, x: b.x, y: b.y + b.h * 0.5 });
      placeBarrels(round, b, k);
    }
  }
  if (b.melt) {
    b.melt = false;
    if (b.act === "low") veilMelt(round, b, "flare");
  }
  b.mouthMs = Math.max(0, b.mouthMs - ms);
  b.mouth = b.spitWind > 0 || b.mouthMs > 0;
  // Spikes and the web come on their own clocks, from the roof or the floor.
  if (b.act === "hang" || b.act === "low") {
    // No new spike while a wraith is shrieking or diving: one thing to dodge at a time.
    if (round.monsters.some((m) => m.kind === "icewraith" && !m.dead && (m.act === "wind" || m.act === "dive"))) b.spikeIn = Math.max(b.spikeIn, SPIKE_HOLD_MS);
    b.spikeIn -= ms;
    if (b.spikeIn <= 0) {
      b.spikeIn = quick(b, b.act === "low" ? SPIKE_LOW_MS : SPIKE_EVERY_MS, round);
      spikeAt(round, b, k, you.x);
      if (b.raged) spikeAt(round, b, k, you.x + (you.face || 1) * SPIKE_AHEAD);
    }
    if (b.spitWind > 0) {
      b.spitWind -= ms;
      if (b.spitWind <= 0) {
        b.spitWind = 0;
        b.mouthMs = MOUTH_HOLD_MS;
        spit(round, b, k);
      }
    } else {
      b.spitIn -= ms;
      if (b.spitIn <= 0) {
        b.spitIn = quick(b, SPIT_EVERY_MS, round);
        b.spitWind = SPIT_WIND_MS;
        round.events.push({ type: "webWind", kind: b.kind, x: b.x, y: b.y + b.h * 0.6 });
      }
    }
  }
  if (b.act === "hang") {
    b.x = clamp(b.x + clamp(you.x - b.x, -1, 1) * HANG_V * spec.pace * dt * Math.min(1, Math.abs(you.x - b.x) / 4), lo, hi);
    b.wait -= ms;
    if (b.wait > 0) return;
    // Down on the far side of the arena, LAND_AWAY from you (the other side if there is no room).
    const side = Math.sign(b.x - you.x) || 1;
    let to = you.x + side * LAND_AWAY;
    if (to < lo || to > hi) to = you.x - side * LAND_AWAY;
    Object.assign(b, { act: "drop", wait: DROP_MS, toX: clamp(to, lo, hi), fromX: b.x, fromY: b.y });
    round.events.push({ type: "widowDrop", kind: b.kind, x: b.toX, y: b.floor });
    if (b.raged) callWraiths(round, b, k);
    return;
  }
  if (b.act === "drop") {
    b.wait -= ms;
    const t = clamp(1 - b.wait / DROP_MS, 0, 1);
    b.x = lerp(b.fromX, b.toX, t);
    b.y = lerp(b.fromY, b.floor, t * t);
    if (b.wait > 0) return;
    Object.assign(b, { act: "low", y: b.floor, x: b.toX, lowMs: LOW_MS, wait: 0 });
    return;
  }
  if (b.act === "low") {
    b.lowMs -= ms;
    const gap = Math.abs(you.x - b.x);
    if (gap > LOW_KEEP) b.x = clamp(b.x + b.dir * LOW_V * spec.pace * dt, lo, hi);
    // She stays while the veil is down, and a moment after it grows back.
    if (b.lowMs > 0 || !b.veil) return;
    Object.assign(b, { act: "rise", wait: RISE_MS, fromY: b.y });
    round.events.push({ type: "widowRise", kind: b.kind, x: b.x, y: b.y });
    return;
  }
  if (b.act === "rise") {
    b.wait -= ms;
    b.y = lerp(b.fromY, b.floor + HANG_OVER, clamp(1 - b.wait / RISE_MS, 0, 1));
    if (b.wait > 0) return;
    Object.assign(b, { act: "hang", y: b.floor + HANG_OVER, wait: quick(b, HANG_MS, round) });
  }
}

// Shots hurt her only with the veil down and her on the floor; her open mouth lays
// her heart (the lower part of her body) bare for triple damage.
function weakSpot(b, s) {
  return !b.veil && b.act === "low" && b.mouth && s.y < b.y + b.h * HEART_TOP ? MOUTH_MULT : 1;
}

/* ------------------------------------------------------------------ the twist */

function tick(round, ms, k) {
  stepThin(round, ms, k);
  if (round.monsters.length) revealShades(round);
  const b = round.boss;
  if (b && b.kind === "frostwidow" && IN_FROZEN.has(round.spec.id)) {
    if (!b.fw) initWidow(round, b, k);
    stepWind(round, b, ms, k);
  }
}

// Planny is put down in a room (a room set up, a respawn): the ice and the tiles start over.
function place(round, k) {
  const you = round.you;
  Object.assign(you, { slide: 0, glide: false, onIce: false });
  const spec = round.spec;
  const ground0 = spec.base ? spec.base.ground : spec.ground;
  if (spec.ground !== ground0) round.spec = { ...spec, ground: ground0 };
  const thin = round.spec.thin;
  round.thin = thin && thin.length ? { ground0, tiles: thin.map(([x0, x1]) => ({ x0, x1, y: k.groundAt(round.spec, (x0 + x1) / 2), t: 0, state: "ok", back: 0, hand: false })) } : null;
}

export const FROZEN = freeze({
  id: "frozen",
  monsters: MONSTERS,
  walkers: freeze(["shade", "frozen"]),
  zombies: freeze(["frozen"]),
  stackers: freeze(["frozen"]),
  climbers: freeze(["frozen"]),
  act: freeze({ hand: "trail", shade: "stalk", icewraith: "idle" }),
  // The ice wraith's dive is a swoop: a ducked Planny is passed overhead.
  swoops: freeze({ icewraith: (m) => m.act === "dive" }),
  // Kinds that ease along on the ice.
  slides: freeze({ frozen: true }),
  // A hand under the ice cannot hurt or be hit; a shade out of sight is `unseen` (not solid).
  solid: freeze({ hand: (m) => m.act === "grab", icewraith: (m) => m.act !== "idle" }),
  unseen: freeze({ shade: shadeUnseen }),
  move: freeze({ hand: moveHand, shade: moveShade, frozen: moveFrozen, icewraith: moveIceWraith }),
  kill: freeze({ frozen: frozenDies }),
  horde: freeze({ icewraith: freeze({ act: "hover", wait: 800 }) }),
  tick,
  place,
  target,
  bosses: BOSSES,
  boss: freeze({ frostwidow: moveWidow }),
  guard: freeze({ frostwidow: (b) => Boolean(b.veil) || b.act !== "low" }),
  weak: freeze({ frostwidow: (b, s) => weakSpot(b, s) }),
  cause: freeze({ frostwidow: () => "frostwidow" }),
  hazards: freeze({ shard: stepShard, spike: stepSpike, webGlob: stepGlob, webPatch: stepPatch, barrel: stepBarrel }),
});
