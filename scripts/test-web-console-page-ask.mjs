// Page tests for the Ask tab: a Quick question and the agent's reply, the
// starters, a retry after a failed send, a new conversation, a picture attached
// to a note, and the Subagents tab. Run with:
// node --test scripts/test-web-console-page-ask.mjs
//
// Each test drives the real console in a real Chrome or Edge through
// scripts/page-test-helpers.mjs: one browser for the file, a fresh console
// session per test.

import test from "node:test";
import assert from "node:assert/strict";
import { pageSuite, openSession, itemCard, textOf } from "./page-test-helpers.mjs";
import { reportedHelper } from "./web-console-test-helpers.mjs";

const suite = pageSuite(test);

// A plan session on the person's turn: one text question, the agent listening.
const PLAN_QUESTION = {
  items: [{ id: "q1", kind: "text", title: "What to call it", body: "A short name for the export." }],
  agent: { status: "waiting" },
};

// A real 1x1 PNG. The page decodes and re-encodes every picture before it
// uploads, so the fake JPEG the server tests use would be refused here.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

// The one send `wait` hands the agent; fails the test when nothing arrived.
function collect(s) {
  const got = s.wait(10);
  assert.equal(got.code, 0, `nothing was sent (wait exit ${got.code}): ${got.message || ""}`);
  return got;
}

// The questions in a send's chat entries (the first send also carries the
// conversation's start, which is not a question).
const messages = (got) => got.chat.filter((e) => e.kind === "message");

// Opens the Ask tab and returns its question box.
async function openAsk(s) {
  await s.page.locator("nav").getByRole("button", { name: "Ask", exact: true }).click();
  const box = s.page.locator("#ask-input");
  await box.waitFor();
  return box;
}

// Types a question and presses Send in the Ask pane.
async function askQuestion(s, text) {
  const box = s.page.locator("#ask-input");
  await box.fill(text);
  await s.page.locator(".ask-composer").getByRole("button", { name: "Send", exact: true }).click();
}

// What a person sees break: a question typed in Ask that never reaches the
// agent, or an answer that never shows.
test("a Quick question typed in Ask reaches the agent under chat, and the agent's reply shows in the pane", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openAsk(s);
  await askQuestion(s, "Where does the export live?");

  const got = collect(s);
  assert.equal(got.type, "chat");
  const [asked, ...more] = messages(got);
  assert.equal(more.length, 0, "one question, one message");
  assert.equal(asked.text, "Where does the export live?");
  assert.match(got.reply, /^Quick question: Where does the export live\?$/m);
  // The question is in the pane, and the box is empty for the next one.
  await s.page.locator(".ask-row.person").getByText("Where does the export live?").waitFor();
  assert.equal(await s.page.locator("#ask-input").inputValue(), "");

  s.post({ chat: { replies: [{ id: "r1", re: asked.seq, conversation: 1, md: "It lives in `exports/`." }] } });
  const reply = s.page.locator(".ask-row.agent");
  await reply.getByText("It lives in").waitFor();
  assert.match(await textOf(reply), /exports\//);
  assert.match(await textOf(s.page.locator(".ask-counter")), /1/);
});

// What a person sees break: a prompt the agent wrote for a new conversation with no
// Copy button, or one that tells them to "paste it into the Ask tab" as though it
// were a terminal command.
test("an Ask reply with a fenced prompt shows Copy and no run hint, while a command block still gets the hint", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openAsk(s);
  await askQuestion(s, "Give me a prompt for adding the export to the report");
  const [asked] = messages(collect(s));

  const prompt = "Add the export to the report. Read src/export.js and src/report.js first. Do not touch the importer.";
  const fence = "```";
  const md = ["That is a separate job. Paste this into a new Quick Task:", "", fence, prompt, fence, "", "Or run this:", "", fence, "npm test", fence].join("\n");
  s.post({ chat: { replies: [{ id: "r1", re: asked.seq, conversation: 1, md }] } });
  const reply = s.page.locator(".ask-row.agent");
  await reply.getByText("That is a separate job").waitFor();

  const blocks = reply.locator("pre");
  assert.equal(await blocks.count(), 2);
  const first = blocks.nth(0).locator("xpath=..");
  assert.equal(await first.getByRole("button", { name: "Copy" }).count(), 1, "the prompt block has a Copy button");
  assert.equal(await first.locator(".md-run-hint").count(), 0, "a prompt block gets no run hint");
  const second = blocks.nth(1).locator("xpath=..");
  assert.equal(await second.locator(".md-run-hint").count(), 1, "a command block still gets the hint");
});

// What a person sees break: starters that send for them, or that are missing
// from an empty conversation.
test("an empty Ask offers starters, a click only fills the box, and nothing is sent until Send", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  const box = await openAsk(s);
  const starters = s.page.locator(".ask-starters .ask-starter");
  await starters.first().waitFor();
  assert.ok((await starters.count()) >= 1, "no starter questions are offered");
  const first = (await textOf(starters.first())).trim();
  await starters.first().click();
  assert.equal(await box.inputValue(), first, "the starter fills the box");
  assert.equal(s.wait(1).code === 0, false, "a starter click sent something");

  await s.page.locator(".ask-composer").getByRole("button", { name: "Send", exact: true }).click();
  assert.deepEqual(messages(collect(s)).map((e) => e.text), [first]);
  // With a question in the list the starters are gone.
  await s.page.locator(".ask-starters").waitFor({ state: "detached" });
});

// What a person sees break: a question lost when the network hiccups, or
// sent twice when they press Retry.
test("a failed send shows Not sent with Retry, and Retry delivers the question once", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openAsk(s);
  // The page's own request fails as a dropped connection would.
  await s.page.route("**/chat", (route) => route.abort());
  await askQuestion(s, "Is the header row kept?");
  const row = s.page.locator(".ask-row.person.pending");
  await row.getByText("Not sent").waitFor();
  assert.equal(s.wait(1).code === 0, false, "a failed send reached the agent");

  await s.page.unroute("**/chat");
  await row.getByRole("button", { name: "Retry" }).click();
  const got = collect(s);
  assert.deepEqual(messages(got).map((e) => e.text), ["Is the header row kept?"]);
  await s.page.locator(".ask-row.person:not(.pending)").getByText("Is the header row kept?").waitFor();
  assert.equal(s.wait(1).code === 0, false, "the question was sent twice");
});

// What a person sees break: New conversation that leaves the old rows, or
// that does not start the next question in a fresh conversation.
test("New conversation clears the pane back to the starters, and the next question belongs to the new conversation", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openAsk(s);
  await askQuestion(s, "First question");
  const first = collect(s);
  assert.equal(messages(first)[0].conversation, 1);
  await s.page.locator(".ask-row.person:not(.pending)").waitFor();

  await s.page.getByRole("button", { name: "New conversation" }).click();
  await s.page.locator(".ask-row").waitFor({ state: "detached" });
  await s.page.locator(".ask-starters").waitFor();

  await askQuestion(s, "Second question");
  const second = collect(s);
  assert.deepEqual(messages(second).map((e) => e.text), ["Second question"]);
  assert.equal(messages(second)[0].conversation, 2);
});

// What a person sees break: a picture that shows in the tray but never goes
// to the agent, or goes without the note it belongs to.
test("a picture attached to a note uploads, and the send carries it in the note's images entry", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await itemCard(s.page, "q1").waitFor();
  const aside = s.page.locator("#aside");
  await aside.locator('input[type="file"]').setInputFiles({ name: "shot.png", mimeType: "image/png", buffer: PNG });
  await aside.locator(".attach-thumb.is-ready").waitFor();
  await aside.locator("#thread-q1").fill("See the screenshot.");

  await s.page.click("#btn-send");
  const got = collect(s);
  const note = got.actions.find((a) => a.i === "q1" && a.type === "comment");
  assert.ok(note, `a note action for q1: ${JSON.stringify(got.actions)}`);
  assert.equal(note.text, "See the screenshot.");
  assert.equal(note.images.length, 1);
  assert.equal(note.images[0].name, "shot.png");
  assert.ok(note.images[0].path, "the image names the file the console saved");
});

// What a person sees break: the Subagents tab missing once helpers are
// reported, or showing the wrong state.
test("posting helpers adds a Subagents tab that lists each with its state and result", async (t) => {
  const s = await openSession(await suite.browser(), {
    t,
    workflow: "implement",
    payload: { agent: { status: "working", activity: "Task 1 of 2" }, items: PLAN_QUESTION.items },
  });
  const tab = s.page.locator("nav").getByRole("button", { name: /^Subagents/ });
  assert.equal(await tab.count(), 0, "no tab before any helper is reported");

  s.post({
    helpers: [
      reportedHelper("h1", { title: "Read the store helpers", state: "running" }),
      reportedHelper("h2", { title: "Check the tests", state: "done", result: "All 9 pass." }),
    ],
  });
  await tab.waitFor();
  await tab.click();
  const card = s.page.locator("#main .sa-card");
  await card.getByRole("heading", { name: "Subagents" }).waitFor();
  const rows = card.locator(".sa-row");
  assert.equal(await rows.count(), 2);
  const running = rows.filter({ hasText: "Read the store helpers" });
  const done = rows.filter({ hasText: "Check the tests" });
  assert.match(await textOf(running.locator(".sa-pill")), /running/i);
  assert.match(await textOf(done.locator(".sa-pill")), /done/i);
  assert.match(await textOf(done), /All 9 pass\./);
  assert.match(await textOf(running), /Find the callers of applyPatch/);
});

// What a person sees break: the strength they saved not shown when the dialog
// opens again, a help line that ignores their pick, or Save dropping it.
test("the Subagents dialog shows the saved strength, explains the picked one, goes inert under Work alone and saves it", async (t) => {
  const s = await openSession(await suite.browser(), {
    t,
    workflow: "implement",
    payload: { agent: { status: "working", activity: "Task 1 of 2" } },
  });
  const modal = s.page.locator("#subagents-modal");
  const radio = (value) => modal.locator(`input[name="subagents-strength"][value="${value}"]`);
  const help = modal.locator("#subagents-strength-help");
  const open = async () => {
    await s.page.locator("#btn-subagents").click();
    await modal.waitFor();
  };

  await open();
  assert.equal(await radio("balanced").isChecked(), true, "an unsaved strength opens as Balanced");
  assert.match(await textOf(help), /light for lookups/);
  await radio("thrifty").check();
  assert.match(await textOf(help), /One step lighter everywhere/);
  await modal.locator('input[name="subagents-on"][value="off"]').check();
  for (const value of ["balanced", "thrifty", "best", "session"]) assert.equal(await radio(value).isDisabled(), true, `${value} is inert under Work alone`);
  await modal.locator('input[name="subagents-on"][value="on"]').check();
  assert.equal(await radio("thrifty").isEnabled(), true);

  const posted = s.page.waitForRequest((r) => r.url().endsWith("/subagents") && r.method() === "POST");
  await modal.getByRole("button", { name: "Save", exact: true }).click();
  assert.equal(JSON.parse((await posted).postData()).strength, "thrifty");
  await modal.waitFor({ state: "hidden" });

  // The next frame carries the saved strength; the dialog opens on it.
  await s.page.waitForFunction(async () => (await (await fetch("/state")).json()).subagents.strength === "thrifty");
  await open();
  assert.equal(await radio("thrifty").isChecked(), true, "the saved strength is checked");
  assert.match(await textOf(help), /One step lighter everywhere/);
});

// What a person sees break: the strength a helper ran with missing from the
// tab, or a stray line under a helper that reported none.
test("the Subagents tab shows a reported helper's strength line and none for a helper without one", async (t) => {
  const s = await openSession(await suite.browser(), {
    t,
    workflow: "implement",
    payload: { agent: { status: "working", activity: "Task 1 of 2" } },
  });
  s.post({
    helpers: [
      reportedHelper("h1", { title: "Read the store helpers", strength: "standard", effort: "medium" }),
      reportedHelper("h2", { title: "Check the tests" }),
    ],
  });
  const tab = s.page.locator("nav").getByRole("button", { name: /^Subagents/ });
  await tab.waitFor();
  await tab.click();
  const rows = s.page.locator("#main .sa-card .sa-row");
  await rows.first().waitFor();
  const strength = rows.filter({ hasText: "Read the store helpers" }).locator(".sa-strength");
  assert.equal(await strength.getAttribute("aria-label"), "Standard, medium effort");
  const badges = strength.locator(".sa-badge");
  assert.deepEqual(await badges.allTextContents(), ["Standard", "Medium effort"]);
  assert.deepEqual(await badges.evaluateAll((els) => els.map((e) => e.className)), ["sa-badge is-strength lvl-2", "sa-badge is-effort lvl-2"]);
  assert.equal(await badges.first().locator(".sa-bars i.on").count(), 2);
  assert.equal(await rows.filter({ hasText: "Check the tests" }).locator(".sa-strength").count(), 0);
});
