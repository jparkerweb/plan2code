// Page tests for Help, the first-run Welcome and the update notice's modal. Run
// with:
// node --test scripts/test-web-console-page-help.mjs
//
// Each test drives the real console in a real Chrome or Edge through
// scripts/page-test-helpers.mjs: one browser for the file, a fresh console
// session per test. Help's prose stays untested; these cover how the dialog
// behaves.

import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { pageSuite, openSession, tempProject, textOf, drawn } from "./page-test-helpers.mjs";
import { HOME } from "./web-console-test-helpers.mjs";
import { HELP_TABS } from "../src/web-console/public/help.js";

const suite = pageSuite(test);

// The console home's saved looks, shared by every session of this file. Each
// test that cares sets it first and the file is removed once the test is done.
const LOOKS_FILE = path.join(HOME, "looks.json");
function savedLooks(t, looks) {
  if (looks) fs.writeFileSync(LOOKS_FILE, JSON.stringify({ looks }));
  else fs.rmSync(LOOKS_FILE, { force: true });
  t.after(() => fs.rmSync(LOOKS_FILE, { force: true }));
}

const RELEASES_URL = "https://github.com/jparkerweb/plan2code/releases/";

// A plan session on the person's turn: one text question and the agent listening.
const PLAN_QUESTION = {
  items: [{ id: "q1", kind: "text", title: "What to call it", body: "A short name for the export." }],
  agent: { status: "waiting" },
};

// The dashboard, past Planny's wake-up. The Welcome may be on top of it. The
// wake-up plays once per tab, so a reloaded page has no intro to skip.
async function toTheDashboard(s) {
  const heading = s.page.locator("#main").getByRole("heading", { name: "What are we doing today?" });
  const skip = s.page.getByRole("button", { name: "Skip the intro" });
  await skip.or(heading).first().waitFor();
  if (await skip.isVisible()) await skip.click();
  await heading.waitFor();
}

const helpModal = (s) => s.page.locator("#help-modal");
const tabButton = (s, id) => s.page.locator("#help-tab-" + id);
const selectedTab = (s) => s.page.locator('#help-tabs [role="tab"][aria-selected="true"]');
const focusedId = (s) => s.page.evaluate(() => document.activeElement && document.activeElement.id);

async function openHelp(s) {
  await s.page.click("#btn-about");
  await helpModal(s).waitFor();
}

test("Help opens on a tab, moves between tabs with the arrow, Home and End keys, and closes with Escape", async (t) => {
  savedLooks(t, { welcomeSeen: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  // Built on first open: the tab buttons are not in the page before it.
  assert.equal(await s.page.locator("#help-tabs [role=tab]").count(), 0, "Help is built before it is opened");
  await openHelp(s);
  assert.equal(await s.page.locator("#help-tabs [role=tab]").count(), HELP_TABS.length, "one tab button per Help topic");

  // A plain workflow page opens on the first topic, with focus on its tab.
  const ids = HELP_TABS.map((x) => x.id);
  assert.equal(await selectedTab(s).count(), 1, "exactly one tab is selected");
  assert.equal(await selectedTab(s).getAttribute("id"), "help-tab-" + ids[0]);
  assert.equal(await focusedId(s), "help-tab-" + ids[0], "focus starts on the selected tab");

  // Roving focus: only the selected tab is in the tab order, and its panel is the one shown.
  const onlySelected = async (id) => {
    assert.equal(await selectedTab(s).getAttribute("id"), "help-tab-" + id);
    assert.equal(await focusedId(s), "help-tab-" + id, `focus is on ${id}`);
    assert.equal(await tabButton(s, id).getAttribute("tabindex"), "0");
    assert.equal(await s.page.locator('#help-tabs [role=tab][tabindex="0"]').count(), 1, "one tab stop");
    assert.equal(await s.page.locator("#help-panel-" + id).isVisible(), true, `${id}'s panel is shown`);
    assert.equal(await s.page.locator('#help-panels [role=tabpanel]:not([hidden])').count(), 1, "one panel is shown");
  };
  await onlySelected(ids[0]);
  await s.page.keyboard.press("ArrowDown");
  await onlySelected(ids[1]);
  await s.page.keyboard.press("ArrowRight");
  await onlySelected(ids[2]);
  await s.page.keyboard.press("ArrowUp");
  await onlySelected(ids[1]);
  await s.page.keyboard.press("End");
  await onlySelected(ids[ids.length - 1]);
  await s.page.keyboard.press("ArrowDown");
  await onlySelected(ids[0]);
  await s.page.keyboard.press("ArrowUp");
  await onlySelected(ids[ids.length - 1]);
  await s.page.keyboard.press("Home");
  await onlySelected(ids[0]);
  // A click picks a tab too.
  await tabButton(s, ids[3]).click();
  await onlySelected(ids[3]);

  await s.page.keyboard.press("Escape");
  await helpModal(s).waitFor({ state: "hidden" });
  assert.equal(await focusedId(s), "btn-about", "focus goes back to the Help button");
  // Reopened, the built dialog is reused: no second set of tabs.
  await openHelp(s);
  assert.equal(await s.page.locator("#help-tabs [role=tab]").count(), HELP_TABS.length);
});

test("Help shows the live connection line and the version as a safe link to the Releases page", async (t) => {
  savedLooks(t, { welcomeSeen: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openHelp(s);
  const live = s.page.locator("#about-live");
  assert.match(await textOf(live), /^Right now: both halves are talking to each other\./);
  assert.equal(await live.evaluate((n) => n.classList.contains("is-good")), true);

  const link = s.page.locator("#help-version a");
  await link.waitFor();
  assert.match(await textOf(link), /^Plan2Code v\d+\.\d+\.\d+/, "the link names the installed version");
  assert.equal(await link.getAttribute("href"), RELEASES_URL);
  assert.equal(await link.getAttribute("rel"), "noopener noreferrer");
  assert.equal(await link.getAttribute("target"), "_blank");

  // The line is written on open: a finished session says so the next time.
  await s.page.keyboard.press("Escape");
  await helpModal(s).waitFor({ state: "hidden" });
  s.post({ finish: { headline: "The plan is written", command: "/plan2code-2-document" } });
  await s.page.locator("#main").getByRole("heading", { name: "The plan is written" }).waitFor();
  await openHelp(s);
  assert.match(await textOf(live), /^Right now: the session is finished/);
});

test("a click on Help's backdrop closes it, and a click inside it does not", async (t) => {
  savedLooks(t, { welcomeSeen: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openHelp(s);
  await s.page.locator("#help-title").click();
  assert.equal(await helpModal(s).isVisible(), true, "a click inside closed Help");
  // The top-left corner of the page is the backdrop, well outside the dialog.
  await s.page.mouse.click(4, 4);
  await helpModal(s).waitFor({ state: "hidden" });
});

test("Ctrl+Enter does not send while Help is open, and sends once it is closed", async (t) => {
  savedLooks(t, { welcomeSeen: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await s.page.locator('[data-item="q1"]').first().locator("textarea, input[type=text]").first().fill("audit-export");
  await openHelp(s);
  await s.page.keyboard.press("Control+Enter");
  await s.page.keyboard.press("Meta+Enter");
  assert.equal(s.wait(1).code === 0, false, "something was sent from behind Help");
  assert.equal(await helpModal(s).isVisible(), true, "the key closed Help");

  await s.page.keyboard.press("Escape");
  await helpModal(s).waitFor({ state: "hidden" });
  await s.page.keyboard.press("Control+Enter");
  const got = s.wait(10);
  assert.equal(got.code, 0, "Ctrl+Enter sends nothing with Help closed");
  assert.deepEqual(
    got.actions.map(({ i, type }) => ({ i, type })),
    [{ i: "q1", type: "answer" }]
  );
});

test("the Welcome shows on a first dashboard, saves that it was seen, and Help's Show the welcome again brings it back", async (t) => {
  savedLooks(t, null);
  const s = await openSession(await suite.browser(), { t, workflow: "dashboard", payload: { agent: { status: "waiting" } }, project: tempProject() });
  await toTheDashboard(s);
  const welcome = s.page.locator("#welcome-modal");
  await welcome.waitFor();
  assert.equal(await s.page.locator("#welcome-title").isVisible(), true);
  await s.page.getByRole("button", { name: "Start building" }).click();
  await welcome.waitFor({ state: "hidden" });
  // Saved with the other looks, so it holds for the next page too.
  await s.page.waitForFunction(async () => ((await (await fetch("/looks")).json()).looks || {}).welcomeSeen === true);

  await s.page.reload({ waitUntil: "domcontentloaded" });
  await drawn(s.page);
  await toTheDashboard(s);
  await s.page.waitForTimeout(800);
  assert.equal(await welcome.isVisible(), false, "the Welcome came back on a later page");

  // Help's first topic offers it again, and Help steps aside for it.
  // (On the dashboard Help opens on the dashboard topic, so go to the first.)
  await openHelp(s);
  await tabButton(s, HELP_TABS[0].id).click();
  await s.page.getByRole("button", { name: "Show the welcome again" }).click();
  await welcome.waitFor();
  assert.equal(await helpModal(s).isVisible(), false, "Help stayed open under the Welcome");
  await s.page.keyboard.press("Escape");
  await welcome.waitFor({ state: "hidden" });
});

test("the Welcome stays away when the person has seen it, and off the dashboard", async (t) => {
  const browser = await suite.browser();
  savedLooks(t, { welcomeSeen: true });
  const seen = await openSession(browser, { t, workflow: "dashboard", payload: { agent: { status: "waiting" } }, project: tempProject() });
  await toTheDashboard(seen);
  await seen.page.waitForTimeout(800);
  assert.equal(await seen.page.locator("#welcome-modal").isVisible(), false, "a seen Welcome showed again");

  // Unseen, but a workflow page is not a first dashboard.
  savedLooks(t, null);
  const plan = await openSession(browser, { t, workflow: "plan", payload: PLAN_QUESTION });
  await plan.page.waitForTimeout(800);
  assert.equal(await plan.page.locator("#welcome-modal").isVisible(), false, "the Welcome showed on a workflow page");
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

test("the update banner opens a modal with the exact update commands, and its dismissal is remembered for the session", async (t) => {
  savedLooks(t, { welcomeSeen: true });
  aNewerReleaseExists(t);
  const s = await openSession(await suite.browser(), { t, workflow: "dashboard", payload: { agent: { status: "waiting" } }, project: tempProject() });
  await toTheDashboard(s);
  const main = s.page.locator("#main");
  await main.getByRole("button", { name: /UPDATE AVAILABLE · v99\.0\.0/ }).click();

  const modal = s.page.locator("#update-modal");
  await modal.waitFor();
  assert.match(await textOf(s.page.locator("#update-versions")), /^Version v99\.0\.0 is out/);
  const releases = s.page.locator("#update-versions a");
  assert.equal(await releases.getAttribute("href"), RELEASES_URL);
  assert.equal(await releases.getAttribute("rel"), "noopener noreferrer");
  assert.equal(await textOf(s.page.locator("#update-command code")), "plan2code update");
  assert.equal(
    await textOf(s.page.locator("#update-fallback code")),
    "npx --allow-git=all git+https://github.com/jparkerweb/plan2code.git"
  );
  await s.page.locator("#update-done").click();
  await modal.waitFor({ state: "hidden" });

  // The ×: gone now, remembered under this session's key, and still gone after a reload.
  await main.getByRole("button", { name: "Dismiss until next time" }).click();
  await main.getByRole("button", { name: /UPDATE AVAILABLE/ }).waitFor({ state: "hidden" });
  assert.equal(await s.page.evaluate((k) => sessionStorage.getItem(k), "p2c-update-dismissed:" + s.sid), "99.0.0");
  await s.page.reload({ waitUntil: "domcontentloaded" });
  await drawn(s.page);
  await toTheDashboard(s);
  assert.equal(await main.getByRole("button", { name: /UPDATE AVAILABLE/ }).count(), 0, "the banner came back after a reload");
});
