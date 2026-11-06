// Page tests for the Ask tab: a Quick question and the agent's reply, the
// starters, a retry after a failed send, a new conversation, a picture attached
// to a note, the Subagents tab, and the Ask for suggestions chip. Run with:
// node --test scripts/test-web-console-page-ask.mjs
//
// Each test drives the real console in a real Chrome or Edge through
// scripts/page-test-helpers.mjs: one browser for the file, a fresh console
// session per test.

import test from "node:test";
import assert from "node:assert/strict";
import { pageSuite, openSession, itemCard, textOf , fillBox, boxValue} from "./page-test-helpers.mjs";
import { reportedHelper } from "./web-console-test-helpers.mjs";
import { readChat } from "../src/web-console/inbox.mjs";

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
  // The wire hands over the Quick questions' seq numbers; the entries stay in the
  // session's chat log, so the tests read them from there.
  if (Array.isArray(got.chat)) {
    const seqs = new Set(got.chat);
    got.chat = readChat(s.session).filter((e) => seqs.has(e.seq));
    got.type ||= "chat";
  }
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
  await fillBox(box, text);
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
  assert.match(got.reply, /^Quick question \(\d+\): Where does the export live\?$/m);
  // The question is in the pane, and the box is empty for the next one.
  await s.page.locator(".ask-row.person").getByText("Where does the export live?").waitFor();
  assert.equal(await boxValue(s.page.locator("#ask-input")), "");

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
  assert.equal(await boxValue(box), first, "the starter fills the box");
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
  await fillBox(aside.locator("#thread-q1"), "See the screenshot.");

  await s.page.click("#btn-send");
  const got = collect(s);
  const note = got.actions.find((a) => a.i === "q1" && a.type === "comment");
  assert.ok(note, `a note action for q1: ${JSON.stringify(got.actions)}`);
  assert.equal(note.text, "See the screenshot.");
  assert.equal(note.images.length, 1);
  assert.equal(note.images[0].name, "shot.png");
  assert.ok(note.images[0].path, "the image names the file the console saved");
});

// What a person sees break: a thumbnail that does nothing on a click, or a
// picview that opens on the wrong picture and steals the focus when it goes.
test("a picture thumbnail opens the picview from the note tray and a sent Ask message, and Esc returns the focus", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await itemCard(s.page, "q1").waitFor();
  const aside = s.page.locator("#aside");
  await aside.locator('input[type="file"]').setInputFiles({ name: "shot.png", mimeType: "image/png", buffer: PNG });
  await aside.locator(".attach-thumb.is-ready").waitFor();
  // The tray can redraw a moment after an upload lands (the state it rides on arrives by event),
  // and a redraw after Esc would take the restored focus with the old button: let it go quiet first.
  await aside.evaluate(
    (n) =>
      new Promise((resolve) => {
        let timer;
        const done = () => {
          observer.disconnect();
          resolve();
        };
        const observer = new MutationObserver(() => {
          clearTimeout(timer);
          timer = setTimeout(done, 500);
        });
        observer.observe(n, { subtree: true, childList: true, attributes: true });
        timer = setTimeout(done, 500);
      })
  );

  await aside.locator(".attach-open").click();
  await s.page.locator("#picview[open]").waitFor();
  const shown = () =>
    s.page.evaluate(() => ({
      src: new URL(document.getElementById("picview-img").src).pathname,
      count: document.getElementById("picview-count").textContent,
    }));
  const first = await shown();
  assert.match(first.src, /^\/uploads\//, "the picview shows the upload, not the thumbnail's data: URL");
  assert.equal(first.count, "1 of 1");
  await s.page.keyboard.press("Escape");
  await s.page.waitForFunction(() => !document.getElementById("picview").open);
  await s.page.waitForFunction(() => document.activeElement && document.activeElement.classList.contains("attach-open"));

  const box = await openAsk(s);
  const comp = s.page.locator(".ask-composer");
  await comp.locator('input[type="file"]').setInputFiles({ name: "shot2.png", mimeType: "image/png", buffer: PNG });
  await comp.locator(".attach-thumb.is-ready").waitFor();
  await fillBox(box, "See the screenshot.");
  await s.page.locator(".ask-composer").getByRole("button", { name: "Send", exact: true }).click();
  const sent = s.page.locator(".ask-row.person .attach-thumb").last();
  await sent.waitFor();
  await sent.locator(".attach-open").click();
  await s.page.locator("#picview[open]").waitFor();
  assert.equal((await shown()).count, "1 of 1");
  await s.page.keyboard.press("Escape");
  await s.page.waitForFunction(() => !document.getElementById("picview").open);
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

// Ask for suggestions: the chip in the Notes on this panel.

const opt = (k, text) => ({ k, text, detail: `The ${text.toLowerCase()} option.` });

// The page's own staged answers, from the module app.js loaded.
const stagedOn = (s) =>
  s.page.evaluate(async () => {
    const { page } = await import("/state.js");
    return page.local.staged;
  });

// Opens a question from the sidebar and waits for its card.
async function goTo(s, id, title) {
  await s.page.locator("#sidebar").getByRole("button", { name: new RegExp(title) }).click();
  await itemCard(s.page, id).waitFor();
  await s.page.waitForFunction((want) => document.getElementById("aside").dataset.item === want, id);
}

const chipOf = (s) => s.page.locator("#aside").getByRole("button", { name: "Ask Plan2Code for suggestions on this question" });

// What a person sees break: the chip on a card where there is nothing to pick,
// on a settled record, or missing where they are unsure what to pick.
test("the Ask for suggestions chip shows on open choice, multi and confirm cards only", async (t) => {
  const s = await openSession(await suite.browser(), {
    t,
    workflow: "plan",
    payload: {
      items: [
        { id: "c1", kind: "choice", title: "Export format", body: "Which format?", options: [opt("A", "CSV"), opt("B", "JSON")] },
        { id: "m1", kind: "multi", title: "Columns", body: "Which?", options: [opt("1", "Date"), opt("2", "User")] },
        { id: "y1", kind: "confirm", title: "Keep going", body: "Carry on?" },
        { id: "t1", kind: "text", title: "What to call it", body: "A name.", required: false },
        { id: "d1", kind: "choice", title: "Old pick", body: "Which?", options: [opt("A", "CSV"), opt("B", "JSON")], status: "answered", answer: { k: "B" } },
      ],
      agent: { status: "waiting" },
    },
  });
  for (const [id, title, shown] of [["c1", "Export format", 1], ["m1", "Columns", 1], ["y1", "Keep going", 1], ["t1", "What to call it", 0], ["d1", "Old pick", 0]]) {
    await goTo(s, id, title);
    assert.equal(await chipOf(s).count(), shown, `chip on ${id}`);
    if (shown) assert.equal(await textOf(chipOf(s)), "Ask for suggestions");
  }
});

// What a person sees break: asking for suggestions sends or clears picks they
// staged, locks the card, or keeps the note they typed in the box.
test("Ask for suggestions sends one flagged note and leaves every staged pick staged", async (t) => {
  const s = await openSession(await suite.browser(), {
    t,
    workflow: "plan",
    payload: {
      items: [
        { id: "c1", kind: "choice", title: "Export format", body: "Which format?", options: [opt("A", "CSV"), opt("B", "JSON")] },
        { id: "c2", kind: "choice", title: "Where it goes", body: "Where?", options: [opt("A", "Email"), opt("B", "Slack")] },
      ],
      agent: { status: "waiting" },
    },
  });
  await goTo(s, "c2", "Where it goes");
  await itemCard(s.page, "c2").getByLabel("Slack").check();
  await goTo(s, "c1", "Export format");
  await itemCard(s.page, "c1").getByLabel("JSON").check();
  await s.page.waitForFunction(async () => {
    const { page } = await import("/state.js");
    return page.local.staged.c1 && page.local.staged.c2;
  });
  await fillBox(s.page.locator("#thread-c1"), "I lean B");
  await chipOf(s).click();

  const got = collect(s);
  assert.equal(got.actions.length, 1, `one action: ${JSON.stringify(got.actions)}`);
  const [action] = got.actions;
  assert.equal(action.i, "c1");
  assert.equal(action.type, "comment");
  assert.equal(action.suggest, true);
  assert.equal(action.text, "I lean B");
  assert.ok(got.reply.startsWith("Suggestions wanted on Export format: I lean B"), got.reply);

  await s.page.waitForFunction(() => document.getElementById("suggest-c1")?.disabled);
  const staged = await stagedOn(s);
  assert.equal(staged.c1 && staged.c1.k, "B", "the pick on this card is still staged");
  assert.equal(staged.c2 && staged.c2.k, "B", "the pick on the other card is still staged");
  const card = itemCard(s.page, "c1");
  assert.match(await textOf(card), /Ready to send/i);
  assert.equal(await card.getByLabel("CSV").isEnabled(), true, "the card is still a live form");
  assert.equal(await boxValue(s.page.locator("#thread-c1")), "");
  await goTo(s, "c2", "Where it goes");
  assert.match(await textOf(itemCard(s.page, "c2")), /Ready to send/i);
});

// What a person sees break: a request for suggestions that vanishes with no
// sign it went, or a chip that never comes back once the agent has answered.
test("a request for suggestions shows tagged and waiting, and the chip comes back once the agent replies", async (t) => {
  const s = await openSession(await suite.browser(), {
    t,
    workflow: "plan",
    payload: {
      items: [{ id: "c1", kind: "choice", title: "Export format", body: "Which format?", options: [opt("A", "CSV"), opt("B", "JSON")] }],
      agent: { status: "waiting" },
    },
  });
  await itemCard(s.page, "c1").waitFor();
  await chipOf(s).click();
  const got = collect(s);
  assert.ok(got.reply.startsWith("Suggestions wanted on Export format: (no note)"), got.reply);

  const mine = s.page.locator("#aside .msg.you.pending");
  await mine.locator(".suggest-tag", { hasText: "Asked for suggestions" }).waitFor();
  assert.match(await textOf(mine), /Sent, waiting for Plan2Code/i);
  await s.page.waitForFunction(() => document.getElementById("suggest-c1")?.disabled);

  s.post({ items: [{ id: "c1", thread: [{ who: "agent", text: "I would pick JSON: your scripts read it directly." }] }], agent: { status: "waiting" } });
  await s.page.locator("#aside .msg", { hasText: "I would pick JSON" }).waitFor();
  await s.page.waitForFunction(() => document.getElementById("suggest-c1") && !document.getElementById("suggest-c1").disabled);
  assert.equal(await s.page.locator("#aside .msg.you .suggest-tag").count(), 1, "the request keeps its tag once answered");
});

// What a person sees break: a pick on an option the agent took away still
// staged and sent, or the other picks on the card cleared with it.
test("a re-post that removes a staged multi option clears only that pick and says so", async (t) => {
  const s = await openSession(await suite.browser(), {
    t,
    workflow: "plan",
    payload: {
      items: [{ id: "m1", kind: "multi", title: "Columns", body: "Which?", options: [opt("1", "Date"), opt("2", "User"), opt("3", "Action")] }],
      agent: { status: "waiting" },
    },
  });
  const card = itemCard(s.page, "m1");
  await card.getByLabel("Date").check();
  await card.getByLabel("Action").check();
  await s.page.waitForFunction(async () => {
    const { page } = await import("/state.js");
    return (page.local.staged.m1?.ks || []).length === 2;
  });

  s.post({ items: [{ id: "m1", body: "Which, now that Action is gone?", options: [opt("1", "Date"), opt("2", "User")] }] });
  await s.page.locator("#banner", { hasText: "no longer matches the reworded question" }).waitFor();
  assert.match(await textOf(s.page.locator("#banner")), /A pick on Columns no longer matches/);
  assert.deepEqual((await stagedOn(s)).m1.ks, ["1"]);
  await itemCard(s.page, "m1").getByText("Which, now that Action is gone?").waitFor();
  assert.equal(await itemCard(s.page, "m1").getByLabel("Date").isChecked(), true);
  // A notice, not a fault: it clears by itself.
  await s.page.locator("#banner").waitFor({ state: "hidden", timeout: 20000 });
});

// What a person sees break: a chip that sends past the Implementation Loop,
// which answers for the agent while it drives.
test("the Ask for suggestions chip stays away while the loop drives, even on a card waiting for the person", async (t) => {
  const s = await openSession(await suite.browser(), {
    t,
    workflow: "implement",
    open: ["--loop"],
    env: { PLAN2CODE_IN_APP: "1" },
    payload: {
      items: [{ id: "c1", kind: "choice", title: "Export format", body: "Which format?", options: [opt("A", "CSV"), opt("B", "JSON")] }],
      agent: { status: "waiting" },
    },
  });
  await itemCard(s.page, "c1").getByLabel("JSON").waitFor();
  await s.page.locator("#thread-c1").waitFor();
  assert.equal(await chipOf(s).count(), 0, "no chip while the loop drives");
});
