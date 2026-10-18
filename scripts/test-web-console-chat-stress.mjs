// Web console tests, Quick questions: the stress run, frames, context and replies.
// Run with: node --test scripts/test-web-console-chat-stress.mjs
//
// Shared setup (a per-process console home, the CLI runner, fixtures) lives in
// web-console-test-helpers.mjs; see the comment at its top.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
// The page's pure answer-shaping logic. app.js itself cannot be imported here
// (it touches `document` at module scope and starts a session on import), which
// is exactly why this lives in its own file.
import { STALE_MS } from "../src/web-console/public/answers.js";
import {
  CHAT_LAST_WAIT_TEXT,
  CHAT_LIMIT_TEXT,
  CHAT_OFFLINE_TEXT,
  CHAT_WAITING_TEXT,
  CHAT_WORKING_TEXT,
  chatOffline,
  chatView,
  contextOptions,
  newestReplyId,
  nextAbout,
  sendState as chatSendState,
  shouldChime,
  unreadDot,
} from "../src/web-console/public/chat.js";
import { WEIGHTS } from "../src/web-console/public/meter.js";
import { readChat } from "../src/web-console/inbox.mjs";
import {
  ROOT,
  CONSOLE_CLI,
  ENV,
  cli,
  payload,
  openSession,
  chatFrame,
  ask,
  until,
  consoleDoc,
  consoleDocs,
} from "./web-console-test-helpers.mjs";

test("stress: 200 posts interleaved with 200 chat messages lose no message from the page frame", async () => {
  const s = openSession();
  const patchFile = payload("chat-stress.json", { agent: { status: "waiting", activity: "Thinking" } });
  const postAsync = () =>
    new Promise((resolve) => {
      const c = spawn(process.execPath, [CONSOLE_CLI, "post", "--session", s.sid, "--file", patchFile], {
        env: ENV,
        cwd: ROOT,
        stdio: "ignore",
      });
      c.on("exit", (code) => resolve(code));
    });
  try {
    for (let block = 0; block < 20; block++) {
      const conversation = block + 1;
      const texts = Array.from({ length: 10 }, (_, i) => `stress ${block * 10 + i}`);
      const results = await Promise.all([
        ...texts.map(() => postAsync()),
        ...texts.map((t) => ask(s, t, { conversation })),
      ]);
      assert.ok(results.slice(0, 10).every((code) => code === 0), `block ${block}: every post landed`);
      assert.ok(results.slice(10).every((r) => r.status === 200), `block ${block}: every message accepted`);
      const frame = await chatFrame(s);
      assert.deepEqual(
        frame.messages.map((m) => m.text).sort(),
        [...texts].sort(),
        `block ${block}: every message is in the frame`
      );
      if (block < 19) assert.equal((await s.send("/chat", { reset: true, conversation })).status, 200);
    }
    const all = readChat(s.session).filter((e) => e.kind === "message");
    assert.equal(all.length, 200);
    assert.equal(new Set(all.map((e) => e.seq)).size, 200, "no seq handed out twice");
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

/* ----------------------------------------- quick question: the page's rules */

const personMsg = (seq, text, extra = {}) => ({ from: "person", kind: "message", conversation: 1, seq, text, ...extra });
const agentReply = (id, re, extra = {}) => ({ from: "agent", id, re, conversation: 1, md: `Answer ${id}`, ...extra });
const decisionMsg = (seq, re, decision, text) => ({ from: "person", kind: "decision", conversation: 1, seq, re, decision, text });
const frameOf = (messages, extra = {}) => ({
  conversation: 1,
  messages,
  typed: messages.filter((m) => m.kind === "message").length,
  limit: 10,
  offline: false,
  ...extra,
});

test("chatView keeps the frame's order and marks each kind of row", () => {
  const frame = frameOf([
    personMsg(2, "Where is the config?", { about: { kind: "card", id: "q1", label: "Export format" } }),
    agentReply("r1", 2, { proposal: { summary: "Move it", files: ["a.md"] } }),
    decisionMsg(4, "r1", "decline", "Not now"),
    agentReply("r2", 4, { changed: [{ file: "a.md", added: 1, removed: 0 }] }),
    personMsg(5, "And the tests?"),
  ]);
  const v = chatView(frame, { agentActivity: "Task 3 of 9: the router" });
  assert.deepEqual(v.rows.map((r) => r.kind), ["person", "agent", "decision", "agent", "person"]);
  assert.equal(v.rows[0].about.label, "Export format");
  assert.equal(v.rows[0].waiting, undefined, "a reply after it answers it");
  assert.equal(v.rows[1].decided, "decline", "a decision naming the reply marks it decided");
  assert.equal(v.rows[3].decided, null);
  assert.deepEqual(v.rows[3].changed, [{ file: "a.md", added: 1, removed: 0 }]);
  assert.deepEqual(v.rows[2], { kind: "decision", decision: "decline", text: "Not now", re: "r1", done: true }, "a reply after the decision means it was acted on");
  assert.equal(v.rows[4].waiting, true);
  assert.equal(v.rows[4].waitingText, CHAT_WAITING_TEXT);
  assert.equal(v.rows[4].activity, "Task 3 of 9: the router");
  assert.equal(v.counterText, "2 of 10");
  assert.equal(chatView(frame, {}).rows[4].activity, undefined, "no activity, no line");
});

test("chatView: an unanswered question is waiting, then working once picked up, then answered", () => {
  const asked = [personMsg(2, "Where is the config?"), personMsg(3, "And the tests?")];
  const waiting = chatView(frameOf(asked)).rows;
  assert.deepEqual(waiting.map((r) => [r.waiting, r.working, r.waitingText]), [
    [true, false, CHAT_WAITING_TEXT],
    [true, false, CHAT_WAITING_TEXT],
  ]);
  const picked = chatView(frameOf(asked, { pickedUp: 2 })).rows;
  assert.deepEqual(picked.map((r) => [r.working, r.waitingText]), [
    [true, CHAT_WORKING_TEXT],
    [false, CHAT_WAITING_TEXT],
  ], "only what the agent collected is working");
  const answered = chatView(frameOf([...asked, agentReply("r3", 3)], { pickedUp: 3 })).rows;
  assert.equal(answered[0].waiting, undefined);
  assert.equal(answered[0].working, undefined, "a reply ends the spinner");
});

test("the frame reports how far the agent has picked up the chat", async () => {
  const s = openSession();
  try {
    const { body } = await ask(s, "What is the port?");
    assert.equal((await chatFrame(s)).pickedUp, 0, "nothing collected yet");
    assert.equal(cli(["chat", "--session", s.sid]).status, 0);
    assert.equal((await chatFrame(s)).pickedUp, body.seq);
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

test("chatView appends pending sends until the server echoes them, then drops them", () => {
  const frame = frameOf([personMsg(2, "First")]);
  const pending = [
    { tempId: "a", text: "First", seq: 2 },
    { tempId: "b", text: "Second" },
    { tempId: "c", text: "Third", failed: true },
  ];
  const rows = chatView(frame, { pendingSends: pending }).rows;
  assert.deepEqual(rows.map((r) => [r.kind, r.pending || false, r.tempId || r.seq]), [
    ["person", false, 2],
    ["person", true, "b"],
    ["person", true, "c"],
  ]);
  assert.equal(rows[2].failed, true);
  const echoed = frameOf([personMsg(2, "First"), personMsg(3, "Second")]);
  assert.deepEqual(chatView(echoed, { pendingSends: pending }).rows.filter((r) => r.pending).map((r) => r.tempId), ["c"]);
  // Two identical questions: one echo covers one pending send, not both.
  const twice = [{ tempId: "x", text: "Same" }, { tempId: "y", text: "Same" }];
  assert.equal(chatView(frameOf([personMsg(7, "Same")]), { pendingSends: twice }).rows.filter((r) => r.pending).length, 1);
  assert.deepEqual(chatView(null).rows, [], "no frame is an empty conversation");
});

test("chat sendState: offline wins over the limit, and the limit lands only once the 10th is answered", () => {
  const ten = Array.from({ length: 10 }, (_, i) => personMsg(i + 2, `Q${i}`));
  const tenAnswered = [...ten, agentReply("r", 11)];
  assert.deepEqual(chatSendState({ frameChat: frameOf([]), gone: false }), { state: "ok", text: "", canType: true });
  assert.deepEqual(chatSendState({ frameChat: frameOf(tenAnswered), gone: false }), {
    state: "limit",
    text: CHAT_LIMIT_TEXT,
    canType: false,
  });
  const waiting = chatSendState({ frameChat: frameOf(ten), gone: false });
  assert.equal(waiting.state, "ok", "the 10th still waiting is not the limit yet");
  assert.equal(waiting.canType, false);
  assert.equal(waiting.text, CHAT_LAST_WAIT_TEXT);
  const nine = frameOf(tenAnswered.slice(1));
  assert.equal(chatSendState({ frameChat: nine, gone: false, pendingSendCount: 1 }).canType, false, "a 10th on its way counts");
  assert.equal(chatSendState({ frameChat: nine, gone: false }).canType, true);
  assert.deepEqual(chatSendState({ frameChat: frameOf(tenAnswered, { offline: true }), gone: false }), {
    state: "offline",
    text: CHAT_OFFLINE_TEXT,
    canType: false,
  });
  assert.equal(chatSendState({ frameChat: frameOf([]), gone: true }).state, "offline");
  assert.notEqual(CHAT_LIMIT_TEXT, CHAT_OFFLINE_TEXT);
});

const CARD_Q1 = { kind: "card", id: "q1", label: "Export format" };
const SECTION_B2 = { kind: "section", id: "map#b2", label: "Where we're headed" };
const SPEC_LV = { kind: "spec", id: "specs/lunch-vote", label: "lunch-vote" };

test("nextAbout: visiting a card, section or spec records it in history and never sets about", () => {
  let st = nextAbout(null, { type: "card", id: "q1", label: "Export format" });
  assert.deepEqual(st, { history: [CARD_Q1], about: null });
  st = nextAbout(st, { type: "section", docId: "map", blockId: "b2", label: "Where we're headed" });
  st = nextAbout(st, { type: "spec", dir: "specs/lunch-vote", label: "lunch-vote" });
  assert.deepEqual(st.history, [SPEC_LV, SECTION_B2, CARD_Q1], "newest first");
  assert.equal(st.about, null);
  const picked = nextAbout(st, { type: "pick", about: SECTION_B2 });
  const moved = nextAbout(picked, { type: "card", id: "q9", label: "Later" });
  assert.deepEqual(moved.about, SECTION_B2, "a visit leaves a picked context alone");
});

test("nextAbout: a revisit moves to the front, and history holds 3 places", () => {
  let st = nextAbout(null, { type: "card", id: "q1", label: "Export format" });
  st = nextAbout(st, { type: "section", docId: "map", blockId: "b2", label: "Where we're headed" });
  st = nextAbout(st, { type: "card", id: "q1", label: "Export format" });
  assert.deepEqual(st.history, [CARD_Q1, SECTION_B2], "dedupe by kind and id");
  const sameIdOtherKind = nextAbout(st, { type: "spec", dir: "q1", label: "q1" });
  assert.equal(sameIdOtherKind.history.length, 3, "kind is part of the identity");
  st = nextAbout(st, { type: "spec", dir: "specs/lunch-vote", label: "lunch-vote" });
  st = nextAbout(st, { type: "card", id: "q2", label: "Who uses it" });
  assert.equal(st.history.length, 3);
  assert.deepEqual(
    st.history.map((h) => h.id),
    ["q2", "specs/lunch-vote", "q1"],
    "the oldest falls off"
  );
});

test("nextAbout: pick sets about, drop and sent clear it, the old Ask events do nothing", () => {
  const base = nextAbout(null, { type: "card", id: "q1", label: "Export format" });
  const picked = nextAbout(base, { type: "pick", about: CARD_Q1 });
  assert.deepEqual(picked, { history: [CARD_Q1], about: CARD_Q1 });
  assert.deepEqual(nextAbout(base, { type: "pick" }), base, "a pick with nothing picked changes nothing");
  assert.deepEqual(nextAbout(picked, { type: "drop" }), { history: [CARD_Q1], about: null });
  assert.deepEqual(nextAbout(picked, { type: "sent" }), { history: [CARD_Q1], about: null });
  for (const type of ["enter-ask", "leave-ask", "whatever"]) assert.deepEqual(nextAbout(picked, { type }), picked);
  assert.notEqual(nextAbout(picked, { type: "enter-ask" }), picked, "always a new object");
  const before = JSON.stringify(picked);
  nextAbout(picked, { type: "card", id: "q2", label: "Who uses it" });
  assert.equal(JSON.stringify(picked), before, "prev is never mutated");
});

test("nextAbout: an old { about, frozen, dropped } tracker normalises to the new shape", () => {
  const old = { about: CARD_Q1, frozen: true, dropped: false };
  assert.deepEqual(nextAbout(old, { type: "leave-ask" }), { history: [], about: CARD_Q1 });
  assert.deepEqual(nextAbout({ frozen: false, dropped: true }, {}), { history: [], about: null });
  assert.deepEqual(nextAbout(undefined, undefined), { history: [], about: null });
});

test("contextOptions: recent places, then This spec unless it is already there", () => {
  const st = { history: [CARD_Q1, SECTION_B2], about: null };
  assert.deepEqual(contextOptions(st, { dir: "specs/lunch-vote" }), [
    CARD_Q1,
    SECTION_B2,
    { kind: "spec", id: "specs/lunch-vote", label: "This spec" },
  ]);
  assert.deepEqual(contextOptions({ history: [SPEC_LV, CARD_Q1] }, { dir: "specs/lunch-vote" }), [SPEC_LV, CARD_Q1]);
  assert.deepEqual(contextOptions(st, null), [CARD_Q1, SECTION_B2]);
  assert.deepEqual(contextOptions(st, {}), [CARD_Q1, SECTION_B2]);
  const opts = contextOptions(st, null);
  opts.push("x");
  assert.equal(st.history.length, 2, "a copy, not the history itself");
});

test("unreadDot and shouldChime: one chime per new reply, never while on Ask, never for an empty conversation", () => {
  const one = frameOf([personMsg(2, "Q"), agentReply("r1", 2)]);
  const two = frameOf([personMsg(2, "Q"), agentReply("r1", 2), personMsg(4, "Q2"), agentReply("r2", 4)]);
  assert.equal(newestReplyId(two), "r2");
  assert.equal(unreadDot({ lastSeenReplyId: null, frameChat: frameOf([]), viewIsAsk: false }), false);
  assert.equal(unreadDot({ lastSeenReplyId: null, frameChat: one, viewIsAsk: true }), false);
  const d1 = unreadDot({ lastSeenReplyId: null, frameChat: one, viewIsAsk: false });
  assert.equal(d1, true);
  assert.equal(shouldChime(false, d1), true);
  const d1again = unreadDot({ lastSeenReplyId: null, frameChat: one, viewIsAsk: false });
  assert.equal(shouldChime(d1, d1again), false, "the same reply chimes once");
  assert.equal(unreadDot({ lastSeenReplyId: "r1", frameChat: one, viewIsAsk: false }), false, "seen");
  assert.equal(unreadDot({ lastSeenReplyId: "r1", frameChat: two, viewIsAsk: false }), true, "a newer one");
  assert.equal(shouldChime(true, false), false);
});

test("chatOffline: finished, paused, a stale working agent (with quietMinutes), an adrift waiting agent, a live one", () => {
  const now = 10 * 60 * 60 * 1000;
  const ago = (ms) => ({ agentLastSeenMs: now - ms, now });
  assert.equal(chatOffline({ finish: { headline: "Done" }, agent: { status: "waiting" }, ...ago(0) }), false, "a live agent through the finish wait is online");
  assert.equal(chatOffline({ finish: { headline: "Done" }, agent: { status: "waiting" }, ...ago(3 * 60 * 1000 + 1000) }), true, "offline once it goes quiet");
  assert.equal(chatOffline({ finish: { headline: "Paused — saved" }, agent: { status: "working" }, ...ago(STALE_MS + 1000) }), true);
  assert.equal(chatOffline({ agent: { status: "working" }, ...ago(STALE_MS + 1000) }), true);
  assert.equal(chatOffline({ agent: { status: "working" }, ...ago(STALE_MS - 1000) }), false);
  assert.equal(chatOffline({ agent: { status: "working", quietMinutes: 20 }, ...ago(15 * 60 * 1000) }), false, "a long task is not offline");
  assert.equal(chatOffline({ agent: { status: "working", quietMinutes: 20 }, ...ago(21 * 60 * 1000) }), true);
  assert.equal(chatOffline({ agent: { status: "waiting" }, ...ago(3 * 60 * 1000 + 1000) }), true, "adrift");
  assert.equal(chatOffline({ agent: { status: "waiting" }, ...ago(2 * 60 * 1000) }), false);
  assert.equal(chatOffline({ agent: { status: "waiting", quietMinutes: 30 }, ...ago(4 * 60 * 1000) }), true, "quietMinutes only counts while working");
});

// The agent learns the chat from the console's docs and the help text alone,
// so every name it has to type (the command, the reply field, the edit fields)
// and every refusal the routes can give must actually be written there.
test("the console docs, building.md and help teach the Quick question contract", () => {
  const dir = path.join(ROOT, "src", "web-console");
  const consoleMd = consoleDocs();
  for (const word of ["chat --session", "chat.replies", "proposal", "changed", "too-long", "limit", "offline", "stale"]) {
    assert.ok(consoleMd.includes(word), `the console docs must mention ${word}`);
  }
  assert.ok(fs.readFileSync(path.join(dir, "building.md"), "utf8").includes("chat --session"), "building.md must mention chat --session");
  const help = cli(["help"]).stdout;
  assert.match(help, /^\s+chat\s+--session <sid>/m, "help lists the chat command");
});

// The same for the workspace and the meter: every agent learns them from
// the console's docs, so the keys it posts and the events it reports must be
// written there, and the event list must be exactly meter.js's.
test("the console docs teach the workspace and session meter contract", () => {
  const consoleMd = consoleDocs();
  const buildingMd = consoleDoc("building.md") + consoleDoc("notes/implement.md");
  for (const word of ["workspace", "pendingWorkspace", "folderIssue", "run", "pathfinder-question", "pathfinder-research", "pathfinder-chart", "AGENTS.md", "/add-dir"]) {
    assert.ok(consoleMd.includes(word), `the console docs must mention ${word}`);
  }
  for (const word of ["implement-phase", "implement-review-phase"]) {
    assert.ok(buildingMd.includes(word), `the build docs must mention ${word}`);
  }
  const section = consoleDoc("console-meter.md").match(/### Session meter\n([\s\S]*?)\n---/);
  assert.ok(section, "console-meter.md has a Session meter section");
  const list = section[1].match(/`event` is one of ([\s\S]*?)An unknown event/);
  assert.ok(list, "the Session meter section lists the events");
  const listed = [...list[1].matchAll(/`([a-z-]+)`/g)].map((m) => m[1]);
  assert.equal(new Set(listed).size, listed.length, "no event is listed twice");
  assert.deepEqual([...listed].sort(), Object.keys(WEIGHTS).sort(), "console-meter.md lists exactly the WEIGHTS events");
});
