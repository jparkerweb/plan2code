// Page tests for the Implementation Loop's setup screen. The dashboard card
// that opens it only shows inside the desktop app, so these open the screen
// through its own module, then drive the real page. Run with:
// node --test scripts/test-web-console-page-loop.mjs

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pageSuite, openSession, tempProject, textOf } from "./page-test-helpers.mjs";
import { MODELS_DIR } from "./web-console-test-helpers.mjs";

const suite = pageSuite(test);

const PROJECT = {
  "AGENTS.md": "# AGENTS.md\n\nA small demo project.\n",
  "specs/ready/overview.md": "# Overview\n\n## Phase Checklist\n\n- [ ] Phase 1: One\n- [ ] Phase 2: Two\n",
  "specs/ready/phase-1.md": "# Phase 1\n\n- [ ] **Task 1.1:** One\n",
  "specs/ready/phase-2.md": "# Phase 2\n\n- [ ] **Task 2.1:** Two\n",
};

const MENU = { menu: { note: "Ready when you are." }, agent: { status: "waiting" } };

async function openSetup(t) {
  const browser = await suite.browser();
  const s = await openSession(browser, { t, workflow: "dashboard", payload: MENU, project: tempProject(PROJECT) });
  // Past Planny's wake-up and, on a first run, the Welcome.
  const skip = s.page.getByRole("button", { name: "Skip the intro" });
  await skip.click();
  await skip.waitFor({ state: "hidden" });
  await s.page.locator("#main").getByRole("heading", { name: "What are we doing today?" }).waitFor();
  const welcomeDone = s.page.getByRole("button", { name: "Start building" });
  if (await welcomeDone.isVisible()) {
    await welcomeDone.click();
    await welcomeDone.waitFor({ state: "hidden" });
  }
  await s.page.evaluate(async () => {
    const m = await import(new URL("screens/loop-setup.js", document.baseURI).href);
    await m.openLoopSetup({ dir: "specs/ready" });
  });
  await s.page.locator("#loop-start").waitFor();
  return s;
}

test("the setup lists each phase on its own line, in the agreed order of fields and radios", async (t) => {
  const s = await openSetup(t);
  const left = s.page.locator(".loop-fact dd").first();
  assert.equal(await textOf(left), "Phase 1: One\nPhase 2: Two");

  const labels = await s.page.locator(".loop-label").allInnerTexts();
  assert.deepEqual(labels, [
    "Strength per phase",
    "Review",
    "Fix findings",
    "When a phase asks something",
    "After the last phase",
    "Send a notification",
    "Quick check",
    "If a phase crashes or goes quiet",
    "Commit",
  ]);
  const radios = (name) => s.page.locator(`input[name="${name}"]`).evaluateAll((all) => all.map((r) => [r.id, r.checked]));
  assert.deepEqual(await radios("fixmode"), [["loop-fixmode-smart", true], ["loop-fixmode-levels", false]]);
  assert.deepEqual(await radios("onquestion"), [["loop-onquestion-guess", true], ["loop-onquestion-pause", false], ["loop-onquestion-stop", false]]);
});

test("the web address field shows the name only beside an address, warns while typing and saves", async (t) => {
  const s = await openSetup(t);
  const url = s.page.locator("#loop-notify-url");
  const param = s.page.locator("#loop-notify-param");
  const warn = s.page.locator(".loop-field", { hasText: "Send a notification" }).locator(".loop-warn");

  assert.equal(await url.inputValue(), "");
  assert.equal(await param.isVisible(), false, "no address, no name to set");
  const phases = s.page.locator("#loop-notify-phases");
  assert.equal(await phases.isVisible(), false, "no address, no phase messages to choose");
  assert.equal(await warn.isVisible(), false);

  await url.fill("example.com");
  assert.match(await textOf(warn), /must start with http:\/\/ or https:\/\//);
  await url.fill("https://me:secret@example.com/");
  assert.match(await textOf(warn), /Leave out any user name or password/);
  await url.fill("https://example.com/hook?team=a");
  assert.equal(await warn.isVisible(), false);
  assert.equal(await param.isVisible(), true);
  assert.equal(await param.inputValue(), "message", "the default name");
  assert.equal(await phases.isVisible(), true);
  assert.equal(await phases.isChecked(), false, "a message per phase is opt-in");
  await phases.check();

  await param.fill("a b");
  assert.match(await textOf(warn), /letters, digits/);
  await param.fill("msg");
  assert.equal(await warn.isVisible(), false);

  // What Start would send; Start itself waits on facts only the app gives.
  const saved = await s.page.evaluate(async () => {
    const { page } = await import(new URL("state.js", document.baseURI).href);
    const res = await fetch("/loop-setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(page.loopSetup.form),
    });
    return { status: res.status, body: await res.json() };
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const reread = await s.page.evaluate(async () => (await fetch("/loop-setup")).json());
  assert.equal(reread.notifyUrl, "https://example.com/hook?team=a");
  assert.equal(reread.notifyParam, "msg");
  assert.equal(reread.notifyPhases, true, "the box is saved with the setup");
  assert.equal(reread.remembered, true);
});

// Stands a real window in for the app that frames the page, listening to what
// the page tells it; `answer` then replies the way the app's window does.
async function frameInFakeApp(s) {
  await s.page.evaluate(() => {
    const frame = document.createElement("iframe");
    frame.hidden = true;
    document.body.appendChild(frame);
    const app = frame.contentWindow;
    window.__told = [];
    app.postMessage = (message) => window.__told.push(message);
    Object.defineProperty(window, "parent", { value: app, configurable: true });
  });
  return (data) =>
    s.page.evaluate((message) => {
      window.dispatchEvent(new MessageEvent("message", { source: window.parent, data: message }));
    }, data);
}

test("Cancel in the app's confirm leaves Start ready to press again; a real start locks it", async (t) => {
  const s = await openSetup(t);
  const answer = await frameInFakeApp(s);
  const start = s.page.locator("#loop-start");
  const asked = () => s.page.evaluate(() => window.__told.filter((m) => m.plan2code === "loop-start").length);
  await answer({ plan2code: "loop-facts", facts: { permissionMode: "skip", promptSupport: true } });
  await s.page.waitForFunction(() => !document.getElementById("loop-start").disabled);

  await start.click();
  await s.page.waitForFunction(() => window.__told.some((m) => m.plan2code === "loop-start"));
  await s.page.getByText("Waiting for the app's confirm...").waitFor();
  assert.equal(await start.isDisabled(), true, "no second confirm while one is open");

  await answer({ plan2code: "loop-start-result", ok: true, started: false, error: null });
  await s.page.getByText("Waiting for the app's confirm...").waitFor({ state: "hidden" });
  assert.equal(await start.isDisabled(), false, "pressing Cancel gives the button back");
  assert.doesNotMatch(await textOf(s.page.locator(".loop-start")), /The loop is starting/);

  await start.click();
  await s.page.waitForFunction(() => window.__told.filter((m) => m.plan2code === "loop-start").length === 2);
  assert.equal(await asked(), 2, "and it asks the app again");

  await answer({ plan2code: "loop-start-result", ok: true, started: true, error: null });
  await s.page.getByText("The loop is starting...").waitFor();
  assert.equal(await start.isDisabled(), true);
});

test("Send a test saves what is on screen, names nothing to the app, and shows what the app answered", async (t) => {
  const s = await openSetup(t);
  const answer = await frameInFakeApp(s);
  const button = s.page.locator("#loop-notify-test");
  const url = s.page.locator("#loop-notify-url");
  const told = () => s.page.evaluate(() => window.__told.filter((m) => m.plan2code === "loop-notify-test"));
  const line = s.page.locator(".loop-test p");

  assert.equal(await button.isDisabled(), true, "nothing to test yet");
  await url.fill("example.com");
  assert.equal(await button.isDisabled(), true, "not an address yet");
  await url.fill("https://hooks.slack.com/services/T/B/x");
  assert.equal(await button.isDisabled(), false);

  await button.click();
  await s.page.waitForFunction(() => window.__told.some((m) => m.plan2code === "loop-notify-test"));
  assert.deepEqual(await told(), [{ plan2code: "loop-notify-test" }], "no address in the message");
  const saved = await s.page.evaluate(async () => (await fetch("/loop-setup")).json());
  assert.equal(saved.notifyUrl, "https://hooks.slack.com/services/T/B/x", "saved before the app was asked");
  assert.equal(saved.notifyKind, "slack");
  assert.match(await line.innerText(), /Waiting for the app's confirm/);
  assert.equal(await button.isDisabled(), true, "one test at a time");

  await answer({ plan2code: "loop-notify-test-result", ok: false, sent: false, error: "The test was not sent: it answered 404" });
  await s.page.locator(".loop-test p.loop-error").waitFor();
  assert.equal(await line.innerText(), "The test was not sent: it answered 404");
  assert.equal(await url.inputValue(), "https://hooks.slack.com/services/T/B/x", "the redraw kept the address");

  await s.page.locator("#loop-notify-test").click();
  await line.getByText("Waiting").waitFor();
  await answer({ plan2code: "loop-notify-test-result", ok: true, sent: true, error: null });
  await line.getByText("Check that the message arrived").waitFor();

  await s.page.locator("#loop-notify-url").fill("https://hooks.slack.com/services/T/B/y");
  assert.equal(await line.count(), 0, "a changed address forgets what the test said");

  // Cancel in the app's confirm: nothing to report.
  await s.page.locator("#loop-notify-test").click();
  await line.getByText("Waiting").waitFor();
  await answer({ plan2code: "loop-notify-test-result", ok: true, sent: false, error: null });
  await s.page.waitForFunction(() => !document.querySelector(".loop-test p"));
  assert.equal(await s.page.locator("#loop-notify-test").isDisabled(), false);
});

test("a pasted webhook picks its own kind, a chat service hides the name, and a kind chosen by hand stays", async (t) => {
  const s = await openSetup(t);
  const kind = s.page.locator("#loop-notify-kind");
  const url = s.page.locator("#loop-notify-url");
  const param = s.page.locator("#loop-notify-param");

  assert.equal(await kind.inputValue(), "query");
  for (const [address, expected] of [
    ["https://discord.com/api/webhooks/1/abc", "discord"],
    ["https://hooks.slack.com/services/T/B/x", "slack"],
    ["https://chat.googleapis.com/v1/spaces/A/messages?key=k", "google-chat"],
    ["https://prod-1.westus.logic.azure.com/workflows/x", "teams"],
  ]) {
    await kind.selectOption("query");
    await s.page.evaluate(async () => {
      const { page } = await import(new URL("state.js", document.baseURI).href);
      page.loopSetup.notifyKindChosen = false;
    });
    await url.fill(address);
    assert.equal(await kind.inputValue(), expected, address);
    assert.equal(await param.isVisible(), false, "the service fixes the field");
  }

  // The person's own choice wins over what the address looks like.
  await kind.selectOption("query");
  await url.fill("https://discord.com/api/webhooks/2/def");
  assert.equal(await kind.inputValue(), "query");
  assert.equal(await param.isVisible(), true);

  await kind.selectOption("json");
  assert.equal(await s.page.locator('label:has(#loop-notify-param) span').innerText(), "JSON field name for the message");
  await kind.selectOption("slack");
  assert.equal(await url.getAttribute("placeholder"), "https://hooks.slack.com/services/...");

  const saved = await s.page.evaluate(async () => {
    const { page } = await import(new URL("state.js", document.baseURI).href);
    const res = await fetch("/loop-setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(page.loopSetup.form) });
    return res.status;
  });
  assert.equal(saved, 200);
  assert.equal((await s.page.evaluate(async () => (await fetch("/loop-setup")).json())).notifyKind, "slack");
});

test("the finish card counts each kind of decision per phase and opens on the full report", async (t) => {
  const s = await openSetup(t);
  const seen = await s.page.evaluate(async () => {
    const m = await import(new URL("screens/ending.js", document.baseURI).href);
    const card = m.renderLoopEnd({
      kind: "finished",
      line: "All 1 phases built",
      phases: [{ n: 2, name: "API", commit: "abc1234", unfixed: 3, retries: 1, fixed: 4, skipped: 2, left: 1, assumed: 5, decisions: 6 }],
      uncommitted: [],
      can: ["finalize", "dashboard"],
    });
    return {
      head: [...card.querySelectorAll("th")].map((c) => c.textContent),
      row: [...card.querySelectorAll("td")].map((c) => c.textContent),
      actions: [...card.querySelectorAll(".loop-end-actions button")].map((b) => b.textContent),
    };
  });
  assert.deepEqual(seen.head, ["Phase", "Commit", "Fixed", "Not fixed", "Left open", "Assumed", "Other decisions", "Retries"]);
  assert.deepEqual(seen.row.slice(0, 1), ["Phase 2: API"]);
  assert.deepEqual(seen.row.slice(2), ["4", "2", "1", "5", "6", "1"]);
  assert.deepEqual(seen.actions, ["Finalize", "Back to the dashboard"], "the way home is offered next to Finalize");
});

test("a stopped loop offers Ask a question, which tells the app and wakes no loop", async (t) => {
  const s = await openSetup(t);
  await frameInFakeApp(s);
  const seen = await s.page.evaluate(async () => {
    const m = await import(new URL("screens/ending.js", document.baseURI).href);
    const card = m.renderLoopEnd({
      kind: "stopped",
      line: "Phase 5 stopped",
      phases: [{ n: 5, name: "Docs", commit: null, unfixed: 0, retries: 0 }],
      uncommitted: [],
      can: ["ask", "resume", "fix", "dashboard"],
    });
    const buttons = [...card.querySelectorAll(".loop-end-actions button")];
    const ask = buttons.find((b) => b.textContent === "Ask a question");
    if (ask) ask.click();
    return { labels: buttons.map((b) => b.textContent), told: window.__told.map((x) => x.plan2code) };
  });
  assert.deepEqual(seen.labels, ["Ask a question", "Continue building", "Fix together with an agent", "Back to the dashboard"]);
  assert.deepEqual(seen.told, ["loop-ask"]);
});

// Draws a stopped card in the page and reads what a person sees on it.
async function drawStop(s, end) {
  return s.page.evaluate(async (end) => {
    const m = await import(new URL("screens/ending.js", document.baseURI).href);
    const card = m.renderLoopEnd(end);
    const choices = [...card.querySelectorAll(".loop-end-choice")];
    const details = card.querySelector("details.loop-end-details");
    return {
      heading: card.querySelector("h2").textContent,
      line: card.querySelector(".loop-line")?.textContent ?? null,
      safe: card.querySelector(".loop-end-safe")?.textContent ?? null,
      choices: choices.map((c) => ({ label: c.querySelector("button").textContent, primary: c.querySelector("button").classList.contains("primary"), hint: c.querySelector(".loop-end-hint").textContent })),
      details: details ? { open: details.open, summary: details.querySelector("summary").textContent, hasTable: Boolean(details.querySelector("table")), files: details.querySelectorAll("li").length } : null,
      tableOutside: Boolean(card.querySelector(":scope > table")),
      order: [...card.children].map((c) => c.className || c.tagName),
    };
  }, end);
}

const HARD_STOP = {
  kind: "stopped",
  line: "Phase 3 stopped: 1 test outside this spec failed (test-web-console-shape.mjs: a raw locator.evaluate reads a style and the redraw replaced the card in between)",
  reason: "Phase 3 stopped on a problem the loop cannot fix by itself.",
  recommend: "fix",
  phase: 3,
  // Phase 4 is still to come: the button lines must name Phase 3, not the last row.
  phases: [{ n: 2, name: "API", commit: "abc1234", unfixed: 0, retries: 0 }, { n: 3, name: "Docs", commit: null, unfixed: 0, retries: 0 }, { n: 4, name: "Polish", commit: null, unfixed: 0, retries: 0 }],
  uncommitted: ["src/a.js", "src/b.js"],
  can: ["ask", "resume", "fix", "dashboard"],
};

test("a stopped loop leads with its short reason and puts the long line under it", async (t) => {
  const s = await openSetup(t);
  const seen = await drawStop(s, HARD_STOP);
  assert.equal(seen.heading, HARD_STOP.reason);
  assert.equal(seen.line, HARD_STOP.line, "the full line is still there, under the heading");
  const old = await drawStop(s, { ...HARD_STOP, reason: undefined, recommend: undefined });
  assert.equal(old.heading, HARD_STOP.line, "an older app without a reason keeps its line as the heading");
});

test("every stop-screen button carries one plain line saying what it does", async (t) => {
  const s = await openSetup(t);
  const seen = await drawStop(s, HARD_STOP);
  assert.deepEqual(
    seen.choices.map((c) => [c.label, c.hint]),
    [
      ["Ask a question", "Wake an agent that answers your questions in the Ask tab. It changes nothing."],
      ["Continue building", "Carry on unattended from Phase 3, the way the loop was running."],
      ["Fix together with an agent", "Open a normal session on Phase 3 to fix this together with an agent."],
      ["Back to the dashboard", "Leave this screen and pick another skill. Your work stays as it is."],
    ],
  );
  const old = await drawStop(s, { ...HARD_STOP, phase: undefined });
  assert.equal(old.choices[1].hint, "Carry on unattended from where it stopped, the way the loop was running.", "an older app names no phase, and the line guesses none");
  const fin = await drawStop(s, { kind: "finished", line: "All 2 phases built", phases: [], uncommitted: [], can: ["finalize", "dashboard"] });
  assert.deepEqual(fin.choices.map((c) => c.hint), ["Write the feature's summary and move its spec to specs--completed/.", "Leave this screen and pick another skill. Your work stays as it is."]);
  assert.deepEqual(fin.choices.map((c) => c.primary), [true, false], "Finalize is the finish screen's one primary button");
});

test("only the recommended button is primary: Fix together after a hard stop, Continue building after a soft one", async (t) => {
  const s = await openSetup(t);
  const hard = await drawStop(s, HARD_STOP);
  assert.deepEqual(hard.choices.filter((c) => c.primary).map((c) => c.label), ["Fix together with an agent"]);
  const soft = await drawStop(s, { ...HARD_STOP, reason: "Phase 3 stopped because the agent crashed.", recommend: "resume" });
  assert.deepEqual(soft.choices.filter((c) => c.primary).map((c) => c.label), ["Continue building"]);
  const old = await drawStop(s, { ...HARD_STOP, recommend: undefined });
  assert.deepEqual(old.choices.filter((c) => c.primary).map((c) => c.label), ["Continue building"], "an older app's stop keeps Continue building as the one primary");
});

test("a stop says nothing is lost and keeps the phases and files under a closed Details, below the buttons", async (t) => {
  const s = await openSetup(t);
  const seen = await drawStop(s, HARD_STOP);
  assert.equal(seen.safe, "Nothing is lost. Your work stays on disk.");
  assert.deepEqual(seen.details, { open: false, summary: "Details: 3 phases, 2 uncommitted files", hasTable: true, files: 2 });
  assert.equal(seen.tableOutside, false, "no commit table between the reason and the buttons");
  const at = (cls) => seen.order.findIndex((c) => String(c).includes(cls));
  assert.ok(at("loop-end-safe") < at("loop-end-actions") && at("loop-end-actions") < at("loop-end-details"), seen.order.join(" > "));
  const fin = await drawStop(s, { kind: "finished", line: "All 1 phases built", phases: [{ n: 1, name: "API", commit: "abc1234", unfixed: 0, retries: 0 }], uncommitted: [], can: ["finalize", "dashboard"] });
  assert.equal(fin.safe, null, "the finish screen has nothing to reassure about");
  assert.equal(fin.details, null);
  assert.equal(fin.tableOutside, true, "the finish keeps its counts open");
});

test("once the app starts the Ask agent, Ask a question opens the Ask tab and never asks the app twice", async (t) => {
  const s = await openSetup(t);
  await frameInFakeApp(s);
  const seen = await s.page.evaluate(async (end) => {
    const m = await import(new URL("screens/ending.js", document.baseURI).href);
    const { page } = await import(new URL("state.js", document.baseURI).href);
    const askOf = (card) => [...card.querySelectorAll(".loop-end-choice")].find((c) => c.querySelector("button").textContent.includes("Ask"));
    const first = askOf(m.renderLoopEnd(end));
    first.querySelector("button").click();
    page.loopAction = { kind: "loop-ask-result", ok: true, error: null };
    const after = askOf(m.renderLoopEnd(end));
    const label = after.querySelector("button").textContent;
    const hint = after.querySelector(".loop-end-hint").textContent;
    after.querySelector("button").click();
    const view = page.view;
    page.view = "questions";
    page.loopAction = null;
    return { label, hint, view, told: window.__told.map((x) => x.plan2code) };
  }, HARD_STOP);
  assert.equal(seen.label, "Open the Ask tab");
  assert.equal(seen.hint, "The Ask agent is ready. Type your question in the Ask tab.");
  assert.equal(seen.view, "ask");
  assert.deepEqual(seen.told, ["loop-ask"], "the second press went to the Ask tab, not to the app");
});

test("after Continue building replaces the Ask agent, the same stop again offers Ask a question afresh", async (t) => {
  const s = await openSetup(t);
  await frameInFakeApp(s);
  const seen = await s.page.evaluate(async (end) => {
    const m = await import(new URL("screens/ending.js", document.baseURI).href);
    const { page } = await import(new URL("state.js", document.baseURI).href);
    const button = (card, text) => [...card.querySelectorAll(".loop-end-choice button")].find((b) => b.textContent.includes(text));
    button(m.renderLoopEnd(end), "Ask").click();
    page.loopAction = { kind: "loop-ask-result", ok: true, error: null };
    const asked = button(m.renderLoopEnd(end), "Ask").textContent;
    button(m.renderLoopEnd(end), "Continue building").click();
    page.loopAction = { kind: "loop-resume-result", ok: true, error: null };
    // The loop ran and stopped again, the same way.
    const again = button(m.renderLoopEnd(end), "Ask").textContent;
    page.loopAction = null;
    return { asked, again, told: window.__told.map((x) => x.plan2code) };
  }, HARD_STOP);
  assert.equal(seen.asked, "Open the Ask tab");
  assert.equal(seen.again, "Ask a question", "no Ask agent is left to open");
  assert.deepEqual(seen.told, ["loop-ask", "loop-resume"]);
});

// A real loop session: `open --loop` under the app's signal stamps the lock.
async function openLoopPage(t) {
  return openSession(await suite.browser(), {
    t,
    workflow: "implement",
    open: ["--loop"],
    env: { PLAN2CODE_IN_APP: "1" },
    payload: { title: "demo: Phase 1", headline: { stage: "Build", cleared: 9, total: 11 }, agent: { status: "working", activity: "Task 10 of 11" } },
    project: tempProject(PROJECT),
  });
}

const STOPPED = {
  kind: "stopped",
  line: "Phase 2 stopped",
  phases: [{ n: 2, name: "Docs", commit: null, unfixed: 0, retries: 0 }],
  uncommitted: [],
  can: ["ask", "resume", "fix", "dashboard"],
};
const ASK_HINT = "Press Ask a question to wake an agent, then ask in the Ask tab.";
const SETTLED = { id: "q1", kind: "text", title: "What to call it", body: "A short name.", status: "answered", answer: { text: "Flock" } };

// The notes panel (#aside) of a stopped loop's screen: the agent is gone, so a
// note box would reach nobody. It says how to ask instead.
async function asideOf(s) {
  await s.page.locator("#aside").waitFor();
  return { text: await textOf(s.page.locator("#aside")), boxes: await s.page.locator("#aside textarea, #aside .field").count() };
}

test("a stopped loop's notes panel says to press Ask a question, then ask in the Ask tab, and draws no note box", async (t) => {
  const s = await openLoopPage(t);
  s.post({ items: [SETTLED], loopEnd: STOPPED, agent: { status: "waiting" } });
  await s.page.locator(".loop-end-actions").waitFor();
  const aside = await asideOf(s);
  assert.ok(aside.text.includes(ASK_HINT), aside.text);
  assert.doesNotMatch(aside.text, /Nothing was said about this one/);
  assert.equal(aside.boxes, 0, "no note box on the stopped screen");
});

test("a stopped loop with a question left open still says how to ask and draws no note box", async (t) => {
  const s = await openLoopPage(t);
  s.post({ items: [{ id: "q2", kind: "text", title: "Which name", body: "A short name." }], loopEnd: STOPPED, agent: { status: "waiting" } });
  await s.page.locator(".loop-end-actions").waitFor();
  const aside = await asideOf(s);
  assert.ok(aside.text.includes(ASK_HINT), aside.text);
  assert.equal(aside.boxes, 0, "no agent to read a note");
});

test("a stopped loop that asked nothing still says how to ask", async (t) => {
  const s = await openLoopPage(t);
  s.post({ loopEnd: STOPPED, agent: { status: "waiting" } });
  await s.page.locator(".loop-end-actions").waitFor();
  const aside = await asideOf(s);
  assert.ok(aside.text.includes(ASK_HINT), aside.text);
  assert.equal(aside.boxes, 0);
});

test("a finished loop and a stop with no Ask keep the notes panel's old words", async (t) => {
  const s = await openLoopPage(t);
  s.post({ items: [SETTLED], loopEnd: { ...STOPPED, kind: "finished", line: "All phases done", can: ["finalize", "dashboard"] }, agent: { status: "waiting" } });
  await s.page.locator(".loop-end-actions").waitFor();
  let aside = await asideOf(s);
  assert.ok(!aside.text.includes(ASK_HINT), "a finished loop does not offer Ask");
  assert.match(aside.text, /Nothing was said about this one/);
  s.post({ loopEnd: { ...STOPPED, can: ["resume", "fix", "dashboard"] } });
  await s.page.getByRole("button", { name: "Continue building" }).waitFor();
  aside = await asideOf(s);
  assert.ok(!aside.text.includes(ASK_HINT), "no Ask button, so no hint to press it");
  assert.match(aside.text, /Nothing was said about this one/);
});

test("a loop at work tells the person they have nothing to do, and Send comes back when a question waits", async (t) => {
  const s = await openLoopPage(t);
  const foot = s.page.locator(".footer");
  const send = s.page.locator("#btn-send");
  await s.page.waitForFunction(() => document.querySelector(".footer")?.classList.contains("is-loop-idle"));
  assert.equal(await send.isVisible(), false, "no Send to suggest there is something to send");
  assert.equal(await s.page.locator("#footer-summary").isVisible(), false);
  assert.equal(await textOf(s.page.locator("#progress-text")), "9 of 11 tasks in this phase");
  assert.match(await textOf(s.page.locator("#main")), /The loop is running this phase by itself, so you don't need to do anything/);

  s.post({ items: [{ id: "q1", kind: "text", title: "What to call it", body: "A short name." }], agent: { status: "waiting" } });
  await s.page.waitForFunction(() => !document.querySelector(".footer").classList.contains("is-loop-idle"));
  assert.equal(await send.isVisible(), true, "the person has something to do now");
  assert.equal((await foot.getAttribute("class")).includes("is-loop-idle"), false);
});

test("an ordinary build keeps its Send, its count and its words", async (t) => {
  const s = await openSession(await suite.browser(), {
    t,
    workflow: "implement",
    payload: { title: "demo: Phase 1", headline: { stage: "Build", cleared: 9, total: 11 }, agent: { status: "working", activity: "Task 10 of 11" } },
    project: tempProject(PROJECT),
  });
  await s.page.locator("#progress-text").getByText("9 of 11 done").waitFor();
  assert.equal(await s.page.locator("#btn-send").isVisible(), true);
  assert.equal((await s.page.locator(".footer").getAttribute("class")).includes("is-loop-idle"), false);
  assert.match(await textOf(s.page.locator("#main")), /If Plan2Code needs you, the question appears here on its own/);
});

test("a phase that has reported says the loop is checking it, not that it is starting", async (t) => {
  const s = await openLoopPage(t);
  s.post({
    agent: { status: "waiting" },
    loopOutcome: {
      phase: 1,
      result: "failed",
      reason: "tests",
      summary: "One test fails",
      tests: { ran: true, passed: false, summary: "1 fail" },
      review: { ran: true, recheck: false, left: { critical: 0, warning: 0, suggestion: 0 }, fixed: [], unfixed: [] },
      tasks: { blocked: [], assumed: [] },
      conflicts: [],
      decisions: [],
      subject: "Add a thing",
    },
  });
  await s.page.getByRole("heading", { name: "The loop is checking this phase" }).waitFor();
  assert.doesNotMatch(await textOf(s.page.locator("#main")), /starting this phase/);
});

test("a loop phase still starting says the loop is starting it, and promises no approval prompt", async (t) => {
  const s = await openSession(await suite.browser(), {
    t,
    workflow: "implement",
    open: ["--loop"],
    env: { PLAN2CODE_IN_APP: "1" },
    project: tempProject(PROJECT),
  });
  await s.page.getByRole("heading", { name: "The loop is starting this phase" }).waitFor();
  assert.doesNotMatch(await textOf(s.page.locator("#main")), /pause for approvals/);
});

/* ------------------------------------------- Strength per phase (the section) */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LAUNCH = { agent: "claude", agentLabel: "Claude Code", model: "opus", effort: "medium", permissionMode: "bypass", promptSupport: true, running: false };

// The installed copy of the shipped model menu, with its strengths, as install.js drops it.
function installShippedModels() {
  const shipped = path.join(MODELS_DIR, "bin", "models.json");
  fs.mkdirSync(path.dirname(shipped), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "src", "launcher", "models.json"), shipped);
}

// The setup screen with the app's answer in: this launch choice, then the strengths read for it.
async function openStrengthSetup(t, launch = LAUNCH) {
  installShippedModels();
  const s = await openSetup(t);
  await s.page.evaluate(async (facts) => {
    const { page, redraw } = await import(new URL("state.js", document.baseURI).href);
    page.loopFacts = facts;
    redraw();
  }, launch);
  return s;
}

const strengthRows = (s) =>
  s.page.locator(".loop-strength-row").evaluateAll((rows) =>
    rows.map((r) => ({ phase: r.querySelector(".loop-strength-phase").textContent, pick: r.querySelector("input:checked")?.value ?? null, model: r.querySelector(".loop-strength-model").textContent }))
  );

// Each row is a radio group, one radio per column: #loop-strength-<n>-<word>, "match" for Match my session.
// The cell is clicked, as a person does: its dot sits over the hidden radio.
const pickStrength = async (s, n, word) => {
  const radio = s.page.locator(`#loop-strength-${n}-${word || "match"}`);
  await radio.locator("..").click();
  await s.page.locator(`#loop-strength-${n}-${word || "match"}:checked`).waitFor({ state: "attached" });
};

test("the strength section is first in the form and off by default", async (t) => {
  const s = await openStrengthSetup(t);
  const toggle = s.page.locator("#loop-phase-strength");
  await toggle.waitFor();
  assert.equal(await toggle.isChecked(), false);
  assert.equal(await s.page.locator(".loop-label").first().innerText(), "Strength per phase");
  assert.equal(await s.page.locator(".loop-strength-row").count(), 0, "no rows until the toggle is on");
  assert.equal(await s.page.locator("#loop-strength-all").count(), 0);
});

test("turning it on shows one row per phase left with the model each pick becomes, and Set all to fills them", async (t) => {
  const s = await openStrengthSetup(t);
  await s.page.locator("#loop-phase-strength").check();
  await s.page.locator(".loop-strength-row").first().waitFor();
  assert.deepEqual(await strengthRows(s), [
    { phase: "Phase 1: One", pick: "", model: "opus, medium" },
    { phase: "Phase 2: Two", pick: "", model: "opus, medium" },
  ], "untouched rows match the session and show the launch choice");

  await pickStrength(s, 1, "thrifty");
  assert.equal(await textOf(s.page.locator('[data-phase="1"] .loop-strength-model')), "sonnet, low");

  assert.equal(await s.page.locator("#loop-strength-all").inputValue(), "-", "Set all to starts blank");
  await s.page.locator("#loop-strength-all").selectOption("best");
  assert.deepEqual((await strengthRows(s)).map((r) => [r.pick, r.model]), [["best", "opus, medium"], ["best", "opus, medium"]]);
  assert.equal(await s.page.locator("#loop-strength-all").inputValue(), "-", "and goes blank again: it is not a saved value");

  await pickStrength(s, 2, "balanced");
  assert.deepEqual((await strengthRows(s)).map((r) => [r.pick, r.model]), [["best", "opus, medium"], ["balanced", "sonnet, medium"]], "a row can change after Set all");

  await s.page.locator("#loop-strength-all").selectOption("match");
  assert.deepEqual((await strengthRows(s)).map((r) => r.pick), ["", ""], "Match my session fills every row too");
});

test("the arrow keys move the checked radio inside a row, and only that row", async (t) => {
  const s = await openStrengthSetup(t);
  await s.page.locator("#loop-phase-strength").check();
  await s.page.locator(".loop-strength-row").first().waitFor();
  // Focus once: every change redraws the section, and the page must put focus back on the new radio by itself.
  await s.page.locator("#loop-strength-1-match").focus();
  await s.page.keyboard.press("ArrowRight");
  await s.page.locator("#loop-strength-1-thrifty:checked").waitFor({ state: "attached" });
  await s.page.keyboard.press("ArrowRight");
  await s.page.locator("#loop-strength-1-balanced:checked").waitFor({ state: "attached" });
  await s.page.keyboard.press("ArrowLeft");
  await s.page.locator("#loop-strength-1-thrifty:checked").waitFor({ state: "attached" });
  assert.deepEqual((await strengthRows(s)).map((r) => r.pick), ["thrifty", ""], "the other row did not move");
});

// The step path starts on the first row's checked node and ends on the last one's, within a pixel;
// a corner (Q) only when the two nodes sit in different columns. Waits, then asserts, so a redraw cannot race it.
async function waitLineOnNodes(s, corner) {
  const read = () =>
    s.page.evaluate(() => {
      const grid = document.querySelector(".loop-strength-grid");
      const gr = grid.getBoundingClientRect();
      const nodes = [...grid.querySelectorAll(".loop-strength-row input:checked + .loop-strength-node")];
      const centers = nodes.map((n) => {
        const b = n.getBoundingClientRect();
        return { x: b.left - gr.left + b.width / 2, y: b.top - gr.top + b.height / 2 };
      });
      const d = grid.querySelector(".loop-strength-line path.step")?.getAttribute("d") || "";
      const nums = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
      return { d, centers, nums };
    });
  const onNodes = ({ d, centers, nums }) =>
    centers.length === 2 &&
    nums.length >= 3 &&
    d.includes("Q") === corner &&
    Math.abs(nums[0] - centers[0].x) <= 1 &&
    Math.abs(nums[1] - centers[0].y) <= 1 &&
    Math.abs(nums[nums.length - 3] - centers[1].x) <= 1 &&
    Math.abs(nums[nums.length - 1] - centers[1].y) <= 1;
  const deadline = Date.now() + 5000;
  let got = await read();
  while (!onNodes(got) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50));
    got = await read();
  }
  assert.ok(onNodes(got), `the step path should run node to node (corner: ${corner}); got ${JSON.stringify(got)}`);
}

test("the strength line has one path fewer than there are rows, and none with the toggle off", async (t) => {
  const s = await openStrengthSetup(t);
  const paths = s.page.locator(".loop-strength-line path.step");
  assert.equal(await paths.count(), 0, "no line while the toggle is off");
  await s.page.locator("#loop-phase-strength").check();
  await s.page.locator(".loop-strength-row").first().waitFor();
  // The line is drawn a frame after the rows exist: wait for it, never read straight after a click.
  await s.page.waitForFunction(() => document.querySelectorAll(".loop-strength-line path.step").length === 1);
  assert.equal(await s.page.locator(".loop-strength-row").count(), 2);
  assert.equal(await paths.count(), 1, "two rows, one path between them");
  assert.equal(await s.page.locator(".loop-strength-line line.col").count(), 4, "a dashed column line per strength, Match my session included");

  // Both rows start on Match my session: one column, so a straight path with no corner.
  await waitLineOnNodes(s, false);
  await pickStrength(s, 2, "best");
  await waitLineOnNodes(s, true);
  await s.page.locator("#loop-phase-strength").uncheck();
  await s.page.locator(".loop-strength-row").first().waitFor({ state: "detached" });
  assert.equal(await paths.count(), 0, "the toggle off draws no line");
});

test("an agent with nothing mapped grays the section and links to Agents & models", async (t) => {
  const s = await openStrengthSetup(t, { ...LAUNCH, agent: "codex", agentLabel: "Codex" });
  const note = s.page.locator(".loop-strength-none");
  await note.waitFor();
  assert.match(await textOf(note), /This agent has no strengths mapped yet\./);
  assert.equal(await s.page.locator("#loop-phase-strength").isDisabled(), true);
  assert.equal(await s.page.locator(".loop-strength-row").count(), 0);
  await note.getByRole("button").click();
  await s.page.locator("#prefs-tab-agents[aria-selected='true']").waitFor();
});

test("a saved pick that is not mapped holds Start with a line naming the row, and a change releases it", async (t) => {
  const s = await openStrengthSetup(t);
  await s.page.locator("#loop-phase-strength").check();
  await s.page.locator(".loop-strength-row").first().waitFor();
  // Thrifty is no longer mapped for this agent (an override went away); Phase 2 still holds it.
  await s.page.evaluate(async () => {
    const { page, redraw } = await import(new URL("state.js", document.baseURI).href);
    page.loopSetup.facts.resolved = { best: { model: "opus", effort: "medium" } };
    page.loopSetup.form.strengths["specs/ready"] = [{ n: 2, name: "Two", strength: "thrifty" }];
    redraw();
  });
  const why = s.page.locator(".loop-why");
  assert.equal(await textOf(why), "Pick a new strength for Phase 2: not mapped for this agent.");
  assert.equal(await s.page.locator("#loop-start").isDisabled(), true);
  const held = s.page.locator("#loop-strength-2-thrifty");
  assert.equal(await held.isChecked(), true, "the saved word stays in the row");
  assert.equal(await held.isDisabled(), true);
  assert.deepEqual(await s.page.locator(".loop-strength-head .loop-strength-chip.is-unmapped").allInnerTexts(), ["Thrifty (not mapped)", "Balanced (not mapped)"]);

  await pickStrength(s, 2, "best");
  assert.equal(await s.page.locator(".loop-why").count(), 0, "the hold is gone");
  assert.equal(await s.page.locator("#loop-start").isDisabled(), false);
});

test("startBlock names every unmapped row, ignores the picks while the toggle is off, and waits for the strengths", async (t) => {
  const s = await openSetup(t);
  const lines = await s.page.evaluate(async () => {
    const { startBlock } = await import(new URL("screens/loop-setup.js", document.baseURI).href);
    const phasesLeft = [{ n: 2, name: "A" }, { n: 3, name: "B" }, { n: 4, name: "C" }];
    const strengths = { "specs/x": [{ n: 2, name: "A", strength: "thrifty" }, { n: 3, name: "B", strength: "best" }, { n: 4, name: "C", strength: "thrifty" }] };
    const facts = (resolved) => ({ spec: "specs/x", phasesLeft, pending: 0, resolved });
    const form = (phaseStrength) => ({ commit: false, phaseStrength, strengths });
    const app = { permissionMode: "bypass", promptSupport: true };
    return {
      two: startBlock(form(true), facts({ best: { model: "m" } }), app),
      off: startBlock(form(false), facts({ best: { model: "m" } }), app),
      allMapped: startBlock(form(true), facts({ thrifty: { model: "s" }, best: { model: "m" } }), app),
      nothingMapped: startBlock(form(true), facts({}), app),
      loading: startBlock(form(true), facts(undefined), app),
      last: startBlock(form(true), { ...facts({ best: { model: "m" } }), phasesLeft: [] }, app),
    };
  });
  assert.equal(lines.two, "Pick a new strength for Phase 2, Phase 4: not mapped for this agent.");
  assert.equal(lines.off, "");
  assert.equal(lines.allMapped, "");
  assert.equal(lines.nothingMapped, "", "an agent with nothing mapped grays the section instead");
  assert.equal(lines.loading, "Asking the app...");
  assert.equal(lines.last, "Nothing left to build in this spec.", "the older checks keep their order");
});

test("the toggle and the picks survive reopening the screen, and the toggle off sends nothing for the loop", async (t) => {
  const s = await openStrengthSetup(t);
  await s.page.locator("#loop-phase-strength").check();
  await pickStrength(s, 1, "thrifty");
  await pickStrength(s, 2, "best");

  const save = () =>
    s.page.evaluate(async () => {
      const { page } = await import(new URL("state.js", document.baseURI).href);
      const { setupBody } = await import(new URL("screens/loop-setup.js", document.baseURI).href);
      const res = await fetch("/loop-setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(setupBody(page.loopSetup.form, page.loopSetup)) });
      return { status: res.status, body: await res.json() };
    });
  const saved = await save();
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body.setup.phaseStrength, true);
  assert.deepEqual(saved.body.setup.strengths, { "specs/ready": [{ n: 1, name: "One", strength: "thrifty" }, { n: 2, name: "Two", strength: "best" }] });

  const reopen = async () => {
    await s.page.evaluate(async () => {
      const m = await import(new URL("screens/loop-setup.js", document.baseURI).href);
      const { page, redraw } = await import(new URL("state.js", document.baseURI).href);
      await m.openLoopSetup({ dir: "specs/ready" });
      redraw();
    });
    await s.page.locator("#loop-start").waitFor();
  };
  await reopen();
  await s.page.locator(".loop-strength-row").first().waitFor();
  assert.equal(await s.page.locator("#loop-phase-strength").isChecked(), true);
  assert.deepEqual((await strengthRows(s)).map((r) => [r.pick, r.model]), [["thrifty", "sonnet, low"], ["best", "opus, medium"]]);

  // Off: the picks stay saved, the loop is told nothing.
  await s.page.locator("#loop-phase-strength").uncheck();
  const off = await save();
  assert.equal(off.body.setup.phaseStrength, false);
  assert.equal(off.body.setup.strengths["specs/ready"].length, 2, "the toggle hides the picks, it does not erase them");

  // Back to Match my session for every row removes the key.
  await s.page.locator("#loop-phase-strength").check();
  await s.page.locator("#loop-strength-all").selectOption("match");
  const cleared = await save();
  assert.deepEqual(cleared.body.setup.strengths, {});
});
