// Page tests for User Preferences: its four tabs, the saved looks (highlight
// and theme), the Agents & models tab (the launcher's model menus and the
// person's agents) and Cleanup. Run with:
// node --test scripts/test-web-console-page-prefs.mjs
//
// Each test drives the real console in a real Chrome or Edge through
// scripts/page-test-helpers.mjs: one browser for the file, a fresh console
// session per test.

import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { pageSuite, openSession, textOf, drawn, styleOf, stylesOf } from "./page-test-helpers.mjs";
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

// The Agents & models tab: the split's row list, its rows and the pane the
// pick opens the form in (the list stays on screen; there is no back page).
const AGENTS_FILE = path.join(MODELS_DIR, "agents.json");
const agentsTable = (s) => s.page.locator("#agents-table");
const agentRow = (s, key) => agentsTable(s).locator(`.split-row[data-key="${key}"]`);
const agentForm = (s) => s.page.locator("#agents-form");
const formField = (s, name) => agentForm(s).getByRole("textbox", { name, exact: true });
const formButton = (s, name) => agentForm(s).getByRole("button", { name, exact: true });
const formPane = (s) => agentForm(s).locator(".prefs-agents-fields");
const unsavedPrompt = (s) => s.page.locator("#prefs-unsaved");

async function openAgentsTab(s) {
  // The dialog's DOM survives a close, so the row, a stale form and even a
  // stale empty pane can match before load() resolves. Wait on the fetch
  // itself first; the empty pane only draws once it has.
  const loaded = s.page.waitForResponse((r) => r.url().endsWith("/agents"));
  await s.page.click("#btn-looks");
  await s.page.click("#prefs-tab-agents");
  await loaded;
  await agentRow(s, "cli:claude").waitFor();
  await agentForm(s).locator(".split-empty").waitFor();
}

// agents.json as the test starts it: none, or the entries given. Removed after.
function seedAgents(t, agents) {
  fs.rmSync(AGENTS_FILE, { force: true });
  if (agents) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
    fs.writeFileSync(AGENTS_FILE, JSON.stringify({ schema: 1, agents }, null, 2));
  }
  t.after(() => fs.rmSync(AGENTS_FILE, { force: true }));
}

test("Agents & models: the table lists Claude, Devin and Codex, and a model id typed in Codex's form is saved only on Save", async (t) => {
  noSavedLooks(t);
  seedAgents(t);
  // The file the launcher reads: put back as the suite had it (no file).
  t.after(() => fs.rmSync(path.join(MODELS_DIR, "models.json"), { force: true }));
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openAgentsTab(s);
  const keys = await agentsTable(s).locator(".split-row[data-key]").evaluateAll((rows) => rows.map((r) => r.dataset.key));
  assert.deepEqual(keys, ["cli:claude", "cli:devin", "cli:codex"]);
  assert.equal(await textOf(agentRow(s, "cli:codex").locator(".row-name")), "Codex");

  await s.page.getByRole("button", { name: "Edit Codex" }).click();
  await formPane(s).waitFor();
  assert.equal(await agentRow(s, "cli:codex").getAttribute("aria-current"), "true", "the picked row is marked; the list stays beside the form");
  await agentForm(s).locator(".prefs-agents-none").filter({ hasText: /^No models ship for Codex yet/ }).waitFor();
  assert.equal(await agentForm(s).locator(".models-row.locked").count(), 0, "nothing comes with Plan2Code for Codex");

  await formButton(s, "Add a model").click();
  await formField(s, "Model id").fill("gpt-test-codex-1");
  await formButton(s, "Add a model").click();
  await formField(s, "Model id").nth(1).fill("gpt-test-codex-2");
  // Remove drops the row from the draft; it still reaches the file only on Save.
  await agentForm(s).locator(".agent-row.model").first().getByRole("button", { name: "Remove" }).click();
  assert.equal(await agentForm(s).locator(".agent-row.model").count(), 1, "the removed row is gone");
  await agentForm(s).locator(".prefs-unsaved-badge").waitFor();
  const before = await s.page.evaluate(async () => (await (await fetch("/models")).json()).user);
  assert.deepEqual(before.codex, [], "nothing is saved before Save");

  await formButton(s, "Save").click();
  await agentForm(s).locator(".prefs-saved").filter({ hasText: /^Saved\. Restart plan2code/ }).waitFor();
  const saved = await s.page.evaluate(async () => (await (await fetch("/models")).json()).user);
  assert.deepEqual(saved.codex.map((m) => m.id), ["gpt-test-codex-2"], "only the kept model was saved under Codex");
  assert.deepEqual([saved.claude, saved.devin], [[], []], "the id leaked into another agent's menu");
  assert.equal(await agentForm(s).locator(".prefs-unsaved-badge").isVisible(), false, "saved, nothing is unsaved");

  // The summary counts it on Codex's row, and so does a fresh page.
  assert.match(await textOf(agentRow(s, "cli:codex").locator(".row-models")), /^1: gpt-test-codex-2$/);
  await s.page.reload({ waitUntil: "domcontentloaded" });
  await drawn(s.page);
  await openAgentsTab(s);
  await s.page.getByRole("button", { name: "Edit Codex" }).click();
  assert.equal(await formField(s, "Model id").inputValue(), "gpt-test-codex-2");
});

// The "Strengths in the loop" fold: Thrifty, Balanced and Best mapped to the
// agent's own models. models.json under PLAN2CODE_MODELS_DIR is what Save writes.
const MODELS_FILE = path.join(MODELS_DIR, "models.json");
const strengthsFold = (s) => agentForm(s).locator("details.prefs-agents-strengths");
const strengthRow = (s, word) => strengthsFold(s).locator(`.strength-row[data-word="${word}"]`);
const savedStrengths = () => {
  try {
    return JSON.parse(fs.readFileSync(MODELS_FILE, "utf8")).strengths ?? null;
  } catch {
    return null; // not written yet
  }
};

// The shipped list the tests start with has no models at all; the fold needs some
// (and Claude and Devin's shipped strengths), so a test writes them and puts the file back.
const SHIPPED_FILE = path.join(MODELS_DIR, "bin", "models.json");
function seedShippedModels(t) {
  fs.mkdirSync(path.dirname(SHIPPED_FILE), { recursive: true });
  fs.writeFileSync(
    SHIPPED_FILE,
    JSON.stringify({
      claude: [{ id: "sonnet", label: "Sonnet" }, { id: "opus", label: "Opus" }],
      devin: [{ id: "swe-2-medium", label: "SWE 2 Medium" }, { id: "swe-2-high", label: "SWE 2 High" }, { id: "claude-opus-5-5-medium", label: "Opus 5.5 Medium" }],
      codex: [],
      strengths: {
        claude: { thrifty: { model: "sonnet", effort: "low" }, balanced: { model: "sonnet", effort: "medium" }, best: { model: "opus", effort: "medium" } },
        devin: { thrifty: { model: "swe-2-medium" }, balanced: { model: "swe-2-high" }, best: { model: "claude-opus-5-5-medium" } },
      },
    })
  );
  t.after(() => fs.rmSync(SHIPPED_FILE, { force: true }));
}

// Save lands asynchronously and an earlier Saved mark may still be on screen, so wait on the file.
async function savedStrengthsAre(expected) {
  for (let i = 0; i < 100; i++) {
    if (JSON.stringify(savedStrengths()) === JSON.stringify(expected)) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  assert.deepEqual(savedStrengths(), expected);
}

async function openStrengths(s, name) {
  await s.page.getByRole("button", { name: `Edit ${name}` }).click();
  await formPane(s).waitFor();
  await strengthsFold(s).locator("summary").click();
}

test("Agents & models: Claude's fold shows the shipped rows as default, and only a changed row is saved, until Reset", async (t) => {
  noSavedLooks(t);
  seedAgents(t);
  t.after(() => fs.rmSync(MODELS_FILE, { force: true }));
  seedShippedModels(t);
  fs.rmSync(MODELS_FILE, { force: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openAgentsTab(s);
  await openStrengths(s, "Claude");
  assert.equal(await strengthRow(s, "thrifty").locator('select[data-field="model"]').inputValue(), "sonnet");
  assert.equal(await strengthRow(s, "thrifty").locator('select[data-field="effort"]').inputValue(), "low");
  assert.equal(await strengthRow(s, "best").locator('select[data-field="model"]').inputValue(), "opus");
  assert.equal(await strengthsFold(s).locator(".strength-default").count(), 3, "all three rows are untouched defaults");
  assert.equal(await textOf(strengthRow(s, "balanced").locator(".strength-default")), "default");
  assert.equal(await strengthsFold(s).locator(".strength-reset").count(), 0, "nothing to reset yet");
  assert.equal(await textOf(strengthsFold(s).locator(".strength-offer")), "The loop will offer: Thrifty, Balanced, Best");

  await strengthRow(s, "thrifty").locator('select[data-field="model"]').selectOption("opus");
  await agentForm(s).locator(".prefs-unsaved-badge").waitFor();
  assert.equal(await strengthRow(s, "thrifty").locator(".strength-reset").count(), 1, "a changed row has Reset");
  assert.equal(await strengthRow(s, "thrifty").locator(".strength-default").count(), 0);
  assert.equal(await strengthRow(s, "balanced").locator(".strength-reset").count(), 0, "the other rows stay default");
  assert.equal(fs.existsSync(MODELS_FILE), false, "nothing is saved before Save");

  await formButton(s, "Save").click();
  await agentForm(s).locator(".prefs-saved").filter({ hasText: /^Saved. Restart plan2code/ }).waitFor();
  assert.deepEqual(savedStrengths(), { claude: { thrifty: { model: "opus", effort: "low" } } }, "only the changed row is written");

  await strengthRow(s, "thrifty").locator(".strength-reset").click();
  assert.equal(await strengthRow(s, "thrifty").locator('select[data-field="model"]').inputValue(), "sonnet", "Reset restores the shipped row");
  assert.equal(await textOf(strengthRow(s, "thrifty").locator(".strength-default")), "default");
  await agentForm(s).locator(".prefs-unsaved-badge").waitFor();
  await formButton(s, "Save").click();
  await savedStrengthsAre(null); // with every row back at its default, no strengths are stored
});

test("Agents & models: Codex has an effort select on each row and Devin does not", async (t) => {
  noSavedLooks(t);
  seedAgents(t);
  t.after(() => fs.rmSync(MODELS_FILE, { force: true }));
  seedShippedModels(t);
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openAgentsTab(s);
  await openStrengths(s, "Codex");
  assert.equal(await textOf(strengthsFold(s).locator(".strength-empty")), "Add a model under Models first", "no models ship for Codex");
  await formButton(s, "Add a model").click();
  await formField(s, "Model id").fill("gpt-test-codex-1");
  assert.equal(await strengthsFold(s).locator('select[data-field="effort"]').count(), 3);
  assert.equal(await strengthRow(s, "thrifty").locator('select[data-field="model"]').inputValue(), "", "nothing ships for Codex, so the row is not mapped");
  assert.equal(await textOf(strengthsFold(s).locator(".strength-offer")), "The loop will not offer a strength for this agent until one is mapped.");
  await formButton(s, "Discard").click(); // the added model is unsaved: leaving would ask first
  await s.page.getByRole("button", { name: "Edit Devin" }).click();
  await strengthsFold(s).locator("summary").click();
  assert.equal(await strengthsFold(s).locator('select[data-field="model"]').count(), 3);
  assert.equal(await strengthsFold(s).locator('select[data-field="effort"]').count(), 0, "Devin takes no separate effort");
});

test("Agents & models: a strength-only edit is unsaved until Save, Discard puts the shipped rows back, and Reset keeps focus on its row", async (t) => {
  noSavedLooks(t);
  seedAgents(t);
  t.after(() => fs.rmSync(MODELS_FILE, { force: true }));
  seedShippedModels(t);
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openAgentsTab(s);
  await openStrengths(s, "Claude");
  assert.equal(await agentForm(s).locator(".prefs-unsaved-badge").isVisible(), false);
  await strengthRow(s, "best").locator('select[data-field="model"]').selectOption("sonnet");
  await agentForm(s).locator(".prefs-unsaved-badge").waitFor();
  await formButton(s, "Discard").click();
  assert.equal(await agentForm(s).locator(".prefs-unsaved-badge").isVisible(), false, "Discard clears the strength-only change");
  assert.equal(await strengthRow(s, "best").locator('select[data-field="model"]').inputValue(), "opus", "the shipped row is back");
  assert.equal(fs.existsSync(MODELS_FILE), false, "nothing was written");

  await strengthRow(s, "best").locator('select[data-field="model"]').selectOption("sonnet");
  await strengthRow(s, "best").locator(".strength-reset").focus();
  await strengthRow(s, "best").locator(".strength-reset").click();
  assert.equal(
    await s.page.evaluate(() => document.activeElement?.closest("[data-word]")?.dataset.word),
    "best",
    "focus stays in the row the Reset was in"
  );
});

test("Agents & models: a saved row whose model was removed reads not mapped while other models remain, and Save drops it", async (t) => {
  noSavedLooks(t);
  seedAgents(t);
  t.after(() => fs.rmSync(MODELS_FILE, { force: true }));
  seedShippedModels(t);
  fs.rmSync(MODELS_FILE, { force: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openAgentsTab(s);
  await s.page.click("#agents-add");
  await formPane(s).waitFor();
  await formField(s, "Name").fill("Gemini");
  await formField(s, "Command").fill("node");
  await agentForm(s).locator("details.agent-fold > summary", { hasText: /^Models$/ }).click();
  await formButton(s, "Add a model").click();
  await formField(s, "Model id").fill("model-a");
  await formButton(s, "Add a model").click();
  await formField(s, "Model id").nth(1).fill("model-b");
  await strengthsFold(s).locator("summary").click();
  await strengthRow(s, "thrifty").locator('select[data-field="model"]').selectOption("model-a");
  await strengthRow(s, "best").locator('select[data-field="model"]').selectOption("model-b");
  await formButton(s, "Save").click();
  await savedStrengthsAre({ gemini: { thrifty: { model: "model-a" }, best: { model: "model-b" } } });

  await agentForm(s).locator(".agent-row.model").first().getByRole("button", { name: "Remove" }).click();
  assert.equal(await strengthRow(s, "thrifty").locator('select[data-field="model"]').inputValue(), "", "the removed model reads not mapped");
  assert.equal(await textOf(strengthsFold(s).locator(".strength-offer")), "The loop will offer: Best");
  await formButton(s, "Save").click();
  await savedStrengthsAre({ gemini: { best: { model: "model-b" } } });
});

test("Agents & models: an added agent maps strengths only from its own Models, and a removed model reads not mapped", async (t) => {
  noSavedLooks(t);
  seedAgents(t);
  t.after(() => fs.rmSync(MODELS_FILE, { force: true }));
  seedShippedModels(t);
  fs.rmSync(MODELS_FILE, { force: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openAgentsTab(s);
  await s.page.click("#agents-add");
  await formPane(s).waitFor();
  await formField(s, "Name").fill("Copilot");
  await formField(s, "Command").fill("node");
  await strengthsFold(s).locator("summary").click();
  assert.equal(await textOf(strengthsFold(s).locator(".strength-empty")), "Add a model under Models first");
  assert.equal(await strengthsFold(s).locator("select").count(), 0, "no selects without a model");

  await agentForm(s).locator("details.agent-fold > summary", { hasText: /^Models$/ }).click();
  await formButton(s, "Add a model").click();
  await formField(s, "Model id").fill("gpt-test-1");
  assert.equal(await strengthsFold(s).locator(".strength-empty").count(), 0, "the fold follows the Models list as it changes");
  await strengthRow(s, "thrifty").locator('select[data-field="model"]').selectOption("gpt-test-1");
  assert.equal(await strengthRow(s, "thrifty").locator('select[data-field="effort"]').count(), 0, "an added agent has no effort select");
  await formButton(s, "Save").click();
  await agentForm(s).locator(".prefs-saved").waitFor();
  assert.deepEqual(savedStrengths(), { copilot: { thrifty: { model: "gpt-test-1" } } }, "saved under the new agent's id");

  await agentForm(s).locator(".agent-row.model").first().getByRole("button", { name: "Remove" }).click();
  assert.equal(await textOf(strengthsFold(s).locator(".strength-empty")), "Add a model under Models first");
  await formButton(s, "Save").click();
  await savedStrengthsAre(null);
});

test("Agents & models: a person adds an agent, tests its command, sees it after a reload, and deletes it", async (t) => {
  noSavedLooks(t);
  seedAgents(t);
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openAgentsTab(s);
  assert.equal(await agentsTable(s).locator('.split-row[data-key^="agent:"]').count(), 0, "no agents before one is added");

  await s.page.click("#agents-add");
  await formPane(s).waitFor();
  assert.equal(await agentForm(s).locator("details.prefs-agents-args").evaluate((d) => d.open), true, "the arguments are open on a new agent");
  await formField(s, "Name").fill("Test Agent");
  await formField(s, "Command").fill("node");
  await formButton(s, "Test").click();
  await agentForm(s).locator(".agent-test-result").filter({ hasText: /^Found at / }).waitFor();
  assert.equal(fs.existsSync(AGENTS_FILE), false, "Test never saves");

  await formButton(s, "Save").click();
  await agentForm(s).locator(".prefs-saved").filter({ hasText: /^Saved$/ }).waitFor();
  const saved = JSON.parse(fs.readFileSync(AGENTS_FILE, "utf8"));
  assert.equal(saved.schema, 1);
  assert.deepEqual(saved.agents.map((a) => [a.id, a.name, a.command, a.prompt]), [["test-agent", "Test Agent", "node", "/plan2code"]]);
  assert.equal(await agentForm(s).locator(".prefs-agents-delete").count(), 1, "once saved it has Delete agent");

  await s.page.reload({ waitUntil: "domcontentloaded" });
  await drawn(s.page);
  await openAgentsTab(s);
  const row = agentRow(s, "agent:test-agent");
  await row.locator(".prefs-badge.ok").waitFor();
  assert.equal(await textOf(row.locator(".prefs-badge")), "Found");
  await s.page.getByRole("button", { name: "Edit Test Agent" }).click();
  assert.equal(await formField(s, "Name").inputValue(), "Test Agent");
  assert.equal(await agentForm(s).locator("details.prefs-agents-args").evaluate((d) => d.open), false, "the arguments are folded on a saved agent");

  await formButton(s, "Delete agent").click();
  await formButton(s, "Yes, delete").click();
  await row.waitFor({ state: "detached" });
  assert.equal(await agentsTable(s).locator('.split-row[data-key^="agent:"]').count(), 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(AGENTS_FILE, "utf8")).agents, []);
  assert.equal(await s.page.evaluate(() => document.activeElement?.getAttribute("aria-label") || document.activeElement?.id), "agents-add", "with its row gone, focus goes to Add agent");
  assert.equal(await textOf(s.page.locator("#agents-status")), "Deleted.");
  await s.page.click("#agents-add");
  await formPane(s).waitFor();
  assert.equal(await s.page.locator("#agents-status").innerText(), "", "opening a form clears Deleted.");
});

test("Agents & models: a new agent with only a name is not sent, its command is marked, and focus and text survive", async (t) => {
  noSavedLooks(t);
  seedAgents(t);
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openAgentsTab(s);
  await s.page.click("#agents-add");
  await formField(s, "Name").fill("Focus Agent");
  await formButton(s, "Save").click();
  await agentForm(s).locator(".agent-error").filter({ hasText: "Give it a name and a command first." }).waitFor();
  assert.equal(fs.existsSync(AGENTS_FILE), false, "nothing is written");
  assert.equal(await agentForm(s).locator('input.invalid[data-field="command"]').count(), 1, "the command field is marked");
  assert.equal(await formField(s, "Name").inputValue(), "Focus Agent", "the typed name survives the redraw");
  assert.equal(await s.page.evaluate(() => document.activeElement?.textContent), "Save", "focus stays on Save");

  // The first good save assigns an id; the form stays open on it.
  await formField(s, "Command").fill("node");
  await formButton(s, "Save").click();
  await agentForm(s).locator(".prefs-saved").filter({ hasText: /^Saved$/ }).waitFor();
  assert.equal(JSON.parse(fs.readFileSync(AGENTS_FILE, "utf8")).agents[0].id, "focus-agent");
  assert.equal(await textOf(agentForm(s).locator(".prefs-agents-title")), "Focus Agent");

  // A refused save marks the field the server names, and keeps what was typed.
  await formField(s, "Name").fill("");
  await formField(s, "Start prompt").fill("/plan2code hi");
  await formButton(s, "Save").click();
  await agentForm(s).locator(".agent-error").filter({ hasText: /name is missing/ }).waitFor();
  assert.equal(await agentForm(s).locator('input.invalid[data-field="name"]').count(), 1);
  assert.equal(await formField(s, "Start prompt").inputValue(), "/plan2code hi");
  assert.equal(JSON.parse(fs.readFileSync(AGENTS_FILE, "utf8")).agents[0].name, "Focus Agent", "a refused save writes nothing");
});

test("Agents & models: a file holding entries the page could not read is only replaced after Save anyway", async (t) => {
  noSavedLooks(t);
  const text = JSON.stringify({ schema: 2, agents: [{ id: "future", name: "Future", command: "future" }] });
  fs.mkdirSync(MODELS_DIR, { recursive: true });
  fs.writeFileSync(AGENTS_FILE, text);
  t.after(() => fs.rmSync(AGENTS_FILE, { force: true }));
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openAgentsTab(s);
  await s.page.locator("#agents-status").filter({ hasText: /schema 2/ }).waitFor();

  await s.page.click("#agents-add");
  await formPane(s).waitFor();
  assert.equal(await formButton(s, "Save anyway").count(), 0, "no Save anyway before a save is tried");
  await formField(s, "Name").fill("Mine");
  await formField(s, "Command").fill("node");
  await formButton(s, "Save").click();
  await agentForm(s).locator(".agent-error").filter({ hasText: /could not read/ }).first().waitFor();
  assert.equal(fs.readFileSync(AGENTS_FILE, "utf8"), text, "the refused save writes nothing");

  await formButton(s, "Save anyway").click();
  await agentForm(s).locator(".prefs-saved").filter({ hasText: /^Saved$/ }).waitFor();
  assert.equal(await formButton(s, "Save anyway").count(), 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(AGENTS_FILE, "utf8")).agents.map((a) => a.id), ["mine"]);
});

const TWO_AGENTS = [
  { id: "alpha", name: "Alpha", command: "alpha-cli" },
  { id: "beta", name: "Beta", command: "beta-cli" },
];

test("Agents & models: nothing reaches agents.json before Save", async (t) => {
  noSavedLooks(t);
  seedAgents(t, TWO_AGENTS);
  const before = fs.readFileSync(AGENTS_FILE, "utf8");
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openAgentsTab(s);
  await s.page.getByRole("button", { name: "Edit Alpha" }).click();
  await formField(s, "Command").fill("alpha-cli --edited");
  await formField(s, "Command").press("Tab");
  await s.page.waitForTimeout(500);
  assert.equal(fs.readFileSync(AGENTS_FILE, "utf8"), before, "agents.json is byte for byte unchanged");
  await formButton(s, "Save").click();
  await agentForm(s).locator(".prefs-saved").filter({ hasText: /^Saved$/ }).waitFor();
  assert.equal(JSON.parse(fs.readFileSync(AGENTS_FILE, "utf8")).agents[0].command, "alpha-cli --edited");
});

test("Agents & models: a discarded edit never rides along with another agent's Save", async (t) => {
  noSavedLooks(t);
  seedAgents(t, TWO_AGENTS);
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openAgentsTab(s);
  await s.page.getByRole("button", { name: "Edit Alpha" }).click();
  await formField(s, "Command").fill("alpha-cli --dropped");
  // Picking another row is the way out of a form; a dirty draft asks first.
  await s.page.getByRole("button", { name: "Edit Beta" }).click();
  await unsavedPrompt(s).waitFor();
  assert.equal(await textOf(s.page.locator("#prefs-unsaved-name")), "Alpha");
  assert.equal(await s.page.locator("#looks-modal .prefs-body").evaluate((b) => b.inert), true, "the dialog behind the prompt is out of reach");
  await unsavedPrompt(s).getByRole("button", { name: "Discard", exact: true }).click();
  await unsavedPrompt(s).waitFor({ state: "hidden" });
  await formPane(s).waitFor();
  assert.equal(await s.page.locator("#looks-modal .prefs-body").evaluate((b) => b.inert), false);
  assert.equal(await textOf(agentForm(s).locator(".prefs-agents-title")), "Beta", "the pick the prompt asked about carries on");

  await formField(s, "Command").fill("beta-cli --kept");
  await formButton(s, "Save").click();
  await agentForm(s).locator(".prefs-saved").filter({ hasText: /^Saved$/ }).waitFor();
  const agents = JSON.parse(fs.readFileSync(AGENTS_FILE, "utf8")).agents;
  assert.deepEqual(agents.map((a) => [a.id, a.command]), [["alpha", "alpha-cli"], ["beta", "beta-cli --kept"]]);
});

test("Agents & models: an unsaved edit asks first on a row pick, Close, Esc, a backdrop click and a tab switch", async (t) => {
  noSavedLooks(t);
  seedAgents(t, TWO_AGENTS);
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openAgentsTab(s);
  const modal = s.page.locator("#looks-modal");
  const edit = async (command) => {
    if (!(await agentForm(s).locator(".prefs-agents-title").filter({ hasText: "Alpha" }).count())) {
      await s.page.getByRole("button", { name: "Edit Alpha" }).click();
    }
    await formField(s, "Command").fill(command);
  };
  const triggers = {
    row: () => s.page.getByRole("button", { name: "Edit Beta" }).click(),
    close: () => s.page.click("#looks-done"),
    esc: () => formField(s, "Command").press("Escape"),
    backdrop: () => s.page.mouse.click(4, 4),
    tab: () => s.page.click("#prefs-tab-appearance"),
  };
  for (const [name, leave] of Object.entries(triggers)) {
    // Keep editing: the form and the draft stay.
    await edit(`alpha-${name}-kept`);
    await leave();
    await unsavedPrompt(s).waitFor();
    assert.equal(await s.page.evaluate(() => document.activeElement?.id), "prefs-unsaved-save", `${name}: Save has focus`);
    await unsavedPrompt(s).getByRole("button", { name: "Keep editing" }).click();
    await unsavedPrompt(s).waitFor({ state: "hidden" });
    assert.equal(await modal.evaluate((d) => d.open), true, `${name}: the dialog stays open`);
    assert.equal(await formField(s, "Command").inputValue(), `alpha-${name}-kept`, `${name}: the draft stays`);
    assert.equal(await s.page.locator("#prefs-tab-agents").getAttribute("aria-selected"), "true");
  }
  const before = fs.readFileSync(AGENTS_FILE, "utf8");

  // Discard drops the edit and goes on (here, Close).
  await triggers.close();
  await unsavedPrompt(s).getByRole("button", { name: "Discard", exact: true }).click();
  await modal.waitFor({ state: "hidden" });
  assert.equal(fs.readFileSync(AGENTS_FILE, "utf8"), before, "Discard writes nothing");

  // Save writes and goes on (here, a tab switch).
  await openAgentsTab(s);
  await edit("alpha-saved");
  await triggers.tab();
  await unsavedPrompt(s).getByRole("button", { name: "Save", exact: true }).click();
  await s.page.locator('#prefs-tab-appearance[aria-selected="true"]').waitFor();
  assert.equal(JSON.parse(fs.readFileSync(AGENTS_FILE, "utf8")).agents[0].command, "alpha-saved");
});

test("Agents & models: Esc in the unsaved prompt keeps editing, and a Save that fails there stays and marks the field", async (t) => {
  noSavedLooks(t);
  seedAgents(t);
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openAgentsTab(s);
  await s.page.click("#agents-add");
  await formField(s, "Name").fill("Half Agent");

  await s.page.click("#looks-done");
  await unsavedPrompt(s).waitFor();
  await s.page.keyboard.press("Escape");
  await unsavedPrompt(s).waitFor({ state: "hidden" });
  assert.equal(await s.page.locator("#looks-modal").evaluate((d) => d.open), true, "Esc in the prompt does not close the dialog");
  assert.equal(await formField(s, "Name").inputValue(), "Half Agent", "the draft stays");

  // Save from the prompt with no command: nothing is sent, the dialog stays, focus is on the marked field.
  await s.page.click("#looks-done");
  await unsavedPrompt(s).getByRole("button", { name: "Save", exact: true }).click();
  await unsavedPrompt(s).waitFor({ state: "hidden" });
  assert.equal(await s.page.locator("#looks-modal").evaluate((d) => d.open), true, "a failed Save keeps the dialog open");
  assert.equal(fs.existsSync(AGENTS_FILE), false, "nothing is written");
  assert.equal(await s.page.evaluate(() => document.activeElement?.matches('input.invalid[data-field="command"]')), true, "focus is on the marked field");
});

test("Agents & models: a command not on PATH is marked, and the orchestrator row has no Edit", async (t) => {
  noSavedLooks(t);
  seedAgents(t, [{ id: "ghost", name: "Ghost", command: "plan2code-no-such-command-xyz" }]);
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openAgentsTab(s);
  const badge = agentRow(s, "agent:ghost").locator(".prefs-badge");
  await badge.filter({ hasText: "Not found on PATH" }).waitFor();
  assert.equal(await badge.evaluate((b) => b.classList.contains("missing")), true);
  const soon = agentsTable(s).locator(".split-row.soon");
  assert.match(await textOf(soon), /v3 orchestrator\s+Nothing to set yet\./);
  assert.equal(await soon.getByRole("button").count(), 0);
});

test("Agents & models: below 720 px the split stacks and the form is one column", async (t) => {
  noSavedLooks(t);
  seedAgents(t, TWO_AGENTS);
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await s.page.setViewportSize({ width: 600, height: 800 });
  await openAgentsTab(s);
  const cols = await styleOf(s.page.locator("#agents-split"), "grid-template-columns");
  assert.equal(cols.trim().split(/\s+/).length, 1, `the split stacks: ${cols}`);
  assert.equal(await styleOf(s.page.locator("#agents-table"), "overflow-y"), "auto", "the row list scrolls");
  await s.page.getByRole("button", { name: "Edit Alpha" }).click();
  const fields = await styleOf(agentForm(s).locator(".prefs-agents-fields"), "grid-template-columns");
  assert.equal(fields.trim().split(/\s+/).length, 1, `one column: ${fields}`);
});

// The shipped bin/agents.json beside the user file: where starter templates
// come from. Removed after so the next test's list has none.
const SHIPPED_AGENTS_FILE = path.join(MODELS_DIR, "bin", "agents.json");
function seedShipped(t, agents) {
  fs.mkdirSync(path.dirname(SHIPPED_AGENTS_FILE), { recursive: true });
  fs.writeFileSync(SHIPPED_AGENTS_FILE, JSON.stringify({ schema: 1, agents }));
  t.after(() => fs.rmSync(SHIPPED_AGENTS_FILE, { force: true }));
}

test("Agents & models: shipped templates offer a prefilled new-agent form", async (t) => {
  noSavedLooks(t);
  seedAgents(t);
  seedShipped(t, [
    { id: "templar", name: "Templar", kind: "template", command: "templar", prompt: "/plan2code", args: ["{prompt}"], note: "A starter agent." },
  ]);
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openAgentsTab(s);
  await agentsTable(s).locator(".split-list-head", { hasText: "Or start from a template" }).waitFor();
  const row = agentRow(s, "setup:Templar");
  assert.match(await textOf(row), /Templar\s+templar/);
  await row.click();
  const use = agentForm(s).getByRole("button", { name: "Use this template", exact: true });
  await use.waitFor();
  assert.match(await textOf(agentForm(s)), /A starter agent\./);
  await use.click();
  await formPane(s).waitFor();
  assert.equal(await formField(s, "Name").inputValue(), "Templar");
  assert.equal(await formField(s, "Command").inputValue(), "templar");
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
  await s.page.click("#prefs-tab-system");
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
  await s.page.click("#prefs-tab-system");
  assert.equal(await list.locator(".cleanup-row").count(), 0, "the old scan is still listed");
  assert.equal(await s.page.locator("#cleanup-delete").isHidden(), true);
});

// The server refuses to delete a completed spec git does not track as it
// stands, so the list shows it apart as kept, never as something to delete.
test("Cleanup lists an untracked completed spec as kept, out of the total and out of Delete", async (t) => {
  noSavedLooks(t);
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  const spec = path.join(s.project, "specs--completed", "old-spec");
  fs.mkdirSync(spec, { recursive: true });
  fs.writeFileSync(path.join(spec, "overview.md"), "x".repeat(2000));
  backdate(path.join(spec, "overview.md"));
  backdate(spec);

  await s.page.click("#btn-looks");
  await s.page.click("#prefs-tab-system");
  await s.page.click("#cleanup-scan");
  const list = s.page.locator("#cleanup-list");
  const kept = list.locator(".cleanup-kept").filter({ hasText: "old-spec" });
  await kept.waitFor();
  assert.match(await textOf(kept), /specs--completed\/old-spec\/\s*kept: git does not track it as it stands/);
  assert.equal(await list.locator(".cleanup-row:not(.cleanup-kept)").filter({ hasText: "old-spec" }).count(), 0, "not listed to delete");
  const summary = list.locator(".cleanup-summary");
  if (await summary.count()) assert.doesNotMatch(await textOf(summary), /completed spec/, "not counted in the summary");
  assert.match(await textOf(s.page.locator("#cleanup-status")), /1 old completed spec is kept: git does not track it as it stands\./);
  assert.equal(fs.existsSync(spec), true);
});

/* ------------------------------------------------------------- the tabs */

const tabNames = async (s) => (await s.page.locator("#prefs-tabs [role=tab] .prefs-tab-label").allInnerTexts()).map((x) => x.trim());
const selectedTab = (s) => s.page.evaluate(() => document.querySelector('#prefs-tabs [aria-selected="true"]')?.id);
const focusedId = (s) => s.page.evaluate(() => document.activeElement?.id);
const visiblePanels = (s) => s.page.evaluate(() => [...document.querySelectorAll("#prefs-panels [role=tabpanel]")].filter((p) => !p.hidden).map((p) => p.id));

test("the gear opens User Preferences on Appearance, with four tabs in order and one panel shown", async (t) => {
  noSavedLooks(t);
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await s.page.setViewportSize({ width: 1000, height: 800 });
  await s.page.click("#btn-looks");
  await s.page.locator("#looks-modal[open]").waitFor();
  assert.deepEqual(await tabNames(s), ["Appearance", "Agents & models", "System", "Sounds & activities"]);
  assert.equal(await selectedTab(s), "prefs-tab-appearance");
  assert.equal(await focusedId(s), "prefs-tab-appearance", "focus is on the selected tab");
  assert.equal(await s.page.locator('#prefs-tabs [tabindex="0"]').count(), 1, "one tab in the tab order");
  assert.deepEqual(await visiblePanels(s), ["prefs-panel-appearance"]);
  assert.equal(await s.page.locator("#prefs-tab-appearance").getAttribute("aria-controls"), "prefs-panel-appearance");
  assert.equal(await s.page.locator("#prefs-panel-appearance").getAttribute("aria-labelledby"), "prefs-tab-appearance");
  assert.equal(await textOf(s.page.locator("#looks-done")), "Close", "the footer button no longer says Done");
});

test("Preferences' tabs move with the arrow, Home and End keys, wrapping at the ends", async (t) => {
  noSavedLooks(t);
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await s.page.click("#btn-looks");
  await s.page.locator("#looks-modal[open]").waitFor();
  const press = async (key, want) => {
    await s.page.keyboard.press(key);
    assert.equal(await selectedTab(s), want, `${key} selects ${want}`);
    assert.equal(await focusedId(s), want, `${key} focuses ${want}`);
    assert.deepEqual(await visiblePanels(s), [want.replace("-tab-", "-panel-")]);
  };
  await press("ArrowDown", "prefs-tab-agents");
  await press("ArrowRight", "prefs-tab-system");
  await press("End", "prefs-tab-sounds");
  await press("ArrowDown", "prefs-tab-appearance");
  await press("ArrowUp", "prefs-tab-sounds");
  await press("Home", "prefs-tab-appearance");
  await press("ArrowLeft", "prefs-tab-sounds");
});

test("below 720 px the side list is a horizontal strip with no hints", async (t) => {
  noSavedLooks(t);
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await s.page.setViewportSize({ width: 1000, height: 800 });
  await s.page.click("#btn-looks");
  const list = s.page.locator("#prefs-tabs");
  const hint = s.page.locator("#prefs-tab-appearance .prefs-tab-hint");
  assert.equal(await list.getAttribute("aria-orientation"), "vertical");
  assert.equal(await styleOf(hint, "display"), "block", "hints show in the side list");
  assert.equal(await styleOf(list, "flex-direction"), "column");
  await s.page.setViewportSize({ width: 600, height: 800 });
  await s.page.waitForFunction(() => document.getElementById("prefs-tabs").getAttribute("aria-orientation") === "horizontal");
  assert.equal(await styleOf(hint, "display"), "none", "no hints in the strip");
  assert.deepEqual(await stylesOf(list, ["flex-direction", "overflow-x"]), { "flex-direction": "row", "overflow-x": "auto" });
  await s.page.setViewportSize({ width: 1000, height: 800 });
  await s.page.waitForFunction(() => document.getElementById("prefs-tabs").getAttribute("aria-orientation") === "vertical");
});

test("Set up preferences on the dashboard opens on Appearance with agents and models loaded", async (t) => {
  fs.mkdirSync(HOME, { recursive: true });
  fs.writeFileSync(LOOKS_FILE, JSON.stringify({ looks: { welcomeSeen: true } }));
  t.after(() => fs.rmSync(LOOKS_FILE, { force: true }));
  const file = path.join(MODELS_DIR, "agents.json");
  fs.mkdirSync(MODELS_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ schema: 1, agents: [{ id: "goose", name: "Goose", command: "goose" }] }));
  t.after(() => fs.rmSync(file, { force: true }));
  const s = await openSession(await suite.browser(), {
    t,
    workflow: "dashboard",
    payload: { menu: { note: "Nothing yet." }, agent: { status: "waiting" } },
  });
  const skip = s.page.getByRole("button", { name: "Skip the intro" });
  await skip.click();
  await skip.waitFor({ state: "hidden" });
  await s.page.getByRole("button", { name: "Set up preferences" }).click();
  await s.page.locator("#looks-modal[open]").waitFor();
  assert.equal(await selectedTab(s), "prefs-tab-appearance");
  await s.page.click("#prefs-tab-agents");
  const goose = s.page.locator('#agents-table .split-row[data-key="agent:goose"]');
  await goose.waitFor();
  assert.match(await textOf(goose.locator(".row-name")), /^Goose/);
  assert.equal(await s.page.locator('#agents-table .split-row[data-key="cli:claude"]').count(), 1, "the built-ins are listed");
  assert.doesNotMatch(await s.page.locator("#agents-status").innerText(), /could not be loaded/);
});

test("Back to default resets only the tab on screen, and is hidden on Agents & models and System", async (t) => {
  noSavedLooks(t);
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await s.page.click("#btn-looks");
  await s.page.locator('input[name="looks-theme"][value="dark"]').check();
  await swatch(s, "violet").click();
  await s.page.click("#prefs-tab-sounds");
  await s.page.locator("#looks-sound").uncheck();
  await s.page.locator("#looks-activities").check();

  await s.page.click("#prefs-tab-agents");
  assert.equal(await s.page.locator("#looks-reset").isHidden(), true, "hidden on Agents & models");
  await s.page.click("#prefs-tab-system");
  assert.equal(await s.page.locator("#looks-reset").isHidden(), true, "hidden on System");

  await s.page.click("#prefs-tab-appearance");
  await s.page.click("#looks-reset");
  await s.page.waitForFunction(() => !document.documentElement.hasAttribute("data-theme"));
  assert.equal(await swatch(s, "violet").getAttribute("aria-pressed"), "false");
  await s.page.click("#prefs-tab-sounds");
  assert.equal(await s.page.locator("#looks-sound").isChecked(), false, "Appearance's reset left sounds off");
  assert.equal(await s.page.locator("#looks-activities").isChecked(), true, "and Activities on");

  await s.page.click("#prefs-tab-appearance");
  await s.page.locator('input[name="looks-theme"][value="dark"]').check();
  await s.page.click("#prefs-tab-sounds");
  await s.page.click("#looks-reset");
  await s.page.locator("#looks-sound:checked").waitFor();
  assert.equal(await s.page.locator("#looks-activities").isChecked(), false, "the sounds reset puts Activities back off");
  assert.equal(await root(s, "data-theme"), "dark", "the sounds reset left the dark theme");
  await s.page.waitForFunction(async () => {
    const saved = (await (await fetch("/looks")).json()).looks || {};
    return saved.sound === true && saved.hideActivities === true && saved.theme === "dark";
  });
});

test("a theme change shows Saved level with the Theme legend, outside the fieldset's grid", async (t) => {
  noSavedLooks(t);
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await s.page.click("#btn-looks");
  await s.page.locator('input[name="looks-theme"][value="light"]').check();
  const mark = s.page.locator('fieldset[data-section="theme"] .prefs-saved');
  await mark.filter({ hasText: "Saved" }).waitFor();
  assert.equal(await mark.getAttribute("role"), "status");
  // Out of the fieldset's grid: the three choices still share one row.
  assert.equal(await styleOf(mark, "position"), "absolute");
  const tops = await s.page.locator('fieldset[data-section="theme"] label').evaluateAll((ls) => ls.map((l) => l.offsetTop));
  assert.equal(new Set(tops).size, 1, `the theme choices sit on one row: ${tops}`);
});

test("a save the server refuses shows its error in the Saved mark's place, until a save lands", async (t) => {
  noSavedLooks(t);
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  let refuse = true;
  await s.page.route("**/looks", (route) =>
    refuse && route.request().method() === "POST"
      ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Disk is full." }) })
      : route.continue()
  );
  await s.page.click("#btn-looks");
  await s.page.locator('input[name="looks-theme"][value="dark"]').check();
  const mark = s.page.locator('fieldset[data-section="theme"] .prefs-saved');
  await mark.filter({ hasText: "Disk is full." }).waitFor();
  assert.equal(await mark.evaluate((m) => m.classList.contains("error")), true);
  refuse = false;
  await s.page.locator('input[name="looks-theme"][value="light"]').check();
  await mark.filter({ hasText: "Saved" }).waitFor();
  assert.equal(await mark.evaluate((m) => m.classList.contains("error")), false, "the error clears once a save lands");
});

test("a Preferences tab is named by its label alone, with the hint as its description", async (t) => {
  noSavedLooks(t);
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await s.page.click("#btn-looks");
  for (const name of ["Appearance", "Agents & models", "System", "Sounds & activities"]) {
    assert.equal(await s.page.getByRole("tab", { name, exact: true }).count(), 1, `a tab named ${name}`);
  }
  const tab = s.page.locator("#prefs-tab-system");
  assert.equal(await textOf(s.page.locator("#" + (await tab.getAttribute("aria-describedby")))), "Cleanup, desktop app");
});

// Read from the Subagents dialog at 1000 px before Preferences moved to tabs:
// it borrows Preferences' .looks classes, and must not change with them.
const SUBAGENTS_BEFORE = {
  modal: { "max-width": "none", width: "900px" },
  row: { display: "grid", "grid-template-columns": "repeat(2, minmax(0px, 1fr))", "margin-top": "0px" },
  second: { "margin-top": "0px" },
  actions: { display: "flex", "justify-content": "flex-end" },
};

test("the Subagents dialog looks as it did before Preferences moved to tabs", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "implement", payload: { agent: { status: "working", activity: "Task 1 of 2" } } });
  await s.page.setViewportSize({ width: 1000, height: 800 });
  const modal = s.page.locator("#subagents-modal");
  await s.page.locator("#btn-subagents").click();
  await modal.waitFor();
  const got = {
    modal: await stylesOf(modal, ["max-width", "width"]),
    row: await stylesOf(modal.locator("fieldset.looks-row").first(), ["display", "grid-template-columns", "margin-top"]),
    second: await stylesOf(modal.locator("fieldset.modal-ranges").nth(1), ["margin-top"]),
    actions: await stylesOf(modal.locator(".modal-actions"), ["display", "justify-content"]),
  };
  if (process.env.P2C_PRINT_SUBAGENTS) console.log("SUBAGENTS " + JSON.stringify(got));
  assert.deepEqual(got, SUBAGENTS_BEFORE);
});
