// Activity-line wording the page corrects on the way in. Kept out of app.js so
// `node --test` can import it: no DOM access at module scope, and its one
// import is the data-only skills.js.
//
// A build numbers its tasks "Task 4.2" after the phase, but a person watching
// the page counts within the phase, so "Task 4.2 of 6" reads as nonsense
// beside a progress bar that says 2 of 6.

import { SKILLS, isPhased } from "./skills.js";

// The only workflows whose activity lines get rewritten: the phased builds,
// from skills.js.
export const BUILD_WORKFLOWS = new Set(SKILLS.filter((s) => isPhased(s.workflow)).map((s) => s.workflow));

// The one phrase for a page that has lost the server (Help's "Not connected"
// state). A place may add its own tail. "Not running" and "gone quiet" are for
// the agent only.
export const NOT_CONNECTED = "Not connected right now.";
export const NOT_CONNECTED_KEPT = "Your text is kept and saves when it is back.";
export const notConnected = (tail) => (tail ? `${NOT_CONNECTED} ${tail}` : NOT_CONNECTED);

const PHASE_TASK = /^Task (\d+)\.(\d+) of (\d+)/;

export function taskLabel(text) {
  if (typeof text !== "string" || !PHASE_TASK.test(text)) return text;
  return text.replace(PHASE_TASK, (_, _phase, n, total) => `Task ${n} of ${total}`);
}

// An activity line as the page shows it: rewritten in a build, as sent
// everywhere else (a plan's "Task 2.1" is a real section number).
export function activityLabel(text, workflow) {
  return BUILD_WORKFLOWS.has(workflow) ? taskLabel(text) : text;
}

// What a working agent is doing, for a page with nothing asked yet: its
// activity line, or the headline note it posted instead. Either one means the
// skill has started, so the page leaves its starting screen.
export function workingLine(agent, headline, workflow) {
  if (!agent || agent.status !== "working") return "";
  if (typeof agent.activity === "string" && agent.activity.trim()) return activityLabel(agent.activity.trim(), workflow);
  return typeof headline?.note === "string" ? headline.note.trim() : "";
}

// One way to write a time: how long ago, then the short date and time, "6 h ago
// · Nov 15, 3:42 PM". `now` is a parameter so a test can fix it. Nothing for an
// unreadable time. The full stamp goes in a title (whenTitle).
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function agoWords(ms) {
  if (ms < MINUTE) return "just now";
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)} min ago`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)} h ago`;
  if (ms < 14 * DAY) {
    const days = Math.floor(ms / DAY);
    return `${days} ${days === 1 ? "day" : "days"} ago`;
  }
  if (ms < 60 * DAY) return `${Math.floor(ms / (7 * DAY))} weeks ago`;
  if (ms < 365 * DAY) return `${Math.floor(ms / (30 * DAY))} months ago`;
  const years = Math.floor(ms / (365 * DAY));
  return `${years} ${years === 1 ? "year" : "years"} ago`;
}

export function whenWords(iso, now = Date.now()) {
  const at = new Date(iso);
  if (!iso || Number.isNaN(at.getTime())) return "";
  const shortStamp = at.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    ...(at.getFullYear() === new Date(now).getFullYear() ? {} : { year: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  });
  // A time ahead of the clock (a skewed file date) reads as just now.
  return `${agoWords(Math.max(0, now - at.getTime()))} · ${shortStamp}`;
}

/** The full stamp, for a title: the one place the whole date and time live. */
export function whenTitle(iso) {
  const at = new Date(iso);
  return !iso || Number.isNaN(at.getTime()) ? "" : at.toLocaleString();
}
