// Web console tests, the skill list: public/skills.js holds every per-skill
// fact the console uses, and the older tables are lookups on it.
// Run with: node --test scripts/test-web-console-skills.mjs

import test from "node:test";
import assert from "node:assert/strict";
import {
  SKILLS,
  skillFor,
  skillByName,
  isBuild,
  isPhased,
  isMetered,
  subagentsFor,
  takesTemplates,
  labelFor,
  WORKFLOWS,
  isWorkflow,
} from "../src/web-console/public/skills.js";
import { CONSOLE_WORKFLOWS, SKILL_CATALOG, catalogEntry, launchVariant, START_POSES, WORKFLOW_LABEL, dashNoteKind, onInitialPick, startPose, startingHint } from "../src/web-console/public/answers.js";
import { LAUNCH_COUNTED, PROGRESS_WORKFLOWS } from "../src/web-console/public/meter.js";
import { BUILD_WORKFLOWS } from "../src/web-console/public/labels.js";
import { helpTabFor } from "../src/web-console/public/help.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { ROOT, cli, poseTemplate } from "./web-console-test-helpers.mjs";
import { SUBAGENT_WORKFLOWS } from "../src/web-console/public/subagents.js";
import { TEMPLATE_WORKFLOWS } from "../src/web-console/public/starters.js";

// meter.js keeps its answers-row names private: what they were when the list
// moved, written out. A skill added since has no row here, and only has to
// have a name.
const NAMES_AT_THE_MOVE = {
  dashboard: "the dashboard",
  pathfinder: "Pathfinder",
  plan: "Plan",
  "revise-plan": "Revise plan",
  document: "Document",
  implement: "Implement",
  "implement-review": "Implement + Review",
  review: "Review",
  "quick-task": "Quick task",
  init: "Init",
  "init-update": "Init update",
  finalize: "Finalize",
  handoff: "Handoff",
  git: "Git",
  changelog: "Changelog",
  xray: "X-ray",
  diagnose: "Diagnose",
};

const CARD_FIELDS = ["group", "chip", "title", "blurb", "about", "spec"];

test("every skill the console knows has one entry, the dashboard included", () => {
  const workflows = SKILLS.map((s) => s.workflow);
  assert.deepEqual([...workflows].sort(), Object.keys(WORKFLOW_LABEL).sort());
  assert.equal(new Set(workflows).size, workflows.length, "one entry per workflow");
  assert.deepEqual(SKILLS.map((s) => s.command).sort(), [...CONSOLE_WORKFLOWS].sort());
  // The cards come first, in the dashboard's order.
  const carded = SKILLS.filter((s) => s.card);
  assert.deepEqual(carded.map((s) => s.skill), SKILL_CATALOG.map((e) => e.skill));
  assert.equal(skillFor("dashboard").skill, "plan2code");
  assert.equal(skillFor("dashboard").card, null, "the dashboard is the hub, not a card");
});

// The older exports (WORKFLOW_LABEL, SKILL_CATALOG, LAUNCH_COUNTED and the
// rest) are now built from SKILLS, so this checks the wiring: each one still
// says what its entry says. It proved the move when the tables were still
// written by hand; the meter names and the build flags, which have no
// importable twin, are held to their values at the move.
test("the derived exports agree with each entry", () => {
  for (const s of SKILLS) {
    const w = s.workflow;
    for (const f of ["skill", "workflow", "label", "name"]) assert.ok(typeof s[f] === "string" && s[f].trim(), `${w}: ${f} must be filled in`);
    assert.equal(s.command, "/" + s.skill, `${w}: command`);
    assert.equal(s.label, WORKFLOW_LABEL[w], `${w}: label`);
    if (Object.hasOwn(NAMES_AT_THE_MOVE, w)) assert.equal(s.name, NAMES_AT_THE_MOVE[w], `${w}: name`);
    assert.equal(s.pose, startPose(w), `${w}: pose`);
    assert.equal(s.metered, LAUNCH_COUNTED.has(w), `${w}: metered`);
    assert.equal(s.subagents, SUBAGENT_WORKFLOWS[w] ? SUBAGENT_WORKFLOWS[w].instruction : null, `${w}: subagents`);
    assert.equal(s.templates, TEMPLATE_WORKFLOWS.includes(w), `${w}: templates`);
    if (Object.hasOwn(NAMES_AT_THE_MOVE, w)) {
      assert.equal(s.builds, ["implement", "implement-review", "quick-task"].includes(w), `${w}: builds`);
      assert.equal(s.phased, ["implement", "implement-review"].includes(w), `${w}: phased`);
    }
    const entry = SKILL_CATALOG.find((e) => e.workflow === w);
    if (!entry) {
      assert.equal(s.card, null, `${w}: no card`);
      continue;
    }
    assert.equal(entry.skill, s.skill, `${w}: skill`);
    assert.equal(entry.command, s.command, `${w}: card command`);
    for (const f of CARD_FIELDS) assert.equal(s.card[f], entry[f], `${w}: card.${f}`);
  }
  // Every pose in the page's list belongs to an entry.
  for (const pose of START_POSES) assert.ok(SKILLS.some((s) => s.pose === pose), `${pose} belongs to a skill`);
  for (const w of PROGRESS_WORKFLOWS) assert.ok(isPhased(w), `${w} counts its tasks`);
});

test("the entries are frozen data", () => {
  assert.ok(Object.isFrozen(SKILLS));
  for (const s of SKILLS) {
    assert.ok(Object.isFrozen(s), `${s.workflow} is frozen`);
    if (s.card) assert.ok(Object.isFrozen(s.card), `${s.workflow}.card is frozen`);
  }
});

test("the meter, resume and Help fields are well formed on every entry", () => {
  const label = (v) => v === null || (typeof v === "string" && v.trim() !== "");
  for (const s of SKILLS) {
    const w = s.workflow;
    assert.ok(Object.hasOwn(s, "weight") && (s.weight === null || (typeof s.weight === "number" && s.weight >= 0)), `${w}: weight is a number >= 0, or null`);
    assert.ok(Object.hasOwn(s, "started") && label(s.started), `${w}: started is a label, or null`);
    assert.ok(Object.hasOwn(s, "ran") && label(s.ran), `${w}: ran is a label, or null`);
    assert.ok(Object.hasOwn(s, "resume") && ["overview", "folder", null].includes(s.resume), `${w}: resume is "overview", "folder" or null`);
    if (s.card && Object.hasOwn(s.card, "help")) assert.ok(typeof s.card.help === "string" && s.card.help.trim(), `${w}: card.help is a line, or absent`);
    if (s.metered) assert.ok(typeof s.weight === "number" && s.started, `${w}: a metered launch has a weight and a started label`);
  }
});

test("WORKFLOWS lists every entry once, in order, and isWorkflow() knows only those", () => {
  assert.deepEqual(WORKFLOWS, SKILLS.map((s) => s.workflow));
  assert.equal(new Set(WORKFLOWS).size, WORKFLOWS.length);
  assert.ok(Object.isFrozen(WORKFLOWS));
  for (const w of WORKFLOWS) assert.equal(isWorkflow(w), true, w);
  for (const bad of ["x-ray", "", undefined, null, 3, "Plan"]) assert.equal(isWorkflow(bad), false, String(bad));
});

test("the lookups answer by workflow or skill name, and say nothing for an unknown one", () => {
  assert.equal(skillFor("implement-review").skill, "plan2code-3-implement-review");
  assert.equal(skillByName("plan2code-git").workflow, "git");
  assert.equal(skillByName("plan2code").workflow, "dashboard");
  assert.equal(labelFor("xray"), "X-ray");
  assert.equal(subagentsFor("review"), SUBAGENT_WORKFLOWS.review.instruction);
  for (const unknown of ["nope", undefined, null, "", "constructor", "__proto__"]) {
    assert.equal(skillFor(unknown), null);
    assert.equal(skillByName(unknown), null);
    assert.equal(labelFor(unknown), null);
    assert.equal(subagentsFor(unknown), null);
    for (const is of [isBuild, isPhased, isMetered, takesTemplates]) assert.equal(is(unknown), false);
  }
});

// Which workflows labels.js and help.js count as builds, as they stood when the
// sets moved onto skills.js: labels.js leaves Quick Task out, help.js keeps it.
test("the two build sets hold what they held before", () => {
  assert.deepEqual([...BUILD_WORKFLOWS].sort(), ["implement", "implement-review"]);
  assert.deepEqual(SKILLS.filter((s) => isBuild(s.workflow)).map((s) => s.workflow).sort(), ["implement", "implement-review", "quick-task"]);
  // help.js keeps its set private: Help opens on its Building tab for exactly these.
  const onBuild = SKILLS.map((s) => s.workflow).filter((workflow) => helpTabFor({ workflow }) === "build");
  assert.deepEqual(onBuild.sort(), ["implement", "implement-review", "quick-task"]);
  assert.equal(helpTabFor({ workflow: "nope" }), "about");
});

/* ------------------------------------------- tests that name what was missed */

// Each check below is a pure function of a skill list, so a test can hand it a
// copy with one thing wrong and see the message name the skill.

// Each skill's starting screen clones its pose from index.html. A pose with no
// drawing silently falls back to the flight, and a drawing no skill uses is
// dead markup.
function poseProblems(skills, drawn) {
  const problems = [];
  for (const s of skills) {
    if (s.card && !s.pose) problems.push(`${s.skill} has a card but no pose`);
    if (s.pose && !drawn.includes(s.pose)) problems.push(`${s.skill} names pose "${s.pose}", which index.html does not draw`);
  }
  for (const pose of drawn) {
    if (!skills.some((s) => s.pose === pose)) problems.push(`index.html draws pose "${pose}", which belongs to no skill`);
  }
  return problems;
}

// Every workflow the console can open has its notes behind `console.mjs help`.
function helpProblems(skills, topics) {
  return skills.filter((s) => !Object.hasOwn(topics, s.workflow)).map((s) => `${s.skill} (${s.workflow}) has no help topic in console.mjs`);
}

// The skills with a card, plus the dashboard, are exactly what install.js builds.
function installProblems(skills, installed) {
  const reviews = skills.map((s) => s.review).filter(Boolean);
  const named = skills.filter((s) => s.card || s.workflow === "dashboard" || reviews.includes(s.skill)).map((s) => s.skill);
  return [
    ...named.filter((n) => !installed.includes(n)).map((n) => `${n} is in skills.js but not in install.js SOURCE_PROMPTS`),
    ...installed.filter((n) => !named.includes(n)).map((n) => `${n} is in install.js SOURCE_PROMPTS but has no card in skills.js`),
  ];
}

const drawnPoses = () => [...poseTemplate().matchAll(/data-pose="([^"]+)"/g)].map((m) => m[1]);
const helpTopics = () => cli(["help", "topics"]).json.topics;

// install.js reads the home directory at load: point it at a temp one, as the
// install tests do. Requiring it never runs its CLI (that waits on require.main).
function installedSkills() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-skills-"));
  const saved = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  try {
    const { SOURCE_PROMPTS, generateSkillName } = createRequire(import.meta.url)(path.join(ROOT, "install.js"));
    return SOURCE_PROMPTS.map(generateSkillName);
  } finally {
    for (const [k, v] of Object.entries(saved)) v === undefined ? delete process.env[k] : (process.env[k] = v);
    fs.rmSync(home, { recursive: true, force: true });
  }
}

test("every skill's pose is drawn in the page, and every drawn pose belongs to a skill", () => {
  const drawn = drawnPoses();
  assert.deepEqual(poseProblems(SKILLS, drawn), []);
  assert.doesNotMatch(poseTemplate(), /\sstyle=/, "a style attribute would be refused by the CSP");
  // Variants borrow their pose; the dashboard keeps the flight.
  assert.equal(startPose("implement-review"), "implement");
  assert.equal(startPose("revise-plan"), "plan");
  assert.equal(startPose("init-update"), "init");
  assert.equal(startPose("dashboard"), null);
  assert.equal(startPose(undefined), null);

  const broken = SKILLS.map((s) => (s.workflow === "xray" ? { ...s, pose: "x-ray-glasses" } : s));
  assert.deepEqual(poseProblems(broken, drawn), [
    'plan2code-xray names pose "x-ray-glasses", which index.html does not draw',
    'index.html draws pose "xray", which belongs to no skill',
  ]);
  const poseless = SKILLS.map((s) => (s.workflow === "git" ? { ...s, pose: null } : s));
  assert.deepEqual(poseProblems(poseless, drawn), ["plan2code-git has a card but no pose", 'index.html draws pose "git", which belongs to no skill']);
});

test("every workflow in the skill list has a help topic", () => {
  const topics = helpTopics();
  assert.deepEqual(helpProblems(SKILLS, topics), []);
  const extra = [...SKILLS, { skill: "plan2code-made-up", workflow: "made-up" }];
  assert.deepEqual(helpProblems(extra, topics), ["plan2code-made-up (made-up) has no help topic in console.mjs"]);
});

test("the skill list and install.js agree on which skills exist", () => {
  const installed = installedSkills();
  assert.ok(installed.includes("plan2code"), "read SOURCE_PROMPTS");
  assert.deepEqual(installProblems(SKILLS, installed), []);
  const extra = [...SKILLS, { skill: "plan2code-made-up", workflow: "made-up", card: {} }];
  assert.deepEqual(installProblems(extra, installed), ["plan2code-made-up is in skills.js but not in install.js SOURCE_PROMPTS"]);
  assert.deepEqual(installProblems(SKILLS, [...installed, "plan2code-orphan"]), ["plan2code-orphan is in install.js SOURCE_PROMPTS but has no card in skills.js"]);
});

test("dashboard note: the agent's note shows only on the spec the picker opened on", () => {
  const a = { dir: "specs/a" };
  const b = { dir: "specs/b" };
  assert.equal(onInitialPick(a, a), true);
  assert.equal(onInitialPick(a, b), false);
  assert.equal(onInitialPick(a, null), false);
  assert.equal(onInitialPick(null, null), true, "no spec at all: scratch is the opening pick");
  assert.equal(onInitialPick(null, a), false);
});

test("dashboard note: the agent's note, the looking-over line and the neutral line", () => {
  const menu = { note: "Phase 2 is next." };
  assert.equal(dashNoteKind({ menu, hasMenu: true, onInitial: true, working: false }), "agent");
  assert.equal(dashNoteKind({ menu, hasMenu: true, onInitial: false, working: false }), "neutral", "another pick, another line");
  assert.equal(dashNoteKind({ menu: { note: "  " }, hasMenu: true, onInitial: true, working: true }), "neutral", "a blank note is no note");
  assert.equal(dashNoteKind({ menu: {}, hasMenu: false, onInitial: true, working: true }), "looking");
  assert.equal(dashNoteKind({ menu: {}, hasMenu: false, onInitial: true, working: false }), "neutral");
});

test("starting screen: the hint stays calm for ninety seconds, then points at the terminal", () => {
  assert.match(startingHint(0), /fills in by itself/);
  assert.match(startingHint(90000), /fills in by itself/, "ninety seconds is still calm");
  assert.match(startingHint(90001), /terminal has the play-by-play/);
});

/* ---------------------------------------------- the docs held to the list */

// What one prose list says against what it should say: the lines naming the
// missing and the extra names, empty when they agree.
function listProblems(file, said, want) {
  const have = new Set(said);
  const should = new Set(want);
  return [
    ...[...should].filter((n) => !have.has(n)).map((n) => `${file} is missing ${n}`),
    ...[...have].filter((n) => !should.has(n)).map((n) => `${file} names ${n}, which is not in skills.js`),
  ];
}

const readSrc = (...parts) => fs.readFileSync(path.join(ROOT, "src", ...parts), "utf8");

// A markdown section's text: from its heading to the next heading of the same level.
function sectionOf(text, heading) {
  const at = text.indexOf(heading);
  assert.ok(at >= 0, `no "${heading}" heading`);
  const level = heading.match(/^#+/)[0];
  const rest = text.slice(at + heading.length);
  const next = rest.search(new RegExp(`\\n${level} `));
  return next < 0 ? rest : rest.slice(0, next);
}

test("docs: console.md's open step names every workflow", () => {
  const text = readSrc("web-console", "console.md");
  const m = text.match(/where `<w>` is one of ([\s\S]*?)\. Get it right/);
  assert.ok(m, "console.md: the open step's `<w>` sentence is not where the test looks");
  const said = [...m[1].matchAll(/`([^`]+)`/g)].map((x) => x[1]);
  assert.deepEqual(listProblems("src/web-console/console.md", said, WORKFLOWS), []);
});

test("docs: the dashboard skill's launch table maps every skill to its workflow", () => {
  const section = sectionOf(readSrc("plan2code.md"), "## A pick arrives");
  const pairs = [];
  for (const line of section.split(/\r?\n/)) {
    if (!/^\|\s*plan2code-/.test(line)) continue;
    const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
    for (let i = 0; i + 1 < cells.length; i += 2) pairs.push(`${cells[i]} -> ${cells[i + 1]}`);
  }
  const want = SKILLS.filter((s) => s.workflow !== "dashboard").map((s) => `${s.skill} -> ${s.workflow}`);
  assert.deepEqual(listProblems("src/plan2code.md (A pick arrives)", pairs, want), []);
});

test("docs: the dashboard skill's reads-and-writes table has a row for every skill", () => {
  const section = sectionOf(readSrc("plan2code.md"), "## What each skill reads and writes");
  const said = [];
  for (const line of section.split(/\r?\n/)) {
    const m = line.match(/^\|\s*([a-z0-9()-]+)\s*\|/);
    if (!m || m[1] === "skill" || /^-+$/.test(m[1])) continue;
    // `3-implement(-review)` stands for both build skills.
    if (m[1] === "3-implement(-review)") said.push("3-implement", "3-implement-review");
    else said.push(m[1]);
  }
  const want = SKILLS.filter((s) => s.workflow !== "dashboard").map((s) => s.skill.replace(/^plan2code-/, ""));
  assert.deepEqual(listProblems("src/plan2code.md (What each skill reads and writes)", said, want), []);
});

test("docs: `console.mjs help` lists every workflow, in order", () => {
  const out = cli(["help"]).stdout;
  const m = out.match(/workflows: ([\s\S]*?)\n\s*\n/);
  assert.ok(m, "console.mjs help prints no workflows: list");
  const said = m[1].split(/[·\s]+/).filter(Boolean);
  assert.deepEqual(listProblems("console.mjs help", said, WORKFLOWS), []);
  assert.deepEqual(said, [...WORKFLOWS], "console.mjs help: the workflows are in skills.js order");
});

// A count goes stale the day a skill is added; the docs say "every skill".
// Matched over the whole file, since the docs are hard-wrapped and a count can
// sit on one line with "skills" on the next; the line is where the match starts.
const SKILL_COUNT_RE = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+skills\b/gi;
function skillCounts(files) {
  return files.flatMap(([file, text]) =>
    [...text.matchAll(SKILL_COUNT_RE)].map((m) => `${file}:${text.slice(0, m.index).split("\n").length} states a skill count: ${m[0].replace(/\s+/g, " ")}`)
  );
}

test("docs: no console doc states how many skills there are", () => {
  const dir = path.join(ROOT, "src", "web-console");
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".md")) files.push([path.relative(ROOT, p).replace(/\\/g, "/"), fs.readFileSync(p, "utf8")]);
    }
  };
  walk(dir);
  assert.ok(files.some(([f]) => f.endsWith("notes/implement.md")), "the walk reaches notes/");
  assert.deepEqual(skillCounts(files), []);
  // The check names the line, and catches a count wrapped across two lines.
  assert.deepEqual(skillCounts([["x.md", "Intro\nthe dashboard and all twelve skills behind it\n"]]), ["x.md:2 states a skill count: twelve skills"]);
  assert.deepEqual(skillCounts([["y.md", "Intro\nthe dashboard and all twelve\nskills behind it\n"]]), ["y.md:2 states a skill count: twelve skills"]);
});

test("Implement's card launches Implement + Review when Review is ticked", () => {
  const card = SKILL_CATALOG.find((e) => e.skill === "plan2code-3-implement");
  assert.equal(card.title, "Implement");
  assert.equal(SKILL_CATALOG.some((e) => e.skill === "plan2code-3-implement-review"), false, "no card of its own");
  assert.equal(launchVariant(card, false), card);
  const reviewed = launchVariant(card, true);
  assert.equal(reviewed.skill, "plan2code-3-implement-review");
  assert.equal(reviewed.workflow, "implement-review");
  assert.equal(reviewed.command, "/plan2code-3-implement-review");
  assert.equal(reviewed.spec, true, "still takes the picked spec");
  assert.equal(catalogEntry("plan2code-3-implement-review").skill, "plan2code-3-implement", "handoffs and recommendations resolve to the card");
  const quick = SKILL_CATALOG.find((e) => e.skill === "plan2code-quick-task");
  assert.equal(launchVariant(quick, true), quick, "a card with no Review box is unchanged");
});

test("helper-strength.md ships in the five skills that start helpers, and in no other", () => {
  // npm test has just built skills/; a direct run builds it so the check never reads a stale tree.
  if (process.env.npm_lifecycle_event !== "test") {
    execFileSync(process.execPath, [path.join(ROOT, "install.js"), "--build-skills"], { stdio: "ignore" });
  }
  const built = path.join(ROOT, "skills");
  const having = fs.readdirSync(built).filter((dir) => fs.existsSync(path.join(built, dir, "references", "helper-strength.md")));
  assert.deepEqual(having.sort(), [
    "plan2code-0-pathfinder",
    "plan2code-3-implement",
    "plan2code-3-implement-review",
    "plan2code-quick-task",
    "plan2code-review",
  ]);
});
