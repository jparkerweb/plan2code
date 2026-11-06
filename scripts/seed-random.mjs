// Pins Math.random to a seeded generator for a test file that drives an Activities game, so the
// game's own dice (a road with a crack where a test wanted plain road, a spawn that lands out of
// reach) give the same layout on every run and a rare roll can never fail a test at random.
// Import it FIRST in the file: a game module may roll at load time.
//
// A seed that fails a test is a real finding, not a flake: set PLAN2CODE_TEST_SEED to reproduce
// another roll, for example to hunt a bug the fixed seed hides.

let state = Number(process.env.PLAN2CODE_TEST_SEED || 20261105) >>> 0;

// mulberry32: small, fast and good enough for game dice.
Math.random = () => {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
