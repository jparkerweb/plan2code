// Plan2Code Web Console - Ghoul Rush's ending: four short pages shown once the House is dead, before the end screen (the lights going out, the road home, the cottage by daylight, the mailbox's FINAL NOTICE), the words as data and the rules (lockout, reveal, skip) as plain functions over a round, the same shape as ghoul-story.js. ghoul-ending-draw.js draws the scenes; ghoul-sfx-ending.js has the sounds and the track; scripts/test-web-console-activities-ghoul-ending.mjs checks it all.
//
// The contract core/ghoul-run.js, core/ghoul-play.js and core/ghoul-window.js keep with this file:
// - beginEnding(round): open the ending (phase "ending"); false when there is none.
// - stepEnding(round, ms): one slice of it.
// - takeEnding(round): a press (a move key, fire or a click) turns the page; false when it does not count.
// - pressEnding(round, repeat), releaseEnding(round): fire pressed (held long enough, it skips) and let go.
// - skipEnding(round): all of it at once.
// - ENDING_TRACK: the music to play under it (null for none).
// Ending it must set round.won = true and round.over = true and push { type: "won", stages: round.cleared.length, n: round.winN }.
//
// Rules for the text, as the intro story's: 2 to 4 lines a page, each at most
// MAX_LINE characters, always YOU, no digits, no em dash, US English. Each page
// pays off something the story planted: every window going dark, the road that
// folded "like a napkin", the cottage it "was once", the bill nobody has paid.
//
// The phase `ending` (round.phase): round.ending = { page, ms, full, arm, hold,
// cue, shown, back }, the same fields as round.story, and `back`, the phase the
// round was in when the ending opened (put back when it ends, so the end screen
// draws the room as it always did).

export const MAX_LINE = 60;
// A press counts only after a page has been up this long. Longer than the story's: YOU come here straight from a fight, maybe still mashing keys.
export const ENDING_LOCK_MS = 900;
export const RELOCK_MS = 200;
// Fire held this long skips the whole ending.
export const SKIP_HOLD_MS = 1000;
// The typing, slower and calmer than the story's.
export const REVEAL_AT_MS = 600;
export const CHAR_MS = 30;
export const ENDING_HINT = "Press any move key or fire to go on";
export const LAST_HINT = "Press any move key or fire to finish";
export const SKIP_HINT = "Hold fire to skip";
export const ENDING_TRACK = "ghoulMarrowEnding";

const freeze = Object.freeze;
// `wait`: the page will not turn before this many ms, so its scene plays out (the last window, the click, the gag) however fast YOU read.
const page = (id, scene, chapter, pal, lines, cues, wait = 0) => freeze({ id, scene, chapter, pal: freeze(pal), lines: freeze(lines), cues: freeze(cues.map((c) => freeze(c))), wait });

// LIGHTS OUT: the house's windows (the drawing's ten, by index) going out one
// by one, [window, ms]; the last, the attic's, after a long breath. Each has its
// own falling tone, lower as the house darkens.
export const LIGHTS_OUT = freeze([[4, 900], [8, 1250], [1, 1600], [6, 1950], [2, 2300], [7, 2650], [0, 3000], [5, 3300], [3, 3600], [9, 4700]].map((w) => freeze(w)));
const outCues = LIGHTS_OUT.map(([, ms], i) => (i === LIGHTS_OUT.length - 1 ? [ms, "ghoulEndingLast", 0.55, 1] : [ms, "ghoulEndingWindow", 0.4, 1.25 - i * 0.06]));
// THE ROAD: when the road starts to unfold, and when YOUR flashlight clicks off.
export const UNFOLD_MS = 700;
export const CLICK_OFF_MS = 3900;
// FINAL NOTICE: the flag drops, the last envelope slides out, its stamp lands.
export const FLAG_MS = 1000;
export const SLIDE_MS = 1700;
export const STAMP_MS = 2900;
export const GAG_MS = 3850;

export const PAGES = freeze([
  page("lights", "lights", "LIGHTS OUT", { sky: "#0d0b22", ground: "#05040c", a: "#ffe6a8", glow: "#ffc15a" }, [
    "One window. Then another. Then all of them, at last.",
    "Marrow has eaten its last fright. YOU were not on the menu.",
  ], [[0, "ghoulEndingHush", 0.4, 1], ...outCues, [5000, "ghoulStoryWind", 0.2, 0.7]], 5300),
  page("road", "road", "THE ROAD", { sky: "#2a2244", ground: "#14101e", a: "#ffd9b0", glow: "#ff9e6a" }, [
    "The road unfolds, flat and honest, and goes somewhere.",
    "YOU walk. Nothing herds YOU now. Your flashlight clicks off.",
  ], [[UNFOLD_MS, "ghoulEndingFold", 0.35, 1], [UNFOLD_MS + 900, "ghoulEndingFold", 0.3, 1.15], [UNFOLD_MS + 1800, "ghoulEndingFold", 0.25, 1.3], [2600, "ghoulEndingBird", 0.25, 1], [CLICK_OFF_MS, "ghoulEndingClickOff", 0.45, 1]], 4400),
  page("morning", "morning", "MORNING", { sky: "#8fc4ea", ground: "#3d6b34", a: "#fff4c2", glow: "#ffd34d" }, [
    "By daylight YOU see it plain: a cottage with a bad roof.",
    "It was a cottage once, before it got a taste for it.",
  ], [[300, "ghoulEndingBird", 0.3, 1], [1500, "ghoulEndingBird", 0.25, 1.2], [2700, "ghoulEndingSettle", 0.3, 1], [3900, "ghoulEndingBird", 0.25, 0.9]]),
  page("notice", "notice", "FINAL NOTICE", { sky: "#a9d3ef", ground: "#4a7a3a", a: "#ffe0e0", glow: "#ef4444" }, [
    "YOU stop at the mailbox. A century of unpaid bills.",
    "On top: FINAL NOTICE. Somebody is going to be very upset.",
  ], [[FLAG_MS, "ghoulEndingFlag", 0.45, 1], [SLIDE_MS, "ghoulEndingPaper", 0.35, 1], [STAMP_MS, "ghoulEndingStamp", 0.55, 1], [GAG_MS, "ghoulEndingGag", 0.45, 1]], 4500),
]);

// The characters on a page, and the ms its typing is done.
export const pageChars = (pg) => pg.lines.reduce((n, l) => n + l.length, 0);
export const revealEnd = (pg) => REVEAL_AT_MS + pageChars(pg) * CHAR_MS;

// How many characters of the page (all its lines in a row) are showing `ms` in; `full` shows all.
export function shown(pg, ms, full = false) {
  const total = pageChars(pg);
  if (full) return total;
  return Math.max(0, Math.min(total, Math.floor((ms - REVEAL_AT_MS) / CHAR_MS)));
}

// The text showing on each line, given the characters showing in all.
export function typed(pg, count) {
  let left = count;
  return pg.lines.map((line) => {
    const n = Math.max(0, Math.min(line.length, left));
    left -= line.length;
    return line.slice(0, n);
  });
}

// Which line the typing is on (the last one once it is done).
export function lineAt(pg, count) {
  let left = count;
  for (let i = 0; i < pg.lines.length; i++) {
    if (left < pg.lines[i].length) return i;
    left -= pg.lines[i].length;
  }
  return pg.lines.length - 1;
}

// Whether a press would count right now (not before the lockout).
export const ready = (s) => s.ms >= Math.max(ENDING_LOCK_MS, s.arm);
// Whether a press would do something now: finish the typing, or turn the page once its scene has played out.
export const turnable = (s) => ready(s) && (!(s.full || s.ms >= revealEnd(PAGES[s.page])) || s.ms >= PAGES[s.page].wait);

/* ------------------------------------------------------------ the phase */

function showPage(round, at) {
  const s = round.ending;
  s.page = at;
  s.ms = 0;
  s.full = false;
  s.arm = 0;
  s.cue = 0;
  s.shown = 0;
  round.events.push({ type: "endingPage", page: at });
}

// Opens the ending on its first page: nothing else moves until it ends.
export function beginEnding(round) {
  if (!PAGES.length) return false;
  const back = round.phase;
  round.phase = "ending";
  round.phaseMs = 0;
  const inp = round.input;
  inp.left = inp.right = inp.up = inp.down = inp.fire = false;
  inp.jump = 0;
  round.ending = { page: 0, ms: 0, full: false, arm: 0, hold: -1, cue: 0, shown: 0, back };
  round.events.push({ type: "endingPage", page: 0 });
  return true;
}

// The last page turned (or the whole ending skipped): the run is won, once.
function endEnding(round) {
  const s = round.ending;
  if (!s) return;
  round.ending = null;
  round.phase = s.back;
  round.phaseMs = 0;
  round.won = true;
  round.over = true;
  round.events.push({ type: "won", stages: round.cleared.length, n: round.winN });
}

// One slice of the ending: the page's clock, its sounds and typing blips, and a fire key held long enough to skip it all.
export function stepEnding(round, ms) {
  const s = round.ending;
  if (round.phase !== "ending" || !s) return;
  const pg = PAGES[s.page];
  if (s.hold >= 0) {
    s.hold += ms;
    if (s.hold >= SKIP_HOLD_MS) {
      endEnding(round);
      return;
    }
  }
  s.ms += ms;
  while (s.cue < pg.cues.length && pg.cues[s.cue][0] <= s.ms) {
    const [, name, vol, rate] = pg.cues[s.cue++];
    round.events.push({ type: "storyTone", name, vol, rate });
  }
  // A soft blip every fourth character typed: quieter than the story's.
  const now = shown(pg, s.ms, s.full);
  if (!s.full && Math.floor(now / 4) > Math.floor(s.shown / 4)) round.events.push({ type: "storyTone", name: "tickSoft", vol: 0.07, rate: 1.3 });
  s.shown = now;
}

// A press (a move key, fire or a click): finishes the typing first, then turns the page, and the last page wins the run. False when it does not count (too soon, or not in the ending).
export function takeEnding(round) {
  const s = round.ending;
  if (round.phase !== "ending" || !s || !ready(s)) return false;
  const pg = PAGES[s.page];
  if (!s.full && s.ms < revealEnd(pg)) {
    s.full = true;
    s.arm = s.ms + RELOCK_MS;
    return true;
  }
  if (s.ms < pg.wait) return false;
  if (s.page + 1 >= PAGES.length) endEnding(round);
  else showPage(round, s.page + 1);
  return true;
}

// Fire pressed (a fresh press starts the skip's clock and also counts as a press) or repeating (nothing).
export function pressEnding(round, repeat) {
  const s = round.ending;
  if (round.phase !== "ending" || !s || repeat) return false;
  s.hold = 0;
  takeEnding(round);
  return true;
}

// Fire let go: the skip's clock stops.
export function releaseEnding(round) {
  if (round.ending) round.ending.hold = -1;
}

// The whole ending at once.
export function skipEnding(round) {
  if (round.phase !== "ending" || !round.ending) return false;
  endEnding(round);
  return true;
}
