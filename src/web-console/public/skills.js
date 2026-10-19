// Plan2Code Web Console - the skill list.
//
// Every per-skill fact the console uses; data only, imported by the page and
// by Node. One entry per workflow: the dashboard's cards first, in their
// order on the page, then the workflows with no card (the dashboard itself).
// The older tables (SKILL_CATALOG, START_POSES, LAUNCH_COUNTED and the rest)
// are lookups on this list. No imports and no DOM access: nothing runs at
// load but building the frozen data.
//
// Per entry:
//   skill      the installed skill's name; `command` is "/" + skill
//   workflow   the console's name for it (`open --workflow`)
//   label      the badge the page header wears
//   name       how the session meter's rows name it ("7 answers in Plan")
//   pose       the Planny drawn on its starting screen (index.html's
//              <template id="start-poses">), or null for the flight
//   builds     a build: the header counts tasks done, Help opens on Building
//   phased     a phased build: tasks numbered "Task 4.2" and counted on the
//              meter as the headline's `cleared` rises
//   metered    the launch itself scores on the session meter
//   templates  the first "What's the idea?" card offers starter templates
//   subagents  the Subagents switch's standing instruction, or null when the
//              switch is not offered
//   states     the spec states its card takes, as spec-states.js names them,
//              plus "none" for no spec picked; "any" for a card that is
//              always on whatever is picked; null for no card
//   marksNext  the card can be a state's natural next step, so its answer
//              always says whether it is (`next`)
//   greyed     its greyed reasons: `default`, plus one per state whose
//              wording differs, and `finished` for any finished state
//              (spec-states.js); Init and Init update use `default` for the
//              AGENTS.md check, which is a rule on the scan, not on the spec
//   card       the dashboard card (group, chip, title, blurb, about, and
//              `spec: true` when it takes the picked spec), or null

// Shared by Implement and Implement + Review.
const BUILD_HELPERS =
  "Hand independent tasks in a phase to helpers: tasks that touch different files and do not depend on each other. Keep tasks that share files, the phase's tests and the sign-off with you.";

// Pathfinder's and Plan's reason on a finished spec (a fixed bug).
export const FIXED_REASON = "This bug is fixed. Delete it with the Delete button on its chip, or move it to specs--completed/.";

// Shared by Implement and Implement + Review.
const BUILD_GREYED = { default: "Needs the phase checklists written up first", built: "All tasks are already done" };

function skill(entry) {
  const card = entry.card ? Object.freeze({ ...entry.card }) : null;
  const states = Array.isArray(entry.states) ? Object.freeze([...entry.states]) : entry.states;
  const greyed = entry.greyed ? Object.freeze({ ...entry.greyed }) : null;
  return Object.freeze({ marksNext: false, ...entry, command: "/" + entry.skill, states, greyed, card });
}

export const SKILLS = Object.freeze([
  skill({
    skill: "plan2code-init",
    workflow: "init",
    label: "Setting up",
    name: "Init",
    pose: "init",
    builds: false, phased: false, metered: true, templates: false,
    subagents: null,
    states: "any",
    greyed: { default: "AGENTS.md is already written. Refresh it instead." },
    card: {
      group: "setup",
      chip: "Set up",
      title: "Set up this project",
      blurb: "Reads your project and writes AGENTS.md, the guide every later step works from.",
      about:
        "Plan2Code reads the whole project: how it is organized, how it runs, and where the sharp edges are. Then it writes AGENTS.md, the guide every later step steers by. It asks a few questions as it goes, so nothing important gets guessed. Run this once per project, or again when the project has moved on.",
    },
  }),
  skill({
    skill: "plan2code-init-update",
    workflow: "init-update",
    label: "Refreshing",
    name: "Init update",
    pose: "init",
    builds: false, phased: false, metered: true, templates: false,
    subagents: null,
    states: "any",
    greyed: { default: "Needs an AGENTS.md. Set the project up first." },
    card: {
      group: "setup",
      chip: "Set up",
      title: "Refresh AGENTS.md",
      blurb: "Brings AGENTS.md and its notes up to date with what the project has learned lately.",
      about:
        "The project moved on since AGENTS.md was written: new commands, new habits, new gotchas. This re-reads the project, asks what changed, and folds it into AGENTS.md and the notes beside it. Cheaper than a fresh setup, and whatever is still right is kept.",
    },
  }),
  skill({
    skill: "plan2code-0-pathfinder",
    workflow: "pathfinder",
    label: "Pathfinder",
    name: "Pathfinder",
    pose: "pathfinder",
    builds: false, phased: false, metered: false, templates: true,
    subagents: "Use helpers for codebase recon, sketches and lookups beside the conversation. Keep every question for the person with you.",
    states: ["none", "unrecognized", "exploring"], marksNext: true,
    greyed: {
      default: "This spec is already past the questions",
      diagnosed: "The cause is found. Fix it in a quick task, or plan it.",
      finished: FIXED_REASON,
    },
    card: {
      group: "pipeline",
      chip: "Step 0",
      spec: true,
      title: "Pathfinder",
      blurb: "A foggy idea becomes a clear list of decisions, settled one question at a time.",
      about:
        "You have a rough idea and a lot of unknowns. Pathfinder asks one question at a time: who it is for, what it must do, what could go wrong. Each answer is written down in a spec folder. It ends with a list of decisions clear enough to plan from, and nothing gets built yet.",
    },
  }),
  skill({
    skill: "plan2code-1-plan",
    workflow: "plan",
    label: "Planning",
    name: "Plan",
    pose: "plan",
    builds: false, phased: false, metered: true, templates: true,
    subagents: null,
    states: ["none", "unrecognized", "diagnosed", "mapped", "planned"], marksNext: true,
    greyed: {
      default: "The plan is written. Revise it instead if it moved.",
      exploring: "Pathfinder is not finished with this spec yet",
      finished: FIXED_REASON,
    },
    card: {
      group: "pipeline",
      chip: "Step 1",
      spec: true,
      title: "Plan",
      blurb: "Requirements, technical design and your approval: the shape of what gets built.",
      about:
        "Turns what you bring into a real plan: a finished Pathfinder map, a folder of design notes, or just the idea in your head. You get requirements, a technical design, a phase-by-phase breakdown, and a final version to approve before anything is built. This is where 'what are we building' becomes 'how it gets built'.",
    },
  }),
  skill({
    skill: "plan2code-1b-revise-plan",
    workflow: "revise-plan",
    label: "Revising the plan",
    name: "Revise plan",
    pose: "plan",
    builds: false, phased: false, metered: true, templates: false,
    subagents: null,
    states: ["documented", "building"],
    greyed: { default: "Needs a spec that is already written up", built: "The spec is fully built" },
    card: {
      group: "pipeline",
      chip: "Step 1b",
      spec: true,
      title: "Revise the plan",
      blurb: "Requirements changed mid-build? Adjust the plan without starting over.",
      about:
        "Requirements moved mid-build: a feature added, a rule dropped, a deadline pulled in. This adjusts the existing spec for the change, shows you what it affects, and only rewrites what actually has to move. The approved plan stays the plan.",
    },
  }),
  skill({
    skill: "plan2code-2-document",
    workflow: "document",
    label: "Documenting",
    name: "Document",
    pose: "document",
    builds: false, phased: false, metered: true, templates: false,
    subagents: null,
    states: ["planned"], marksNext: true,
    greyed: {
      default: "Needs a drafted plan first",
      documented: "The phases are already written up",
      building: "The phases are already written up",
      built: "The phases are already written up",
    },
    card: {
      group: "pipeline",
      chip: "Step 2",
      spec: true,
      title: "Document",
      blurb: "The plan becomes a checklist of small tasks, grouped into phases, that a developer can just do.",
      about:
        "Writes the plan as numbered phase files. Each phase is a checklist of tasks small enough to just do, with the details a builder needs right there. This is the file the build step works from, and the thing a later session can pick up cold.",
    },
  }),
  skill({
    skill: "plan2code-3-implement",
    workflow: "implement",
    label: "Building",
    name: "Implement",
    pose: "implement",
    builds: true, phased: true, metered: false, templates: false,
    subagents: BUILD_HELPERS,
    states: ["documented", "building"], marksNext: true,
    greyed: BUILD_GREYED,
    card: {
      group: "pipeline",
      chip: "Step 3",
      spec: true,
      title: "Implement",
      blurb: "Builds the next phase, task by task, with a report and your sign-off at the end.",
      about:
        "Builds the next phase of the spec. Tasks get checked off one by one, with progress and the occasional decision landing on this page as it goes. It ends with a report of what was built and a sign-off card you approve before the phase counts as done.",
    },
  }),
  skill({
    skill: "plan2code-3-implement-review",
    workflow: "implement-review",
    label: "Building + review",
    name: "Implement + Review",
    pose: "implement",
    builds: true, phased: true, metered: false, templates: false,
    subagents: BUILD_HELPERS,
    states: ["documented", "building"], marksNext: true,
    greyed: BUILD_GREYED,
    card: {
      group: "pipeline",
      chip: "Step 3",
      spec: true,
      title: "Implement + review",
      blurb: "One phase built, then a careful review of the changes, then your sign-off. All in one run.",
      about:
        "The same build as Implement, with a review folded in before sign-off. The phase is built, then a fresh pass hunts for problems in exactly what changed, you pick what gets fixed, and only then does the sign-off card arrive.",
    },
  }),
  skill({
    skill: "plan2code-4-finalize",
    workflow: "finalize",
    label: "Wrapping up",
    name: "Finalize",
    pose: "finalize",
    builds: false, phased: false, metered: true, templates: false,
    subagents: null,
    states: ["built"], marksNext: true,
    greyed: { default: "Needs a spec that is fully built" },
    card: {
      group: "pipeline",
      chip: "Step 4",
      spec: true,
      title: "Finalize",
      blurb: "Checks the work, writes the summary, files the specs away and suggests the commit message.",
      about:
        "The closer. Checks every task against the spec, makes sure the build actually works, writes the summary into overview.md, updates the project docs, and suggests the commit message. Run it when the feature is done. It leaves the project tidy behind it.",
    },
  }),
  skill({
    skill: "plan2code-quick-task",
    workflow: "quick-task",
    label: "Quick task",
    name: "Quick task",
    pose: "quick-task",
    builds: true, phased: false, metered: true, templates: true,
    subagents: "Use helpers for side lookups, such as reading unfamiliar code or checking documentation, while you make the change yourself.",
    states: "any",
    greyed: null,
    card: {
      group: "extra",
      chip: "Utility",
      title: "Quick task",
      blurb: "Too small for the full process? A quick plan, then it just builds it.",
      about:
        "A fix, a tweak, a small feature. Not worth a spec folder. Describe it, confirm the one-line plan, and it builds it right there, with a report at the end. The fast lane for work the full process would over-plan.",
    },
  }),
  skill({
    skill: "plan2code-review",
    workflow: "review",
    label: "Review",
    name: "Review",
    pose: "review",
    builds: false, phased: false, metered: true, templates: false,
    subagents: "Run the review's analysis in one fresh helper briefed only with the spec and the change set (references/reviewer-brief.md); verify every finding yourself before you report.",
    states: "any",
    greyed: null,
    card: {
      group: "extra",
      chip: "Utility",
      title: "Review",
      blurb: "A second opinion on the changes. Problems ranked, and you pick what gets fixed.",
      about:
        "A fresh-eyes pass over what changed: bugs, gaps, and the things the builder was too close to see. Problems come back ranked with a suggestion each, you pick which ones get fixed, and it fixes them.",
    },
  }),
  skill({
    skill: "plan2code-xray",
    workflow: "xray",
    label: "X-ray",
    name: "X-ray",
    pose: "xray",
    builds: false, phased: false, metered: true, templates: false,
    subagents: null,
    states: "any",
    greyed: null,
    card: {
      group: "extra",
      chip: "Utility",
      title: "Codebase X-ray",
      blurb: "Explain how and why an area works, or find the rough spots worth fixing.",
      about:
        "Two ways into code you did not write. Explain an area: how it works, step by step, and why it is that way, citing the files and the commits and pull requests behind it. Or find the rough spots: files that always change together, thin layers, tangled boundaries and busy code with no tests, ranked with a concrete example each. You tick the ones worth fixing and they become a brief for Pathfinder or Plan. It never changes code.",
    },
  }),
  skill({
    skill: "plan2code-diagnose",
    workflow: "diagnose",
    label: "Diagnosing",
    name: "Diagnose",
    pose: "diagnose",
    builds: false, phased: false, metered: true, templates: false,
    subagents: null,
    states: "any",
    greyed: null,
    card: {
      group: "extra",
      chip: "Utility",
      title: "Diagnose a bug",
      blurb: "Find a bug's cause and write it up, without fixing it.",
      about:
        "Something is broken and nobody knows why. Diagnose asks what goes wrong and how to see it, then builds a command that fails on the bug before it forms a theory. It narrows the cause down to a file and a function, says how sure it is, and sizes the fix. The write-up lands in a spec folder, and the dashboard then offers Quick Task to fix it, or Plan when the fix is big. It never changes code.",
    },
  }),
  skill({
    skill: "plan2code-changelog",
    workflow: "changelog",
    label: "Changelog",
    name: "Changelog",
    pose: "changelog",
    builds: false, phased: false, metered: true, templates: false,
    subagents: null,
    states: "any",
    greyed: null,
    card: {
      group: "extra",
      chip: "Utility",
      title: "Changelog",
      blurb: "Checks the CHANGELOG version against the main branch and suggests entries for what is new.",
      about:
        "Works out the right version from the default branch, then compares your branch with the latest CHANGELOG entry and suggests the entries it is missing. You edit them before anything is written, it keeps package.json in step, and it offers to commit the result in Git. If the newest version is not released or on another branch yet, it adds to that entry instead of starting a new one.",
    },
  }),
  skill({
    skill: "plan2code-git",
    workflow: "git",
    label: "Git",
    name: "Git",
    pose: "git",
    builds: false, phased: false, metered: true, templates: false,
    subagents: null,
    states: "any",
    greyed: null,
    card: {
      group: "extra",
      chip: "Utility",
      title: "Git",
      blurb: "Branches, pull, push and commits on one board that stays open while you work.",
      about:
        "Shows your branch, what is ahead or behind, and every local and remote branch. Switch, create, delete or clean up branches, pull (rebasing when they have split, with help on conflicts), push or publish, and commit with a clear message. It asks before every push, publish and delete, and never force-pushes.",
    },
  }),
  skill({
    skill: "plan2code-handoff",
    workflow: "handoff",
    label: "Handoff",
    name: "Handoff",
    pose: "handoff",
    builds: false, phased: false, metered: false, templates: false,
    subagents: null,
    states: "any",
    greyed: null,
    card: {
      group: "extra",
      chip: "Utility",
      title: "Handoff",
      blurb: "Pack the current session into a document a fresh session can pick up cold.",
      about:
        "Writes down everything a new session would need, as a single document: what was decided, what is done, what is left. Use it when a conversation got long, a machine changed, or tomorrow-you deserves the context today-you has.",
    },
  }),
  skill({
    skill: "plan2code",
    workflow: "dashboard",
    label: "Dashboard",
    name: "the dashboard",
    pose: null,
    builds: false, phased: false, metered: false, templates: false,
    subagents: null,
    states: null,
    greyed: null,
    card: null,
  }),
]);

const BY_WORKFLOW = new Map(SKILLS.map((s) => [s.workflow, s]));
const BY_SKILL = new Map(SKILLS.map((s) => [s.skill, s]));

/** The entry for a workflow ("implement"), or null. */
export function skillFor(workflow) {
  return BY_WORKFLOW.get(workflow) || null;
}

/** The entry for an installed skill's name ("plan2code-3-implement"), or null. */
export function skillByName(name) {
  return BY_SKILL.get(name) || null;
}

export const isBuild = (workflow) => Boolean(skillFor(workflow)?.builds);
export const isPhased = (workflow) => Boolean(skillFor(workflow)?.phased);
export const isMetered = (workflow) => Boolean(skillFor(workflow)?.metered);
export const takesTemplates = (workflow) => Boolean(skillFor(workflow)?.templates);

/** The Subagents switch's instruction for a workflow, or null when it is not offered. */
export function subagentsFor(workflow) {
  return skillFor(workflow)?.subagents || null;
}

/** The badge a workflow wears, or null for one the console does not know. */
export function labelFor(workflow) {
  return skillFor(workflow)?.label || null;
}
