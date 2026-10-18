// Web console tests, workspace and meter, end to end.
// Run with: node --test scripts/test-web-console-workspace.mjs
//
// Shared setup (a per-process console home, the CLI runner, fixtures) lives in
// web-console-test-helpers.mjs; see the comment at its top.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { defaultName } from "../src/web-console/public/workspace.js";
import { meterView } from "../src/web-console/public/meter.js";
import { readLedger } from "../src/web-console/sessions.mjs";
import { readWorkspaceCursor, WORKSPACE_FILE } from "../src/web-console/workspace.mjs";
import {
  ROOT,
  CONSOLE_CLI,
  ENV,
  cli,
  safeJson,
  payload,
  openSession,
  sleep,
  until,
  EXPORT_A,
  REMEMBERED,
  consoleSession,
  addFolder,
  tempFolder,
} from "./web-console-test-helpers.mjs";

/* ------------------------------------ workspace and meter: end to end */

const remembered = () => JSON.parse(fs.readFileSync(REMEMBERED, "utf8"));
const rememberedFor = (spec) => {
  const projects = Object.values(remembered().projects);
  const project = projects.find((p) => path.resolve(p.path).toLowerCase() === ROOT.toLowerCase());
  if (!project) return undefined;
  return spec ? (project.specs || {})[spec] : project.project;
};

const wsFile = (s) => JSON.parse(fs.readFileSync(path.join(s.session, WORKSPACE_FILE), "utf8"));

test("workspace: a folder added on the dashboard survives dashboard → plan → dashboard, and the plan launch scores 2", async () => {
  const s = consoleSession(["--workflow", "dashboard"]);
  const extra = tempFolder();
  try {
    assert.deepEqual(s.opened.workspace.folders, [{ name: defaultName(ROOT), path: ROOT, original: true }]);
    const added = await addFolder(s, { path: extra, description: "  the design notes  " });
    assert.equal(added.status, 200);
    assert.equal(added.body.name, defaultName(extra));
    assert.equal(added.body.description, "the design notes");
    assert.equal(added.body.nested, false);

    for (const workflow of ["plan", "dashboard"]) {
      const resumed = cli(["open", "--resume", s.sid, "--no-open", "--workflow", workflow]);
      assert.deepEqual(
        resumed.json.workspace.folders.map((f) => f.path),
        [ROOT, extra],
        `open prints the workspace as ${workflow}`
      );
      assert.deepEqual(wsFile(s).folders.map((f) => f.path), [ROOT, extra], `workspace.json still lists it as ${workflow}`);
    }
    const ledger = readLedger(s.session);
    assert.deepEqual(
      ledger.filter((e) => e.kind === "launch").map((e) => [e.id, e.workflow]),
      [["L1", "dashboard"], ["L2", "plan"], ["L3", "dashboard"]]
    );
    assert.equal(meterView(ledger).points, 2);
    assert.equal((await s.get("/state")).meter.points, 2, "the frame carries the meter");

    assert.deepEqual(
      rememberedFor("").folders.map((f) => [f.path, f.description]),
      [[extra, "the design notes"]],
      "the add was remembered for the project, outside the session folder"
    );
    const fresh = consoleSession(["--workflow", "dashboard"], { keepRemembered: true });
    try {
      assert.deepEqual(
        fresh.opened.workspace.folders.map((f) => f.path),
        [ROOT, extra],
        "a new console session in the same folder opens with the remembered folders"
      );
      assert.equal(meterView(readLedger(fresh.session)).points, 0);
    } finally {
      cli(["stop", "--session", fresh.sid]);
    }
  } finally {
    cli(["stop", "--session", s.sid]);
    fs.rmSync(extra, { recursive: true, force: true });
  }
});

test("workspace: a spec starts from the project's list, then stands alone, and the scope swaps lists with logged changes", async () => {
  const s = consoleSession(["--workflow", "dashboard"]);
  const shared = tempFolder();
  const specOnly = tempFolder();
  try {
    assert.equal((await addFolder(s, { path: shared })).status, 200);
    const toSpec = await s.send("/workspace/scope", { spec: "specs/demo" });
    assert.equal(toSpec.status, 200);
    const view = await toSpec.json();
    assert.equal(view.scope, "specs/demo");
    assert.deepEqual(view.folders.map((f) => f.path), [ROOT, shared], "seeded from the project's list");
    assert.equal(rememberedFor("specs/demo"), undefined, "nothing is saved for the spec until it changes");

    assert.equal((await addFolder(s, { path: specOnly })).status, 200);
    assert.deepEqual(rememberedFor("specs/demo").folders.map((f) => f.path), [shared, specOnly]);
    assert.deepEqual(rememberedFor("").folders.map((f) => f.path), [shared], "the project's list is untouched");

    const before = wsFile(s).version;
    const back = await (await s.send("/workspace/scope", { spec: "" })).json();
    assert.deepEqual([back.scope, back.folders.map((f) => f.path)], ["", [ROOT, shared]]);
    assert.deepEqual(
      wsFile(s).changes.filter((c) => c.version > before).map((c) => [c.kind, c.path]),
      [["removed", specOnly]],
      "the swap is logged, so the agent hears of it"
    );
    const again = await (await s.send("/workspace/scope", { spec: "specs/demo/" })).json();
    assert.deepEqual(again.folders.map((f) => f.path), [ROOT, shared, specOnly], "the spec's own list comes back");
    assert.equal((await s.send("/workspace/scope", { spec: "../elsewhere" })).status, 400);
  } finally {
    cli(["stop", "--session", s.sid]);
    fs.rmSync(shared, { recursive: true, force: true });
    fs.rmSync(specOnly, { recursive: true, force: true });
  }
});

test("workspace: open --spec starts on that spec's list, a posted specDir takes the list with it, and forget drops only that spec", async () => {
  const s = consoleSession(["--workflow", "dashboard"]);
  const shared = tempFolder();
  const specOnly = tempFolder();
  let other = null;
  let planned = null;
  try {
    await addFolder(s, { path: shared });
    await s.send("/workspace/scope", { spec: "specs/demo" });
    await addFolder(s, { path: specOnly });
    cli(["stop", "--session", s.sid]);

    other = consoleSession(["--workflow", "implement", "--spec", "specs/demo"], { keepRemembered: true });
    assert.deepEqual(other.opened.workspace.folders.map((f) => f.path), [ROOT, shared, specOnly]);
    assert.equal((await other.get("/workspace")).scope, "specs/demo");

    planned = consoleSession(["--workflow", "plan"], { keepRemembered: true });
    assert.deepEqual(planned.opened.workspace.folders.map((f) => f.path), [ROOT, shared], "no spec: the project's list");
    cli(["post", "--session", planned.sid, "--file", payload("ws-spec.json", { specDir: "specs/brand-new" })]);
    let saved;
    for (let i = 0; i < 40 && !(saved = rememberedFor("specs/brand-new")); i++) await sleep(100);
    assert.deepEqual(saved && saved.folders.map((f) => f.path), [shared], "the list in force became the new spec's");

    const forgot = cli(["forget", "--spec", "specs/demo/overview.md"]);
    assert.deepEqual(forgot.json, { ok: true, spec: "specs/demo", forgot: true });
    assert.equal(cli(["forget", "--spec", "specs/demo"]).json.forgot, false, "a second forget finds nothing");
    assert.equal(rememberedFor("specs/demo"), undefined);
    assert.ok(rememberedFor("specs/brand-new"), "other specs are kept");
    assert.ok(rememberedFor(""), "the project's list is kept");
    assert.equal(cli(["forget"], { expectFail: true }).status, 2);
  } finally {
    for (const x of [s, other, planned]) if (x) cli(["stop", "--session", x.sid]);
    fs.rmSync(shared, { recursive: true, force: true });
    fs.rmSync(specOnly, { recursive: true, force: true });
  }
});

test("workspace: add resolves from the session's folder and refuses a file, a missing path, a duplicate and a name clash", async () => {
  // Opened from scripts/: the worktree is still the repo root, but the CLI
  // (and so the server it spawns) runs from elsewhere.
  const s = consoleSession(["--workflow", "plan"], { cwd: path.join(ROOT, "scripts") });
  const quoted = tempFolder();
  try {
    assert.deepEqual(await addFolder(s, { path: path.join(ROOT, "AGENTS.md") }), { status: 400, body: { reason: "not-a-folder" } });
    assert.deepEqual(await addFolder(s, { path: path.join(os.tmpdir(), `p2c-nope-${Date.now()}`) }), {
      status: 400,
      body: { reason: "not-a-folder" },
    });
    assert.deepEqual(await addFolder(s, { path: "" }), { status: 400, body: { reason: "not-a-folder" } });

    const relative = await addFolder(s, { path: `../${path.basename(ROOT)}/src` });
    assert.equal(relative.status, 200, "../ resolves from the session's worktree, not the process cwd");
    assert.equal(relative.body.path, path.join(ROOT, "src"));
    assert.equal(relative.body.nested, true, "inside the original folder: accepted, with a note");
    assert.equal(relative.body.name, "src");

    const again = path.join(ROOT, "src");
    const dup = await addFolder(s, { path: process.platform === "win32" ? again.toUpperCase() : again });
    assert.deepEqual(dup, { status: 400, body: { reason: "duplicate", name: "src" } });

    const clash = await addFolder(s, { path: path.join(ROOT, "src", "web-console"), name: "src" });
    assert.deepEqual(clash, { status: 400, body: { reason: "name-taken", suggest: "src-2" } });
    assert.deepEqual(await addFolder(s, { path: path.join(ROOT, "src", "web-console"), name: "Not OK" }), {
      status: 400,
      body: { reason: "bad-name" },
    });

    const q = await addFolder(s, { path: `"${quoted}"` });
    assert.equal(q.status, 200, "surrounding quotes are stripped");
    assert.equal(q.body.path, quoted);

    assert.deepEqual(wsFile(s).folders.map((f) => f.id), ["f0", "f1", "f2"], "refusals changed nothing");
    assert.deepEqual(wsFile(s).changes.map((c) => [c.kind, c.version]), [["added", 1], ["added", 2]]);
  } finally {
    cli(["stop", "--session", s.sid]);
    fs.rmSync(quoted, { recursive: true, force: true });
  }
});

test("workspace: the original can be renamed and described but never removed; others can be removed", async () => {
  const s = consoleSession(["--workflow", "plan"]);
  const extra = tempFolder();
  try {
    const id = (await addFolder(s, { path: extra })).body.id;
    const remove = async (body) => {
      const res = await s.send("/workspace/remove", body);
      return { status: res.status, body: await res.json() };
    };
    const edit = async (body) => {
      const res = await s.send("/workspace/edit", body);
      return { status: res.status, body: await res.json() };
    };
    assert.deepEqual(await remove({ id: "f0" }), { status: 400, body: { reason: "original" } });
    assert.equal((await remove({ id: "f99" })).status, 404);
    assert.equal((await edit({ id: "f99", name: "x" })).status, 404);
    assert.deepEqual(await edit({ id: "f0", name: defaultName(extra) }), {
      status: 400,
      body: { reason: "name-taken", suggest: `${defaultName(extra)}-2` },
    });
    assert.deepEqual(await edit({ id: "f0", name: "Home Base" }), { status: 400, body: { reason: "bad-name" } });

    const renamed = await edit({ id: "f0", name: "home-base", description: "where it all started" });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.name, "home-base");
    assert.equal(renamed.body.original, true);
    const tail = wsFile(s).changes.slice(-2);
    assert.deepEqual(
      tail.map(({ kind, from, name, description }) => ({ kind, from, name, description })),
      [
        { kind: "renamed", from: defaultName(ROOT), name: "home-base", description: undefined },
        { kind: "described", from: undefined, name: "home-base", description: "where it all started" },
      ]
    );

    assert.equal((await remove({ id })).status, 200);
    assert.deepEqual(wsFile(s).folders.map((f) => f.id), ["f0"]);
    assert.equal(wsFile(s).changes.at(-1).kind, "removed");
  } finally {
    cli(["stop", "--session", s.sid]);
    fs.rmSync(extra, { recursive: true, force: true });
  }
});

test("workspace: browse returns the picked folder, or cancelled, and is hidden when the session looks remote", async () => {
  const picked = tempFolder();
  const echo = consoleSession(["--workflow", "plan"], { env: { PLAN2CODE_PICKER_ECHO: picked } });
  const cancel = consoleSession(["--workflow", "plan"], { env: { PLAN2CODE_PICKER_ECHO: "-" } });
  const remote = consoleSession(["--workflow", "plan"], { env: { PLAN2CODE_PICKER_ECHO: picked, SSH_CONNECTION: "1 2 3 4" } });
  try {
    const got = await echo.send("/workspace/browse", {});
    assert.equal(got.status, 200);
    assert.deepEqual(await got.json(), { path: picked });
    assert.equal(wsFile(echo).folders.length, 1, "browse only returns a path; nothing is added");

    const none = await cancel.send("/workspace/browse", {});
    assert.equal(none.status, 200);
    assert.deepEqual(await none.json(), { cancelled: true });

    assert.equal((await remote.get("/workspace")).remote, "SSH_CONNECTION", "the server records the remote flag at boot");
    const hidden = await remote.send("/workspace/browse", {});
    assert.equal(hidden.status, 404);
    assert.deepEqual(await hidden.json(), { reason: "no-picker" });
  } finally {
    for (const s of [echo, cancel, remote]) cli(["stop", "--session", s.sid]);
    fs.rmSync(picked, { recursive: true, force: true });
  }
});

test("workspace: a folder deleted on disk is marked missing once, and found again when it returns", async () => {
  const s = consoleSession(["--workflow", "plan"]);
  const gone = tempFolder();
  try {
    const id = (await addFolder(s, { path: gone })).body.id;
    fs.rmSync(gone, { recursive: true, force: true });
    assert.deepEqual((await s.get("/workspace?check=1")).missing, [id]);
    assert.deepEqual((await s.get("/workspace?check=1")).missing, [id]);
    assert.equal(wsFile(s).changes.filter((c) => c.kind === "missing").length, 1, "one missing change, not one per check");
    const resumed = cli(["open", "--resume", s.sid, "--no-open"]);
    assert.deepEqual(resumed.json.workspace.missing, [defaultName(gone)], "open tells the agent by name");

    fs.mkdirSync(gone);
    assert.deepEqual((await s.get("/workspace?check=1")).missing, []);
    assert.equal(wsFile(s).changes.at(-1).kind, "found");

    // A new skill run re-checks on its own: no ?check=1 from here on.
    fs.rmSync(gone, { recursive: true, force: true });
    cli(["open", "--resume", s.sid, "--no-open", "--workflow", "implement"]);
    assert.ok(
      await until(async () => (await s.get("/workspace")).missing.includes(id)),
      "the launch alone marked the folder missing"
    );
  } finally {
    cli(["stop", "--session", s.sid]);
    fs.rmSync(gone, { recursive: true, force: true });
  }
});

test("workspace: a change never ends a wait slice, rides on the next send exactly once, and a lost cursor re-delivers it", async () => {
  const s = openSession();
  const extra = tempFolder();
  try {
    const child = spawn(process.execPath, [CONSOLE_CLI, "wait", "--session", s.sid, "--seconds", "6"], { env: ENV, cwd: ROOT });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    const exited = new Promise((resolve) => child.on("exit", resolve));
    await sleep(1500);
    assert.equal((await addFolder(s, { path: extra })).status, 200);
    assert.equal(await exited, 10, "the change alone did not end the slice");
    assert.equal(safeJson(out).pendingWorkspace, 1);

    const name = defaultName(extra);
    assert.equal((await s.send("/submit", EXPORT_A)).status, 200);
    const first = cli(["wait", "--session", s.sid, "--seconds", "10"]);
    assert.equal(first.status, 0);
    assert.deepEqual(first.json.workspace.map((c) => [c.kind, c.name]), [["added", name]]);
    assert.match(first.json.reply, /^Export format: a\n/);
    assert.match(first.json.reply, new RegExp(`^Workspace: added @${name} — `, "m"));
    assert.equal(readWorkspaceCursor(s.session), 1);

    assert.equal((await s.send("/submit", EXPORT_A)).status, 200);
    const second = cli(["wait", "--session", s.sid, "--seconds", "10"]);
    assert.equal(second.status, 0);
    assert.equal("workspace" in second.json, false, "handed over once");
    assert.equal(second.json.reply, "Export format: a");

    // The print happened but the cursor write did not: the change comes again.
    fs.writeFileSync(path.join(s.session, "workspace-cursor.json"), JSON.stringify({ version: 0 }));
    assert.equal((await s.send("/submit", EXPORT_A)).status, 200);
    const again = cli(["wait", "--session", s.sid, "--seconds", "10"]);
    assert.deepEqual(again.json.workspace.map((c) => c.name), [name]);
  } finally {
    cli(["stop", "--session", s.sid]);
    fs.rmSync(extra, { recursive: true, force: true });
  }
});

test("workspace: chat hands over a workspace change on its own, then has nothing", async () => {
  const s = openSession();
  const extra = tempFolder();
  try {
    assert.equal((await addFolder(s, { path: extra })).status, 200);
    const got = cli(["chat", "--session", s.sid]);
    assert.equal(got.status, 0);
    assert.deepEqual(got.json.chat, []);
    assert.deepEqual(got.json.workspace.map((c) => c.kind), ["added"]);
    assert.match(got.json.reply, /^Workspace: added @/);
    assert.ok(got.json.terminalLine);
    assert.equal(cli(["chat", "--session", s.sid]).status, 10);
  } finally {
    cli(["stop", "--session", s.sid]);
    fs.rmSync(extra, { recursive: true, force: true });
  }
});
