// Page tests for how a session ends and comes back: the finished screen and
// its buttons, Stop and Stop with a handoff, and a page that loses its server
// and finds it again after a resume. Run with:
// node --test scripts/test-web-console-page-session.mjs
//
// Each test drives the real console in a real Chrome or Edge through
// scripts/page-test-helpers.mjs: one browser for the file, a fresh console
// session per test.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pageSuite, openSession, itemCard, drawn, textOf, tempProject } from "./page-test-helpers.mjs";
import { cli, until } from "./web-console-test-helpers.mjs";
import { STOP_HANDOFF_REPLY, HOME_REPLY } from "../src/web-console/public/answers.js";
// How long the page waits without contact before it calls itself offline:
// the page's own constant, so this file never drifts from it.
import { GONE_AFTER_MS } from "../src/web-console/public/screens/core.js";

const suite = pageSuite(test);


// The banner the page raises when it loses its server mid-session.
const LOST_CONTACT = /Lost contact with Plan2Code\. Nothing you have typed is lost\./;

// A plan session on the person's turn, the way an agent opens one: one text
// question and the agent listening.
const PLAN_QUESTION = {
  items: [{ id: "q1", kind: "text", title: "What to call it", body: "A short name for the export." }],
  agent: { status: "waiting" },
};

// The agent's side of `stop`, leaving the browser context open (s.stop()
// closes it, which would hide what the page does next).
async function stopServer(s) {
  cli(["stop", "--session", s.sid], { cwd: s.project });
  assert.ok(await until(async () => !(await s.answers()), 5000), "the server still answers after stop");
}

// The one send `wait` hands the agent; fails the test when nothing arrived.
function collect(s) {
  const got = s.wait(10);
  assert.equal(got.code, 0, `nothing was sent (wait exit ${got.code}): ${got.message || ""}`);
  return got;
}

// Local helper: checks `fn` keeps returning true for `ms`. A sleep would
// prove nothing; this fails the moment the page shows what it must not.
async function holds(fn, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (!(await fn())) return false;
    await new Promise((r) => setTimeout(r, 100));
  }
  return true;
}

test("the finished screen shows the next command with --web, copies it, turns Send off, and Back to the dashboard reaches the agent", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await s.context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(s.url).origin });
  s.post({
    settle: true,
    finish: {
      headline: "The plan is written",
      body: "Everything is under `specs/audit-export/`. Read `PLAN.md` first.",
      command: "/plan2code-2-document",
      dashboard: true,
    },
  });
  const main = s.page.locator("#main");
  await main.getByRole("heading", { name: "The plan is written" }).waitFor();

  const shown = main.locator("code").filter({ hasText: /^\/plan2code-2-document --web$/ });
  assert.equal(await shown.count(), 1, "the command is shown once, with --web appended");
  // The Copy that belongs to this command: the innermost block holding both,
  // whatever wraps them.
  // (`has` is matched inside each candidate, so these start from the page.)
  const code = s.page.locator("code").filter({ hasText: /^\/plan2code-2-document --web$/ });
  const copy = s.page.getByRole("button", { name: "Copy", exact: true });
  await main.locator("*", { has: code }).filter({ has: copy }).last().getByRole("button", { name: "Copy", exact: true }).click();
  await s.page.waitForFunction(async () => (await navigator.clipboard.readText()) === "/plan2code-2-document --web");
  assert.equal(await s.page.evaluate(() => navigator.clipboard.readText()), "/plan2code-2-document --web");

  assert.equal(await s.page.locator("#btn-send").isDisabled(), true, "Send is still on after the finish");

  await main.getByRole("button", { name: "Back to the dashboard" }).click();
  const got = collect(s);
  assert.equal(got.type, "submit");
  assert.deepEqual(
    got.actions.map(({ i, type }) => ({ i, type })),
    [{ i: "__dashboard", type: "dashboard" }]
  );
});

test("Stop session, confirmed, sends __stop with no handoff", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await s.page.click("#btn-stop");
  await s.page.locator("#stop-go").click();
  const got = collect(s);
  assert.equal(got.type, "submit");
  const stop = got.actions.find((a) => a.i === "__stop");
  assert.deepEqual(stop, { i: "__stop", type: "stop" });
});

test("Stop with a handoff sends __stop with handoff, and the paused finish and stop that follow end on the paused screen, not an error", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await s.page.click("#btn-stop");
  const handoff = s.page.locator("#stop-handoff");
  assert.equal(await handoff.isVisible(), true, "the handoff choice is offered off the dashboard");
  await handoff.click();
  const got = collect(s);
  assert.equal(got.type, "submit");
  const stop = got.actions.find((a) => a.i === "__stop");
  assert.deepEqual(stop, { i: "__stop", type: "stop", handoff: true });

  // What the agent does next (console-stop.md): a paused finish without
  // --wait and no dashboard, then `stop`.
  s.post({
    settle: true,
    finish: {
      headline: "Paused at the naming question",
      body: "Your place is saved, and a handoff is waiting on the dashboard. The naming question is still open.",
      command: "/plan2code-1-plan",
    },
  });
  const main = s.page.locator("#main");
  await main.getByRole("heading", { name: "Paused at the naming question" }).waitFor();
  await stopServer(s);

  // The page needs GONE_AFTER_MS without contact before it would call the
  // server lost. Through that window and past it, the paused screen stays.
  const settled = async () =>
    !LOST_CONTACT.test(await s.page.locator("#banner").innerText()) &&
    !(await s.page.locator("#planny").getAttribute("class")).includes("is-gone");
  assert.ok(await holds(settled, GONE_AFTER_MS + 3000), "the page raised a lost-contact state after a paused finish");
  assert.match(await main.innerText(), /Session paused/i);
  assert.match(await textOf(s.page.locator("#agent-text")), /^Paused\./);
  assert.ok(await main.locator("code").filter({ hasText: /^\/plan2code-1-plan --web$/ }).count(), "the resume command is gone");
});

test("a page that loses its server goes offline, and after a resume it shows the session again with the unsent answer still typed", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  const field = () => itemCard(s.page, "q1").locator("textarea, input[type=text]").first();
  await field().fill("audit-export");
  // Typed, not sent: the page mirrors it to the server's draft.json, which
  // is what a page on a new port reads back (localStorage is per origin).
  const draftFile = path.join(s.session, "draft.json");
  assert.ok(
    await until(() => fs.existsSync(draftFile) && fs.readFileSync(draftFile, "utf8").includes("audit-export"), 5000),
    "the typed answer never reached the server's draft"
  );

  await stopServer(s);
  await s.page.waitForFunction(() => document.getElementById("planny").classList.contains("is-gone"), null, {
    timeout: GONE_AFTER_MS + 10000,
  });
  assert.match(await textOf(s.page.locator("#agent-text")), /^Not connected\. Your answers are saved\./);
  assert.match(await s.page.locator("#banner").innerText(), LOST_CONTACT);
  assert.equal(await s.page.locator("#btn-send").isDisabled(), true, "Send is on with no server");

  const resumed = cli(["open", "--resume", s.sid, "--workflow", "plan", "--no-open"], { cwd: s.project }).json;
  assert.ok(resumed && resumed.url, "the resume printed no url");
  await s.page.goto(resumed.url, { waitUntil: "domcontentloaded" });
  await drawn(s.page);
  await itemCard(s.page, "q1").getByText("What to call it").first().waitFor();
  assert.equal(await field().inputValue(), "audit-export", "the unsent answer was lost across the resume");
  assert.equal(await s.page.locator("#planny").evaluate((n) => n.classList.contains("is-gone")), false);
});

// The status line beside Planny, and its "What to check" button when it has
// one. The button opens Help on the stuck tab.
const statusLine = (s) => s.page.locator("#agent-text");
const whatToCheck = (s) => statusLine(s).getByRole("button", { name: "What to check" });
async function lineSays(s, re) {
  await s.page.waitForFunction((src) => new RegExp(src).test(document.getElementById("agent-text").textContent), re.source, { timeout: 10000 });
  return textOf(statusLine(s));
}

test("the quiet, not running and not connected lines offer What to check, opening Help on the stuck tab, and the plain lines do not", async (t) => {
  const s = await openSession(await suite.browser(), {
    t,
    workflow: "implement",
    clock: true,
    payload: { headline: { stage: "Phase 1", cleared: 0, total: 3 }, agent: { status: "working", activity: "Task 1 of 3: the reader" } },
  });
  // Working, and heard from just now: the plain working line.
  await lineSays(s, /Task 1 of 3: the reader/);
  assert.equal(await whatToCheck(s).count(), 0, "the working line is plain");
  // Quiet for 30 s: the approval hint, with the button.
  await s.page.clock.fastForward(40_000);
  await lineSays(s, /waiting on an approval in your terminal/);
  assert.equal(await whatToCheck(s).count(), 1, "the approval hint carries What to check");
  // Quiet for two minutes: still working, and the button stays.
  await s.page.clock.fastForward(100_000);
  await lineSays(s, /^Still working on it\./);
  assert.equal(await whatToCheck(s).count(), 1, "the quiet working line carries What to check");

  // Back to real time, and the agent asks something: the person's turn is plain.
  await s.page.clock.setSystemTime(Date.now());
  s.post({ items: [{ id: "q1", kind: "text", title: "What to call it", body: "A short name." }], agent: { status: "waiting" } });
  await lineSays(s, /^Your turn: 1 question waiting\./);
  assert.equal(await whatToCheck(s).count(), 0, "the your-turn line is plain");
  // Nobody listening for three minutes: not running, with the button.
  await s.page.clock.fastForward(200_000);
  await lineSays(s, /^Plan2Code is not running right now\./);
  assert.equal(await whatToCheck(s).count(), 1, "the not running line carries What to check");
  await whatToCheck(s).click();
  await s.page.locator("#help-modal[open]").waitFor();
  assert.equal(await s.page.locator("#help-tab-stuck").getAttribute("aria-selected"), "true", "Help opened on the stuck tab");
  await s.page.keyboard.press("Escape");
  await s.page.locator("#help-modal[open]").waitFor({ state: "detached" });

  // Answered and sent, never collected, and nobody listening: the saved line.
  await s.page.clock.setSystemTime(Date.now());
  s.post({ agent: { status: "waiting" } });
  await itemCard(s.page, "q1").locator("textarea, input[type=text]").first().fill("audit-export");
  await s.page.click("#btn-send");
  await lineSays(s, /^Sent\. Waiting for Plan2Code\./);
  assert.equal(await whatToCheck(s).count(), 0, "the sent line is plain");
  await s.page.clock.fastForward(200_000);
  await lineSays(s, /^Plan2Code is not running\. Your answers are saved and waiting for it\./);
  assert.equal(await whatToCheck(s).count(), 1, "the saved-and-waiting line carries What to check");

  // No server at all: not connected, with the button.
  await stopServer(s);
  for (let i = 0; i < 20 && !(await s.page.locator("#planny.is-gone").count()); i++) {
    await s.page.clock.fastForward(GONE_AFTER_MS);
    await new Promise((r) => setTimeout(r, 250));
  }
  await lineSays(s, /^Not connected\. Your answers are saved\./);
  assert.equal(await whatToCheck(s).count(), 1, "the not connected line carries What to check");
});

test("an answered finish offer comes back unanswered on a later finish, once the first finish has gone", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "implement", payload: { agent: { status: "working", activity: "Task 1 of 1" } } });
  const finishWith = (headline) => s.post({ finish: { headline, command: "/plan2code-3-implement specs/audit-export/overview.md", dashboard: true } });
  const main = s.page.locator("#main");
  finishWith("Phase 1 is done");
  await main.getByRole("heading", { name: "Phase 1 is done" }).waitFor();
  await main.getByRole("button", { name: "Back to the dashboard" }).click();
  assert.deepEqual(collect(s).actions.map(({ i }) => i), ["__dashboard"]);
  await lineSays(s, /^Opening the dashboard…/);
  // The agent takes the press somewhere that clears the finish, and a later
  // phase ends: that finish starts with its own offer unanswered.
  s.post({ finish: null, agent: { status: "working", activity: "Task 1 of 1" } });
  await lineSays(s, /Task 1 of 1/);
  finishWith("Phase 2 is done");
  await main.getByRole("heading", { name: "Phase 2 is done" }).waitFor();
  await lineSays(s, /^Done\. Head back to the dashboard, or close this tab\./);
  assert.equal(await main.getByRole("button", { name: "Back to the dashboard" }).count(), 1, "the later finish offers the way back again");
});

test("a finished session never puts a sent answer back on its form", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await itemCard(s.page, "q1").locator("textarea").fill("audit-export");
  await s.page.click("#btn-send");
  collect(s);
  // Collected and left open, then the session ends: nothing more can be sent,
  // so the answer stays sent rather than coming back to edit. It would show
  // once the finish goes away (a review taken up), as an answer ready to send.
  s.post({ finish: { headline: "The plan is written", command: "/plan2code-2-document" }, agent: { status: "waiting" } });
  await s.page.locator("#main").getByRole("heading", { name: "The plan is written" }).waitFor();
  s.post({ finish: null, agent: { status: "waiting" } });
  await s.page.locator("#main").getByRole("heading", { name: "The plan is written" }).waitFor({ state: "detached" });
  const q1 = s.page.locator("#sidebar").getByRole("button", { name: /What to call it/ });
  await q1.click();
  await itemCard(s.page, "q1").waitFor();
  const mark = q1.locator(".rail-mark");
  assert.notEqual(await mark.getAttribute("title"), "ready to send", "the sent answer came back on the form");
  const box = itemCard(s.page, "q1").locator("textarea");
  assert.notEqual((await box.count()) ? await box.inputValue() : "", "audit-export", "the sent answer is back in its box");
});

test("the footer keeps its workspace label on the dashboard, and the label opens the Workspace dialog", async (t) => {
  const project = tempProject();
  const name = path.basename(project);
  const s = await openSession(await suite.browser(), { t, workflow: "dashboard", project });
  // Past Planny's wake-up and, on this console home's first run, the Welcome.
  await s.page.getByRole("button", { name: "Skip the intro" }).click();
  await s.page.locator("#main").getByRole("heading", { name: "What are we doing today?" }).waitFor();
  const welcomeDone = s.page.getByRole("button", { name: "Start building" });
  if (await welcomeDone.isVisible()) await welcomeDone.click();
  await welcomeDone.waitFor({ state: "hidden" });
  const foot = s.page.locator("footer.footer");
  const where = s.page.locator("#footer-where");
  await where.waitFor();
  // The dashboard drops the summary and Send, never the label.
  assert.equal(await foot.evaluate((f) => f.classList.contains("is-dash")), true, "the dashboard's footer is marked is-dash");
  assert.equal(await s.page.locator("#footer-summary").isVisible(), false, "the summary shows on the dashboard");
  assert.equal(await s.page.locator("#btn-send").isVisible(), false, "Send shows on the dashboard");
  assert.match(await textOf(where), new RegExp(`^${name}`), "the label names the project");
  assert.equal(await where.getAttribute("title"), "Open workspace");
  assert.match(await where.getAttribute("aria-label"), new RegExp(`^Open workspace: ${name}`));
  // A click opens the Workspace dialog on the session's folders; leaving the
  // label leaves it as it was (no copied state to undo).
  await where.click();
  await s.page.locator("#workspace-modal[open]").waitFor();
  assert.match(await textOf(s.page.locator("#workspace-list")), new RegExp(name));
  await s.page.keyboard.press("Escape");
  await s.page.locator("#workspace-modal[open]").waitFor({ state: "detached" });
  await s.page.locator("body").click({ position: { x: 5, y: 5 } });
  assert.match(await textOf(where), new RegExp(`^${name}`), "the label changed after a click away");
});

test("a workflow page uses its modules: the full footer, the session meter, @ suggestions and the tab icon", async (t) => {
  const project = tempProject();
  const name = path.basename(project);
  const s = await openSession(await suite.browser(), { t, workflow: "plan", project, payload: PLAN_QUESTION });
  // Off the dashboard the footer is whole (workspace.js names the label).
  assert.equal(await s.page.locator("footer.footer").evaluate((f) => f.classList.contains("is-dash")), false);
  assert.equal(await s.page.locator("#btn-send").isVisible(), true);
  // meter.js: the pill shows once a frame carries the meter.
  await s.page.locator("#meter-pill").waitFor();
  assert.ok((await textOf(s.page.locator("#meter-words"))).length, "the meter pill has no words");
  // mentions.js: an @ in a text box offers the workspace's folders.
  const box = itemCard(s.page, "q1").locator("textarea");
  await box.click();
  await box.pressSequentially("See @");
  await s.page.locator("#mention-pop").waitFor();
  assert.match(await textOf(s.page.locator("#mention-pop")), new RegExp(name));
  // favicon.js: the person's move puts a bar on the tab icon.
  await s.page.waitForFunction(() => document.querySelector('link[rel="icon"][type="image/svg+xml"]').href.startsWith("data:image/svg+xml"));
});

// The dashboard, past Planny's wake-up and the first-run Welcome.
async function pastTheIntro(s) {
  const skip = s.page.getByRole("button", { name: "Skip the intro" });
  await skip.click();
  await s.page.locator("#main").getByRole("heading", { name: "What are we doing today?" }).waitFor();
  const welcomeDone = s.page.getByRole("button", { name: "Start building" });
  if (await welcomeDone.isVisible()) await welcomeDone.click();
  await welcomeDone.waitFor({ state: "hidden" });
}

// What a person sees break: a handoff offered where there is nothing to hand off.
test("the stop dialog offers a handoff in a workflow and one plain Stop on the dashboard", async (t) => {
  const plan = await openSession(await suite.browser(), { t, workflow: "implement", payload: { agent: { status: "waiting" }, items: PLAN_QUESTION.items } });
  await plan.page.click("#btn-stop");
  const modal = plan.page.locator("#stop-modal");
  await modal.waitFor();
  assert.match(await textOf(modal), /Stop with a handoff/);
  assert.match(await textOf(modal.locator("#stop-go")), /Just stop and save/);

  const dash = await openSession(await suite.browser(), { t, workflow: "dashboard", payload: { agent: { status: "waiting" } } });
  await pastTheIntro(dash);
  await dash.page.click("#btn-stop");
  await dash.page.locator("#stop-modal").waitFor();
  assert.equal(await dash.page.locator("#stop-handoff").isVisible(), false, "the dashboard offers a handoff");
  assert.match(await textOf(dash.page.locator("#stop-go")), /Stop\s+Ends the console session\./);
  assert.doesNotMatch(await textOf(dash.page.locator("#stop-modal")), /Stop with a handoff/);
});

// What the agent would misread: a handoff stop that carries the plain stop's words.
test("Stop with a handoff sends its own reply line beside the stop, and a plain stop sends another", async (t) => {
  const handoff = await openSession(await suite.browser(), { t, workflow: "implement", payload: { agent: { status: "waiting" }, items: PLAN_QUESTION.items } });
  await handoff.page.click("#btn-stop");
  await handoff.page.locator("#stop-handoff").click();
  const got = collect(handoff);
  assert.deepEqual(got.actions.find((a) => a.i === "__stop"), { i: "__stop", type: "stop", handoff: true });
  assert.ok(got.reply.includes(STOP_HANDOFF_REPLY), `the handoff stop's words: ${got.reply}`);

  const plain = await openSession(await suite.browser(), { t, workflow: "implement", payload: { agent: { status: "waiting" }, items: PLAN_QUESTION.items } });
  await plain.page.click("#btn-stop");
  await plain.page.locator("#stop-go").click();
  const sent = collect(plain);
  assert.equal(sent.actions.find((a) => a.i === "__stop").handoff, undefined);
  assert.ok(!sent.reply.includes(STOP_HANDOFF_REPLY), "a plain stop asked for a handoff");
});

// A finish that offers a review, a commit and the dashboard, on a build.
const OFFERS = { headline: "Quick task done", command: "/plan2code-5-git", review: true, commit: true, dashboard: true };
const closeGuide = (s) => s.page.getByRole("region", { name: "Before you close this" });

// What a person sees break: "Safe to close" printed under "Review requested", or the review offer coming back after a reload.
test("Before you close this shows while a review is on offer, goes while it is asked, and the asked offer stays locked after a reload", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "quick-task", payload: { agent: { status: "working", activity: "Task 1 of 1" } } });
  s.post({ finish: OFFERS });
  const main = s.page.locator("#main");
  const reviewNow = main.getByRole("button", { name: "Review it now" });
  await reviewNow.waitFor();
  assert.equal(await closeGuide(s).count(), 1, "a review only on offer must not hide the guide");
  assert.match(await textOf(main), /The review is optional\./);

  await reviewNow.click();
  const got = collect(s);
  assert.deepEqual(got.actions.map(({ i, type }) => ({ i, type })), [{ i: "__review", type: "review" }]);
  await main.getByRole("button", { name: "Review requested…" }).waitFor();
  assert.equal(await closeGuide(s).count(), 0, "the guide shows while a review is starting");
  assert.equal(await main.getByRole("button", { name: "No thanks, I am done" }).count(), 0);

  // The press is remembered: the buttons do not come back on a reload.
  await s.page.reload({ waitUntil: "domcontentloaded" });
  await drawn(s.page);
  await main.getByRole("button", { name: "Review requested…" }).waitFor();
  assert.equal(await main.getByRole("button", { name: "Review it now" }).count(), 0);
  assert.equal(await closeGuide(s).count(), 0, "the guide came back on a reload");
});

// What a person sees break: the guide missing while a commit or the dashboard
// is starting (it would say "start a new one" under "Opening Git"), or missing
// once they said they are done or the server is gone.
test("Before you close this goes while a commit or the dashboard is starting, and stays once they are done or the server is gone", async (t) => {
  const browser = await suite.browser();
  const finishPage = async (opts) => {
    const s = await openSession(browser, { t, workflow: "quick-task", ...opts, payload: { agent: { status: "working", activity: "Task 1 of 1" } } });
    s.post({ finish: OFFERS });
    await s.page.locator("#main").getByRole("heading", { name: "Quick task done" }).waitFor();
    assert.equal(await closeGuide(s).count(), 1, "a plain finish shows the guide");
    return s;
  };
  const cases = [
    ["Commit it now", "__commit", "Opening Git…", 0],
    ["Back to the dashboard", "__dashboard", "Opening the dashboard…", 0],
    ["No thanks, I am done", "__done", null, 1],
  ];
  for (const [button, id, asked, guides] of cases) {
    const s = await finishPage({});
    await s.page.locator("#main").getByRole("button", { name: button }).click();
    assert.deepEqual(collect(s).actions.map((a) => a.i), [id]);
    if (asked) await s.page.locator("#main").getByRole("button", { name: asked }).waitFor();
    assert.equal(await closeGuide(s).count(), guides, `the guide after ${button}`);
  }
  // A review asked, then the server gone: nothing is starting any more.
  const gone = await finishPage({ clock: true });
  await gone.page.locator("#main").getByRole("button", { name: "Review it now" }).click();
  collect(gone);
  assert.equal(await closeGuide(gone).count(), 0);
  await stopServer(gone);
  for (let i = 0; i < 20 && !(await gone.page.locator("#planny.is-gone").count()); i++) {
    await gone.page.clock.fastForward(GONE_AFTER_MS);
    await new Promise((r) => setTimeout(r, 250));
  }
  await closeGuide(gone).waitFor();
});

// What a person sees break: a finished screen with no Before you close this,
// a pause that promises the wrong thing, or the guide's own text going wrong.
test("every finished shape shows Before you close this with its three rows, and a pause names the resume command", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "implement", payload: { agent: { status: "working", activity: "Task 1 of 1" } } });
  const main = s.page.locator("#main");
  const shapes = [
    ["A skill next", { command: "/plan2code-4-finalize" }, /A new session starts from clean context/, /Paste the command above in the new session, or start from the dashboard with \/plan2code\./],
    ["A terminal command next", { command: "git status" }, /A new session starts from clean context/, /Run the command above in your terminal, then start the next step/],
    ["Nothing left", {}, /A new session starts from clean context/, /In the new session, start from the dashboard with \/plan2code\./],
    ["Paused here", { command: "/plan2code-3-implement specs/x/overview.md" }, /Your saved place is picked up by the resume command above\./, /Paste the command above/],
  ];
  for (const [headline, rest, fresh, carry] of shapes) {
    s.post({ finish: { headline, ...rest } });
    await main.getByRole("heading", { name: headline }).waitFor();
    const guide = closeGuide(s);
    assert.equal(await guide.count(), 1, `${headline}: one guide`);
    assert.equal(await guide.locator("li").count(), 3, `${headline}: three rows`);
    const text = await textOf(guide);
    for (const label of ["Before you close this", "Safe to close", "Start fresh", "Carry on"]) assert.ok(text.includes(label), `${headline}: says "${label}"`);
    assert.match(text, fresh, `${headline}: the Start fresh sentence`);
    assert.match(text, carry, `${headline}: the Carry on sentence`);
    assert.ok(!text.includes("—"), `${headline}: the guide carries an em dash`);
  }
  // With a stop warning up, a pause's command starts the work again.
  s.post({ stopWarning: "Answers since the last save will not be kept." });
  await closeGuide(s).getByText(/The command above starts it again\./).waitFor();
  assert.equal(await s.page.locator("#btn-home").isVisible(), false, "a finished screen carries its own way back");
});

// What a person sees break: the triangle leaving answers behind, or sending a
// finish-style stop instead of the way home.
test("the top bar's back triangle asks first, then sends __dashboard with the typed answers and the home reply", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await itemCard(s.page, "q1").locator("textarea, input[type=text]").first().fill("audit-export");
  await s.page.click("#btn-home");
  const modal = s.page.locator("#home-modal");
  await modal.waitFor();
  assert.match(await textOf(modal), /Leave this workflow\?/);
  assert.match(await textOf(modal.locator("#home-blurb")), /The answer you have ready goes with it\./);
  await modal.locator("#home-cancel").click();
  await modal.waitFor({ state: "hidden" });
  assert.equal(s.wait(1).code === 0, false, "Cancel sent something");

  await s.page.click("#btn-home");
  await modal.locator("#home-go").click();
  const got = collect(s);
  assert.deepEqual(got.actions.map(({ i, type }) => ({ i, type })), [{ i: "q1", type: "answer" }, { i: "__dashboard", type: "dashboard" }]);
  assert.ok(got.reply.includes("audit-export") && got.reply.endsWith(HOME_REPLY), `the reply carries the answer, then the home line: ${got.reply}`);
  await s.page.waitForFunction(() => document.getElementById("btn-home").disabled);
});

// What a person sees break: Commit it now, or Changelog's commit offer, hops
// into Git without the dashboard, and the board opens over the last skill's
// staged answer, its selected question and its open tab.
test("a hop into Git from another skill starts the page clean: nothing staged, nothing selected, the questions view", async (t) => {
  const s = await openSession(await suite.browser(), {
    t,
    workflow: "changelog",
    payload: {
      items: [{ id: "q1", kind: "choice", title: "Which version", body: "The next version number.",
        options: [{ k: "A", text: "A patch release" }, { k: "B", text: "A minor release" }] }],
      docs: [{ id: "notes", title: "Release notes", blocks: [{ id: "b1", md: "## Draft\n\nTwo fixes." }] }],
      agent: { status: "waiting" },
    },
  });
  // The page's own state, from the module app.js loaded (same URL, same instance).
  const local = () =>
    s.page.evaluate(async () => {
      const { page } = await import("/state.js");
      return { workflow: page.S.workflow, staged: page.local.staged, selected: page.selected, view: page.view };
    });
  await itemCard(s.page, "q1").getByText("A minor release").click();
  await s.page.locator(".view-tab", { hasText: "Release notes" }).click();
  const before = await local();
  assert.deepEqual(Object.keys(before.staged), ["q1"], "the answer was never staged");
  assert.equal(before.selected, "q1");
  assert.notEqual(before.view, "questions", "the Release notes tab never opened");
  const draftFile = path.join(s.session, "draft.json");
  assert.ok(await until(() => fs.existsSync(draftFile) && fs.readFileSync(draftFile, "utf8").includes('"q1"'), 5000), "the staged answer never reached the draft");

  // What Commit it now and Changelog's commit offer run.
  cli(["open", "--resume", s.sid, "--no-open", "--workflow", "git"], { cwd: s.project });
  await s.page.waitForFunction(async () => (await import("/state.js")).page.S.workflow === "git", null, { timeout: 10000 });
  // Long enough for the page's draft push (600 ms after a save) to have run.
  await new Promise((r) => setTimeout(r, 1500));
  const after = await local();
  assert.deepEqual(after.staged, {}, `the page kept the last skill's staged answer: ${JSON.stringify(after.staged)}`);
  assert.equal(after.selected, null, `the page kept the last skill's selection: ${after.selected}`);
  assert.equal(after.view, "questions", `the page kept the last skill's tab: ${after.view}`);
  const stored = await s.page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}").staged || {}, `p2c-console:${s.sid}`);
  assert.deepEqual(stored, {}, "the browser's copy kept the staged answer");
  const draft = fs.existsSync(draftFile) ? JSON.parse(fs.readFileSync(draftFile, "utf8")) : {};
  assert.deepEqual(draft.staged || {}, {}, "the server's draft kept the staged answer");
});

// What a person sees break: Back to default in Preferences does nothing.
test("Back to default in Preferences returns the theme to follow the system and clears the chosen look", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await s.page.click("#btn-looks");
  await s.page.locator('input[name="looks-theme"][value="dark"]').check();
  await s.page.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "dark");
  await s.page.click("#looks-reset");
  await s.page.waitForFunction(() => !document.documentElement.hasAttribute("data-theme"));
  assert.equal(await s.page.locator('input[name="looks-theme"][value="system"]').isChecked(), true, "the system choice is ticked again");
});
