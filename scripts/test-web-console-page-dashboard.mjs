// Page tests for the dashboard: a spec in the picker, a card picked and
// started, the launch send the agent collects, and its `resume` turning the
// page into the launched skill's starting screen. Run with:
// node --test scripts/test-web-console-page-dashboard.mjs
//
// Each test drives the real console in a real Chrome or Edge through
// scripts/page-test-helpers.mjs: one browser for the file, a fresh console
// session per test.

import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { pageSuite, openSession, tempProject, textOf } from "./page-test-helpers.mjs";
import { cli, until, CONSOLE_CLI, HOME } from "./web-console-test-helpers.mjs";

const suite = pageSuite(test);

// A project that is set up (AGENTS.md) with one spec holding a Plan draft.
// A PLAN-DRAFT whose Status line says only "Draft" (no "Resume at Phase N")
// scans as `planned`, which the picker labels "Ready to document". Plan is
// still lit for it (only exploring, fixed and documented-or-later grey Plan
// out); Document is the state's own next step.
const DRAFT_PROJECT = {
  "AGENTS.md": "# AGENTS.md\n\nA small demo project.\n",
  "specs/demo/PLAN-DRAFT-20261017.md": "# Plan draft: demo\n\n**Status:** Draft\n\nA lunch vote for the team.\n",
};

// What a real agent posts on the dashboard (plan2code.md, "The menu"): its
// judgment on top of the scan, then it waits.
const MENU = {
  menu: {
    note: "One spec on disk, with a plan drafted.",
    recommend: "plan2code-2-document",
    details: { "plan2code-2-document": "Plan drafted" },
  },
  agent: { status: "waiting" },
};

// The one send `wait` hands the agent; fails the test when nothing arrived.
function collect(s) {
  const got = s.wait(10);
  assert.equal(got.code, 0, `nothing was sent (wait exit ${got.code}): ${got.message || ""}`);
  return got;
}

test("a Plan launch from the dashboard carries the picked spec, and its resume turns the page to Starting Plan", async (t) => {
  const project = tempProject(DRAFT_PROJECT);
  const s = await openSession(await suite.browser(), { t, workflow: "dashboard", payload: MENU, project });
  const main = await toTheMenu(s);

  // The picker shows the spec with its state, and opens on it.
  const chip = main.getByRole("button").filter({ hasText: /^demo/ });
  await chip.waitFor();
  // The state is drawn in capitals, so the match ignores case.
  const chipText = await textOf(chip);
  assert.match(chipText, /Ready to document/i, "the spec chip names its state");
  assert.match(chipText, /plan drafted/, "the spec chip says how far it got");
  assert.equal(await chip.getAttribute("aria-current"), "true", "the picker opens on the only spec");

  // The Plan card is lit for this spec; picking it asks to confirm.
  const planCard = main.getByRole("button").filter({ has: s.page.locator("code", { hasText: /^\/plan2code-1-plan$/ }) });
  assert.equal(await planCard.isEnabled(), true, "the Plan card is greyed for a drafted plan");
  await planCard.click();
  await main.getByRole("button", { name: "Start Plan" }).click();

  const got = collect(s);
  assert.equal(got.type, "submit");
  const launch = got.actions.find((a) => a.i === "__launch");
  assert.ok(launch, `the send carries a launch: ${JSON.stringify(got.actions)}`);
  assert.deepEqual(
    { i: launch.i, skill: launch.skill, workflow: launch.workflow, spec: launch.spec },
    { i: "__launch", skill: "plan2code-1-plan", workflow: "plan", spec: "specs/demo" }
  );

  // `resume` is the one command to run, naming the session, workflow and spec.
  const head = `node "${CONSOLE_CLI}" `;
  assert.ok(got.resume.startsWith(head), `resume runs this console: ${got.resume}`);
  const args = got.resume.slice(head.length).split(" ");
  assert.deepEqual(args, ["open", "--resume", s.sid, "--no-open", "--workflow", "plan", "--spec", "specs/demo"]);

  // `skillFile` is offered only when the skill's SKILL.md sits beside the
  // console's own folder, as in an install. Run from this repo's source tree
  // (src/web-console/), that is a plan2code-1-plan/ folder next to the repo,
  // which does not exist, so the send leaves it out (console-launches.md:
  // "absent outside an install").
  assert.equal("skillFile" in got, false, `a source-tree launch names no skillFile: ${got.skillFile}`);

  // The agent runs `resume` first: the page leaves the menu for Plan's
  // starting screen while the skill is read.
  const r = cli(args, { cwd: s.project });
  assert.equal(r.status, 0, `resume failed: ${r.stderr}`);
  await main.getByRole("heading", { name: "Starting Plan" }).waitFor();
});

// A project holding one fixed bug (a diagnosis Quick Task marked Fixed) and
// one drafted plan. The fixed bug is touched last, so it is the newest spec on
// disk: the picker must still open on the plan, since a finished spec is never
// the default.
function fixedProject() {
  const project = tempProject({
    ...DRAFT_PROJECT,
    "specs/old-bug/DIAGNOSIS-20261017.md": "# Diagnosis: old bug\n\n**Status:** Fixed\n\nThe save button lost its handler.\n",
  });
  const later = new Date(Date.now() + 60_000);
  fs.utimesSync(path.join(project, "specs/old-bug/DIAGNOSIS-20261017.md"), later, later);
  return project;
}

// Past Planny's wake-up and, on this console home's first run, the Welcome,
// to the menu.
async function toTheMenu(s) {
  const skip = s.page.getByRole("button", { name: "Skip the intro" });
  await skip.click();
  await skip.waitFor({ state: "hidden" });
  const main = s.page.locator("#main");
  const heading = main.getByRole("heading", { name: "What are we doing today?" });
  await heading.waitFor();
  const welcomeDone = s.page.getByRole("button", { name: "Start building" });
  if (await welcomeDone.isVisible()) {
    await welcomeDone.click();
    await welcomeDone.waitFor({ state: "hidden" });
  }
  return main;
}

// Sets the picker's "Hide unavailable workflows" switch. Looks are kept per
// console home, so each test sets the one it needs rather than trusting the
// default.
async function hideUnavailable(main, on) {
  const box = main.getByRole("switch", { name: "Hide unavailable workflows" });
  if ((await box.isChecked()) !== on) await main.getByText("Hide unavailable workflows").click();
  assert.equal(await box.isChecked(), on);
}

const chipFor = (main, name) => main.getByRole("button").filter({ hasText: new RegExp(`^${name}`) });

test("a fixed bug is hidden while unavailable workflows are, dimmed when they show, and never the picker's default", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "dashboard", payload: MENU, project: fixedProject() });
  const main = await toTheMenu(s);

  // Hidden while the switch is on.
  await hideUnavailable(main, true);
  const demo = chipFor(main, "demo");
  await demo.waitFor();
  assert.equal(await demo.getAttribute("aria-current"), "true", "the picker opens on the plan, not the newer fixed bug");
  assert.equal(await chipFor(main, "old-bug").count(), 0, "the fixed bug's chip is hidden while unavailable workflows are");

  // Switched off: the chip shows, labelled and dimmed, and still not picked.
  await hideUnavailable(main, false);
  const bug = chipFor(main, "old-bug");
  await bug.waitFor();
  assert.match(await textOf(bug), /Bug fixed/i, "the chip names its state");
  assert.doesNotMatch(await textOf(bug), /bug fixed\s+bug fixed/i, "the scan's detail does not repeat the label");
  assert.equal(await bug.getAttribute("aria-current"), "false", "the fixed bug is not picked");
  const opacity = await bug.evaluate((b) => Number(getComputedStyle(b).opacity));
  assert.ok(opacity < 1, `the fixed bug's chip is dimmed (opacity ${opacity})`);
  assert.equal(await demo.getAttribute("aria-current"), "true", "the plan stays picked");
});

test("a fixed bug's Delete asks once with no name to type, while any other spec asks for its name", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "dashboard", payload: MENU, project: fixedProject() });
  const main = await toTheMenu(s);
  await hideUnavailable(main, false);
  await chipFor(main, "old-bug").waitFor();

  const dialog = s.page.locator("#delete-modal");
  const go = s.page.locator("#delete-go");
  const nameStep = s.page.locator("#delete-confirm");

  // Any other spec: the first press only reveals the name step.
  await main.getByRole("button", { name: "Delete the spec demo" }).click({ force: true });
  await dialog.waitFor();
  assert.equal(await textOf(go), "Delete this spec…");
  await go.click();
  await nameStep.waitFor();
  assert.equal(await go.isDisabled(), true, "the final button waits for the name");
  await s.page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });

  // The fixed bug: a visible Delete, its own warning, and one press sends it.
  const del = main.getByRole("button", { name: "Delete the spec old-bug" });
  assert.equal(await textOf(del), "Delete", "a fixed bug's Delete is a labelled button");
  await del.click({ force: true });
  await dialog.waitFor();
  assert.match(await textOf(s.page.locator("#delete-warn")), /The bug is fixed, so this only clears the write-up/);
  assert.equal(await textOf(go), "Delete it");
  assert.equal(await nameStep.isHidden(), true, "no name step for a fixed bug");
  await go.click();

  const got = collect(s);
  assert.equal(await nameStep.isHidden(), true, "the name step never showed");
  const action = got.actions.find((a) => a.i === "__delete");
  assert.deepEqual({ type: action?.type, spec: action?.spec }, { type: "delete", spec: "specs/old-bug" });
});

// ---------------------------------------------------------------------------
// The picker's switching, the first-open wake-up, handoffs, the update banner,
// the workspace scope, and the pose that carries a launch into the work.

const lightOf = (main, command) => main.getByRole("button").filter({ has: main.page().locator("code", { hasText: new RegExp(`^${command}$`) }) });
const pickedChip = (main, name) => main.locator('button[aria-current="true"]', { hasText: new RegExp(`^${name}`) });

// What a person would see break: picking another target leaves the launch
// aimed at the old spec, or the cards lit for it.
test("picking Start from scratch instead of a spec greys Document, and a launch then carries no spec", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "dashboard", payload: MENU, project: tempProject(DRAFT_PROJECT) });
  const main = await toTheMenu(s);
  const document = lightOf(main, "/plan2code-2-document");
  await pickedChip(main, "demo").waitFor();
  assert.equal(await document.isEnabled(), true, "Document is lit for the drafted spec");

  // From scratch there is no draft to document: the card greys.
  await chipFor(main, "Start from scratch").click();
  await pickedChip(main, "Start from scratch").waitFor();
  assert.equal(await document.isDisabled(), true, "Document is greyed with no spec picked");
  assert.equal(await chipFor(main, "demo").getAttribute("aria-current"), "false");

  // Back on the spec it is lit again; then from scratch once more to launch.
  await chipFor(main, "demo").click();
  await pickedChip(main, "demo").waitFor();
  assert.equal(await document.isEnabled(), true, "Document is lit again for the spec");
  await chipFor(main, "Start from scratch").click();
  await pickedChip(main, "Start from scratch").waitFor();
  await lightOf(main, "/plan2code-1-plan").click();
  await main.getByRole("button", { name: "Start Plan" }).click();
  const launch = collect(s).actions.find((a) => a.i === "__launch");
  assert.equal(launch.skill, "plan2code-1-plan");
  assert.ok(!launch.spec, `a launch from scratch names no spec: ${JSON.stringify(launch)}`);
});

// What a person would see break: the intro cannot be skipped, or it replays
// on every reload of the same tab.
test("Skip the intro ends the first-open wake-up at once, and a reload of the tab does not play it again", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "dashboard", payload: MENU, project: tempProject(DRAFT_PROJECT) });
  const skip = s.page.getByRole("button", { name: "Skip the intro" });
  await skip.waitFor();
  await toTheMenu(s);
  assert.equal(await skip.isVisible(), false);

  await s.page.reload({ waitUntil: "domcontentloaded" });
  await s.page.locator("#main").getByRole("heading", { name: "What are we doing today?" }).waitFor();
  assert.equal(await skip.isVisible(), false, "the intro does not play again in this tab");
});

// A project with no spec, only a handoff written for it (the Handoff skill's
// file pair under the test's own handoffs folder), removed with the test.
const HANDOFF_DOC = "# Handoff: Lunch vote\n\n## Next task\n\nWire the vote button to the tally.\n\n## Notes\n\nA long body line.\n";
function handoffProject(t) {
  const project = tempProject({ "AGENTS.md": "# AGENTS.md\n\nA small demo project.\n" });
  const made = cli(["handoff", "new", "--workflow", "quick-task", "--skill", "plan2code-quick-task", "--title", "Lunch vote"], { cwd: project }).json;
  fs.writeFileSync(made.path, HANDOFF_DOC);
  t.after(() => {
    fs.rmSync(made.path, { force: true });
    fs.rmSync(made.path.replace(/\.md$/, ".json"), { force: true });
  });
  return { project, made };
}

async function openHandoffMenu(t, env) {
  const { project, made } = handoffProject(t);
  const s = await openSession(await suite.browser(), { t, workflow: "dashboard", payload: MENU, project, env });
  const main = await toTheMenu(s);
  const chip = chipFor(main, "Lunch vote");
  await chip.waitFor();
  return { s, main, chip, made };
}

// What a person would see break: a handoff is not offered when it is all the
// project has, or picking it still shows the skill cards beside the preview.
test("a handoff shows as a dashed Handoff chip even with no spec, and picking it swaps the cards for a preview of four buttons", async (t) => {
  const { main, chip } = await openHandoffMenu(t);
  assert.match(await textOf(chip), /Handoff/i, "the chip is labelled Handoff");
  assert.equal(await chip.getAttribute("aria-current"), "false", "a handoff is offered, not picked for you");
  assert.equal(await chip.evaluate((b) => getComputedStyle(b).borderTopStyle), "dashed", "the chip's border is dashed");
  assert.ok(await lightOf(main, "/plan2code-1-plan").isVisible(), "the cards show before a handoff is picked");

  await chip.click();
  assert.equal(await chip.getAttribute("aria-current"), "true");
  await main.getByRole("heading", { name: "Lunch vote" }).waitFor();
  assert.match(await textOf(main), /Wire the vote button to the tally\./, "the preview quotes the Next task");
  for (const name of ["Pick it up here", "Read it all", "Copy for a new conversation", "Delete"]) {
    assert.equal(await main.getByRole("button", { name, exact: true }).count(), 1, `the preview has ${name}`);
  }
  assert.equal(await lightOf(main, "/plan2code-1-plan").count(), 0, "the skill cards give way to the preview");
  assert.equal(await main.getByRole("switch", { name: "Hide unavailable workflows" }).count(), 0, "and so does their toggle");
});

// What a person would see break: Pick it up here sends nothing, or sends more
// than the handoff's id.
test("Pick it up here sends a pickup naming the handoff, and the page turns to its launch screen", async (t) => {
  const { s, main, chip, made } = await openHandoffMenu(t);
  await chip.click();
  await main.getByRole("button", { name: "Pick it up here" }).click();
  const got = collect(s);
  const pick = got.actions.find((a) => a.i === "__pickup");
  assert.deepEqual({ type: pick?.type, handoff: pick?.handoff }, { type: "pickup", handoff: made.id });
  assert.match(got.resume, /--workflow quick-task$/, "the CLI read the handoff's own workflow");
  await main.getByRole("heading", { name: "Waking up Lunch vote" }).waitFor();
});

// What a person would see break: Read it all opens nothing, or Copy puts the
// wrong words on the clipboard.
test("Read it all opens the handoff's text, and Copy puts a prompt naming its file on the clipboard", async (t) => {
  const { s, main, chip, made } = await openHandoffMenu(t);
  await s.context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(s.url).origin });
  await chip.click();

  await main.getByRole("button", { name: "Read it all" }).click();
  const reader = s.page.locator("#handoff-modal");
  await reader.getByText("A long body line.").waitFor();
  await s.page.keyboard.press("Escape");
  await reader.waitFor({ state: "hidden" });

  const copy = main.getByRole("button", { name: "Copy for a new conversation" });
  await copy.click();
  await main.getByRole("button", { name: "Copied" }).waitFor();
  const text = await s.page.evaluate(() => navigator.clipboard.readText());
  assert.match(text, /^Read the handoff at .*\.md and carry on with its Next task\.$/);
  assert.ok(text.includes(made.id), `the prompt names the handoff's file: ${text}`);
});

// Under the app, "a new conversation" is this console's own wording for what
// New Session does, so the handoff's copy button says "another session"
// instead, still naming the same clipboard prompt.
test("under the app, a handoff's copy button says Copy for another session, and still works", async (t) => {
  const { s, main, chip } = await openHandoffMenu(t, { PLAN2CODE_IN_APP: "1" });
  await s.context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(s.url).origin });
  await chip.click();
  assert.equal(await main.getByRole("button", { name: "Copy for a new conversation" }).count(), 0, "no classic-mode wording under the app");
  const copy = main.getByRole("button", { name: "Copy for another session" });
  await copy.click();
  await main.getByRole("button", { name: "Copied" }).waitFor();
  await copy.waitFor();
});

// What a person would see break: Delete asks for a name, or sends a spec
// delete instead of the handoff's.
test("a handoff's Delete asks once in its own dialog and sends a delete naming the handoff", async (t) => {
  const { s, main, chip, made } = await openHandoffMenu(t);
  await chip.click();
  await main.getByRole("button", { name: "Delete", exact: true }).click();
  const dialog = s.page.locator("#delete-modal");
  await dialog.waitFor();
  assert.equal(await textOf(s.page.locator("#delete-title")), "Delete this handoff?");
  assert.equal(await s.page.locator("#delete-warn-handoff").isVisible(), true, "the warning says where handoffs live");
  assert.equal(await s.page.locator("#delete-confirm").isHidden(), true, "no name to type");
  await s.page.locator("#delete-go").click();
  const action = collect(s).actions.find((a) => a.i === "__delete");
  assert.deepEqual({ type: action?.type, handoff: action?.handoff, spec: action?.spec }, { type: "delete", handoff: made.id, spec: undefined });
});

// A newer release on record, so a console that boots now has an update to
// announce (the check reads this file for an hour instead of asking the
// network). The file is put back as the suite had it.
function aNewerReleaseExists(t) {
  const file = path.join(HOME, "update-check.json");
  const before = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, JSON.stringify({ checkedAt: Date.now(), latest: "99.0.0" }));
  t.after(() => fs.writeFileSync(file, before));
}

// What a person would see break: the banner shows on a build's page, or the
// dashboard never offers it.
test("the update banner shows on the dashboard only, and its dismiss hides it", async (t) => {
  aNewerReleaseExists(t);
  const browser = await suite.browser();
  const build = await openSession(browser, { t, workflow: "implement", payload: { agent: { status: "working", activity: "Task 1 of 1" } } });
  const dash = await openSession(browser, { t, workflow: "dashboard", payload: MENU, project: tempProject(DRAFT_PROJECT) });
  const main = await toTheMenu(dash);
  const banner = main.getByRole("button", { name: /UPDATE AVAILABLE · v99\.0\.0/ });
  await banner.waitFor();
  // The build's server booted under the same record; a later frame has landed
  // on its page by the time this text shows, and it still has no banner.
  build.post({ agent: { status: "working", activity: "Task 1 of 1, one more look" } });
  await build.page.getByText("Task 1 of 1, one more look").first().waitFor();
  assert.equal(await build.page.getByText("UPDATE AVAILABLE").count(), 0, "a build's page has no banner");

  await main.getByRole("button", { name: "Dismiss until next time" }).click();
  await banner.waitFor({ state: "hidden" });
});

// Under the desktop app (PLAN2CODE_IN_APP=1) the app's own top bar already
// nags about a skills/app mismatch and updates in one click, so this banner
// (a copy-pasted shell command) must never show there, newer release or not.
test("under the app, the update banner never shows", async (t) => {
  aNewerReleaseExists(t);
  const dash = await openSession(await suite.browser(), {
    t,
    workflow: "dashboard",
    payload: MENU,
    project: tempProject(DRAFT_PROJECT),
    env: { PLAN2CODE_IN_APP: "1" },
  });
  const main = await toTheMenu(dash);
  await main.getByText("One spec on disk, with a plan drafted.").waitFor();
  assert.equal(await main.getByText("UPDATE AVAILABLE").count(), 0, "no banner under the app");
});

// Same reasoning for the dashboard's own red-meter banner: under the app it
// must point at New Session, never at starting a new console session.
test("under the app, the dashboard's red-meter banner points at New Session", async (t) => {
  const dash = await openSession(await suite.browser(), {
    t,
    workflow: "dashboard",
    payload: MENU,
    project: tempProject(DRAFT_PROJECT),
    env: { PLAN2CODE_IN_APP: "1" },
  });
  const main = await toTheMenu(dash);
  dash.post({ run: { event: "implement-phase", id: "phase-1", tasks: 30 } });
  await main.getByText("Press New Session at the top of the window to start the agent fresh.").waitFor();
  assert.equal(await main.getByText("Starting a new console session").count(), 0, "no classic-mode wording under the app");
});

// What a person would see break: two dashboard tabs of one session, on
// different picks, keep taking the workspace's folders back from each other.
test("two dashboard tabs on different picks leave the workspace scope with the last pick and ask for it no more", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "dashboard", payload: MENU, project: tempProject(DRAFT_PROJECT) });
  const mainA = await toTheMenu(s);
  const second = await s.context.newPage();
  second.on("pageerror", (e) => s.errors.push(e.message));
  await second.goto(s.url, { waitUntil: "domcontentloaded" });
  const mainB = await toTheMenu({ page: second });
  const asks = { a: 0, b: 0 };
  s.page.on("request", (r) => r.method() === "POST" && r.url().endsWith("/workspace/scope") && asks.a++);
  second.on("request", (r) => r.method() === "POST" && r.url().endsWith("/workspace/scope") && asks.b++);
  const scopeOf = () => s.page.evaluate(async () => (await (await fetch("/workspace?check=1", { cache: "no-store" })).json()).scope || "");
  assert.equal(await scopeOf(), "specs/demo", "both tabs opened on the spec");

  // The second tab moves to Start from scratch: its folders become the project's own.
  await chipFor(mainB, "Start from scratch").click();
  await pickedChip(mainB, "Start from scratch").waitFor();
  assert.ok(await until(async () => (await scopeOf()) === ""), "the scope followed the second tab");

  // The first tab keeps its pick and takes a frame from the agent after the change.
  s.post({ menu: { ...MENU.menu, note: "A second look from the agent." } });
  await mainA.getByText("A second look from the agent.").waitFor();
  assert.equal(await pickedChip(mainA, "demo").count(), 1, "the first tab still has its own pick");
  assert.equal(asks.a, 0, "the tab that did not move never asked for its own scope back");
  assert.equal(asks.b, 1, "the tab that moved asked once");
  assert.equal(await scopeOf(), "", "the scope stays with the last pick");
});

// What a person would see break: Planny is rebuilt on every screen change, so
// his animation restarts as the launch becomes the work.
test("the pose pane a launch shows is the very element the starting and waiting screens keep, and the waiting pane shows the agent's activity", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "dashboard", payload: MENU, project: tempProject(DRAFT_PROJECT) });
  const main = await toTheMenu(s);
  await lightOf(main, "/plan2code-1-plan").click();
  await main.getByRole("button", { name: "Start Plan" }).click();

  // The launching screen, with its pose; mark that exact element.
  const pane = s.page.locator("#main > [data-pose]");
  await pane.waitFor();
  const pose = await pane.getAttribute("data-pose");
  await pane.evaluate((el) => (el.__sameElement = true));

  // The agent resumes the session as Plan: the starting screen reuses the pane.
  const got = collect(s);
  const args = got.resume.slice(`node "${CONSOLE_CLI}" `.length).split(" ");
  assert.equal(cli(args, { cwd: s.project }).status, 0);
  await main.getByRole("heading", { name: "Starting Plan" }).waitFor();
  assert.equal(await pane.getAttribute("data-pose"), pose, "the same pose carries into the starting screen");
  assert.equal(await pane.evaluate((el) => el.__sameElement === true && el.isConnected), true, "the pane was kept, not rebuilt");

  // The agent starts work and says what it is doing: the waiting screen shows it,
  // still in the same pane.
  s.post({ agent: { status: "working", activity: "Reading the plan draft" } });
  await main.getByText("Reading the plan draft").waitFor();
  assert.equal(await pane.evaluate((el) => el.__sameElement === true && el.isConnected), true, "the pane survives into the waiting screen");
  s.post({ agent: { status: "working", activity: "Writing the first questions" } });
  await main.getByText("Writing the first questions").waitFor();
  assert.equal(await pane.evaluate((el) => el.__sameElement === true && el.isConnected), true, "and survives each state frame after it");
});

// What a person would see break: a quick-task build points at a Plan tab that
// does not open, or another skill's page gains a pointer it has no list for.
test("a quick-task build's waiting pane points at its Plan tab, and a plan session with the same tab gets no pointer", async (t) => {
  const plan = { id: "plan", title: "Plan", blocks: [{ id: "steps", state: "settled", md: "## Steps\n\n- [ ] **1.** Wire the vote button" }] };
  const working = { agent: { status: "working", activity: "Step 1 of 1" } };
  const s = await openSession(await suite.browser(), { t, workflow: "quick-task", payload: { docs: [plan], ...working } });
  const pane = s.page.locator("#main > .waiting-pane");
  await pane.waitFor();
  const jump = pane.getByRole("button", { name: "Plan", exact: true });
  await jump.waitFor();
  await jump.click();
  await s.page.locator("#main").getByText("Wire the vote button").waitFor();

  const other = await openSession(await suite.browser(), { t, workflow: "plan", payload: { docs: [plan], ...working } });
  const otherPane = other.page.locator("#main > .waiting-pane");
  await otherPane.waitFor();
  assert.equal(await otherPane.getByRole("button", { name: "Plan", exact: true }).count(), 0, "a plan session has no live task list to point at");
});
