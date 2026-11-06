// Plan2Code Web Console - Ghoul Rush's intro story: eight short pages shown after YOU start a run and before The Long Hall, the words as data and the rules (lockout, reveal, skip) as plain functions over a round. ghoul-story-draw.js draws the scenes; ghoul-sfx-story.js has the sounds; scripts/test-web-console-activities-ghoul-story.mjs checks it all.
//
// The lore bible lives in prototypes/Ghoul-Rush-TODO.md ("The game's intro
// story"): read it before you change a page or add a stage, so the story
// never contradicts a stage's intro card (ghoul-intros.js). In short: the house
// is MARROW MANOR, a hungry thing older than the valley that eats fright; it
// copies what it eats and builds it again INSIDE itself, so every place of horror
// (a village, a lake, a carnival) is a room, a whole world, within the house; YOU
// once switched a flashlight on in its hall and it flinched, so it called YOU back; the road
// behind YOU is gone, every door YOU pick is locked after YOU, and if YOU get
// out, it starves.
//
// Rules for the text: 2 to 4 lines a page, each at most MAX_LINE characters
// (the field is 96 units wide), always YOU (never the hero's name, "the player"
// or "the hero"), no em dash, US English, spooky-fun, one joke a page at most.
//
// A page: `id`, `scene` (the drawing's id in ghoul-story-draw.js), `chapter`
// (its heading), `pal` ({ sky, ground, a, glow }: the scene's colors and the
// heading's and halo's), `lines` and `cues` ([ms, tone, level, pitch] sounds
// timed from the page's start).
//
// KEEP THE STORY GENERIC: never name a stage, never give a count of stages, rooms,
// doors or keepers. More stages will come, and the story must stay true.
//
// The phase `story` (round.phase): round.story = { page, ms, full, arm, hold,
// cue }. `ms` is the page's clock (a pause holds it), `full` is whether a press
// has finished the typing, `arm` the earliest ms the next press counts, `hold`
// how long fire has been held (-1 when it is not), `cue` the next sound due.

export const MAX_LINE = 60;
// A press counts only after a page has been up this long (a held key or a key's repeats never skip a page), and again a moment after a press finished the typing.
export const STORY_LOCK_MS = 600;
export const RELOCK_MS = 200;
// Fire held this long skips the whole story.
export const SKIP_HOLD_MS = 1000;
// The typing: it starts a little after the page fades in, then one character each CHAR_MS.
export const REVEAL_AT_MS = 450;
export const CHAR_MS = 26;
export const STORY_HINT = "Press any move key or fire to go on";
export const LAST_HINT = "Press any move key or fire to enter the hall";
export const SKIP_HINT = "Hold fire to skip the story";
export const FINALE_TITLE = "THE RUN BEGINS";

const freeze = Object.freeze;
const page = (id, scene, chapter, pal, lines, cues) => freeze({ id, scene, chapter, pal: freeze(pal), lines: freeze(lines), cues: freeze(cues.map((c) => freeze(c))) });

export const PAGES = freeze([
  page("road", "road", "I. THE ROAD", { sky: "#0b1230", ground: "#06070f", a: "#bcd4ff", glow: "#7aa2ff" }, [
    "Midnight. YOU walk a road no map has ever admitted to.",
    "Your flashlight is the friendliest thing for miles.",
    "The road is not leading YOU. It is herding YOU.",
  ], [[0, "ghoulStoryWind", 0.5, 1], [2800, "ghoulStoryBell", 0.3, 0.8], [4600, "ghoulStoryWind", 0.3, 0.85]]),
  page("house", "house", "II. THE HOUSE ON THE HILL", { sky: "#160d2b", ground: "#08050f", a: "#e9d5ff", glow: "#c084fc" }, [
    "That is Marrow Manor, older than the valley under it.",
    "Every window is lit. Nobody has paid the bill in a century.",
    "It is not waiting for guests. It is waiting for YOU.",
  ], [[0, "ghoulThunder", 0.4, 0.9], [1900, "ghoulStoryCrow", 0.3, 1], [3600, "ghoulStoryCreak", 0.3, 1]]),
  page("hunger", "hunger", "III. WHAT MARROW EATS", { sky: "#1a0a0c", ground: "#0a0405", a: "#fecaca", glow: "#f87171" }, [
    "Marrow does not eat food. Marrow eats fright.",
    "Every scream is a meal. Every shiver, a snack.",
    "It was a cottage once, then it got a taste for it.",
    "A scared guest is a fresh guest. YOU look very fresh.",
  ], [[0, "ghoulStoryBeat", 0.5, 1], [2500, "ghoulStoryWhisper", 0.35, 1], [4300, "ghoulStoryBeat", 0.5, 0.95], [6000, "ghoulStoryGulp", 0.35, 1]]),
  page("arms", "arms", "IV. A HOUSE WITH LONG ARMS", { sky: "#0e1a16", ground: "#05100c", a: "#d1fae5", glow: "#6ee7b7" }, [
    "Marrow is not only a house. It is a hunger with a roof.",
    "Its shadow reaches farther than the road YOU walked.",
    "Whatever it swallows, it keeps, and it builds inside.",
  ], [[0, "ghoulStoryGulp", 0.4, 1], [1900, "ghoulStoryBeat", 0.4, 0.9], [3600, "ghoulStoryBell", 0.25, 1]]),
  page("far", "far", "V. A WORLD INSIDE", { sky: "#14122e", ground: "#07061a", a: "#fde68a", glow: "#fbbf24" }, [
    "Peek through a window. The room is bigger than the house.",
    "Marrow copies what it eats, then builds it again inside.",
    "Whole villages in there. Even a carnival it never forgot.",
    "None of it is real. All of it can still swallow YOU.",
  ], [[0, "ghoulStoryKnock", 0.4, 1], [2300, "ghoulStoryBell", 0.3, 1.2], [4300, "ghoulStoryKnock", 0.35, 1.1], [6100, "ghoulStoryWind", 0.3, 1.3]]),
  page("why", "why", "VI. WHY YOU", { sky: "#0a1620", ground: "#04080d", a: "#fff3b0", glow: "#fde047" }, [
    "On a dare, YOU once clicked a flashlight on in its hall.",
    "Marrow flinched. Nothing had ever made it flinch.",
    "Light shows a house for what it is: a draft with a mortgage.",
    "It never forgot YOU. Every window has winked at YOU since.",
  ], [[0, "ghoulStoryWhisper", 0.35, 0.8], [1500, "ghoulStoryClick", 0.5, 1], [3400, "ghoulStoryBeat", 0.35, 1.2], [5200, "ghoulStoryWhisper", 0.3, 1.2]]),
  page("trap", "trap", "VII. NO WAY BACK", { sky: "#190a14", ground: "#0b0408", a: "#fbcfe8", glow: "#f472b6" }, [
    "Behind YOU, the road folds up like a napkin.",
    "Door after door YOU pick, Marrow locks behind YOU.",
    "A keeper in each room. The deeper YOU go, the worse.",
    "Win, and every window goes dark. Marrow starves for good.",
  ], [[0, "ghoulStoryLock", 0.5, 1], [1200, "ghoulStoryCreak", 0.3, 0.8], [3200, "ghoulStoryLock", 0.5, 0.85], [5200, "ghoulStoryLock", 0.5, 0.75]]),
  page("begin", "begin", "VIII. THE LONG HALL", { sky: "#100c12", ground: "#281a14", a: "#e9ddf3", glow: "#c4a8dc" }, [
    "Ahead lies The Long Hall, candles lit, nobody home.",
    "Far below, its heart is still beating. Go and stop it.",
    "Switch on YOUR light. Let it flinch again.",
  ], [[0, "ghoulStoryCreak", 0.4, 1], [2300, "ghoulStoryBeat", 0.5, 1], [3900, "ghoulStoryBegin", 0.8, 1]]),
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
export const ready = (s) => s.ms >= Math.max(STORY_LOCK_MS, s.arm);

/* ------------------------------------------------------------ the phase */

function showPage(round, at) {
  const s = round.story;
  s.page = at;
  s.ms = 0;
  s.full = false;
  s.arm = 0;
  s.cue = 0;
  round.events.push({ type: "storyPage", page: at });
}

// Opens the story on its first page: the round waits behind it, the hall already set up.
export function beginStory(round) {
  round.phase = "story";
  round.phaseMs = 0;
  round.input.jump = 0;
  round.story = { page: 0, ms: 0, full: false, arm: 0, hold: -1, cue: 0, shown: 0 };
  round.events.push({ type: "storyPage", page: 0 });
}

// Out of the story into The Long Hall: the room is announced now, as a round's first room always was.
export function endStory(round) {
  round.story = null;
  round.phase = "play";
  round.phaseMs = 0;
  round.input.jump = 0;
  round.events.push({ type: "storyEnd" });
  round.events.push({ type: "room", room: round.room || 1 });
}

// One slice of the story: the page's clock, its sounds and typing blips, and a fire key held long enough to skip it all.
export function stepStory(round, ms) {
  const s = round.story;
  if (!s) return;
  const pg = PAGES[s.page];
  if (s.hold >= 0) {
    s.hold += ms;
    if (s.hold >= SKIP_HOLD_MS) {
      endStory(round);
      return;
    }
  }
  s.ms += ms;
  while (s.cue < pg.cues.length && pg.cues[s.cue][0] <= s.ms) {
    const [, name, vol, rate] = pg.cues[s.cue++];
    round.events.push({ type: "storyTone", name, vol, rate });
  }
  // A soft blip every third character typed.
  const now = shown(pg, s.ms, s.full);
  if (!s.full && Math.floor(now / 3) > Math.floor(s.shown / 3)) round.events.push({ type: "storyTone", name: "tickSoft", vol: 0.1, rate: 1.5 });
  s.shown = now;
}

// A press (a move key, fire or a click): finishes the typing first, then turns the page, and the last page opens the hall. False when it does not count (too soon, or not in the story).
export function takeStory(round) {
  const s = round.story;
  if (round.phase !== "story" || !s || !ready(s)) return false;
  const pg = PAGES[s.page];
  if (!s.full && s.ms < revealEnd(pg)) {
    s.full = true;
    s.arm = s.ms + RELOCK_MS;
    return true;
  }
  if (s.page + 1 >= PAGES.length) endStory(round);
  else showPage(round, s.page + 1);
  return true;
}

// Fire pressed (a fresh press starts the skip's clock and also counts as a press) or repeating (nothing).
export function pressStory(round, repeat) {
  const s = round.story;
  if (round.phase !== "story" || !s || repeat) return false;
  s.hold = 0;
  takeStory(round);
  return true;
}

// Fire let go: the skip's clock stops.
export function releaseStory(round) {
  if (round.story) round.story.hold = -1;
}

// The whole story at once.
export function skipStory(round) {
  if (round.phase !== "story" || !round.story) return false;
  endStory(round);
  return true;
}
