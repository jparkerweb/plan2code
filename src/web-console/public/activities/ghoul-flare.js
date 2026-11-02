// Plan2Code Web Console - Ghoul Rush's Road Flare, the Frozen Lake's weapon: a flare thrown ahead that lands and burns a patch of the ice for a few seconds.
//
// One use lobs a flare (`armRoadFlare`, a lob like the pods') FLARE_VX across and
// FLARE_VY up, about 16 units ahead on the flat. Where it lands it becomes a
// patch of fire (`armRoadFire`): FLARE_W wide, FLARE_H high, burning FLARE_MS.
// A monster in it is burned the moment it steps in and again every FLARE_TICK_MS it
// stays (`m.burnAt`, the round's clock), the boss on the fire's own tick:
//
// - a Frozen Ghoul dies at once and shatters into no shards (`how: "flare"`, the
//   kill hook in ghoul-frozen.js leaves them out);
// - anything else takes FLARE_DMG, no drops (an area weapon's kills never leave
//   any);
// - a Snow Shade within FLARE_LIGHT of the fire is shown (`m.litMs`, the same
//   field Flash Powder sets), so it can be shot and burned;
// - the Frost Widow, on the floor with her veil up, has her veil melted: the
//   fire sets `b.melt` and her own mover does the melting (ghoul-frozen.js); with
//   the veil down the fire does FLARE_BOSS a tick through armBossDamage, at most
//   FLARE_BOSS_MAX in all from one patch.
//
// It never hurts Planny. A flare lost down a pit is gone. No random draw.
//
// No imports: ghoul-arms.js hands the rules its helpers (see `tools`).

export const FLARE_VX = 32;
export const FLARE_VY = 30;
export const FLARE_W = 6;
export const FLARE_H = 5;
export const FLARE_MS = 4000;
export const FLARE_TICK_MS = 350;
export const FLARE_DMG = 2;
export const FLARE_BOSS = 2;
export const FLARE_BOSS_MAX = 16;
export const FLARE_LIGHT = 14;
// How long a shade stays shown after the light has touched it (refreshed each slice).
export const FLARE_SHOW_MS = 300;

const inBox = (m, x0, x1, y0, y1) => m.x + m.w / 2 >= x0 && m.x - m.w / 2 <= x1 && m.y + m.h >= y0 && m.y <= y1;

// The throw: from his hand, ahead.
export function useFlare(round, k) {
  const you = round.you;
  const at = { x: you.x + you.face * 1.8, y: you.y + k.shotY(you) };
  round.hazards.push({ kind: "armRoadFlare", x: at.x, y: at.y, vx: you.face * FLARE_VX, vy: FLARE_VY, spin: 0, rest: false, t: 0, w: 0.8, h: 0.8, live: 0, cause: "" });
  round.events.push({ type: "flareThrow", x: at.x, y: at.y, face: you.face });
}

// The flare in the air: down onto a floor or a board, then it is a fire.
export function stepFlareFly(round, h, ms, k, tools) {
  h.spin += (ms / 1000) * 14;
  h.t += ms;
  if (!tools.flyDown(round, h, ms, k)) return false;
  if (!h.rest) return true;
  round.hazards.push({ kind: "armRoadFire", x: h.x, y: h.y, life: FLARE_MS, max: FLARE_MS, tick: 0, bossDone: 0, w: FLARE_W, h: FLARE_H, live: 0, cause: "" });
  round.events.push({ type: "flareLand", x: h.x, y: h.y });
  return false;
}

// The fire: burns its patch on every tick and lights what hides near it.
export function stepRoadFire(round, h, ms, k, tools) {
  h.life -= ms;
  for (const m of round.monsters) {
    if (!m.dead && m.kind === "shade" && Math.hypot(m.x - h.x, m.y + m.h / 2 - h.y) <= FLARE_LIGHT) m.litMs = Math.max(m.litMs || 0, FLARE_SHOW_MS);
  }
  const x0 = h.x - h.w / 2;
  const x1 = h.x + h.w / 2;
  let burned = false;
  for (const m of round.monsters) {
    if (m.dead || !k.solid(m) || !inBox(m, x0, x1, h.y - 1, h.y + h.h) || round.clock - (m.burnAt ?? -1e9) < FLARE_TICK_MS) continue;
    m.burnAt = round.clock;
    burned = true;
    k.hurt(round, m, m.kind === "frozen" ? 99 : FLARE_DMG, m.kind === "frozen" ? "flare" : "burn", tools.noDrops);
  }
  if (burned) tools.sweepDead(round);
  h.tick -= ms;
  if (h.tick <= 0) {
    h.tick += FLARE_TICK_MS;
    const b = tools.bossUp(round);
    if (b && inBox(b, x0, x1, h.y - 1, h.y + h.h)) {
      if (b.kind === "frostwidow" && b.veil) b.melt = true;
      else if (h.bossDone < FLARE_BOSS_MAX && tools.hitBoss(round, b.x, b.y + 1, FLARE_BOSS, "burn", k)) h.bossDone += FLARE_BOSS;
    }
  }
  return h.life > 0;
}
