// Plan2Code Web Console - the list of activities: the games the Activities window can open.
//
// The source of truth for which games exist. The window (screens/activities.js)
// knows only this list; each game is its own module under activities/, loaded
// with import() the first time it is opened, and answers the same calls:
// create({ canvas, tone, onScore }) returning start, pause, resume, key, tick
// and resize, plus score and state (scripts/test-web-console-activities.mjs
// checks every listed game against it). create() is also handed best(), the
// saved best, and memo, a number kept between sessions; a game may ignore
// both. Three parts are optional: pointer(type,
// x, y) for a game played by mouse, release(name) for a game that acts on a
// key held down (handed the same names as key() when the key is let go), and
// lowerIsBetter on the module's export for a game whose best is its lowest
// round. Adding a game is one file and
// one line here. No DOM access and no imports: the page and `node --test` both
// import this file.

const entry = (id, title) => Object.freeze({ id, title, module: `/activities/${id}.js` });

export const ACTIVITIES = Object.freeze([entry("snake", "Snake"), entry("golf", "Mini golf")]);

// The looks.json key that holds a game's best score: activityBestSnake for
// snake. Built the way soundKey() builds the per-sound switches, so every key
// stays flat (cleanLooks() drops nested objects).
export const bestKey = (id) => "activityBest" + id[0].toUpperCase() + id.slice(1);

// The looks.json key that holds a game's memo: one whole number the game may
// keep between sessions (Snake keeps its tally of surprises found as bits).
// Handed to create() as memo { get, set }; a game that has no use for it
// leaves it at 0.
export const memoKey = (id) => "activityMemo" + id[0].toUpperCase() + id.slice(1);
