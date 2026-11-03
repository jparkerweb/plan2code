// Plan2Code Web Console - Ghoul Rush's Cast-Iron Skillet, the East Wing's weapon: three pans that circle Planny, then spiral outward until they are off screen.
//
// One use sends PAN_COUNT pans, evenly spaced round his chest. For PAN_ORBIT_MS
// they spin in a tight ring of PAN_R0 (the protective phase: whatever walks into
// him meets iron), then the ring grows PAN_GROW a second, an Archimedean spiral
// (the radius is a straight line of time, the turn rate never changes), sweeping
// most of the screen. A pan is gone once it has left the view or at PAN_LIFE_MS.
// Nothing is random: where a pan is depends on the time since the use alone, and
// the ring's middle follows Planny as he moves.
//
// ONE-SHOT RULE: a pan kills anything that is not a boss in one hit (PAN_KILL, the
// usual kill path, how "arm", no drops, as any area weapon) and breaks on it, so
// one use can kill at most PAN_COUNT things. Nothing that cannot be hit just now
// (the unseen, a cage or lift that Planny stands on, a harmless prop) is touched.
// A boss is never one-shot: the pan does PAN_BOSS through armBossDamage (scaled to
// its hp, the share cap and its guards all apply, a hidden boss is not hit) and
// breaks. A pan never hurts Planny.
//
// No imports: ghoul-arms.js hands the rules its helpers (see `tools`).

const TAU = Math.PI * 2;

export const PAN_COUNT = 3;
export const PAN_R0 = 4.5;
// Turns a second; the ring does not slow as it grows.
export const PAN_TURNS = 1.5;
export const PAN_ORBIT_MS = 1000;
export const PAN_GROW = 18;
export const PAN_LIFE_MS = 3000;
export const PAN_BOSS = 1;
export const PAN_KILL = 9999;
// A pan's half-size for touching, where its middle rides above Planny's feet,
// and how far past the view's edge it must be before it is let go.
export const PAN_HIT = 2;
export const PAN_LIFT = 2.4;
const PAN_MARGIN = 4;
// A ring this small is still round Planny: near a room's edge it may start off screen.
const PAN_EXIT_R = 20;
// A turn this fast is split into slices this long so a pan never skips over a monster.
const PAN_SLICE_MS = 4;
// One clang at most this often, however many pans break at once.
export const PAN_SOUND_MS = 70;
export const PAN_BURST_MS = 320;
const PAN_START = Math.PI / 2;

export const panAngle = (i, t) => PAN_START + (i * TAU) / PAN_COUNT + PAN_TURNS * TAU * (t / 1000);
export const panRadius = (t) => PAN_R0 + (Math.max(0, t - PAN_ORBIT_MS) / 1000) * PAN_GROW;

function place(h, you) {
  h.x = you.x;
  h.y = you.y + PAN_LIFT;
  h.pans.forEach((p, i) => {
    const r = panRadius(h.t);
    const a = panAngle(i, h.t);
    p.r = r;
    p.x = h.x + Math.cos(a) * r;
    p.y = h.y + Math.sin(a) * r;
  });
}

// The use: three pans round his chest, as at t = 0.
export function usePans(round) {
  const h = { kind: "armPans", t: 0, x: 0, y: 0, pans: Array.from({ length: PAN_COUNT }, () => ({ x: 0, y: 0, r: PAN_R0, alive: true })), w: 0.1, h: 0.1, live: 0, cause: "" };
  place(h, round.you);
  round.hazards.push(h);
}

// A pan broken on something: a burst where it was, and one clang now and then.
function breakPan(round, p) {
  p.alive = false;
  round.hazards.push({ kind: "armPanBurst", x: p.x, y: p.y, life: PAN_BURST_MS, max: PAN_BURST_MS, w: 1, h: 1, live: 0, cause: "" });
  if (!(round.panSoundMs > 0)) {
    round.panSoundMs = PAN_SOUND_MS;
    round.events.push({ type: "armClang", x: p.x, y: p.y });
  }
}

// The nearest monster the pan touches, if any.
function touched(round, p, k) {
  let best = null;
  let d = Infinity;
  for (const m of round.monsters) {
    if (m.dead || !(k.solid(m) || k.stone(m)) || k.harmlessNow(m)) continue;
    if (m.x + m.w / 2 < p.x - PAN_HIT || m.x - m.w / 2 > p.x + PAN_HIT || m.y + m.h < p.y - PAN_HIT || m.y > p.y + PAN_HIT) continue;
    const dm = Math.abs(m.x - p.x) + Math.abs(m.y + m.h / 2 - p.y);
    if (dm < d) {
      d = dm;
      best = m;
    }
  }
  return best;
}

// Off the side of the view: for good, since the ring only widens. (Above and below the view it swings back in.)
const outside = (round, p, k) => p.x < round.camX - PAN_MARGIN || p.x > round.camX + k.FIELD_W + PAN_MARGIN;

// One slice of a use. `tools` is { bossUp, hitBoss, sweepDead, noDrops } from ghoul-arms.js.
export function stepPans(round, h, ms, k, tools) {
  for (let left = ms; left > 0; left -= PAN_SLICE_MS) {
    h.t += Math.min(PAN_SLICE_MS, left);
    place(h, round.you);
    for (const p of h.pans) {
      if (!p.alive) continue;
      const m = touched(round, p, k);
      if (m) {
        k.hurt(round, m, PAN_KILL, "arm", tools.noDrops);
        tools.sweepDead(round);
        breakPan(round, p);
        continue;
      }
      const b = tools.bossUp(round);
      if (b && p.x + PAN_HIT >= b.x - b.w / 2 && p.x - PAN_HIT <= b.x + b.w / 2 && p.y + PAN_HIT >= b.y && p.y - PAN_HIT <= b.y + b.h) {
        // A guard shows and the pan still breaks on it, as a bolt does.
        tools.hitBoss(round, p.x, Math.max(b.y, Math.min(b.y + b.h, p.y)), PAN_BOSS, "arm", k);
        breakPan(round, p);
        continue;
      }
      if (h.t >= PAN_LIFE_MS || (p.r >= PAN_EXIT_R && outside(round, p, k))) p.alive = false;
    }
    if (!h.pans.some((p) => p.alive)) return false;
  }
  return true;
}
