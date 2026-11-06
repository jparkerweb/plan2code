// The rules of ~/.plan2code/agents.json, console side (src/web-console/agents.mjs),
// against the shared cases every reader's tests load (scripts/fixtures/agents-cases.json),
// plus what only the console does: finding a command and checking a save.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { MAX_AGENTS, buildArgs, makeId, normalizeAgents, resolveCommand, validateForSave } from "../src/web-console/agents.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CASES = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", "fixtures", "agents-cases.json"), "utf8"));
const WINDOWS = process.platform === "win32";

for (const c of CASES.files) {
  test(`agents file: ${c.name}`, () => {
    const { agents, warnings } = normalizeAgents(c.raw);
    assert.deepEqual(agents, c.agents);
    if (!c.warnings.length) assert.deepEqual(warnings, []);
    for (const part of c.warnings) {
      assert.ok(warnings.some((w) => w.includes(part)), `a warning names "${part}": ${JSON.stringify(warnings)}`);
    }
  });
}

for (const c of CASES.buildArgs) {
  test(`buildArgs: ${c.name}`, () => {
    assert.deepEqual(buildArgs(c.entry, c.options), c.args);
  });
}

for (const c of CASES.ids) {
  test(`makeId: ${c.name}`, () => {
    assert.equal(makeId(c.input, c.taken), c.id);
  });
}

test("normalizeAgents takes the parsed file too, and never throws on odd input", () => {
  assert.deepEqual(normalizeAgents({ schema: 1, agents: [{ id: "goose", name: "Goose", command: "goose" }] }).agents.map((a) => a.id), ["goose"]);
  for (const odd of [0, true, "null", "42", "\"text\"", [], () => {}]) {
    assert.deepEqual(normalizeAgents(odd).agents, [], String(odd));
  }
});

test("the fixture covers every rule it promises", () => {
  assert.ok(CASES.files.length >= 20 && CASES.buildArgs.length >= 10 && CASES.ids.length >= 8);
  const many = CASES.files.find((c) => c.name.startsWith("51 entries"));
  assert.equal(many.agents.length, MAX_AGENTS);
});

/* ------------------------------------------------------- resolveCommand */

function fakePath(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-agents-"));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const bin = path.join(base, "bin");
  const spaced = path.join(base, "with space");
  fs.mkdirSync(bin);
  fs.mkdirSync(spaced);
  return { base, bin, spaced };
}

test("resolveCommand finds a bare name on PATH, a full path, and misses what is not there", (t) => {
  const { bin, spaced } = fakePath(t);
  const name = WINDOWS ? "goose.exe" : "goose";
  fs.writeFileSync(path.join(bin, name), "");
  const opts = { path: [spaced, `"${bin}"`].join(path.delimiter), pathext: ".EXE;.CMD" };
  assert.equal(resolveCommand("goose", opts)?.toLowerCase(), path.join(bin, name).toLowerCase(), "a bare name, PATH entry quoted");
  assert.equal(resolveCommand(path.join(bin, name), opts), path.join(bin, name), "a full path");
  assert.equal(resolveCommand(`  "${path.join(bin, name)}"  `, opts), path.join(bin, name), "a quoted, padded full path");
  assert.equal(resolveCommand("nowhere", opts), null);
  assert.equal(resolveCommand(path.join(bin, "nowhere"), opts), null);
  assert.equal(resolveCommand(bin, opts), null, "a folder is not a command");
  assert.equal(resolveCommand("", opts), null);
  assert.equal(resolveCommand("goose", { path: "", pathext: ".EXE" }), null, "an empty PATH finds nothing");
});

test("resolveCommand on Windows tries PATHEXT, also in a folder with a space and for a full path", { skip: !WINDOWS && "Windows only" }, (t) => {
  const { spaced } = fakePath(t);
  const cmd = path.join(spaced, "aider.cmd");
  fs.writeFileSync(cmd, "@echo off");
  const opts = { path: spaced, pathext: ".EXE;.CMD;.BAT" };
  assert.equal(resolveCommand("aider", opts)?.toLowerCase(), cmd.toLowerCase(), "found through PATHEXT");
  assert.equal(resolveCommand("aider.cmd", opts), cmd, "a name that already has its extension");
  assert.equal(resolveCommand(path.join(spaced, "aider"), opts)?.toLowerCase(), cmd.toLowerCase(), "a full path without its extension");
  assert.equal(resolveCommand("aider", { path: spaced, pathext: ".EXE" }), null, "only the listed extensions");
});

/* ------------------------------------------------------- validateForSave */

test("validateForSave fills ids from names and every default", () => {
  const { agents, error } = validateForSave([
    { id: "goose", name: "Goose", command: "goose" },
    { name: "My Agent", command: " my-agent " },
    { name: "goose!", command: "goose2" },
  ]);
  assert.equal(error, undefined);
  assert.deepEqual(agents.map((a) => a.id), ["goose", "my-agent", "goose-2"]);
  assert.equal(agents[1].command, "my-agent");
  assert.deepEqual(agents[1].modelArgs, ["--model", "{model}"]);
  assert.equal(agents[1].prompt, "/plan2code");
});

test("validateForSave names the entry and field of the first failure", () => {
  const cases = [
    [[{ name: "Goose", command: "goose" }, { name: "GOOSE", command: "x" }], 1, "name"],
    [[{ name: "Goose", command: "  " }], 0, "command"],
    [[{ name: "", command: "x" }], 0, "name"],
    [[{ id: "claude", name: "Mine", command: "claude" }], 0, "id"],
    [[{ id: "Bad Id", name: "Mine", command: "x" }], 0, "id"],
    [[{ id: "a", name: "A", command: "a" }, { id: "a", name: "B", command: "b" }], 1, "id"],
    [[{ name: "A", command: "a", args: ["--x", 1] }], 0, "args"],
    [[{ name: "A", command: "a", models: [{ label: "no id" }] }], 0, "models"],
    [[{ name: "A", command: "a" }, "text"], 1, ""],
  ];
  for (const [list, index, field] of cases) {
    const out = validateForSave(list);
    assert.ok(out.error, JSON.stringify(list));
    assert.equal(out.index, index, JSON.stringify(list));
    assert.equal(out.field, field, JSON.stringify(list));
  }
  assert.equal(validateForSave({}).field, "agents");
  assert.equal(validateForSave(Array.from({ length: MAX_AGENTS + 1 }, (_, i) => ({ name: `A${i}`, command: "a" }))).field, "agents");
});

test("an id the form already carries is never handed to a new entry", () => {
  const { agents } = validateForSave([{ name: "Goose", command: "a" }, { id: "goose", name: "Other", command: "b" }]);
  assert.deepEqual(agents.map((a) => a.id), ["goose-2", "goose"]);
});
