// Web console tests: the Implementation Loop's console side. Run with:
//   node --test scripts/test-web-console-loop.mjs
//
// Three groups, one per piece of the contract (src/web-console/notes/loop.md):
//   1. the `open --loop` gate and the lock it stamps on a session,
//   2. the `loopOutcome`, `loopEnd` and `handledBy` rules of the patch validator,
//   3. the `loop-setup.json` store and its `/loop-setup` route.
//
// Shared setup (a per-process console home, the CLI runner, fixtures) lives in
// web-console-test-helpers.mjs. Every child process here gets an explicit
// environment with the desktop app's variables removed, so a test run from
// inside the app behaves as one run from a terminal.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { applyPatch, blankState, validate, switchWorkflow } from "../src/web-console/patches.mjs";
import { ROOT, CONSOLE_CLI, ENV, HOME, MODELS_DIR, cli, readState, sessionUrl, payload } from "./web-console-test-helpers.mjs";

const APP_VARS = ["PLAN2CODE_IN_APP", "PLAN2CODE_EMBED_ORIGIN", "PLAN2CODE_APP_ANNOUNCE", "PLAN2CODE_APP_TOKEN", "PLAN2CODE_CONSOLE_SID"];

// The console CLI with the app's variables gone, plus whatever `extra` sets.
function run(args, { cwd = ROOT, extra = {} } = {}) {
  const env = { ...ENV };
  for (const key of APP_VARS) delete env[key];
  const res = spawnSync(process.execPath, [CONSOLE_CLI, ...args], { env: { ...env, ...extra }, encoding: "utf8", cwd });
  const line = String(res.stdout).trim().split("\n").filter((l) => l.startsWith("{")).pop();
  let json = null;
  try {
    json = line ? JSON.parse(line) : null;
  } catch {}
  return { status: res.status, stderr: String(res.stderr), stdout: String(res.stdout), json };
}

const IN_APP = { PLAN2CODE_IN_APP: "1" };

const tempProject = (name) => fs.mkdtempSync(path.join(HOME, `${name}-`));
const sessionsDir = path.join(HOME, "sessions");
const sessionCount = () => (fs.existsSync(sessionsDir) ? fs.readdirSync(sessionsDir).length : 0);

// Opens a session in a fresh project; the caller stops it.
function openLoop(workflow = "implement", name = "loop") {
  const cwd = tempProject(name);
  const res = run(["open", "--workflow", workflow, "--loop", "--no-open"], { cwd, extra: IN_APP });
  assert.equal(res.status, 0, res.stderr);
  const stop = () => cli(["stop", "--session", res.json.sid, "--force"], { cwd, expectFail: true });
  return { cwd, sid: res.json.sid, session: res.json.session, url: res.json.url, stop };
}

const post = (s, obj) => run(["post", "--session", s.sid, "--file", payload(`loop-post-${Date.now()}-${Math.random().toString(16).slice(2)}.json`, obj)], { cwd: s.cwd });

/* ---------------------------------------------------------- 7.5: the gate */

test("open --loop is refused with one line and exit 3 when the desktop app's signal is unset", () => {
  const cwd = tempProject("gate-off");
  const before = sessionCount();
  for (const extra of [{}, { PLAN2CODE_IN_APP: "0" }]) {
    const res = run(["open", "--workflow", "implement", "--loop", "--no-open"], { cwd, extra });
    assert.equal(res.status, 3, `exit 3 with ${JSON.stringify(extra)}`);
    assert.equal(res.stderr.trim().split("\n").length, 1, "a one-line reason");
    assert.match(res.stderr, /Loop mode runs only inside the Plan2Code desktop app\./);
    assert.equal(res.stdout.trim(), "", "nothing is printed on stdout");
  }
  assert.equal(sessionCount(), before, "no session folder was made");
});

test("open --loop under the app locks the session: loop { driving: true } in state.json", () => {
  for (const workflow of ["implement", "implement-review"]) {
    const s = openLoop(workflow, `gate-on-${workflow}`);
    try {
      const state = readState(s.session);
      assert.deepEqual(state.loop, { driving: true });
      assert.equal(state.workflow, workflow);
      assert.equal("loopOutcome" in state, false);
      assert.equal("loopEnd" in state, false);
    } finally {
      s.stop();
    }
  }
});

test("open --loop goes only with Implement or Implement + Review: any other workflow, or none, exits 2", () => {
  const cwd = tempProject("gate-wf");
  const before = sessionCount();
  for (const args of [["--workflow", "plan"], ["--workflow", "dashboard"], []]) {
    const res = run(["open", ...args, "--loop", "--no-open"], { cwd, extra: IN_APP });
    assert.equal(res.status, 2, `exit 2 for ${args.join(" ") || "no workflow"}`);
    assert.match(res.stderr, /--loop goes only with --workflow implement or --workflow implement-review/);
  }
  assert.equal(sessionCount(), before, "no session folder was made");
});

test("a later open --resume without --loop clears the lock and the loop's cards; --loop locks it again", () => {
  const s = openLoop("implement", "resume");
  try {
    const card = {
      id: "fixes",
      kind: "multi",
      title: "Which to fix",
      options: [{ k: "1", text: "One" }, { k: "2", text: "Two" }],
      status: "answered",
      answer: { ks: ["1"] },
      handledBy: "loop",
    };
    const posted = post(s, { items: [card] });
    assert.equal(posted.status, 0, posted.stderr);
    assert.equal(readState(s.session).items[0].handledBy, "loop");

    const stamped = post(s, { loopExpect: { review: true, fix: "smart", guess: true } });
    assert.equal(stamped.status, 0, stamped.stderr);

    const plain = run(["open", "--resume", s.sid, "--no-open"], { cwd: s.cwd });
    assert.equal(plain.status, 0, plain.stderr);
    const unlocked = readState(s.session);
    assert.equal("loop" in unlocked, false, "the lock is gone");
    assert.equal("loopExpect" in unlocked, false, "the criteria go with the lock");
    assert.equal(unlocked.items.length, 1, "the card stays as a record");
    assert.equal("handledBy" in unlocked.items[0], false, "but it is no longer the loop's");
    assert.equal(post(s, { agent: { status: "waiting" } }).status, 0, "the unlocked session takes an ordinary post");

    const again = run(["open", "--resume", s.sid, "--workflow", "implement", "--loop", "--no-open"], { cwd: s.cwd, extra: IN_APP });
    assert.equal(again.status, 0, again.stderr);
    assert.deepEqual(readState(s.session).loop, { driving: true });

    const restamped = post(s, { loopExpect: { review: false, fix: [], guess: true } });
    assert.equal(restamped.status, 0, restamped.stderr);
    assert.deepEqual(readState(s.session).loopExpect, { review: false, fix: [], guess: true }, "a re-locked session takes a fresh stamp");
  } finally {
    s.stop();
  }
});

/* ------------------------------------- 7.6: loopOutcome, loopEnd, handledBy */

// A loop session's state, with the patch applied as `post` would: applyPatch
// may throw (who may send it, how often), then validate() lists the rest.
const loopState = (extra = {}) => ({ ...blankState({ sid: "s", workflow: "implement", project: "p" }), loop: { driving: true }, ...extra });
function tryPatch(state, patch) {
  let next;
  try {
    next = applyPatch(state, patch);
  } catch (e) {
    return { next: null, problems: [e.message] };
  }
  return { next, problems: validate(next) };
}

const goodOutcome = () => ({
  phase: 2,
  result: "passed",
  reason: null,
  summary: "Built the setup screen; 6 of 6 tasks",
  tests: { ran: true, passed: true, summary: "14 pass" },
  review: {
    ran: true,
    recheck: true,
    left: { critical: 0, warning: 0, suggestion: 2 },
    fixed: [{ level: "warning", title: "Close the file handle", file: "src/z.js" }],
    unfixed: [{ level: "suggestion", title: "Name the timer", file: "src/x.js" }],
  },
  tasks: { blocked: [], assumed: ["2.4"] },
  conflicts: [],
  decisions: ["Kept the old route so existing callers still work"],
  subject: "Add the loop setup screen",
});
const withTriage = (skipped) => {
  const o = goodOutcome();
  o.review.triage = { ran: true, skipped };
  return o;
};
const skip = (extra = {}) => ({ level: "warning", title: "Rename the helper", file: "src/y.js", reason: "Outside this phase's tasks", ...extra });

test("a valid loopOutcome is stored in a loop session, with and without a triage block", () => {
  const plain = tryPatch(loopState(), { loopOutcome: goodOutcome() });
  assert.deepEqual(plain.problems, []);
  assert.deepEqual(plain.next.loopOutcome, goodOutcome());

  const triaged = tryPatch(loopState(), { loopOutcome: withTriage([skip(), skip({ level: "suggestion", title: "Name the timer" })]) });
  assert.deepEqual(triaged.problems, []);
  assert.equal(triaged.next.loopOutcome.review.triage.skipped.length, 2);

  const empty = tryPatch(loopState(), { loopOutcome: withTriage([]) });
  assert.deepEqual(empty.problems, [], "a triage that skipped nothing is a valid, empty list");

  const failed = goodOutcome();
  Object.assign(failed, { result: "failed", reason: "tests" });
  assert.deepEqual(tryPatch(loopState(), { loopOutcome: failed }).problems, [], "a failed outcome carries a reason");
});

test("each bad loopOutcome field is refused with a message naming it", () => {
  const cases = [
    ["a bad result", (o) => (o.result = "done"), /loopOutcome\.result must be/],
    ["a reason on a passed outcome", (o) => (o.reason = "tests"), /loopOutcome\.reason must be null when the phase passed/],
    ["a failed outcome with no reason", (o) => Object.assign(o, { result: "failed", reason: null }), /loopOutcome\.reason must be one of/],
    ["a failed outcome with an unknown reason", (o) => Object.assign(o, { result: "failed", reason: "sulking" }), /loopOutcome\.reason must be one of/],
    ["a negative left.warning", (o) => (o.review.left.warning = -1), /loopOutcome\.review\.left\.warning must be a non-negative integer/],
    ["a fractional left.critical", (o) => (o.review.left.critical = 1.5), /loopOutcome\.review\.left\.critical must be a non-negative integer/],
    [
      "51 unfixed entries",
      (o) => (o.review.unfixed = Array.from({ length: 51 }, (_, i) => ({ level: "suggestion", title: `Finding ${i}` }))),
      /loopOutcome\.review\.unfixed can hold at most 50 entries/,
    ],
    ["no fixed list", (o) => delete o.review.fixed, /loopOutcome\.review\.fixed must be an array/],
    ["a fixed entry at an unknown level", (o) => (o.review.fixed[0].level = "nit"), /loopOutcome\.review\.fixed\[0\]\.level must be one of/],
    ["a fixed entry with no title", (o) => (o.review.fixed[0].title = " "), /loopOutcome\.review\.fixed\[0\]\.title must be a non-empty one-line string/],
    ["51 fixed entries", (o) => (o.review.fixed = Array.from({ length: 51 }, (_, i) => ({ level: "suggestion", title: `Finding ${i}` }))), /loopOutcome\.review\.fixed can hold at most 50 entries/],
    ["no decisions list", (o) => delete o.decisions, /loopOutcome\.decisions must be an array/],
    ["a two-line decision", (o) => (o.decisions = ["one\ntwo"]), /loopOutcome\.decisions\[0\] must be one line of 1 to 200 characters/],
    ["a 201-character decision", (o) => (o.decisions = ["x".repeat(201)]), /loopOutcome\.decisions\[0\] must be one line/],
    ["51 decisions", (o) => (o.decisions = Array.from({ length: 51 }, (_, i) => `Decision ${i}`)), /loopOutcome\.decisions can hold at most 50 entries/],
    ["an unfixed entry at an unknown level", (o) => (o.review.unfixed[0].level = "nit"), /loopOutcome\.review\.unfixed\[0\]\.level must be one of/],
    ["a two-line subject", (o) => (o.subject = "Add the screen\nand more"), /loopOutcome\.subject must be one line of 1 to 100 characters/],
    ["a 101-character subject", (o) => (o.subject = "a".repeat(101)), /loopOutcome\.subject must be one line of 1 to 100 characters/],
    ["an empty subject", (o) => (o.subject = ""), /loopOutcome\.subject must be one line/],
    ["a forbidden completion marker in the summary", (o) => (o.summary = "All done, PHASE_COMPLETE"), /loopOutcome\.summary: contains a loop completion marker \(PHASE_COMPLETE\)/],
    ["a task id that is not like 2.4", (o) => (o.tasks.assumed = ["two"]), /loopOutcome\.tasks\.assumed must be an array of task ids/],
    ["a missing tests object", (o) => delete o.tests, /loopOutcome\.tests must be an object/],
    ["a non-integer phase", (o) => (o.phase = 0), /loopOutcome\.phase must be a positive integer/],
    ["a triage skip at a bad level", (o) => (o.review.triage = { ran: true, skipped: [skip({ level: "major" })] }), /loopOutcome\.review\.triage\.skipped\[0\]\.level must be one of/],
    ["a triage skip with no reason", (o) => (o.review.triage = { ran: true, skipped: [skip({ reason: undefined })] }), /loopOutcome\.review\.triage\.skipped\[0\]\.reason must be one line of 1 to 200/],
    ["a 201-character triage reason", (o) => (o.review.triage = { ran: true, skipped: [skip({ reason: "r".repeat(201) })] }), /loopOutcome\.review\.triage\.skipped\[0\]\.reason must be one line of 1 to 200/],
    [
      "51 triage skips",
      (o) => (o.review.triage = { ran: true, skipped: Array.from({ length: 51 }, (_, i) => skip({ title: `Finding ${i}` })) }),
      /loopOutcome\.review\.triage\.skipped can hold at most 50 entries/,
    ],
    ["a triage with no ran flag", (o) => (o.review.triage = { skipped: [] }), /loopOutcome\.review\.triage\.ran must be true or false/],
    ["a triage that is not an object", (o) => (o.review.triage = "yes"), /loopOutcome\.review\.triage must be an object/],
  ];
  for (const [what, mutate, expected] of cases) {
    const outcome = goodOutcome();
    mutate(outcome);
    const { problems } = tryPatch(loopState(), { loopOutcome: outcome });
    assert.ok(problems.some((p) => expected.test(p)), `${what}: expected ${expected}, got ${JSON.stringify(problems)}`);
  }

  // The boundaries themselves are fine.
  const edge = goodOutcome();
  edge.subject = "a".repeat(100);
  edge.review.unfixed = Array.from({ length: 50 }, (_, i) => ({ level: "suggestion", title: `Finding ${i}` }));
  edge.review.triage = { ran: true, skipped: Array.from({ length: 50 }, (_, i) => skip({ title: `Finding ${i}`, reason: "r".repeat(200) })) };
  assert.deepEqual(tryPatch(loopState(), { loopOutcome: edge }).problems, [], "100 characters, 50 entries and 200 characters are the limits, not over them");
});

test("an unfixed finding's title and file are one line, as in the fixed and skipped lists", () => {
  const o = goodOutcome();
  o.review.unfixed = [{ level: "suggestion", title: "Name\nthe timer", file: "src/x.js\nsrc/y.js" }];
  const problems = tryPatch(loopState(), { loopOutcome: o }).problems.join("\n");
  assert.match(problems, /review\.unfixed\[0\]\.title must be a non-empty one-line string/);
  assert.match(problems, /review\.unfixed\[0\]\.file must be a one-line string when present/);
});

test("loopOutcome is refused outside a loop session and a second time", () => {
  const unlocked = loopState();
  delete unlocked.loop;
  assert.match(tryPatch(unlocked, { loopOutcome: goodOutcome() }).problems.join("\n"), /loopOutcome: is only accepted in a loop session/);
  assert.match(tryPatch(unlocked, { loopOutcome: goodOutcome() }).problems.join("\n"), /--workflow <yours> --loop, then post this again/, "the refusal says how to lock the session again");

  const first = tryPatch(loopState(), { loopOutcome: goodOutcome() });
  assert.deepEqual(first.problems, []);
  const second = tryPatch(first.next, { loopOutcome: goodOutcome() });
  assert.match(second.problems.join("\n"), /loopOutcome: was already posted for this session/);
  assert.deepEqual(tryPatch(first.next, { agent: { status: "waiting" } }).problems, [], "the stored outcome does not block later posts");

  assert.match(tryPatch(loopState(), { loop: { driving: true } }).problems.join("\n"), /loop: is set by open --loop, not by a patch/, "a patch cannot lock a session itself");
});

test("a loopOutcome through post is stored in state.json, and refused with exit 3 and the field named", () => {
  const s = openLoop("implement-review", "outcome-post");
  try {
    const bad = goodOutcome();
    bad.subject = "a".repeat(101);
    const refused = post(s, { loopOutcome: bad });
    assert.equal(refused.status, 3);
    assert.match(refused.stderr, /loopOutcome\.subject must be one line of 1 to 100 characters/);
    assert.equal("loopOutcome" in readState(s.session), false, "nothing was written");

    const stored = post(s, { loopOutcome: withTriage([skip()]) });
    assert.equal(stored.status, 0, stored.stderr);
    assert.deepEqual(readState(s.session).loopOutcome, withTriage([skip()]));

    const again = post(s, { loopOutcome: goodOutcome() });
    assert.equal(again.status, 3);
    assert.match(again.stderr, /already posted/);
  } finally {
    s.stop();
  }
});

test("a loopOutcome through post is refused outside a loop session", () => {
  const cwd = tempProject("outcome-plain");
  const opened = run(["open", "--workflow", "implement", "--no-open"], { cwd });
  assert.equal(opened.status, 0, opened.stderr);
  try {
    const res = post({ sid: opened.json.sid, cwd }, { loopOutcome: goodOutcome() });
    assert.equal(res.status, 3);
    assert.match(res.stderr, /loopOutcome: is only accepted in a loop session/);
  } finally {
    cli(["stop", "--session", opened.json.sid, "--force"], { cwd, expectFail: true });
  }
});

/* --------------------------------------------------------- loopExpect */

const expectSmart = (extra = {}) => ({ review: true, fix: "smart", guess: true, ...extra });
const withExpect = (stamp, extra = {}) => loopState({ loopExpect: stamp, ...extra });

test("loopExpect: the app stamps its criteria into a loop session, refused elsewhere and after the report", () => {
  const stored = tryPatch(loopState(), { loopExpect: expectSmart() });
  assert.deepEqual(stored.problems, []);
  assert.deepEqual(stored.next.loopExpect, expectSmart());

  const unlocked = loopState();
  delete unlocked.loop;
  assert.match(tryPatch(unlocked, { loopExpect: expectSmart() }).problems.join("\n"), /loopExpect: is only accepted in a loop session/);

  const reported = tryPatch(loopState(), { loopOutcome: withTriage([skip()]) });
  assert.match(tryPatch(reported.next, { loopExpect: expectSmart() }).problems.join("\n"), /loopExpect: came after the run's report/);

  const second = tryPatch(stored.next, { loopExpect: expectSmart({ guess: false }) });
  assert.match(second.problems.join("\n"), /loopExpect: was already stamped for this session/, "one stamp per session, from anyone");

  // A corrupt stored stamp is replaceable, not a wedge; and a hop drops it.
  const corrupt = loopState({ loopExpect: 5 });
  assert.deepEqual(tryPatch(corrupt, { loopExpect: expectSmart() }).problems, [], "a non-object stamp is overwritten");
  const corruptObj = loopState({ loopExpect: { review: "yes" } });
  assert.deepEqual(tryPatch(corruptObj, { loopExpect: expectSmart() }).problems, [], "a malformed object stamp is overwritten too");
  const hopped = switchWorkflow(stored.next, { workflow: "implement" });
  assert.equal("loopExpect" in hopped, false, "a hop drops the stamp");
});

test("a null patch cannot delete the loop's report fields", () => {
  for (const key of ["loopExpect", "loopOutcome", "loopEnd"]) {
    const { problems } = tryPatch(loopState(), { [key]: null });
    assert.ok(problems.some((p) => p.includes(`${key}: cannot be deleted by a patch`)), `${key}: got ${JSON.stringify(problems)}`);
  }
  assert.deepEqual(tryPatch(loopState(), { agent: null }).problems, [], "ordinary fields still delete");
});

test("a failed outcome is never held to the loopExpect: the driver judges criteria on passed only", () => {
  const smart = withExpect(expectSmart({ guess: false }));
  const failed = goodOutcome();
  Object.assign(failed, { result: "failed", reason: "blocked" });
  failed.review.ran = false;
  failed.review.recheck = false;
  failed.tests.passed = false;
  assert.deepEqual(tryPatch(smart, { loopOutcome: failed }).problems, [], "a failed report lands with its reason");
});

test("a passed report is held to the loopExpect on leftovers and failed tests, like the driver", () => {
  const levels = withExpect({ review: true, fix: ["critical", "warning"], guess: true });
  const leftCritical = goodOutcome();
  leftCritical.review.left.critical = 2;
  assert.match(tryPatch(levels, { loopOutcome: leftCritical }).problems.join("\n"), /loopOutcome\.review\.left\.critical must be 0/);
  // The unfixed list counts too, not only the counter.
  const unfixedWarning = goodOutcome();
  unfixedWarning.review.unfixed = [{ level: "warning", title: "Still open", file: "src/x.js" }];
  assert.match(tryPatch(levels, { loopOutcome: unfixedWarning }).problems.join("\n"), /loopOutcome\.review\.left\.warning must be 0/);
  // A leftover at a level the loop did not choose is fine.
  const leftSuggestion = goodOutcome();
  leftSuggestion.review.left.suggestion = 3;
  assert.deepEqual(tryPatch(levels, { loopOutcome: leftSuggestion }).problems, [], "suggestions never fail a phase");
  const warningOnly = withExpect({ review: true, fix: ["warning"], guess: true });
  assert.deepEqual(tryPatch(warningOnly, { loopOutcome: leftCritical }).problems, [], "critical left is only refused when chosen");
  // Failed tests on a passed report.
  const failedTests = goodOutcome();
  failedTests.tests.passed = false;
  assert.match(tryPatch(levels, { loopOutcome: failedTests }).problems.join("\n"), /loopOutcome\.tests\.passed must be true on a passed report/);
  const noTests = goodOutcome();
  noTests.tests.ran = false;
  assert.deepEqual(tryPatch(levels, { loopOutcome: noTests }).problems, [], "tests that never ran are not failed tests");
});

test("loopExpect: each bad field is refused with a message naming it", () => {
  const cases = [
    ["not an object", "yes", /loopExpect must be an object/],
    ["review not a boolean", expectSmart({ review: "yes" }), /loopExpect\.review must be true or false/],
    ["fix an unknown word", expectSmart({ fix: "everything" }), /loopExpect\.fix must be "smart" or an array of/],
    ["fix an unknown level", expectSmart({ fix: ["critical", "major"] }), /loopExpect\.fix must be "smart" or an array of/],
    ["guess not a boolean", expectSmart({ guess: 1 }), /loopExpect\.guess must be true or false/],
  ];
  for (const [what, stamp, wanted] of cases) {
    const { problems } = tryPatch(loopState(), { loopExpect: stamp });
    assert.ok(problems.some((p) => wanted.test(p)), `${what}: expected ${wanted}, got ${JSON.stringify(problems)}`);
  }
});

test("a loopOutcome is held to the loopExpect the app stamped", () => {
  const smart = withExpect(expectSmart());
  // The shape that stopped a real phase: a review run with no triage block.
  assert.match(tryPatch(smart, { loopOutcome: goodOutcome() }).problems.join("\n"), /loopOutcome\.review\.triage\.ran must be true: Smart pick/);
  const noTriage = withTriage([]);
  noTriage.review.triage.ran = false;
  assert.match(tryPatch(smart, { loopOutcome: noTriage }).problems.join("\n"), /loopOutcome\.review\.triage\.ran must be true: Smart pick/);
  assert.match(tryPatch(smart, { loopOutcome: withTriage([skip({ level: "critical" })]) }).problems.join("\n"), /loopOutcome\.review\.triage\.skipped must not hold a skipped Critical/);
  const noRecheck = withTriage([skip()]);
  noRecheck.review.recheck = false;
  assert.match(tryPatch(smart, { loopOutcome: noRecheck }).problems.join("\n"), /loopOutcome\.review\.recheck must be true/);
  const noReview = withTriage([skip()]);
  noReview.review.ran = false;
  assert.match(tryPatch(smart, { loopOutcome: noReview }).problems.join("\n"), /loopOutcome\.review\.ran must be true: this loop asked for a review/);
  assert.deepEqual(tryPatch(smart, { loopOutcome: withTriage([skip()]) }).problems, [], "triage ran, a warning skipped, the re-check done");
});

test("the loopExpect checks follow the stamped setup: levels, no review, no guess", () => {
  // Levels: a level list needs the re-check but never a triage block.
  const levels = withExpect({ review: true, fix: ["warning"], guess: true });
  assert.deepEqual(tryPatch(levels, { loopOutcome: goodOutcome() }).problems, [], "a triage block is only a Smart pick need");
  const noRecheck = goodOutcome();
  noRecheck.review.recheck = false;
  assert.match(tryPatch(levels, { loopOutcome: noRecheck }).problems.join("\n"), /loopOutcome\.review\.recheck must be true/);
  // An empty level list means findings are reported, not fixed: no re-check.
  const reportOnly = withExpect({ review: true, fix: [], guess: true });
  assert.deepEqual(tryPatch(reportOnly, { loopOutcome: noRecheck }).problems, []);
  // No review at all: review.ran may be false (a plain Implement).
  const noReview = goodOutcome();
  noReview.review.ran = false;
  const build = withExpect({ review: false, fix: [], guess: true });
  assert.deepEqual(tryPatch(build, { loopOutcome: noReview }).problems, []);
  // Guesses not allowed: an assumed task refuses the report.
  const noGuess = withExpect(expectSmart({ guess: false }));
  assert.match(tryPatch(noGuess, { loopOutcome: withTriage([skip()]) }).problems.join("\n"), /loopOutcome\.tasks\.assumed must be empty: this loop does not allow best guesses/);
  const noneAssumed = withTriage([skip()]);
  noneAssumed.tasks.assumed = [];
  assert.deepEqual(tryPatch(noGuess, { loopOutcome: noneAssumed }).problems, [], "no assumptions, nothing refused");
});

test("a loopExpect through post is stored, and a report that misses it is refused with the field named", () => {
  const s = openLoop("implement-review", "expect-post");
  try {
    const stamped = post(s, { loopExpect: expectSmart() });
    assert.equal(stamped.status, 0, stamped.stderr);
    assert.deepEqual(readState(s.session).loopExpect, expectSmart());

    const refused = post(s, { loopOutcome: goodOutcome() });
    assert.equal(refused.status, 3);
    assert.match(refused.stderr, /loopOutcome\.review\.triage\.ran must be true: Smart pick/);
    assert.equal("loopOutcome" in readState(s.session), false, "the bad report was not written");

    const stored = post(s, { loopOutcome: withTriage([skip()]) });
    assert.equal(stored.status, 0, stored.stderr);
    assert.equal("loopOutcome" in readState(s.session), true, "the corrected report lands");
  } finally {
    s.stop();
  }
});

const goodEnd = (extra = {}) => ({
  kind: "stopped",
  line: "Stopped at phase 2: a Critical finding was skipped",
  phases: [{ n: 1, name: "Setup", commit: "abc1234", unfixed: 0, retries: 0 }],
  uncommitted: ["src/x.js"],
  can: ["resume", "fix", "dashboard"],
  ...extra,
});
const EVIDENCE = { id: "evidence", title: "What happened", blocks: [{ id: "b1", md: "The phase stopped on a skipped Critical." }] };

test("loopEnd: a valid stopped with an evidence doc in the same patch is stored", () => {
  const withDoc = tryPatch(loopState(), { docs: [EVIDENCE], loopEnd: goodEnd({ evidence: "evidence" }) });
  assert.deepEqual(withDoc.problems, []);
  assert.equal(withDoc.next.loopEnd.evidence, "evidence");
  assert.equal(withDoc.next.docs[0].id, "evidence");

  const finished = tryPatch(loopState(), { loopEnd: goodEnd({ kind: "finished", can: ["finalize"] }) });
  assert.deepEqual(finished.problems, [], "evidence is optional");

  const replaced = tryPatch(withDoc.next, { loopEnd: goodEnd({ line: "A later word replaces the earlier" }) });
  assert.deepEqual(replaced.problems, [], "a later loopEnd replaces the earlier");
  assert.equal(replaced.next.loopEnd.line, "A later word replaces the earlier");
});

test("loopEnd: ask is accepted in can, so a stopped loop can offer a question before anything runs", () => {
  const { problems, next } = tryPatch(loopState(), { loopEnd: goodEnd({ can: ["resume", "ask", "fix", "dashboard"] }) });
  assert.deepEqual(problems, []);
  assert.deepEqual(next.loopEnd.can, ["resume", "ask", "fix", "dashboard"]);
});

test("loopEnd: an unknown evidence id, a push in can, and the other bad fields are refused, each named", () => {
  const cases = [
    ["an unknown evidence id", goodEnd({ evidence: "nope" }), /loopEnd\.evidence must be the id of a doc on the page/],
    ["a push in can", goodEnd({ can: ["resume", "push"] }), /loopEnd\.can must be an array with entries from resume, ask, fix, finalize, dashboard/],
    ["a bad kind", goodEnd({ kind: "paused" }), /loopEnd\.kind must be "stopped" or "finished"/],
    ["a two-line line", goodEnd({ line: "one\ntwo" }), /loopEnd\.line must be one line/],
    ["an absolute uncommitted path", goodEnd({ uncommitted: ["/etc/passwd"] }), /loopEnd\.uncommitted must be an array of relative paths/],
    ["an uncommitted path that climbs out", goodEnd({ uncommitted: ["../x"] }), /loopEnd\.uncommitted must be an array of relative paths/],
    ["a bad decision count", goodEnd({ phases: [{ n: 1, name: "Setup", commit: "abc1234", unfixed: 0, retries: 0, assumed: -1 }] }), /loopEnd\.phases\[0\]\.assumed must be a non-negative integer/],
    ["a bad commit hash", goodEnd({ phases: [{ n: 1, name: "Setup", commit: "zzz", unfixed: 0, retries: 0 }] }), /loopEnd\.phases\[0\]\.commit must be a short hex hash or null/],
    ["a forbidden completion marker in line", goodEnd({ line: "TASK_COMPLETE" }), /loopEnd\.line: contains a loop completion marker/],
  ];
  for (const [what, end, expected] of cases) {
    const { problems } = tryPatch(loopState(), { loopEnd: end });
    assert.ok(problems.some((p) => expected.test(p)), `${what}: expected ${expected}, got ${JSON.stringify(problems)}`);
  }
});

test("handledBy: \"loop\" is accepted in a loop session and refused outside one or with any other value", () => {
  const card = (extra = {}) => ({
    id: "fixes",
    kind: "multi",
    title: "Which to fix",
    options: [{ k: "1", text: "One" }, { k: "2", text: "Two" }],
    status: "answered",
    answer: { ks: ["1"] },
    handledBy: "loop",
    ...extra,
  });
  const ok = tryPatch(loopState(), { items: [card()] });
  assert.deepEqual(ok.problems, []);
  assert.equal(ok.next.items[0].handledBy, "loop");

  const unlocked = loopState();
  delete unlocked.loop;
  const outside = tryPatch(unlocked, { items: [card()] });
  assert.ok(outside.problems.some((p) => /item "fixes" handledBy: is only valid in a loop session/.test(p)), JSON.stringify(outside.problems));

  const other = tryPatch(loopState(), { items: [card({ handledBy: "app" })] });
  assert.ok(other.problems.some((p) => /item "fixes" handledBy: can only be "loop"/.test(p)), JSON.stringify(other.problems));

  assert.deepEqual(tryPatch(unlocked, { items: [card({ handledBy: undefined })] }).problems, [], "no handledBy is an ordinary card anywhere");
});

/* ------------------------------------ 7.7: the loop-setup.json store, routes */

const LOOP_SETUP_PATH = path.join(HOME, "loop-setup.json");
const LOOP_SETUP_URL = pathToFileURL(path.join(ROOT, "src", "web-console", "loop-setup.mjs")).href;

// Runs `fn(m, args)` in a child process with this file's console home, where m
// is loop-setup.mjs. The module fixes its file at import time from
// PLAN2CODE_CONSOLE_HOME, which this process cannot set early enough. `fn`
// must be self-contained: it is sent as source text. Returns its JSON result.
function inStore(fn, args = {}) {
  const env = { ...ENV };
  for (const key of APP_VARS) delete env[key];
  const code =
    `const m = await import(${JSON.stringify(LOOP_SETUP_URL)});` +
    `const out = await (${fn.toString()})(m, ${JSON.stringify(args)});` +
    "console.log(JSON.stringify(out));";
  const res = spawnSync(process.execPath, ["--input-type=module", "-e", code], { env, encoding: "utf8", cwd: ROOT });
  assert.equal(res.status, 0, res.stderr);
  return JSON.parse(String(res.stdout).trim().split("\n").pop());
}

const projectA = path.join(HOME, "store-project-a");
const projectB = path.join(HOME, "store-project-b");

test("loop-setup: a new project reads as the defaults with remembered false, and nothing is written", () => {
  fs.rmSync(LOOP_SETUP_PATH, { force: true });
  const got = inStore((m, { project }) => ({ setup: m.readLoopSetup(project), defaults: m.LOOP_DEFAULTS }), { project: projectA });
  assert.deepEqual(got.setup, { ...got.defaults, remembered: false });
  assert.equal(got.setup.fixMode, "smart");
  assert.equal(got.setup.onQuestion, "guess");
  assert.deepEqual(got.setup.fix, ["critical", "warning", "suggestion"]);
  assert.equal(got.setup.silenceMinutes, 20);
  assert.equal(got.setup.notifyUrl, "", "no web address is called by default");
  assert.equal(got.setup.notifyKind, "query");
  assert.equal(got.setup.notifyParam, "message");
  assert.equal(fs.existsSync(LOOP_SETUP_PATH), false, "reading never creates the file");
});

test("loop-setup: a save reads back per project, keeps another project's entry, and smart round-trips", () => {
  fs.rmSync(LOOP_SETUP_PATH, { force: true });
  const saved = inStore(
    (m, { a, b }) => {
      const base = { ...m.LOOP_DEFAULTS, fix: [...m.LOOP_DEFAULTS.fix] };
      const forA = { ...base, fixMode: "levels", review: false, fix: ["critical"], onQuestion: "guess", quickCheck: "npm run build", silenceMinutes: 7 };
      const forB = { ...base, fixMode: "smart", afterLast: "run-finalize", retryOnce: false };
      m.saveLoopSetup(a, forA);
      const returnedB = m.saveLoopSetup(b, forB);
      return { forA, forB, returnedB, readA: m.readLoopSetup(a), readB: m.readLoopSetup(b), readC: m.readLoopSetup(a + "-other") };
    },
    { a: projectA, b: projectB }
  );
  // A read also carries the save time.
  const { saved: savedA, ...readA } = saved.readA;
  const { saved: savedB, ...readB } = saved.readB;
  assert.match(savedA, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(savedB, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(readA, { ...saved.forA, remembered: true });
  assert.deepEqual(readB, { ...saved.forB, remembered: true });
  assert.equal(saved.readB.fixMode, "smart", "smart round-trips");
  assert.equal(saved.readA.fixMode, "levels");
  assert.deepEqual(saved.returnedB, saved.readB, "a save returns what a read gives");
  assert.equal(saved.readC.remembered, false, "an unsaved project still reads as new");

  const file = JSON.parse(fs.readFileSync(LOOP_SETUP_PATH, "utf8"));
  assert.equal(file.schema, 1);
  assert.equal(Object.keys(file.projects).length, 2, "one entry per project");
  for (const entry of Object.values(file.projects)) assert.match(entry.saved, /^\d{4}-\d{2}-\d{2}T/);

  // A second save for A replaces A's entry and leaves B's alone.
  const again = inStore(
    (m, { a, b }) => {
      const { saved, remembered, ...entry } = m.readLoopSetup(a);
      m.saveLoopSetup(a, { ...entry, fixMode: "smart" });
      return { a: m.readLoopSetup(a), b: m.readLoopSetup(b) };
    },
    { a: projectA, b: projectB }
  );
  assert.equal(again.a.fixMode, "smart");
  assert.equal(again.a.quickCheck, "npm run build", "the rest of A's entry is as saved");
  assert.deepEqual(again.b, saved.readB, "B is untouched");
});


const WORKSPACE_URL = pathToFileURL(path.join(ROOT, "src", "web-console", "workspace.mjs")).href;

test("loop-setup: an entry saved before fixMode existed reads as levels", () => {
  fs.rmSync(LOOP_SETUP_PATH, { force: true });
  const got = inStore(
    async (m, { project, workspace }) => {
      const fs = await import("node:fs");
      const { foldKey } = await import(workspace);
      const { fixMode, ...legacy } = { ...m.LOOP_DEFAULTS, fix: ["warning"], saved: "2026-01-01T00:00:00.000Z" };
      fs.writeFileSync(m.LOOP_SETUP_FILE, JSON.stringify({ schema: 1, projects: { [foldKey(project)]: legacy } }));
      const stored = JSON.parse(fs.readFileSync(m.LOOP_SETUP_FILE, "utf8")).projects[foldKey(project)];
      return { read: m.readLoopSetup(project), onDisk: "fixMode" in stored };
    },
    { project: projectA, workspace: WORKSPACE_URL }
  );
  assert.equal(got.onDisk, false, "the stored entry has no fixMode");
  assert.equal(got.read.remembered, true);
  assert.equal(got.read.fixMode, "levels", "an older entry keeps fixing by level, not the new default");
  assert.deepEqual(got.read.fix, ["warning"], "the saved fields are kept");
});

test("loop-setup: good web addresses save, with a bad name allowed only while no address is set", () => {
  fs.rmSync(LOOP_SETUP_PATH, { force: true });
  const got = inStore(
    (m, { project }) => {
      const base = { ...m.LOOP_DEFAULTS, fix: [...m.LOOP_DEFAULTS.fix] };
      const good = ["http://example.com", "https://example.com/hook?x=1#top", "HTTPS://EXAMPLE.COM/a%20b", "http://127.0.0.1:8080/"].map((notifyUrl) => m.saveLoopSetup(project, { ...base, notifyUrl, notifyParam: "msg_1.a-b~c" }).notifyUrl);
      const hidden = m.saveLoopSetup(project, { ...base, notifyUrl: "", notifyParam: "a b" });
      const kinds = ["discord", "slack", "teams", "google-chat"].map((notifyKind) => m.saveLoopSetup(project, { ...base, notifyKind, notifyUrl: "https://example.com/x", notifyParam: "a b" }).notifyKind);
      return { good, hidden, kinds };
    },
    { project: projectA }
  );
  assert.equal(got.good.length, 4);
  assert.equal(got.hidden.notifyUrl, "");
  assert.deepEqual(got.kinds, ["discord", "slack", "teams", "google-chat"], "a chat service ignores the hidden name");
});

test("loop-setup: a bad field throws with the problem named and leaves the file unchanged", () => {
  fs.rmSync(LOOP_SETUP_PATH, { force: true });
  const cases = [
    ["silenceMinutes: 0", { silenceMinutes: 0 }, /"silenceMinutes" must be a whole number from 1 to 60/],
    ["silenceMinutes: 61", { silenceMinutes: 61 }, /"silenceMinutes"/],
    ...["example.com", "ftp://example.com", "javascript:alert(1)", "https:/example.com", "https://", "https://me:secret@example.com/", "https://exa mple.com", "https://example.com/é", "https://example.com/\nx", `https://e.com/${"x".repeat(2000)}`].map((notifyUrl) => [`notifyUrl: ${notifyUrl.slice(0, 30)}`, { notifyUrl }, /"notifyUrl" must be an http or https web address/]),
    ["notifyUrl as a number", { notifyUrl: 5 }, /"notifyUrl"/],
    ["notifyKind: carrier-pigeon", { notifyKind: "carrier-pigeon" }, /"notifyKind" must be one of query, discord, slack, teams, google-chat, json/],
    ["a JSON field name with a space", { notifyKind: "json", notifyUrl: "https://example.com/", notifyParam: "a b" }, /"notifyParam"/],
    ...["", "a b", "a=b", "a&b", "a%20b", "é", "x".repeat(65)].map((notifyParam) => [`notifyParam: ${notifyParam.slice(0, 10)}`, { notifyUrl: "https://example.com/", notifyParam }, /"notifyParam" must be 1 to 64 letters/]),
    ["onQuestion: later", { onQuestion: "later" }, /"onQuestion" must be one of pause, stop, guess/],
    ["an unknown key", { surprise: true }, /"surprise" is not a setup field/],
    ["a two-line quickCheck", { quickCheck: "npm run build\nrm -rf x" }, /"quickCheck" must be one line of at most 500 characters/],
    ["a 501-character quickCheck", { quickCheck: "x".repeat(501) }, /"quickCheck"/],
    ["fixMode: sometimes", { fixMode: "sometimes" }, /"fixMode" must be one of levels, smart/],
    ["a repeated fix level", { fix: ["critical", "critical"] }, /"fix" must list distinct levels/],
    ["review as a string", { review: "yes" }, /"review" must be true or false/],
    ["afterLast: never", { afterLast: "never" }, /"afterLast" must be one of offer-finalize, run-finalize/],
  ];

  const attempt = () =>
    inStore(
      (m, { project, list }) =>
        list.map(([what, change]) => {
          try {
            m.saveLoopSetup(project, { ...m.LOOP_DEFAULTS, fix: [...m.LOOP_DEFAULTS.fix], ...change });
            return { what, threw: false };
          } catch (e) {
            return { what, threw: true, message: e.message, problems: e.problems };
          }
        }),
      { project: projectA, list: cases.map(([what, change]) => [what, change]) }
    );
  const check = (results) => {
    for (const [i, [what, , expected]] of cases.entries()) {
      assert.equal(results[i].threw, true, `${what} is refused`);
      assert.match(results[i].message, /^the loop setup is not valid: /);
      assert.match(results[i].message, expected, what);
      assert.ok(Array.isArray(results[i].problems) && results[i].problems.length >= 1);
    }
  };

  // First with no file at all: a refusal must not create one.
  check(attempt());
  assert.equal(fs.existsSync(LOOP_SETUP_PATH), false, "no file was created by a refused save");

  // Then with a good entry on file: the bytes stay as they were.
  inStore((m, { project }) => m.saveLoopSetup(project, { ...m.LOOP_DEFAULTS, fix: ["warning"], quickCheck: "npm run lint" }), { project: projectA });
  const before = fs.readFileSync(LOOP_SETUP_PATH, "utf8");
  check(attempt());
  assert.equal(fs.readFileSync(LOOP_SETUP_PATH, "utf8"), before, "the file is byte for byte unchanged");

  // A non-object and a partial entry are refused too.
  const odd = inStore(
    (m, { project }) =>
      [null, [], "x", { review: true }].map((entry) => {
        try {
          m.saveLoopSetup(project, entry);
          return { threw: false };
        } catch (e) {
          return { threw: true, message: e.message };
        }
      }),
    { project: projectA }
  );
  assert.ok(odd.every((r) => r.threw), "a non-object or a partial entry is refused");
  assert.match(odd[0].message, /must be an object/);
  assert.match(odd[3].message, /"fixMode" must be one of/);
  assert.equal(fs.readFileSync(LOOP_SETUP_PATH, "utf8"), before);
});

test("loop-setup: GET /loop-setup lists the phases left for a spec and refuses anything but specs/<name>", async () => {
  fs.rmSync(LOOP_SETUP_PATH, { force: true });
  const cwd = tempProject("route");
  fs.mkdirSync(path.join(cwd, "specs", "demo"), { recursive: true });
  fs.writeFileSync(
    path.join(cwd, "specs", "demo", "overview.md"),
    [
      "# Demo",
      "",
      "## Phase Checklist",
      "",
      "- [x] **Phase 1:** Setup - [phase-1.md](phase-1.md)",
      "- [ ] **Phase 2:** Build the screen - [phase-2.md](phase-2.md)",
      "- [/] **Phase 3:** Ship it - [phase-3.md](phase-3.md)",
      "- [X] **Phase 4:** Done in capitals - [phase-4.md](phase-4.md)",
      "- [?] **Phase 5:** Assumed done - [phase-5.md](phase-5.md)",
      "- [!] **Phase 6:** Blocked - [phase-6.md](phase-6.md)",
      "",
      "## Notes",
      "",
      "- [ ] Phase 9: not in the checklist",
      "",
    ].join("\n")
  );
  fs.mkdirSync(path.join(cwd, "specs", "empty"), { recursive: true });
  fs.writeFileSync(path.join(cwd, "package.json"), JSON.stringify({ scripts: { build: "tsc", lint: "eslint ." } }));

  const opened = run(["open", "--workflow", "implement", "--no-open"], { cwd });
  assert.equal(opened.status, 0, opened.stderr);
  const { base, cookie } = sessionUrl(opened.json.url);
  const get = async (query) => {
    const res = await fetch(`${base}/loop-setup${query}`, { headers: { cookie, connection: "close" } });
    return { status: res.status, body: await res.json() };
  };
  const send = (body) =>
    fetch(`${base}/loop-setup`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie, origin: base, connection: "close" },
      body: JSON.stringify(body),
    });
  try {
    const bare = await get("");
    assert.equal(bare.status, 200);
    assert.equal(bare.body.remembered, false);
    assert.equal(bare.body.fixMode, "smart");
    assert.equal("phasesLeft" in bare.body, false, "without a spec, only the setup");

    const demo = await get("?spec=specs/demo");
    assert.equal(demo.status, 200);
    // Done as specs.mjs reads it: [x], [X] and [?]. A blocked phase is still left, as the app's Start counts it.
    assert.deepEqual(demo.body.phasesLeft, [{ n: 2, name: "Build the screen" }, { n: 3, name: "Ship it" }, { n: 6, name: "Blocked" }]);
    assert.equal(demo.body.suggestedQuickCheck, "npm run build");
    assert.equal(demo.body.remembered, false);

    assert.deepEqual((await get("?spec=specs/empty")).body.phasesLeft, [], "no overview.md, nothing to build");
    assert.deepEqual((await get("?spec=specs/missing")).body.phasesLeft, []);

    for (const spec of ["../x", "specs/../x", "specs/a/b", "specs/.hidden", "/etc", "specs", "specs/", "specs%2F..%2Fx"]) {
      const refused = await get(`?spec=${spec}`);
      assert.equal(refused.status, 400, `spec=${spec} is refused`);
      assert.match(refused.body.error, /spec must be a folder directly under specs\//);
    }

    // Saving through the route, then reading it back in a new request.
    const save = await send({ review: true, fixMode: "smart", fix: ["critical"], commit: true, onQuestion: "stop", afterLast: "offer-finalize", quickCheck: "", notifyKind: "query", notifyUrl: "https://example.com/hook", notifyParam: "msg", retryOnce: true, silenceMinutes: 30, phaseStrength: false, strengths: {} });
    assert.equal(save.status, 200, await save.clone().text());
    const after = await get("?spec=specs/demo");
    assert.equal(after.body.remembered, true);
    assert.equal(after.body.fixMode, "smart");
    assert.equal(after.body.silenceMinutes, 30);
    assert.equal(after.body.notifyUrl, "https://example.com/hook");
    assert.equal(after.body.notifyParam, "msg");

    const refusedSave = await send({ silenceMinutes: 0 });
    assert.equal(refusedSave.status, 400);
    assert.ok((await refusedSave.json()).problems.some((p) => /"silenceMinutes"/.test(p)));
    assert.equal((await get("")).body.silenceMinutes, 30, "a refused save changed nothing");
  } finally {
    cli(["stop", "--session", opened.json.sid, "--force"], { cwd, expectFail: true });
  }
});

/* ------------------------------ phase strength: the setup's new fields */

const specWith = (project, name, phases) => {
  const dir = path.join(project, "specs", name);
  fs.mkdirSync(dir, { recursive: true });
  const rows = phases.map(([mark, n, title]) => `- [${mark}] **Phase ${n}:** ${title} - [phase-${n}.md](phase-${n}.md)`);
  fs.writeFileSync(path.join(dir, "overview.md"), ["# Demo", "", "## Phase Checklist", "", ...rows, ""].join("\n"));
};

test("loop-setup: the strength fields default off, and their bad values are named", () => {
  fs.rmSync(LOOP_SETUP_PATH, { force: true });
  const cases = [
    ["phaseStrength as a string", { phaseStrength: "yes" }, /"phaseStrength" must be true or false/],
    ["strengths as a list", { strengths: [] }, /"strengths" must be an object/],
    ["a key outside specs/", { strengths: { "../x": [] } }, /must be a folder directly under specs\//],
    ["a hidden spec folder", { strengths: { "specs/.hidden": [] } }, /must be a folder directly under specs\//],
    ["a nested spec key", { strengths: { "specs/a/b": [] } }, /must be a folder directly under specs\//],
    ["picks as an object", { strengths: { "specs/a": {} } }, /at most 100 phase picks/],
    ["101 picks", { strengths: { "specs/a": Array.from({ length: 101 }, (_, i) => ({ n: i + 1, name: "p", strength: "best" })) } }, /at most 100 phase picks/],
    ["n of 0", { strengths: { "specs/a": [{ n: 0, name: "p", strength: "best" }] } }, /positive whole number/],
    ["n as text", { strengths: { "specs/a": [{ n: "2", name: "p", strength: "best" }] } }, /positive whole number/],
    ["a repeated n", { strengths: { "specs/a": [{ n: 2, name: "p", strength: "best" }, { n: 2, name: "q", strength: "best" }] } }, /Phase 2 twice/],
    ["a 201-character name", { strengths: { "specs/a": [{ n: 1, name: "x".repeat(201), strength: "best" }] } }, /at most 200 characters/],
    ["an unknown word", { strengths: { "specs/a": [{ n: 1, name: "p", strength: "max" }] } }, /strength of thrifty, balanced, best/],
  ];
  const got = inStore(
    (m, { project, list }) =>
      list.map(([what, change]) => {
        try {
          m.saveLoopSetup(project, { ...m.LOOP_DEFAULTS, fix: [...m.LOOP_DEFAULTS.fix], ...change });
          return { what, threw: false };
        } catch (e) {
          return { what, threw: true, message: e.message };
        }
      }),
    { project: projectA, list: cases.map(([what, change]) => [what, change]) }
  );
  for (const [i, [what, , expected]] of cases.entries()) {
    assert.equal(got[i].threw, true, `${what} is refused`);
    assert.match(got[i].message, expected, what);
  }
  assert.equal(fs.existsSync(LOOP_SETUP_PATH), false, "a refused save writes nothing");
  const fresh = inStore((m, { project }) => m.readLoopSetup(project), { project: projectA });
  assert.equal(fresh.phaseStrength, false);
  assert.deepEqual(fresh.strengths, {});
});

test("loop-setup: an entry saved before the strength fields reads as off with no picks", () => {
  fs.rmSync(LOOP_SETUP_PATH, { force: true });
  const project = path.join(HOME, "store-project-old");
  inStore((m, { p }) => (m.saveLoopSetup(p, { ...m.LOOP_DEFAULTS, fix: ["warning"] }), null), { p: project });
  const store = JSON.parse(fs.readFileSync(LOOP_SETUP_PATH, "utf8"));
  const [folded] = Object.keys(store.projects);
  delete store.projects[folded].phaseStrength;
  delete store.projects[folded].strengths;
  fs.writeFileSync(LOOP_SETUP_PATH, JSON.stringify(store));
  const got = inStore((m, { p }) => m.readLoopSetup(p), { p: project });
  assert.equal(got.remembered, true);
  assert.equal(got.phaseStrength, false);
  assert.deepEqual(got.strengths, {});
  assert.deepEqual(got.fix, ["warning"]);
});

test("loop-setup: picks for a removed spec folder or a renamed phase are pruned on read and on save", () => {
  fs.rmSync(LOOP_SETUP_PATH, { force: true });
  const project = fs.mkdtempSync(path.join(HOME, "prune-"));
  specWith(project, "keep", [["x", 1, "Done"], [" ", 2, "Build it"], [" ", 3, "Ship it"]]);
  specWith(project, "gone", [[" ", 1, "Only"]]);
  const picks = {
    "specs/keep": [
      { n: 2, name: "Build it", strength: "thrifty" },
      { n: 3, name: "Ship it renamed", strength: "best" },
      { n: 1, name: "Done", strength: "best" },
    ],
    "specs/gone": [{ n: 1, name: "Only", strength: "best" }],
    "specs/never": [{ n: 1, name: "x", strength: "best" }],
  };
  const out = inStore(
    async (m, { project, picks }) => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const left = (spec) => {
        const text = fs.readFileSync(path.join(project, spec, "overview.md"), "utf8");
        return [...text.matchAll(/^- \[ \] \*\*Phase (\d+):\*\* (.+?) - /gm)].map((x) => ({ n: Number(x[1]), name: x[2] }));
      };
      fs.rmSync(path.join(project, "specs", "gone"), { recursive: true });
      const saved = m.saveLoopSetup(project, { ...m.LOOP_DEFAULTS, fix: [...m.LOOP_DEFAULTS.fix], phaseStrength: true, strengths: picks }, left);
      const onDisk = JSON.parse(fs.readFileSync(m.LOOP_SETUP_FILE, "utf8"));
      const raw = Object.values(onDisk.projects)[0].strengths;
      // A later read, with the overview changed again, drops the next pick too.
      fs.writeFileSync(path.join(project, "specs", "keep", "overview.md"), "# Demo\n\n## Phase Checklist\n\n- [ ] **Phase 3:** Ship it - [phase-3.md](phase-3.md)\n");
      const later = m.readLoopSetup(project, left);
      return { saved: saved.strengths, raw, later: later.strengths };
    },
    { project, picks }
  );
  const kept = [{ n: 2, name: "Build it", strength: "thrifty" }];
  assert.deepEqual(out.saved, { "specs/keep": kept }, "the removed folder, the never-made one, the renamed phase and the finished phase are dropped");
  assert.deepEqual(out.raw, { "specs/keep": kept }, "the file holds the pruned copy");
  assert.deepEqual(out.later, {}, "a later read prunes what the overview no longer lists");
});

test("loop-setup: the picks live only in loop-setup.json, never under specs/", () => {
  fs.rmSync(LOOP_SETUP_PATH, { force: true });
  const project = fs.mkdtempSync(path.join(HOME, "nowrite-"));
  specWith(project, "demo", [[" ", 1, "One"]]);
  const before = fs.readFileSync(path.join(project, "specs", "demo", "overview.md"), "utf8");
  inStore(
    (m, { project }) => (m.saveLoopSetup(project, { ...m.LOOP_DEFAULTS, fix: [...m.LOOP_DEFAULTS.fix], phaseStrength: true, strengths: { "specs/demo": [{ n: 1, name: "One", strength: "best" }] } }), null),
    { project }
  );
  assert.ok(fs.existsSync(LOOP_SETUP_PATH));
  assert.deepEqual(fs.readdirSync(path.join(project, "specs", "demo")), ["overview.md"]);
  assert.equal(fs.readFileSync(path.join(project, "specs", "demo", "overview.md"), "utf8"), before);
  assert.deepEqual(fs.readdirSync(project), ["specs"], "nothing else appears in the project");
});

test("GET /loop-setup?agent= answers the loop agent's resolved strengths and this spec's picks", async () => {
  fs.rmSync(LOOP_SETUP_PATH, { force: true });
  const cwd = tempProject("route-strength");
  specWith(cwd, "demo", [[" ", 1, "One"], [" ", 2, "Two"]]);
  // The installed copy of the shipped model menu, with its strengths, as install.js drops it.
  const shipped = path.join(MODELS_DIR, "bin", "models.json");
  const hadShipped = fs.existsSync(shipped) ? fs.readFileSync(shipped) : null;
  fs.mkdirSync(path.dirname(shipped), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "src", "launcher", "models.json"), shipped);
  const opened = run(["open", "--workflow", "implement", "--no-open"], { cwd });
  assert.equal(opened.status, 0, opened.stderr);
  const { base, cookie } = sessionUrl(opened.json.url);
  const get = async (query) => {
    const res = await fetch(`${base}/loop-setup${query}`, { headers: { cookie, connection: "close" } });
    return { status: res.status, body: await res.json() };
  };
  try {
    const none = await get("?spec=specs/demo");
    assert.equal(none.body.resolved, null, "no agent asked, none answered");
    assert.deepEqual(none.body.picks, []);
    assert.equal(none.body.phaseStrength, false);

    const claude = await get("?spec=specs/demo&agent=claude");
    assert.equal(claude.status, 200);
    assert.deepEqual(Object.keys(claude.body.resolved).sort(), ["balanced", "best", "thrifty"], "the shipped Claude Code rows");
    for (const word of ["thrifty", "balanced", "best"]) assert.equal(typeof claude.body.resolved[word].model, "string");

    const codex = await get("?spec=specs/demo&agent=codex");
    assert.deepEqual(codex.body.resolved, {}, "codex has nothing mapped");

    for (const agent of ["nobody", "..%2Fx", ""]) assert.equal((await get(`?spec=specs/demo&agent=${agent}`)).body.resolved, null, `agent=${agent}`);

    // A save with picks reads back for its own spec; a pick for a phase that is not there is pruned.
    const entry = {
      review: true, fixMode: "smart", fix: ["critical"], commit: true, onQuestion: "guess", afterLast: "offer-finalize", quickCheck: "",
      notifyKind: "query", notifyUrl: "", notifyParam: "message", retryOnce: true, silenceMinutes: 20, phaseStrength: true,
      strengths: { "specs/demo": [{ n: 2, name: "Two", strength: "best" }, { n: 9, name: "Gone", strength: "best" }] },
    };
    const save = await fetch(`${base}/loop-setup`, { method: "POST", headers: { "content-type": "application/json", cookie, origin: base, connection: "close" }, body: JSON.stringify(entry) });
    assert.equal(save.status, 200, await save.clone().text());
    const back = await get("?spec=specs/demo&agent=claude");
    assert.equal(back.body.phaseStrength, true);
    assert.deepEqual(back.body.picks, [{ n: 2, name: "Two", strength: "best" }]);
  } finally {
    if (hadShipped) fs.writeFileSync(shipped, hadShipped);
    else fs.rmSync(shipped, { force: true });
    cli(["stop", "--session", opened.json.sid, "--force"], { cwd, expectFail: true });
  }
});
