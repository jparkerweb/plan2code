// run-check.mjs: the four outcomes, the process-tree kill on timeout, the log
// and the tail cap. Runs src/skill-scripts/run-check.mjs directly until a
// skill ships it. See skill-script-helpers.mjs for the fixtures.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, NOW, scrubbedEnv, tmp, write } from "./skill-script-helpers.mjs";

const SCRIPT = path.join(ROOT, "src", "skill-scripts", "run-check.mjs");
const NODE = `"${process.execPath}"`;

function runShared(args, { cwd } = {}) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: cwd || ROOT, encoding: "utf8", env: scrubbedEnv({ PLAN2CODE_NOW: NOW }) });
  let json = null;
  try {
    json = JSON.parse(r.stdout);
  } catch {}
  return { code: r.status, json, stdout: r.stdout, stderr: r.stderr };
}

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

test("run-check: passed on exit 0", () => {
  const r = runShared(["--cmd", `${NODE} -e "process.exit(0)"`]);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.outcome, "passed");
  assert.equal(r.json.exit, 0);
  assert.equal(r.json.cwd, ".");
  assert.equal(typeof r.json.seconds, "number");
  assert.equal(r.json.log, null);
});

test("run-check: failed on exit 1, with the printed lines in the tail", () => {
  const dir = tmp("check-fail");
  write(dir, "fail.js", "console.log('first line');\nconsole.error('second line');\nprocess.exit(1);\n");
  const r = runShared(["--cmd", `${NODE} fail.js`, "--cwd", dir]);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.outcome, "failed");
  assert.equal(r.json.exit, 1);
  assert.ok(r.json.tail.includes("first line"), JSON.stringify(r.json.tail));
  assert.ok(r.json.tail.includes("second line"), JSON.stringify(r.json.tail));
});

test("run-check: not-started for a made-up command and for a missing --cwd", () => {
  const r = runShared(["--cmd", "p2c-no-such-command-xyz --flag"]);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.outcome, "not-started");
  assert.equal(r.json.reason, "command-not-found");
  const c = runShared(["--cmd", `${NODE} -e "process.exit(0)"`, "--cwd", path.join(tmp("check-cwd"), "missing")]);
  assert.equal(c.code, 0, c.stderr);
  assert.equal(c.json.outcome, "not-started");
  assert.equal(c.json.reason, "cwd-missing");
});

test("run-check: timeout kills the whole process tree", async () => {
  const dir = tmp("check-timeout");
  write(dir, "grandchild.js", "require('fs').writeFileSync(require('path').join(__dirname, 'pid.txt'), String(process.pid));\nsetInterval(() => {}, 1000);\n");
  write(dir, "parent.js", "require('child_process').spawn(process.execPath, [require('path').join(__dirname, 'grandchild.js')], { stdio: 'inherit' });\nsetInterval(() => {}, 1000);\n");
  const r = runShared(["--cmd", `${NODE} parent.js`, "--cwd", dir, "--timeout", "2"]);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.outcome, "timeout");
  const pidFile = path.join(dir, "pid.txt");
  assert.ok(fs.existsSync(pidFile), "the grandchild started");
  const pid = Number(fs.readFileSync(pidFile, "utf8"));
  const until = Date.now() + 5000;
  while (alive(pid) && Date.now() < until) await new Promise((res) => setTimeout(res, 100));
  assert.equal(alive(pid), false, `grandchild ${pid} is gone`);
});

test("run-check: --log holds the full output and the tail keeps 60 lines of at most 400 characters", () => {
  const dir = tmp("check-log");
  write(dir, "many.js", "for (let i = 1; i <= 100; i++) console.log('line ' + i);\nconsole.log('x'.repeat(500));\n");
  const log = path.join(dir, "logs", "deep", "run.log");
  const r = runShared(["--cmd", `${NODE} many.js`, "--cwd", dir, "--log", log]);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.outcome, "passed");
  assert.equal(r.json.log, log);
  const full = fs.readFileSync(log, "utf8").split(/\r?\n/).filter(Boolean);
  assert.equal(full.length, 101);
  assert.equal(full[0], "line 1");
  assert.equal(r.json.tail.length, 60);
  assert.equal(r.json.tail[0], "line 42");
  assert.equal(r.json.tail[59].length, 400);
  assert.deepEqual(fs.readdirSync(dir).sort(), ["logs", "many.js"], "nothing written outside --log");
});

test("run-check: bad arguments exit 2", () => {
  assert.equal(runShared([]).code, 2);
  assert.equal(runShared(["--cmd", "x", "--timeout", "soon"]).code, 2);
  assert.equal(runShared(["--cmd", "x", "--timeout", "0"]).code, 2);
  assert.equal(runShared(["--cmd", "x", "--timeout", "86401"]).code, 2, "past one day the timer would overflow");
  assert.equal(runShared(["--cmd", "x", "extra"]).code, 2);
});

test("run-check and test-commands do nothing when imported", () => {
  for (const file of ["run-check.mjs", "test-commands.mjs"]) {
    const url = new URL(`file:///${path.join(ROOT, "src", "skill-scripts", file).replace(/\\/g, "/")}`).href;
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", `await import(${JSON.stringify(url)});`], { encoding: "utf8", env: scrubbedEnv() });
    assert.equal(r.status, 0, `${file}: ${r.stderr}`);
    assert.equal(r.stdout, "", `${file} printed nothing on import`);
  }
});
