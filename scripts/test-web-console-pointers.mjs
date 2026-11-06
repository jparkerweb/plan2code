// Web console tests, the pointers: which topic file the console names, and when.
// Run with: node --test scripts/test-web-console-pointers.mjs
//
// The card leaves a topic out and the console's own output names its file at
// the moment it is due (`read`), once per session per topic and again after a
// resume. Shared setup lives in web-console-test-helpers.mjs.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { POINTER_FILES, duePointers, pointersForSend, rememberPointers, resetPointers } from "../src/web-console/pointers.mjs";
import {
  HOME,
  ROOT,
  cli,
  openSession,
  postPatch,
  readState,
  tempFolder,
  waitOnce,
  addFolder,
  ask,
} from "./web-console-test-helpers.mjs";

const WEB = path.join(ROOT, "src", "web-console");
const file = (name) => path.join(WEB, name);
const SUBAGENTS_STORE = path.join(HOME, "subagents.json");

// A fresh session, a send made as the page makes it, and the one `wait` that
// collects it: the `read` that wait printed.
const fresh = (extra = {}) => openSession(extra);
async function send(s, actions) {
  const res = await s.send("/submit", { actions, reply: "sent from the page" });
  assert.equal(res.status, 200, `the page's send was accepted: ${res.status}`);
  return waitOnce(s.sid, 10);
}
const finishUp = (s) => postPatch(s, { finish: { headline: "Done", command: "/plan2code" } });
const done = (s) => cli(["stop", "--session", s.sid, "--force"]);

/* ------------------------------------------- every moment names its file */

test("pointer: __commit names console-finish.md", async () => {
  const s = fresh();
  try {
    const { code, out } = await send(s, [{ i: "__commit", type: "commit" }]);
    assert.equal(code, 0);
    assert.deepEqual(out.read, [file("console-finish.md")]);
  } finally {
    done(s);
  }
});

test("pointer: __dashboard with a finish up names console-finish.md", async () => {
  const s = fresh();
  try {
    finishUp(s);
    const { out } = await send(s, [{ i: "__dashboard", type: "dashboard" }]);
    assert.deepEqual(out.read, [file("console-finish.md")]);
  } finally {
    done(s);
  }
});

test("pointer: __stop names console-stop.md", async () => {
  const s = fresh();
  try {
    const { out } = await send(s, [{ i: "__stop", type: "stop" }]);
    assert.deepEqual(out.read, [file("console-stop.md")]);
  } finally {
    done(s);
  }
});

test("pointer: __stop with a handoff names console-stop.md", async () => {
  const s = fresh();
  try {
    const { out } = await send(s, [{ i: "__stop", type: "stop", handoff: true }]);
    assert.deepEqual(out.read, [file("console-stop.md")]);
  } finally {
    done(s);
  }
});

test("pointer: __dashboard with no finish up names console-stop.md", async () => {
  const s = fresh();
  try {
    const { out } = await send(s, [{ i: "__dashboard", type: "dashboard" }]);
    assert.deepEqual(out.read, [file("console-stop.md")]);
  } finally {
    done(s);
  }
});

test("pointer: the first post carrying docs names console-docs.md on post's own line", () => {
  const s = fresh();
  try {
    const first = postPatch(s, { docs: [{ id: "map", title: "Map", blocks: [{ id: "b1", state: "settled", md: "## One" }] }] });
    assert.deepEqual(first.json.read, [file("console-docs.md")]);
    assert.equal(first.json.ok, true);
    const plain = postPatch(s, { agent: { status: "working" } });
    assert.equal(plain.json.read, undefined, "a post with no docs names nothing");
  } finally {
    done(s);
  }
});

test("pointer: the first Quick question names console-chat.md", async () => {
  const s = fresh();
  try {
    assert.equal((await ask(s, "What does this do?")).status, 200);
    const { code, out } = waitOnce(s.sid, 10);
    assert.equal(code, 0);
    assert.deepEqual(out.read, [file("console-chat.md")]);
  } finally {
    done(s);
  }
});

test("pointer: a Workspace change names console-workspace.md", async () => {
  const s = fresh();
  const extra = tempFolder();
  try {
    assert.equal((await addFolder(s, { path: extra })).status, 200);
    const { out } = await send(s, [{ i: "q1", type: "answer", kind: "choice", k: "A" }]);
    assert.match(out.reply, /Workspace:/);
    assert.ok(out.read.includes(file("console-workspace.md")));
  } finally {
    done(s);
    fs.rmSync(extra, { recursive: true, force: true });
  }
});

test("pointer: a Subagents change names console-subagents.md", async () => {
  fs.rmSync(SUBAGENTS_STORE, { force: true });
  const s = fresh({ workflow: "implement" });
  try {
    const set = await s.send("/subagents", { on: false, instruction: null, max: 3 });
    assert.equal(set.status, 200);
    const { out } = await send(s, [{ i: "q1", type: "answer", kind: "choice", k: "A" }]);
    assert.match(out.reply, /Subagents: off/);
    assert.ok(out.read.includes(file("console-subagents.md")));
  } finally {
    done(s);
  }
});

test("pointer: __review names building-review.md", async () => {
  const s = fresh();
  try {
    const { out } = await send(s, [{ i: "__review", type: "review" }]);
    assert.deepEqual(out.read, [file("building-review.md")]);
  } finally {
    done(s);
  }
});

test("pointer: a review card answered with a verdict names building-review.md", async () => {
  const s = fresh({ workflow: "implement" });
  try {
    postPatch(s, {
      docs: [{ id: "report", title: "Report", blocks: [{ id: "b1", state: "settled", md: "## Report" }] }],
      items: [
        {
          id: "signoff",
          kind: "review",
          title: "Approve this phase",
          doc: "report",
          verdicts: [
            { id: "review", label: "Review the code first" },
            { id: "approve", label: "Approve" },
          ],
        },
      ],
    });
    const { out } = await send(s, [{ i: "signoff", type: "answer", kind: "review", verdict: "review" }]);
    assert.deepEqual(out.read, [file("building-review.md")]);
  } finally {
    done(s);
  }
});

/* ------------------------------------------- the memory rules */

test("pointer memory: the same moment a second time prints no read", async () => {
  const s = fresh();
  try {
    const first = await send(s, [{ i: "__stop", type: "stop" }]);
    assert.deepEqual(first.out.read, [file("console-stop.md")]);
    // The page is back on the person's turn after the agent posts again.
    postPatch(s, { items: [{ id: "q2", kind: "text", title: "Anything else", body: "Say it." }] });
    const second = await send(s, [{ i: "__stop", type: "stop" }]);
    assert.equal(second.out.read, undefined, "console-stop.md was named once already");
  } finally {
    done(s);
  }
});

test("pointer memory: it lives in pointers.json in the session folder, never in state.json", async () => {
  const s = fresh();
  try {
    await send(s, [{ i: "__stop", type: "stop" }]);
    const saved = JSON.parse(fs.readFileSync(path.join(s.session, "pointers.json"), "utf8"));
    assert.deepEqual(saved.printed, ["stop"]);
    assert.ok(!JSON.stringify(readState(s.session)).includes("pointers"), "state.json has no pointer key");
    const frame = await (await fetch(`${s.base}/state`, { headers: { cookie: s.cookie, connection: "close" } })).text();
    assert.ok(!frame.includes("pointers"), "the page's frame never carries pointers");
  } finally {
    done(s);
  }
});

test("pointer memory: open --resume starts the reading over", async () => {
  const s = fresh();
  try {
    assert.deepEqual((await send(s, [{ i: "__stop", type: "stop" }])).out.read, [file("console-stop.md")]);
    const back = cli(["open", "--resume", s.sid, "--workflow", "pathfinder", "--no-open"]);
    assert.equal(back.json.sid, s.sid);
    assert.equal(fs.existsSync(path.join(s.session, "pointers.json")), false, "a resume forgets what was printed");
    postPatch(s, { items: [{ id: "q3", kind: "text", title: "Once more", body: "Say it." }] });
    const again = await send(s, [{ i: "__stop", type: "stop" }]);
    assert.deepEqual(again.out.read, [file("console-stop.md")]);
  } finally {
    done(s);
  }
});

test("pointer memory: two moments due at once print both, each once", async () => {
  const s = fresh();
  try {
    const { out } = await send(s, [
      { i: "__review", type: "review" },
      { i: "__stop", type: "stop" },
    ]);
    assert.deepEqual(out.read, [file("building-review.md"), file("console-stop.md")]);
  } finally {
    done(s);
  }
});

/* ------------------------------------------- the pure part, with no server */

const noFlags = { workspaceChanged: false, subagentsChanged: false };

test("pointersForSend: the whole table", () => {
  const withFinish = { finish: { headline: "Done" }, items: [] };
  const empty = { items: [] };
  const act = (...as) => ({ actions: as });
  assert.deepEqual(pointersForSend(act({ i: "__commit" }), empty, noFlags), ["finish"]);
  assert.deepEqual(pointersForSend(act({ i: "__dashboard" }), withFinish, noFlags), ["finish"]);
  assert.deepEqual(pointersForSend(act({ i: "__dashboard" }), empty, noFlags), ["stop"]);
  assert.deepEqual(pointersForSend(act({ i: "__stop" }), empty, noFlags), ["stop"]);
  assert.deepEqual(pointersForSend(act({ i: "__stop", handoff: true }), empty, noFlags), ["stop"]);
  assert.deepEqual(pointersForSend(act({ i: "__review" }), empty, noFlags), ["review"]);
  const reviewCard = { items: [{ id: "signoff", kind: "review" }] };
  assert.deepEqual(pointersForSend(act({ i: "signoff", type: "answer", verdict: "review" }), reviewCard, noFlags), ["review"]);
  assert.deepEqual(pointersForSend(act({ i: "signoff", type: "answer", answer: { verdict: "approve" } }), reviewCard, noFlags), ["review"]);
  assert.deepEqual(pointersForSend(act({ i: "signoff", type: "answer" }), reviewCard, noFlags), [], "a review card with no verdict names nothing");
  assert.deepEqual(pointersForSend(act({ i: "q1", type: "answer", verdict: "x" }), { items: [{ id: "q1", kind: "choice" }] }, noFlags), []);
  assert.deepEqual(pointersForSend({}, empty, noFlags, [{ kind: "message", seq: 1 }]), ["chat"]);
  assert.deepEqual(pointersForSend({}, empty, noFlags, [{ kind: "decision", seq: 1 }]), [], "only a typed message names the chat file");
  assert.deepEqual(pointersForSend({}, empty, { workspaceChanged: true, subagentsChanged: true }), ["workspace", "subagents"]);
  assert.deepEqual(pointersForSend(act({ i: "__stop" }, { i: "__stop" }), empty, noFlags), ["stop"], "a topic appears once");
  assert.deepEqual(pointersForSend(null, null, null), []);
});

test("duePointers, rememberPointers and resetPointers keep one memory per session folder", () => {
  const dir = fs.mkdtempSync(path.join(HOME, "pointers-"));
  try {
    assert.deepEqual(duePointers(dir, ["stop", "chat"]), [file("console-stop.md"), file("console-chat.md")]);
    rememberPointers(dir, ["stop", "not-a-topic"]);
    assert.deepEqual(duePointers(dir, ["stop", "chat"]), [file("console-chat.md")], "printed topics drop out");
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, "pointers.json"), "utf8")).printed, ["stop"], "an unknown topic is never recorded");
    fs.writeFileSync(path.join(dir, "pointers.json"), "{ not json");
    assert.deepEqual(duePointers(dir, ["stop"]), [file("console-stop.md")], "an unreadable memory reads as nothing printed");
    rememberPointers(dir, ["chat"]);
    resetPointers(dir);
    assert.deepEqual(duePointers(dir, ["stop", "chat"]), [file("console-stop.md"), file("console-chat.md")]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("every pointer file exists beside the console", () => {
  for (const name of Object.values(POINTER_FILES)) assert.ok(fs.existsSync(file(name)), `${name} exists`);
});
