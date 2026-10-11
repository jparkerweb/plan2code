// Web console tests, the second shared session: results, resume, stop, and posts to a stopped session.
// Run with: node --test scripts/test-web-console-lifecycle.mjs
//
// Shared setup (a per-process console home, the CLI runner, fixtures) lives in
// web-console-test-helpers.mjs; see the comment at its top.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
// The page's pure answer-shaping logic. app.js itself cannot be imported here
// (it touches `document` at module scope and starts a session on import), which
// is exactly why this lives in its own file.
import {
  answerLines,
  briefPhrase,
  choiceAnswer,
  recordedAnswer,
  sentAnswer,
  submittedAwaiting,
  noteAwaiting,
  suggestionFrom,
} from "../src/web-console/public/answers.js";
import {
  HOME,
  MODELS_DIR,
  cookieFor,
  cli,
  payload,
  BASE,
  backdate,
  readState,
  clientFor,
} from "./web-console-test-helpers.mjs";

let sid;
let session;
let baseUrl;
let token;
const { post, raw } = clientFor(() => ({ baseUrl, token }));

// The tests below once ran on test-web-console-session.mjs's session, after
// its tests had answered q1. Open this file's own session in that state.
test.before(() => {
  const res = cli(["open", "--file", payload("p1.json", BASE), "--no-open", "--title", "Test session"]);
  sid = res.json.sid;
  session = res.json.session;
  const m = res.json.url.match(/^(http:\/\/127\.0\.0\.1:\d+)\/s\/([^/]+)\//);
  baseUrl = m[1];
  token = m[2];
  cli(["post", "--session", sid, "--file", payload("q1-answered.json", { items: [{ id: "q1", status: "answered" }] })]);
});

/* ------------------------------------------- result handoff (regressions) */

test("a second submit is refused while the first is uncollected", async () => {
  // Two tabs, or one impatient second press. Overwriting here silently
  // destroyed whatever was in the first batch, including an approval verdict.
  const first = await post("/submit", {
    actions: [{ i: "q1", type: "answer", kind: "choice", k: "A" }],
    reply: "Export format: a",
  });
  assert.equal(first.status, 200);

  const second = await post("/submit", {
    actions: [{ i: "q1", type: "answer", kind: "text", text: "second" }],
    reply: "Export format: second",
  });
  assert.equal(second.status, 409, "the server must refuse, not overwrite");

  const got = cli(["wait", "--session", sid, "--seconds", "10"]);
  assert.equal(got.status, 0);
  assert.equal(got.json.reply, "Export format: a", "the FIRST batch must survive");
});

test("the page is told a send is still uncollected", async () => {
  await post("/submit", { actions: [{ i: "q1", type: "answer", kind: "text", text: "x" }], reply: "r" });
  const res = await fetch(baseUrl + "/state", { headers: { cookie: cookieFor(baseUrl, token) } });
  const body = await res.json();
  assert.equal(body.pendingResult, true, "the client needs this to disable Send");

  // The opening frame of the stream has to say so too. A reconnecting tab that
  // learns it from /state but not from /events briefly believes its last
  // answers have been dealt with, and unlocks the question it just sent.
  const first = await firstStateEvent();
  assert.equal(first.pendingResult, true, "the first SSE frame must carry it as well");

  cli(["wait", "--session", sid, "--seconds", "10"]);
});

// Read the stream up to its first `state` frame, then hang up.
function firstStateEvent() {
  const port = Number(new URL(baseUrl).port);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: "/events",
        method: "GET",
        headers: { cookie: cookieFor(baseUrl, token) },
      },
      (res) => {
        let buf = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          buf += chunk;
          const m = buf.match(/event: state\ndata: (.+)\n/);
          if (!m) return;
          req.destroy();
          try {
            resolve(JSON.parse(m[1]));
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on("error", (err) => {
      if (err.code !== "ECONNRESET") reject(err);
    });
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error("no state frame within 5s"));
    });
    req.end();
  });
}

test("open --resume never discards an uncollected result", async () => {
  // The documented crash-recovery path: the agent dies, the person presses
  // Send anyway, a fresh session resumes. Deleting here destroyed their work.
  await post("/submit", {
    actions: [{ i: "q1", type: "answer", kind: "text", text: "TWENTY MINUTES OF WORK" }],
    reply: "Export format: TWENTY MINUTES OF WORK",
  });
  const reopened = cli(["open", "--resume", sid, "--no-open"]);
  assert.equal(reopened.json.ok, true);
  assert.equal(reopened.json.pendingResult, true, "open must report the waiting result");

  const got = cli(["wait", "--session", sid, "--seconds", "10"]);
  assert.equal(got.status, 0);
  assert.equal(got.json.reply, "Export format: TWENTY MINUTES OF WORK");
});

test("open clears a result that was already collected", () => {
  const before = cli(["open", "--resume", sid, "--no-open"]);
  assert.equal(before.json.pendingResult, false);
  const res = cli(["wait", "--session", sid, "--seconds", "3"]);
  assert.equal(res.status, 10, "a consumed result must not be handed over again");
});

// A paused finish is a bookmark: `open --resume` picks the session up, so the
// bookmark comes down with it -- left in place, the page says PAUSED over
// every question the resumed session asks. So do the questions left open at
// the pause: whatever the new session still needs it asks again, and kept
// leftovers sit beside the new asks as duplicates nobody owns. A real ending
// survives untouched, so re-sharing a finished session's link still shows
// its card.
test("open --resume takes a pause down, and only a pause", () => {
  const stateFile = path.join(session, "state.json");
  const readState = () => JSON.parse(fs.readFileSync(stateFile, "utf8"));

  cli(["post", "--session", sid, "--file", payload("fin-pause.json", {
    topics: [{ id: "t-stale", title: "Stale section" }],
    items: [{ id: "q-stale", topic: "t-stale", kind: "text", title: "Left mid-way", body: "Still open at the pause." }],
    finish: { headline: "Paused — your answers so far are saved", command: "/plan2code-1-plan" },
  })]);
  assert.ok(readState().finish, "the pause was posted");
  cli(["open", "--resume", sid, "--no-open"]);
  const resumed = readState();
  assert.equal(resumed.finish, undefined, "resuming clears a paused finish");
  assert.equal(resumed.items.some((i) => i.id === "q-stale"), false, "questions left open at the pause come down with it");
  assert.equal(resumed.topics.some((t) => t.id === "t-stale"), false, "and the section only they lived under");
  assert.equal(resumed.items.find((i) => i.id === "q1").status, "answered", "settled items are the record and stay");

  cli(["post", "--session", sid, "--file", payload("fin-done.json", {
    finish: { headline: "The map is written", command: "/plan2code-2-document" },
  })]);
  cli(["open", "--resume", sid, "--no-open"]);
  assert.equal(readState().finish.headline, "The map is written", "resuming keeps a real ending");

  // Leave the session the way later tests expect to find it.
  cli(["post", "--session", sid, "--file", payload("fin-clear.json", { finish: null })]);
});

// The dashboard hands its live session to the skill it launched: one
// `open --resume` turns the page (workflow, title, spec) while reusing the
// server. If the flags did not apply on resume, the launched skill would
// either strand the page or have to make a second call to turn it.
test("open --resume restates workflow, title and spec on the live session", () => {
  const stateFile = path.join(session, "state.json");
  const snapshot = fs.readFileSync(stateFile, "utf8");
  const before = JSON.parse(snapshot);
  assert.equal(before.workflow, "pathfinder");

  const res = cli(["open", "--resume", sid, "--no-open", "--workflow", "implement", "--title", "Lunch vote: Phase 2", "--spec", "specs/lunch-vote"]);
  assert.equal(res.json.ok, true);
  assert.equal(res.json.sid, sid);
  assert.equal(res.json.reused, true, "the live server must be reused, not replaced");

  const state = JSON.parse(fs.readFileSync(path.join(session, "state.json"), "utf8"));
  assert.equal(state.workflow, "implement");
  assert.equal(state.title, "Lunch vote: Phase 2");
  assert.equal(state.specDir, "specs/lunch-vote");

  // And flags left off a later resume leave the fields alone.
  cli(["open", "--resume", sid, "--no-open"]);
  const still = JSON.parse(fs.readFileSync(path.join(session, "state.json"), "utf8"));
  assert.equal(still.workflow, "implement", "no --workflow means keep the one the launch set");

  // Put it back for the tests that follow: the switch blanked the session.
  fs.writeFileSync(stateFile, snapshot);
});

// Plan -> Back to the dashboard -> Document used to show Plan's questions,
// sections and doc tabs under Document's name: the resume only renamed the
// workflow. A switch through the dashboard is a fresh start, so it is blank.
test("open --resume through the dashboard starts the next skill on a clean page", () => {
  const stateFile = path.join(session, "state.json");
  const readState = () => JSON.parse(fs.readFileSync(stateFile, "utf8"));
  const draftFile = path.join(session, "draft.json");
  const snapshot = fs.readFileSync(stateFile, "utf8");

  cli(["post", "--session", sid, "--file", payload("wf-plan.json", {
    workflow: "plan",
    title: "Planny mood board",
    specDir: "specs/mood-board",
    headline: { stage: "Planning", cleared: 21, total: 21, note: "Writing the plan" },
    topics: [{ id: "t-plan", title: "The drawings" }],
    items: [{ id: "q-plan", topic: "t-plan", kind: "text", title: "Write the plan", body: "Ready?" }],
    docs: [{ id: "techspec", title: "Technical spec", blocks: [{ id: "b", state: "settled", md: "# Spec" }] }],
    menu: { note: "stale" },
    stopWarning: "",
    finish: { headline: "The plan is written", dashboard: true },
  })]);
  fs.writeFileSync(draftFile, JSON.stringify({ staged: { "q-plan": { text: "yes" } } }));
  const before = readState();

  cli(["open", "--resume", sid, "--no-open", "--workflow", "dashboard"]);
  const dash = readState();
  assert.equal(dash.workflow, "dashboard");
  assert.equal(dash.sid, before.sid, "the session itself carries across");
  assert.equal(dash.created, before.created);
  assert.deepEqual(dash.items, [], "no questions from the last skill");
  assert.deepEqual(dash.topics, []);
  assert.deepEqual(dash.docs, [], "no doc tabs from the last skill");
  assert.equal(dash.finish, undefined, "no ending from the last skill");
  assert.equal(dash.menu, undefined);
  assert.equal(dash.stopWarning, undefined);
  assert.equal(dash.headline.cleared, 0);
  assert.equal(dash.specDir, "");
  assert.notEqual(dash.title, "Planny mood board", "the title falls back to the folder, like a fresh open");
  assert.ok(dash.scan, "the dashboard still gets its scan");
  assert.equal(fs.existsSync(draftFile), false, "a draft staged against the old questions is dropped");

  cli(["post", "--session", sid, "--file", payload("wf-dash-menu.json", { menu: { note: "fresh" } })]);
  cli(["open", "--resume", sid, "--no-open", "--workflow", "document", "--spec", "specs/mood-board", "--title", "Document: Planny mood board"]);
  const doc = readState();
  assert.equal(doc.workflow, "document");
  assert.equal(doc.title, "Document: Planny mood board");
  assert.equal(doc.specDir, "specs/mood-board");
  assert.equal(doc.menu, undefined, "the dashboard's menu does not follow the launch");
  assert.deepEqual(doc.items, []);

  // The same workflow again (a reconnect) keeps everything.
  cli(["post", "--session", sid, "--file", payload("wf-doc-q.json", {
    items: [{ id: "q-doc", kind: "text", title: "Which draft", body: "Pick one." }],
  })]);
  cli(["open", "--resume", sid, "--no-open", "--workflow", "document"]);
  assert.ok(readState().items.some((i) => i.id === "q-doc"), "resuming the same workflow is not a switch");
  cli(["open", "--resume", sid, "--no-open"]);
  assert.ok(readState().items.some((i) => i.id === "q-doc"), "nor is a resume with no --workflow");

  // A skill run inline from another (a quick task's Review it now) never
  // passes the dashboard: it takes the page over with everything on it.
  cli(["post", "--session", sid, "--file", payload("wf-qt.json", {
    workflow: "quick-task",
    docs: [{ id: "qt-notes", title: "What changed", blocks: [{ id: "b", state: "settled", md: "# Diff" }] }],
  })]);
  cli(["open", "--resume", sid, "--no-open", "--workflow", "review"]);
  const inline = readState();
  assert.equal(inline.workflow, "review");
  assert.ok(inline.items.some((i) => i.id === "q-doc"), "an inline switch keeps the questions");
  assert.ok(inline.docs.some((d) => d.id === "qt-notes"), "and the docs");
  assert.equal(inline.title, "Document: Planny mood board", "and the title");

  // Commit it now on a finished quick task stands in for the dashboard's Git
  // card: the finish must not outlive the switch, or the page stays on
  // "Opening Git…" above questions it never shows.
  cli(["post", "--session", sid, "--file", payload("wf-qt-done.json", {
    workflow: "quick-task",
    finish: { headline: "The tweaks are built", commit: true, dashboard: true },
  })]);
  fs.writeFileSync(draftFile, JSON.stringify({ staged: { "q-doc": { text: "x" } } }));
  cli(["open", "--resume", sid, "--no-open", "--workflow", "git"]);
  const commit = readState();
  assert.equal(commit.workflow, "git");
  assert.equal(commit.finish, undefined, "the quick task's ending is gone");
  assert.deepEqual(commit.items, [], "and its questions");
  assert.deepEqual(commit.docs, [], "and its docs");
  assert.equal(fs.existsSync(draftFile), false, "a draft staged against the old questions is dropped");

  fs.writeFileSync(stateFile, snapshot);
});

// The dashboard's one payload field has to survive validation: a patch
// carrying `menu` is agent-authored text the page renders, not a question.
test("the menu payload lands on the state the dashboard page reads", () => {
  const menu = {
    note: "AGENTS.md is missing — start with setup.",
    recommend: "plan2code-init",
    details: { "plan2code-3-implement": "Phase 2 of 4 is next" },
  };
  const res = cli(["post", "--session", sid, "--file", payload("menu.json", { menu })]);
  assert.equal(res.json.ok, true);
  const state = JSON.parse(fs.readFileSync(path.join(session, "state.json"), "utf8"));
  assert.deepEqual(state.menu, menu);
});

// `saved` is how the page knows a doc is already a file on disk and drops the
// download button for the path instead; it has to survive the doc merge.
test("a doc's saved path lands on the state the page reads", () => {
  const res = cli([
    "post",
    "--session",
    sid,
    "--file",
    payload("saved-doc.json", {
      docs: [
        {
          id: "agents",
          title: "AGENTS.md",
          saved: "AGENTS.md",
          blocks: [{ id: "b1", state: "settled", md: "# Lunch picker\n\n..." }],
        },
      ],
    }),
  ]);
  assert.equal(res.json.ok, true);
  const state = JSON.parse(fs.readFileSync(path.join(session, "state.json"), "utf8"));
  const doc = state.docs.find((d) => d.id === "agents");
  assert.equal(doc.saved, "AGENTS.md");
});

// An approval settles a proposal by patching only the blocks' states. Replacing
// `blocks` whole used to wipe every block's text and drop the ones not named,
// leaving a v2 tab with nothing on it.
test("a doc patch merges blocks by id, so settling a block keeps its text", () => {
  const readDoc = () =>
    JSON.parse(fs.readFileSync(path.join(session, "state.json"), "utf8")).docs.find((d) => d.id === "stack");
  cli(["post", "--session", sid, "--file", payload("stack-v1.json", {
    docs: [{
      id: "stack", title: "Tech stack", version: 1, note: "Proposal",
      blocks: [
        { id: "confirmed", state: "settled", md: "## Already in use" },
        { id: "proposed", state: "assumed", md: "## Proposed additions" },
        { id: "extra", state: "draft", md: "## Maybe later" },
      ],
    }],
  })]);
  cli(["post", "--session", sid, "--file", payload("stack-v2.json", {
    docs: [{
      id: "stack", version: 2, note: "Approved",
      blocks: [{ id: "proposed", state: "settled" }, { id: "extra", _delete: true }, { id: "new", state: "settled", md: "## Added" }],
    }],
  })]);
  const doc = readDoc();
  assert.equal(doc.version, 2);
  assert.equal(doc.title, "Tech stack");
  assert.deepEqual(doc.blocks, [
    { id: "confirmed", state: "settled", md: "## Already in use" },
    { id: "proposed", state: "settled", md: "## Proposed additions" },
    { id: "new", state: "settled", md: "## Added" },
  ]);
});

// The person's colors are saved by the SERVER, not the browser: localStorage
// is tied to the origin, the origin carries the ephemeral port, and the next
// session's port is different. looks.json under the console home is the copy
// that follows the app. (Runs while this test's server is still up: the forged
// -handle test below stops everything.)
test("looks round-trip through the server, and junk never reaches the file", async () => {
  const get = () => fetch(baseUrl + "/looks", { headers: { cookie: cookieFor(baseUrl, token) } });
  assert.equal((await get()).status, 404, "nothing saved yet");

  assert.equal((await post("/looks", { looks: { theme: "dark", accent: "cobalt" } })).status, 200);
  const body = await (await get()).json();
  assert.deepEqual(body.looks, { theme: "dark", accent: "cobalt" });
  assert.ok(Date.parse(body.at) > 0, "the server stamps the time, the client never does");

  const onDisk = JSON.parse(fs.readFileSync(path.join(HOME, "looks.json"), "utf8"));
  assert.deepEqual(onDisk.looks, body.looks, "the file is what the next port reads");

  // A settings file, not free storage: nested objects are stripped, and a POST
  // left with nothing usable is refused rather than blanking what is saved.
  assert.equal((await post("/looks", { looks: { deep: { nested: true } } })).status, 400);
  assert.equal((await post("/looks", { looks: "nope" })).status, 400);
  assert.equal((await post("/looks", { nope: true })).status, 400);
  assert.deepEqual(
    (await (await get()).json()).looks,
    { theme: "dark", accent: "cobalt" },
    "a refused write must not touch what is saved"
  );
});

test("a partial looks write merges onto the saved file, so a stale tab cannot undo another tab's change", async () => {
  const get = async () => (await (await fetch(baseUrl + "/looks", { headers: { cookie: cookieFor(baseUrl, token) } })).json()).looks;
  assert.equal((await post("/looks", { set: { sound: false } })).status, 200);
  assert.deepEqual(await get(), { theme: "dark", accent: "cobalt", sound: false });
  assert.equal((await post("/looks", { set: { accent: "sky" } })).status, 200);
  assert.deepEqual(await get(), { theme: "dark", accent: "sky", sound: false }, "keys this write did not name stay put");
  assert.equal((await post("/looks", { set: { deep: { nested: true } } })).status, 400);
  assert.deepEqual(await get(), { theme: "dark", accent: "sky", sound: false });
  assert.equal((await post("/looks", { looks: { theme: "dark", accent: "cobalt" } })).status, 200);
});

test("the tab title carries the session's short id, so tabs from different agents can be told apart", async () => {
  const html = await (await fetch(baseUrl + "/", { headers: { cookie: cookieFor(baseUrl, token) } })).text();
  assert.match(html, new RegExp(`<title>[^<]* · #${sid.slice(-6)} · Plan2Code</title>`));
});

test("models: the user's additions round-trip, XHigh and Max are refused, and the shipped list is read-only", async () => {
  fs.mkdirSync(path.join(MODELS_DIR, "bin"), { recursive: true });
  fs.writeFileSync(path.join(MODELS_DIR, "bin", "models.json"), JSON.stringify({ claude: [{ id: "opus", label: "Opus" }], devin: [{ id: "adaptive", label: "Adaptive" }] }));
  const get = async () => (await fetch(baseUrl + "/models", { headers: { cookie: cookieFor(baseUrl, token) } })).json();

  assert.deepEqual((await get()).shipped.devin, [{ id: "adaptive", label: "Adaptive" }]);
  assert.deepEqual((await get()).user, { claude: [], devin: [], codex: [] });

  const saved = await post("/models", { models: { devin: [{ id: " new-model-medium ", label: "" }, { id: "new-model-medium" }, { id: "" }] } });
  assert.equal(saved.status, 200);
  assert.deepEqual((await get()).user, { claude: [], devin: [{ id: "new-model-medium", label: "new-model-medium" }], codex: [] });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(MODELS_DIR, "models.json"), "utf8")).devin.length, 1, "the launcher reads this file");

  for (const id of ["some-model-xhigh", "some-model-MAX", "bad id!"]) {
    assert.equal((await post("/models", { models: { devin: [{ id }] } })).status, 400, id);
  }
  assert.equal((await post("/models", { nope: true })).status, 400);
  assert.equal((await get()).user.devin.length, 1, "a refused write must not touch what is saved");

  // Codex has no curated list, but the launcher reads a user `codex` list all the same.
  const codex = await post("/models", { models: { codex: [{ id: " gpt-5-codex ", label: "GPT-5 Codex" }, { id: "gpt-5-codex" }] } });
  assert.equal(codex.status, 200);
  assert.deepEqual((await get()).user, { claude: [], devin: [], codex: [{ id: "gpt-5-codex", label: "GPT-5 Codex" }] });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(MODELS_DIR, "models.json"), "utf8")).codex, [{ id: "gpt-5-codex", label: "GPT-5 Codex" }]);
  assert.deepEqual((await get()).shipped.codex, [], "a shipped file without codex still lists it, empty");

  assert.equal((await post("/models", { models: {} })).status, 200, "reset to default");
  assert.deepEqual((await get()).user, { claude: [], devin: [], codex: [] });
});

test("cleanup over HTTP: a scan lists strays in the console home, and a delete removes only what the scan found", async () => {
  const stray = path.join(HOME, "stray-cleanup.json");
  fs.writeFileSync(stray, "{}");
  backdate(stray);
  const res = await post("/cleanup", { scan: true });
  assert.equal(res.status, 200);
  const scan = await res.json();
  const ids = scan.items.map((i) => i.id);
  assert.ok(ids.includes("console:stray-cleanup.json"), ids.join(", "));
  for (const id of ["console:looks.json", "console:update-check.json", "console:sessions", "console:runtime"]) assert.ok(!ids.includes(id), id);
  assert.ok(!ids.includes("session:" + sid), "never the session serving the page");
  assert.ok(scan.items.every((i) => !("path" in i)), "no paths go to the page");
  assert.ok(!scan.items.some((i) => i.where === "root"), "a console from another home never reaches ~/.plan2code");

  const done = await post("/cleanup", { delete: ["console:stray-cleanup.json", "console:looks.json", "session:" + sid] });
  assert.equal(done.status, 200);
  assert.deepEqual((await done.json()).removed, ["console:stray-cleanup.json"]);
  assert.equal(fs.existsSync(stray), false);
  assert.ok(fs.existsSync(path.join(HOME, "update-check.json")));
});

test("stop leaves a process it cannot identify as ours alone", () => {
  // A handle file can outlive a reboot in the system temp dir and its pid can
  // be reused. Killing on the strength of a number alone can hit anything.
  const handleDir = path.join(HOME, "runtime");
  const bucket = fs.readdirSync(handleDir, { withFileTypes: true }).find((e) => e.isDirectory())?.name;
  assert.ok(bucket, "the session's project bucket exists under runtime/");
  const forged = path.join(handleDir, bucket, "20000101-000000-dead99.json");
  fs.writeFileSync(
    forged,
    JSON.stringify({
      v: 1,
      sid: "20000101-000000-dead99",
      pid: process.pid, // this test runner: alive, but emphatically not our server
      port: 1,
      url: "http://127.0.0.1:1/",
      startedAt: "2000-01-01T00:00:00.000Z",
    })
  );
  // A young one too: a server that died a minute ago leaves a fresh startedAt
  // behind, and its pid can already belong to something else. Being alive and
  // recent is not being ours; only /health says that.
  const young = path.join(handleDir, bucket, "20000101-000000-dead98.json");
  fs.writeFileSync(
    young,
    JSON.stringify({
      v: 1,
      sid: "20000101-000000-dead98",
      pid: process.pid,
      port: 1,
      url: "http://127.0.0.1:1/",
      startedAt: new Date().toISOString(),
    })
  );
  const res = cli(["stop", "--all"]);
  // Still here to assert anything at all is the proof neither pid was killed.
  assert.ok(res.json.skippedStaleHandles >= 2, "the unidentified handles must be skipped, not killed");
  assert.equal(fs.existsSync(forged), false, "and the stale handle file cleaned up");
  assert.equal(fs.existsSync(young), false, "the young one too");
});

/* ----------------------------------------------------------- lifecycle */

test("stop shuts the server down and wait then reports exit 20", () => {
  cli(["stop", "--session", sid]);
  const res = cli(["wait", "--session", sid, "--seconds", "12"]);
  assert.equal(res.status, 20);
  assert.equal(res.json.status, "server-gone");
});

// A 127.0.0.1 link is only the person's machine if the agent is on it too.
// Reported, not refused: a forwarded port in a devcontainer works fine, so the
// agent gets told and decides.
test("open flags an environment where the link may not reach the person", () => {
  const res = cli(["open", "--file", payload("remote.json", BASE), "--no-open"], {
    env: { SSH_CONNECTION: "10.0.0.1 22 10.0.0.2 22" },
  });
  assert.equal(res.json.ok, true, "it still starts");
  assert.equal(res.json.remote, "SSH_CONNECTION");
  assert.match(res.json.note, /not necessarily theirs/);
  cli(["stop", "--session", res.json.sid]);
});

test("the runtime dir is isolated by PLAN2CODE_CONSOLE_HOME", () => {
  // Otherwise a test run's `stop --all` would reach outside its own world and
  // kill a console session a developer is actually using in this repo.
  const handles = path.join(HOME, "runtime");
  assert.ok(fs.existsSync(handles), "handles must live under the overridden home, not the system temp dir");
});

test("resume brings the session back on a new port with state intact", async () => {
  const res = cli(["open", "--resume", sid, "--no-open"]);
  assert.equal(res.json.ok, true);
  assert.equal(res.json.sid, sid);
  assert.notEqual(res.json.url, baseUrl + `/s/${token}/`);
  const state = JSON.parse(fs.readFileSync(path.join(session, "state.json"), "utf8"));
  assert.equal(state.items.find((i) => i.id === "q1").status, "answered");

  // The port is new, the app is the same: the colors saved before the stop are
  // still served, which is the whole reason they live server-side.
  const m = res.json.url.match(/^(http:\/\/127\.0\.0\.1:\d+)\/s\/([^/]+)\//);
  const looksRes = await fetch(m[1] + "/looks", { headers: { cookie: cookieFor(m[1], m[2]) } });
  assert.deepEqual((await looksRes.json()).looks, { theme: "dark", accent: "cobalt" });

  cli(["stop", "--session", sid]);
});

/* ------------------------------------------------- the page's own logic */

// Every case below is one a placeholder is actually written in. The lead-in is
// the agent talking ABOUT the example; the example is what the person accepts.
test("a placeholder becomes an answer they could accept", () => {
  const strip = (placeholder, extra) => suggestionFrom({ placeholder, ...extra });

  assert.equal(strip("For example: about 8 of us."), "About 8 of us.");
  assert.equal(strip("For instance, two people."), "Two people.");
  assert.equal(strip("For example - about 8 of us."), "About 8 of us.");
  assert.equal(strip("Such as: CSV"), "CSV");

  // The abbreviations. These used to leave the punctuation behind, so the box
  // filled with ". compliance reviewers" and the stray dot was theirs to spot.
  assert.equal(strip("e.g. compliance reviewers."), "Compliance reviewers.");
  assert.equal(strip("E.g., the finance team."), "The finance team.");
  assert.equal(strip("eg. the finance team"), "The finance team");

  // A lead-in has to be followed by a separator, or these lose their first word.
  assert.equal(strip("Egypt office, about 8 people."), "Egypt office, about 8 people.");
  assert.equal(strip("Exampled output stays put"), "Exampled output stays put");
  assert.equal(strip("Say when you need it by."), "Say when you need it by.");

  // A kebab-case suggestion has to survive intact, hyphens and case included,
  // or it fails the `pattern` on the very field it was offered for.
  assert.equal(strip("audit-export", { pattern: "^[a-z-]+$" }), "audit-export");
  assert.equal(strip("example-name-here", { pattern: "^[a-z-]+$" }), "example-name-here");

  assert.equal(strip(""), "");
  assert.equal(strip(undefined), "");
});

test("an answer is stated back in the page's words, not the agent's shorthand", () => {
  const choice = {
    options: [
      { k: "A", text: "Continue without it" },
      { k: "B", text: "Run the setup first" },
    ],
  };
  assert.deepEqual(answerLines(choice, { k: "B" }), ["B · Run the setup first"]);
  assert.deepEqual(answerLines(choice, { ks: ["A", "B"] }), [
    "A · Continue without it",
    "B · Run the setup first",
  ]);
  assert.deepEqual(answerLines({}, { yes: false, noLabel: "Leave it" }), ["No"]);
  assert.deepEqual(answerLines({ noLabel: "Leave it" }, { yes: false }), ["Leave it"]);
  assert.deepEqual(answerLines({}, { verdict: "changes" }), ["I want changes"]);
  assert.deepEqual(answerLines({}, { state: "blocked" }), ["I am stuck"]);
  assert.deepEqual(answerLines({}, { done: [0, 2] }), ["Steps done: 1, 3"]);
  assert.deepEqual(answerLines({}, { skipped: true }), ["Skipped"]);
  assert.deepEqual(answerLines({}, null), []);
  // Free text is shown as prose, not as a picked label.
  assert.deepEqual(answerLines({}, { text: "audit-export" }), []);
});

test("what the agent recorded wins over the raw click, and either will do", () => {
  assert.equal(recordedAnswer({ answer: { k: "A" } }).k, "A");
  assert.equal(recordedAnswer({ submitted: { k: "B" } }).k, "B");
  assert.equal(recordedAnswer({ submitted: { k: "B" }, answer: { k: "A" } }).k, "A");
  // The note they sent with the click survives a narrower recorded answer.
  assert.equal(recordedAnswer({ submitted: { k: "B", text: "keep the header" }, answer: { k: "A" } }).text,
    "keep the header");
  assert.equal(recordedAnswer({}), null);
});

// What the agent receives from a single-choice question. Picking an option and
// then writing "none of these, because..." used to send both, joined, with the
// pick first, so the answer argued with itself.
test("a single-choice answer is one thing or the other, never both", () => {
  assert.deepEqual(choiceAnswer({ k: "A" }), { type: "answer", kind: "choice", k: "A" });
  assert.deepEqual(choiceAnswer({ text: "  neither, actually  " }), {
    type: "answer",
    kind: "choice",
    text: "neither, actually",
  });
  // A pick wins over stale text, and never travels with it.
  assert.deepEqual(choiceAnswer({ k: "A", text: "left over in the box" }), {
    type: "answer",
    kind: "choice",
    k: "A",
  });
  // Nothing to stage reads as "not answered yet", the same as everywhere else.
  assert.equal(choiceAnswer({}), null);
  assert.equal(choiceAnswer({ text: "   " }), null);
  assert.equal(choiceAnswer(), null);
});

// The exact words a brief request reaches the agent as. The Pathfinder brief
// playbook parses this range grammar, so a wording change here is a silent
// change to what gets written.
test("a brief request is phrased in the range grammar the playbook parses", () => {
  assert.equal(briefPhrase("today"), "Write a brief for today.");
  assert.equal(briefPhrase("this week"), "Write a brief for this week.");
  assert.equal(briefPhrase("full"), "Write a full brief.");
  assert.equal(
    briefPhrase("since 2026-09-15"),
    "Write a brief covering everything since 2026-09-15."
  );
  // Nothing chosen is the playbook's own default, not an empty request.
  assert.equal(briefPhrase(), "Write a brief for today.");
});

// The rule that keeps a question answerable. A send carrying only a note is on
// its way, but it is not an answer, and treating it as one locks the form on a
// question the person has not answered yet.
test("a note on its own is not an answer in flight", () => {
  assert.equal(sentAnswer({ at: 1, summary: "", value: null }), null);
  assert.equal(sentAnswer(undefined), null);
  assert.deepEqual(sentAnswer({ at: 1, summary: "b", value: { k: "B" } }), { k: "B" });
});

// The server's copy of a send (`submitted` on the item) is what lets a sent
// question still read as sent after a reload -- and, more importantly, after
// an agent took the answer and moved on without settling the item, which used
// to hand the question back looking as though the send never happened.
test("a send the agent never settled is still a send in flight", () => {
  const sub = { at: "2026-09-23T03:00:00Z", kind: "multi", ks: ["1", "2"] };
  // Nothing sent yet: nothing in flight.
  assert.equal(submittedAwaiting({}), null);
  assert.equal(submittedAwaiting(null), null);
  assert.equal(submittedAwaiting({ submitted: "not-an-object" }), null);
  // Sent and never replied to: still in flight.
  assert.equal(submittedAwaiting({ submitted: sub }), sub);
  // A note from the person is not the agent replying.
  assert.equal(
    submittedAwaiting({ submitted: sub, thread: [{ who: "user", text: "and one more thing", at: "2026-09-23T03:10:00Z" }] }),
    sub
  );
  // The agent said something after the send: the question is theirs again.
  assert.equal(
    submittedAwaiting({ submitted: sub, thread: [{ who: "agent", text: "On it.", at: "2026-09-23T03:05:00Z" }] }),
    null
  );
  // But an agent note from BEFORE the send does not clear it.
  assert.equal(
    submittedAwaiting({ submitted: sub, thread: [{ who: "agent", text: "Earlier.", at: "2026-09-23T02:00:00Z" }] }),
    sub
  );
  // A recorded answer means the agent settled it at some point: the leftover
  // submitted is the old send, not one in flight.
  assert.equal(submittedAwaiting({ submitted: sub, answer: { ks: ["1"] } }), null);
  // No clock to compare by: give the agent the benefit of the doubt rather
  // than lock a question it may have answered.
  assert.equal(submittedAwaiting({ submitted: sub, thread: [{ who: "agent", text: "No time on me." }] }), null);
});

test("a note the agent has not answered yet is still on its way", () => {
  const note = { at: "2026-09-23T03:00:00Z", text: "look at this" };
  assert.equal(noteAwaiting({}), null);
  assert.equal(noteAwaiting(null), null);
  assert.equal(noteAwaiting({ sentNote: "nope" }), null);
  assert.equal(noteAwaiting({ sentNote: note }), note);
  assert.equal(noteAwaiting({ sentNote: note, thread: [{ who: "agent", text: "Earlier.", at: "2026-09-23T02:00:00Z" }] }), note);
  assert.equal(noteAwaiting({ sentNote: note, thread: [{ who: "agent", text: "Seen.", at: "2026-09-23T03:01:00Z" }] }), null);
  assert.equal(
    noteAwaiting({ sentNote: note, thread: [{ who: "user", text: "look at this", at: "2026-09-23T03:00:00Z" }] }),
    note,
    "the person's own note in the thread is not a reply to it",
  );
  assert.equal(noteAwaiting({ sentNote: note, thread: [{ from: "agent", md: "Older shape.", at: "2026-09-23T03:01:00Z" }] }), null);
  assert.equal(noteAwaiting({ sentNote: note, thread: [{ who: "agent", text: "No clock." }] }), null);
});

// --- the session's ending ------------------------------------------------
//
// Everything else the page shows is a pause. `finish` is the one signal that
// says the session is OVER, which is what lets the page stop promising a next
// question, hand over the command, and treat the server going away as the
// expected last step rather than a fault.

// A finish with no command is a finished session with nothing left to run.
test("a finish is accepted with or without a command", () => {
  const bare = cli(["post", "--session", sid, "--file", payload("fin-bare.json", { finish: { headline: "Done" } })]);
  assert.equal(bare.status, 0);
  const next = cli([
    "post",
    "--session",
    sid,
    "--file",
    payload("fin-next.json", { finish: { headline: "Done", command: "/plan2code-2-document specs/x/overview.md" } }),
  ]);
  assert.equal(next.status, 0);
});

test("a present finish command must be a non-empty string without a placeholder", () => {
  for (const [name, command] of [["fin-empty.json", ""], ["fin-num.json", 42]]) {
    const res = cli(["post", "--session", sid, "--file", payload(name, { finish: { headline: "Done", command } })], {
      expectFail: true,
    });
    assert.equal(res.status, 3);
    assert.match(res.stderr, /"finish\.command" must be a non-empty string, or left out when there is nothing to run/);
  }
  const tmpl = cli(
    [
      "post",
      "--session",
      sid,
      "--file",
      payload("fin-tmpl2.json", { finish: { headline: "Done", command: "/plan2code-3-implement specs/<feature>/overview.md" } }),
    ],
    { expectFail: true }
  );
  assert.equal(tmpl.status, 3);
  assert.match(tmpl.stderr, /placeholder/);
});

test("a rejected finish leaves the state untouched", () => {
  const before = fs.readFileSync(path.join(session, "state.json"), "utf8");
  cli(["post", "--session", sid, "--file", payload("fin-empty2.json", { finish: { headline: "Done", command: "" } })], {
    expectFail: true,
  });
  assert.equal(fs.readFileSync(path.join(session, "state.json"), "utf8"), before);
});

// A rendered command is copied and run verbatim, so a leftover placeholder
// reaches someone with no way to know what fills it.
test("a finish is refused while its command still has a placeholder", () => {
  const file = payload("fin-tmpl.json", {
    finish: { headline: "Done", command: "/plan2code-0-pathfinder specs/<idea>/pathfinder" },
  });
  const res = cli(["post", "--session", sid, "--file", file], { expectFail: true });
  assert.equal(res.status, 3);
  assert.match(res.stderr, /placeholder/);
});

test("a finish faces the same jargon and completion-marker scan as everything else", () => {
  const jargon = cli(
    ["post", "--session", sid, "--file", payload("fin-j.json", { finish: { headline: "The grilling is over", command: "/x" } })],
    { expectFail: true }
  );
  assert.equal(jargon.status, 3);
  assert.match(jargon.stderr, /internal vocabulary/);

  const marker = cli(
    ["post", "--session", sid, "--file", payload("fin-t.json", { finish: { headline: "Done", command: "/x", body: "SPEC_COMPLETE" } })],
    { expectFail: true }
  );
  assert.equal(marker.status, 3);
  assert.match(marker.stderr, /completion marker/);
});

test("a good finish lands on the state the page reads", () => {
  const fin = {
    headline: "The map is written",
    body: "It is all under `specs/lunch-vote/pathfinder/`.",
    command: "/plan2code-0-pathfinder specs/lunch-vote/pathfinder",
  };
  const res = cli(["post", "--session", sid, "--file", payload("fin-ok.json", { finish: fin })]);
  assert.equal(res.json.ok, true);
  const state = JSON.parse(fs.readFileSync(path.join(session, "state.json"), "utf8"));
  assert.deepEqual(state.finish, fin);
});

// The review offer rides on the finish of a build. Its heading is read by the
// person, so it faces the vocabulary check, and a malformed one is refused.
test("a finish can carry the review offer, in either shape", () => {
  const base = { headline: "Phase 3 is done", command: "/plan2code-3-implement specs/lunch-vote/overview.md" };
  for (const review of [true, { label: "Review Phase 3 before you go" }]) {
    const res = cli(["post", "--session", sid, "--file", payload("fin-rev.json", { finish: { ...base, review } })]);
    assert.equal(res.json.ok, true);
  }
  const bad = cli(["post", "--session", sid, "--file", payload("fin-rev-bad.json", { finish: { ...base, review: "yes" } })], {
    expectFail: true,
  });
  assert.equal(bad.status, 3);
  assert.match(bad.stderr, /finish\.review/);
  const jargon = cli(
    ["post", "--session", sid, "--file", payload("fin-rev-j.json", { finish: { ...base, review: { label: "Grill the frontier" } } })],
    { expectFail: true }
  );
  assert.equal(jargon.status, 3);
  assert.match(jargon.stderr, /internal vocabulary/);
});

// The way back to the dashboard is an agent opt-in flag, so an older skill
// never shows a button nobody answers. Anything but a boolean is refused.
test("a finish can carry the dashboard flag, and only as a boolean", () => {
  const base = { headline: "Phase 3 is done", command: "/plan2code-3-implement specs/lunch-vote/overview.md" };
  for (const dashboard of [true, false]) {
    const res = cli(["post", "--session", sid, "--file", payload("fin-dash.json", { finish: { ...base, dashboard } })]);
    assert.equal(res.json.ok, true);
  }
  const bad = cli(["post", "--session", sid, "--file", payload("fin-dash-bad.json", { finish: { ...base, dashboard: "yes" } })], {
    expectFail: true,
  });
  assert.equal(bad.status, 3);
  assert.match(bad.stderr, /"finish\.dashboard" must be true or false \(or left out: no dashboard button\)/);
});

// The Commit it now button is the same kind of opt-in.
test("a finish can carry the commit flag, and only as a boolean", () => {
  const base = { headline: "The task is built", command: "git add -A && git commit -m \"x\" -m \"AI Assisted\"" };
  for (const commit of [true, false]) {
    const res = cli(["post", "--session", sid, "--file", payload("fin-commit.json", { finish: { ...base, commit } })]);
    assert.equal(res.json.ok, true);
  }
  const bad = cli(["post", "--session", sid, "--file", payload("fin-commit-bad.json", { finish: { ...base, commit: "yes" } })], {
    expectFail: true,
  });
  assert.equal(bad.status, 3);
  assert.match(bad.stderr, /"finish.commit" must be true or false/);
});

// Taking the review up is the agent posting `"finish": null`: the session goes
// back to work, so the page must stop saying it is over.
test("a finish can be taken back, which puts the session back to work", () => {
  const res = cli(["post", "--session", sid, "--file", payload("fin-null.json", { finish: null, agent: { status: "working" } })]);
  assert.equal(res.json.ok, true);
  const state = JSON.parse(fs.readFileSync(path.join(session, "state.json"), "utf8"));
  assert.equal(state.finish, undefined);
});

// A build tells the page how long a silence is normal. Bounded, because a huge
// number would hide a session that really has died.
test("a build's quiet stretch is accepted within bounds and refused outside them", () => {
  const ok = cli(["post", "--session", sid, "--file", payload("quiet-ok.json", {
    agent: { status: "working", activity: "Task 3.5 of 9: the rate limiter", quietMinutes: 20 },
  })]);
  assert.equal(ok.json.ok, true);
  for (const quietMinutes of [0, 61, "20"]) {
    const bad = cli(["post", "--session", sid, "--file", payload("quiet-bad.json", { agent: { quietMinutes } })], {
      expectFail: true,
    });
    assert.equal(bad.status, 3, `quietMinutes ${JSON.stringify(quietMinutes)} must be refused`);
    assert.match(bad.stderr, /quietMinutes/);
  }
  const cleared = cli(["post", "--session", sid, "--file", payload("quiet-clear.json", {
    agent: { status: "waiting", quietMinutes: null, activity: null },
  })]);
  assert.equal(cleared.json.ok, true);
  const state = JSON.parse(fs.readFileSync(path.join(session, "state.json"), "utf8"));
  assert.equal(state.agent.quietMinutes, undefined);
  assert.equal(state.agent.activity, undefined);
});

test("a top-level activity line is filed under agent, where the page reads it", () => {
  const res = cli(["post", "--session", sid, "--file", payload("activity-top.json", {
    agent: { status: "working" },
    activity: "Reading the plan",
  })]);
  assert.equal(res.json.ok, true);
  let state = JSON.parse(fs.readFileSync(path.join(session, "state.json"), "utf8"));
  assert.equal(state.agent.activity, "Reading the plan");
  assert.equal(state.activity, undefined);
  cli(["post", "--session", sid, "--file", payload("activity-both.json", {
    agent: { activity: "From agent" },
    activity: "From top",
  })]);
  state = JSON.parse(fs.readFileSync(path.join(session, "state.json"), "utf8"));
  assert.equal(state.agent.activity, "From agent");
  cli(["post", "--session", sid, "--file", payload("activity-clear.json", { activity: null })]);
  state = JSON.parse(fs.readFileSync(path.join(session, "state.json"), "utf8"));
  assert.equal(state.agent.activity, undefined);
  assert.equal(state.agent.status, "working");
  cli(["post", "--session", sid, "--file", payload("activity-rest.json", { agent: { status: "waiting" } })]);
});

test("post refuses a misplaced templates flag with exit 3", () => {
  const p = { items: [{ id: "tq", kind: "choice", title: "Pick one", options: [{ k: "A", text: "a" }], templates: "idea", required: false }] };
  const res = cli(["post", "--session", sid, "--file", payload("templates.json", p)], { expectFail: true });
  assert.equal(res.status, 3);
  assert.match(res.stderr, /only a text item can carry it/);
});
