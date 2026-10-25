// Web console tests, subagents and helper reports, end to end.
// Run with: node --test scripts/test-web-console-subagents.mjs
//
// Shared setup (a per-process console home, the CLI runner, fixtures) lives in
// web-console-test-helpers.mjs; see the comment at its top.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { defaultInstruction, offered, onLines, STRENGTH_LINES, STRENGTHS } from "../src/web-console/public/subagents.js";
import { readSubagentCursor } from "../src/web-console/settings.mjs";
import {
  ROOT,
  HOME,
  cli,
  sessionUrl,
  readState,
  openSession,
  postPatch,
  ask,
  EXPORT_A,
  consoleSession,
  addFolder,
  tempFolder,
  reportedHelper,
} from "./web-console-test-helpers.mjs";

/* ------------------------------------------- subagents: end to end */

// The switch is remembered per project folder in the console home, so every
// test that starts from "off" clears it first.
const SUBAGENTS_STORE = path.join(HOME, "subagents.json");
const subagentsSession = (extra = {}, { keepStore = false } = {}) => {
  if (!keepStore) fs.rmSync(SUBAGENTS_STORE, { force: true });
  return openSession({ workflow: "implement", ...extra });
};
const setSubagents = async (s, body) => {
  const res = await s.send("/subagents", body);
  return { status: res.status, body: await res.json() };
};
const frameSubagents = async (s) =>
  (await (await fetch(`${s.base}/state`, { headers: { cookie: s.cookie, connection: "close" } })).json()).subagents;
const ON3 = { on: true, instruction: null, max: 3 };
const submitAndWait = async (s) => {
  assert.equal((await s.send("/submit", EXPORT_A)).status, 200);
  return cli(["wait", "--session", s.sid, "--seconds", "10"]);
};
const subagentLines = (reply) =>
  String(reply || "")
    .split("\n")
    .filter((l) => l.startsWith("Subagents:"));

test("subagents: a change reaches the next pickup once, last in reply, edits name what they replace and off follows only an on", async () => {
  const s = subagentsSession();
  const extra = tempFolder();
  try {
    // Nothing saved means on, and open already told the agent. Turn it off and
    // let that be said, so the rest of the test starts from an off agent.
    assert.equal((await setSubagents(s, { ...ON3, on: false })).status, 200);
    assert.equal(subagentLines((await submitAndWait(s)).json.reply).length, 1, "off is said to an agent told on");

    const on = await setSubagents(s, ON3);
    assert.equal(on.status, 200);
    assert.equal(on.body.ok, true);
    const rev = on.body.setting.revision;
    assert.deepEqual(on.body.setting, { workflow: "implement", on: true, instruction: null, max: 3, strength: "balanced", revision: rev });

    assert.equal((await ask(s, "Which files does the first task touch?")).status, 200);
    assert.equal((await addFolder(s, { path: extra })).status, 200);
    const first = await submitAndWait(s);
    assert.equal(first.status, 0);
    assert.deepEqual(first.json.subagents, { state: "on", revision: rev, max: 3, instruction: defaultInstruction("implement"), strength: "balanced" });
    const reply = first.json.reply;
    const at = (re) => reply.search(re);
    assert.ok(at(/^Export format: a$/m) === 0, reply);
    assert.ok(at(/^Quick question:/m) > 0, reply);
    assert.ok(at(/^Workspace:/m) > at(/^Quick question:/m), reply);
    assert.ok(at(/^Subagents:/m) > at(/^Workspace:/m), reply);
    assert.match(reply, new RegExp(`^Subagents: on \\(revision ${rev}\\) — a console setting, not typed by the person\\.$`, "m"));
    assert.ok(reply.endsWith("\n  At most 3 helpers at once."), "the block goes last");
    assert.deepEqual(subagentLines(reply).length, 1, "one block");
    assert.deepEqual(readSubagentCursor(s.session), { revision: rev, state: "on" });

    const second = await submitAndWait(s);
    assert.equal("subagents" in second.json, false, "handed over once");
    assert.deepEqual(subagentLines(second.json.reply), []);

    const edited = await setSubagents(s, { ...ON3, max: 5 });
    assert.equal(edited.body.setting.revision, rev + 1);
    const third = await submitAndWait(s);
    assert.equal(third.json.subagents.revision, rev + 1);
    assert.equal(third.json.subagents.max, 5);
    assert.deepEqual(subagentLines(third.json.reply), [
      `Subagents: on (revision ${rev + 1}, replaces revision ${rev}) — a console setting, not typed by the person.`,
    ]);

    const same = await setSubagents(s, { ...ON3, max: 5 });
    assert.equal(same.status, 200);
    assert.equal(same.body.setting.revision, rev + 1, "saving the same values bumps nothing");
    assert.equal("subagents" in (await submitAndWait(s)).json, false, "and injects nothing");

    const off = await setSubagents(s, { ...ON3, on: false, max: 5 });
    assert.equal(off.body.setting.revision, rev + 2, "off is a revision of its own");
    const fourth = await submitAndWait(s);
    assert.equal(fourth.json.subagents.state, "off");
    assert.deepEqual(subagentLines(fourth.json.reply), [
      `Subagents: off (revision ${rev + 2}) — don't start new helpers for the rest of this session.`,
    ]);
    assert.equal("subagents" in (await submitAndWait(s)).json, false, "off is said once");
  } finally {
    cli(["stop", "--session", s.sid]);
    fs.rmSync(extra, { recursive: true, force: true });
  }
});

test("subagents: never on means never a line, and chat hands a pending block over on its own", async () => {
  // A project that saved "off" starts its next session off and untold.
  const first = subagentsSession();
  assert.equal((await setSubagents(first, { on: false, instruction: null, max: 4 })).status, 200);
  cli(["stop", "--session", first.sid]);
  const s = subagentsSession({}, { keepStore: true });
  try {
    const off = await setSubagents(s, { on: false, instruction: null, max: 4 });
    assert.equal(off.status, 200);
    const got = await submitAndWait(s);
    assert.equal("subagents" in got.json, false);
    assert.deepEqual(subagentLines(got.json.reply), [], "off is never said to an agent not told on");
    assert.equal(cli(["chat", "--session", s.sid]).status, 10);

    assert.equal((await setSubagents(s, { on: true, instruction: "Split by file.", max: 4 })).status, 200);
    const chat = cli(["chat", "--session", s.sid]);
    assert.equal(chat.status, 0);
    assert.deepEqual(chat.json.chat, []);
    assert.equal(chat.json.subagents.state, "on");
    assert.equal(chat.json.subagents.instruction, "Split by file.");
    assert.match(chat.json.reply, /^Subagents: on \(revision \d+\)/);
    assert.match(chat.json.reply, /^ {2}Split by file\.$/m);
    assert.ok(chat.json.terminalLine);
    assert.equal(cli(["chat", "--session", s.sid]).status, 10, "then nothing");
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

test("subagents: a resume re-states an on setting once, says nothing when off, and a lost cursor repeats the block", async () => {
  const s = subagentsSession();
  try {
    const rev = (await setSubagents(s, ON3)).body.setting.revision;
    const resumed = cli(["open", "--resume", s.sid, "--no-open"]);
    assert.equal(resumed.json.ok, true);
    assert.deepEqual(resumed.json.subagents, { state: "on", revision: rev, max: 3, instruction: defaultInstruction("implement"), strength: "balanced" });
    assert.equal(subagentLines(resumed.json.reply)[0], `Subagents: on (revision ${rev}) — a console setting, not typed by the person.`);
    assert.ok(resumed.json.reply.split("\n").every((l, i) => i === 0 || l.startsWith("  ")), "only the block's lines");
    assert.equal("subagents" in (await submitAndWait(s)).json, false, "the next pickup carries nothing");

    // The print happened but the cursor write did not: the block comes again.
    fs.writeFileSync(path.join(s.session, "subagents-cursor.json"), JSON.stringify({ revision: 0, state: "none" }));
    const again = await submitAndWait(s);
    assert.equal(again.json.subagents.state, "on");
    assert.deepEqual(subagentLines(again.json.reply), [`Subagents: on (revision ${rev}) — a console setting, not typed by the person.`]);
    assert.deepEqual(readSubagentCursor(s.session), { revision: rev, state: "on" });

    assert.equal((await setSubagents(s, { ...ON3, on: false })).status, 200);
    const quiet = cli(["open", "--resume", s.sid, "--no-open"]);
    assert.equal("subagents" in quiet.json, false, "a resume with the switch off says nothing");
    assert.equal("reply" in quiet.json, false);
    assert.equal("subagents" in (await submitAndWait(s)).json, false, "nor does the next pickup");
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

test("subagents: a dashboard launch into implement hears implement's saved setting once", async () => {
  const seed = subagentsSession();
  try {
    assert.equal((await setSubagents(seed, ON3)).status, 200);
  } finally {
    cli(["stop", "--session", seed.sid]);
  }
  const s = consoleSession(["--workflow", "dashboard"]);
  try {
    assert.equal((await s.get("/state")).subagents.offered, false, "the dashboard offers no switch");
    const launched = cli(["open", "--resume", s.sid, "--no-open", "--workflow", "implement"]);
    // On the launch itself, not at a later pickup: a skill may do its main
    // work before it ever collects anything.
    assert.equal(launched.json.subagents?.state, "on", "the launch's own open output carries the block");
    assert.match(launched.json.reply, /^Subagents: on \(revision \d+\)/);
    // open consumed the subagents block and advanced the cursor before it
    // printed, so chat has nothing left to hand over.
    assert.equal(cli(["chat", "--session", s.sid]).status, 10, "never both");
    const view = await s.get("/state");
    assert.deepEqual([view.subagents.offered, view.subagents.supported, view.subagents.on], [true, true, true]);
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

test("subagents: the setting survives a restart at the same revision and starts the next session in the project", async () => {
  const s = subagentsSession();
  let next = null;
  try {
    const saved = await setSubagents(s, { on: true, instruction: "Split by file.", max: 7 });
    assert.equal(saved.status, 200);
    const rev = saved.body.setting.revision;
    cli(["stop", "--session", s.sid]);
    const resumed = cli(["open", "--resume", s.sid, "--no-open"]);
    const frame = await (
      await fetch(`${sessionUrl(resumed.json.url).base}/state`, { headers: { cookie: sessionUrl(resumed.json.url).cookie, connection: "close" } })
    ).json();
    assert.deepEqual(
      [frame.subagents.on, frame.subagents.instruction, frame.subagents.max, frame.subagents.revision],
      [true, "Split by file.", 7, rev],
      "a restart alone bumps nothing"
    );

    next = subagentsSession({}, { keepStore: true });
    const fresh = await frameSubagents(next);
    assert.deepEqual([fresh.on, fresh.instruction, fresh.max], [true, "Split by file.", 7], "a new session in the same project starts there");
  } finally {
    cli(["stop", "--session", s.sid]);
    if (next) cli(["stop", "--session", next.sid]);
  }
});

test("subagents: a save that matches this session still becomes the project's setting, without a bump", async () => {
  const b = subagentsSession();
  const a = subagentsSession({}, { keepStore: true });
  let c = null;
  try {
    const before = (await frameSubagents(b)).revision;
    assert.equal((await setSubagents(a, { ...ON3, on: false })).status, 200, "another session turns it off for the project");
    const same = await setSubagents(b, ON3);
    assert.equal(same.status, 200);
    assert.equal(same.body.setting.revision, before, "nothing changed for this session's agent");
    assert.equal("subagents" in (await submitAndWait(b)).json, false);

    c = subagentsSession({}, { keepStore: true });
    assert.equal((await frameSubagents(c)).on, true, "the next session starts from the person's latest pick");
  } finally {
    for (const s of [a, b, c]) if (s) cli(["stop", "--session", s.sid]);
  }
});

test("subagents: a workflow without the switch refuses it, bad bodies name the field, and an older copy's open hides it", async () => {
  const plan = subagentsSession({ workflow: "plan" });
  const s = subagentsSession();
  try {
    assert.deepEqual(await setSubagents(plan, ON3), { status: 400, body: { error: "not-offered" } });
    assert.equal((await frameSubagents(plan)).offered, false);
    assert.equal("subagents" in (await submitAndWait(plan)).json, false);

    assert.deepEqual(await setSubagents(s, { ...ON3, max: 0 }), { status: 400, body: { error: "max" } });
    assert.deepEqual(await setSubagents(s, { ...ON3, max: 21 }), { status: 400, body: { error: "max" } });
    assert.deepEqual(await setSubagents(s, { ...ON3, instruction: "x".repeat(2001) }), { status: 400, body: { error: "too-long" } });
    assert.deepEqual(await setSubagents(s, { ...ON3, on: "yes" }), { status: 400, body: { error: "bad" } });
    assert.deepEqual(await setSubagents(s, { ...ON3, strength: "fast" }), { status: 400, body: { error: "strength" } });

    assert.equal((await frameSubagents(s)).supported, true, "this copy's open carries caps");
    fs.appendFileSync(path.join(s.session, "events.ndjson"), JSON.stringify({ at: new Date().toISOString(), type: "open", resumed: true }) + "\n");
    assert.equal((await frameSubagents(s)).supported, false, "an older copy's open has no caps");
    cli(["open", "--resume", s.sid, "--no-open"]);
    assert.equal((await frameSubagents(s)).supported, true);

    // A session an older server ran has no setting file: nothing is injected,
    // whatever the store says.
    assert.equal((await setSubagents(s, ON3)).status, 200);
    fs.rmSync(path.join(s.session, "subagents-setting.json"), { force: true });
    assert.equal("subagents" in (await submitAndWait(s)).json, false);
  } finally {
    cli(["stop", "--session", plan.sid]);
    cli(["stop", "--session", s.sid]);
  }
});

test("subagents: a strength-only change reaches the agent once, with its profile line", async () => {
  const s = subagentsSession();
  try {
    const before = (await frameSubagents(s)).revision;
    const thrifty = await setSubagents(s, { ...ON3, strength: "thrifty" });
    assert.equal(thrifty.status, 200);
    assert.equal(thrifty.body.setting.revision, before + 1, "a strength alone is a change");
    assert.equal(thrifty.body.setting.strength, "thrifty");
    const picked = await submitAndWait(s);
    assert.equal(picked.json.subagents.strength, "thrifty");
    assert.ok(picked.json.reply.endsWith(["", STRENGTH_LINES.thrifty, "At most 3 helpers at once."].join("\n  ")), picked.json.reply);
    assert.equal((await frameSubagents(s)).strength, "thrifty");

    const again = await setSubagents(s, { ...ON3, strength: "thrifty" });
    assert.equal(again.body.setting.revision, before + 1, "the same strength again bumps nothing");
    assert.equal("subagents" in (await submitAndWait(s)).json, false);
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

test("subagents: a setting saved before strength existed reads as balanced and bumps nothing", async () => {
  const s = subagentsSession();
  try {
    assert.equal((await setSubagents(s, { ...ON3, max: 4 })).status, 200);
    const strip = (file, entries) => {
      const saved = JSON.parse(fs.readFileSync(file, "utf8"));
      for (const entry of entries(saved)) delete entry.strength;
      fs.writeFileSync(file, JSON.stringify(saved));
    };
    strip(SUBAGENTS_STORE, (store) => Object.values(store).flatMap((project) => Object.values(project)));
    strip(path.join(s.session, "subagents-setting.json"), (setting) => [setting]);
    const rev = JSON.parse(fs.readFileSync(path.join(s.session, "subagents-setting.json"), "utf8")).revision;

    cli(["stop", "--session", s.sid]);
    const resumed = sessionUrl(cli(["open", "--resume", s.sid, "--no-open"]).json.url);
    const frame = (await (await fetch(`${resumed.base}/state`, { headers: { cookie: resumed.cookie, connection: "close" } })).json()).subagents;
    assert.deepEqual([frame.max, frame.strength, frame.revision], [4, "balanced", rev], "an upgrade alone bumps nothing");
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

test("subagents: every strength renders its own profile line, and a missing one is balanced", () => {
  const base = { revision: 1, max: 3, instruction: "Split by file." };
  for (const strength of STRENGTHS) {
    const lines = onLines({ ...base, strength });
    assert.equal(lines[lines.length - 2], "  " + STRENGTH_LINES[strength], strength);
    assert.equal(lines.filter((l) => l.includes("Helper strength:")).length, 1, strength);
  }
  assert.equal(new Set(STRENGTHS.map((k) => STRENGTH_LINES[k])).size, STRENGTHS.length, "four different lines");
  assert.equal(onLines(base).at(-2), "  " + STRENGTH_LINES.balanced);
});

/* ------------------------------------------ subagents: helper reports */


test("helpers: post merges them by id, a real helper supersedes working alone, and null clears the list", () => {
  const s = consoleSession(["--workflow", "implement"]);
  try {
    assert.equal(postPatch(s, { helpers: [reportedHelper("h1")] }).status, 0);
    const done = reportedHelper("h1", { state: "done", result: "Found 2 call sites" });
    assert.equal(postPatch(s, { helpers: [done, reportedHelper("h2")] }).status, 0);
    assert.deepEqual(readState(s.session).helpers, [done, reportedHelper("h2")], "h1 updated in place, h2 added");

    // Working alone is a claim about having no helper tool at all, so real
    // helpers supersede it whichever order the two arrive in.
    assert.equal(postPatch(s, { helpers: [{ id: "alone", alone: true }] }).status, 0);
    assert.deepEqual(readState(s.session).helpers.map((h) => h.id), ["h1", "h2"], "alone beside real helpers is dropped");

    assert.equal(postPatch(s, { helpers: null }).status, 0);
    assert.equal("helpers" in readState(s.session), false);

    assert.equal(postPatch(s, { helpers: [{ id: "alone", alone: true }] }).status, 0);
    assert.deepEqual(readState(s.session).helpers, [{ id: "alone", alone: true }]);
    const second = postPatch(s, { helpers: [{ id: "solo", alone: true }] }, { expectFail: true });
    assert.equal(second.status, 3);
    assert.match(second.stderr, /helper "solo"/);
    assert.deepEqual(readState(s.session).helpers, [{ id: "alone", alone: true }], "the refused entry was not written");

    assert.equal(postPatch(s, { helpers: [reportedHelper("h1")] }).status, 0);
    assert.deepEqual(readState(s.session).helpers.map((h) => h.id), ["h1"], "a real helper removes the working-alone marker");
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

test("helpers: every malformed report exits 3 naming the helper, and nothing is written", () => {
  const s = consoleSession(["--workflow", "implement"]);
  try {
    assert.equal(postPatch(s, { helpers: [reportedHelper("h1")] }).status, 0);
    const statePath = path.join(s.session, "state.json");
    const before = fs.readFileSync(statePath, "utf8");
    const cases = [
      ["missing title", [{ id: "h3", ask: "Read the docs", state: "running" }], /helper "h3": title must be a non-empty string/],
      ["unknown state", [reportedHelper("h3", { state: "paused" })], /helper "h3": state must be running, done or failed/],
      ["81-char title", [reportedHelper("h3", { title: "t".repeat(81) })], /helper "h3": title must be at most 80 characters/],
      ["401-char ask", [reportedHelper("h3", { ask: "a".repeat(401) })], /helper "h3": ask must be at most 400 characters/],
      ["201-char result", [reportedHelper("h3", { state: "done", result: "r".repeat(201) })], /helper "h3": result must be at most 200 characters/],
      ["completion marker", [reportedHelper("h3", { state: "done", result: "PHASE_COMPLETE" })], /helper "h3" result contains a loop completion marker/],
      ["metrics bait", [reportedHelper("h3", { title: "Risk 3" })], /helper "h3" title contains "Risk 3"/],
      ["not an array", { id: "h3" }, /"helpers" must be an array/],
      ["null entry", [null], /"helpers" entries must be objects/],
      ["string entry", ["h3"], /"helpers" entries must be objects/],
    ];
    for (const [name, helpers, re] of cases) {
      const res = postPatch(s, { helpers }, { expectFail: true });
      assert.equal(res.status, 3, name);
      assert.match(res.stderr, re, name);
      assert.equal(fs.readFileSync(statePath, "utf8"), before, `${name}: nothing written`);
    }
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

test("helpers: a reported strength and effort are kept, other values exit 3 naming the helper, and both stay optional", () => {
  const s = consoleSession(["--workflow", "implement"]);
  try {
    const ran = reportedHelper("h1", { strength: "standard", effort: "medium" });
    assert.equal(postPatch(s, { helpers: [ran] }).status, 0);
    assert.deepEqual(readState(s.session).helpers, [ran], "strength and effort are kept as reported");
    const statePath = path.join(s.session, "state.json");
    const before = fs.readFileSync(statePath, "utf8");
    for (const [name, extra, re] of [
      ["unknown strength", { strength: "huge" }, /helper "h2": strength must be light, standard, strongest or inherit/],
      ["unknown effort", { effort: "max" }, /helper "h2": effort must be low, medium or high/],
    ]) {
      const res = postPatch(s, { helpers: [reportedHelper("h2", extra)] }, { expectFail: true });
      assert.equal(res.status, 3, name);
      assert.match(res.stderr, re, name);
      assert.equal(fs.readFileSync(statePath, "utf8"), before, `${name}: nothing written`);
    }
    assert.equal(postPatch(s, { helpers: [reportedHelper("h3")] }).status, 0, "a helper without the fields still posts");
    assert.deepEqual(readState(s.session).helpers.map((h) => h.id), ["h1", "h3"]);
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

test("docs: a doc's version never goes back; the same version again is fine, and a hop starts every doc fresh", () => {
  const s = consoleSession(["--workflow", "implement"]);
  try {
    const doc = (version, md) => ({ docs: [{ id: "phase", title: "Phase 5 tasks", version, blocks: [{ id: "tasks", state: "settled", md }] }] });
    assert.equal(postPatch(s, doc(7, "- [x] Task 4.1")).status, 0);
    assert.equal(postPatch(s, doc(7, "- [x] Task 4.1 (again)")).status, 0, "the same version again is fine");
    const statePath = path.join(s.session, "state.json");
    const before = fs.readFileSync(statePath, "utf8");
    const stale = postPatch(s, doc(1, "- [ ] Task 4.1"), { expectFail: true });
    assert.equal(stale.status, 3);
    assert.match(stale.stderr, /doc "phase" is at version 7 on the page; this patch sends version 1/);
    assert.equal(fs.readFileSync(statePath, "utf8"), before, "nothing written");
    assert.equal(postPatch(s, doc(8, "- [ ] Task 5.1")).status, 0, "a higher version goes through");
    assert.equal(postPatch(s, { docs: [{ id: "phase", blocks: [{ id: "tasks", state: "settled", md: "- [x] Task 5.1" }] }] }).status, 0, "a patch with no version is not checked");

    cli(["open", "--resume", s.sid, "--no-open", "--workflow", "dashboard"]);
    cli(["open", "--resume", s.sid, "--no-open", "--workflow", "implement"]);
    assert.equal(postPatch(s, doc(1, "- [ ] Task 1.1")).status, 0, "after a hop the doc starts fresh");
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

test("docs: a second phase in one build session goes through as notes/implement.md teaches it", () => {
  const md = fs.readFileSync(path.join(ROOT, "src", "web-console", "notes", "implement.md"), "utf8");
  assert.match(md, /A later phase in the same session posts the same two docs/);
  assert.match(md, /versions move up by themselves/);
  assert.match(md, /Leave\s+`version` out/);
  const taught = consoleSession(["--workflow", "implement"]);
  try {
    // As taught: no version anywhere, and the second phase simply goes through.
    const phase = (n, md) => ({
      headline: { stage: `Phase ${n}`, cleared: 0 },
      docs: [
        { id: "phase", title: `Phase ${n} tasks`, blocks: [{ id: "tasks", state: "settled", md }] },
        { id: "phasefile", title: `phase-${n}.md`, blocks: [{ id: "body", state: "settled", md }] },
      ],
    });
    assert.equal(postPatch(taught, phase(1, "- [ ] Task 1.1")).status, 0);
    assert.equal(postPatch(taught, phase(1, "- [x] Task 1.1")).status, 0);
    assert.equal(postPatch(taught, phase(2, "- [ ] Task 2.1")).status, 0);
    assert.deepEqual(
      readState(taught.session).docs.map((d) => [d.id, d.title, d.version]),
      [["phase", "Phase 2 tasks", 3], ["phasefile", "phase-2.md", 3]]
    );
  } finally {
    cli(["stop", "--session", taught.sid]);
  }
  // An explicit version still never goes back.
  const s = consoleSession(["--workflow", "implement"]);
  try {
    const phase = (n, version, md) => ({
      headline: { stage: `Phase ${n}`, cleared: 0 },
      docs: [
        { id: "phase", title: `Phase ${n} tasks`, version, blocks: [{ id: "tasks", state: "settled", md }] },
        { id: "phasefile", title: `phase-${n}.md`, version, blocks: [{ id: "body", state: "settled", md }] },
      ],
    });
    assert.equal(postPatch(s, phase(1, 1, "- [ ] Task 1.1")).status, 0);
    assert.equal(postPatch(s, phase(1, 2, "- [x] Task 1.1")).status, 0);
    const restarted = postPatch(s, phase(2, 1, "- [ ] Task 2.1"), { expectFail: true });
    assert.equal(restarted.status, 3, "restarting at version 1 is refused");
    assert.equal(postPatch(s, phase(2, 3, "- [ ] Task 2.1")).status, 0, "continuing from the page's version goes through");
    const docs = readState(s.session).docs;
    assert.deepEqual(
      docs.map((d) => [d.id, d.title, d.version]),
      [["phase", "Phase 2 tasks", 3], ["phasefile", "phase-2.md", 3]]
    );
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});
