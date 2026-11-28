// Page tests for Learning on the dashboard: the row in its four states and two
// places, the paused tint, Pause for me with no agent, the More menu, the
// waiting banner and the controls that gray out when no agent can answer; and
// the lessons card: each row's own choices, Reword, a refused row, a flagged
// row, the first ask, Review from the banner and the loop stop card's line. Run
// with: node --test scripts/test-web-console-page-learning.mjs
//
// Each test drives the real console in a real Chrome or Edge through
// scripts/page-test-helpers.mjs, in a throwaway project whose
// .plan2code/settings.json sets the state.

import test from "node:test";
import assert from "node:assert/strict";
import { pageSuite, openSession, tempProject, textOf, styleOf, stylesOf, itemCard, sendAndCollect, settled, scrollCard } from "./page-test-helpers.mjs";
import { cli, until } from "./web-console-test-helpers.mjs";
import { recordFollow, writePause, writeWaiting } from "../src/web-console/learning.mjs";

const suite = pageSuite(test);

const SETTINGS = (learning) => ({ ".plan2code/settings.json": JSON.stringify({ format: 1, learning }) + "\n" });
const PROJECT = (learning) => ({ "AGENTS.md": "# AGENTS.md\n\nA small demo project.\n", ...(learning ? SETTINGS(learning) : {}) });

const MENU = { menu: { note: "Nothing on disk yet." }, agent: { status: "waiting" } };

// The dashboard as a person first sees it, past the intro and the Welcome.
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

async function dashboard(t, files, before) {
  const project = tempProject(files);
  if (before) before(project);
  const s = await openSession(await suite.browser(), { t, workflow: "dashboard", payload: MENU, project });
  const main = await toTheMenu(s);
  return { s, main, project };
}

// Where the row sits among the dashboard's own blocks, read in one go.
const placeOf = (main) =>
  main.locator(".dash").evaluate((dash) => {
    const kids = [...dash.children];
    const at = (sel) => kids.findIndex((k) => k.matches(sel));
    const groups = kids.map((k, i) => (k.matches("section.dash-group") ? i : -1)).filter((i) => i >= 0);
    return {
      row: at("section.learn-row"),
      rows: dash.querySelectorAll("section.learn-row").length,
      toggle: at("label.dash-toggle"),
      firstGroup: groups[0],
      lastGroup: groups[groups.length - 1],
      tip: at(".approval-tip"),
    };
  });

for (const [state, pill] of [
  ["not-set-up", "Not set up"],
  ["off", "Off"],
]) {
  test(`${state}: the row sits where its state puts it, with its pill and Switch on`, async (t) => {
    const { main } = await dashboard(t, PROJECT(state === "not-set-up" ? null : state));
    const row = main.locator("section.learn-row");
    await row.waitFor();
    const where = await placeOf(main);
    assert.equal(where.rows, 1);
    if (state === "not-set-up") {
      // A newcomer's first dashboard offers one call to action, so Not set up waits at the bottom.
      assert.ok(where.row > where.lastGroup, "after the card groups");
      assert.equal(where.row, where.tip - 1, "directly before the approval tip");
      assert.equal(await row.getByRole("button", { name: "Switch on" }).evaluate((b) => b.classList.contains("primary")), false, "a plain button");
    } else {
      assert.equal(where.row, where.toggle + 1, "directly after the hide-unavailable toggle");
      assert.ok(where.row < where.firstGroup, "above the card groups");
    }
    assert.equal((await row.locator(".learn-pill").textContent()).trim(), pill);
    assert.equal(await row.getByRole("button", { name: "Switch on" }).isEnabled(), true);
    if (state === "not-set-up") {
      assert.match(await textOf(row), /Plan2Code can keep lessons about this codebase, approved by you\./);
    }
  });
}

test("paused: the row is under the picker, amber, and says since when", async (t) => {
  const { main } = await dashboard(t, PROJECT("on"), (p) => writePause(p, true, "2026-11-13T12:00:00.000Z"));
  const row = main.locator("section.learn-row");
  await row.waitFor();
  const where = await placeOf(main);
  assert.equal(where.row, where.toggle + 1);
  assert.equal((await row.locator(".learn-pill").textContent()).trim(), "Paused for you");
  assert.match(await textOf(row), /Paused since Nov 1[23]/);
  const sw = row.getByRole("switch", { name: "Pause for me" });
  assert.equal(await sw.getAttribute("aria-checked"), "true");
  // The amber tint: the line's border and the pill share the hold color, and
  // the line has a background the plain row does not.
  const line = row.locator(".learn-line");
  const looks = await stylesOf(line, ["border-top-color", "background-color"]);
  assert.equal(looks["border-top-color"], await styleOf(row.locator(".learn-pill"), "color"));
  assert.notEqual(looks["background-color"], "rgba(0, 0, 0, 0)");
});

test("on: the row is after the last card group, before the tip, with no count of saved lessons", async (t) => {
  const { main } = await dashboard(t, {
    ...PROJECT("on"),
    ".plan2code/lessons/general.md": "# General\n\n- One.\n- Two.\n- Three.\n",
  });
  const row = main.locator("section.learn-row");
  await row.waitFor();
  const where = await placeOf(main);
  assert.equal(where.row, where.lastGroup + 1, "after the last card group");
  assert.equal(where.tip, where.row + 1, "before the approval tip");
  const text = await textOf(row);
  assert.equal((await row.locator(".learn-pill").textContent()).trim(), "On");
  assert.doesNotMatch(text, /\d/, `no count in the row: ${text}`);
  assert.equal(await main.getByText(/\d+\s+(saved\s+)?lessons?\s+(saved|kept)/i).count(), 0, "no count anywhere");
  await row.getByRole("button", { name: "Open the lessons" }).click();
  const dlg = main.page().locator("#learn-lessons-modal");
  await dlg.getByText("General", { exact: true }).first().waitFor();
  assert.match(await textOf(dlg), /The project's lessons \(\.plan2code\/lessons\/, saved with the repository\)/);
});

test("the lessons reader draws a quiet follow line under each lesson's heading", async (t) => {
  const lesson = (title) => `### ${title}\n- Kind: how-it-works\n- About: src/x.js\n- Noted: 2026-11-01, Implement\n\n`;
  const { main } = await dashboard(
    t,
    { ...PROJECT("on"), ".plan2code/lessons/general.md": `# General\n\n${lesson("Followed lesson")}${lesson("Untouched lesson")}${lesson("Once lesson")}` },
    (project) => {
      recordFollow(project, { lesson: "general/followed-lesson", skill: "implement" }, new Date("2026-11-10T12:00:00Z"));
      recordFollow(project, { lesson: "general/followed-lesson", skill: "quick-task" }, new Date("2026-11-20T12:00:00Z"));
      recordFollow(project, { lesson: "general/once-lesson", skill: "implement" }, new Date("2026-11-12T12:00:00Z"));
    }
  );
  const row = main.locator("section.learn-row");
  await row.waitFor();
  await row.getByRole("button", { name: "Open the lessons" }).click();
  const dlg = main.page().locator("#learn-lessons-modal");
  await dlg.locator(".learn-follow").first().waitFor();
  const lines = await dlg.locator(".learn-follow").allInnerTexts();
  assert.equal(lines.length, 3, "one line per lesson");
  assert.match(lines[0], /^Followed 2 times, last on Nov 2[01]$/);
  assert.equal(lines[1], "Not followed yet");
  assert.match(lines[2], /^Followed once, last on Nov 1[123]$/);
  // The line sits right under its heading.
  const order = await dlg.locator(".learn-lessons-file").evaluate((n) => [...n.children].map((c) => (c.classList.contains("learn-follow") ? "follow" : c.textContent.includes("Followed lesson") ? "heading" : "other")));
  assert.equal(order.indexOf("follow"), order.indexOf("heading") + 1);
});

test("Pause for me repaints the row with no agent listening, both ways", async (t) => {
  const { s, main } = await dashboard(t, PROJECT("on"));
  const bottom = main.locator("section.learn-row.is-bottom");
  await bottom.getByRole("switch", { name: "Pause for me" }).click();
  // Nothing collects a send here: the server saved the pause and pushed the scan.
  const top = main.locator("section.learn-row.is-top.is-paused");
  await top.waitFor();
  assert.equal(await bottom.count(), 0);
  assert.equal(await top.getByRole("switch").getAttribute("aria-checked"), "true");
  await top.getByRole("switch", { name: "Pause for me" }).click();
  await main.locator("section.learn-row.is-bottom.is-on").waitFor();
  assert.equal(s.wait(1).code, 10, "no send reached the agent");
});

test("More opens upward and closes on Escape and on a click outside", async (t) => {
  const { s, main } = await dashboard(t, PROJECT("on"));
  const row = main.locator("section.learn-row.is-bottom");
  const more = row.getByRole("button", { name: /More/ });
  const menu = row.getByRole("menu");
  assert.equal(await menu.isVisible(), false);
  await more.click();
  await menu.waitFor();
  assert.equal(await more.getAttribute("aria-expanded"), "true");
  const [m, b] = [await menu.boundingBox(), await more.boundingBox()];
  assert.ok(m.y + m.height <= b.y + 1, `the menu opens above its button: ${JSON.stringify({ m, b })}`);
  assert.deepEqual(await menu.getByRole("menuitem").allInnerTexts(), [
    "Switch off for this project",
    "Tidy up lessons",
    "Move the failure log into lessons",
    "Remove all lessons…",
  ]);
  // Keyboard reachable: the first item has focus, and the arrows move it.
  await until(async () => (await menu.getByRole("menuitem").first().evaluate((n) => n === document.activeElement)), 2000);
  await s.page.keyboard.press("ArrowDown");
  assert.equal(await menu.getByRole("menuitem").nth(1).evaluate((n) => n === document.activeElement), true);
  await s.page.keyboard.press("Escape");
  await menu.waitFor({ state: "hidden" });
  await more.click();
  await menu.waitFor();
  await main.getByRole("heading", { name: "What are we doing today?" }).click();
  await menu.waitFor({ state: "hidden" });
});

test("Remove all lessons asks in the page first, then sends the Learning action", async (t) => {
  const { s, main } = await dashboard(t, PROJECT("on"));
  const row = main.locator("section.learn-row.is-bottom");
  await row.getByRole("button", { name: /More/ }).click();
  await row.getByRole("menuitem", { name: "Remove all lessons…" }).click();
  const dlg = s.page.locator("#learn-remove-modal");
  await dlg.waitFor();
  assert.match(await textOf(dlg), /Remove all saved lessons from this project\? Learning stays on\./);
  await dlg.getByRole("button", { name: "Remove all lessons" }).click();
  const got = s.wait(10);
  assert.equal(got.code, 0, "the send reached the agent");
  assert.deepEqual(got.actions, [{ i: "__learning", type: "learning", do: "remove" }]);
});

test("the banner shows only with lessons waiting, directly above the title", async (t) => {
  const noted = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 - 60000).toISOString();
  const { s, main } = await dashboard(t, PROJECT("on"), (p) => {
    writeWaiting(p, { id: "20261111-120000-cccccc", type: "lesson", text: "A lesson.", noted });
    writeWaiting(p, { id: "20261112-120000-cccccc", type: "lesson", text: "Another.", noted: new Date().toISOString() });
  });
  const banner = main.locator(".learn-banner");
  await banner.waitFor();
  assert.equal(await banner.getAttribute("role"), "status");
  assert.match(await textOf(banner), /2 lessons are waiting for your review \(oldest 2 days\)/);
  const order = await banner.evaluate((n) => [n.nextElementSibling.className, n.nextElementSibling.nextElementSibling.className]);
  assert.deepEqual(order, ["card-kicker", "dash-title"], "nothing between the banner and the title");
  await banner.getByRole("button", { name: "Review" }).click();
  const got = s.wait(10);
  assert.equal(got.code, 0);
  assert.deepEqual(got.actions, [{ i: "__learning", type: "learning", do: "review" }]);

  const quiet = await dashboard(t, PROJECT("on"));
  await quiet.main.locator("section.learn-row").waitFor();
  assert.equal(await quiet.main.locator(".learn-banner").count(), 0, "no banner with nothing waiting");

  const paused = await dashboard(t, PROJECT("on"), (p) => {
    writePause(p, true);
    writeWaiting(p, { id: "20261112-120000-dddddd", type: "lesson", text: "Waits.", noted: new Date().toISOString() });
  });
  await paused.main.locator("section.learn-row.is-paused").waitFor();
  assert.equal(await paused.main.locator(".learn-banner").count(), 0, "hidden while paused");
});

test("More has Tidy up lessons, which sends the tidy Learning action and shows working at once", async (t) => {
  const { s, main } = await dashboard(t, PROJECT("on"));
  const row = main.locator("section.learn-row.is-bottom");
  await row.getByRole("button", { name: /More/ }).click();
  await row.getByRole("menuitem", { name: "Tidy up lessons" }).click();
  const got = s.wait(10);
  assert.equal(got.code, 0, "the send reached the agent");
  assert.deepEqual(got.actions, [{ i: "__learning", type: "learning", do: "tidy" }]);
  await main.locator(".learn-banner").getByText("Looking over your lessons…").waitFor();
});

// An area file holding `n` lessons.
const lessonFile = (title, n) =>
  `# ${title}\n\n` + Array.from({ length: n }, (_, i) => `### Lesson number ${i}\n- Kind: how-it-works\n- About: src/a.js\n- Noted: 2026-11-01, Implement\n`).join("\n");

test("the banner nudges a tidy-up when lessons are near their limit, and only then", async (t) => {
  const full = await dashboard(t, { ...PROJECT("on"), ".plan2code/lessons/general.md": lessonFile("General", 22) });
  const banner = full.main.locator(".learn-banner");
  await banner.waitFor();
  assert.match(await textOf(banner), /Lessons are nearing their limit\. Tidy up\?/);
  assert.equal(await banner.getByRole("button", { name: "Review" }).count(), 0, "nothing waits, so no Review");
  await banner.getByRole("button", { name: "Tidy up" }).click();
  const got = full.s.wait(10);
  assert.equal(got.code, 0);
  assert.deepEqual(got.actions, [{ i: "__learning", type: "learning", do: "tidy" }]);

  // Beside the waiting line when lessons wait too.
  const both = await dashboard(t, { ...PROJECT("on"), ".plan2code/lessons/web.md": lessonFile("Web", 30) }, (p) =>
    writeWaiting(p, { id: "20261113-120000-ffffff", type: "lesson", text: "Waits.", noted: new Date().toISOString() })
  );
  const two = both.main.locator(".learn-banner");
  await two.waitFor();
  const text = await textOf(two);
  assert.match(text, /1 lesson is waiting for your review/);
  assert.match(text, /Lessons are nearing their limit\. Tidy up\?/);
  assert.equal(await two.getByRole("button", { name: "Review" }).count(), 1);
  assert.equal(await two.getByRole("button", { name: "Tidy up" }).count(), 1);

  // One short of the line, in general.md and in an area: no nudge.
  const below = await dashboard(t, { ...PROJECT("on"), ".plan2code/lessons/general.md": lessonFile("General", 21), ".plan2code/lessons/web.md": lessonFile("Web", 29) });
  await below.main.locator("section.learn-row").waitFor();
  assert.equal(await below.main.locator(".learn-banner").count(), 0, "no banner below the line");
});

test("a launch from a dashboard showing lessons waiting carries fromBanner", async (t) => {
  const { s, main } = await dashboard(t, PROJECT("on"), (p) =>
    writeWaiting(p, { id: "20261113-120000-eeeeee", type: "lesson", text: "Waits.", noted: new Date().toISOString() })
  );
  await main.locator(".learn-banner").waitFor();
  const card = main.getByRole("button").filter({ has: s.page.locator("code", { hasText: /^\/plan2code-1-plan$/ }) });
  await card.click();
  await main.getByRole("button", { name: "Start Plan" }).click();
  const got = s.wait(10);
  assert.equal(got.code, 0);
  const launch = got.actions.find((a) => a.i === "__launch");
  assert.equal(launch.fromBanner, true);
});

test("agent-run controls gray out while the page has lost the console", async (t) => {
  const { s, main } = await dashboard(t, PROJECT(null));
  const row = main.locator("section.learn-row");
  const on = row.getByRole("button", { name: "Switch on" });
  assert.equal(await on.isEnabled(), true);
  cli(["stop", "--session", s.sid, "--force"], { cwd: s.project });
  await s.page.waitForFunction(() => document.getElementById("planny").classList.contains("is-gone"), null, { timeout: 20000 });
  await until(async () => !(await on.isEnabled()), 5000);
  assert.equal(await on.isEnabled(), false);
  assert.ok((await on.getAttribute("title")) || "", "the grayed control says why");
});

/* ------------------------------------------------------ the lessons card */

// One row of each type, as lessons.mjs list's card gives them.
const ROWS = [
  { id: "w-lesson", type: "lesson", text: "Run a page test alone first.", why: "A full run hides the race.", origin: "You said this.", note: "", flags: [], refused: null, area: "General", areas: ["General", "Web console"], kind: "command", about: ["scripts/node-test.mjs"], choices: ["Keep", "Reword", "Drop"] },
  { id: "w-doubt", type: "doubt", heading: "This lesson may no longer be true:", text: "The handler does one thing.", found: "It now does three.", why: "", origin: "This lesson may no longer be true: It now does three.", note: "", flags: [], refused: null, area: "General", areas: ["General"], choices: ["Keep", "Reword", "Retire"] },
  { id: "w-fix", type: "agents-fix", file: "AGENTS.md", before: "Run npm test.", after: "Run the targeted suites.", text: "Run the targeted suites.", why: "", origin: "A fix to AGENTS.md, replacing: Run npm test.", note: "", flags: [], refused: null, area: "", choices: ["Apply", "Reword", "Drop"] },
  { id: "log:abc", type: "log-line", text: "Never fix CRLF by hand.", lessons: ["Run npm run fix:eol for line endings."], why: "", origin: "From the failure log in AGENTS.md.", note: "", flags: [], refused: null, area: "", choices: ["Move", "Reword and move", "Leave in the log"] },
  { id: "w-area", type: "area", text: "Activities", name: "Activities", paths: ["src/web-console/public/activities/**"], why: "Paths: src/web-console/public/activities/**", origin: "", note: "Noted on feature/x.", flags: [], refused: null, area: "Activities", choices: ["Create", "Rename", "Drop"] },
];
const CARD = (rows = ROWS, extra = {}) => ({
  id: "lessons",
  kind: "lessons",
  title: "Lessons to keep",
  body: "Choose for each one. Nothing is kept unless you choose it, and anything you leave keeps waiting.",
  opening: null,
  rows,
  ...extra,
});

async function lessonsCard(t, card = CARD()) {
  const s = await openSession(await suite.browser(), { t, workflow: "review", payload: { items: [card], agent: { status: "waiting" } } });
  const c = itemCard(s.page, card.id);
  await c.locator(card.firstAsk ? ".lessons-first-lesson" : ".lessons-row").first().waitFor();
  await settled(s.page, "#main");
  return { s, card: c };
}

const rowOf = (card, id) => card.locator(`.lessons-row[data-row="${id}"]`);
const choicesOf = (row) => row.locator(".lessons-choices button");
const replyLines = (got) => got.reply.split("\n").map((l) => l.trim());

test("lessons card: each row shows its own choice words, and nothing is chosen", async (t) => {
  const { card } = await lessonsCard(t);
  const want = {
    "w-lesson": ["Keep", "Reword", "Drop"],
    "w-doubt": ["Keep", "Reword", "Retire"],
    "w-fix": ["Apply", "Reword", "Drop"],
    "log:abc": ["Move", "Reword and move", "Leave in the log"],
    "w-area": ["Create", "Rename", "Drop"],
  };
  for (const [id, words] of Object.entries(want)) {
    const row = rowOf(card, id);
    assert.deepEqual(await choicesOf(row).allInnerTexts(), words, id);
    assert.deepEqual(await choicesOf(row).evaluateAll((bs) => bs.map((b) => b.getAttribute("aria-pressed"))), words.map(() => "false"), `${id}: nothing chosen`);
    assert.equal(await row.locator(".lessons-choices").getAttribute("role"), "group", `${id}: its choices are a group`);
  }
  const doubt = await textOf(rowOf(card, "w-doubt"));
  assert.match(doubt, /This lesson may no longer be true:/);
  assert.match(doubt, /It now does three\./);
  assert.match(await textOf(rowOf(card, "w-fix")), /Before\s+Run npm test\.\s+After\s+Run the targeted suites\./i);
  assert.match(await textOf(rowOf(card, "log:abc")), /It would become this lesson:\s+Run npm run fix:eol for line endings\./);
  assert.match(await textOf(rowOf(card, "w-lesson")), /You said this\./);
  assert.match(await textOf(rowOf(card, "w-area")), /Noted on feature\/x\./);
});

test("lessons card: a tidy row shows the change, the lessons it replaces and its reason, and Reword edits the new wording", async (t) => {
  const merge = { id: "w-merge", type: "tidy", change: "merge", text: "Merge 2 lessons into: Keep modules small and kebab-case their files.", why: "They say the same thing twice.", origin: "", note: "", flags: [], refused: null, area: "Source", areas: ["General", "Source"], targets: [{ id: "source/keep-modules-small", text: "Keep modules small", area: "Source" }, { id: "source/name-files-in-kebab-case", text: "Name files in kebab case", area: "Source" }], wording: "Keep modules small and kebab-case their files.", wordingWhy: "Both keep the tree easy to scan.", choices: ["Apply", "Reword", "Leave"] };
  const retire = { id: "w-retire", type: "tidy", change: "retire", text: "Retire: Draw the page from state Reason: Git marks it.", why: "", origin: "", note: "", flags: [], refused: null, area: "", areas: ["General", "Source"], targets: [{ id: "web/draw-the-page-from-state", text: "Draw the page from state", area: "Web" }], choices: ["Apply", "Leave"] };
  const { s, card } = await lessonsCard(t, CARD([merge, retire]));
  assert.deepEqual(await choicesOf(rowOf(card, "w-merge")).allInnerTexts(), ["Apply", "Reword", "Leave"]);
  assert.deepEqual(await choicesOf(rowOf(card, "w-retire")).allInnerTexts(), ["Apply", "Leave"], "no Reword where there is no wording");
  const text = await textOf(rowOf(card, "w-merge"));
  assert.match(text, /Merge 2 lessons into: Keep modules small and kebab-case their files\./);
  assert.match(text, /It replaces these lessons:\s+Keep modules small\s+Name files in kebab case/);
  assert.match(text, /Why: They say the same thing twice\./);
  assert.match(await textOf(rowOf(card, "w-retire")), /Retire: Draw the page from state Reason: Git marks it\./);
  // Reword opens on the new wording and its own Why, not on the sentence describing the change.
  await rowOf(card, "w-merge").getByRole("button", { name: "Reword" }).click();
  const words = rowOf(card, "w-merge").getByLabel("The lesson");
  assert.equal(await words.inputValue(), "Keep modules small and kebab-case their files.");
  assert.equal(await rowOf(card, "w-merge").getByLabel("Why").inputValue(), "Both keep the tree easy to scan.");
  await words.fill("Keep modules small and name their files in kebab case.");
  await rowOf(card, "w-retire").getByRole("button", { name: "Apply" }).click();
  const got = await sendAndCollect(s);
  const decisions = got.actions.find((a) => a.i === "lessons").decisions;
  assert.deepEqual(decisions, [{ id: "w-merge", choice: "Reword", text: "Keep modules small and name their files in kebab case.", why: "Both keep the tree easy to scan." }, { id: "w-retire", choice: "Apply" }]);
});

test("lessons card: Keep on one row sends only that row, and the rest are left waiting", async (t) => {
  const { s, card } = await lessonsCard(t);
  await rowOf(card, "w-lesson").getByRole("button", { name: "Keep" }).click();
  await card.locator(".lessons-summary", { hasText: "1 chosen, 4 left waiting." }).waitFor();
  assert.equal(await rowOf(card, "w-lesson").getByRole("button", { name: "Keep" }).getAttribute("aria-pressed"), "true");
  const got = await sendAndCollect(s);
  assert.deepEqual(got.actions.find((a) => a.i === "lessons").decisions, [{ id: "w-lesson", choice: "Keep" }]);
  assert.ok(replyLines(got).includes("Keep: Run a page test alone first."), got.reply);
  assert.match(got.reply, /1 decided, 4 left waiting/);
  await itemCard(s.page, "lessons").locator(".answered-values", { hasText: "4 left waiting" }).waitFor();
});

test("lessons card: a choice keeps the keyboard on its button, and a note typed beside a Reword goes with the answer", async (t) => {
  const { s, card } = await lessonsCard(t);
  const keep = rowOf(card, "w-doubt").getByRole("button", { name: "Keep" });
  await keep.focus();
  await s.page.keyboard.press("Enter");
  await rowOf(card, "w-doubt").getByRole("button", { name: "Keep", pressed: true }).waitFor();
  assert.equal(await s.page.evaluate(() => document.activeElement && document.activeElement.textContent), "Keep", "focus stays on the pressed choice");
  await s.page.keyboard.press("Tab");
  assert.equal(await s.page.evaluate(() => document.activeElement && document.activeElement.textContent), "Reword", "Tab moves on within the row");

  await rowOf(card, "w-lesson").getByRole("button", { name: "Reword" }).click();
  const text = rowOf(card, "w-lesson").getByLabel("The lesson");
  await text.waitFor();
  const note = card.locator(".md-host .cm-content").last();
  await note.click();
  await note.pressSequentially("Checked with the team.");
  await text.fill("");
  await text.fill("Run one page test file alone.");
  const got = await sendAndCollect(s);
  const action = got.actions.find((a) => a.i === "lessons");
  assert.equal(action.text, "Checked with the team.", "the note survived the emptied field");
  assert.equal(action.decisions.find((d) => d.id === "w-lesson").text, "Run one page test file alone.");
});

test("lessons card: choosing again clears a row, and Leave them all waiting sends nothing chosen", async (t) => {
  const { s, card } = await lessonsCard(t);
  await rowOf(card, "w-lesson").getByRole("button", { name: "Keep" }).click();
  await rowOf(card, "w-lesson").getByRole("button", { name: "Keep", pressed: true }).waitFor();
  await rowOf(card, "w-lesson").getByRole("button", { name: "Keep" }).click();
  await rowOf(card, "w-lesson").getByRole("button", { name: "Keep", pressed: false }).waitFor();
  await card.getByRole("button", { name: "Leave them all waiting" }).click();
  await card.getByRole("button", { name: "Leave them all waiting", pressed: true }).waitFor();
  const got = await sendAndCollect(s);
  assert.deepEqual(got.actions.find((a) => a.i === "lessons").decisions, []);
  assert.match(got.reply, /0 decided, 5 left waiting/);
});

test("lessons card: Reword edits the sentence and the area, and the answer carries them", async (t) => {
  const { s, card } = await lessonsCard(t);
  await rowOf(card, "w-lesson").getByRole("button", { name: "Reword" }).click();
  const edit = rowOf(card, "w-lesson").locator(".lessons-edit");
  await edit.waitFor();
  const text = edit.getByLabel("The lesson");
  assert.equal(await text.inputValue(), "Run a page test alone first.", "it opens on the row's own words");
  await text.fill("");
  await card.locator(".lessons-error", { hasText: "The lesson is empty" }).waitFor();
  assert.equal(await s.page.locator("#btn-send").isDisabled(), true, "an empty lesson keeps Send off");
  await text.fill("Run one page test file alone before the full run.");
  await edit.getByLabel("Saved in").selectOption("Web console");
  assert.equal(await card.locator(".lessons-error").isHidden(), true);
  const got = await sendAndCollect(s);
  assert.deepEqual(got.actions.find((a) => a.i === "lessons").decisions, [
    { id: "w-lesson", choice: "Reword", text: "Run one page test file alone before the full run.", why: "A full run hides the race.", area: "Web console" },
  ]);
  assert.ok(replyLines(got).includes("Reword: Run one page test file alone before the full run."), got.reply);
});

test("lessons card: a refused row's Keep stays off until Reword changes its words", async (t) => {
  const refusedRow = { ...ROWS[0], id: "w-bad", text: "The key is AKIA…", refused: { pattern: "aws-access-key", part: "AKIA" }, choices: ["Reword", "Drop"] };
  const { s, card } = await lessonsCard(t, CARD([refusedRow]));
  const row = rowOf(card, "w-bad");
  assert.match(await textOf(row), /Refused: part of it looks like a secret \(it starts “AKIA”\)/);
  assert.equal(await row.getByRole("button", { name: "Keep" }).isDisabled(), true);
  await row.getByRole("button", { name: "Reword" }).click();
  const text = row.getByLabel("The lesson");
  await text.waitFor();
  assert.equal(await row.getByRole("button", { name: "Keep" }).isDisabled(), true, "unchanged words keep it off");
  await text.fill("Keys live in the team vault, never in the code.");
  await until(async () => !(await row.getByRole("button", { name: "Keep" }).isDisabled()), 3000);
  await row.getByRole("button", { name: "Keep" }).click();
  await row.getByRole("button", { name: "Keep", pressed: true }).waitFor();
  const got = await sendAndCollect(s);
  assert.deepEqual(got.actions.find((a) => a.i === "lessons").decisions, [
    { id: "w-bad", choice: "Reword", text: "Keys live in the team vault, never in the code.", why: "A full run hides the race." },
  ]);
});

test("lessons card: a refused row's Keep still chooses after its words go back and are reworded again", async (t) => {
  const refusedRow = { ...ROWS[0], id: "w-bad", text: "The key is AKIA…", refused: { pattern: "aws-access-key", part: "AKIA" }, choices: ["Reword", "Drop"] };
  const { s, card } = await lessonsCard(t, CARD([refusedRow]));
  const row = rowOf(card, "w-bad");
  const keep = () => row.getByRole("button", { name: "Keep" });
  await row.getByRole("button", { name: "Reword" }).click();
  const text = row.getByLabel("The lesson");
  await text.waitFor();
  await text.fill("Keys live in the team vault.");
  await until(async () => !(await keep().isDisabled()), 3000);
  await keep().click();
  await row.getByRole("button", { name: "Keep", pressed: true }).waitFor();
  // Back to the refused words: Keep cannot stand, and the row goes back to Reword without a redraw.
  await text.fill("The key is AKIA…");
  await row.getByRole("button", { name: "Reword", pressed: true }).waitFor();
  assert.equal(await keep().isDisabled(), true);
  await text.fill("Keys live in the team vault, never in the code.");
  await until(async () => !(await keep().isDisabled()), 3000);
  await keep().click();
  await row.getByRole("button", { name: "Keep", pressed: true }).waitFor();
  assert.equal(await row.getByLabel("The lesson").count(), 1, "the row stays open, chosen");
  const got = await sendAndCollect(s);
  assert.deepEqual(got.actions.find((a) => a.i === "lessons").decisions, [
    { id: "w-bad", choice: "Reword", text: "Keys live in the team vault, never in the code.", why: "A full run hides the race." },
  ]);
});

const CHECKED_ROWS = [
  { ...ROWS[0], id: "c-fail", text: "Never run the full suite.", check: { fails: [{ test: "Search", reason: "It matches 3 files." }], doubts: [], passed: 3 } },
  { ...ROWS[0], id: "c-doubt", text: "The handler is small.", tag: "Checked in an earlier run", check: { fails: [], doubts: [{ test: "Why", reason: "The reason repeats the lesson." }], passed: 3 } },
  { ...ROWS[0], id: "c-pass", text: "Use the helper.", check: { fails: [], doubts: [], passed: 4 } },
  { ...ROWS[0], id: "c-none", text: "Not looked at.", tag: "Not checked yet" },
  { ...ROWS[0], id: "c-all", text: "Every test flagged.", check: { fails: [{ test: "Search", reason: "No match." }, { test: "Worth", reason: "Already in AGENTS.md." }], doubts: [{ test: "Why", reason: "Thin." }, { test: "Clear", reason: "Vague." }], passed: 0 } },
];

test("lessons card: a Fail, a Doubt and a pass show their lines, and the outline follows suggested without choosing", async (t) => {
  const { card } = await lessonsCard(t, CARD(CHECKED_ROWS, { suggested: { "c-fail": "Drop", "c-pass": "Keep" }, checked: { how: "helper", count: 4, seconds: 40 } }));
  const fail = rowOf(card, "c-fail");
  assert.match(await textOf(fail.locator(".lesson-check.fail")), /^Fail Search: It matches 3 files\.$/);
  assert.equal(await fail.locator(".lesson-check.doubt").count(), 0);
  assert.match(await textOf(fail.locator(".lesson-check-pass")), /^Passed the other 3$/);
  const doubt = rowOf(card, "c-doubt");
  assert.match(await textOf(doubt.locator(".lesson-check.doubt")), /^Doubt Why: The reason repeats the lesson\.$/);
  assert.equal(await doubt.locator(".lesson-check.fail").count(), 0);
  assert.match(await textOf(doubt.locator(".lessons-tag")), /^Checked in an earlier run$/);
  const pass = rowOf(card, "c-pass");
  assert.equal(await pass.locator(".lesson-check.fail, .lesson-check.doubt").count(), 0, "a pass lists no verdicts");
  assert.match(await textOf(pass.locator(".lesson-check-pass")), /^Passed the check$/);
  const none = rowOf(card, "c-none");
  assert.equal(await none.locator(".lesson-checks").count(), 0, "a row never checked draws nothing");
  assert.match(await textOf(none.locator(".lessons-tag")), /^Not checked yet$/);
  const all = rowOf(card, "c-all");
  assert.equal(await all.locator(".lesson-check.fail, .lesson-check.doubt").count(), 4);
  assert.equal(await all.locator(".lesson-check-pass").count(), 0, "no pass line when nothing passed");
  const outlined = async (row) => row.locator(".lessons-choices button.is-suggested").allInnerTexts();
  assert.deepEqual(await outlined(fail), ["Drop"]);
  assert.deepEqual(await outlined(doubt), [], "a Doubt outlines nothing");
  assert.deepEqual(await outlined(pass), ["Keep"]);
  assert.equal(await card.locator('.lessons-choices [aria-pressed="true"]').count(), 0, "nothing is chosen for the person");
  assert.notEqual(await styleOf(fail.locator(".lesson-check.fail"), "color"), await styleOf(pass.locator(".lesson-check-pass"), "color"), "a Fail is not drawn like the quiet pass line");
  const px = async (loc) => parseFloat(await styleOf(loc, "fontSize"));
  assert.ok((await px(pass.locator(".lesson-check-pass"))) < (await px(fail.locator(".lesson-check.fail"))), "the pass line is smaller than a verdict line");
  assert.match(await textOf(card.locator(".lessons-checked")), /^Checked 4 lessons in 40 seconds by a fresh helper that could only read$/);
});

test("lessons card: the how-checked line names the same agent, or why the check could not run", async (t) => {
  const same = await lessonsCard(t, CARD(CHECKED_ROWS.slice(2, 3), { checked: { how: "same-agent", count: 1, seconds: 1 } }));
  assert.match(await textOf(same.card.locator(".lessons-checked")), /^Checked 1 lesson in 1 second by the same agent that noted them$/);
  const failed = await lessonsCard(t, CARD(CHECKED_ROWS.slice(3, 4), { checked: { failed: "the checker answered with nothing usable." } }));
  assert.match(await textOf(failed.card.locator(".lessons-checked")), /^The check could not run: the checker answered with nothing usable\.$/);
  const bare = await lessonsCard(t, CARD(CHECKED_ROWS.slice(3, 4)));
  assert.equal(await bare.card.locator(".lessons-checked").count(), 0, "no line without a check");
});

test("lessons card: Use this wording opens Reword filled with the suggestion, and what is sent is a normal Reword", async (t) => {
  const row = { ...ROWS[0], id: "c-sug", check: { fails: [], doubts: [{ test: "Search", reason: "Two files match." }], passed: 3, suggestion: "Run one page test file alone first." } };
  const { s, card } = await lessonsCard(t, CARD([row]));
  const li = rowOf(card, "c-sug");
  assert.match(await textOf(li.locator(".lesson-suggestion")), /^Suggested wording: Run one page test file alone first\./);
  await li.getByRole("button", { name: "Use this wording" }).click();
  const edit = li.locator(".lessons-edit");
  await edit.waitFor();
  assert.equal(await li.getByRole("button", { name: "Reword" }).getAttribute("aria-pressed"), "true");
  const text = edit.getByLabel("The lesson");
  assert.equal(await text.inputValue(), "Run one page test file alone first.", "it opens on the suggestion, not the row's own words");
  await text.fill("Run one page test file alone first, then the rest.");
  const got = await sendAndCollect(s);
  assert.deepEqual(got.actions.find((a) => a.i === "lessons").decisions, [
    { id: "c-sug", choice: "Reword", text: "Run one page test file alone first, then the rest.", why: "A full run hides the race." },
  ]);
});

test("lessons card: a flagged row says what was flagged", async (t) => {
  const flagged = { ...ROWS[0], id: "w-flag", flags: [{ pattern: "email", part: "a@b.c" }] };
  const { card } = await lessonsCard(t, CARD([flagged]));
  const flag = rowOf(card, "w-flag").locator(".lessons-flag");
  assert.equal(await textOf(flag), "Holds what looks like an email address (“a@b.c”). Keep only if that is intended.");
  assert.notEqual(await styleOf(flag, "background-color"), "rgba(0, 0, 0, 0)", "the warning stands out from the row");
});

test("lessons card: the first ask shows the lesson before what Learning is, and answers yes", async (t) => {
  const firstAsk = {
    lesson: { id: "w1", text: "Run a page test alone first.", why: "A full run hides the race.", kind: "command" },
    sentences: ["Plan2Code can keep lessons like this with the repository.", "Nothing is saved without your approval.", "Lessons are about the code, never about you."],
    yes: "Switch Learning on",
    no: "Not for this project",
    later: "You can change this later on the dashboard.",
  };
  const { s, card } = await lessonsCard(t, { id: "first-ask", kind: "lessons", title: "Keep lessons?", firstAsk });
  const order = await card.evaluate((c) => {
    const all = [...c.querySelectorAll("*")];
    return { lesson: all.indexOf(c.querySelector(".lessons-first-lesson")), about: all.indexOf(c.querySelector(".lessons-first-about")) };
  });
  assert.ok(order.lesson >= 0 && order.lesson < order.about, `the lesson comes first: ${JSON.stringify(order)}`);
  assert.equal(await card.locator(".lessons-row").count(), 0, "no rows yet");
  assert.match(await textOf(card), /You can change this later on the dashboard\./);
  await card.getByRole("button", { name: "Switch Learning on" }).click();
  await card.getByRole("button", { name: "Switch Learning on", pressed: true }).waitFor();
  const got = await sendAndCollect(s);
  assert.equal(got.actions.find((a) => a.i === "first-ask").firstAsk, "yes");
  assert.match(got.reply, /Keep lessons\?: Switch Learning on/);
});

test("lessons card: Review on the banner leads to the card over the dashboard, with no skill launched", async (t) => {
  const { s, main } = await dashboard(t, PROJECT("on"), (p) =>
    writeWaiting(p, { id: "20261113-120000-ffffff", type: "lesson", text: "Run a page test alone first.", noted: new Date().toISOString() })
  );
  await main.locator(".learn-banner").getByRole("button", { name: "Review" }).click();
  const got = s.wait(10);
  assert.deepEqual(got.actions, [{ i: "__learning", type: "learning", do: "review" }]);
  // The dashboard agent posts the card from lessons.mjs list, still as the dashboard.
  s.post({ items: [CARD([{ ...ROWS[0], id: "20261113-120000-ffffff" }])], agent: { status: "waiting" } });
  const dlg = s.page.locator("#lessons-modal");
  await dlg.locator(".lessons-row").waitFor();
  assert.equal(await main.getByRole("heading", { name: "What are we doing today?" }).count(), 1, "the menu stays under it");
  assert.equal(await dlg.getByRole("button", { name: "Save lessons" }).isDisabled(), true, "nothing chosen yet");
  // An emptied Reword field holds the dialog's Send off, as the footer's Send is held elsewhere.
  await dlg.getByRole("button", { name: "Reword" }).click();
  const text = dlg.getByLabel("The lesson");
  await text.waitFor();
  assert.equal(await dlg.getByRole("button", { name: "Save lessons" }).isDisabled(), false, "a reword ready to go");
  await text.fill("");
  await until(async () => await dlg.getByRole("button", { name: "Save lessons" }).isDisabled(), 3000);
  await dlg.getByRole("button", { name: "Keep" }).click();
  await dlg.getByRole("button", { name: "Keep", pressed: true }).waitFor();
  await dlg.getByRole("button", { name: "Save lessons" }).click();
  const sent = s.wait(10);
  assert.equal(sent.code, 0);
  assert.equal(sent.actions.some((a) => a.i === "__launch"), false, "no skill launched");
  assert.deepEqual(sent.actions.find((a) => a.i === "lessons").decisions, [{ id: "20261113-120000-ffffff", choice: "Keep" }]);
  await dlg.waitFor({ state: "hidden" });
  // The agent runs decide and posts the menu back, waiting again: the answered card stays closed.
  s.post({ menu: { note: "Kept 1 lesson." }, agent: { status: "waiting" } });
  await main.getByText("Kept 1 lesson.").waitFor();
  assert.equal(await dlg.isVisible(), false, "the answered card does not open again");
});

// The dashboard with one lesson waiting, Review pressed and the agent's card up.
const LESSON_ID = "20261113-120000-eeeeee";
async function reviewOpen(t) {
  const { s, main } = await dashboard(t, PROJECT("on"), (p) =>
    writeWaiting(p, { id: LESSON_ID, type: "lesson", text: "Run a page test alone first.", noted: new Date().toISOString() })
  );
  await main.locator(".learn-banner").getByRole("button", { name: "Review" }).click();
  return { s, main, dlg: s.page.locator("#lessons-modal") };
}
const postCard = (s) => s.post({ items: [CARD([{ ...ROWS[0], id: LESSON_ID }])], agent: { status: "waiting" } });

test("lessons card: Review shows working at once, and ends when the card opens", async (t) => {
  const { s, main, dlg } = await reviewOpen(t);
  const banner = main.locator(".learn-banner");
  await banner.getByText("Opening lessons…").waitFor();
  assert.equal(await banner.getAttribute("aria-busy"), "true");
  assert.equal(await banner.getByRole("button", { name: "Review" }).isDisabled(), true, "no second press while it opens");
  s.wait(10);
  postCard(s);
  await dlg.locator(".lessons-row").waitFor();
  assert.equal(await banner.getByText("Opening lessons…").count(), 0, "the spinner is gone once the card is up");
});

test("lessons card: Review with nothing to show says so instead of spinning", async (t) => {
  const { s, main } = await reviewOpen(t);
  await main.locator(".learn-banner").getByText("Opening lessons…").waitFor();
  s.wait(10);
  s.post({ menu: { note: "Nothing is waiting." }, agent: { status: "working" } });
  s.post({ agent: { status: "waiting" } });
  await s.page.getByText("No lessons are waiting any more.").waitFor();
  assert.equal(await main.locator(".learn-banner").getByText("Opening lessons…").count(), 0);
});

test("lessons card: Not now and the corner close leave every lesson waiting and tell the agent", async (t) => {
  for (const how of ["Not now", "x", "Escape"]) {
    const { s, dlg } = await reviewOpen(t);
    s.wait(10);
    postCard(s);
    await dlg.locator(".lessons-row").waitFor();
    assert.equal(await dlg.getByRole("button", { name: "Close without saving" }).count(), 1, "a corner close is there");
    if (how === "Not now") await dlg.getByRole("button", { name: "Not now" }).click();
    else if (how === "x") await dlg.getByRole("button", { name: "Close without saving" }).click();
    else await s.page.keyboard.press("Escape");
    const sent = s.wait(10);
    assert.equal(sent.code, 0, how);
    assert.deepEqual(sent.actions.find((a) => a.i === "lessons").decisions, [], `${how}: nothing decided`);
    await dlg.waitFor({ state: "hidden" });
  }
});

test("lessons card: the dialog has Ask for suggestions, which sends one request and shows the reply in a Suggestions box", async (t) => {
  const { s, dlg } = await reviewOpen(t);
  s.wait(10);
  postCard(s);
  await dlg.locator(".lessons-row").waitFor();
  const ask = dlg.getByRole("button", { name: "Ask for suggestions" });
  assert.equal(await ask.isDisabled(), false);
  assert.equal(await dlg.locator(".lessons-suggestions").count(), 0, "nothing asked yet");
  await ask.click();
  const got = s.wait(10);
  assert.equal(got.code, 0);
  const sentAction = got.actions.find((a) => a.suggest === true);
  assert.ok(sentAction, JSON.stringify(got.actions));
  assert.equal(sentAction.i, "lessons");
  assert.match(got.reply, /^Suggestions wanted on Lessons to keep:/m);
  await dlg.locator(".lessons-suggestions", { hasText: "Asking Plan2Code" }).waitFor();
  assert.equal(await dlg.getByRole("button", { name: "Asking…" }).isDisabled(), true, "one request waits at a time");
  assert.equal(await dlg.getByRole("button", { name: "Keep" }).count(), 1, "the lessons stay open to choose");
  s.post({ items: [{ id: "lessons", thread: [{ who: "agent", text: "1. Keep it: a real trap." }] }], agent: { status: "waiting" } });
  await dlg.locator(".lessons-suggestions", { hasText: "Keep it: a real trap." }).waitFor();
});

test("lessons card: Ask for suggestions spins until the reply lands, and the reply is as wide as its box", async (t) => {
  const { s, dlg } = await reviewOpen(t);
  s.wait(10);
  postCard(s);
  await dlg.locator(".lessons-row").waitFor();
  await dlg.getByRole("button", { name: "Ask for suggestions" }).click();
  s.wait(10);
  await dlg.locator("#lessons-suggest .spinner").waitFor();
  await dlg.locator(".lessons-suggestions .spinner").waitFor();
  const long = "My suggestion is Keep. " + "It is a real trap that a full run hides, and the docs never say so. ".repeat(6);
  s.post({ items: [{ id: "lessons", thread: [{ who: "agent", text: long }] }], agent: { status: "waiting" } });
  const reply = dlg.locator(".lessons-suggestions .md");
  await reply.waitFor();
  assert.equal(await dlg.locator(".spinner").count(), 0, "no spinner once the reply is in");
  const box = await dlg.locator(".lessons-suggestions").boundingBox();
  const text = await reply.boundingBox();
  assert.ok(text.width > box.width * 0.85, `the reply fills its box: ${text.width} of ${box.width}`);
});

test("lessons card: the dialog's buttons stay in view while the lessons scroll", async (t) => {
  const { s, dlg } = await reviewOpen(t);
  s.wait(10);
  const rows = Array.from({ length: 10 }, (_, i) => ({ ...ROWS[0], id: `${LESSON_ID}-${i}`, text: `Lesson number ${i + 1}, long enough to take a line.` }));
  s.post({ items: [CARD(rows)], agent: { status: "waiting" } });
  await dlg.locator(".lessons-row").first().waitFor();
  const overflows = await dlg.evaluate((d) => d.scrollHeight > d.clientHeight + 40);
  assert.ok(overflows, "the dialog scrolls with ten lessons");
  for (const top of [0, 300]) {
    await scrollCard(dlg, top);
    const frame = await dlg.boundingBox();
    const ask = await dlg.getByRole("button", { name: "Ask for suggestions" }).boundingBox();
    assert.ok(ask.y >= frame.y && ask.y + ask.height <= frame.y + frame.height + 1, `scrolled to ${top}: Ask for suggestions is in view`);
    const bar = await dlg.locator(":scope > .modal-actions").boundingBox();
    assert.ok(bar.y + bar.height >= frame.y + frame.height - 2, `scrolled to ${top}: the bar reaches the dialog's bottom edge, with nothing showing under it`);
  }
  // A reply is scrolled into view once; a later state push leaves the scroll where the person put it.
  await dlg.getByRole("button", { name: "Ask for suggestions" }).click();
  s.wait(10);
  s.post({ items: [{ id: "lessons", thread: [{ who: "agent", text: "Keep them all." }] }], agent: { status: "waiting" } });
  await dlg.locator(".lessons-suggestions", { hasText: "Keep them all." }).waitFor();
  await until(async () => (await dlg.evaluate((d) => d.scrollTop)) > 0, 3000);
  await scrollCard(dlg, 0);
  s.post({ agent: { status: "waiting", activity: "Still here" } });
  s.post({ headline: { stage: "Reviewing lessons" }, agent: { status: "waiting" } });
  await settled(s.page, "#lessons-modal");
  assert.equal(await dlg.evaluate((d) => d.scrollTop), 0, "no pull back down to the reply");
});

test("lessons card: a suggestion outlines its button on each lesson without choosing it", async (t) => {
  const { s, dlg } = await reviewOpen(t);
  s.wait(10);
  const second = `${LESSON_ID}-b`;
  s.post({ items: [CARD([{ ...ROWS[0], id: LESSON_ID }, { ...ROWS[0], id: second, text: "Another lesson." }])], agent: { status: "waiting" } });
  await dlg.locator(".lessons-row").first().waitFor();
  await dlg.getByRole("button", { name: "Ask for suggestions" }).click();
  s.wait(10);
  s.post({ items: [{ id: "lessons", suggested: { [LESSON_ID]: "Keep", [second]: "Drop" }, thread: [{ who: "agent", text: "Keep the first, drop the second." }] }], agent: { status: "waiting" } });
  await dlg.locator(".lessons-suggestions", { hasText: "Keep the first" }).waitFor();
  const keep = dlg.locator(`.lessons-row[data-row="${LESSON_ID}"] .lessons-choices button`, { hasText: "Keep" });
  const drop = dlg.locator(`.lessons-row[data-row="${second}"] .lessons-choices button`, { hasText: "Drop" });
  for (const b of [keep, drop]) {
    await b.and(s.page.locator(".is-suggested")).waitFor();
    assert.equal(await b.getAttribute("aria-pressed"), "false", "a suggestion is not a choice");
    assert.notEqual(await styleOf(b, "outlineStyle"), "none", "outlined");
    assert.match(await b.getAttribute("title"), /Suggested/);
  }
  assert.equal(await dlg.locator(".lessons-choices .is-suggested").count(), 2, "only the suggested buttons");
  assert.equal(await dlg.getByRole("button", { name: "Save lessons" }).isDisabled(), true, "nothing chosen for the person");
  // Keyboard focus on a suggested button shows the solid focus ring, not the dashed hint.
  await dlg.locator(`.lessons-row[data-row="${second}"] .lessons-choices button`, { hasText: "Reword" }).focus();
  await s.page.keyboard.press("Tab");
  await drop.and(s.page.locator(":focus")).waitFor();
  assert.equal(await styleOf(drop, "outlineStyle"), "solid", "focused: the focus ring");
  // Choosing the suggestion keeps the mark.
  await keep.click();
  await dlg.locator(`.lessons-row[data-row="${LESSON_ID}"] button.is-suggested[aria-pressed="true"]`).waitFor();
});

test("lessons card: closing with choices made asks first, and Keep editing goes back", async (t) => {
  const { s, dlg } = await reviewOpen(t);
  s.wait(10);
  postCard(s);
  await dlg.getByRole("button", { name: "Keep" }).click();
  await dlg.getByRole("button", { name: "Keep", pressed: true }).waitFor();
  await s.page.keyboard.press("Escape");
  const ask = dlg.locator(".lessons-unsaved");
  await ask.waitFor();
  assert.match(await textOf(ask), /You have choices that are not saved\./);
  await ask.getByRole("button", { name: "Keep editing" }).click();
  await ask.waitFor({ state: "hidden" });
  assert.equal(await dlg.isVisible(), true, "still open");
  assert.equal(await dlg.getByRole("button", { name: "Keep", pressed: true }).count(), 1, "the choice is kept");
  // Discard and close leaves everything waiting.
  await dlg.getByRole("button", { name: "Close without saving" }).click();
  await ask.getByRole("button", { name: "Discard and close" }).click();
  const sent = s.wait(10);
  assert.deepEqual(sent.actions.find((a) => a.i === "lessons").decisions, []);
  await dlg.waitFor({ state: "hidden" });
});

test("lessons card: Save lessons shows saving, locks the card, then the banner takes over until the agent is done", async (t) => {
  const { s, main, dlg } = await reviewOpen(t);
  s.wait(10);
  postCard(s);
  await dlg.getByRole("button", { name: "Keep" }).click();
  await dlg.getByRole("button", { name: "Keep", pressed: true }).waitFor();
  // Hold the send so the saving state can be seen.
  let release;
  const held = new Promise((r) => (release = r));
  await s.page.route("**/submit", async (route) => {
    await held;
    await route.continue();
  });
  await dlg.getByRole("button", { name: "Save lessons" }).click();
  await dlg.getByText("Saving…").waitFor();
  assert.equal(await dlg.getAttribute("aria-busy"), "true");
  assert.equal(await dlg.getByRole("button", { name: "Not now" }).isDisabled(), true);
  assert.equal(await dlg.getByRole("button", { name: "Close without saving" }).isDisabled(), true);
  release();
  await dlg.waitFor({ state: "hidden" });
  const sent = s.wait(10);
  assert.deepEqual(sent.actions.find((a) => a.i === "lessons").decisions, [{ id: LESSON_ID, choice: "Keep" }]);
  await main.locator(".learn-banner").getByText("Saving your lessons…").waitFor();
  s.post({ menu: { note: "Kept 1 lesson." }, agent: { status: "working" } });
  s.post({ agent: { status: "waiting" } });
  await main.getByText("Kept 1 lesson.").waitFor();
  await until(async () => (await main.getByText("Saving your lessons…").count()) === 0, 5000);
});

test("lessons card: a refused send keeps the dialog open with the choice still made", async (t) => {
  const { s, dlg } = await reviewOpen(t);
  s.wait(10);
  postCard(s);
  await dlg.getByRole("button", { name: "Keep" }).click();
  await dlg.getByRole("button", { name: "Keep", pressed: true }).waitFor();
  await s.page.route("**/submit", (route) => route.fulfill({ status: 409, contentType: "application/json", body: "{}" }));
  await dlg.getByRole("button", { name: "Save lessons" }).click();
  await until(async () => (await dlg.getByText("Saving…").count()) === 0, 5000);
  assert.equal(await dlg.isVisible(), true, "still open");
  assert.equal(await dlg.getByRole("button", { name: "Keep", pressed: true }).count(), 1, "the choice is kept");
});

test("lessons card: Not now carries a typed note, and a click outside closes only while nothing is chosen", async (t) => {
  const { s, dlg } = await reviewOpen(t);
  s.wait(10);
  postCard(s);
  await dlg.locator(".lessons-row").waitFor();
  // Outside click with a choice made: stays open.
  await dlg.getByRole("button", { name: "Keep" }).click();
  await dlg.getByRole("button", { name: "Keep", pressed: true }).waitFor();
  await s.page.mouse.click(5, 5);
  assert.equal(await dlg.isVisible(), true, "a stray click keeps the dialog while a choice is made");
  await dlg.getByRole("button", { name: "Keep", pressed: true }).click();
  await dlg.getByRole("button", { name: "Keep" }).first().waitFor();
  await dlg.getByLabel("Anything to add?").fill("Ask me again next week.");
  await dlg.getByRole("button", { name: "Not now" }).click();
  const sent = s.wait(10);
  assert.match(sent.reply, /Ask me again next week\./);
  assert.deepEqual(sent.actions.find((a) => a.i === "lessons").decisions, []);
});

test("the loop stop card says when lessons are waiting", async (t) => {
  const project = tempProject(PROJECT("on"));
  writeWaiting(project, { id: "20261113-120000-999999", type: "lesson", text: "Waits.", noted: new Date().toISOString() });
  const s = await openSession(await suite.browser(), {
    t,
    workflow: "implement",
    open: ["--loop"],
    env: { PLAN2CODE_IN_APP: "1" },
    payload: { title: "demo: Phase 1", headline: { stage: "Build", cleared: 1, total: 2 }, agent: { status: "working", activity: "Task 2 of 2" } },
    project,
  });
  s.post({ loopEnd: { kind: "stopped", line: "Phase 2 stopped", phases: [], uncommitted: [], can: ["dashboard"] }, agent: { status: "waiting" } });
  const line = s.page.locator(".loop-end .loop-lessons");
  await line.waitFor();
  assert.equal(await textOf(line), "1 lesson is waiting for your review. Open the dashboard to review them.");
});
