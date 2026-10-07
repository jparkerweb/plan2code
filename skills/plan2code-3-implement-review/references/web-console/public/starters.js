// Plan2Code Web Console - roles, starter templates and Ask starter questions.
//
// The source of truth for the Role list in User Preferences, the starter
// templates on the first "What's the idea?" card of Pathfinder, Plan and Quick
// Task, the order each role sees them in, and the starter questions an empty
// Ask conversation offers. No DOM access at module scope and no imports: the
// page and `node --test` both import this file.

const role = (id, label) => Object.freeze({ id, label });

export const ROLES = Object.freeze([
  role("engineer", "Engineer"),
  role("pm", "Product lead / PM"),
  role("architect", "Architect / tech lead"),
  role("designer", "Designer (UX)"),
  role("qa", "QA / test engineer"),
  role("em", "Engineering manager"),
]);

export const ROLE_NOT_SET = "none";
export const ROLE_NOT_SET_LABEL = "Not set / none of these";

export const TEMPLATE_WORKFLOWS = Object.freeze(["pathfinder", "plan", "quick-task"]);

const ROLE_IDS = new Set(ROLES.map((r) => r.id));

// A known role id, or "none" for anything else (missing, unknown, not a string).
export function normalizeRole(value) {
  return ROLE_IDS.has(value) ? value : ROLE_NOT_SET;
}

// The dashboard nudge shows until looks.json carries a role of any value:
// choosing Not set, or pressing Not now, ends it just as a real role does.
export function needsRoleNudge(looks) {
  if (!looks || typeof looks !== "object") return true;
  return !Object.hasOwn(looks, "role");
}

// The wording was revised in v2.5.1 (Markdown sections); a change is a page change.
const template = (id, label, lines) => Object.freeze({ id, label, text: lines.join("\n") });

export const TEMPLATES = Object.freeze({
  "engineering-spec": template("engineering-spec", "Engineering spec", [
    "## Engineering spec",
    "[the feature or change, in a sentence]",
    "",
    "## Who reads it",
    "The engineers who will build and review it.",
    "",
    "## What it should pin down",
    "The behaviour, the parts of the code it touches, the interfaces between them, the simpler options we're turning down, and how we'll know it works.",
    "",
    "## Out of scope",
    "[what this deliberately won't do]",
    "",
    "## What I already know",
    "[constraints, links, earlier attempts]",
  ]),
  "product-requirements": template("product-requirements", "Product requirements", [
    "## Product requirements",
    "[the feature, in a sentence]",
    "",
    "## Who it's for",
    "[the users], and the product, design and engineering people deciding on it.",
    "",
    "## What it should pin down",
    "The problem, who has it, the evidence it's real, and how we'll measure success.",
    "",
    "## Not doing",
    "[what this release leaves out]",
    "",
    "## What I already know",
    "[customer asks, data, deadlines]",
  ]),
  "design-decision": template("design-decision", "Design decision", [
    "## Design decision",
    "[the choice we're facing, in a sentence]",
    "",
    "## Who it's for",
    "The engineers and architects who will live with it.",
    "",
    "## What it should pin down",
    "The options, the trade-offs of each, the one we pick and why, and what it costs us later.",
    "",
    "## Constraints",
    "[performance, compatibility, deadlines, team skills]",
  ]),
  "test-strategy": template("test-strategy", "Test strategy", [
    "## Test strategy",
    "[the feature or area]",
    "",
    "## Who reads it",
    "QA and the engineers writing the tests.",
    "",
    "## What it should pin down",
    'What\'s riskiest, meaning what costs most if it breaks, what gets tested at which level (unit, integration, end to end, by hand), the test data needed, and what "done" means.',
    "",
    "## What exists today",
    "[current tests, known gaps]",
  ]),
  "scoping-rollout": template("scoping-rollout", "Scoping & rollout", [
    "## Scoping and rollout",
    "[the feature or project]",
    "",
    "## Who reads it",
    "The engineering manager, the product lead and the team.",
    "",
    "## What it should pin down",
    "What's in the first release and what waits, the build order, risks to the timeline, how it reaches users (flags, stages, who sees it first), and how we roll it back.",
    "",
    "## Constraints",
    "[dates, people, dependencies]",
  ]),
  "brainstorm-notes": template("brainstorm-notes", "Brainstorm → curated notes", [
    "## Brainstorm to curated notes",
    "[the topic or rough idea]",
    "",
    "## Who reads the notes",
    "[the team or people this goes to]",
    "",
    "## What I want out of it",
    "The ideas worth keeping, grouped, with the open questions, and the ones we dropped and why.",
    "",
    "## Starting thoughts",
    "[anything already on your mind]",
  ]),
  "bug-investigation": template("bug-investigation", "Bug investigation", [
    "## Bug investigation",
    "[what's going wrong, in a sentence]",
    "",
    "## Steps to reproduce",
    "1. [first step]",
    "2. [next step]",
    "",
    "## Expected",
    "[what should happen]",
    "",
    "## Actual",
    "[what happens instead]",
    "",
    "## How often",
    "[every time, sometimes, once]",
    "",
    "## Error or logs",
    "[paste the exact text]",
    "",
    "## Where and since when",
    "[environment, version, first seen]",
  ]),
  "small-change": template("small-change", "Small change", [
    "## Small change",
    "[what to change, in a sentence]",
    "",
    "## Where",
    "[the file, screen or command, if you know it]",
    "",
    "## Leave alone",
    "[anything that must not change]",
    "",
    "## Done when",
    "[the command to run or the thing to check]",
  ]),
  "copy-tweak": template("copy-tweak", "Copy / content tweak", [
    "## Copy or content tweak",
    "[the screen, message, email or doc]",
    "",
    "## Current text",
    "[paste it]",
    "",
    "## New text",
    "[paste it, or describe the tone you want]",
    "",
    "## Who reads it",
    "[the people who see it]",
  ]),
  "ui-polish": template("ui-polish", "UI polish", [
    "## UI polish",
    "[the screen or component]",
    "",
    "## What looks or feels off",
    "[spacing, alignment, colour, states, small screens]",
    "",
    "## What good looks like",
    "[a reference, screenshot or description]",
    "",
    "## Leave alone",
    "[anything that must not move]",
  ]),
  "visual-prototype": template("visual-prototype", "Visual prototype", [
    "## Visual prototype",
    "[the screen or component to mock up]",
    "",
    "## What to show",
    "[the states or flows to click through]",
    "",
    "## What I want to learn",
    "[the question it should answer]",
    "",
    "## Where it lives",
    "A prototypes/ folder [or its own branch], never wired into the real code.",
  ]),
  "add-a-test": template("add-a-test", "Add a test", [
    "## Add a test",
    "[the function, behaviour or bug]",
    "",
    "## Cases to cover",
    "- [the normal case]",
    "- [the edge cases]",
    "- [the failure or bug it guards against]",
    "",
    "## Where tests live",
    "[the test file or folder, if you know it]",
  ]),
  "record-decision": template("record-decision", "Record a decision", [
    "## Record a decision",
    "[the decision we've already made, in a sentence]",
    "",
    "## Why",
    "[what forced the choice, and the options we turned down]",
    "",
    "## What it commits us to",
    "[the consequences]",
    "",
    "## Save it in",
    "docs/adr/ [or wherever this repo keeps them]",
  ]),
  refactor: template("refactor", "Refactor", [
    "## Refactor",
    "[what to restructure, in a sentence]",
    "",
    "## Why now",
    "[what the current shape makes hard]",
    "",
    "## Behaviour that must not change",
    "[the public API, outputs or tests that must stay the same]",
    "",
    "## Done when",
    "[the tests that must still pass, and the shape it ends in]",
  ]),
  "performance-problem": template("performance-problem", "Performance problem", [
    "## Performance problem",
    "[what's slow, in a sentence]",
    "",
    "## How it's measured today",
    "[the number, and how you got it]",
    "",
    "## Target",
    "[the number that counts as fixed]",
    "",
    "## Where",
    "[the endpoint, page, query or job]",
  ]),
  "dependency-upgrade": template("dependency-upgrade", "Dependency upgrade", [
    "## Dependency upgrade",
    "[the package, from version to version]",
    "",
    "## Why",
    "[security fix, a feature we need, end of support]",
    "",
    "## Known breaking changes",
    '[release notes link, or "not checked yet"]',
    "",
    "## Done when",
    "[the build, tests or checks that must pass]",
  ]),
  spike: template("spike", "Spike", [
    "## Spike",
    "[the question to answer, in a sentence]",
    "",
    "## Why it matters",
    "[the decision waiting on the answer]",
    "",
    "## Time box",
    "[how long before we stop and decide anyway]",
    "",
    "## Answered when",
    "[the evidence that would settle it]",
  ]),
  integration: template("integration", "Integration", [
    "## Integration",
    "[the system we're connecting to, and why]",
    "",
    "## What flows",
    "[the data or events, and in which direction]",
    "",
    "## Their side",
    "[API docs, auth method, rate limits, test sandbox]",
    "",
    "## When it fails",
    "[what should happen if they're down or slow]",
  ]),
  "data-migration": template("data-migration", "Data migration", [
    "## Data migration",
    "[what moves or changes shape]",
    "",
    "## Size and downtime",
    "[row counts, and whether users can stay on while it runs]",
    "",
    "## Rollback",
    "[how we undo it if it goes wrong]",
    "",
    "## Done when",
    "[the checks that prove nothing was lost]",
  ]),
});

const orders = (byRole) => Object.freeze(Object.fromEntries(Object.entries(byRole).map(([r, ids]) => [r, Object.freeze(ids)])));

// One full order per role per skill. No "none" row: Not set reads Engineer's.
export const TEMPLATE_ORDERS = Object.freeze({
  pathfinder: orders({
    engineer: ["engineering-spec", "design-decision", "spike", "integration", "test-strategy", "scoping-rollout", "product-requirements", "brainstorm-notes"],
    pm: ["product-requirements", "brainstorm-notes", "scoping-rollout", "spike", "engineering-spec", "design-decision", "integration", "test-strategy"],
    architect: ["design-decision", "engineering-spec", "integration", "spike", "scoping-rollout", "test-strategy", "product-requirements", "brainstorm-notes"],
    designer: ["brainstorm-notes", "product-requirements", "design-decision", "spike", "engineering-spec", "scoping-rollout", "integration", "test-strategy"],
    qa: ["test-strategy", "engineering-spec", "spike", "product-requirements", "integration", "scoping-rollout", "design-decision", "brainstorm-notes"],
    em: ["scoping-rollout", "engineering-spec", "product-requirements", "spike", "test-strategy", "design-decision", "integration", "brainstorm-notes"],
  }),
  plan: orders({
    engineer: ["engineering-spec", "bug-investigation", "refactor", "performance-problem", "integration", "data-migration", "design-decision", "test-strategy", "scoping-rollout", "product-requirements"],
    pm: ["product-requirements", "scoping-rollout", "engineering-spec", "integration", "test-strategy", "design-decision", "performance-problem", "bug-investigation", "data-migration", "refactor"],
    architect: ["design-decision", "engineering-spec", "data-migration", "integration", "refactor", "scoping-rollout", "performance-problem", "test-strategy", "product-requirements", "bug-investigation"],
    designer: ["product-requirements", "design-decision", "engineering-spec", "scoping-rollout", "performance-problem", "test-strategy", "bug-investigation", "integration", "refactor", "data-migration"],
    qa: ["test-strategy", "bug-investigation", "performance-problem", "engineering-spec", "data-migration", "integration", "product-requirements", "scoping-rollout", "refactor", "design-decision"],
    em: ["scoping-rollout", "engineering-spec", "data-migration", "product-requirements", "test-strategy", "integration", "bug-investigation", "performance-problem", "refactor", "design-decision"],
  }),
  "quick-task": orders({
    engineer: ["small-change", "bug-investigation", "refactor", "add-a-test", "dependency-upgrade", "performance-problem", "ui-polish", "record-decision", "copy-tweak", "visual-prototype"],
    pm: ["copy-tweak", "small-change", "visual-prototype", "ui-polish", "bug-investigation", "performance-problem", "add-a-test", "record-decision", "dependency-upgrade", "refactor"],
    architect: ["record-decision", "refactor", "small-change", "dependency-upgrade", "performance-problem", "bug-investigation", "add-a-test", "visual-prototype", "ui-polish", "copy-tweak"],
    designer: ["ui-polish", "visual-prototype", "copy-tweak", "small-change", "bug-investigation", "performance-problem", "add-a-test", "refactor", "dependency-upgrade", "record-decision"],
    qa: ["add-a-test", "bug-investigation", "performance-problem", "small-change", "dependency-upgrade", "ui-polish", "refactor", "copy-tweak", "visual-prototype", "record-decision"],
    em: ["small-change", "record-decision", "dependency-upgrade", "add-a-test", "bug-investigation", "performance-problem", "refactor", "copy-tweak", "ui-polish", "visual-prototype"],
  }),
});

const roleRow = (role) => {
  const r = normalizeRole(role);
  return r === ROLE_NOT_SET ? "engineer" : r;
};

/**
 * The idea card's template row for a skill: Blank first, then the skill's
 * templates in the role's order. The first template carries `forYou` only for
 * a chosen role, never for Not set. `[]` for a skill with no templates.
 */
export function templatesFor(workflow, role) {
  if (!TEMPLATE_WORKFLOWS.includes(workflow)) return [];
  const chosen = normalizeRole(role) !== ROLE_NOT_SET;
  const ordered = TEMPLATE_ORDERS[workflow][roleRow(role)].map((id, i) => {
    const { label, text } = TEMPLATES[id];
    return { id, label, text, forYou: chosen && i === 0 };
  });
  return [{ id: "blank", label: "Blank", text: "" }, ...ordered];
}

// Swapping templates: an empty box, or one untouched since the last pick,
// swaps silently; anything the person typed asks first.
export function templateSwap({ selectedText, boxText, nextText } = {}) {
  const box = typeof boxText === "string" ? boxText : "";
  const selected = typeof selectedText === "string" ? selectedText : "";
  return { text: typeof nextText === "string" ? nextText : "", confirm: box.trim() !== "" && box !== selected };
}

// Ask starter questions (PLAN-DRAFT Appendix B, approved). `lead` names the
// roles that see a starter first; `needsContext` starters wait for
// + Add context.
const starter = (id, text, lead, needsContext = false) =>
  Object.freeze({ id, text, lead: Object.freeze(lead), needsContext });

export const STARTER_SETS = Object.freeze({
  pathfinder: Object.freeze([
    starter("pathfinder-files", "Which files or parts of the code does this decision touch?", ["engineer", "architect"], true),
    starter("pathfinder-prior-art", "Has anything like this been done elsewhere in the repo?", ["engineer", "architect"]),
    starter("pathfinder-decided", "What have we already decided, and what's still open?", ["pm", "em", "architect"]),
    starter("pathfinder-plain", "What does this question mean, in plain words?", ["pm", "designer", "em"], true),
  ]),
  plan: Object.freeze([
    starter("plan-files", "Which existing files would this plan change?", ["engineer", "architect"]),
    starter("plan-test", "How would we test this?", ["qa", "engineer"], true),
    starter("plan-risks", "What are the biggest risks or unknowns in this plan?", ["architect", "em", "qa"]),
    starter("plan-plain", "Explain this section as if I'm not an engineer.", ["pm", "designer", "em"], true),
  ]),
  document: Object.freeze([
    starter("document-touch", "Where does this phase touch existing code?", ["engineer"], true),
    starter("document-guesses", "Which parts of this phase are still guesses?", ["architect", "engineer"], true),
    starter("document-users", "What will users notice once every phase ships?", ["designer", "pm", "qa"]),
    starter("document-summary", "Summarize the phases written so far in three bullets.", ["pm", "em"]),
  ]),
  build: Object.freeze([
    starter("build-last-task", "What changed in the last task, and why?", ["engineer", "em", "qa"]),
    starter("build-finding", "Where exactly is this finding in the code?", ["engineer", "qa"], true),
    starter("build-progress", "How far along are we, and what's next?", ["em", "pm"]),
    starter("build-check", "What should I check by hand after this phase?", ["qa", "designer"]),
  ]),
  "quick-task": Object.freeze([
    starter("quick-task-files", "Which files will this touch?", ["engineer"]),
    starter("quick-task-pattern", "Is there a similar pattern in the code I should follow?", ["engineer", "architect"]),
    starter("quick-task-size", "Is this bigger than a quick task?", ["em", "architect"]),
    starter("quick-task-try", "How do I try this out once it's done?", ["qa", "designer", "pm"]),
  ]),
  dashboard: Object.freeze([
    starter("dashboard-project", "What does this project do, in a paragraph?", ["pm", "designer", "em"]),
    starter("dashboard-which-skill", "Which skill should I use for my idea?", ["pm", "designer", "em"]),
    starter("dashboard-difference", "What's the difference between Pathfinder, Plan and Quick Task?", []),
    starter("dashboard-spec", "Where does this spec stand?", ["pm", "em"], true),
  ]),
  general: Object.freeze([
    starter("general-step", "What is this step going to do, and what will it change?", []),
    starter("general-summary", "Summarize this session so far.", ["em", "pm"]),
    starter("general-left", "What's left to do after this?", ["em", "pm"]),
  ]),
});

// Workflows missing here (init, init-update, revise-plan, finalize, handoff,
// anything unknown) use the general set.
export const STARTER_SET_FOR = Object.freeze({
  pathfinder: "pathfinder",
  plan: "plan",
  document: "document",
  implement: "build",
  "implement-review": "build",
  review: "build",
  "quick-task": "quick-task",
  dashboard: "dashboard",
});

/**
 * The starters an empty Ask conversation offers: the workflow's set, minus
 * those that need context until some is attached, with the role's leads
 * first and written order kept inside each group. Not set leads as Engineer.
 */
export function startersFor(workflow, role, { hasContext } = {}) {
  const setId = Object.hasOwn(STARTER_SET_FOR, workflow) ? STARTER_SET_FOR[workflow] : "general";
  const lead = roleRow(role);
  const shown = STARTER_SETS[setId].filter((s) => hasContext || !s.needsContext);
  const first = shown.filter((s) => s.lead.includes(lead));
  const rest = shown.filter((s) => !s.lead.includes(lead));
  return [...first, ...rest].map(({ id, text }) => ({ id, text }));
}
