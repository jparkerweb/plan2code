// Page tests for the git board: the Changes, Branches and Sync tabs drawn
// from a real repository, each tab's content on show when it is picked. Run
// with:
// node --test scripts/test-web-console-page-git.mjs
//
// Each test drives the real console in a real Chrome or Edge through
// scripts/page-test-helpers.mjs: one browser for the file, a fresh console
// session per test. The fixture repo is built under the scrubbed git config
// that skill-script-helpers.mjs sets for the whole process, so the console's
// own snapshot reads it the way the fixture wrote it.

import { gitInit } from "./skill-script-helpers.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pageSuite, openSession, tempProject, textOf, itemCard } from "./page-test-helpers.mjs";
import { until } from "./web-console-test-helpers.mjs";

const suite = pageSuite(test);

// A repo with one commit on main, a second branch, and one file changed on
// the tree since that commit.
function gitProject() {
  const dir = tempProject({ "README.md": "# Sample\n", "src/app.js": "export const app = 1;\n" });
  const g = gitInit(dir);
  g("add", "-A");
  g("commit", "-q", "-m", "First commit");
  g("branch", "feature/export-csv");
  fs.appendFileSync(path.join(dir, "src", "app.js"), "export const more = 2;\n");
  return dir;
}

// What a real Git skill posts once the board is up (notes/git.md): a reread,
// so the console snapshots the repo, and the description of what changed.
const BOARD = { reread: true, board: { describe: "export-more" } };

test("the git board shows Changes, Branches and Sync, and each tab shows its own content", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "git", project: gitProject(), payload: BOARD });
  const { page } = s;
  const tab = (label) => page.getByRole("tab", { name: new RegExp(`^${label}\\b`) });
  const panel = page.getByRole("tabpanel");

  await page.getByRole("tablist").waitFor();
  assert.deepEqual(
    (await page.getByRole("tab").allInnerTexts()).map((x) => x.trim().split(/\s/)[0]),
    ["Changes", "Branches", "Sync"]
  );

  await tab("Changes").click();
  await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent.startsWith("Changes"));
  await panel.getByText("src/app.js", { exact: true }).waitFor();
  assert.match(await textOf(panel), /src\/app\.js/);

  await tab("Branches").click();
  await panel.getByText("feature/export-csv").first().waitFor();
  const branches = await textOf(panel);
  assert.match(branches, /feature\/export-csv/);
  assert.doesNotMatch(branches, /src\/app\.js/, "the Branches tab still shows the changed files");

  await tab("Sync").click();
  await panel.getByText(/nothing to sync/).waitFor();
  const sync = await textOf(panel);
  assert.match(sync, /No remote yet, so nothing to sync/);
  assert.doesNotMatch(sync, /feature\/export-csv/, "the Sync tab still lists the branches");
});

test("each git tab keeps its own scroll place, across a tab switch and an agent post", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "git", project: gitProject(), payload: BOARD });
  const { page } = s;
  await page.getByRole("tablist").waitFor();
  await page.setViewportSize({ width: 1280, height: 260 });
  const tab = (label) => page.getByRole("tab", { name: new RegExp(`^${label}\\b`) });
  const column = () => page.locator("#main").evaluate((el) => el.scrollTop);
  await tab("Changes").click();
  await page.getByRole("tabpanel").getByText("src/app.js", { exact: true }).waitFor();
  await page.locator("#main").evaluate((el) => (el.scrollTop = 120));
  const changesAt = await column();
  assert.ok(changesAt > 0, "the board's column scrolls");
  // Another tab opens at its own place, not where Changes was left.
  await tab("Branches").click();
  await page.getByRole("tabpanel").getByText("feature/export-csv").first().waitFor();
  assert.equal(await column(), 0, "Branches opened at the place Changes was left");
  await tab("Changes").click();
  await page.getByRole("tabpanel").getByText("src/app.js", { exact: true }).waitFor();
  assert.equal(await column(), changesAt, "Changes lost its place across the switch");
  // An agent post redraws the board: still the same place.
  s.post({ title: "Git, take two" });
  await page.waitForFunction(() => document.getElementById("title").textContent.includes("Git, take two"));
  assert.equal(await column(), changesAt, "Changes lost its place across a redraw");
});

// The agent is sitting in `wait`, so the board is the person's to use. A fresh
// session has the agent working, which locks every button but the tabs.
const READY = { ...BOARD, agent: { status: "waiting" } };

// A repo with one commit, then two changes on the tree: src/app.js edited and
// notes.md new. `branch` checks out a branch of its own (or "detached" a bare
// commit), so the commit panel is the next step; on main the next step is to
// start a branch. `remotes` names the remotes to add.
function changesProject({ branch = null, remotes = [] } = {}) {
  const dir = tempProject({ "README.md": "# Sample\n", "src/app.js": "export const app = 1;\n" });
  const g = gitInit(dir);
  g("add", "-A");
  g("commit", "-q", "-m", "First commit");
  g("branch", "feature/export-csv");
  for (const name of remotes) {
    const bare = tempProject();
    g("init", "-q", "--bare", bare);
    g("remote", "add", name, bare);
  }
  if (branch === "detached") g("checkout", "-q", "--detach");
  else if (branch) g("checkout", "-q", "-b", branch);
  fs.appendFileSync(path.join(dir, "src", "app.js"), "export const more = 2;\n");
  fs.writeFileSync(path.join(dir, "notes.md"), "Notes.\n");
  return dir;
}

const confirmCard = { id: "y1", kind: "confirm", title: "Save these changes", body: "Commit them?" };
const tabButton = (page, label) => page.getByRole("tab", { name: new RegExp(`^${label}\\b`) });
const tickBox = (page, file) => page.getByLabel(`Commit ${file}`);
// The Branches tab's Switch button, for the one other branch.
const switchButton = (page) => page.getByRole("tabpanel").getByRole("button", { name: "Switch" });
// The board's step button, in the strip above the tab's content.
const stepButton = (page, name) => page.locator(".git-step-actions").getByRole("button", { name });

// Whether the board's own controls (not its tabs or the pointer to another
// tab) are all off, or at least one is on. Whatever tab the board has moved to,
// a locked board has every one of them disabled.
const boardControls = (page) => page.locator(".git-panel-tab").locator("button, input[type=checkbox], select");
const usable = async (page) => {
  const off = await boardControls(page).evaluateAll((all) => all.filter((x) => !x.classList.contains("git-hint")).map((x) => x.disabled));
  return off.some((x) => !x);
};
// The board redraws a moment after its cause, so each check gets time to settle.
const settles = (control, enabled) => until(async () => (await control.isEnabled()) === enabled, 8000);
const settlesUsable = (page, want) => until(async () => (await usable(page)) === want, 8000);
const titled = (page, text) => page.waitForFunction((x) => document.getElementById("title").textContent.includes(x), text);

test("the commit dialog sends the ticked files as one __git action, with its reply sentence", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "git", project: changesProject({ branch: "feature/x" }), payload: READY });
  const { page } = s;
  await page.getByRole("tablist").waitFor();
  await stepButton(page, "Commit 2 files").click();
  const panel = page.locator(".git-panel");
  await panel.getByRole("button", { name: "Close" }).waitFor();
  await tickBox(page, "notes.md").uncheck();
  await panel.getByRole("button", { name: "Commit 1 file" }).click();
  const got = s.wait(10);
  assert.equal(got.code, 0, "the agent collected the click");
  assert.deepEqual(got.actions, [{ i: "__git", type: "git", op: "commit", files: ["src/app.js"], ignore: [] }]);
  assert.equal(got.reply, "Commit this file: src/app.js.");
});

test("a board click is exactly one __git action", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "git", project: gitProject(), payload: READY });
  const { page } = s;
  await tabButton(page, "Branches").click();
  await switchButton(page).click();
  const got = s.wait(10);
  assert.equal(got.code, 0);
  assert.equal(got.actions.length, 1, "one click, one action");
  assert.equal(got.actions[0].i, "__git");
  assert.equal(got.actions[0].type, "git");
  assert.equal(got.reply, "Switch to feature/export-csv.");
  assert.notEqual(s.wait(1).code, 0, "nothing else was sent beside it");
});

test("the board stays locked from a click until the agent's next post, not just until it is collected", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "git", project: gitProject(), payload: READY });
  const { page } = s;
  await tabButton(page, "Branches").click();
  assert.ok(await settlesUsable(page, true), "the board is the person's before any click");
  await switchButton(page).click();
  assert.ok(await settlesUsable(page, false), "locked from the click");
  // The agent has the click now (it is running git), and the board still waits.
  assert.equal(s.wait(10).code, 0);
  await new Promise((r) => setTimeout(r, 1500));
  assert.equal(await usable(page), false, "collected is not yet answered");
  // The agent's next post lets the board go.
  s.post({ title: "Switched", agent: { status: "waiting" } });
  await titled(page, "Switched");
  assert.ok(await settlesUsable(page, true), "the agent's post gave the board back");
});

test("an open card of the agent's holds the board, and a notice does not", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "git", project: gitProject(), payload: READY });
  const { page } = s;
  assert.ok(await settlesUsable(page, true));
  s.post({ items: [{ id: "n1", kind: "notice", title: "Heads up", body: "Nothing to act on." }], agent: { status: "waiting" } });
  await page.getByText("Heads up", { exact: true }).waitFor();
  assert.equal(await usable(page), true, "a notice leaves the board alone");
  s.post({ items: [confirmCard], agent: { status: "waiting" } });
  await itemCard(page, "y1").waitFor();
  assert.ok(await settlesUsable(page, false), "a question card holds the board");
});

test("the git board lets go of a working agent that went adrift", async (t) => {
  const working = { agent: { status: "working", activity: "Looking at the repo" } };
  const s = await openSession(await suite.browser(), { t, workflow: "git", project: gitProject(), clock: true, payload: { ...BOARD, ...working } });
  const { page } = s;
  assert.equal(await usable(page), false, "a working agent holds the board");
  // Nobody has listened for longer than the adrift limit. The board only
  // redraws on a post, and the agent is still "working" in it: the lock must
  // not outlive the agent.
  await page.clock.fastForward(200_000);
  s.post({ title: "Still on it", ...working });
  await titled(page, "Still on it");
  assert.ok(await settlesUsable(page, true), "an agent gone quiet gave the board back");
});

test("the commit table keeps the person's ticks across an agent post, and a click re-seeds them", async (t) => {
  const dir = changesProject({ branch: "feature/x" });
  const s = await openSession(await suite.browser(), { t, workflow: "git", project: dir, payload: READY });
  const { page } = s;
  await tabButton(page, "Changes").click();
  await tickBox(page, "notes.md").uncheck();
  // An agent post redraws the board: the person's tick stays off.
  s.post({ title: "Still looking", agent: { status: "waiting" } });
  await titled(page, "Still looking");
  assert.equal(await tickBox(page, "notes.md").isChecked(), false, "an agent post put the tick back");
  assert.equal(await tickBox(page, "src/app.js").isChecked(), true);
  // Their click goes out with the one file. Then the agent commits it and a new file turns up.
  await page.locator(".git-panel-actions").getByRole("button", { name: "Commit 1 file" }).click();
  assert.deepEqual(s.wait(10).actions[0].files, ["src/app.js"]);
  const g = gitInit(dir, "feature/x");
  g("add", "src/app.js");
  g("commit", "-q", "-m", "Edit app");
  fs.writeFileSync(path.join(dir, "later.md"), "Later.\n");
  s.post({ reread: true, title: "Committed", agent: { status: "waiting" } });
  await titled(page, "Committed");
  await tabButton(page, "Changes").click();
  await tickBox(page, "later.md").waitFor();
  assert.equal(await tickBox(page, "notes.md").isChecked(), true, "the click dropped the old picks, so the table was seeded afresh");
});

test("starting a branch for the changes carries the files ticked in the commit table", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "git", project: changesProject(), payload: READY });
  const { page } = s;
  await tabButton(page, "Changes").click();
  await tickBox(page, "notes.md").uncheck();
  await stepButton(page, /^Start a branch for/).click();
  const panel = page.locator(".git-panel");
  await panel.getByRole("heading", { name: "New branch for this commit" }).waitFor();
  const create = panel.getByRole("button", { name: "Create", exact: true });
  assert.ok(await settles(create, true), "a free name is composed from the description");
  await create.click();
  const got = s.wait(10);
  assert.equal(got.code, 0);
  assert.equal(got.actions.length, 1);
  assert.equal(got.actions[0].op, "create");
  assert.equal(got.actions[0].then, "commit");
  assert.deepEqual(got.actions[0].files, ["src/app.js"], "the unticked file stayed out");
  assert.match(got.reply, /^Create \S+ from main\. Then commit this file: src\/app\.js\.$/);
});

test("a commit with no branch to land on carries the ticked files into the new branch", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "git", project: changesProject({ branch: "detached" }), payload: READY });
  const { page } = s;
  await tabButton(page, "Changes").click();
  await tickBox(page, "notes.md").uncheck();
  // The step is on the Branches tab, and its Commit button finds no branch to commit on.
  await tabButton(page, "Branches").click();
  await stepButton(page, "Commit 2 files").click();
  const panel = page.locator(".git-panel");
  await panel.getByRole("heading", { name: "New branch for this commit" }).waitFor();
  const create = panel.getByRole("button", { name: "Create", exact: true });
  assert.ok(await settles(create, true));
  await create.click();
  const got = s.wait(10);
  assert.equal(got.code, 0);
  assert.equal(got.actions[0].op, "create");
  assert.deepEqual(got.actions[0].files, ["src/app.js"]);
  assert.match(got.reply, /Then commit this file: src\/app\.js\.$/);
});

test("Publish names a remote only when there is exactly one", async (t) => {
  const browser = await suite.browser();
  const published = async (remotes) => {
    const s = await openSession(browser, { t, workflow: "git", project: changesProject({ branch: "feature/x", remotes }), payload: READY });
    await tabButton(s.page, "Sync").click();
    await s.page.locator(".git-sync-actions").getByRole("button", { name: "Publish" }).click();
    const got = s.wait(10);
    assert.equal(got.code, 0);
    await s.stop();
    return got;
  };
  const one = await published(["origin"]);
  assert.equal(one.actions[0].remote, "origin");
  assert.equal(one.reply, "Publish to origin.");
  const two = await published(["origin", "backup"]);
  assert.equal(Object.hasOwn(two.actions[0], "remote"), false, "with two remotes the agent is the one to ask which");
  assert.equal(two.reply, "Publish.");
});

test("over the git board a note box grows with its text, and the no-repo note only points above when a card is there", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "git", project: gitProject(), payload: READY });
  s.post({ items: [confirmCard], agent: { status: "waiting" } });
  const note = itemCard(s.page, "y1").locator("textarea").first();
  await note.waitFor();
  const before = await note.evaluate((el) => el.offsetHeight);
  await note.fill(Array.from({ length: 8 }, (_, n) => `Line ${n + 1} of a longer note.`).join("\n"));
  const after = await note.evaluate((el) => el.offsetHeight);
  assert.ok(after > before + 40, `the note box grew with its text: ${before} to ${after}`);

  // A folder that is no repository: the note points up only once there is a card up there.
  const bare = await openSession(await suite.browser(), { t, workflow: "git", payload: { reread: true, agent: { status: "waiting" } } });
  const aside = bare.page.locator(".git-note");
  await aside.waitFor();
  assert.match(await textOf(aside), /will ask what to do here in a moment/);
  bare.post({ items: [confirmCard], agent: { status: "waiting" } });
  await itemCard(bare.page, "y1").waitFor();
  assert.match(await textOf(aside), /asks above what to do/);
});
