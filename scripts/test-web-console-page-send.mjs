// Page tests for starting a skill with a Notebook tab: the dashboard's confirm
// pane picks a tab, Start launches, the launched skill's `fill: "note"` box
// arrives filled with the tab's text and ticked pictures, and only the Send
// of that box reaches the agent and marks the tab sent. Run with:
// node --test scripts/test-web-console-page-send.mjs
//
// Each test drives the real console in a real Chrome or Edge through
// scripts/page-test-helpers.mjs: one browser for the file, a fresh console
// session per test.

import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { pageSuite, openSession, tempProject, drawn, sendAndCollect, itemCard } from "./page-test-helpers.mjs";
import { cli, until, CONSOLE_CLI } from "./web-console-test-helpers.mjs";
import { addImage, createTab, deleteTab, listTabs, readNotepad, removeImage, saveNote } from "../src/web-console/notepads.mjs";

const suite = pageSuite(test);

// Set up (AGENTS.md), with one documented spec for Revise plan to target.
const PROJECT = {
  "AGENTS.md": "# AGENTS.md\n\nA small demo project.\n",
  "specs/ready/overview.md": "# Overview\n\n## Phase Checklist\n\n- [ ] Phase 1: One\n",
  "specs/ready/phase-1.md": "# Phase 1\n\n- [ ] **Task 1.1:** One\n",
};

const MENU = { menu: { note: "Ready when you are." }, agent: { status: "waiting" } };

// Words no screen or file holds unless the tab put them there.
const MARKER = "Lunch vote by emoji, idea 7Q2X";
const TEXT = `# Lunch vote\n\n${MARKER}.\n`;

// A real JPEG drawn in the page, one color per call: the box re-encodes each
// picture the way a pasted one is, so a stub that only looks like a JPEG
// would never attach.
const jpeg = async (s, color) =>
  Buffer.from(
    await s.page.evaluate(async (fill) => {
      const c = document.createElement("canvas");
      c.width = 160;
      c.height = 100;
      const ctx = c.getContext("2d");
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, 160, 100);
      const blob = await new Promise((resolve) => c.toBlob(resolve, "image/jpeg"));
      let bin = "";
      for (const b of new Uint8Array(await blob.arrayBuffer())) bin += String.fromCharCode(b);
      return btoa(bin);
    }, color),
    "base64"
  );

// A Notebook tab named `name` holding `text` and `pictures` real pictures.
async function noteTab(s, name, text, pictures) {
  const id = createTab(s.project, name).id;
  if (text) saveNote(s.project, id, text);
  for (let i = 0; i < pictures; i++) addImage(s.project, id, await jpeg(s, `hsl(${i * 40}, 60%, 50%)`));
  return id;
}

// Past Planny's wake-up and, on this console home's first run, the Welcome,
// to the menu.
async function toTheMenu(s) {
  const skip = s.page.getByRole("button", { name: "Skip the intro" });
  await skip.click();
  await skip.waitFor({ state: "hidden" });
  const main = s.page.locator("#main");
  await main.getByRole("heading", { name: "What are we doing today?" }).waitFor();
  const welcomeDone = s.page.getByRole("button", { name: "Start building" });
  if (await welcomeDone.isVisible()) {
    await welcomeDone.click();
    await welcomeDone.waitFor({ state: "hidden" });
  }
  return main;
}

const chipFor = (main, name) => main.getByRole("button").filter({ hasText: new RegExp(`^${name}`) });
const pickedChip = (main, name) => main.locator('button[aria-current="true"]', { hasText: new RegExp(`^${name}`) });
const lightOf = (main, command) => main.getByRole("button").filter({ has: main.page().locator("code", { hasText: new RegExp(`^${command}$`) }) });

// Every file under the session folder that holds `words`.
function filesHolding(dir, words) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    const file = path.join(entry.parentPath ?? entry.path, entry.name);
    if (fs.readFileSync(file).includes(words)) found.push(path.relative(dir, file));
  }
  return found;
}

const sentOf = (project, tab) => (listTabs(project).tabs.find((t) => t.id === tab) || {}).sent || null;

// From the menu: picks `chip`, opens `command`'s card, switches the Notebook
// on, picks `tabName` and presses Start; then collects the launch and runs its
// resume, as the dashboard agent does. Returns the launch send.
async function startWith(s, main, { chip, command, tabName }) {
  await chipFor(main, chip).click();
  await pickedChip(main, chip).waitFor();
  await lightOf(main, command).click();
  await main.getByRole("checkbox", { name: "Start with a note from your Notebook" }).check();
  const tab = main.locator(".confirm-note-tab", { has: s.page.locator(".confirm-note-tab-name", { hasText: new RegExp(`^${tabName}$`) }) });
  await tab.click();
  await main.locator(".confirm-cmd-note", { hasText: `+ note: ${tabName}` }).waitFor();
  await main.locator(".confirm-actions .btn.primary").click();
  const got = s.wait(10);
  assert.equal(got.code, 0, `nothing was sent (wait exit ${got.code}): ${got.message || ""}`);
  const head = `node "${CONSOLE_CLI}" `;
  assert.ok(got.resume.startsWith(head), `resume runs this console: ${got.resume}`);
  const r = cli(got.resume.slice(head.length).split(" "), { cwd: s.project });
  assert.equal(r.status, 0, `resume failed: ${r.stderr}`);
  return got;
}

// The launched skill's first card: the box the page fills.
const BOX = { items: [{ id: "idea", kind: "text", title: "What should change", body: "Say it in your own words.", fill: "note" }] };

const boxOf = (s) => s.page.locator("#text-idea");
const readyPictures = (s) => itemCard(s.page, "idea").locator(".attach-thumb.is-ready");

const CASES = [
  { workflow: "pathfinder", chip: "Start from scratch", command: "/plan2code-0-pathfinder" },
  { workflow: "plan", chip: "Start from scratch", command: "/plan2code-1-plan" },
  { workflow: "quick-task", chip: "Start from scratch", command: "/plan2code-quick-task" },
  { workflow: "revise-plan", chip: "ready", command: "/plan2code-1b-revise-plan", spec: "specs/ready" },
];

for (const c of CASES) {
  test(`${c.workflow}: the box arrives with the tab's text and five pictures, the agent reads it only on Send, and only then is the tab marked sent`, async (t) => {
    const s = await openSession(await suite.browser(), { t, workflow: "dashboard", payload: MENU, project: tempProject(PROJECT) });
    const tab = await noteTab(s, "Idea", TEXT, 7);
    const main = await toTheMenu(s);
    const launch = await startWith(s, main, { chip: c.chip, command: c.command, tabName: "Idea" });

    // Nothing of the tab rides the launch, and nothing of it is in the session.
    assert.ok(!JSON.stringify(launch).includes(MARKER), "the launch send carries no tab text");
    assert.deepEqual(filesHolding(s.session, MARKER), [], "no session file holds the tab's text after Start");
    assert.equal(sentOf(s.project, tab), null, "Start alone marks nothing");

    s.post(BOX);
    await until(async () => (await boxOf(s).inputValue()) === TEXT, 10000);
    await until(async () => (await readyPictures(s).count()) === 5, 15000);
    assert.equal(await boxOf(s).isEditable(), true, "the filled box stays editable");

    // Still nothing for the agent before Send.
    const result = path.join(s.session, "result.json");
    assert.ok(!fs.existsSync(result) || !fs.readFileSync(result, "utf8").includes(MARKER), "result.json holds no tab text before Send");
    assert.equal(s.wait(1).code, 10, "the agent has nothing to collect before Send");
    assert.equal(sentOf(s.project, tab), null);

    const got = await sendAndCollect(s);
    assert.ok(got.reply.includes(MARKER), `the send carries the box: ${got.reply}`);
    const note = got.actions.find((a) => a.i === "idea" && a.type === "comment");
    assert.equal(note && note.images.length, 5, "the five pictures go with it");
    await until(() => sentOf(s.project, tab) !== null, 5000);
    const sent = sentOf(s.project, tab);
    assert.equal(sent.workflow, c.workflow);
    assert.equal(sent.spec, c.spec);
  });
}

test("a pictures-only tab arrives as an empty box with its pictures, and its Send marks the tab sent", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "dashboard", payload: MENU, project: tempProject(PROJECT) });
  const tab = await noteTab(s, "Shots", "", 2);
  const main = await toTheMenu(s);
  await startWith(s, main, { chip: "Start from scratch", command: "/plan2code-1-plan", tabName: "Shots" });
  s.post(BOX);
  await until(async () => (await readyPictures(s).count()) === 2, 15000);
  assert.equal(await boxOf(s).inputValue(), "");
  const got = await sendAndCollect(s);
  const note = got.actions.find((a) => a.i === "idea" && a.type === "comment");
  assert.equal(note && note.images.length, 2, "the pictures go on their own");
  await until(() => sentOf(s.project, tab) !== null, 5000);
  assert.equal(sentOf(s.project, tab).workflow, "plan");
});

test("a picture deleted between Start and the box is skipped, and the rest still attach", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "dashboard", payload: MENU, project: tempProject(PROJECT) });
  const tab = await noteTab(s, "Idea", TEXT, 3);
  const main = await toTheMenu(s);
  await startWith(s, main, { chip: "Start from scratch", command: "/plan2code-1-plan", tabName: "Idea" });
  const first = readNotepad(s.project, tab).images[0].id;
  removeImage(s.project, tab, first);
  s.post(BOX);
  await until(async () => (await boxOf(s).inputValue()) === TEXT, 10000);
  await until(async () => (await readyPictures(s).count()) === 2, 15000);
  assert.equal(await itemCard(s.page, "idea").locator(".attach-thumb").count(), 2, "no failed or empty slot for the missing one");
});

test("Back to the dashboard after the box fills takes the box with it, as its dialog says, and marks the tab sent", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "dashboard", payload: MENU, project: tempProject(PROJECT) });
  const tab = await noteTab(s, "Idea", TEXT, 0);
  const main = await toTheMenu(s);
  await startWith(s, main, { chip: "Start from scratch", command: "/plan2code-0-pathfinder", tabName: "Idea" });
  s.post(BOX);
  await until(async () => (await boxOf(s).inputValue()) === TEXT, 10000);
  await s.page.click("#btn-home");
  await s.page.locator("#home-modal[open]").waitFor();
  await s.page.click("#home-go");
  const got = s.wait(10);
  assert.equal(got.code, 0, `nothing was sent (wait exit ${got.code})`);
  assert.ok(got.actions.some((a) => a.i === "__dashboard"), "the send goes home");
  assert.ok(got.reply.includes(MARKER), "and carries the filled box");
  await until(() => sentOf(s.project, tab) !== null, 5000);
});

test("the box is filled once: a redraw or a reload keeps what the person typed, and the pictures are not added again", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "dashboard", payload: MENU, project: tempProject(PROJECT) });
  await noteTab(s, "Idea", TEXT, 3);
  const main = await toTheMenu(s);
  await startWith(s, main, { chip: "Start from scratch", command: "/plan2code-0-pathfinder", tabName: "Idea" });
  s.post(BOX);
  await until(async () => (await readyPictures(s).count()) === 3, 15000);
  await boxOf(s).fill("My own words now.");

  s.post({ agent: { status: "waiting", activity: "Still here" } });
  await s.page.reload({ waitUntil: "domcontentloaded" });
  await drawn(s.page);
  await boxOf(s).waitFor();
  assert.equal(await boxOf(s).inputValue(), "My own words now.");
  await until(async () => (await readyPictures(s).count()) === 3, 5000);
  // A second marked box later in the session is left alone.
  s.post({ items: [{ id: "idea2", kind: "text", title: "Anything else", fill: "note" }] });
  await s.page.locator("#text-idea2").waitFor();
  assert.equal(await s.page.locator("#text-idea2").inputValue(), "");
});

test("a launch that goes back to the dashboard before Send marks nothing", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "dashboard", payload: MENU, project: tempProject(PROJECT) });
  const tab = await noteTab(s, "Idea", TEXT, 1);
  const main = await toTheMenu(s);
  await startWith(s, main, { chip: "Start from scratch", command: "/plan2code-quick-task", tabName: "Idea" });
  s.post(BOX);
  await until(async () => (await boxOf(s).inputValue()) === TEXT, 10000);
  const r = cli(["open", "--resume", s.sid, "--no-open", "--workflow", "dashboard"], { cwd: s.project });
  assert.equal(r.status, 0, `resume failed: ${r.stderr}`);
  s.post(MENU);
  await main.getByRole("heading", { name: "What are we doing today?" }).waitFor();
  assert.equal(sentOf(s.project, tab), null);
});

test("a tab deleted between Start and the box leaves the box empty, with a banner", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "dashboard", payload: MENU, project: tempProject(PROJECT) });
  const tab = await noteTab(s, "Idea", TEXT, 1);
  const main = await toTheMenu(s);
  await startWith(s, main, { chip: "Start from scratch", command: "/plan2code-1-plan", tabName: "Idea" });
  deleteTab(s.project, tab);
  s.post(BOX);
  await s.page.locator("#banner", { hasText: "That Notebook tab is gone; the box starts empty." }).waitFor();
  assert.equal(await boxOf(s).inputValue(), "");
  assert.equal(await readyPictures(s).count(), 0);
});
