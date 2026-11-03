// The one agent lookup rule (src/web-console/agent-lookup.mjs) against the
// shared cases every reader's tests load (scripts/fixtures/agent-lookup-cases.json),
// plus loadAgentList()'s file handling and the shipped src/launcher/agents.json.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { findAgent, loadAgentList } from "../src/web-console/agent-lookup.mjs";
import { normalizeAgents } from "../src/web-console/agents.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CASES = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", "fixtures", "agent-lookup-cases.json"), "utf8"));

// The .cmd cases check a shim's lookup; cmd's own current-folder rule must not
// color a temp-folder stat, so the switch is cleared for the whole suite.
const savedSwitch = process.env.NoDefaultCurrentDirectoryInExePath;
delete process.env.NoDefaultCurrentDirectoryInExePath;

/**
 * The folders a case names, as real temp dirs with its files inside.
 * `{name}` in a value expands to that folder's path.
 */
function stage(t, c) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-lookup-"));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const dirs = {};
  for (const [name, files] of Object.entries(c.dirs || {})) {
    const dir = path.join(base, name);
    dirs[name] = dir;
    for (const file of files) {
      const target = path.join(dir, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, "");
    }
    if (!files.length) fs.mkdirSync(dir, { recursive: true });
  }
  const fill = (value) =>
    typeof value === "string"
      ? value.replace(/\{([^}]+)\}/g, (whole, name) => {
          if (!(name in dirs)) {
            const dir = path.join(base, name);
            dirs[name] = dir;
            return dir;
          }
          return dirs[name];
        })
      : value;
  const env = {};
  for (const [key, value] of Object.entries(c.env || {})) {
    env[key] = value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fill(v)])) : fill(value);
  }
  env.platform = c.platform;
  const entry = JSON.parse(JSON.stringify(c.entry || {}), (key, value) => (typeof value === "string" ? fill(value) : value));
  return { entry, env, fill };
}

for (const c of CASES.cases) {
  test(`findAgent: ${c.name}`, (t) => {
    const { entry, env, fill } = stage(t, c);
    const got = findAgent(entry, env);
    assert.equal(got.state, c.state, `state: ${JSON.stringify(got)}`);
    assert.equal(got.where, c.where, `where: ${JSON.stringify(got)}`);
    if (c.state === "missing") {
      assert.equal(got.path, null);
      assert.equal(got.folder, null);
      return;
    }
    assert.ok(got.path && fs.statSync(got.path).isFile(), `path is a real file: ${JSON.stringify(got)}`);
    if (c.file) assert.equal(path.basename(got.path), c.file);
    if (c.folder) {
      const want = path.normalize(fill(c.folder));
      assert.equal(path.normalize(got.folder), want, `folder: ${JSON.stringify(got)}`);
    }
  });
}

test("the fixture covers every case it promises", () => {
  const names = CASES.cases.map((c) => c.name);
  for (const word of ["PATH", "PATHEXT", "saved", "npm", "install", "missing", "full path", "space"]) {
    assert.ok(names.some((n) => n.includes(word)), `a case names ${word}`);
  }
});

/* ------------------------------------------------------- loadAgentList */

function listDir(t, contents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-agentlist-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  if (contents !== undefined) fs.writeFileSync(path.join(dir, "agents.json"), contents);
  return dir;
}

test("loadAgentList: a missing file gives empty lists and a warning, never a throw", (t) => {
  const { builtins, templates, warnings } = loadAgentList({ dir: listDir(t) });
  assert.deepEqual(builtins, []);
  assert.deepEqual(templates, []);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /missing/);
});

test("loadAgentList: bad JSON and a wrong schema warn and give nothing", (t) => {
  const bad = loadAgentList({ dir: listDir(t, "{ nope") });
  assert.deepEqual([bad.builtins, bad.templates], [[], []]);
  assert.match(bad.warnings[0], /not valid JSON/);
  const wrong = loadAgentList({ dir: listDir(t, JSON.stringify({ schema: 2, agents: [] })) });
  assert.deepEqual([wrong.builtins, wrong.templates], [[], []]);
  assert.match(wrong.warnings[0], /schema/);
});

test("loadAgentList: the shipped agents.json loads with 3 built-ins and 4 templates", () => {
  const { builtins, templates, warnings } = loadAgentList({ dir: path.join(ROOT, "src", "launcher") });
  assert.deepEqual(warnings, []);
  assert.deepEqual(builtins.map((a) => a.id), ["claude", "devin", "codex"]);
  assert.deepEqual(templates.map((a) => a.id), ["copilot", "opencode", "gemini", "pi"]);
});

test("every shipped template passes normalizeAgents() with no warnings", () => {
  const { templates } = loadAgentList({ dir: path.join(ROOT, "src", "launcher") });
  const { agents, warnings } = normalizeAgents(JSON.stringify({ schema: 1, agents: templates }));
  assert.deepEqual(warnings, []);
  assert.equal(agents.length, templates.length);
});
