// Page tests for User Preferences: the saved looks (highlight and theme), the
// launcher's model menus and the Cleanup tab. Run with:
// node --test scripts/test-web-console-page-prefs.mjs
//
// Each test drives the real console in a real Chrome or Edge through
// scripts/page-test-helpers.mjs: one browser for the file, a fresh console
// session per test.

import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { pageSuite, openSession, textOf, drawn } from "./page-test-helpers.mjs";
import { HOME, MODELS_DIR, backdate } from "./web-console-test-helpers.mjs";
import { formatBytes } from "../src/web-console/public/answers.js";

const suite = pageSuite(test);

// A plan session on the person's turn: one text question and the agent listening.
const PLAN_QUESTION = {
  items: [{ id: "q1", kind: "text", title: "What to call it", body: "A short name for the export." }],
  agent: { status: "waiting" },
};

// The console home's saved looks are shared by every session of this file, so
// each test starts with none and leaves none.
const LOOKS_FILE = path.join(HOME, "looks.json");
function noSavedLooks(t) {
  fs.rmSync(LOOKS_FILE, { force: true });
  t.after(() => fs.rmSync(LOOKS_FILE, { force: true }));
}

const root = (s, attr) => s.page.evaluate((a) => document.documentElement.getAttribute(a), attr);
// The highlight the page paints with: an inline override while it is not the default.
const accentVar = (s) => s.page.evaluate(() => document.documentElement.style.getPropertyValue("--accent"));
const swatch = (s, id) => s.page.locator(`#looks-swatches [data-accent="${id}"]`);

// The page as the server first sends it, before any script has run: the saved
// theme and highlight are in the markup so a reload never flashes the defaults.
async function firstPaintAttrs(s) {
  const html = await (await s.context.request.get(s.url)).text();
  const tag = html.match(/<html\b[^>]*>/i)[0];
  return { theme: tag.match(/data-theme="([^"]*)"/)?.[1] ?? null, accent: tag.match(/data-looks-accent="([^"]*)"/)?.[1] ?? null };
}

test("the violet highlight and dark theme chosen in preferences stick across a reload, and Back to default clears them", async (t) => {
  noSavedLooks(t);
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  assert.equal(await root(s, "data-theme"), null, "the theme starts on the system's");
  await s.page.click("#btn-looks");
  await s.page.locator("#looks-modal[open]").waitFor();
  await swatch(s, "violet").click();
  await s.page.locator('input[name="looks-theme"][value="dark"]').check();
  await s.page.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "dark");
  assert.equal(await swatch(s, "violet").getAttribute("aria-pressed"), "true");
  assert.equal(await accentVar(s), "#a785e2", "the dark violet is painted");
  // Saved on the server (looks.json), not only in this tab.
  await s.page.waitForFunction(async () => {
    const saved = (await (await fetch("/looks")).json()).looks || {};
    return saved.accent === "violet" && saved.theme === "dark";
  });
  await s.page.click("#looks-done");

  // What the server sends first, and what the page settles on, both keep the choice.
  assert.deepEqual(await firstPaintAttrs(s), { theme: "dark", accent: "violet" }, "the first paint carries the saved looks");
  await s.page.reload({ waitUntil: "domcontentloaded" });
  await drawn(s.page);
  assert.equal(await root(s, "data-theme"), "dark", "the theme did not stick");
  await s.page.waitForFunction(() => document.documentElement.style.getPropertyValue("--accent") === "#a785e2");
  await s.page.click("#btn-looks");
  assert.equal(await swatch(s, "violet").getAttribute("aria-pressed"), "true", "the violet swatch is not the chosen one after a reload");
  assert.equal(await s.page.locator('input[name="looks-theme"][value="dark"]').isChecked(), true);

  // Back to default returns both, here and for the next page.
  await s.page.click("#looks-reset");
  await s.page.waitForFunction(() => !document.documentElement.hasAttribute("data-theme"));
  assert.equal(await accentVar(s), "", "the chosen highlight is still painted");
  assert.equal(await swatch(s, "violet").getAttribute("aria-pressed"), "false");
  assert.equal(await s.page.locator('input[name="looks-theme"][value="system"]').isChecked(), true);
  await s.page.waitForFunction(async () => {
    const saved = (await (await fetch("/looks")).json()).looks || {};
    return saved.theme === "system" && saved.accent !== "violet";
  });
  assert.deepEqual(await firstPaintAttrs(s), { theme: null, accent: null }, "the first paint still carries the old looks");
});

test("the launcher's model menus have Claude, Devin and Codex tabs, and a model id typed on the Codex tab is saved", async (t) => {
  noSavedLooks(t);
  // The file the launcher reads: put back as the suite had it (no file).
  t.after(() => fs.rmSync(path.join(MODELS_DIR, "models.json"), { force: true }));
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await s.page.click("#btn-looks");
  const tabs = s.page.getByRole("group", { name: "Which agent" });
  for (const name of ["Claude", "Devin", "Codex"]) assert.equal(await tabs.getByRole("button", { name, exact: true }).count(), 1, `a ${name} tab`);
  const pressed = async () => (await tabs.locator('button[aria-pressed="true"]').allInnerTexts()).map((x) => x.trim());
  assert.deepEqual(await pressed(), ["Claude"], "the menus open on Claude");

  await tabs.getByRole("button", { name: "Codex", exact: true }).click();
  assert.deepEqual(await pressed(), ["Codex"]);
  await s.page.click("#models-add");
  const id = s.page.locator("#models-user").getByRole("textbox", { name: "Model id" });
  await id.fill("gpt-test-codex-1");
  await id.press("Tab");
  await s.page.locator("#models-status").filter({ hasText: /^Saved\./ }).waitFor();
  const saved = await s.page.evaluate(async () => (await (await fetch("/models")).json()).user);
  assert.deepEqual(saved.codex.map((m) => m.id), ["gpt-test-codex-1"], "the id was not saved under Codex");
  assert.deepEqual([saved.claude, saved.devin], [[], []], "the id leaked into another agent's menu");

  // Back on Claude the typed id is not listed; on Codex it is, after a reload.
  await tabs.getByRole("button", { name: "Claude", exact: true }).click();
  assert.equal(await s.page.locator("#models-user .models-row").count(), 0);
  await s.page.reload({ waitUntil: "domcontentloaded" });
  await drawn(s.page);
  await s.page.click("#btn-looks");
  await s.page.locator("#models-tab-codex").click();
  await s.page.locator("#models-user").getByRole("textbox", { name: "Model id" }).waitFor();
  assert.equal(await s.page.locator("#models-user").getByRole("textbox", { name: "Model id" }).inputValue(), "gpt-test-codex-1");
});

test("Agents: a person adds an agent, tests its command, sees it saved after a reload, and deletes it", async (t) => {
  noSavedLooks(t);
  const file = path.join(MODELS_DIR, "agents.json");
  fs.rmSync(file, { force: true });
  t.after(() => fs.rmSync(file, { force: true }));
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await s.page.click("#btn-looks");
  const list = s.page.locator("#agents-list");
  assert.equal(await list.locator(".agent-card").count(), 0, "no agents before one is added");

  await s.page.click("#agents-add");
  const card = list.locator(".agent-card").last();
  await card.getByRole("textbox", { name: "Name", exact: true }).fill("Test Agent");
  await card.getByRole("textbox", { name: "Command", exact: true }).fill("node");
  await card.getByRole("textbox", { name: "Command", exact: true }).press("Tab");
  await s.page.locator("#agents-status").filter({ hasText: /^Saved./ }).waitFor();

  await card.getByRole("button", { name: "Test", exact: true }).click();
  await card.locator(".agent-test-result").filter({ hasText: /^Found at / }).waitFor();

  const saved = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(saved.schema, 1);
  assert.deepEqual(saved.agents.map((a) => [a.id, a.name, a.command, a.prompt]), [["test-agent", "Test Agent", "node", "/plan2code"]]);

  // A second agent with the same name is refused on its own card and field.
  await s.page.click("#agents-add");
  const second = list.locator(".agent-card").nth(1);
  await second.getByRole("textbox", { name: "Command", exact: true }).fill("x");
  await second.getByRole("textbox", { name: "Name", exact: true }).fill("TEST AGENT");
  await second.getByRole("textbox", { name: "Name", exact: true }).press("Tab");
  await list.locator(".agent-card").nth(1).locator(".agent-error").filter({ hasText: /already used/ }).waitFor();
  assert.equal(await list.locator(".agent-card").nth(1).locator('input.invalid[data-field="name"]').count(), 1, "the name field is marked");
  assert.equal(JSON.parse(fs.readFileSync(file, "utf8")).agents.length, 1, "a refused save writes nothing");

  await s.page.reload({ waitUntil: "domcontentloaded" });
  await drawn(s.page);
  await s.page.click("#btn-looks");
  await list.locator(".agent-card").first().waitFor();
  assert.equal(await list.locator(".agent-card").count(), 1);
  assert.equal(await list.locator(".agent-card").first().getByRole("textbox", { name: "Name", exact: true }).inputValue(), "Test Agent");

  await list.locator(".agent-card").first().getByRole("button", { name: "Delete", exact: true }).click();
  await list.locator(".agent-card").first().getByRole("button", { name: "Yes, delete" }).click();
  await s.page.waitForFunction(() => document.querySelectorAll("#agents-list .agent-card").length === 0);
  await s.page.locator("#agents-status").filter({ hasText: /^Saved./ }).waitFor();
  assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")).agents, []);
});

test("Agents: a new card's first field is not saved alone, and a redraw keeps focus and what was typed", async (t) => {
  noSavedLooks(t);
  const file = path.join(MODELS_DIR, "agents.json");
  fs.rmSync(file, { force: true });
  t.after(() => fs.rmSync(file, { force: true }));
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await s.page.click("#btn-looks");
  const list = s.page.locator("#agents-list");
  await s.page.click("#agents-add");
  const card = list.locator(".agent-card").last();
  const name = card.getByRole("textbox", { name: "Name", exact: true });
  const command = card.getByRole("textbox", { name: "Command", exact: true });

  await name.fill("Focus Agent");
  await name.press("Tab");
  await s.page.waitForTimeout(300);
  assert.equal(await list.locator(".agent-error").count(), 0, "a name alone is not sent, so nothing is refused");
  assert.equal(fs.existsSync(file), false, "and nothing is written");
  assert.equal(await command.evaluate((el) => el === document.activeElement), true, "Tab lands on Command");

  // The first good save assigns an id and redraws every card: focus stays where Tab put it.
  await command.fill("node");
  await command.press("Tab");
  await s.page.locator("#agents-status").filter({ hasText: /^Saved./ }).waitFor();
  assert.equal(JSON.parse(fs.readFileSync(file, "utf8")).agents[0].id, "focus-agent");
  assert.equal(await s.page.evaluate(() => document.activeElement?.textContent), "Add an argument", "focus survives the redraw");

  // A refused save redraws too: the field being typed in keeps its text, and leaving it saves it.
  const prompt = list.locator(".agent-card").last().getByRole("textbox", { name: "Start prompt", exact: true });
  await name.fill("");
  await prompt.click();
  await prompt.fill("/plan2code hi");
  await list.locator(".agent-error").filter({ hasText: /name is missing/ }).waitFor();
  assert.equal(await s.page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Start prompt");
  assert.equal(await s.page.evaluate(() => document.activeElement?.value), "/plan2code hi");
});

test("Agents: a file holding entries the page could not read is only replaced after Save anyway", async (t) => {
  noSavedLooks(t);
  const file = path.join(MODELS_DIR, "agents.json");
  fs.mkdirSync(MODELS_DIR, { recursive: true });
  const text = JSON.stringify({ schema: 2, agents: [{ id: "future", name: "Future", command: "future" }] });
  fs.writeFileSync(file, text);
  t.after(() => fs.rmSync(file, { force: true }));
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await s.page.click("#btn-looks");
  await s.page.locator("#agents-status").filter({ hasText: /schema 2/ }).waitFor();
  assert.equal(await s.page.locator("#agents-replace").isVisible(), false, "no Save anyway before a save is tried");

  await s.page.click("#agents-add");
  const card = s.page.locator("#agents-list .agent-card").last();
  await card.getByRole("textbox", { name: "Name", exact: true }).fill("Mine");
  await card.getByRole("textbox", { name: "Command", exact: true }).fill("node");
  await card.getByRole("textbox", { name: "Command", exact: true }).press("Tab");
  await s.page.locator("#agents-status").filter({ hasText: /could not read/ }).waitFor();
  assert.equal(fs.readFileSync(file, "utf8"), text, "the refused save writes nothing");

  await s.page.locator("#agents-replace").click();
  await s.page.locator("#agents-status").filter({ hasText: /^Saved./ }).waitFor();
  assert.equal(await s.page.locator("#agents-replace").isVisible(), false);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")).agents.map((a) => a.id), ["mine"]);
});

test("Cleanup scans the console home and lists an old session folder with its size", async (t) => {
  noSavedLooks(t);
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  // Made after the session opens: opening sweeps old sessions away. A session
  // is old when nothing in it has been touched for 30 days.
  const sid = "20250801-101010-aaaaaa";
  const dir = path.join(HOME, "sessions", sid);
  fs.mkdirSync(dir, { recursive: true });
  const state = path.join(dir, "state.json");
  fs.writeFileSync(state, "x".repeat(3000));
  backdate(state);
  backdate(dir);
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  await s.page.click("#btn-looks");
  const list = s.page.locator("#cleanup-list");
  assert.equal(await list.locator(".cleanup-row").count(), 0, "Cleanup lists things before a scan");
  assert.equal(await s.page.locator("#cleanup-delete").isHidden(), true, "Delete is offered before a scan");
  await s.page.click("#cleanup-scan");
  const row = list.locator(".cleanup-row").filter({ hasText: sid });
  await row.waitFor();
  assert.match(await textOf(row), new RegExp(`^Session ${sid}`));
  const size = await textOf(row.locator(".cleanup-size"));
  assert.match(size, /^\d/, "the row names a size");
  assert.ok(size === formatBytes(3000) || /^[\d.,]+\s*(kB|KB|MB|B)\b/.test(size), `the size reads as a size: ${size}`);
  assert.match(await textOf(list.locator(".cleanup-summary")), /1 old session/);
  assert.match(await textOf(s.page.locator("#cleanup-status")), /^Found \d+ items?\./);
  assert.equal(await s.page.locator("#cleanup-delete").isVisible(), true, "Delete these is offered once something is found");
  // The scan only looks.
  assert.equal(fs.existsSync(dir), true, "a scan deleted the folder");

  // Closing preferences forgets the scan: a reopened dialog starts clean.
  await s.page.click("#looks-done");
  await s.page.click("#btn-looks");
  assert.equal(await list.locator(".cleanup-row").count(), 0, "the old scan is still listed");
  assert.equal(await s.page.locator("#cleanup-delete").isHidden(), true);
});
