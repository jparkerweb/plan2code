// Web console tests, the Send button: public/send-state.js decides whether
// Send is available and what its button says, from the shared page state. It
// only defines, so it imports here under plain Node and each case sets `page`
// directly.
// Run with: node --test scripts/test-web-console-send-state.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { page, fresh } from "../src/web-console/public/state.js";
import { WORKING_GRACE_MS } from "../src/web-console/public/selectors.js";
import { sendState } from "../src/web-console/public/send-state.js";

const MIN = 60 * 1000;
const ago = (ms) => new Date(Date.now() - ms).toISOString();
const question = (id = "q1", extra = {}) => ({ id, kind: "choice", title: "Export format", status: "open", required: true, ...extra });

// A waiting agent seen just now, one open question, nothing staged.
function setup({ agent = { status: "waiting" }, items = [question()], ...S } = {}) {
  page.S = { workflow: "test", agent, items, ...S };
  page.local = fresh();
  page.gone = false;
  page.pendingResult = false;
  page.agentLastSeen = ago(0);
  page.chatFrame = null;
}

const working = (sinceMs, extra = {}) => ({ status: "working", since: ago(sinceMs), ...extra });

test("send state: a finished session is closed, and says paused when its headline does", () => {
  setup({ finish: { headline: "Phase 3 is done" } });
  page.local.staged.q1 = { k: "A" };
  assert.deepEqual(sendState(), { disabled: true, why: "This session is finished.", short: "Session finished" });
  setup({ finish: { headline: "Paused at Step 2" } });
  assert.deepEqual(sendState(), { disabled: true, why: "This session is paused.", short: "Session paused" });
});

test("send state: a finish wins over a dropped connection", () => {
  setup({ finish: { headline: "Done" } });
  page.gone = true;
  assert.equal(sendState().short, "Session finished");
});

test("send state: offline reads Not connected, whatever is staged", () => {
  setup();
  page.local.staged.q1 = { k: "A" };
  page.gone = true;
  assert.deepEqual(sendState(), { disabled: true, why: "Not connected right now.", short: "Not connected" });
});

test("send state: the loop driving locks Send until a question it does not handle waits", () => {
  setup({ loop: { driving: true }, items: [question("q1", { handledBy: "loop" })] });
  page.local.staged.q1 = { k: "A" };
  assert.deepEqual(sendState(), { disabled: true, why: "The loop is building. Cards unlock when it needs you.", short: "The loop is building" });

  setup({ loop: { driving: true }, items: [question("q2")] });
  page.local.staged.q2 = { k: "A" };
  assert.deepEqual(sendState(), { disabled: false, why: "" }, "a question for the person unlocks it");

  setup({ loop: { driving: true }, loopEnd: { at: ago(0) }, items: [question("q1", { handledBy: "loop" })] });
  page.local.staged.q1 = { k: "A" };
  assert.deepEqual(sendState(), { disabled: false, why: "" }, "a posted loopEnd lets go of the page");
});

test("send state: a send still being collected stays disabled, and says so once nobody comes for it", () => {
  setup();
  page.local.staged.q1 = { k: "A" };
  page.pendingResult = true;
  assert.deepEqual(sendState(), { disabled: true, why: "Your last answers are on their way. One moment.", short: "" });

  page.agentLastSeen = ago(2 * MIN);
  assert.deepEqual(sendState(), {
    disabled: true,
    why: "Saved, and waiting for Plan2Code to come back for them.",
    short: "Saved, not picked up",
  });
});

test("send state: while the agent works, an answer or a note to an open question can still go", () => {
  setup({ agent: working(MIN) });
  page.local.staged.q1 = { k: "A" };
  const open = { disabled: false, why: "Plan2Code is still working. Your answers wait for it to look.", short: "Still working · it reads this next" };
  assert.deepEqual(sendState(), open);

  setup({ agent: working(MIN) });
  page.local.drafts["thread-q1"] = "Prefer CSV for Excel.";
  assert.deepEqual(sendState(), open, "a typed note counts as much as a staged answer");
});

test("send state: a question already sent is not the person's turn while the agent works", () => {
  setup({ agent: working(MIN) });
  page.local.staged.q1 = { k: "A" };
  page.local.sent.q1 = true;
  assert.deepEqual(sendState(), { disabled: true, why: "Wait for Plan2Code to finish.", short: "" });
});

test("send state: past the working grace, something staged can be pushed through", () => {
  setup({ agent: working(WORKING_GRACE_MS + MIN), items: [] });
  page.local.staged.q1 = { k: "A" };
  assert.deepEqual(sendState(), { disabled: false, why: "Plan2Code has been busy a while. You can send anyway.", short: "Busy · send anyway" });
});

test("send state: past the working grace with nothing staged, open questions say a note unlocks Send", () => {
  setup({ agent: working(WORKING_GRACE_MS + MIN), items: [question("q1", { submitted: { at: ago(MIN) } })] });
  assert.deepEqual(sendState(), {
    disabled: true,
    why: "Plan2Code has been busy a while. Answer something or add a note, and you can send anyway.",
    short: "Busy · a note unlocks Send",
  });

  setup({ agent: working(WORKING_GRACE_MS + MIN), items: [] });
  assert.deepEqual(sendState(), { disabled: true, why: "Plan2Code has been busy a while.", short: "Busy a while" });
});

test("send state: quietMinutes stretches the working grace", () => {
  setup({ agent: working(10 * MIN, { quietMinutes: 30 }), items: [] });
  page.local.staged.q1 = { k: "A" };
  assert.deepEqual(sendState(), { disabled: true, why: "Wait for Plan2Code to finish.", short: "" });

  setup({ agent: working(31 * MIN, { quietMinutes: 30 }), items: [] });
  page.local.staged.q1 = { k: "A" };
  assert.equal(sendState().short, "Busy · send anyway", "past the stretched grace the hatch opens");
});

test("send state: inside the working grace Send waits, and reads Gone quiet once the agent is adrift", () => {
  setup({ agent: working(MIN), items: [] });
  assert.deepEqual(sendState(), { disabled: true, why: "Wait for Plan2Code to finish.", short: "" });

  setup({ agent: working(4 * MIN), items: [] });
  page.agentLastSeen = ago(4 * MIN);
  assert.deepEqual(sendState(), { disabled: true, why: "Wait for Plan2Code to finish.", short: "Gone quiet" });
});

test("send state: an idle page enables Send only once something is staged or typed", () => {
  setup();
  assert.deepEqual(sendState(), { disabled: true, why: "" });

  page.local.staged.q1 = { k: "A" };
  assert.deepEqual(sendState(), { disabled: false, why: "" });

  setup();
  page.local.drafts["thread-q1"] = "   ";
  assert.deepEqual(sendState(), { disabled: true, why: "" }, "a blank note is nothing to send");
});

test("send state: a note waits while its picture uploads, and goes once it is ready", () => {
  setup();
  page.local.drafts["thread-q1"] = "See the screenshot.";
  page.local.images.q1 = [{ key: "a", status: "uploading" }];
  assert.deepEqual(sendState(), { disabled: true, why: "" }, "a held note is not sent");

  page.local.images.q1 = [{ key: "a", status: "ready", url: "/uploads/a.jpg" }];
  assert.deepEqual(sendState(), { disabled: false, why: "" });
});
