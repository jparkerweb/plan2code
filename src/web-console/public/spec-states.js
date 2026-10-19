// Plan2Code Web Console - the spec states.
//
// Each spec state the dashboard scan can report; data only, imported by the
// page and by Node. In the order the scan's SPEC_STATES lists them. Which
// cards a state lights or greys lives on the skill list (skills.js), and how
// a folder's files map to a state stays with the scan (classifySpec in
// scan.mjs). No imports and no DOM access: nothing runs at load but building
// the frozen data.
//
// Per state:
//   label     what the picker shows next to the spec's name
//   next      the card the state is the natural next step for (the
//             "Suggested" fallback when the agent's menu names nothing), or
//             null when it has none
//   finished  the work is done: the spec is hidden while unavailable
//             workflows are, never the picker's default, deleted after one
//             confirm, and greyed with the card's `finished` reason
//             (skills.js) on the cards that would otherwise take it

function state(label, next, finished = false) {
  return Object.freeze({ label, next, finished });
}

export const SPEC_STATES = Object.freeze({
  diagnosed: state("Bug diagnosed", "plan2code-quick-task"),
  fixed: state("Bug fixed", null, true),
  exploring: state("Exploring", "plan2code-0-pathfinder"),
  mapped: state("Ready to plan", "plan2code-1-plan"),
  planned: state("Ready to document", "plan2code-2-document"),
  documented: state("Ready to build", "plan2code-3-implement"),
  building: state("Building", "plan2code-3-implement"),
  built: state("Ready to finalize", "plan2code-4-finalize"),
  unrecognized: state("Files on disk", null),
});

/** The entry for a state's name ("planned"), or null. */
export function stateFor(name) {
  return Object.hasOwn(SPEC_STATES, name) ? SPEC_STATES[name] : null;
}
