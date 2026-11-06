// Shared helpers for the Ghoul Rush tests (not a test itself).

// Leaves a boss room's intro card (phase "bossintro", ghoul-bossintro-draw.js) the way a player does: after the lockout, a fresh press.
// A round in any other phase is left alone. Returns true when it left a card.
export function skipBossIntro(ghoul, round) {
  if (round.phase !== "bossintro") return false;
  round.introMs = Math.max(round.introMs || 0, ghoul.INTRO_MIN_MS);
  return ghoul.takeIntro(round);
}
