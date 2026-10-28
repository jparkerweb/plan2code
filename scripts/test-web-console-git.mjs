// Web console tests, the git workflow's console plumbing.
// Run with: node --test scripts/test-web-console-git.mjs
//
// Shared setup (a per-process console home, the CLI runner, fixtures) lives in
// web-console-test-helpers.mjs; see the comment at its top.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
// The page's pure answer-shaping logic. app.js itself cannot be imported here
// (it touches `document` at module scope and starts a session on import), which
// is exactly why this lives in its own file.
import {
  cardAvailability,
  GIT_INIT_NOTE,
  resumeCommand,
  SKILL_CATALOG,
} from "../src/web-console/public/answers.js";
import { SKILLS } from "../src/web-console/public/skills.js";
import { breakdownFrom, pointsFrom } from "../src/web-console/public/meter.js";
import {
  BRANCH_TYPES,
  REMOTE_FOLD,
  UNTRACKED_TICK_LIMIT,
  boardActions,
  boardAwaiting,
  boardPrLink,
  commitTicks,
  composeBranchName,
  filterBranches,
  foldRemote,
  gitReply,
  nameStatus,
  orderBranches,
  refreshedLine,
} from "../src/web-console/public/git-board.js";
import { prUrl } from "../src/web-console/public/pr-url.js";
import { PROTECTED_CONSOLE_FILES, readLedger } from "../src/web-console/sessions.mjs";
import {
  CONSOLE_CLI,
  HOME,
  ENV,
  safeJson,
  payload,
  cliIn,
  sessionUrl,
  readState,
} from "./web-console-test-helpers.mjs";
import { copyFixture, slashed, fixtureCleanup } from "./fixture-helpers.mjs";

/* ------------------------------------------- the git workflow: console plumbing */

// A throwaway repo with one commit on main pushed to a bare origin, and its
// git runner. The console runs from inside it, so state.git reads this repo.
// Built once and copied for each test (fixture-helpers.mjs).
test.after(fixtureCleanup);
const gitRunner = (repo) => (...a) => {
  const r = spawnSync("git", a, { cwd: repo, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${a.join(" ")}: ${r.stderr}`);
  return r.stdout;
};
function gitBoardRepo(name) {
  const base = copyFixture(name, "board", (dir) => {
    const repo = path.join(dir, "repo");
    const bare = path.join(dir, "origin.git");
    fs.mkdirSync(repo);
    const git = gitRunner(repo);
    spawnSync("git", ["init", "-q", "--bare", "-b", "main", bare]);
    git("init", "-q", "-b", "main");
    git("config", "user.email", "t@example.com");
    git("config", "user.name", "T");
    git("config", "commit.gpgsign", "false");
    fs.writeFileSync(path.join(repo, "a.txt"), "a\n");
    git("add", "a.txt");
    git("commit", "-q", "-m", "first");
    git("remote", "add", "origin", slashed(bare));
    git("push", "-q", "-u", "origin", "main");
  });
  const repo = path.join(base, "repo");
  const git = gitRunner(repo);
  // cliIn() throws on exit 3; refusals are checked through spawnSync here.
  const cli = (a) => {
    const res = spawnSync(process.execPath, [CONSOLE_CLI, ...a], { env: ENV, encoding: "utf8", cwd: repo });
    return { ...res, json: safeJson(res.stdout) };
  };
  const open = (...a) => cliIn(repo, ["open", "--no-open", ...a]);
  // A stopped server can take a while to let go of its working directory on
  // Windows; a temp folder left behind then is not a test failure.
  const cleanup = () => {
    try {
      fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    } catch {}
  };
  return { base, repo, git, open, cli, cleanup };
}

const gitCard = { id: "g1", kind: "choice", title: "Switch to main?", options: [{ k: "A", text: "Yes" }], token: { A: "yes" } };

test("git: open --workflow git writes state.git, and a dashboard open writes none", () => {
  const r = gitBoardRepo("git-open");
  try {
    const opened = r.open("--workflow", "git");
    assert.equal(opened.json.ok, true);
    const git = readState(opened.json.session).git;
    assert.equal(git.repo, true);
    assert.equal(git.head.branch, "main");
    assert.equal(git.refreshFailed, false);
    r.cli(["stop", "--session", opened.json.sid]);
    const dash = r.open("--workflow", "dashboard");
    assert.equal("git" in readState(dash.json.session), false, "the dashboard gets a scan, not a board");
    r.cli(["stop", "--session", dash.json.sid]);
  } finally {
    r.cleanup();
  }
});

test("git: a reread post lands the card and a fresh state.git in one write", () => {
  const r = gitBoardRepo("git-reread");
  try {
    const { sid, session } = r.open("--workflow", "git").json;
    const first = readState(session).git;
    assert.equal(first.head.ahead, 0);
    fs.writeFileSync(path.join(r.repo, "a.txt"), "changed\n");
    r.git("commit", "-q", "-am", "second");
    const res = r.cli(["post", "--session", sid, "--file", payload("git-reread.json", { reread: true, items: [gitCard] })]);
    assert.equal(res.status, 0, res.stderr);
    const after = readState(session);
    assert.ok(after.items.some((i) => i.id === "g1"), "the card landed");
    assert.equal(after.git.head.ahead, 1, "and the board moved with it");
    assert.ok(Date.parse(after.git.at) >= Date.parse(first.at));
    assert.equal("reread" in after, false, "reread never reaches the state");
    r.cli(["stop", "--session", sid]);
  } finally {
    r.cleanup();
  }
});

test("git: refreshFailed is set by the agent and cleared by a newer FETCH_HEAD", () => {
  const r = gitBoardRepo("git-refresh");
  try {
    const { sid, session } = r.open("--workflow", "git").json;
    r.cli(["post", "--session", sid, "--file", payload("git-fail.json", { reread: { refreshFailed: true } })]);
    assert.equal(readState(session).git.refreshFailed, true);
    r.cli(["open", "--resume", sid, "--no-open"]);
    assert.equal(readState(session).git.refreshFailed, true, "a server-restart resume keeps the failure");
    r.cli(["post", "--session", sid, "--file", payload("git-same.json", { reread: true })]);
    assert.equal(readState(session).git.refreshFailed, true, "no newer fetch: the failure stands");
    r.git("fetch", "-q");
    const fetchHead = path.join(r.repo, ".git", "FETCH_HEAD");
    const later = new Date(Date.now() + 60_000);
    fs.utimesSync(fetchHead, later, later);
    r.cli(["post", "--session", sid, "--file", payload("git-fetched.json", { reread: true })]);
    assert.equal(readState(session).git.refreshFailed, false, "a newer FETCH_HEAD clears it");
    r.cli(["open", "--resume", sid, "--no-open", "--file", payload("git-open-fail.json", { reread: { refreshFailed: true } })]);
    assert.equal(readState(session).git.refreshFailed, true, "open --file carries the agent's flag too");
    r.cli(["stop", "--session", sid]);
  } finally {
    r.cleanup();
  }
});

test("git: reread is refused off the git workflow or malformed, and a patch never carries state.git", () => {
  const r = gitBoardRepo("git-refuse");
  try {
    const plan = r.open("--workflow", "plan").json;
    const before = fs.readFileSync(path.join(plan.session, "state.json"), "utf8");
    const off = r.cli(["post", "--session", plan.sid, "--file", payload("git-off.json", { reread: true, items: [gitCard] })]);
    assert.equal(off.status, 3);
    assert.match(off.stderr, /reread only goes with the git workflow/);
    assert.equal(fs.readFileSync(path.join(plan.session, "state.json"), "utf8"), before, "the state is unchanged");
    r.cli(["stop", "--session", plan.sid]);

    const { sid } = r.open("--workflow", "git").json;
    for (const bad of ["yes", { refreshFailed: "no" }, { refreshFailed: true, extra: 1 }, [], false]) {
      const res = r.cli(["post", "--session", sid, "--file", payload("git-bad.json", { reread: bad })]);
      assert.equal(res.status, 3, JSON.stringify(bad));
      assert.match(res.stderr, /reread must be true or \{ refreshFailed: true\|false \}/);
    }
    const own = r.cli(["post", "--session", sid, "--file", payload("git-own.json", { git: { repo: true } })]);
    assert.equal(own.status, 3);
    assert.match(own.stderr, /state\.git is the console's own: post reread instead/);
    r.cli(["stop", "--session", sid]);
  } finally {
    r.cleanup();
  }
});

test("git: resuming into Git hops like a dashboard launch, and leaving for the dashboard drops state.git", () => {
  const r = gitBoardRepo("git-hop");
  try {
    const qt = r.open("--workflow", "quick-task").json;
    const done = payload("git-qt.json", {
      items: [gitCard],
      docs: [{ id: "qt-notes", title: "What changed", blocks: [{ id: "b", state: "settled", md: "# Diff" }] }],
      finish: { headline: "The tweaks are built", commit: true, dashboard: true },
    });
    assert.equal(r.cli(["post", "--session", qt.sid, "--file", done]).status, 0);
    r.cli(["open", "--resume", qt.sid, "--no-open", "--workflow", "git"]);
    const board = readState(qt.session);
    assert.equal(board.workflow, "git");
    assert.equal(board.finish, undefined, "the quick task's ending is gone");
    assert.deepEqual(board.items, [], "and its questions");
    assert.deepEqual(board.docs, [], "and its docs");
    assert.equal(board.git.head.branch, "main", "and the board has its data");
    r.cli(["open", "--resume", qt.sid, "--no-open", "--workflow", "dashboard"]);
    assert.equal("git" in readState(qt.session), false, "the dashboard does not keep the old board");
    r.cli(["stop", "--session", qt.sid]);
  } finally {
    r.cleanup();
  }
});

test("git: POST /pr-host saves to pr-hosts.json and refuses a bad kind or a non-git session", async () => {
  const r = gitBoardRepo("git-prhost");
  const store = path.join(HOME, "pr-hosts.json");
  fs.rmSync(store, { force: true });
  const sendTo = (s, body) =>
    fetch(`${s.base}/pr-host`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: s.cookie, connection: "close" },
      body: JSON.stringify(body),
    });
  try {
    const plan = r.open("--workflow", "plan").json;
    const notGit = await sendTo(sessionUrl(plan.url), { host: "git.example.com", kind: "gitlab" });
    assert.equal(notGit.status, 400);
    assert.equal((await notGit.json()).error, "not-git");
    r.cli(["stop", "--session", plan.sid]);

    const g = r.open("--workflow", "git").json;
    const gs = sessionUrl(g.url);
    assert.equal((await sendTo(gs, { host: "git.example.com", kind: "forgejo" })).status, 400, "a kind it does not know");
    assert.equal((await sendTo(gs, { host: "bad host/x", kind: "gitlab" })).status, 400, "a host that is not a host");
    assert.equal((await sendTo(gs, { host: "Git.Example.COM", kind: "gitlab" })).status, 200);
    assert.deepEqual(JSON.parse(fs.readFileSync(store, "utf8")), { "git.example.com": "gitlab" }, "saved lowercased, as it is looked up");
    assert.equal(fs.existsSync(path.join(r.repo, "pr-hosts.json")), false, "nothing under the project");
    assert.ok(PROTECTED_CONSOLE_FILES.has("pr-hosts.json"), "Cleanup never removes it");
    r.cli(["stop", "--session", g.sid]);
  } finally {
    fs.rmSync(store, { force: true });
    r.cleanup();
  }
});

test("git: the meter scores the launch, a commit tally and conflict help, never the board's answers", () => {
  const launch = { kind: "launch", id: "L1", workflow: "git" };
  assert.equal(pointsFrom([launch]), 1);
  assert.deepEqual(breakdownFrom([launch]), [{ label: "Git started", points: 1 }]);
  const commit = (n, c = 1) => ({ kind: "run", id: `L1:c${n}`, event: "git-commits", workflow: "git", commits: c });
  const tally = (n) => pointsFrom(Array.from({ length: n }, (_, i) => commit(i)));
  assert.deepEqual([0, 1, 2, 3].map(tally), [0, 0, 1, 1]);
  assert.equal(pointsFrom([commit(0, 3)]), 1, "one run with three commits scores the same");
  assert.deepEqual(breakdownFrom([launch, commit(0, 3)]), [
    { label: "Git started", points: 1 },
    { label: "3 commits in Git", points: 1 },
  ]);
  assert.equal(pointsFrom([{ kind: "run", id: "L1:conflict-1", event: "git-conflict", workflow: "git" }]), 1);
  const answers = Array.from({ length: 6 }, (_, i) => ({ kind: "answer", id: `L1:a${i}`, workflow: "git" }));
  assert.equal(pointsFrom(answers), 0, "a click on the board is not back-and-forth");
});

test("git: commits on a run go only with git-commits, as a whole number", () => {
  const r = gitBoardRepo("git-commits");
  try {
    const { sid, session } = r.open("--workflow", "git").json;
    const wrong = r.cli(["post", "--session", sid, "--file", payload("git-c1.json", { run: { event: "git-conflict", id: "x", commits: 2 } })]);
    assert.equal(wrong.status, 3);
    assert.match(wrong.stderr, /commits only goes with git-commits/);
    for (const bad of [0, 1.5, 1000, "2"]) {
      const res = r.cli(["post", "--session", sid, "--file", payload("git-c2.json", { run: { event: "git-commits", id: "y", commits: bad } })]);
      assert.equal(res.status, 3, String(bad));
    }
    const ok = r.cli(["post", "--session", sid, "--file", payload("git-c3.json", { run: { event: "git-commits", id: "z", commits: 2 } })]);
    assert.equal(ok.status, 0, ok.stderr);
    assert.ok(readLedger(session).some((e) => e.event === "git-commits" && e.commits === 2), "the count rides on the ledger line");
    r.cli(["stop", "--session", sid]);
  } finally {
    r.cleanup();
  }
});

test("git: the Git card is never grayed, and its resume command is /plan2code-git", () => {
  const entry = SKILL_CATALOG.find((e) => e.skill === "plan2code-git");
  assert.equal(entry.workflow, "git");
  assert.deepEqual(cardAvailability(entry, { hasAgents: true, isGit: false }, null), { on: true, note: GIT_INIT_NOTE });
  assert.deepEqual(cardAvailability(entry, { hasAgents: true, isGit: true, pending: 4 }, null), { on: true, note: "4 files to commit" });
  assert.deepEqual(cardAvailability(entry, { hasAgents: true, isGit: true, pending: 0 }, null), { on: true });
  assert.deepEqual(cardAvailability(entry, { hasAgents: true, isGit: true, pending: null }, null), { on: true });
  assert.equal(resumeCommand({ workflow: "git" }), "/plan2code-git");
});

test("git: the Git card's copy, place and availability are pinned (FR-58, FR-59)", async () => {
  const entry = SKILL_CATALOG.find((e) => e.skill === "plan2code-git");
  assert.equal(entry.blurb, "Branches, pull, push and commits on one board that stays open while you work.");
  assert.equal(
    entry.about,
    "Shows your branch, what is ahead or behind, and every local and remote branch. Switch, create, delete or clean up branches, pull (rebasing when they have split, with help on conflicts), push or publish, and commit with a clear message. It asks before every push, publish and delete, and never force-pushes."
  );
  assert.equal(entry.group, "extra");
  assert.equal(entry.chip, "Utility");
  // The card order is skills.js's order.
  const order = SKILLS.filter((s) => s.card).map((s) => s.skill);
  assert.equal(order.indexOf("plan2code-git") + 1, order.indexOf("plan2code-handoff"), "the Git card comes right before Handoff");
  assert.equal(order.at(-1), "plan2code-handoff", "the Handoff card is last");
  assert.deepEqual(SKILL_CATALOG.map((e) => e.skill), order, "the catalog draws in that order");
  for (const isGit of [true, false, undefined]) {
    for (const pending of [0, 3, null]) {
      const scan = { hasAgents: true, pending, ...(isGit === undefined ? {} : { isGit }) };
      assert.equal(cardAvailability(entry, scan, null).on, true, JSON.stringify(scan));
    }
  }
  assert.equal(cardAvailability(entry, null, null).on, true, "no scan at all");
  const answers = await import("../src/web-console/public/answers.js");
  assert.ok(!("GIT_CLEAN_REASON" in answers), "GIT_CLEAN_REASON is no longer exported");
});

test("git: the board stays locked from a click until the agent's next post, not just until it is collected", () => {
  const sentAt = Date.parse("2026-10-10T05:15:31.000Z");
  assert.equal(boardAwaiting({}), false, "nothing sent");
  assert.equal(boardAwaiting({ sentAt, updatedAt: "2026-10-10T04:50:13.000Z" }), true, "no post since the click");
  assert.equal(boardAwaiting({ sentAt, updatedAt: null }), true, "no post at all");
  assert.equal(boardAwaiting({ sentAt, updatedAt: "2026-10-10T05:15:31.000Z" }), true, "a post at the same moment is not after it");
  assert.equal(boardAwaiting({ sentAt, updatedAt: "2026-10-10T05:15:51.000Z" }), false, "the agent posted: the board is theirs again");
  assert.equal(boardAwaiting({ cardsAwaiting: 1 }), true, "a card send the agent has not settled");
  assert.equal(boardAwaiting({ sentAt, updatedAt: "2026-10-10T05:15:51.000Z", cardsAwaiting: 2 }), true);
  assert.equal(boardAwaiting({ sentAt, cardsAwaiting: 1, adrift: true }), false, "an agent gone quiet releases the lock");

  // gitMode, gitLocked and the click's gitSentAt are page tests now (the board
  // stays locked in test-web-console-page-git.mjs); what feeds them is here.
  const selectors = fs.readFileSync(new URL("../src/web-console/public/selectors.js", import.meta.url), "utf8");
  assert.match(selectors, /sentAt: page\.local\.gitSentAt[\s\S]{0,80}updatedAt: page\.S\.updatedAt[\s\S]{0,80}cardsAwaiting: awaitingReply\(\)\.length/);
});

/* ------------------------------------------- the git board's pure helpers */

// A state.git snapshot as git-repo.mjs snapshot() writes it: a clean
// feature branch, pushed, on a GitHub remote. Each test overrides what it needs.
const at = (h) => new Date(Date.UTC(2026, 9, 9, h)).toISOString();
const row = (name, extra = {}) => ({
  name,
  current: false,
  default: false,
  remote: null,
  upstream: `origin/${name}`,
  upstreamRemote: "origin",
  ahead: 0,
  behind: 0,
  gone: false,
  merged: false,
  last: { subject: `work on ${name}`, author: "T", at: at(1) },
  ...extra,
});
const remoteRow = (name, h, remote = "origin") =>
  row(name, { remote, upstream: null, upstreamRemote: null, ahead: null, behind: null, last: { subject: `remote ${name}`, author: "R", at: at(h) } });
function snap(over = {}) {
  return {
    at: at(12),
    repo: true,
    hasCommits: true,
    head: { branch: "feature/x", detached: null, upstream: "origin/feature/x", ahead: 0, behind: 0 },
    defaultBranch: "main",
    inProgress: null,
    conflicted: [],
    changes: { count: 0, heldBack: 0, files: [], untrackedDirs: [] },
    remotes: [{ name: "origin", url: "git@github.com:jparkerweb/plan2code.git", host: "github.com", web: "https://github.com/jparkerweb/plan2code", kind: "github" }],
    lastFetch: at(10),
    refreshFailed: false,
    branches: [row("main", { default: true, last: { subject: "m", author: "T", at: at(2) } }), row("feature/x", { current: true })],
    prUrl: null,
    ...over,
  };
}

test("git board: the module's constants", () => {
  assert.deepEqual([...BRANCH_TYPES], ["feature", "fix", "chore", "docs", "refactor", "test"]);
  assert.equal(REMOTE_FOLD, 50);
  assert.equal(UNTRACKED_TICK_LIMIT, 200);
});

test("git board: orderBranches puts current first, default second, locals by date, remote-only apart", () => {
  const branches = [
    row("old", { last: { subject: "o", author: "T", at: at(1) } }),
    row("main", { default: true, last: { subject: "m", author: "T", at: at(0) } }),
    remoteRow("r-old", 2),
    row("new", { last: { subject: "n", author: "T", at: at(5) } }),
    row("feature/x", { current: true, last: { subject: "x", author: "T", at: at(0) } }),
    remoteRow("r-new", 9),
  ];
  const { top, remoteOnly } = orderBranches(branches);
  assert.deepEqual(top.map((b) => b.name), ["feature/x", "main", "new", "old"]);
  assert.deepEqual(remoteOnly.map((b) => b.name), ["r-new", "r-old"]);
  const onMain = orderBranches(branches.map((b) => ({ ...b, current: b.name === "main" })));
  assert.deepEqual(onMain.top.map((b) => b.name), ["main", "new", "old", "feature/x"], "the default is first when it is current");
});

test("git board: foldRemote folds past 50, showAll and a query open it", () => {
  const rows = Array.from({ length: 60 }, (_, i) => remoteRow(`r${i}`, i % 24));
  const folded = foldRemote(rows);
  assert.equal(folded.shown.length, 50);
  assert.equal(folded.hidden, 10);
  assert.equal(folded.open, false);
  assert.equal(foldRemote(rows, { showAll: true }).shown.length, 60);
  const searched = foldRemote(rows, { query: "r5" });
  assert.equal(searched.open, true, "a query opens the section");
  assert.deepEqual(searched.shown.map((b) => b.name), ["r5", "r50", "r51", "r52", "r53", "r54", "r55", "r56", "r57", "r58", "r59"]);
  assert.equal(searched.hidden, 0);
});

test("git board: filterBranches matches the name, origin/name and the subject", () => {
  const rows = [row("feature/a"), remoteRow("b-branch", 1), row("c", { last: { subject: "Fix the CSV export", author: "T", at: at(1) } })];
  assert.deepEqual(filterBranches(rows, "FEATURE").map((b) => b.name), ["feature/a"]);
  assert.deepEqual(filterBranches(rows, "origin/b-").map((b) => b.name), ["b-branch"]);
  assert.deepEqual(filterBranches(rows, "csv export").map((b) => b.name), ["c"]);
  assert.equal(filterBranches(rows, "  ").length, 3);
});

test("git board: composeBranchName builds <type>/<desc>", () => {
  assert.equal(composeBranchName({ type: "feature", description: "Export CSV!" }), "feature/export-csv");
  assert.equal(composeBranchName({ type: "fix", description: "  Null check  " }), "fix/null-check");
  assert.equal(composeBranchName({ type: "fix", description: "" }), "");
  assert.equal(composeBranchName({ type: "fix", ticket: "ABC-1", description: "x" }), "fix/x", "a ticket is ignored");
});

test("git board: nameStatus names each kind", () => {
  const git = snap({ branches: [row("main", { default: true }), row("feature/x", { current: true }), row("team"), remoteRow("theirs", 1)] });
  assert.equal(nameStatus("", git).kind, "empty");
  for (const bad of ["-x", "a..b", "a@{b", "a\b", "a b", "a~b", "a^b", "a:b", "a?b", "a*b", "a[b", "a\u0001b", "a/.b", "a.lock", "a/", "a."]) {
    const st = nameStatus(bad, git);
    assert.equal(st.kind, "invalid", bad);
    assert.ok(st.reason, `a reason for ${bad}`);
  }
  assert.deepEqual(nameStatus("main", git), { kind: "local", branch: "main" });
  assert.deepEqual(nameStatus("theirs", git), { kind: "remote", remote: "origin", branch: "theirs" });
  assert.deepEqual(nameStatus("origin/theirs", git), { kind: "remote", remote: "origin", branch: "theirs" }, "typed the way the board shows it");
  assert.deepEqual(nameStatus("team/one", git), { kind: "nested", clash: "team" });
  assert.deepEqual(nameStatus("feature", git), { kind: "nested", clash: "feature/x" });
  assert.deepEqual(nameStatus("feature/y", git), { kind: "free" });
});

test("git board: boardActions for each repo state", () => {
  const shown = (acts) => Object.keys(acts).filter((k) => acts[k].shown);
  const clean = boardActions(snap());
  assert.deepEqual(shown(clean), ["refresh", "pull", "push", "done"]);
  assert.equal(clean.push.enabled, false, "nothing to push");
  assert.equal(clean.pull.enabled, true);

  const dirty = boardActions(snap({ changes: { count: 4, heldBack: 1, files: [], untrackedDirs: [] } }));
  assert.equal(dirty.commit.label, "Commit 4 files · 1 held back");
  assert.equal(boardActions(snap({ changes: { count: 2, heldBack: 0, files: [], untrackedDirs: [] } })).commit.label, "Commit 2 files");

  const ahead = boardActions(snap({ head: { branch: "feature/x", detached: null, upstream: "origin/feature/x", ahead: 3, behind: 0 } }));
  assert.equal(ahead.push.label, "Push · 3 to push");
  assert.equal(ahead.push.enabled, true);

  const behind = boardActions(snap({ head: { branch: "feature/x", detached: null, upstream: "origin/feature/x", ahead: 0, behind: 2 } }));
  assert.equal(behind.pull.enabled, true);
  assert.equal(behind.push.enabled, false);

  const unpublished = boardActions(snap({ head: { branch: "feature/x", detached: null, upstream: null, ahead: null, behind: null } }));
  assert.equal(unpublished.push.shown, false);
  assert.equal(unpublished.publish.shown, true);
  assert.equal(unpublished.publish.enabled, true);

  const detached = boardActions(snap({ head: { branch: null, detached: "abc1234", upstream: null, ahead: null, behind: null } }));
  assert.equal(detached.pull.enabled, false);
  assert.equal(detached.push.enabled, false);
  assert.equal(detached.publish.enabled, false);

  const noRemote = boardActions(snap({ remotes: [] }));
  for (const k of ["pull", "push", "publish"]) assert.equal(noRemote[k].shown, false, k);
  assert.equal(noRemote.refresh.shown, true, "Refresh re-reads the folder even with nothing to fetch");

  const empty = boardActions(snap({ hasCommits: false, changes: { count: 2, heldBack: 0, files: [], untrackedDirs: [] } }));
  assert.deepEqual(shown(empty), ["refresh", "commit", "done"], "before the first commit too, Refresh is how outside edits reach the board");
  assert.equal(empty.commit.label, "Make the first commit");

  const rebasing = boardActions(snap({ inProgress: "rebase", changes: { count: 2, heldBack: 0, files: [], untrackedDirs: [] } }));
  assert.deepEqual(shown(rebasing), ["done"]);

  const sweepable = snap({ branches: [...snap().branches, row("old", { merged: true })] });
  assert.equal(boardActions(sweepable).cleanup.shown, true);
  assert.equal(boardActions({ ...sweepable, defaultBranch: null }).cleanup.shown, false, "no default branch, no Clean up");

  const busy = boardActions(snap({ changes: { count: 1, heldBack: 0, files: [], untrackedDirs: [] } }), { busy: true });
  for (const k of ["refresh", "pull", "push", "commit"]) assert.equal(busy[k].enabled, false, k);
  assert.equal(busy.done.enabled, true, "Done is never locked");
});

test("git board: gitReply reads as a terminal instruction for every op", () => {
  const cases = [
    ["refresh", {}, "Refresh."],
    ["pull", {}, "Pull."],
    ["push", {}, "Push."],
    ["publish", { remote: "origin" }, "Publish to origin."],
    ["publish", {}, "Publish."],
    ["switch", { branch: "main" }, "Switch to main."],
    ["create", { name: "feature/ABC-1-x", from: "origin/main" }, "Create feature/ABC-1-x from origin/main."],
    ["delete", { branch: "old-branch" }, "Delete old-branch."],
    ["cleanup", { branches: ["a", "b", "c"] }, "Clean up 3 branches: a, b, c."],
    ["commit", { files: ["a.js", "b.js", "c.js", "d/"] }, "Commit these 4 files: a.js, b.js, c.js, d/."],
    ["abort", { operation: "rebase" }, "Abort the rebase."],
    ["continue", { operation: "rebase" }, "Continue the rebase."],
    ["pr-host", { host: "git.example.com", kind: "gitlab" }, "This host is GitLab."],
    ["done", {}, "I'm done."],
  ];
  for (const [op, fields, want] of cases) {
    const got = gitReply(op, fields);
    assert.equal(got, want, op);
    assert.doesNotMatch(got, /\b(brief|recap|minutes)\b/i, op);
  }
  assert.match(gitReply("create", { name: "f/x", from: "main", then: "commit", files: ["a.js"] }), /Then commit this file: a\.js\./);
  assert.match(gitReply("commit", { files: ["a.js"], ignore: ["dist/"] }), /Add dist\/ to \.gitignore\./);
  assert.equal(
    gitReply("create", { name: "f/x", from: "main", then: "commit", files: ["a.js"], ignore: ["dist/"] }),
    "Create f/x from main. Then commit this file: a.js. Add dist/ to .gitignore.",
    "a commit through a new branch keeps its .gitignore picks"
  );
});

test("git board: refreshedLine says never, or how long ago and whether it failed", () => {
  assert.equal(refreshedLine(snap({ lastFetch: null })), "Never refreshed");
  const now = Date.parse(at(12));
  assert.equal(refreshedLine(snap({ lastFetch: at(10) }), now), "Last refreshed 2 hr. ago");
  assert.equal(refreshedLine(snap({ lastFetch: at(10), refreshFailed: true }), now), "Last refreshed 2 hr. ago · refresh failed");
  assert.equal(refreshedLine(snap({ lastFetch: null, refreshFailed: true })), "Never refreshed · refresh failed");
});

test("git board: commitTicks ticks the staged set, else all but risky files and big folders", () => {
  const files = [
    { path: "a.js", state: "modified", risky: false, staged: false },
    { path: ".env", state: "untracked", risky: true, staged: false },
  ];
  const dirs = [
    { path: "big/", files: 250 },
    { path: "small/", files: 10 },
  ];
  assert.deepEqual([...commitTicks({ files, untrackedDirs: dirs })].sort(), ["a.js", "small/"]);
  const staged = [...files, { path: "b.js", state: "modified", risky: false, staged: true }];
  assert.deepEqual([...commitTicks({ files: staged, untrackedDirs: dirs })], ["b.js"], "only what is staged");
});

test("git board: boardPrLink builds the link for a pushed feature branch only", () => {
  const link = boardPrLink(snap(), "main");
  assert.equal(link.url, "https://github.com/jparkerweb/plan2code/compare/main...feature/x?quick_pull=1");
  assert.equal(link.url, prUrl(snap().remotes[0], { base: "main", head: "feature/x" }));
  assert.equal(link.needsKind, false);
  assert.equal(
    boardPrLink(snap(), "release").url,
    "https://github.com/jparkerweb/plan2code/compare/release...feature/x?quick_pull=1",
    "the base picker rebuilds it"
  );
  const onMain = snap({ branches: [row("main", { default: true, current: true })] });
  assert.equal(boardPrLink(onMain, "main"), null, "no link from the default branch");
  const unknown = snap({
    remotes: [{ name: "origin", url: "git@git.example.com:a/b.git", host: "git.example.com", web: "https://git.example.com/a/b", kind: null }],
  });
  assert.deepEqual(boardPrLink(unknown, "main"), { url: null, needsKind: true, host: "git.example.com" });
});

test("git board: the page draws it from git-board.js, with no inline styles", () => {
  const dir = path.join(path.dirname(CONSOLE_CLI), "public");
  const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
  const view = fs.readFileSync(path.join(dir, "git-board-view.js"), "utf8");
  for (const m of ["git-board.js", "git-board-view.js", "pr-url.js"]) assert.ok(html.includes(`rel="modulepreload" href="/${m}"`), `the page preloads ${m}`);
  const selectors = fs.readFileSync(path.join(dir, "selectors.js"), "utf8");
  assert.match(selectors, /const isGitBoard = \(\) => page\.S && page\.S\.workflow === "git" && page\.S\.git;/);
  assert.match(view, /a\.rel = "noopener"/, "the PR link opens with rel=noopener");
  assert.doesNotMatch(view, /setAttribute\(\s*["']style["']|\.style\./, "nor does its view");
});

// The board's every click is one `__git` action; the agent reads it off the
// same result channel every other send uses. The field names the contract
// pins (notes/git.md) have to survive the trip verbatim.
test("git: a board action round-trips as one __git action with its fields intact", async () => {
  const r = gitBoardRepo("git-action-rt");
  try {
    const opened = r.open("--workflow", "git").json;
    const s = sessionUrl(opened.url);
    const post = (body) =>
      fetch(`${s.base}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: s.cookie, connection: "close" },
        body: JSON.stringify(body),
      });
    assert.equal(
      (await post({ actions: [{ i: "__git", type: "git", op: "switch", branch: "main" }], reply: "Switch to main." })).status,
      200
    );
    const res = r.cli(["wait", "--session", opened.sid, "--seconds", "10"]);
    assert.equal(res.status, 0);
    assert.deepEqual(res.json.actions, [{ i: "__git", type: "git", op: "switch", branch: "main" }]);
    assert.equal(res.json.reply, "Switch to main.");
    const state = readState(opened.session);
    assert.ok(state.items.every((i) => i.id !== "__git"), "a board action must not become a question");
    r.cli(["stop", "--session", opened.sid]);
  } finally {
    r.cleanup();
  }
});

// `{ board: { describe } }` is the agent's way to pre-fill the Create panel's
// description; it lands through applyPatch's open key like `scan` does.
test("git: a board.describe post lands in state for the Create panel to read", async () => {
  const r = gitBoardRepo("git-board-describe");
  try {
    const opened = r.open("--workflow", "git").json;
    r.cli(["post", "--session", opened.sid, "--file", payload("board-describe.json", { board: { describe: "retry the push" } })]);
    assert.equal(readState(opened.session).board.describe, "retry the push");
    r.cli(["stop", "--session", opened.sid]);
  } finally {
    r.cleanup();
  }
});
