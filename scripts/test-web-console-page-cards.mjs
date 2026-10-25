// Page tests for question cards: every kind answered on the page and sent, the
// sign-off card, and a redraw keeping your place. Run with:
// node --test scripts/test-web-console-page-cards.mjs
//
// Each test drives the real console in a real Chrome or Edge through
// scripts/page-test-helpers.mjs: one browser for the file, a fresh console
// session per test.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { gitInit } from "./skill-script-helpers.mjs";
import { pageSuite, openSession, tempProject, sendAndCollect, itemCard, scrollTopOf } from "./page-test-helpers.mjs";

const suite = pageSuite(test);

test("a session with nothing posted yet shows its starting screen, and stop ends its server", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan" });
  assert.match(await s.page.innerText("#main"), /Starting Plan/);
  assert.equal(await s.page.locator("#main .pose-stage").count(), 1);
  await s.stop();
  assert.equal(await s.answers(), false, "the server still answers after stop()");
});

test("a text answer typed on the page reaches the agent as it was typed", async (t) => {
  const s = await openSession(await suite.browser(), {
    t,
    workflow: "plan",
    payload: { items: [{ id: "q1", kind: "text", title: "What to call it", body: "A short name for the export." }] },
  });
  await itemCard(s.page, "q1").locator("textarea, input[type=text]").first().fill("audit-export");
  const got = await sendAndCollect(s);
  assert.equal(got.type, "submit");
  assert.deepEqual(
    got.actions.map(({ i, type, text }) => ({ i, type, text })),
    [{ i: "q1", type: "answer", text: "audit-export" }]
  );
  assert.match(got.reply, /audit-export/);
});

// The agent's side of one question: settle what came before, post `item`
// alone, and wait for its card.
async function ask(s, item) {
  s.post({ settle: true, items: [item] });
  const card = itemCard(s.page, item.id);
  await card.waitFor();
  return card;
}

// The answer an agent reads for item `id`, without the routing fields.
function answerTo(got, id) {
  const action = got.actions.find((a) => a.i === id);
  assert.ok(action, `the send carries an answer to ${id}: ${JSON.stringify(got.actions)}`);
  const { i, type, kind, ...answer } = action;
  assert.equal(type, "answer");
  return answer;
}

const opt = (k, text) => ({ k, text, detail: `The ${text.toLowerCase()} option.` });

test("every kind of question card sends the answer shape the agent reads", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan" });

  let card = await ask(s, { id: "c1", kind: "choice", title: "Export format", body: "Which format?", options: [opt("A", "CSV"), opt("B", "JSON")] });
  await card.getByLabel("JSON").check();
  let got = await sendAndCollect(s);
  assert.deepEqual(answerTo(got, "c1"), { k: "B" });
  assert.equal(got.reply, "Export format: B");

  card = await ask(s, { id: "c2", kind: "choice", title: "Where it goes", body: "Where?", allowOther: true, options: [opt("A", "Email"), opt("B", "Slack")] });
  await card.getByRole("radio", { name: "Something else, in your own words" }).check();
  await card.locator("textarea").fill("A shared drive");
  got = await sendAndCollect(s);
  assert.deepEqual(answerTo(got, "c2"), { text: "A shared drive" });
  assert.equal(got.reply, "Where it goes: A shared drive");

  card = await ask(s, { id: "m1", kind: "multi", title: "Columns", body: "Which?", options: [opt("1", "Date"), opt("2", "User"), opt("3", "Action")], presets: [{ label: "Date and user", ks: ["1", "2"] }] });
  await card.getByRole("button", { name: "Date and user" }).click();
  await card.getByLabel("Action").check();
  await card.locator("textarea").fill("and the IP");
  got = await sendAndCollect(s);
  assert.deepEqual(answerTo(got, "m1"), { ks: ["1", "2", "3"], text: "and the IP" });
  assert.equal(got.reply, "Columns: 1, 2, 3; and the IP");

  card = await ask(s, { id: "t1", kind: "text", title: "What to call it", body: "A name.", pattern: "^[a-z][a-z0-9-]*$", patternHint: "Lowercase letters, digits and hyphens.", placeholder: "For example: audit-export" });
  const field = card.locator("input[type=text]");
  // The suggestion is the placeholder without its "For example:" lead-in.
  await card.getByRole("button", { name: "Autofill suggestion" }).click();
  assert.equal(await field.inputValue(), "audit-export");
  await field.fill("Audit Export");
  await card.getByText("Lowercase letters, digits and hyphens.").waitFor();
  assert.equal(await s.page.locator("#btn-send").isDisabled(), true, "a value that breaks the pattern is not sendable");
  await field.fill("audit-export");
  got = await sendAndCollect(s);
  assert.deepEqual(answerTo(got, "t1"), { text: "audit-export" });
  assert.equal(got.reply, "What to call it: audit-export");

  card = await ask(s, { id: "y1", kind: "confirm", title: "Keep going", body: "Carry on?" });
  await card.getByRole("button", { name: "Yes" }).click();
  got = await sendAndCollect(s);
  assert.deepEqual(answerTo(got, "y1"), { yes: true });
  assert.equal(got.reply, "Keep going: yes");

  card = await ask(s, { id: "r1", kind: "recap", title: "What we decided", body: "Is this right?", summary: "- CSV\n- Mondays" });
  await card.getByRole("button", { name: "Yes, that is right" }).click();
  got = await sendAndCollect(s);
  assert.deepEqual(answerTo(got, "r1"), { ok: true });
  assert.equal(got.reply, "What we decided: confirmed");

  card = await ask(s, { id: "k1", kind: "checklist", title: "Set up access", body: "Only you can do these.", steps: ["Create the app", "Paste its key"] });
  await card.locator("input[type=checkbox]").first().check();
  await card.getByRole("button", { name: "All done" }).click();
  got = await sendAndCollect(s);
  assert.deepEqual(answerTo(got, "k1"), { done: [0], state: "done" });
  assert.equal(got.reply, "Set up access: all done; did steps 1");

  card = await ask(s, { id: "n1", kind: "menu", title: "What next", body: "Pick one.", options: [opt("1", "Keep planning"), opt("2", "Stop here")] });
  await card.getByLabel("Stop here").check();
  got = await sendAndCollect(s);
  assert.deepEqual(answerTo(got, "n1"), { k: "2" });
  assert.equal(got.reply, "What next: 2");

  const rows = [
    { id: "a", title: "Read the data", body: "x" },
    { id: "b", title: "Write the file", body: "y" },
  ];
  card = await ask(s, { id: "l1", kind: "list", title: "The steps", body: "Reorder or rename.", rows });
  await card.getByRole("button", { name: "No changes" }).click();
  got = await sendAndCollect(s);
  assert.deepEqual(answerTo(got, "l1"), { text: "no changes" });
  assert.equal(got.reply, "The steps: no changes");

  card = await ask(s, { id: "l2", kind: "list", title: "The steps again", body: "Reorder or rename.", rows });
  await card.locator("input[type=text]").first().fill("Read the audit log");
  got = await sendAndCollect(s);
  assert.deepEqual(
    answerTo(got, "l2").rows.map((r) => [r.id, r.title]),
    [["a", "Read the audit log"], ["b", "Write the file"]]
  );
  assert.equal(got.reply, "The steps again: the list: Read the audit log, then Write the file; renamed Read the data to Read the audit log");

  s.post({ settle: true, items: [{ id: "x1", kind: "notice", title: "Heads up", body: "The export runs **nightly**." }] });
  await s.page.getByText("The export runs").waitFor();
  assert.equal(await s.page.locator("#btn-send").isDisabled(), true, "a notice alone gives nothing to send");
});

test("a sign-off card opens its document, and each verdict reaches the agent", async (t) => {
  const s = await openSession(await suite.browser(), {
    t,
    workflow: "implement",
    payload: {
      docs: [{ id: "report", title: "Completion report", blocks: [{ id: "b1", state: "settled", md: "## Summary\n\nPhase 3 adds the /tasks endpoints." }] }],
    },
  });
  const signoff = (id, extra = {}) => ({
    id,
    kind: "review",
    title: "Approve this phase",
    doc: "report",
    body: "Read the report, then approve it or say what to change.",
    verdicts: [
      { id: "approve", label: "Approve this phase" },
      { id: "changes", label: "I want changes" },
      { id: "discard", label: "Throw it away", danger: true },
    ],
    ...extra,
  });

  let card = await ask(s, signoff("so1"));
  await card.getByRole("button", { name: /Read .*Completion report.* in full/ }).click();
  await s.page.getByText("Phase 3 adds the /tasks endpoints.").waitFor();
  assert.ok(await s.page.getByText("Phase 3 adds the /tasks endpoints.").isVisible(), "the report is on screen");
  // The danger verdict is marked as such: here the class is the behaviour.
  await s.page.locator("#views").getByRole("button", { name: /^Questions/ }).click();
  card = itemCard(s.page, "so1");
  assert.match(await card.getByRole("button", { name: "Throw it away" }).getAttribute("class"), /danger/);
  assert.doesNotMatch(await card.getByRole("button", { name: "Approve this phase" }).getAttribute("class"), /danger/);

  await card.getByRole("button", { name: "Approve this phase" }).click();
  let got = await sendAndCollect(s);
  assert.deepEqual(answerTo(got, "so1"), { verdict: "approve" });

  card = await ask(s, signoff("so2"));
  await card.getByRole("button", { name: "I want changes" }).click();
  await card.locator("textarea").fill("Keep the header row.");
  got = await sendAndCollect(s);
  assert.deepEqual(answerTo(got, "so2"), { verdict: "changes", text: "Keep the header row." });
});

const longText = (n) => Array.from({ length: n }, (_, i) => `Paragraph ${i + 1}. The export runs every night and keeps a year of rows.`).join("\n\n");

// The agent posts something unrelated, and the page redraws: wait until the
// new title is drawn.
async function unrelatedPost(s, title) {
  s.post({ title });
  await s.page.waitForFunction((want) => document.getElementById("title").textContent.includes(want), title);
}

test("a redraw keeps your place: the scroll and the focused field survive an agent post", async (t) => {
  const s = await openSession(await suite.browser(), {
    t,
    workflow: "plan",
    payload: {
      items: [{ id: "q1", kind: "text", title: "What to call it", body: longText(40) }],
      docs: [{ id: "map", title: "What we've agreed", blocks: [{ id: "b1", state: "settled", md: longText(80) }] }],
    },
  });

  // Reading a question part-way down: the card scrolls itself.
  const card = itemCard(s.page, "q1");
  await card.evaluate((el) => (el.scrollTop = 400));
  assert.equal(await card.evaluate((el) => el.scrollTop), 400, "the question card scrolls");
  await unrelatedPost(s, "Audit export, take two");
  assert.equal(await itemCard(s.page, "q1").evaluate((el) => el.scrollTop), 400);

  // Typing in its answer box: the box keeps the focus and the caret, and the
  // card stays where it was.
  const field = itemCard(s.page, "q1").locator("textarea, input[type=text]").first();
  await field.click();
  await field.pressSequentially("audit-ex");
  await field.evaluate((el) => el.setSelectionRange(3, 3));
  const typingAt = await itemCard(s.page, "q1").evaluate((el) => el.scrollTop);
  await unrelatedPost(s, "Audit export, take three");
  const after = itemCard(s.page, "q1").locator("textarea, input[type=text]").first();
  assert.deepEqual(await after.evaluate((el) => [el === document.activeElement, el.value, el.selectionStart]), [true, "audit-ex", 3]);
  assert.equal(await itemCard(s.page, "q1").evaluate((el) => el.scrollTop), typingAt);

  // On a doc: the column scrolls.
  await s.page.locator("#views").getByRole("button", { name: /What we've agreed/ }).click();
  await s.page.getByText("Paragraph 80.").waitFor();
  await s.page.locator("#main").evaluate((el) => (el.scrollTop = 900));
  const docBefore = await scrollTopOf(s.page, "#main");
  assert.ok(docBefore > 0, "the doc column scrolls");
  await unrelatedPost(s, "Audit export, take four");
  assert.equal(await scrollTopOf(s.page, "#main"), docBefore);
});

// The progress line under the title, once the page has drawn `want`.
async function progressSays(s, want) {
  await s.page.waitForFunction((w) => document.getElementById("progress-text").textContent === w, want, { timeout: 5000 }).catch(() => {});
  return (await s.page.innerText("#progress-text")).trim();
}

// One answered question, so a question workflow has something to count.
const answered = { id: "a1", kind: "text", title: "What to call it", body: "A name.", status: "answered", answer: { text: "audit-export" } };
const open = { id: "o1", kind: "text", title: "Who uses it", body: "Who?" };

test("a build's header counts its tasks, 0 done included, and a question workflow counts its answers", async (t) => {
  for (const workflow of ["implement", "implement-review", "quick-task"]) {
    const s = await openSession(await suite.browser(), {
      t,
      workflow,
      payload: { headline: { stage: "Phase 3", cleared: 3, total: 9 }, items: [answered] },
    });
    assert.equal(await progressSays(s, "3 of 9 done"), "3 of 9 done", `${workflow} counts its tasks`);
    s.post({ headline: { cleared: 0 } });
    assert.equal(await progressSays(s, "0 of 9 done"), "0 of 9 done", `${workflow}: 0 done is 0 done, not the answered card`);
    // A build between counts (a review starting at total 0) shows its stage.
    s.post({ headline: { stage: "Reviewing the phase", cleared: 0, total: 0 }, items: [open] });
    assert.equal(await progressSays(s, "Reviewing the phase"), "Reviewing the phase", `${workflow} shows its stage at total 0`);
    assert.equal(await s.page.locator("#progress-bar").isHidden(), true, `${workflow}: no track for a stage`);
    await s.stop();
  }

  // A question workflow that set a total and never moved `cleared` fills as
  // cards are answered, and at total 0 counts its cards instead of the stage.
  const s = await openSession(await suite.browser(), {
    t,
    workflow: "plan",
    payload: { headline: { stage: "Charting", cleared: 0, total: 4 }, items: [answered] },
  });
  assert.equal(await progressSays(s, "1 of 4 answered"), "1 of 4 answered");
  s.post({ headline: { total: 0 }, items: [open] });
  assert.equal(await progressSays(s, "1 of 2 answered"), "1 of 2 answered");
});

test("an answer typed over several lines reaches the agent under its title, never as reply lines of its own", async (t) => {
  const s = await openSession(await suite.browser(), {
    t,
    workflow: "plan",
    payload: { items: [{ id: "q1", kind: "text", title: "What to call it", body: "A short name for the export." }] },
  });
  await itemCard(s.page, "q1").locator("textarea").fill("audit-export\nIdea name: not a heading");
  const got = await sendAndCollect(s);
  assert.equal(answerTo(got, "q1").text, "audit-export\nIdea name: not a heading");
  assert.ok(got.reply.includes("What to call it: audit-export\n  Idea name: not a heading"), `the second line is not indented under its title: ${JSON.stringify(got.reply)}`);
});

test("a redraw keeps the place of the dashboard, the waiting screen and the finished screen, and a new question starts at its top", async (t) => {
  // The dashboard's menu scrolls itself.
  let s = await openSession(await suite.browser(), { t, workflow: "dashboard" });
  await s.page.setViewportSize({ width: 1280, height: 420 });
  await s.page.getByRole("button", { name: "Skip the intro" }).click();
  await s.page.locator("#main").getByRole("heading", { name: "What are we doing today?" }).waitFor();
  const welcomeDone = s.page.getByRole("button", { name: "Start building" });
  if (await welcomeDone.isVisible()) await welcomeDone.click();
  await welcomeDone.waitFor({ state: "hidden" });
  await s.page.locator("#main > .dash").evaluate((el) => (el.scrollTop = 150));
  assert.equal(await scrollTopOf(s.page, "#main > .dash"), 150, "the dashboard scrolls");
  await unrelatedPost(s, "Dashboard, take two");
  assert.equal(await scrollTopOf(s.page, "#main > .dash"), 150, "the dashboard lost its place");
  await s.stop();

  // A build with nothing to ask yet: the waiting screen, and then its finish.
  s = await openSession(await suite.browser(), {
    t,
    workflow: "implement",
    payload: { headline: { stage: "Phase 1", cleared: 0, total: 3 }, agent: { status: "working", activity: "Task 1 of 3: the reader" } },
  });
  await s.page.setViewportSize({ width: 1280, height: 300 });
  const pane = "#main > .waiting-pane";
  await s.page.locator(pane).waitFor();
  await s.page.locator(pane).evaluate((el) => (el.scrollTop = 60));
  const waitingAt = await scrollTopOf(s.page, pane);
  assert.ok(waitingAt > 0, "the waiting screen scrolls");
  await unrelatedPost(s, "Phase 1, take two");
  assert.equal(await scrollTopOf(s.page, pane), waitingAt, "the waiting screen lost its place");

  s.post({ finish: { headline: "Phase 1 is done", body: longText(30), command: "/plan2code-3-implement specs/audit-export/overview.md" } });
  await s.page.locator("#main").getByRole("heading", { name: "Phase 1 is done" }).waitFor();
  const end = "#main > .card";
  await s.page.locator(end).evaluate((el) => (el.scrollTop = 300));
  assert.equal(await scrollTopOf(s.page, end), 300, "the finished screen scrolls");
  await unrelatedPost(s, "Phase 1, take three");
  assert.equal(await scrollTopOf(s.page, end), 300, "the finished screen lost its place");
  await s.stop();

  // Part-way down one question, a new one arrives: it starts at its top.
  s = await openSession(await suite.browser(), {
    t,
    workflow: "plan",
    payload: { items: [{ id: "q1", kind: "text", title: "What to call it", body: longText(40) }] },
  });
  await itemCard(s.page, "q1").evaluate((el) => (el.scrollTop = 400));
  s.post({ items: [{ id: "q2", kind: "text", title: "Who uses it", body: longText(40) }] });
  await itemCard(s.page, "q2").waitFor();
  assert.equal(await itemCard(s.page, "q2").evaluate((el) => el.scrollTop), 0, "the new question opened part-way down");
});

// The accent colour as the browser resolves it, and a button's outline colour,
// so "wears the accent" is read off the screen, not off a class name.
const accentOf = (page) =>
  page.evaluate(() => {
    const probe = document.createElement("i");
    probe.style.color = "var(--accent)";
    document.body.appendChild(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  });
const outlineOf = (button) => button.evaluate((b) => getComputedStyle(b).borderTopColor);
const warnOf = (page) =>
  page.evaluate(() => {
    const probe = document.createElement("i");
    probe.style.color = "var(--warn)";
    document.body.appendChild(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  });

// What a person sees break: the way forward on a sign-off card looks like any
// other choice.
test("on a sign-off card, approve and yes are outlined in the accent until picked, and the others are not", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "implement" });
  const accent = await accentOf(s.page);
  const review = (id, verdicts) => ({ id, kind: "review", title: "Sign off " + id, body: "Read it.", verdicts });

  let card = await ask(s, review("so1", [{ id: "approve", label: "Approve this phase" }, { id: "changes", label: "I want changes" }]));
  const approve = card.getByRole("button", { name: "Approve this phase" });
  assert.equal(await outlineOf(approve), accent, "an unpicked approve is outlined in the accent");
  assert.notEqual(await outlineOf(card.getByRole("button", { name: "I want changes" })), accent, "the other verdict is not");
  await approve.click();
  await s.page.waitForFunction(() => document.querySelector("#btn-send:not(:disabled)"));
  assert.equal(await approve.evaluate((b) => getComputedStyle(b).backgroundColor), accent, "picked, approve fills with the accent");

  card = await ask(s, review("so2", [{ id: "yes", label: "Build it" }, { id: "no", label: "Not yet" }]));
  assert.equal(await outlineOf(card.getByRole("button", { name: "Build it" })), accent, "an unpicked yes is outlined too");
  assert.notEqual(await outlineOf(card.getByRole("button", { name: "Not yet" })), accent);
});

// What a person sees break: Skip this one turns into a full-size button, or
// the quick answer under a note box does.
test("Skip this one and a comment box's quick answer are the same small accent button", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan" });
  const rows = [{ id: "a", title: "Read the data", body: "x" }];
  const card = await ask(s, { id: "l1", kind: "list", title: "The steps", body: "Rename.", required: false, rows });
  const skip = card.getByRole("button", { name: "Skip this one" });
  const quick = card.getByRole("button", { name: "No changes" });
  const look = (b) => b.evaluate((x) => { const c = getComputedStyle(x); return [c.fontSize, c.paddingTop, c.paddingLeft, c.color]; });
  assert.deepEqual(await look(skip), await look(quick), "the two chips look alike");
  const [size, , , colour] = await look(skip);
  assert.equal(size, "12px", "small, not a full-size button");
  assert.equal(colour, await accentOf(s.page), "in the accent");
});

// What a person sees break: Combine phases is missing from a plan's breakdown,
// fills nothing, or shows on a list that is not phases.
test("a plan's breakdown offers Combine phases beside No changes, and other workflows do not", async (t) => {
  const rows = [{ id: "a", title: "Read the data", body: "x" }];
  let s = await openSession(await suite.browser(), { t, workflow: "plan" });
  let card = await ask(s, { id: "l1", kind: "list", title: "Build order", body: "Reorder.", rows });
  const quicks = card.locator(".quick-answer");
  assert.deepEqual(await quicks.allTextContents(), ["No changes", "Combine phases"]);
  await card.getByRole("button", { name: "Combine phases" }).click();
  const got = await sendAndCollect(s);
  assert.match(answerTo(got, "l1").text, /^Combine phases where possible/);

  s = await openSession(await suite.browser(), { t, workflow: "quick-task" });
  card = await ask(s, { id: "l2", kind: "list", title: "Steps", body: "Reorder.", rows });
  assert.deepEqual(await card.locator(".quick-answer").allTextContents(), ["No changes"]);
});

// What a person sees break: a safe yes looks like any button, or a risky yes
// stops warning.
test("a confirm's safe yes and a recap's yes are outlined in the accent, and a dangerous yes stays red", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan" });
  const accent = await accentOf(s.page);
  const warn = await warnOf(s.page);

  let card = await ask(s, { id: "y1", kind: "confirm", title: "Keep going", body: "Carry on?" });
  const yes = card.getByRole("button", { name: "Yes" });
  assert.equal(await outlineOf(yes), accent, "a safe, unpicked yes wears the accent");
  assert.notEqual(await outlineOf(card.getByRole("button", { name: "No" })), accent, "the no does not");
  await yes.click();
  await s.page.waitForFunction(() => document.querySelector("#btn-send:not(:disabled)"));
  assert.equal(await yes.evaluate((b) => getComputedStyle(b).backgroundColor), accent, "picked, it fills");

  card = await ask(s, { id: "y2", kind: "confirm", title: "Delete it", body: "Really?", danger: true });
  assert.equal(await outlineOf(card.getByRole("button", { name: "Yes" })), warn, "a dangerous yes stays red");

  card = await ask(s, { id: "r1", kind: "recap", title: "What we decided", body: "Right?", summary: "- CSV" });
  assert.equal(await outlineOf(card.getByRole("button", { name: "Yes, that is right" })), accent, "the recap's yes wears the accent");
});

// What a person sees break: a long question runs off the window with nothing
// to say there is more, or the fade stays on at the very end.
test("a card cut by the window fades at its bottom edge while there is more below", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan" });
  await s.page.setViewportSize({ width: 1280, height: 420 });
  const card = await ask(s, { id: "q1", kind: "text", title: "What to call it", body: longText(40) });
  const fades = () => card.evaluate((el) => { const c = getComputedStyle(el); return (c.maskImage || c.webkitMaskImage || "none") !== "none"; });
  await s.page.waitForFunction(() => { const c = document.querySelector("#main > .card"); return c && c.scrollHeight > c.clientHeight + 4; });
  await s.page.waitForFunction(() => { const c = document.querySelector("#main > .card"); const m = getComputedStyle(c); return (m.maskImage || m.webkitMaskImage || "none") !== "none"; });
  assert.equal(await fades(), true, "a cut card fades at the bottom");
  await card.evaluate((el) => (el.scrollTop = el.scrollHeight));
  await s.page.waitForFunction(() => { const c = document.querySelector("#main > .card"); const m = getComputedStyle(c); return (m.maskImage || m.webkitMaskImage || "none") === "none"; });
  assert.equal(await fades(), false, "at the end, the fade is gone");
});

// What a person sees break: a rename typed in a list is lost when the agent
// posts or Ctrl+Enter sends before the field was left.
test("a list rename is staged as it is typed, so Ctrl+Enter or an agent post never drops it", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan" });
  const rows = [{ id: "a", title: "Read the data", body: "x" }, { id: "b", title: "Write the file", body: "y" }];
  const card = await ask(s, { id: "l1", kind: "list", title: "The steps", body: "Rename.", rows });
  const first = card.locator("input.row-title").first();
  await first.click();
  await first.fill("Read the audit log");
  // The field is still focused: it has not changed or blurred.
  await s.page.waitForFunction(() => document.querySelector("#btn-send:not(:disabled)"));
  await unrelatedPost(s, "Steps, take two");
  assert.equal(await itemCard(s.page, "l1").locator("input.row-title").first().inputValue(), "Read the audit log", "the agent post kept the typed name");
  await itemCard(s.page, "l1").locator("input.row-title").first().focus();
  await s.page.keyboard.press("Control+Enter");
  const got = s.wait(10);
  assert.equal(got.code, 0, "Ctrl+Enter sent");
  assert.deepEqual(answerTo(got, "l1").rows.map((r) => [r.id, r.title]), [["a", "Read the audit log"], ["b", "Write the file"]]);
});

// What a person sees break: a send the agent already collected still shows as
// being with the agent, locking a question it left open.
test("a send made before the last collection is never shown as still with the agent", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan" });
  const card = await ask(s, { id: "q1", kind: "text", title: "What to call it", body: "A name." });
  // Sent from another tab: this page never learns of it except from the session.
  await s.page.evaluate(() =>
    fetch("/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actions: [{ i: "q1", type: "answer", kind: "text", text: "audit-export" }], reply: "What to call it: audit-export" }),
    })
  );
  const lock = card.getByText(/Plan2Code is working on it|Waiting for Plan2Code to pick this up/);
  await lock.waitFor();
  assert.equal(await card.locator("textarea").count(), 0, "before the agent collects it, the card is locked");
  // The agent collects it, leaves the question open and waits again.
  assert.equal(s.wait(10).code, 0);
  s.post({ agent: { status: "waiting" } });
  await card.locator("textarea").waitFor();
  assert.equal(await lock.count(), 0, "after the collection, it is not shown as sent");
});

// What a person sees break: a note box on a card above the git board grows and
// squeezes the board, or the card is cut short under it.
test("a note box over the git board grows no box, and the card flows at its own height", async (t) => {
  const dir = tempProject({ "README.md": "# Sample\n", "src/app.js": "export const app = 1;\n" });
  const g = gitInit(dir);
  g("add", "-A");
  g("commit", "-q", "-m", "First commit");
  fs.appendFileSync(path.join(dir, "src", "app.js"), "export const more = 2;\n");
  const confirm = { id: "y1", kind: "confirm", title: "Save these changes", body: "Commit them?" };
  const git = await openSession(await suite.browser(), {
    t,
    workflow: "git",
    project: dir,
    payload: { reread: true, board: { describe: "export-more" }, items: [confirm] },
  });
  await git.page.getByRole("tablist").waitFor();
  const gitCard = itemCard(git.page, "y1");
  await gitCard.waitFor();
  const note = gitCard.locator("textarea").first();
  const gitBox = await note.evaluate((el) => ({ min: el.style.minHeight, height: el.offsetHeight }));
  assert.equal(gitBox.min, "", "no height was filled in for the note box");
  assert.ok(gitBox.height < 120, `the note box keeps its ordinary height over the board: ${gitBox.height}`);
  assert.ok(await gitCard.evaluate((el) => el.scrollHeight <= el.clientHeight + 1), "the card is not shrunk under the board");

  // The same card away from the board does fill the free height of the card.
  const plan = await openSession(await suite.browser(), { t, workflow: "plan", payload: { items: [confirm] } });
  const planBox = plan.page.locator('[data-item="y1"] textarea').first();
  await planBox.waitFor();
  await plan.page.waitForFunction(() => document.querySelector('[data-item="y1"] textarea').offsetHeight >= 160);
  assert.ok((await planBox.evaluate((el) => el.offsetHeight)) > gitBox.height, "away from the board, the note box grows");
});

const three = ["First", "Second", "Third"].map((name, n) => ({ id: `q${n + 1}`, kind: "text", title: `${name} question`, body: `Body ${n + 1}.` }));

// What a person sees break: Previous and Next stop walking the open questions.
test("Previous and Next walk the questions still waiting, and the ends have no button", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: { items: three } });
  const pager = s.page.getByRole("navigation", { name: "Move between the questions waiting" });
  const shown = () => s.page.locator("#main [data-item]").first().getAttribute("data-item");
  await pager.getByText("1 of 3 waiting").waitFor();
  assert.equal(await pager.getByRole("button", { name: /Previous/ }).count(), 0, "nothing before the first");
  await pager.getByRole("button", { name: /Next.*Second question/ }).click();
  await pager.getByText("2 of 3 waiting").waitFor();
  assert.equal(await shown(), "q2");
  await pager.getByRole("button", { name: /Next.*Third question/ }).click();
  await pager.getByText("3 of 3 waiting").waitFor();
  assert.equal(await pager.getByRole("button", { name: /Next/ }).count(), 0, "nothing after the last");
  await pager.getByRole("button", { name: /Previous.*Second question/ }).click();
  await pager.getByText("2 of 3 waiting").waitFor();
  assert.equal(await shown(), "q2");
});

// What a person sees break: Skip this one does nothing, or leaves you on the
// card you skipped.
test("Skip this one on an optional card moves on, and the skip reaches the agent", async (t) => {
  const items = three.map((q, n) => ({ ...q, required: n !== 2 ? false : true }));
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: { items } });
  const card = itemCard(s.page, "q1");
  await card.getByRole("button", { name: "Skip this one" }).click();
  await s.page.waitForFunction(() => document.querySelector("#main [data-item]")?.dataset.item === "q2");
  assert.equal(await itemCard(s.page, "q3").getByRole("button", { name: "Skip this one" }).count(), 0, "a required card cannot be skipped");
  await itemCard(s.page, "q2").locator("textarea").fill("Ana");
  await s.page.getByRole("navigation", { name: "Move between the questions waiting" }).getByRole("button", { name: /Next/ }).click();
  await itemCard(s.page, "q3").locator("textarea").fill("Bo");
  const got = await sendAndCollect(s);
  assert.deepEqual(
    got.actions.map(({ i, type, text }) => ({ i, type, text })),
    [{ i: "q1", type: "skip", text: undefined }, { i: "q2", type: "answer", text: "Ana" }, { i: "q3", type: "answer", text: "Bo" }]
  );
});

// What a person sees break: an answered question can be edited again, or says
// nothing about what was answered.
test("a settled card is a record: your answer in words, the options as marks, and no form", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan" });
  s.post({
    settle: true,
    items: [
      { id: "c1", kind: "choice", title: "Export format", body: "Which?", options: [opt("A", "CSV"), opt("B", "JSON")], status: "answered", answer: { k: "B" } },
      { id: "q9", kind: "text", title: "Still open", body: "Next." },
    ],
  });
  await s.page.locator("#sidebar").getByRole("button", { name: /Export format/ }).click();
  const card = itemCard(s.page, "c1");
  await card.waitFor();
  const record = card.locator(".answered");
  assert.match(await record.innerText(), /Your answer[\s\S]*JSON/i);
  assert.match(await record.innerText(), /Locked\./);
  assert.equal(await card.locator("input, textarea").count(), 0, "a record has no inputs");
});

// What a person sees break: a card still takes edits after Send, or never
// opens again when the agent hands it back.
test("a sent card locks, and the agent's next post on it unlocks it", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: { items: [three[0]] } });
  const card = itemCard(s.page, "q1");
  await card.locator("textarea").fill("Ana");
  await s.page.click("#btn-send");
  const lock = card.getByText(/Plan2Code is working on it|Waiting for Plan2Code to pick this up/);
  await lock.waitFor();
  assert.match(await card.locator(".answered").innerText(), /Sent[\s\S]*Ana/i);
  assert.equal(await card.locator("textarea").count(), 0, "no form while the agent has it");
  s.wait(10);
  s.post({ items: [{ id: "q1", status: "reopened", thread: [{ who: "agent", text: "Which Ana?" }] }], agent: { status: "waiting" } });
  await card.locator("textarea").waitFor();
  assert.equal(await lock.count(), 0, "the next post gives the card back");
});

// What a person sees break: the "something else" box takes the words but the
// pick sent is still the listed option, or the pick is lost on a switch back.
test("Something else in your own words replaces the pick, and picking an option again drops the words", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan" });
  const card = await ask(s, { id: "c1", kind: "choice", title: "Where", body: "Where?", options: [opt("A", "Email"), opt("B", "Slack")] });
  await card.getByLabel("Email").check();
  const other = card.getByRole("radio", { name: "Something else, in your own words" });
  await other.check();
  await card.locator("textarea.other-text").fill("A shared drive");
  assert.equal(await card.getByLabel("Email").isChecked(), false, "the options and the other share one group");
  await card.getByLabel("Slack").check();
  await other.check();
  assert.equal(await card.locator("textarea.other-text").inputValue(), "A shared drive", "the words survive a switch");
  const got = await sendAndCollect(s);
  assert.deepEqual(answerTo(got, "c1"), { text: "A shared drive" });
});

// What a person sees break: a note typed on a card is dropped by the verdict,
// or is lost when the verdict comes first.
test("a note's comment field rides along with the answer, typed before or after the pick", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan" });
  let card = await ask(s, { id: "y1", kind: "confirm", title: "Keep going", body: "Carry on?" });
  await card.getByLabel("Anything to add?").fill("Only on weekdays.");
  await card.getByRole("button", { name: "Yes" }).click();
  let got = await sendAndCollect(s);
  assert.deepEqual(answerTo(got, "y1"), { yes: true, text: "Only on weekdays." });
  assert.equal(got.reply, "Keep going: yes; Only on weekdays.");

  card = await ask(s, { id: "y2", kind: "confirm", title: "And this", body: "Also?" });
  await card.getByRole("button", { name: "No" }).click();
  await card.getByLabel("Anything to add?").fill("Not this quarter.");
  got = await sendAndCollect(s);
  assert.deepEqual(answerTo(got, "y2"), { yes: false, text: "Not this quarter." });
});

/* ----------------------------------------------------------------- docs */

// What a person sees break: a guess reads like a decision, or a draft does.
test("a doc tags an assumed block and a draft block, and shows a file block's text", async (t) => {
  const project = tempProject({ "notes/facts.md": "The export keeps **a year** of rows.\n" });
  const s = await openSession(await suite.browser(), {
    t,
    workflow: "plan",
    project,
    payload: {
      docs: [
        {
          id: "map",
          title: "What we've agreed",
          blocks: [
            { id: "b1", state: "settled", md: "Runs nightly." },
            { id: "b2", state: "assumed", md: "Output is CSV." },
            { id: "b3", state: "draft", md: "Maybe a weekly digest." },
            { id: "b4", file: "notes/facts.md" },
          ],
        },
      ],
    },
  });
  await s.page.locator("#views").getByRole("button", { name: /What we've agreed/ }).click();
  const block = (id) => s.page.locator(`#main [data-block="${id}"]`);
  await block("b4").waitFor();
  assert.equal(await block("b1").innerText(), "Runs nightly.", "a settled block has no tag");
  assert.match(await block("b2").innerText(), /^assumed for now, still open\s+Output is CSV\.$/i);
  assert.match(await block("b3").innerText(), /^draft\s+Maybe a weekly digest\.$/i);
  assert.match(await block("b4").innerText(), /The export keeps a year of rows\./, "the file's text is on the page");
});

// What a person sees break: Download hands over something other than the
// document, or loses which parts are still guesses.
test("Download offers a Markdown file with the doc's title, blocks and marks", async (t) => {
  const s = await openSession(await suite.browser(), {
    t,
    workflow: "plan",
    payload: {
      docs: [{ id: "map", title: "What we've agreed", blocks: [{ id: "b1", state: "settled", md: "Runs nightly." }, { id: "b2", state: "assumed", md: "Output is CSV." }] }],
    },
  });
  await s.page.locator("#views").getByRole("button", { name: /What we've agreed/ }).click();
  const [download] = await Promise.all([s.page.waitForEvent("download"), s.page.getByRole("button", { name: "Download" }).click()]);
  assert.equal(download.suggestedFilename(), "what-we-ve-agreed.md");
  const chunks = [];
  for await (const c of await download.createReadStream()) chunks.push(c);
  assert.equal(Buffer.concat(chunks).toString("utf8"), "# What we've agreed\n\nRuns nightly.\n\n> **Assumed for now, still open.**\n\nOutput is CSV.");
});

// What a person sees break: a long document has no way home but the first
// tab, or its header scrolls away with the text.
test("a document's header stays on screen and its Back to Questions button returns to the questions", async (t) => {
  const blocks = Array.from({ length: 60 }, (_, i) => ({ id: "b" + i, state: "settled", md: `Paragraph ${i}. ` + "More words. ".repeat(40) }));
  const s = await openSession(await suite.browser(), {
    t,
    workflow: "plan",
    payload: {
      items: [{ id: "q1", kind: "text", title: "A question", body: "Say something." }],
      docs: [{ id: "map", title: "What we've agreed", blocks }],
    },
  });
  await s.page.locator("#views").getByRole("button", { name: /What we've agreed/ }).click();
  const back = s.page.getByRole("button", { name: "Back to Questions" });
  await back.waitFor();
  await s.page.evaluate(() => { document.getElementById("main").scrollTop = 4000; });
  const box = await back.boundingBox();
  const main = await s.page.locator("#main").boundingBox();
  assert.ok(box && box.y >= main.y - 1 && box.y < main.y + 80, "the header row is still at the top of the pane after scrolling");
  await back.click();
  await s.page.getByText("Say something.").waitFor();
  assert.equal(await s.page.getByRole("button", { name: "Back to Questions" }).count(), 0, "the questions view has no Back button");
});

// What a person sees break: the brief button turns up where no playbook
// answers it, or sends a different range than the one picked.
test("a pathfinder session offers Write a brief, and the picked range reaches the agent", async (t) => {
  const plain = await openSession(await suite.browser(), { t, workflow: "plan" });
  assert.equal(await plain.page.locator("#btn-brief").isHidden(), true, "no brief button outside pathfinder");
  await plain.stop();

  const s = await openSession(await suite.browser(), { t, workflow: "pathfinder", payload: { agent: { status: "waiting" } } });
  await s.page.getByRole("button", { name: "Write a brief" }).first().click();
  const dialog = s.page.locator("#brief-modal");
  await dialog.getByLabel("This week").check();
  await dialog.getByRole("button", { name: "Write the brief" }).click();
  await dialog.waitFor({ state: "hidden" });
  const got = s.wait(10);
  assert.equal(got.code, 0, "a brief request was sent");
  assert.deepEqual(got.actions.map(({ i, type, range }) => ({ i, type, range })), [{ i: "__brief", type: "brief", range: "this week" }]);
  assert.equal(got.reply, "Write a brief for this week.");
});
