// Plan2Code Web Console - the list of activities: the games the Activities window can open.
//
// The source of truth for which games exist. The window (screens/activities.js)
// knows only this list; each game is its own module under activities/, loaded
// with import() the first time it is opened, and answers the same calls:
// create({ canvas, tone, hum, onScore }) returning start, pause, resume, key, tick
// and resize, plus score and state (scripts/test-web-console-activities.mjs
// checks every listed game against it). create() is also handed best(), the
// saved best, and memo, a number kept between sessions; a game may ignore
// both. hum(id, name, level, pitch) keeps a held sound going (an engine)
// for as long as the game calls it each frame; a game may ignore it, and
// one made in a test may be handed none. key(name, repeat) is handed true as its second argument for a key
// repeat, which a game may ignore. Three parts are optional: pointer(type,
// x, y) for a game played by mouse, release(name) for a game that acts on a
// key held down (handed the same names as key() when the key is let go), and
// lowerIsBetter on the module's export for a game whose best is its lowest
// round. A game with lives (a `lives` on its round) must also answer
// cheat(on): the window's endless-lives code turns it on for the round
// (`round.infinite`, no life ever taken, the lives pill showing livesText(
// Infinity)) and off when the person leaves the game. A game may also
// answer stageSelect(): the window's stage code (Ghoul Rush's) opens a
// practice round on its stage select. Each entry's blurb is the line its card shows on the picker, which
// draws every card without loading a game. A game with `courses` (Mini
// golf) opens on a dashboard of them instead of straight onto its board,
// keeps a best per course, and answers the course parts of the contract:
// courses and preview(canvas, id, w, h) on its export, setCourse(id) and
// course on the game. A game with music sets `music` to its starting
// music volume, 0 to 100, which the window's Music slider changes and keeps
// per game. Adding a game is one file and one line here. No DOM access and no imports: the page and `node --test` both
// import this file.

const entry = (id, title, blurb, more = {}) => Object.freeze({ id, title, blurb, module: `/activities/${id}.js`, ...more });

export const ACTIVITIES = Object.freeze([
  entry("snake", "Snake", "Eat, grow and dodge. Every level brings something new."),
  entry("golf", "Mini golf", "Six themed 18-hole courses, from Pirate Cove to Cosmic Glow.", { courses: Object.freeze(["pirate", "cave", "dino", "candy", "space", "frost"]) }),
  entry("trails", "Light Trails", "Box your rivals in with your trail. Last rider moving wins."),
  entry("bugs", "Bug Hunt", "Squash waves of bugs before they dive at you, then beat the boss."),
  entry("drive", "Sunset Drive", "Race the clock down the open road, and pick your road at every fork.", { music: 70 }),
  entry("stack", "Stack Deploy", "Drop each block right on top. One button, how high can you go?"),
  entry("bumper", "Bumper Ring", "Knock your rivals off the ring. Last car on wins."),
  entry("rapids", "Rapids Run", "Blast up the winding river, grab charge before you run dry, smash every dam."),
  entry("fuse", "Hot Potato", "Pass the bomb before it blows. Last one standing wins."),
  entry("hop", "Crossing Rush", "Hop through traffic and rivers. Race your rivals to the top."),
  entry("bounce", "Bounce Road", "Ten wild stages of toy-car mayhem. Jump, stomp and outrun the Monster truck."),
  entry("ghoul", "Ghoul Rush", "Run and gun through a pitch-dark haunted house. Keep moving.", { music: 65, module: "/activities/ghoul-rush/ghoul.js" }),
]);

const cap = (word) => word[0].toUpperCase() + word.slice(1);

// The looks.json key that holds a game's best score: activityBestSnake for
// snake, and for a game with courses, one per course: activityBestGolfPirate.
// Built the way soundKey() builds the per-sound switches, so every key stays
// flat (cleanLooks() drops nested objects).
export const bestKey = (id, course) => "activityBest" + cap(id) + (course ? cap(course) : "");

// Every best-score key a listed game keeps.
export const bestKeys = (entry) => (entry.courses ? entry.courses.map((c) => bestKey(entry.id, c)) : [bestKey(entry.id)]);

// The looks.json key that holds a game's memo: one whole number the game may
// keep between sessions (Snake keeps its tally of surprises found as bits).
// Handed to create() as memo { get, set }; a game that has no use for it
// leaves it at 0.
export const memoKey = (id) => "activityMemo" + cap(id);

// The looks.json key that holds a game's music volume, 0 to 100:
// activityMusicDrive. Only a game whose entry sets `music` has one.
export const musicKey = (id) => "activityMusic" + cap(id);

// A game's music volume as a share, 0 to 1: the saved one, or its entry's
// default when none is saved or the saved one is not a number.
export function musicLevel(entry, saved) {
  if (!entry || entry.music === undefined) return 0;
  const n = typeof saved === "number" ? saved : NaN;
  return (Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : entry.music) / 100;
}
