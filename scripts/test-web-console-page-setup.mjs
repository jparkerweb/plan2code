// Page tests for the agent-less setup page (`console.mjs open --workflow
// setup`, with or without --for-cli): the three found states and their way
// forward, the forCli ordering, Check again, Use it from here, a template
// becoming a custom agent, Start and its grace line, the /handover move, and
// the quiet chrome an agent-less session keeps. Run with:
// node --test scripts/test-web-console-page-setup.mjs
//
// Each test drives the real console in a real Chrome or Edge through
// scripts/page-test-helpers.mjs: one browser for the file, a fresh console
// session per test. The found states are deterministic: a shipped agents.json
// written under MODELS_DIR/bin before the server starts, fake .cmd files (one
// file name is found on every OS), PATH pointed at a fixture dir, npm's
// global folder at an empty prefix and the saved Windows PATH switched off.
// That is the same recipe test-web-console-server.mjs's agentFixtures() uses.
//
// The page is the agents view's "setup" mount (agents-view.js on
// .setup-agents), a master-detail split: button.split-row[data-key] rows in
// [data-av="table"] on the left, the picked row's state and way forward
// (Start, Use it from here, the install lines, a template's Use) drawn as
// .setup-detail in [data-av="form"] on the right after the row is clicked.
// Row badges are drawn on first load; everything actionable wants the click.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { pageSuite, openSession, tempProject, textOf, scrollCard } from "./page-test-helpers.mjs";
import { cli, sessionUrl, readState, until, MODELS_DIR } from "./web-console-test-helpers.mjs";

const suite = pageSuite(test);

// The desktop-app markers a spawned console must never carry into these
// tests: test-web-console-server.mjs's NO_APP, plus the setup hand-over pair,
// which would turn a plain `open` into a hand-over of its own.
const NO_APP = {
  PLAN2CODE_IN_APP: undefined,
  PLAN2CODE_APP_TOKEN: undefined,
  PLAN2CODE_APP_ANNOUNCE: undefined,
  PLAN2CODE_EMBED_ORIGIN: undefined,
  PLAN2CODE_CONSOLE_SID: undefined,
  PLAN2CODE_APP_VERSION: undefined,
  PLAN2CODE_SETUP_ANNOUNCE: undefined,
  PLAN2CODE_SETUP_TOKEN: undefined,
};

const PATH_KEY = Object.keys(process.env).find((k) => k.toUpperCase() === "PATH") || "PATH";
const OS_KEY = process.platform === "win32" ? "win" : process.platform === "darwin" ? "mac" : "linux";

const SHIPPED_FILE = path.join(MODELS_DIR, "bin", "agents.json");
const USER_AGENTS_FILE = path.join(MODELS_DIR, "agents.json");

// The missing builtin's install lines, one list per OS; the server serves
// only this OS's. Windows carries a note so that part of the row is checked.
const INSTALL = {
  win: [{ label: "PowerShell", run: "irm https://example.com/gone | iex", note: "Run it in an elevated shell." }],
  mac: [{ label: "Terminal", run: "brew install gone-agent" }],
  linux: [{ label: "Terminal", run: "apt install gone-agent" }],
};

// Fake commands and a shipped list that put one builtin in each state: two on
// PATH (for the --for-cli ordering), one only in its installDirs, one
// nowhere. `npmCommands` are bare names dropped into the fake npm global bin,
// where a custom agent's command reads as "outside". Everything is written
// before the session's server starts, and removed after the test.
function agentFixtures(t, { userAgents = [], npmCommands = [] } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-setup-"));
  const onPath = path.join(base, "onpath");
  const outside = path.join(base, "outside");
  const npmPrefix = path.join(base, "npm-prefix");
  const npmBin = process.platform === "win32" ? npmPrefix : path.join(npmPrefix, "bin");
  fs.mkdirSync(onPath, { recursive: true });
  fs.mkdirSync(outside, { recursive: true });
  fs.mkdirSync(npmBin, { recursive: true });
  fs.writeFileSync(path.join(onPath, "found-one.cmd"), "@rem stand-in\r\n");
  fs.writeFileSync(path.join(onPath, "found-two.cmd"), "@rem stand-in\r\n");
  fs.writeFileSync(path.join(outside, "outer.cmd"), "@rem stand-in\r\n");
  for (const name of npmCommands) fs.writeFileSync(path.join(npmBin, name), "@rem stand-in\r\n");
  // The template's command is a path, so the agent its Save writes finds a file.
  const templar = path.join(base, "templar.cmd");
  fs.writeFileSync(templar, "@rem stand-in\r\n");

  const shipped = {
    schema: 1,
    agents: [
      { id: "found-one", name: "Found One", kind: "builtin", command: "found-one.cmd" },
      { id: "found-two", name: "Found Two", kind: "builtin", command: "found-two.cmd" },
      {
        id: "outer",
        name: "Outer Agent",
        kind: "builtin",
        command: "outer.cmd",
        installDirs: { win: [outside], mac: [outside], linux: [outside] },
      },
      {
        id: "gone",
        name: "Gone Agent",
        kind: "builtin",
        command: "p2c-gone-xyz.cmd",
        installUrl: "https://example.com/gone",
        install: INSTALL,
      },
      {
        id: "templar",
        name: "Templar",
        kind: "template",
        command: templar,
        prompt: "/plan2code",
        args: ["{prompt}"],
        note: "A starter agent.",
      },
    ],
  };
  fs.mkdirSync(path.dirname(SHIPPED_FILE), { recursive: true });
  fs.writeFileSync(SHIPPED_FILE, JSON.stringify(shipped));
  if (userAgents.length) {
    fs.writeFileSync(USER_AGENTS_FILE, JSON.stringify({ schema: 1, agents: userAgents }));
  } else {
    fs.rmSync(USER_AGENTS_FILE, { force: true });
  }
  t.after(() => {
    fs.rmSync(SHIPPED_FILE, { force: true });
    fs.rmSync(USER_AGENTS_FILE, { force: true });
    fs.rmSync(base, { recursive: true, force: true });
  });

  const env = {
    ...NO_APP,
    PLAN2CODE_NO_SAVED_PATH: "1",
    npm_config_prefix: npmPrefix,
    [PATH_KEY]: onPath + path.delimiter + (process.env[PATH_KEY] || ""),
  };
  return { base, onPath, outside, npmBin, templar, env };
}

// The split's left column and the detail pane. Rows are found by data-key
// ("setup:<id>" for builtins and custom agents, "setup:<template name>" for
// templates) rather than by name: a custom agent saved from a template shares
// the template's name, and only the key keeps them apart.
const table = (s) => s.page.locator('.setup-agents [data-av="table"]');
const rowByKey = (s, key) => table(s).locator(`button.split-row[data-key="setup:${key}"]`);
const pane = (s) => s.page.locator('.setup-agents [data-av="form"]');
const detail = (s) => pane(s).locator(".setup-detail");
const button = (s, name) => s.page.getByRole("button", { name, exact: true });
const checkAgain = (s) => s.page.locator(".setup-actions").getByRole("button", { name: "Check again", exact: true });

// Click a row and wait for the pane to draw that entry's .setup-detail: the
// .prefs-agents-title names the picked agent or template.
async function pick(s, key, name) {
  await rowByKey(s, key).click();
  const d = detail(s);
  await d.locator(".prefs-agents-title").getByText(name, { exact: true }).waitFor();
  return d;
}

test("the setup page renders found, outside and missing rows with their way forward", async (t) => {
  const f = agentFixtures(t);
  const s = await openSession(await suite.browser(), { t, workflow: "setup", env: f.env });
  await s.page.locator(".setup-screen h2", { hasText: "No agent yet" }).waitFor();
  assert.equal(await s.page.locator('.setup-stage [data-pose="setup"]').count(), 1, "Planny's setup pose");
  await rowByKey(s, "gone").waitFor();
  assert.equal(await s.page.locator('.setup-agents [data-av="intro"]').count(), 1, "the intro line");
  assert.equal(await s.page.locator(".setup-agents .split").count(), 1, "the split layout");
  assert.equal(await s.page.locator('.setup-agents [data-av="status"]').count(), 1, "the status line");
  assert.equal(await table(s).locator("button.split-row").count(), 5, "the four builtin rows and the template");
  // Nothing picked yet: the pane shows the empty text, and the row badges are
  // already drawn with each entry's state.
  assert.equal(await pane(s).locator(".split-empty").count(), 1, "the pane's empty text before a pick");
  assert.equal(await rowByKey(s, "found-one").locator(".prefs-badge.ok").count(), 1);
  assert.equal(await textOf(rowByKey(s, "found-one").locator(".prefs-badge")), "Found");
  assert.equal(await textOf(rowByKey(s, "outer").locator(".prefs-badge")), "Found outside PATH");
  assert.equal(await textOf(rowByKey(s, "gone").locator(".prefs-badge")), "Not found");

  // On PATH: the Found badge, the resolved path, and Start.
  const one = await pick(s, "found-one", "Found One");
  assert.match(await textOf(one.locator(".setup-agent-line")), /found-one\.cmd/, "the resolved path");
  assert.equal(await one.getByRole("button", { name: "Start with this agent", exact: true }).count(), 1);

  // In an install dir but not on PATH: where it is, Use it from here, a PATH note.
  const outer = await pick(s, "outer", "Outer Agent");
  assert.equal(await textOf(outer.locator(".setup-agent-line .prefs-badge")), "Found outside PATH");
  assert.match(await textOf(outer.locator(".setup-agent-line")), /Found at .+outer\.cmd, but not on PATH/);
  assert.equal(await outer.getByRole("button", { name: "Use it from here", exact: true }).count(), 1);
  assert.match(await textOf(outer.locator("p.help")), /add its folder to (your )?PATH/, "the do-it-yourself PATH note");

  // Nowhere: the install lines with Copy buttons, and the Install page link.
  const gone = await pick(s, "gone", "Gone Agent");
  assert.equal(await textOf(gone.locator(".prefs-badge")), "Not found");
  const steps = gone.locator(".setup-install");
  const want = INSTALL[OS_KEY];
  assert.equal(await steps.count(), want.length, "this OS's install lines");
  for (const [i, step] of want.entries()) {
    const d = steps.nth(i);
    assert.equal(await textOf(d.locator("span").first()), step.label);
    assert.equal(await textOf(d.locator("code")), step.run);
    if (step.note) assert.ok((await textOf(d)).includes(step.note), "the install note");
    assert.equal(await d.getByRole("button", { name: "Copy", exact: true }).count(), 1, "each line has Copy");
  }
  const installPage = gone.locator("a", { hasText: "Install page" });
  assert.equal(await installPage.count(), 1);
  assert.equal(await installPage.getAttribute("href"), "https://example.com/gone");
  assert.equal(await installPage.getAttribute("target"), "_blank");

  // The template head and row, its detail, and the two actions.
  const head = table(s).locator(".split-list-head");
  assert.equal(await head.count(), 1);
  assert.match(await textOf(head), /Or start from a template/);
  assert.match(await textOf(rowByKey(s, "Templar").locator(".row-name")), /Templar/);
  const tpl = await pick(s, "Templar", "Templar");
  assert.match(await textOf(tpl.locator("p.help")), /A starter agent\./);
  assert.equal(await tpl.getByRole("button", { name: "Use this template", exact: true }).count(), 1);
  assert.equal(await button(s, "Add agent").count(), 1);
  assert.equal(await checkAgain(s).count(), 1);
});

test("a session opened --for-cli lists that agent first and offers only its Start", async (t) => {
  const f = agentFixtures(t);
  const s = await openSession(await suite.browser(), { t, workflow: "setup", open: ["--for-cli", "found-two"], env: f.env });
  await rowByKey(s, "gone").waitFor();
  const rows = table(s).locator("button.split-row");
  const keys = [];
  for (let i = 0; i < (await rows.count()); i++) keys.push(await rows.nth(i).getAttribute("data-key"));
  assert.deepEqual(
    keys,
    ["setup:found-two", "setup:found-one", "setup:outer", "setup:gone", "setup:Templar"],
    "the forCli builtin leads, the rest keep shipped order"
  );
  const two = await pick(s, "found-two", "Found Two");
  assert.equal(await two.getByRole("button", { name: "Start with this agent", exact: true }).count(), 1, "the forCli agent can start");
  const one = await pick(s, "found-one", "Found One");
  assert.equal(await textOf(one.locator(".setup-agent-line .prefs-badge")), "Found");
  assert.equal(
    await one.getByRole("button", { name: "Start with this agent", exact: true }).count(),
    0,
    "another found agent is not offered"
  );
});

test("Check again re-fetches the states and redraws a row that changed", async (t) => {
  const f = agentFixtures(t);
  const s = await openSession(await suite.browser(), { t, workflow: "setup", env: f.env });
  const gone = await pick(s, "gone", "Gone Agent");
  await gone.locator(".prefs-badge.missing").waitFor();
  assert.equal(await textOf(gone.locator(".prefs-badge")), "Not found");
  assert.equal(await gone.getByRole("button", { name: "Start with this agent" }).count(), 0);
  // The command turns up on PATH between checks.
  fs.writeFileSync(path.join(f.onPath, "p2c-gone-xyz.cmd"), "@rem stand-in\r\n");
  await checkAgain(s).click();
  const goneRow = rowByKey(s, "gone");
  await goneRow.locator(".prefs-badge.ok").waitFor();
  assert.equal(await textOf(goneRow.locator(".prefs-badge")), "Found");
  // The picked row's pane re-drew with the new state too.
  const again = detail(s);
  await again.locator(".setup-agent-line .prefs-badge.ok").waitFor();
  assert.equal(await again.getByRole("button", { name: "Start with this agent", exact: true }).count(), 1);
});

test("Use it from here writes the found location and the row becomes found", async (t) => {
  const f = agentFixtures(t, { userAgents: [{ id: "mine", name: "Mine", command: "mine.cmd" }], npmCommands: ["mine.cmd"] });
  const s = await openSession(await suite.browser(), { t, workflow: "setup", env: f.env });
  const mine = rowByKey(s, "mine");
  const before = await pick(s, "mine", "Mine");
  await before.locator(".prefs-badge.missing").waitFor();
  assert.equal(await textOf(before.locator(".prefs-badge")), "Found outside PATH");
  await before.getByRole("button", { name: "Use it from here", exact: true }).click();
  await mine.locator(".prefs-badge.ok").waitFor();
  assert.equal(await textOf(mine.locator(".prefs-badge")), "Found");
  const saved = JSON.parse(fs.readFileSync(USER_AGENTS_FILE, "utf8"));
  assert.equal(saved.agents.length, 1);
  assert.equal(saved.agents[0].command, path.join(f.npmBin, "mine.cmd"), "the command is where it was found");
  // The picked pane re-drew: the now-found agent offers Start.
  const after = detail(s);
  await after.locator(".setup-agent-line .prefs-badge.ok").waitFor();
  assert.equal(await after.getByRole("button", { name: "Start with this agent", exact: true }).count(), 1);
});

test("Use it from here on the --for-cli agent still offers Start", async (t) => {
  // The materialized custom entry becomes the forCli target (a built-in's own
  // id can never name a custom entry), so Start survives the swap.
  const f = agentFixtures(t);
  const s = await openSession(await suite.browser(), { t, workflow: "setup", open: ["--for-cli", "outer"], env: f.env });
  const outer = await pick(s, "outer", "Outer Agent");
  await outer.getByRole("button", { name: "Use it from here", exact: true }).waitFor();
  await outer.getByRole("button", { name: "Use it from here", exact: true }).click();
  // The saved copy lands in the list under its own id ("outer-agent"), and
  // picking it shows the session's one Start moved onto it.
  await rowByKey(s, "outer-agent").waitFor();
  const savedRow = await pick(s, "outer-agent", "Outer Agent");
  const starts = savedRow.getByRole("button", { name: "Start with this agent", exact: true });
  await starts.waitFor();
  assert.equal(await starts.count(), 1, "the saved agent keeps the session's one Start");
  const one = await pick(s, "found-one", "Found One");
  assert.equal(await one.getByRole("button", { name: "Start with this agent" }).count(), 0, "no other row's Start");
});

test("Use this template fills the shared form, and Save lands a found custom agent", async (t) => {
  const f = agentFixtures(t);
  const s = await openSession(await suite.browser(), { t, workflow: "setup", env: f.env });
  await rowByKey(s, "gone").waitFor();
  // The template's row sits under the "Or start from a template" head; its
  // data-key keeps it apart from the same-named agent its Save will write.
  const tpl = await pick(s, "Templar", "Templar");
  await tpl.getByRole("button", { name: "Use this template", exact: true }).click();
  const form = pane(s);
  const name = form.locator('input[data-field="name"]');
  await name.waitFor();
  assert.equal(await name.inputValue(), "Templar");
  assert.equal(await form.locator('input[data-field="command"]').inputValue(), f.templar);
  assert.equal(await form.locator('input[data-field="prompt"]').inputValue(), "/plan2code");

  await form.getByRole("button", { name: "Save", exact: true }).click();
  await form.locator(".prefs-saved").filter({ hasText: "Saved" }).waitFor();
  const saved = JSON.parse(fs.readFileSync(USER_AGENTS_FILE, "utf8"));
  assert.equal(saved.schema, 1);
  assert.deepEqual(
    saved.agents.map((a) => [a.id, a.name, a.command]),
    [["templar", "Templar", f.templar]],
    "the template lands in agents.json"
  );

  // Back on the list the row is there as a custom agent: pick it (leaving a
  // clean form is always free on this page) and its pane carries an Edit.
  // Its state comes with the next fetch, which Check again is for.
  const templar = rowByKey(s, "templar");
  const again = await pick(s, "templar", "Templar");
  assert.equal(await again.getByRole("button", { name: "Edit Templar", exact: true }).count(), 1, "a custom agent pane gets Edit");
  await checkAgain(s).click();
  await templar.locator(".prefs-badge.ok").waitFor();
  assert.equal(await textOf(templar.locator(".prefs-badge")), "Found");
});

test("Start posts the __start action, the starting pane shows, then the grace line", async (t) => {
  const f = agentFixtures(t);
  const s = await openSession(await suite.browser(), { t, workflow: "setup", env: f.env });
  const one = await pick(s, "found-one", "Found One");
  await one.getByRole("button", { name: "Start with this agent", exact: true }).waitFor();
  // Shorten the two-minute grace so its line is observable in a test, but keep
  // it long enough that the hidden state is still checkable before it lands.
  await s.page.evaluate(() => {
    window.__P2C_SETUP_GRACE_MS = 400;
  });
  await one.getByRole("button", { name: "Start with this agent", exact: true }).click();
  const starting = s.page.locator(".setup-starting");
  await starting.waitFor();
  assert.match(await textOf(starting.locator(".launch-title")), /^Starting Found One/);
  // The pick is the session's result: the action the launcher's wait collects.
  const resultPath = path.join(s.session, "result.json");
  assert.equal(await until(() => fs.existsSync(resultPath), 5000), true, "result.json was written");
  const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
  assert.deepEqual(result.actions, [{ i: "__start", type: "start", agent: "found-one" }]);
  // The hint starts hidden; a move that never comes earns it after the grace wait.
  await s.page.waitForFunction(() => {
    const n = document.querySelector(".setup-no-page");
    return Boolean(n && n.hidden);
  });
  const noPage = starting.locator(".setup-no-page");
  await noPage.waitFor({ state: "visible" });
  assert.match(await textOf(noPage), /did not open a page\./);
});

test("a /handover post with the setup token moves the page to the new session", async (t) => {
  const f = agentFixtures(t);
  const s = await openSession(await suite.browser(), { t, workflow: "setup", env: f.env });
  await rowByKey(s, "found-one").waitFor();
  const otherDir = tempProject();
  const other = cli(["open", "--workflow", "plan", "--no-open"], { cwd: otherDir, env: f.env });
  t.after(() => cli(["stop", "--session", other.json.sid, "--force"], { cwd: otherDir }));
  const target = sessionUrl(other.json.url);
  const res = await fetch(`${sessionUrl(s.url).base}/handover`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-plan2code-token": readState(s.session).setup.token,
      connection: "close",
    },
    body: JSON.stringify({ url: other.json.url }),
  });
  assert.equal(res.status, 204);
  // The sign-in link sets the session cookie and lands on the session's root.
  await s.page.waitForURL((u) => u.origin === target.base && u.pathname === "/", { timeout: 15000 });
});

test("in the app's frame, the Install page link opens in the default browser through the console", async (t) => {
  const f = agentFixtures(t);
  // The app starts the setup console without the in-app flag: only the frame says it is there.
  const s = await openSession(await suite.browser(), {
    t,
    workflow: "setup",
    env: f.env,
    init: () => Object.defineProperty(window, "parent", { configurable: true, get: () => ({ postMessage() {} }) }),
  });
  const asked = [];
  await s.page.route("**/open-link", async (route) => {
    asked.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  let popups = 0;
  s.page.context().on("page", () => popups++);
  const gone = await pick(s, "gone", "Gone Agent");
  await gone.locator("a", { hasText: "Install page" }).click();
  await until(async () => asked.length === 1, 5000);
  assert.deepEqual(asked, [{ url: "https://example.com/gone" }]);
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(popups, 0, "no window opened inside the app");
});

test("the setup page scrolls its own pane so every agent option can be reached", async (t) => {
  const f = agentFixtures(t);
  const s = await openSession(await suite.browser(), { t, workflow: "setup", env: f.env });
  await s.page.locator(".setup-screen").waitFor();
  await rowByKey(s, "gone").waitFor();
  // A short window: the list and the buttons under it run past the fold.
  await s.page.setViewportSize({ width: 1200, height: 520 });
  const screen = s.page.locator(".setup-screen");
  // scrollCard fails unless the pane holds a scroll, so a clipped pane fails here.
  await scrollCard(screen, "end");
  const check = s.page.locator(".setup-actions button", { hasText: "Check again" });
  const [box, pane] = await Promise.all([check.boundingBox(), screen.boundingBox()]);
  assert.ok(box.y + box.height <= pane.y + pane.height + 1, "the last control is reachable at the pane's bottom");
});

test("the setup page keeps no agent-silence UI: no adrift or offline lines, no Ask, top bar down to Help", async (t) => {
  const f = agentFixtures(t);
  const s = await openSession(await suite.browser(), { t, workflow: "setup", env: f.env });
  await s.page.locator(".setup-screen").waitFor();
  const check = async (when) => {
    assert.match(await s.page.locator("#planny").getAttribute("class"), /\bis-setup\b/, `${when}: Planny's mood`);
    assert.match(await textOf(s.page.locator("#agent-text")), /No agent yet\. Pick one below/, `${when}: the dock line`);
    assert.equal(await s.page.locator("#banner").isHidden(), true, `${when}: no banner`);
    assert.equal(await s.page.locator("#btn-about").isVisible(), true, `${when}: Help stays`);
    const tabs = (await s.page.locator(".view-tab").allInnerTexts()).map((x) => x.trim());
    assert.equal(tabs.some((x) => /ask|subagents/i.test(x)), false, `${when}: no Ask or Subagents tab (${tabs})`);
    for (const id of ["meter-pill", "btn-activities", "btn-subagents", "btn-home", "btn-stop", "btn-brief", "btn-notepad"]) {
      assert.equal(await s.page.locator("#" + id).isHidden(), true, `${when}: #${id} is hidden`);
    }
  };
  await check("on load");
  // A quiet stretch changes nothing: the silence states are switched off.
  await s.page.waitForTimeout(1500);
  await check("after a wait");
});
