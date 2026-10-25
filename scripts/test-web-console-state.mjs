// Web console tests, the page's shared state: public/state.js holds what
// every screen reads (`page`) and the hooks a screen calls instead of the
// render loop and the draft's save. It only defines, so it imports here under
// plain Node, page or no page.
// Run with: node --test scripts/test-web-console-state.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { page, redraw, onRedraw, saveNow, onSave, fresh, freshChat, hooks, useHooks, stage, setDraft, bootData } from "../src/web-console/public/state.js";

test("state: page starts as app.js always started it", () => {
  assert.equal(page.S, null, "no server state before the first frame");
  assert.equal(page.selected, null, "no question picked");
  assert.equal(page.view, "questions", "the questions tab");
  assert.deepEqual(page.local, {
    staged: {},
    drafts: {},
    images: {},
    sent: {},
    stopping: null,
    afterBuild: null,
    homeward: null,
    launching: null,
    deleting: null,
    retract: {},
    chat: { draft: "", history: [], about: null, pending: [], lastSeenReplyId: null, images: [], conversation: null },
  });
});

test("state: the rest of the shared state starts as app.js always started it", () => {
  const { S, local, selected, view, ...rest } = page;
  assert.deepEqual(rest, {
    agentLastSeen: null,
    pendingResult: false,
    pendingStop: false,
    pendingBannerUp: false,
    gone: false,
    chatFrame: null,
    chatDot: false,
    chatError: "",
    askRowCount: 0,
    docInView: null,
    wsFrame: null,
    meterFrame: null,
    updateFrame: null,
    inApp: false,
    subagentsFrame: null,
    overview: { key: null, text: null },
    wake: null,
    dashPick: null,
    mentionPop: null,
    heldPose: null,
    scopeMine: null,
    launchScoping: false,
  });
});

test("state: fresh() and freshChat() hand out a new empty draft each time", () => {
  assert.deepEqual(fresh(), page.local);
  assert.notEqual(fresh(), fresh(), "two calls share one object");
  assert.notEqual(fresh().chat, fresh().chat, "two drafts share one chat");
  assert.deepEqual(freshChat(), page.local.chat);
});

for (const [name, call, on] of [
  ["redraw", redraw, onRedraw],
  ["saveNow", saveNow, onSave],
]) {
  test(`state: ${name}() does nothing until a hook is set, then calls the latest one once per call`, () => {
    assert.doesNotThrow(() => call(), `${name}() throws with no hook`);
    let first = 0;
    let second = 0;
    on(() => first++);
    call();
    call();
    assert.equal(first, 2, "each call runs the hook once");
    on(() => second++);
    call();
    assert.deepEqual([first, second], [2, 1], "a second hook replaces the first");
  });
}

test("state: a hook a screen calls throws by name until start-up sets it, then runs the one set", () => {
  assert.throws(() => hooks.banner("x"), /hooks\.banner was called before start-up set it/);
  const seen = [];
  useHooks({ banner: (text) => seen.push(text) });
  hooks.banner("hello");
  assert.deepEqual(seen, ["hello"]);
  useHooks({ banner: (text) => seen.push(text + "!") });
  hooks.banner("again");
  assert.deepEqual(seen, ["hello", "again!"], "a second set replaces the first");
  assert.throws(() => hooks.unknown(), /hooks\.unknown was called/);
});

test("state: stage() stages or takes back an answer, then saves and redraws; setDraft() only saves", () => {
  let saved = 0;
  let drawn = 0;
  onSave(() => saved++);
  onRedraw(() => drawn++);
  stage("q1", { k: "A" });
  assert.deepEqual(page.local.staged, { q1: { k: "A" } });
  assert.deepEqual([saved, drawn], [1, 1]);
  stage("q1", null);
  assert.deepEqual(page.local.staged, {}, "null takes the answer back");
  assert.deepEqual([saved, drawn], [2, 2]);
  setDraft("note-q1", "typed");
  assert.equal(page.local.drafts["note-q1"], "typed");
  assert.deepEqual([saved, drawn], [3, 2], "a draft is kept without a redraw");
  delete page.local.drafts["note-q1"];
});

test("state: bootData() is null without a page, and asked again it says the same", () => {
  assert.equal(bootData(), null);
  assert.equal(bootData(), null);
});
