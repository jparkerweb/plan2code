// Web console tests, the spec states: public/spec-states.js defines every
// state the dashboard scan can report, and the labels, next steps and card
// rules are lookups on it.
// Run with: node --test scripts/test-web-console-spec-states.mjs

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SPEC_STATES as TABLE, stateFor } from "../src/web-console/public/spec-states.js";
import { SKILLS } from "../src/web-console/public/skills.js";
import { SKILL_CATALOG, cardAvailability, defaultSpec } from "../src/web-console/public/answers.js";
import { scanProject } from "../src/web-console/scan.mjs";

// What the picker labels each state and which card each state lights, as
// answers.js's SPEC_STATE_LABELS and NEXT_FOR_STATE said before the table.
const LABELS = {
  diagnosed: "Bug diagnosed",
  fixed: "Bug fixed",
  exploring: "Exploring",
  mapped: "Ready to plan",
  planned: "Ready to document",
  documented: "Ready to build",
  building: "Building",
  built: "Ready to finalize",
  unrecognized: "Files on disk",
};
const NEXT = {
  diagnosed: "plan2code-quick-task",
  fixed: null,
  exploring: "plan2code-0-pathfinder",
  mapped: "plan2code-1-plan",
  planned: "plan2code-2-document",
  documented: "plan2code-3-implement",
  building: "plan2code-3-implement",
  built: "plan2code-4-finalize",
  unrecognized: null,
};

test("spec states: each state keeps its label and next step, and only fixed is finished", () => {
  assert.deepEqual(Object.keys(TABLE), Object.keys(LABELS), "the states, in the scan's order");
  for (const [name, label] of Object.entries(LABELS)) {
    const s = stateFor(name);
    assert.ok(s, `${name} is in the table`);
    assert.equal(s.label, label, `${name}'s label`);
    assert.equal(s.next, NEXT[name], `${name}'s next step`);
    assert.equal(s.finished, name === "fixed", `${name}'s finished flag`);
  }
  assert.equal(stateFor("made-up"), null, "an unknown state is null");
  assert.ok(Object.isFrozen(TABLE) && Object.values(TABLE).every(Object.isFrozen), "the table is frozen");
});

// Every card's answer for every picker selection, as cardAvailability() gave
// them before the card rules moved onto skills.js: generated once from that
// code and written out here, so the move is proven to change nothing. "none"
// is "start from scratch" (no spec picked). The scan is a set-up git project
// with nothing to commit; SCAN_CASES covers the three cards that read it.
const SCAN = { hasAgents: true, isGit: true, pending: 0 };
const CARDS = {
  "plan2code-init": {
    "none": { on: false, reason: "AGENTS.md is already written. Refresh it instead." },
    diagnosed: { on: false, reason: "AGENTS.md is already written. Refresh it instead." },
    fixed: { on: false, reason: "AGENTS.md is already written. Refresh it instead." },
    exploring: { on: false, reason: "AGENTS.md is already written. Refresh it instead." },
    mapped: { on: false, reason: "AGENTS.md is already written. Refresh it instead." },
    planned: { on: false, reason: "AGENTS.md is already written. Refresh it instead." },
    documented: { on: false, reason: "AGENTS.md is already written. Refresh it instead." },
    building: { on: false, reason: "AGENTS.md is already written. Refresh it instead." },
    built: { on: false, reason: "AGENTS.md is already written. Refresh it instead." },
    unrecognized: { on: false, reason: "AGENTS.md is already written. Refresh it instead." },
  },
  "plan2code-init-update": {
    "none": { on: true },
    diagnosed: { on: true },
    fixed: { on: true },
    exploring: { on: true },
    mapped: { on: true },
    planned: { on: true },
    documented: { on: true },
    building: { on: true },
    built: { on: true },
    unrecognized: { on: true },
  },
  "plan2code-0-pathfinder": {
    "none": { on: true, next: true },
    diagnosed: { on: false, reason: "The cause is found. Fix it in a quick task, or plan it." },
    fixed: { on: false, reason: "This bug is fixed. Delete it with the Delete button on its chip, or move it to specs--completed/." },
    exploring: { on: true, next: true },
    mapped: { on: false, reason: "This spec is already past the questions" },
    planned: { on: false, reason: "This spec is already past the questions" },
    documented: { on: false, reason: "This spec is already past the questions" },
    building: { on: false, reason: "This spec is already past the questions" },
    built: { on: false, reason: "This spec is already past the questions" },
    unrecognized: { on: true, next: false },
  },
  "plan2code-1-plan": {
    "none": { on: true, next: false },
    diagnosed: { on: true, next: false },
    fixed: { on: false, reason: "This bug is fixed. Delete it with the Delete button on its chip, or move it to specs--completed/." },
    exploring: { on: false, reason: "Pathfinder is not finished with this spec yet" },
    mapped: { on: true, next: true },
    planned: { on: true, next: false },
    documented: { on: false, reason: "The plan is written. Revise it instead if it moved." },
    building: { on: false, reason: "The plan is written. Revise it instead if it moved." },
    built: { on: false, reason: "The plan is written. Revise it instead if it moved." },
    unrecognized: { on: true, next: false },
  },
  "plan2code-1b-revise-plan": {
    "none": { on: false, reason: "Needs a spec that is already written up" },
    diagnosed: { on: false, reason: "Needs a spec that is already written up" },
    fixed: { on: false, reason: "Needs a spec that is already written up" },
    exploring: { on: false, reason: "Needs a spec that is already written up" },
    mapped: { on: false, reason: "Needs a spec that is already written up" },
    planned: { on: false, reason: "Needs a spec that is already written up" },
    documented: { on: true },
    building: { on: true },
    built: { on: false, reason: "The spec is fully built" },
    unrecognized: { on: false, reason: "Needs a spec that is already written up" },
  },
  "plan2code-2-document": {
    "none": { on: false, reason: "Needs a drafted plan first" },
    diagnosed: { on: false, reason: "Needs a drafted plan first" },
    fixed: { on: false, reason: "Needs a drafted plan first" },
    exploring: { on: false, reason: "Needs a drafted plan first" },
    mapped: { on: false, reason: "Needs a drafted plan first" },
    planned: { on: true, next: true },
    documented: { on: false, reason: "The phases are already written up" },
    building: { on: false, reason: "The phases are already written up" },
    built: { on: false, reason: "The phases are already written up" },
    unrecognized: { on: false, reason: "Needs a drafted plan first" },
  },
  "plan2code-3-implement": {
    "none": { on: false, reason: "Needs the phase checklists written up first" },
    diagnosed: { on: false, reason: "Needs the phase checklists written up first" },
    fixed: { on: false, reason: "Needs the phase checklists written up first" },
    exploring: { on: false, reason: "Needs the phase checklists written up first" },
    mapped: { on: false, reason: "Needs the phase checklists written up first" },
    planned: { on: false, reason: "Needs the phase checklists written up first" },
    documented: { on: true, next: true },
    building: { on: true, next: true },
    built: { on: false, reason: "All tasks are already done" },
    unrecognized: { on: false, reason: "Needs the phase checklists written up first" },
  },
  "plan2code-3-implement-review": {
    "none": { on: false, reason: "Needs the phase checklists written up first" },
    diagnosed: { on: false, reason: "Needs the phase checklists written up first" },
    fixed: { on: false, reason: "Needs the phase checklists written up first" },
    exploring: { on: false, reason: "Needs the phase checklists written up first" },
    mapped: { on: false, reason: "Needs the phase checklists written up first" },
    planned: { on: false, reason: "Needs the phase checklists written up first" },
    documented: { on: true, next: false },
    building: { on: true, next: false },
    built: { on: false, reason: "All tasks are already done" },
    unrecognized: { on: false, reason: "Needs the phase checklists written up first" },
  },
  "plan2code-4-finalize": {
    "none": { on: false, reason: "Needs a spec that is fully built" },
    diagnosed: { on: false, reason: "Needs a spec that is fully built" },
    fixed: { on: false, reason: "Needs a spec that is fully built" },
    exploring: { on: false, reason: "Needs a spec that is fully built" },
    mapped: { on: false, reason: "Needs a spec that is fully built" },
    planned: { on: false, reason: "Needs a spec that is fully built" },
    documented: { on: false, reason: "Needs a spec that is fully built" },
    building: { on: false, reason: "Needs a spec that is fully built" },
    built: { on: true, next: true },
    unrecognized: { on: false, reason: "Needs a spec that is fully built" },
  },
  "plan2code-quick-task": {
    "none": { on: true },
    diagnosed: { on: true, next: true },
    fixed: { on: true },
    exploring: { on: true },
    mapped: { on: true },
    planned: { on: true },
    documented: { on: true },
    building: { on: true },
    built: { on: true },
    unrecognized: { on: true },
  },
  "plan2code-review": {
    "none": { on: true },
    diagnosed: { on: true },
    fixed: { on: true },
    exploring: { on: true },
    mapped: { on: true },
    planned: { on: true },
    documented: { on: true },
    building: { on: true },
    built: { on: true },
    unrecognized: { on: true },
  },
  "plan2code-xray": {
    "none": { on: true },
    diagnosed: { on: true },
    fixed: { on: true },
    exploring: { on: true },
    mapped: { on: true },
    planned: { on: true },
    documented: { on: true },
    building: { on: true },
    built: { on: true },
    unrecognized: { on: true },
  },
  "plan2code-diagnose": {
    "none": { on: true },
    diagnosed: { on: true },
    fixed: { on: true },
    exploring: { on: true },
    mapped: { on: true },
    planned: { on: true },
    documented: { on: true },
    building: { on: true },
    built: { on: true },
    unrecognized: { on: true },
  },
  "plan2code-changelog": {
    "none": { on: true },
    diagnosed: { on: true },
    fixed: { on: true },
    exploring: { on: true },
    mapped: { on: true },
    planned: { on: true },
    documented: { on: true },
    building: { on: true },
    built: { on: true },
    unrecognized: { on: true },
  },
  "plan2code-git": {
    "none": { on: true },
    diagnosed: { on: true },
    fixed: { on: true },
    exploring: { on: true },
    mapped: { on: true },
    planned: { on: true },
    documented: { on: true },
    building: { on: true },
    built: { on: true },
    unrecognized: { on: true },
  },
  "plan2code-handoff": {
    "none": { on: true },
    diagnosed: { on: true },
    fixed: { on: true },
    exploring: { on: true },
    mapped: { on: true },
    planned: { on: true },
    documented: { on: true },
    building: { on: true },
    built: { on: true },
    unrecognized: { on: true },
  },
};

const SCAN_CASES = [
  [{ hasAgents: false, isGit: false, pending: null }, "plan2code-init", { on: true }],
  [{ hasAgents: false, isGit: false, pending: null }, "plan2code-init-update", { on: false, reason: "Needs an AGENTS.md. Set the project up first." }],
  [{ hasAgents: false, isGit: false, pending: null }, "plan2code-git", { on: true, note: "Not a git repository yet: it offers to start one" }],
  [{ hasAgents: true, isGit: true, pending: 3 }, "plan2code-init", { on: false, reason: "AGENTS.md is already written. Refresh it instead." }],
  [{ hasAgents: true, isGit: true, pending: 3 }, "plan2code-init-update", { on: true }],
  [{ hasAgents: true, isGit: true, pending: 3 }, "plan2code-git", { on: true, note: "3 files to commit" }],
  [{ hasAgents: true, isGit: true, pending: 1 }, "plan2code-init", { on: false, reason: "AGENTS.md is already written. Refresh it instead." }],
  [{ hasAgents: true, isGit: true, pending: 1 }, "plan2code-init-update", { on: true }],
  [{ hasAgents: true, isGit: true, pending: 1 }, "plan2code-git", { on: true, note: "1 file to commit" }],
];

test("card rules: every card gives the same answer for every spec state as before", () => {
  assert.deepEqual(SKILL_CATALOG.map((e) => e.skill), Object.keys(CARDS), "one row per card, in card order");
  for (const entry of SKILL_CATALOG) {
    for (const [sel, want] of Object.entries(CARDS[entry.skill])) {
      const spec = sel === "none" ? null : { dir: "specs/x", name: "x", state: sel };
      assert.deepEqual(cardAvailability(entry, SCAN, spec), want, `${entry.skill} with ${sel}`);
    }
  }
});

test("card rules: a state the table does not know is treated like files on disk", () => {
  for (const entry of SKILL_CATALOG) {
    const weird = cardAvailability(entry, SCAN, { dir: "specs/x", name: "x", state: "made-up" });
    assert.deepEqual(weird, CARDS[entry.skill].unrecognized, `${entry.skill} with an unknown state`);
  }
});

test("card rules: Init, Init update and Git read the scan, not the spec", () => {
  for (const [scan, skill, want] of SCAN_CASES) {
    const entry = SKILL_CATALOG.find((e) => e.skill === skill);
    assert.deepEqual(cardAvailability(entry, scan, null), want, `${skill} with ${JSON.stringify(scan)}`);
  }
});

test("finished: any finished state is never the picker's default, not only fixed", () => {
  // The test's own copy of the table, with a made-up second finished state.
  const table = { ...TABLE, archived: { label: "Archived", next: null, finished: true } };
  const lookup = (name) => (Object.hasOwn(table, name) ? table[name] : null);
  const specs = [
    { dir: "specs/a", name: "a", state: "archived" },
    { dir: "specs/b", name: "b", state: "fixed" },
    { dir: "specs/c", name: "c", state: "planned" },
  ];
  assert.equal(defaultSpec(specs, lookup)?.dir, "specs/c", "the newest spec still in play");
  assert.equal(defaultSpec(specs.slice(0, 2), lookup), null, "only finished specs: start from scratch");
  assert.equal(defaultSpec(specs)?.dir, "specs/a", "the real table does not know archived, so it is in play");

  // The cards greyed for a fixed bug give a made-up finished state the same reason.
  const archived = { dir: "specs/a", name: "a", state: "archived" };
  for (const entry of SKILL_CATALOG) {
    const fixed = cardAvailability(entry, SCAN, { dir: "specs/b", name: "b", state: "fixed" });
    assert.deepEqual(cardAvailability(entry, SCAN, archived, lookup), fixed, `${entry.skill} treats archived as it treats fixed`);
  }
});

// One spec folder per state, in the shapes classifySpec() reads.
const PHASE = (ticks) => "# Phase 1\n\n" + ticks.map((x, i) => `- [${x ? "x" : " "}] **Task 1.${i + 1}:** Step ${i + 1}\n`).join("");
const FIXTURES = {
  diagnosed: { "DIAGNOSIS-20261017.md": "# Diagnosis\n\n**Status:** Diagnosed\n" },
  fixed: { "DIAGNOSIS-20261017.md": "# Diagnosis\n\n**Status:** Fixed\n" },
  exploring: { "pathfinder/map.md": "# Map\n\nStatus: Working\n" },
  mapped: { "PLAN-DRAFT-20261017.md": "# Plan draft\n\n**Status:** Phase 3 Complete - Resume at Phase 4\n" },
  planned: { "PLAN-DRAFT-20261017.md": "# Plan draft\n\n**Status:** Draft\n" },
  documented: { "overview.md": "# Overview\n", "phase-1.md": PHASE([false, false]) },
  building: { "overview.md": "# Overview\n", "phase-1.md": PHASE([true, false]) },
  built: { "overview.md": "# Overview\n", "phase-1.md": PHASE([true, true]) },
  unrecognized: { "notes.md": "Some loose notes.\n" },
};

// The states a scan of these fixtures reports, against the table's: the
// lines that name what does not match, empty when they agree.
function scanProblems(fixtures, table) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-spec-states-"));
  try {
    for (const [name, files] of Object.entries(fixtures))
      for (const [rel, text] of Object.entries(files)) {
        const file = path.join(root, "specs", name, rel);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, text);
      }
    const scan = scanProject(root);
    const problems = scan.specs.filter((sp) => sp.state !== sp.name).map((sp) => `the ${sp.name} fixture scans as ${sp.state}`);
    const seen = new Set(scan.specs.map((sp) => sp.state));
    for (const state of seen) if (!Object.hasOwn(table, state)) problems.push(`the scan returns ${state}, which spec-states.js lacks`);
    for (const state of Object.keys(table)) if (!seen.has(state)) problems.push(`no fixture reaches ${state}: add one, or drop it from spec-states.js`);
    return problems;
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("the scan: every state it can return is in the table, and a fixture reaches every state in it", () => {
  assert.deepEqual(scanProblems(FIXTURES, TABLE), []);
  // The check names what is missing.
  const { built, ...short } = FIXTURES;
  assert.deepEqual(scanProblems(short, TABLE), ["no fixture reaches built: add one, or drop it from spec-states.js"]);
  const { unrecognized, ...known } = TABLE;
  assert.deepEqual(scanProblems(FIXTURES, known), ["the scan returns unrecognized, which spec-states.js lacks"]);
});

// The states no card names in its `states` list: a card that is on for "any"
// spec does not count, since it would take a state nobody thought about. A
// finished state is taken by no card on purpose.
function untakenStates(skills, table) {
  const taken = new Set(skills.flatMap((sk) => (Array.isArray(sk.states) ? sk.states : [])));
  return Object.entries(table)
    .filter(([name, s]) => !s.finished && !taken.has(name))
    .map(([name]) => `no card's states take ${name}: add it to the skills.js entries whose card it lights`);
}

test("card rules: every state still in play is taken by at least one card", () => {
  assert.deepEqual(untakenStates(SKILLS, TABLE), []);
  // The check names the state: Document and Plan are the cards that take planned.
  const without = SKILLS.map((sk) =>
    Array.isArray(sk.states) && (sk.skill === "plan2code-2-document" || sk.skill === "plan2code-1-plan")
      ? { ...sk, states: sk.states.filter((st) => st !== "planned") }
      : sk
  );
  assert.deepEqual(untakenStates(without, TABLE), ["no card's states take planned: add it to the skills.js entries whose card it lights"]);
});

test("card rules: a card's states and greyed reasons name only real states", () => {
  const known = new Set([...Object.keys(TABLE), "none"]);
  for (const sk of SKILLS) {
    if (Array.isArray(sk.states)) for (const st of sk.states) assert.ok(known.has(st), `${sk.skill} takes ${st}, which is no state`);
    for (const key of Object.keys(sk.greyed || {})) assert.ok(key === "default" || key === "finished" || known.has(key), `${sk.skill}'s greyed names ${key}, which is no state`);
    if (Array.isArray(sk.states) && sk.card) assert.ok(sk.greyed && sk.greyed.default, `${sk.skill} has a default greyed reason`);
  }
});

// The states the dashboard skill's prose (src/plan2code.md) never mentions,
// by name in backticks (`planned`) or by label in quotes ("Ready to
// document"). The agent reads that prose to choose its recommendation, so
// every state needs a word there; a bare word ("reading or exploring", a file
// named building-habits.md) is not one.
function unmentionedStates(prose, table) {
  const lower = prose.toLowerCase();
  return Object.entries(table)
    .filter(([name, s]) => !prose.includes("`" + name + "`") && !lower.includes(`"${s.label.toLowerCase()}"`))
    .map(([name, s]) => `src/plan2code.md mentions neither \`${name}\` nor "${s.label}"`);
}

test("the dashboard skill: its prose names every spec state", () => {
  const prose = fs.readFileSync(path.join(import.meta.dirname, "..", "src", "plan2code.md"), "utf8");
  assert.deepEqual(unmentionedStates(prose, TABLE), []);
  const sample = 'Only `planned` and "Ready to build", while building and exploring are bare words.';
  const some = { planned: TABLE.planned, documented: TABLE.documented, building: TABLE.building, exploring: TABLE.exploring };
  assert.deepEqual(unmentionedStates(sample, some), [
    'src/plan2code.md mentions neither `building` nor "Building"',
    'src/plan2code.md mentions neither `exploring` nor "Exploring"',
  ]);
});
