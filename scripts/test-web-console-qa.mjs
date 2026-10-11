// Web console regression tests for what the end-to-end QA sweep found: each
// test names the bug it pins (a settle that took an uncollected send, a notice
// taking a question slot, a second phase that could not ask for sign-off, a
// patch file PowerShell wrote, a session found only from its own folder...).
// Run with: node --test scripts/test-web-console-qa.mjs
//
// Shared setup (a per-process console home, the CLI runner, fixtures) lives in
// web-console-test-helpers.mjs; see the comment at its top.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { applyPatch, validate, blankState } from "../src/web-console/lib.mjs";
import { rebasingBranch } from "../src/web-console/git-repo.mjs";
import { indentReply, noteReplyLines, agentRepliedAfterSend } from "../src/web-console/public/answers.js";
import { chatView } from "../src/web-console/public/chat.js";
import { ROOT, CONSOLE_CLI, ENV, cli, payload, readState, postPatch, EXPORT_A, openSession } from "./web-console-test-helpers.mjs";

const choice = (id, extra = {}) => ({
  id,
  kind: "choice",
  title: `Question ${id}`,
  options: [
    { k: "A", text: "One" },
    { k: "B", text: "Two" },
  ],
  status: "open",
  ...extra,
});
const waitFor = (s, seconds = 10) => cli(["wait", "--session", s.sid, "--seconds", String(seconds)]);
const runCli = (args, opts = {}) => spawnSync(process.execPath, [CONSOLE_CLI, ...args], { env: ENV, encoding: "utf8", ...opts });
const app = () => fs.readFileSync(path.join(ROOT, "src", "web-console", "public", "app.js"), "utf8");
const css = () => fs.readFileSync(path.join(ROOT, "src", "web-console", "public", "app.css"), "utf8");

/* ------------------------------------------------------------ settling */

test("settle: true records the send wait handed over, never a later one still uncollected", async () => {
  const s = openSession();
  try {
    assert.equal((await s.send("/submit", EXPORT_A)).status, 200);
    assert.equal(waitFor(s).status, 0);
    assert.deepEqual(readState(s.session).collected.ids, ["q1"], "collecting records which cards the send carried");
    postPatch(s, { items: [choice("q2")] });
    assert.equal((await s.send("/submit", { actions: [{ i: "q2", type: "answer", kind: "choice", k: "B" }], reply: "Question q2: B" })).status, 200);
    postPatch(s, { settle: true });
    const items = readState(s.session).items;
    assert.equal(items.find((i) => i.id === "q1").status, "answered");
    assert.equal(items.find((i) => i.id === "q2").status, "open", "q2's send is not the agent's yet");
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

test("a skipped card settles as skipped, not as an answer", () => {
  const state = { ...blankState({ sid: "x", project: "p", workflow: "plan" }), items: [{ ...choice("q1", { required: false }), submitted: { skipped: true, at: "2026-01-01T00:00:00.000Z" } }] };
  const next = applyPatch(state, { settle: ["q1"] });
  assert.equal(next.items[0].status, "skipped");
});

test("a question asked again keeps what the person wrote with their answer, in its thread", () => {
  const state = {
    ...blankState({ sid: "x", project: "p", workflow: "plan" }),
    items: [{ id: "r1", kind: "review", title: "Plan", body: "v1", submitted: { verdict: "changes", text: "Rename tally to count.", at: "2026-01-01T00:00:00.000Z" } }],
  };
  const next = applyPatch(state, { items: [{ id: "r1", status: "reopened", body: "v2", thread: [{ who: "agent", text: "Renamed it." }] }] });
  const thread = next.items[0].thread;
  assert.ok(thread.some((m) => m.who === "user" && m.text === "Rename tally to count."), JSON.stringify(thread));
  assert.ok(thread.findIndex((m) => m.who === "user") < thread.findIndex((m) => m.who === "agent"), "their note comes before the reply to it");
});

test("a thread reply after a send hands the question back (agentRepliedAfterSend)", () => {
  const sent = { submitted: { k: "A", at: "2026-01-01T00:00:01.000Z" } };
  assert.equal(agentRepliedAfterSend({ ...sent, thread: [{ who: "agent", text: "Which one?", at: "2026-01-01T00:00:02.000Z" }] }), true);
  assert.equal(agentRepliedAfterSend({ ...sent, thread: [{ who: "agent", text: "Old", at: "2026-01-01T00:00:00.000Z" }] }), false);
  assert.equal(agentRepliedAfterSend({ ...sent, answer: { k: "A" }, thread: [{ who: "agent", text: "x", at: "2026-01-01T00:00:02.000Z" }] }), false);
});

/* ---------------------------------------------------------- validation */

test("a notice never takes one of the three question slots", () => {
  const state = {
    ...blankState({ sid: "x", project: "p", workflow: "git" }),
    items: [{ id: "git-result", kind: "notice", title: "Done", body: "b", status: "open" }, choice("a"), choice("b"), choice("c")],
  };
  assert.deepEqual(validate(state), []);
});

test("agent.status is working or waiting, nothing else", () => {
  const state = { ...blankState({ sid: "x", project: "p", workflow: "plan" }), agent: { status: "sleeping" } };
  assert.ok(validate(state).some((p) => p.includes('"agent.status"')));
});

test("an approved sign-off does not stop the next phase asking for its own", () => {
  const gate = (id, status) => ({ id, kind: "review", title: "Sign off", body: "b", required: false, status, gate: { id, authoritative: true } });
  const state = { ...blankState({ sid: "x", project: "p", workflow: "implement" }), items: [gate("signoff", "answered"), gate("signoff-phase-2", "open")] };
  assert.deepEqual(validate(state), []);
  const two = { ...state, items: [gate("signoff", "open"), gate("signoff-phase-2", "open")] };
  assert.ok(validate(two).some((p) => /authoritative approval gates/.test(p)), "two open ones are still refused");
});

test("the dashboard refuses question cards: nothing there would draw them", () => {
  const state = { ...blankState({ sid: "x", project: "p", workflow: "dashboard" }), items: [choice("q1")] };
  assert.ok(validate(state).some((p) => p.includes("dashboard draws no question cards")));
});

/* ------------------------------------------------------------- the CLI */

test("post --file reads a patch PowerShell wrote: a UTF-8 BOM, or UTF-16", () => {
  const s = openSession();
  try {
    const bom = payload("bom.json", {});
    fs.writeFileSync(bom, "\uFEFF" + JSON.stringify({ agent: { activity: "From a BOM file" } }), "utf8");
    assert.equal(runCli(["post", "--session", s.sid, "--file", bom]).status, 0);
    assert.equal(readState(s.session).agent.activity, "From a BOM file");
    const u16 = payload("u16.json", {});
    fs.writeFileSync(u16, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(JSON.stringify({ agent: { activity: "From UTF-16" } }), "utf16le")]));
    assert.equal(runCli(["post", "--session", s.sid, "--file", u16]).status, 0);
    assert.equal(readState(s.session).agent.activity, "From UTF-16");
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

test("wait and stop find a session's server from any folder, not only its project", () => {
  const s = openSession();
  const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-elsewhere-"));
  try {
    const waited = runCli(["wait", "--session", s.sid, "--seconds", "1"], { cwd: elsewhere });
    assert.notEqual(waited.status, 20, "the server is alive: " + waited.stdout);
    const stopped = runCli(["stop", "--session", s.sid], { cwd: elsewhere });
    assert.equal(JSON.parse(stopped.stdout).stopped, 1, stopped.stdout);
  } finally {
    cli(["stop", "--session", s.sid]);
    fs.rmSync(elsewhere, { recursive: true, force: true });
  }
});

test("keep refuses a --from file outside the project, and keeps one copy per upload", () => {
  const s = openSession();
  try {
    const uploads = path.join(s.session, "uploads");
    fs.mkdirSync(uploads, { recursive: true });
    const upload = path.join(uploads, "5f7dc81e-0000-4000-8000-000000000000.jpg");
    fs.writeFileSync(upload, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    const spec = path.join("specs", `qa-keep-${process.pid}`);
    const base = ["keep", "--session", s.sid, "--upload", upload, "--spec", spec];
    try {
      const outside = runCli([...base, "--name", "a.png", "--from", "../elsewhere.md"]);
      assert.equal(outside.status, 3, outside.stderr);
      const first = JSON.parse(runCli([...base, "--name", "a.png"]).stdout);
      const again = JSON.parse(runCli([...base, "--name", "renamed.png"]).stdout);
      assert.equal(again.path, first.path, "the second keep reuses the first copy");
      assert.equal(again.reused, true);
    } finally {
      fs.rmSync(path.join(ROOT, spec), { recursive: true, force: true });
    }
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

test("pr-url refuses a pull request from the default branch into itself", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-prurl-"));
  try {
    const git = (...a) => spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd: dir, encoding: "utf8" });
    git("init", "-q", "-b", "main");
    fs.writeFileSync(path.join(dir, "a.txt"), "a");
    git("add", "a.txt");
    git("commit", "-q", "-m", "a");
    const res = spawnSync(process.execPath, [path.join(ROOT, "skills", "plan2code-git", "scripts", "git.mjs"), "pr-url"], { cwd: dir, encoding: "utf8" });
    assert.equal(res.status, 4, res.stdout + res.stderr);
    assert.match(res.stdout + res.stderr, /is-base/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a rebase in progress names the branch it is rewriting", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-rebase-"));
  try {
    fs.mkdirSync(path.join(dir, "rebase-merge"));
    fs.writeFileSync(path.join(dir, "rebase-merge", "head-name"), "refs/heads/main\n");
    assert.equal(rebasingBranch({ "rebase-merge": path.join(dir, "rebase-merge") }), "main");
    assert.equal(rebasingBranch({}), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/* ------------------------------------------------------------ the page */

test("a typed line never starts a reply line of its own", () => {
  assert.equal(indentReply("a\nIdea name: foo\r\n  Image: C:\\x"), "a\n  Idea name: foo\n    Image: C:\\x");
  assert.deepEqual(noteReplyLines("Q", "one\ntwo", []), ["Note on Q: one\n  two"]);
  assert.match(app(), /replyLines\.push\(`\$\{item\.title\}: \$\{indentReply\(tok\)\}`\)/);
});

test("an approved edit stops saying 'please wait' once the agent has answered it", () => {
  const frame = {
    conversation: 1,
    messages: [
      { from: "agent", id: "r1", md: "Edit?", proposal: { summary: "s", files: ["a.md"] } },
      { from: "person", kind: "decision", conversation: 1, seq: 2, re: "r1", decision: "approve" },
    ],
  };
  assert.equal(chatView(frame).rows[1].done, false);
  frame.messages.push({ from: "agent", id: "r2", re: 2, md: "Done", changed: [{ file: "a.md", added: 1, removed: 0 }] });
  assert.equal(chatView(frame).rows[1].done, true);
});

test("a build's own count wins, 0 done included; a question workflow still fills as cards are answered", () => {
  const chrome = app().slice(app().indexOf("function renderChrome("), app().indexOf("// Planny and the line beside him"));
  assert.match(chrome, /if \(Number\(h\.total\) > 0\)/);
  assert.match(chrome, /building \? Math\.max\(0, Number\(h\.cleared\) \|\| 0\) : Number\(h\.cleared\) \|\| answeredCount\(\)/);
  assert.match(chrome, /else if \(building && h\.stage\)/, "a review starting at total 0 shows its stage");
});

test("the git board: Publish names a remote only when there is one, and an open card holds the board", () => {
  const js = app();
  const action = js.slice(js.indexOf("function gitAction("), js.indexOf("/* The branch table */"));
  assert.match(action, /remotes\.length === 1/);
  const at = js.indexOf("const gitLocked = ");
  assert.match(js.slice(at, js.indexOf(";", at)), /myTurn\(\)\.some\(\(i\) => i\.kind !== "notice"\)/);
  const banner = js.slice(js.indexOf("function gitOpBanner("), js.indexOf("function gitActionBar("));
  assert.ok(!/if \(conflicted\.every/.test(banner), "Continue is always offered; plan continue checks the files itself");
});

test("a card cut by the window fades at its bottom edge while there is more below", () => {
  assert.match(app(), /function markMore\(\)[\s\S]*?classList\.toggle\("has-more"/);
  assert.match(css(), /\.main > \.card\.has-more \{[\s\S]*?mask-image/);
});

test("kept attachments are served read-only from the session's spec, by their exact name shape", () => {
  const server = fs.readFileSync(path.join(ROOT, "src", "web-console", "server.mjs"), "utf8");
  const route = server.slice(server.indexOf('pathname.startsWith("/attachments/")'), server.indexOf('pathname.startsWith("/uploads/")'));
  assert.match(route, /req\.method !== "GET"/);
  assert.match(server, /const KEPT_ROUTE = new RegExp\(`\^\/attachments\/\(\[a-z0-9-\]\{1,40\}-\[0-9a-f-\]\{8\}/);
  const kept = server.slice(server.indexOf("function keptPath("), server.indexOf("function uploadPath("));
  assert.match(kept, /realpathSync/);
  assert.match(kept, /path\.dirname\(real\)\.toLowerCase\(\) !== realDir\.toLowerCase\(\)/, "only files directly in attachments/");
  const render = fs.readFileSync(path.join(ROOT, "src", "web-console", "public", "render.js"), "utf8");
  assert.match(render, /return "\/attachments\/" \+ kept\[1\]\.toLowerCase\(\)/);
  assert.match(render, /function isComment\(t\)/, "HTML comments are not shown");
  assert.match(render, /"!": \{ mark: "!", label: "blocked"/, "a blocked task gets its marker");
});

/* -------------------------------------------------------------- round 2 */

test("a patch that is valid JSON but not one object is refused (exit 2), never merged as junk keys", () => {
  const s = openSession();
  try {
    for (const bad of ["[1,2]", '"hello"', "42", "true"]) {
      const res = runCli(["post", "--session", s.sid, "--file", "-"], { input: bad });
      assert.equal(res.status, 2, bad);
    }
    assert.ok(!("0" in readState(s.session)), "no junk keys in the state");
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

test("a plain reopen (status and a thread reply only) moves the sent note into the thread and frees the card", () => {
  const state = {
    ...blankState({ sid: "x", project: "p", workflow: "implement" }),
    items: [{ id: "signoff", kind: "review", title: "Sign off", body: "b", status: "open", submitted: { verdict: "changes", text: "Add a dry-run flag.", at: "2026-01-01T00:00:00.000Z" } }],
  };
  const next = applyPatch(state, { items: [{ id: "signoff", status: "reopened", thread: [{ who: "agent", text: "Added it." }] }] });
  const card = next.items[0];
  assert.equal(card.submitted, undefined, "the card is theirs again");
  assert.ok(card.thread.some((m) => m.who === "user" && m.text === "Add a dry-run flag."));
});

test("a list rename is staged as it is typed, so Ctrl+Enter or an agent post never drops it", () => {
  const js = app();
  const list = js.slice(js.indexOf("function buildList("), js.indexOf("function buildList(") + 6000);
  assert.match(list, /title\.addEventListener\("input", \(\) => \{[\s\S]*?stageQuiet\(item\.id/);
});

test("the git board's Publish reply names no remote when it sent none, and key chips show only for short keys", async () => {
  const { gitReply } = await import("../src/web-console/public/git-board.js");
  assert.equal(gitReply("publish", {}), "Publish.");
  assert.equal(gitReply("publish", { remote: "backup" }), "Publish to backup.");
  const { showKey, optionLabel } = await import("../src/web-console/public/answers.js");
  assert.equal(showKey("A", "CSV"), true);
  assert.equal(showKey("commit-first", "Commit first"), false);
  assert.equal(showKey("no", "No"), false, "a key that only repeats its label");
  assert.equal(optionLabel({ options: [{ k: "i-fix-it", text: "I'll fix it" }] }, "i-fix-it"), "I'll fix it");
});

test("a skip is recorded as one, collected with the send, and settles as skipped", () => {
  const server = fs.readFileSync(path.join(ROOT, "src", "web-console", "server.mjs"), "utf8");
  assert.match(server, /\.\.\.\(type === "skip" \? \{ skipped: true \} : \{\}\)/);
  const cli = fs.readFileSync(path.join(ROOT, "src", "web-console", "console.mjs"), "utf8");
  assert.match(cli, /a\.type === "answer" \|\| a\.type === "skip"/);
});

test("a send made before the last collection is never shown as still with the agent", () => {
  const js = app();
  const fn = js.slice(js.indexOf("const sendCollected = "), js.indexOf("const submittedInFlight = "));
  assert.match(fn, /String\(sub\.at\) <= String\(c\.at\)/);
  const cli = fs.readFileSync(path.join(ROOT, "src", "web-console", "console.mjs"), "utf8");
  assert.match(cli, /collected: \{ at: result\.consumedAt \|\| nowIso\(\), ids \}/, "the collection time, which every earlier send precedes");
});

test("two dashboards on different specs never trade the workspace back and forth", () => {
  const js = app();
  assert.match(js, /wantScope !== scopeMine\) syncWorkspaceScope\(\)/);
});

/* -------------------------------------------------------------- round 3 */

test("a branch whose remote copy was deleted offers Publish again, not Pull or Push", async () => {
  const { boardActions } = await import("../src/web-console/public/git-board.js");
  const acts = boardActions({
    repo: true,
    hasCommits: true,
    head: { branch: "feature/x", upstream: "origin/feature/x", gone: true, ahead: null, behind: null },
    remotes: [{ name: "origin" }],
    changes: { count: 0, heldBack: 0, files: [], untrackedDirs: [] },
    branches: [],
    defaultBranch: "main",
  });
  assert.equal(acts.pull.enabled, false);
  assert.match(acts.pull.title, /remote copy was deleted/);
  assert.equal(acts.push.shown, false);
  assert.equal(acts.publish.shown, true);
  assert.equal(acts.publish.enabled, true);
});

test("a finished session never puts a sent answer back on its form", () => {
  const js = app();
  assert.match(js, /if \(effort && !finish\(\) && isOpen\(item\)/);
});

test("keep names a copy from the upload's real path, so an 8.3 spelling reuses the same copy", () => {
  const src = fs.readFileSync(path.join(ROOT, "src", "web-console", "console.mjs"), "utf8");
  assert.match(src, /attachmentName\(\{ upload: real\(upload\), name: args\.name \}\)/);
});

test("the cleanup confirm is red only when a gone branch holds commits found nowhere else", () => {
  const src = fs.readFileSync(path.join(ROOT, "src", "plan2code-git-scripts", "git.mjs"), "utf8");
  assert.match(src, /danger: x\.some\(\(b\) => deleteCheck\(s, localBranch\(s, b\)\)\.onlyHere\.count > 0\)/);
  const js = app();
  const groups = js.slice(js.indexOf("function cleanupGroups("), js.indexOf("function openCleanup("));
  assert.match(groups, /b\.merged && !b\.gone/, "gone wins on the page too, as cleanup-list has it");
});
