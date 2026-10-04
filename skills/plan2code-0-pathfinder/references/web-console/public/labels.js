// Activity-line wording the page corrects on the way in. Kept out of app.js so
// `node --test` can import it: no DOM access at module scope.
//
// A build numbers its tasks "Task 4.2" after the phase, but a person watching
// the page counts within the phase, so "Task 4.2 of 6" reads as nonsense
// beside a progress bar that says 2 of 6.

// The only workflows whose activity lines get rewritten.
export const BUILD_WORKFLOWS = new Set(["implement", "implement-review"]);

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
