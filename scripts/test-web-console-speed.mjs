// Web console tests for the per-turn shortcuts: what the CLI now does so the
// agent does not have to type it. A collected send marks the agent working,
// `post --wait` posts and waits in one command, doc blocks read their text from
// a file, `settle` records what was sent, docs version themselves, a question
// hands the turn over, chat replies name themselves, and a session hop comes
// with its resume command.
// Run with: node --test scripts/test-web-console-speed.mjs
//
// Shared setup (a per-process console home, the CLI runner, fixtures) lives in
// web-console-test-helpers.mjs; see the comment at its top.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { applyPatch, scanProject } from "../src/web-console/lib.mjs";
import {
  ROOT,
  CONSOLE_CLI,
  ENV,
  cli,
  payload,
  readState,
  consoleSession,
  postPatch,
  ask,
  EXPORT_A,
  openSession,
  WEB_CONSOLE_DIR,
  consoleDoc,
  consoleDocFiles,
} from "./web-console-test-helpers.mjs";

const choice = (id, extra = {}) => ({
  id,
  kind: "choice",
  title: `Question ${id}`,
  options: [
    { k: "A", text: "One" },
    { k: "B", text: "Two" },
  ],
  ...extra,
});

const waitFor = (s, seconds = 10) => cli(["wait", "--session", s.sid, "--seconds", String(seconds)]);

/* ------------------------------------------------- working on collection */

test("a collected send marks the agent working and drops the last stretch's activity", async () => {
  const s = openSession();
  try {
    postPatch(s, { agent: { status: "waiting", activity: "Old line" } });
    assert.equal((await s.send("/submit", EXPORT_A)).status, 200);
    assert.equal(readState(s.session).agent.status, "waiting", "the send alone changes nothing");
    assert.equal(waitFor(s).status, 0);
    const agent = readState(s.session).agent;
    assert.equal(agent.status, "working", "collecting the send is the agent's turn");
    assert.equal(agent.activity, undefined);
    assert.ok(agent.since, "the CLI stamps the time");
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

test("a Quick question alone never marks the agent working", async () => {
  const s = openSession();
  try {
    assert.equal((await ask(s, "Where does the export go?")).status, 200);
    assert.equal(waitFor(s).status, 0);
    assert.equal(readState(s.session).agent.status, "waiting", "chat rides its own channel");
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

/* --------------------------------------------------------- post --wait */

test("post --wait posts, then waits in the same command", async () => {
  const s = openSession();
  try {
    const started = Date.now();
    const res = cli(["post", "--session", s.sid, "--file", payload("pw-1.json", { title: "Posted then waited" }), "--wait", "5"]);
    assert.equal(res.status, 10, "nobody answered, so the wait's exit code");
    const lines = res.stdout.trim().split("\n").map((l) => JSON.parse(l));
    assert.equal(lines.length, 2, "the post's line, then the wait's");
    assert.equal(lines[0].ok, true);
    assert.equal(lines[1].status, "waiting");
    assert.ok(Date.now() - started >= 4500, "it really waited the slice");
    assert.equal(readState(s.session).title, "Posted then waited");

    assert.equal((await s.send("/submit", EXPORT_A)).status, 200);
    const got = cli(["post", "--session", s.sid, "--file", payload("pw-2.json", { agent: { status: "waiting" } }), "--wait", "10"]);
    assert.equal(got.status, 0, "a waiting send comes straight back");
    assert.equal(got.json.reply, "Export format: a");
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

test("a rejected post --wait exits 3 at once and never waits", () => {
  const s = openSession();
  try {
    const started = Date.now();
    const res = cli(
      ["post", "--session", s.sid, "--file", payload("pw-bad.json", { items: [choice("x", { title: "" })] }), "--wait", "30"],
      { expectFail: true }
    );
    assert.equal(res.status, 3);
    assert.ok(Date.now() - started < 10000, "no slice after a refusal");
    const bad = cli(["post", "--session", s.sid, "--file", payload("pw-ok.json", {}), "--wait", "soon"], { expectFail: true });
    assert.equal(bad.status, 2, "a slice that is no number is bad usage");
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

test("a wait slice ends on time: a health check in flight never holds the process", () => {
  const s = openSession();
  try {
    const started = Date.now();
    assert.equal(waitFor(s, 6).status, 10);
    assert.ok(Date.now() - started < 9000, `took ${Date.now() - started}ms`);
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

/* ------------------------------------------------------ file-backed docs */

function projectWithPhase() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-speed-"));
  fs.mkdirSync(path.join(dir, ".git"));
  fs.mkdirSync(path.join(dir, "specs", "lunch"), { recursive: true });
  const phase = path.join(dir, "specs", "lunch", "phase-1.md");
  fs.writeFileSync(
    phase,
    "# Phase 1: Votes\r\n\r\n## Tasks\r\n\r\n- [ ] **Task 1.1:** Add the table\r\n- [ ] **Task 1.2:** Add the route\r\n\r\n## Acceptance Criteria\r\n\r\n- [ ] It works\r\n"
  );
  const run = (args, opts = {}) => {
    const res = spawnSync(process.execPath, [CONSOLE_CLI, ...args], { env: ENV, encoding: "utf8", cwd: dir });
    if (!opts.expectFail && ![0, 10].includes(res.status)) throw new Error(`console ${args.join(" ")} failed (${res.status}): ${res.stderr}`);
    const last = res.stdout.trim().split("\n").filter(Boolean).pop();
    return { ...res, json: last ? JSON.parse(last) : null };
  };
  // A just-stopped server can still hold the folder as its cwd on Windows.
  const cleanup = () => {
    try {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch {}
  };
  return { dir, phase, run, cleanup };
}

test("a doc block with a file takes its text from disk; select tasks keeps the task lines", () => {
  const p = projectWithPhase();
  const opened = p.run(["open", "--no-open", "--workflow", "implement"]).json;
  try {
    const res = p.run([
      "post", "--session", opened.sid, "--file",
      payload("fd-1.json", {
        docs: [
          { id: "phase", title: "Phase 1 tasks", blocks: [{ id: "tasks", file: "specs/lunch/phase-1.md", select: "tasks" }] },
          { id: "phasefile", title: "phase-1.md", blocks: [{ id: "body", file: "specs/lunch/phase-1.md" }] },
        ],
      }),
    ]);
    assert.equal(res.status, 0, res.stderr);
    const docs = readState(opened.session).docs;
    const tasks = docs.find((d) => d.id === "phase").blocks[0];
    assert.equal(tasks.md, "- [ ] **Task 1.1:** Add the table\n- [ ] **Task 1.2:** Add the route");
    assert.equal(tasks.state, "settled", "a file block is settled unless it says otherwise");
    const body = docs.find((d) => d.id === "phasefile").blocks[0];
    assert.ok(body.md.startsWith("# Phase 1: Votes\n\n## Tasks"), "the whole file, line endings made LF");
    assert.ok(body.md.includes("- [ ] It works"));
    assert.equal(docs.find((d) => d.id === "phasefile").version, 1);

    fs.writeFileSync(p.phase, fs.readFileSync(p.phase, "utf8").replace("- [ ] **Task 1.1:**", "- [x] **Task 1.1:**"));
    assert.equal(
      p.run(["post", "--session", opened.sid, "--file", payload("fd-2.json", { docs: [{ id: "phase", refresh: true }, { id: "phasefile", refresh: true }] })]).status,
      0
    );
    const after = readState(opened.session).docs;
    assert.ok(after.find((d) => d.id === "phase").blocks[0].md.startsWith("- [x] **Task 1.1:**"));
    assert.ok(after.find((d) => d.id === "phasefile").blocks[0].md.includes("- [x] **Task 1.1:**"));
    assert.equal(after.find((d) => d.id === "phase").version, 2, "changed content is the next version");
    assert.equal(after.find((d) => d.id === "phasefile").version, 2);

    p.run(["post", "--session", opened.sid, "--file", payload("fd-3.json", { docs: [{ id: "phasefile", refresh: true }] })]);
    assert.equal(readState(opened.session).docs.find((d) => d.id === "phasefile").version, 2, "an unchanged file is not a new version");
  } finally {
    p.run(["stop", "--session", opened.sid]);
    p.cleanup();
  }
});

test("a doc block's file must exist, be inside the project, and select only takes tasks", () => {
  const p = projectWithPhase();
  const outside = path.join(os.tmpdir(), `p2c-outside-${process.pid}.md`);
  fs.writeFileSync(outside, "secret");
  const opened = p.run(["open", "--no-open", "--workflow", "implement"]).json;
  try {
    const post = (name, docs) => p.run(["post", "--session", opened.sid, "--file", payload(name, { docs })], { expectFail: true });
    const cases = [
      [[{ id: "a", blocks: [{ id: "b", file: "specs/lunch/nope.md" }] }], /no file at/],
      [[{ id: "a", blocks: [{ id: "b", file: outside }] }], /outside the project/],
      [[{ id: "a", blocks: [{ id: "b", file: "../" + path.basename(outside) }] }], /outside the project|no file at/],
      [[{ id: "a", blocks: [{ id: "b", file: "specs/lunch/phase-1.md", select: "everything" }] }], /select/],
      [[{ id: "a", refresh: true }], /refresh/],
      [[{ id: "a", blocks: [{ id: "b", file: "specs/lunch" }] }], /not a file/],
    ];
    for (const [docs, why] of cases) {
      const res = post(`fd-bad-${Math.random()}.json`, docs);
      assert.equal(res.status, 3, JSON.stringify(docs));
      assert.match(res.stderr, why);
    }
    assert.deepEqual(readState(opened.session).docs || [], [], "nothing was written");

    const fresh = p.run(["open", "--no-open", "--workflow", "implement", "--file", payload("fd-open.json", { docs: [{ id: "phasefile", title: "phase-1.md", blocks: [{ id: "body", file: "specs/lunch/phase-1.md" }] }] })]);
    assert.equal(fresh.status, 0, fresh.stderr);
    assert.ok(readState(fresh.json.session).docs[0].blocks[0].md.startsWith("# Phase 1"), "open --file reads files too");
    p.run(["stop", "--session", fresh.json.sid]);
  } finally {
    p.run(["stop", "--session", opened.sid]);
    fs.rmSync(outside, { force: true });
    p.cleanup();
  }
});

/* ------------------------------------------------------- pure patch rules */

const base = () => ({
  items: [
    { id: "q1", kind: "choice", title: "One", status: "open", submitted: { at: "2026-01-01T00:00:02.000Z", kind: "choice", k: "B" } },
    { id: "q2", kind: "text", title: "Two", status: "open", submitted: { at: "2026-01-01T00:00:02.000Z", kind: "text", text: "audit" } },
    { id: "q3", kind: "choice", title: "Three", status: "open", submitted: { at: "2026-01-01T00:00:01.000Z", kind: "choice", k: "A" } },
    { id: "q4", kind: "choice", title: "Four", status: "open" },
  ],
  docs: [{ id: "d", version: 3, blocks: [{ id: "b", state: "settled", md: "old" }] }],
  agent: { status: "working", quietMinutes: 20, since: "2026-01-01T00:00:00.000Z" },
});

test("settle: true records the latest send's cards as answered, with what was sent", () => {
  const next = applyPatch(base(), { settle: true });
  const by = Object.fromEntries(next.items.map((i) => [i.id, i]));
  assert.equal(by.q1.status, "answered");
  assert.deepEqual(by.q1.answer, { k: "B" });
  assert.deepEqual(by.q2.answer, { text: "audit" });
  assert.equal(by.q3.status, "open", "an older send left open on purpose stays open");
  assert.equal(by.q4.status, "open");
  assert.equal(next.settle, undefined, "settle never reaches the state");
});

test("settle: a list names the cards, the patch's own answer wins, and an unsent id is refused", () => {
  const next = applyPatch(base(), { settle: ["q1", "q3"], items: [{ id: "q1", answer: { text: "my reading" } }] });
  const by = Object.fromEntries(next.items.map((i) => [i.id, i]));
  assert.deepEqual(by.q1.answer, { text: "my reading" });
  assert.equal(by.q1.status, "answered");
  assert.deepEqual(by.q3.answer, { k: "A" });
  assert.throws(() => applyPatch(base(), { settle: ["q4"] }), /nothing sent/);
  assert.throws(() => applyPatch(base(), { settle: "q1" }), /true or a list/);
  const reopened = applyPatch(base(), { settle: ["q1"], items: [{ id: "q1", status: "reopened" }] });
  assert.equal(reopened.items[0].status, "reopened", "an explicit status wins");
});

test("a doc sent without a version moves up one when its content changed, and stays when not", () => {
  assert.equal(applyPatch(base(), { docs: [{ id: "d", blocks: [{ id: "b", md: "new" }] }] }).docs[0].version, 4);
  assert.equal(applyPatch(base(), { docs: [{ id: "d", blocks: [{ id: "b", md: "old" }] }] }).docs[0].version, 3);
  assert.equal(applyPatch(base(), { docs: [{ id: "d", version: 7, blocks: [{ id: "b", md: "new" }] }] }).docs[0].version, 7, "an explicit version wins");
  assert.equal(applyPatch(base(), { docs: [{ id: "n", blocks: [{ id: "b", md: "x" }] }] }).docs[1].version, 1, "a new doc starts at 1");
});

test("a new question with no status hands the turn over, and a status change restarts its clock", () => {
  const asked = applyPatch(base(), { items: [choice("q9")] });
  assert.equal(asked.agent.status, "waiting");
  assert.equal(asked.agent.quietMinutes, 20, "quietMinutes holds across a question: it only counts while working");
  assert.notEqual(asked.agent.since, "2026-01-01T00:00:00.000Z", "a new status gets a new since");
  const same = applyPatch(base(), { agent: { activity: "Still at it" } });
  assert.equal(same.agent.since, "2026-01-01T00:00:00.000Z", "the same status keeps its since");
  const kept = applyPatch(base(), { items: [choice("q9")], agent: { status: "working" } });
  assert.equal(kept.agent.status, "working", "a status the patch says wins");
  assert.equal(kept.agent.quietMinutes, 20);
  const notice = applyPatch(base(), { items: [{ id: "n1", kind: "notice", title: "Pushed" }] });
  assert.equal(notice.agent.status, "working", "a notice asks nothing");
  const progress = applyPatch(base(), { headline: { cleared: 2 } });
  assert.equal(progress.agent.status, "working", "progress alone changes nothing");
  const reopen = applyPatch(base(), { items: [{ id: "q4", status: "reopened" }] });
  assert.equal(reopen.agent.status, "waiting", "a reopened question asks again");
  const told = applyPatch(base(), { agent: { status: "waiting", quietMinutes: 5 } });
  assert.equal(told.agent.quietMinutes, 5, "said in the same patch, it stays");
});

test("a chat reply with no id is named r<seq>, so a repeat replaces it", () => {
  const once = applyPatch({}, { chat: { replies: [{ re: 12, conversation: 1, md: "First" }] } });
  assert.equal(once.chat.replies[0].id, "r12");
  const twice = applyPatch(once, { chat: { replies: [{ re: 12, conversation: 1, md: "Again" }] } });
  assert.equal(twice.chat.replies.length, 1);
  assert.equal(twice.chat.replies[0].md, "Again");
});

test("settle and a defaulted reply id go through post end to end", async () => {
  const s = consoleSession(["--workflow", "plan", "--file", payload("st-open.json", { items: [choice("q1"), choice("q2")] })]);
  try {
    assert.equal((await s.send("/submit", { actions: [{ i: "q1", type: "answer", kind: "choice", k: "B" }], reply: "Question q1: B" })).status, 200);
    assert.equal(waitFor(s).status, 0);
    assert.equal((await ask(s, "Why?")).status, 200);
    const msg = waitFor(s).json.chat.find((e) => e.kind === "message");
    const res = postPatch(s, { settle: true, chat: { replies: [{ re: msg.seq, conversation: msg.conversation, md: "Because." }] } });
    assert.equal(res.status, 0, res.stderr);
    const state = readState(s.session);
    const q1 = state.items.find((i) => i.id === "q1");
    assert.equal(q1.status, "answered");
    assert.deepEqual(q1.answer, { k: "B" });
    assert.equal(state.items.find((i) => i.id === "q2").status, "open");
    assert.equal(state.chat.replies[0].id, `r${msg.seq}`);
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

/* ------------------------------------------------------------ session hops */

test("a launch, a dashboard press and Commit it now each come with their resume command", async () => {
  const s = consoleSession(["--workflow", "dashboard"]);
  try {
    const cases = [
      [{ i: "__launch", type: "launch", skill: "plan2code-3-implement", workflow: "implement", spec: "specs/lunch vote" }, "implement", ' --spec "specs/lunch vote"'],
      [{ i: "__dashboard", type: "dashboard" }, "dashboard", ""],
      [{ i: "__commit", type: "commit" }, "git", ""],
    ];
    for (const [action, workflow, spec] of cases) {
      assert.equal((await s.send("/submit", { actions: [action], reply: "go" })).status, 200);
      const res = waitFor(s);
      assert.equal(res.status, 0);
      assert.equal(
        res.json.resume,
        `node "${path.join(ROOT, "src", "web-console", "console.mjs")}" open --resume ${s.sid} --no-open --workflow ${workflow}${spec}`
      );
      assert.equal(res.json.skillFile, undefined, "no installed skill beside the source tree");
    }
    assert.equal((await s.send("/submit", EXPORT_A)).status, 200);
    assert.equal(waitFor(s).json.resume, undefined, "an answer is no hop");
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

test("the built skills name the skill file to follow after a hop", async () => {
  const builtCli = path.join(ROOT, "skills", "plan2code", "references", "web-console", "console.mjs");
  if (!fs.existsSync(builtCli)) return;
  const run = (args) => {
    const res = spawnSync(process.execPath, [builtCli, ...args], { env: ENV, encoding: "utf8", cwd: ROOT });
    return { ...res, json: JSON.parse(res.stdout.trim().split("\n").pop()) };
  };
  const opened = run(["open", "--no-open", "--workflow", "dashboard"]).json;
  try {
    const m = opened.url.match(/^(http:\/\/127\.0\.0\.1:\d+)\/s\/([^/]+)\//);
    const cookie = `p2c_console_${new URL(m[1]).port}=${m[2]}`;
    await fetch(`${m[1]}/s/${m[2]}/`, { headers: { connection: "close" } });
    const res = await fetch(`${m[1]}/submit`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie, connection: "close" },
      body: JSON.stringify({ actions: [{ i: "__launch", type: "launch", skill: "plan2code-review", workflow: "review" }], reply: "go" }),
    });
    assert.equal(res.status, 200);
    const got = run(["wait", "--session", opened.sid, "--seconds", "10"]).json;
    assert.equal(got.skillFile, path.join(ROOT, "skills", "plan2code-review", "SKILL.md"));
  } finally {
    run(["stop", "--session", opened.sid]);
  }
});


/* ------------------------------------------------- the contract's layout */

// console.md is read once per conversation and everything else when its
// moment comes. These keep that true: every file the index names exists and
// prints through help, every topic file is in the index, every file the docs
// and the skills point at is real, and the core stays small.
const DOC_REF = /`((?:console-[a-z-]+|building(?:-review)?|console|notes\/[a-z-]+)\.md)`|<D>\/((?:console-[a-z-]+|building(?:-review)?|console|notes\/[a-z-]+)\.md)/g;

test("every doc console.md's index names exists, prints through help, and every topic file is indexed", () => {
  const core = consoleDoc("console.md");
  const index = core.slice(core.indexOf("## What to read, and when"), core.indexOf("## Starting it"));
  const named = new Set([...index.matchAll(/`([a-z/-]+\.md)`/g)].map((m) => m[1]));
  for (const file of consoleDocFiles().filter((f) => f !== "console.md" && !f.startsWith("notes/"))) {
    assert.ok(named.has(file), `console.md's index names ${file}`);
  }
  for (const file of named) {
    if (file.includes("<")) continue;
    assert.ok(fs.existsSync(path.join(WEB_CONSOLE_DIR, file)), `${file} exists`);
  }
  const topics = cli(["help", "topics"]).json.topics;
  for (const [topic, file] of Object.entries(topics)) {
    assert.ok(fs.existsSync(path.join(WEB_CONSOLE_DIR, file)), `help ${topic} -> ${file} exists`);
    assert.equal(cli(["help", topic]).stdout, consoleDoc(file), `help ${topic} prints ${file}`);
  }
  for (const file of consoleDocFiles()) {
    assert.ok(Object.values(topics).includes(file), `help has a topic for ${file}`);
  }
  assert.equal(cli(["help", "nope"], { expectFail: true }).status, 2);
});

test("every console workflow has its notes, and its skill's Interface reads them", () => {
  const notesFor = {
    init: "init", "init-update": "init", pathfinder: "pathfinder", plan: "plan", "revise-plan": "revise-plan",
    document: "document", implement: "implement", "implement-review": "implement", "quick-task": "quick-task",
    review: "review", finalize: "finalize", handoff: "handoff", changelog: "changelog", git: "git",
  };
  const skills = fs.readdirSync(path.join(ROOT, "src")).filter((f) => /^plan2code(-.*)?\.md$/.test(f));
  for (const f of skills) {
    const text = fs.readFileSync(path.join(ROOT, "src", f), "utf8");
    const workflow = (text.match(/console\.mjs" open --workflow ([a-z-]+)/) || [])[1];
    assert.ok(workflow, `${f} names its workflow`);
    const open = text.search(/console\.mjs" open(?! --resume)/);
    if (workflow === "dashboard") {
      assert.ok(text.includes("<D>/console-launches.md"), "the dashboard reads console-launches.md");
      continue;
    }
    const notes = `<D>/notes/${notesFor[workflow]}.md`;
    assert.ok(fs.existsSync(path.join(WEB_CONSOLE_DIR, "notes", `${notesFor[workflow]}.md`)), `notes for ${workflow}`);
    const at = text.indexOf(notes);
    assert.ok(at > open, `${f} reads ${notes} after it opens the console`);
  }
});

test("every doc the console docs and the skills point at exists", () => {
  const sources = [
    ...consoleDocFiles().map((f) => [f, consoleDoc(f)]),
    ...fs.readdirSync(path.join(ROOT, "src")).filter((f) => /^plan2code(-.*)?\.md$/.test(f)).map((f) => [f, fs.readFileSync(path.join(ROOT, "src", f), "utf8")]),
  ];
  for (const [from, text] of sources) {
    for (const m of text.matchAll(DOC_REF)) {
      const file = m[1] || m[2];
      assert.ok(fs.existsSync(path.join(WEB_CONSOLE_DIR, file)), `${from} points at ${file}, which exists`);
    }
    for (const m of text.matchAll(/console\.md → ([A-Z][a-z]+(?: [a-z]+)*)/g)) {
      assert.match(consoleDoc("console.md"), new RegExp(`^#+ ${m[1]}$`, "m"), `${from}: console.md has a "${m[1]}" heading`);
    }
    // `<file>.md` → Section: the named file has that heading (or bold lead-in).
    for (const m of text.matchAll(/`((?:console-[a-z-]+|building(?:-review)?|notes\/[a-z-]+)\.md)` → "?([A-Z][^".,;()`\n]*[a-z])/g)) {
      const target = consoleDoc(m[1]);
      const titles = target
        .split("\n")
        .filter((l) => /^#+ /.test(l) || /^\*\*/.test(l))
        .map((l) => l.replace(/^#+\s*(\d+\.\s*)?/, "").replace(/\*\*/g, "").trim());
      const found = titles.some((t) => t.includes(m[2]) || m[2].startsWith(t.split(/[:.]/)[0].trim()));
      assert.ok(found, `${from}: ${m[1]} has a "${m[2]}" section`);
    }
  }
});

test("the core console.md stays small enough to read in one go", () => {
  const size = consoleDoc("console.md").length;
  assert.ok(size < 24000, `console.md is ${size} characters; move detail into a topic file`);
  for (const file of consoleDocFiles()) {
    assert.ok(consoleDoc(file).length < 16000 || file === "console.md", `${file} stays under 16,000 characters`);
  }
});

test("no console doc tells the agent to write fallbackText or post a status it no longer needs", () => {
  for (const file of consoleDocFiles()) {
    const text = consoleDoc(file);
    assert.doesNotMatch(text, /fallbackText/, `${file} still teaches fallbackText, which nothing reads`);
    assert.doesNotMatch(text, /as soon as you start thinking about a send/, `${file} still asks for a working post first`);
  }
});

/* ------------------------------------------------- review regressions */

test("post --wait with no number takes the slice from --seconds", () => {
  const s = openSession();
  try {
    const started = Date.now();
    const res = cli(["post", "--session", s.sid, "--file", payload("pw-secs.json", {}), "--wait", "--seconds", "5"]);
    assert.equal(res.status, 10);
    assert.ok(Date.now() - started < 12000, `took ${Date.now() - started}ms, not the default 240s`);
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

test("a file block's own words are never refused by the prose scan, but typed text over it is", () => {
  const p = projectWithPhase();
  fs.writeFileSync(path.join(p.dir, "specs", "lunch", "overview.md"), "# Lunch\n\n| Requirements | 17 |\n");
  const opened = p.run(["open", "--no-open", "--workflow", "finalize"]).json;
  try {
    const post = (name, docs) => p.run(["post", "--session", opened.sid, "--file", payload(name, { docs })], { expectFail: true });
    assert.equal(post("bait-1.json", [{ id: "summary", title: "overview.md", blocks: [{ id: "body", file: "specs/lunch/overview.md" }] }]).status, 0);
    assert.equal(post("bait-2.json", [{ id: "summary", refresh: true }]).status, 0, "a refresh of it goes through too");
    const typed = post("bait-3.json", [{ id: "summary", blocks: [{ id: "body", md: "Requirements 22" }] }]);
    assert.equal(typed.status, 3, "the same words typed by the agent are still refused");
    assert.equal(post("bait-4.json", [{ id: "summary", blocks: [{ id: "body", md: "Typed now" }] }]).status, 0);
    const block = readState(opened.session).docs[0].blocks[0];
    assert.equal(block.file, undefined, "typed text over a file block stops it being one");
    assert.equal(post("bait-5.json", [{ id: "summary", refresh: true }]).status, 3, "so a refresh finds nothing to re-read");
  } finally {
    p.run(["stop", "--session", opened.sid]);
    p.cleanup();
  }
});

test("a file named again without select is the whole file, on every refresh", () => {
  const p = projectWithPhase();
  const opened = p.run(["open", "--no-open", "--workflow", "implement"]).json;
  try {
    const post = (name, docs) => p.run(["post", "--session", opened.sid, "--file", payload(name, { docs })]);
    post("sel-1.json", [{ id: "phase", blocks: [{ id: "tasks", file: "specs/lunch/phase-1.md", select: "tasks" }] }]);
    post("sel-2.json", [{ id: "phase", blocks: [{ id: "tasks", file: "specs/lunch/phase-1.md" }] }]);
    post("sel-3.json", [{ id: "phase", refresh: true }]);
    const block = readState(opened.session).docs[0].blocks[0];
    assert.equal(block.select, undefined);
    assert.ok(block.md.startsWith("# Phase 1"), "the whole file, not the task lines");
  } finally {
    p.run(["stop", "--session", opened.sid]);
    p.cleanup();
  }
});

test("collecting a send restarts the working clock and keeps a build's quietMinutes", async () => {
  const s = openSession();
  try {
    postPatch(s, { agent: { status: "working", quietMinutes: 20 } });
    const opened = readState(s.session).agent.since;
    assert.equal(cli(["wait", "--session", s.sid, "--seconds", "5"]).status, 10);
    assert.equal(readState(s.session).agent.status, "waiting", "a wait with a question open is their turn");
    await new Promise((r) => setTimeout(r, 30));
    assert.equal((await s.send("/submit", EXPORT_A)).status, 200);
    assert.equal(waitFor(s).status, 0);
    const agent = readState(s.session).agent;
    assert.equal(agent.status, "working");
    assert.equal(agent.quietMinutes, 20, "the build's patience survives the question");
    assert.ok(Date.parse(agent.since) > Date.parse(opened), "a fresh working turn, not the session's age");
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

test("a wait with nothing open leaves a working agent working", () => {
  const s = consoleSession(["--workflow", "pathfinder"]);
  try {
    postPatch(s, { agent: { status: "working", activity: "Researching 3 questions (1 of 3 back)" } });
    assert.equal(waitFor(s, 5).status, 10);
    assert.equal(readState(s.session).agent.status, "working", "research subagents still out: the page keeps saying so");
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

test("the git board lets go of a working agent that went adrift", () => {
  const js = fs.readFileSync(path.join(ROOT, "src", "web-console", "public", "app.js"), "utf8");
  const at = js.indexOf("const gitMode = ");
  const line = js.slice(at, js.indexOf(";", at));
  assert.ok(line.includes("(agentWorking() && !agentAdrift())"), line);
});

test("post --file - reads the patch from stdin, UTF-8 and a BOM included", () => {
  const s = openSession();
  try {
    const run = (input, extra = []) =>
      spawnSync(process.execPath, [CONSOLE_CLI, "post", "--session", s.sid, "--file", "-", ...extra], { env: ENV, encoding: "utf8", cwd: ROOT, input });
    const ok = run("\uFEFF" + JSON.stringify({ title: "Piped in — no file → fine" }));
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(readState(s.session).title, "Piped in — no file → fine");
    const waited = run(JSON.stringify({ title: "And waited" }), ["--wait", "5"]);
    assert.equal(waited.status, 10, "stdin and --wait together");
    const bad = run("not json");
    assert.equal(bad.status, 2);
    assert.match(bad.stderr, /could not read --file - as one JSON object/);
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

/* ------------------------------------------------ e2e run's cosmetics */

test("the spec scan counts task lines, not every checkbox, and falls back for older files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-scan-tasks-"));
  try {
    const spec = (name, phase) => {
      fs.mkdirSync(path.join(root, "specs", name), { recursive: true });
      fs.writeFileSync(path.join(root, "specs", name, "overview.md"), "# spec\n");
      fs.writeFileSync(path.join(root, "specs", name, "phase-1.md"), phase);
    };
    spec("tasks", "## Tasks\n\n- [x] **Task 1.1:** One\n- [x] **Task 1.2:** Two\n- [ ] **Task 1.3:** Three\n\n## Acceptance Criteria\n\n- [ ] It works\n");
    spec("done", "- [x] **Task 1.1:** One\r\n\r\n## Acceptance Criteria\r\n\r\n- [ ] It works\r\n");
    spec("ready", "- [ ] **Task 1.1:** One\n- [ ] **Task 1.2:** Two\n- [ ] It works\n");
    spec("old", "- [x] Task one\n- [ ] Task two\n");
    const by = Object.fromEntries(scanProject(root).specs.map((s) => [s.name, s]));
    assert.equal(by.tasks.detail, "2 of 3 tasks done", "the acceptance checkbox is not a task");
    assert.equal(by.done.state, "built", "every task done is built, whatever the criteria say");
    assert.equal(by.ready.detail, "1 phase, 2 tasks ready");
    assert.equal(by.old.detail, "1 of 2 tasks done", "a file without task lines counts its checkboxes");
  } finally {
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

test("collecting a send puts the phase back to collecting", async () => {
  const s = openSession();
  try {
    assert.equal((await s.send("/submit", EXPORT_A)).status, 200);
    assert.equal(readState(s.session).phase, "submitted", "waiting to be picked up");
    assert.equal(waitFor(s).status, 0);
    assert.equal(readState(s.session).phase, "collecting");
    assert.equal(postPatch(s, { settle: true }).json.phase, "collecting", "and post says so");
    assert.equal(readState(s.session).agent.handled, undefined, "no dead fields on a fresh agent block");
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

test("a run of resets reaches the agent as one line", async () => {
  const s = openSession();
  try {
    assert.equal((await s.send("/chat", { reset: true, conversation: 1 })).status, 200);
    assert.equal((await s.send("/chat", { reset: true, conversation: 2 })).status, 200);
    assert.equal((await ask(s, "Hello?", { conversation: 3 })).status, 200);
    const res = waitFor(s);
    assert.equal(res.status, 0);
    assert.equal(res.json.chat.filter((e) => e.kind === "reset").length, 1, JSON.stringify(res.json.chat));
    assert.equal(res.json.reply.match(/New conversation started/g).length, 1);
    assert.equal(cli(["chat", "--session", s.sid]).status, 10, "the cursor moved past every reset");
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

test("a finish ends the working stretch, and resuming a pause starts a fresh one", async () => {
  const s = consoleSession(["--workflow", "plan"]);
  try {
    postPatch(s, { agent: { status: "working", activity: "Saving" } });
    postPatch(s, { finish: { headline: "Paused before the checkpoint", command: "/plan2code-1-plan" } });
    const paused = readState(s.session).agent;
    assert.equal(paused.status, "waiting", "a pause posted without a wait does not sit at working");
    await new Promise((r) => setTimeout(r, 30));
    cli(["open", "--resume", s.sid, "--no-open"]);
    const resumed = readState(s.session);
    assert.equal(resumed.finish, undefined);
    assert.equal(resumed.agent.status, "working");
    assert.ok(Date.parse(resumed.agent.since) > Date.parse(paused.since), "a fresh turn's clock");
    const told = applyPatch({ agent: { status: "working" } }, { finish: { headline: "Done" }, agent: { status: "working" } });
    assert.equal(told.agent.status, "working", "a status the patch says still wins");
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

test("a card with a note box over the git board flows at its own height, never shrunk under the board", () => {
  const css = fs.readFileSync(path.join(ROOT, "src", "web-console", "public", "app.css"), "utf8");
  const rule = css.slice(css.indexOf(".git-cards > .card,"), css.indexOf("{", css.indexOf(".git-cards > .card,")));
  assert.ok(rule.includes(".git-cards > .card.is-primary.has-grow"), "the board's natural-height rule outranks .has-grow");
  const js = fs.readFileSync(path.join(ROOT, "src", "web-console", "public", "app.js"), "utf8");
  const fn = js.slice(js.indexOf("function markGrowBox("), js.indexOf("function naturalHeight("));
  assert.ok(fn.includes("isGitBoard()"), "no box grows over the board");
});

test("long task lines, long words, a narrow board and a narrow Ask pane never widen the page", () => {
  const css = fs.readFileSync(path.join(ROOT, "src", "web-console", "public", "app.css"), "utf8");
  const rule = (sel) => {
    const at = css.indexOf("\n" + sel + " {");
    assert.ok(at > -1, `${sel} has a rule`);
    return css.slice(at, css.indexOf("}", at));
  };
  assert.match(rule(".md-li.is-task"), /grid-template-columns: 16px minmax\(0, 1fr\)/, "a task's text column can shrink below a code line");
  assert.match(rule(".md"), /overflow-wrap: anywhere/, "a long word breaks instead of widening the doc");
  assert.match(rule(".main > .git-board"), /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(rule(".git-table-wrap"), /overflow-x: auto/, "the branch table scrolls on its own");
  assert.match(rule(".ask-actions"), /flex-wrap: wrap/, "the Ask pane's Send never clips");
  const view = fs.readFileSync(path.join(ROOT, "src", "web-console", "public", "git-board-view.js"), "utf8");
  const fn = view.slice(view.indexOf("function branchTable("), view.indexOf("function createPanel("));
  assert.ok(fn.includes('h.el("div", "git-table-wrap")'), "branchTable wraps its table");
});

test("over the git board a note box grows with its text, and the no-repo note only points above when a card is there", () => {
  const css = fs.readFileSync(path.join(ROOT, "src", "web-console", "public", "app.css"), "utf8");
  assert.match(css, /\.git-cards > \.card textarea \{ field-sizing: content; max-height: 50vh; \}/);
  const view = fs.readFileSync(path.join(ROOT, "src", "web-console", "public", "git-board-view.js"), "utf8");
  const fn = view.slice(view.indexOf("export function drawGitBoard("), view.indexOf("function header("));
  assert.ok(fn.includes("ctx.hasCard"), "the note checks for a card first");
  assert.ok(fn.includes("will ask what to do here in a moment"));
  const js = fs.readFileSync(path.join(ROOT, "src", "web-console", "public", "app.js"), "utf8");
  assert.match(js, /hasCard: Boolean\(card\)/, "the host says whether a card is in the slot");
});
