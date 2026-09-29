// Tests for the global `plan2code` launcher. Run with: node --test scripts/test-launcher.mjs
//
// The launcher is a script that runs on load, so each test spawns it for real: a temp home
// for ~/.plan2code/launcher.json, and stand-in `claude` / `devin` commands on PATH that
// record the arguments they were started with. stdin is a pipe, never a TTY, so the launcher
// takes its no-prompt path: no menu and no wait at the model notice.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LAUNCHER = path.join(ROOT, "src", "launcher", "plan2code.js");
const IS_WINDOWS = process.platform === "win32";
const NOTICE = "will use the model you last used in it";

/** A temp home and a bin dir holding stand-ins for `clis`; each writes its args to <bin>/<cli>.json. */
function sandbox(clis) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-launcher-"));
  const home = path.join(dir, "home");
  const bin = path.join(dir, "bin");
  fs.mkdirSync(home);
  fs.mkdirSync(bin);
  const recorder = path.join(bin, "record.js");
  fs.writeFileSync(
    recorder,
    'require("fs").writeFileSync(require("path").join(__dirname, process.argv[2] + ".json"), JSON.stringify(process.argv.slice(3)));\n' +
      "process.exitCode = Number(process.env.P2C_TEST_EXIT || 0);\n"
  );
  for (const cli of clis) {
    if (IS_WINDOWS) {
      fs.writeFileSync(path.join(bin, `${cli}.cmd`), `@"${process.execPath}" "${recorder}" ${cli} %*\r\n`);
    } else {
      const file = path.join(bin, cli);
      fs.writeFileSync(file, `#!/bin/sh\nexec "${process.execPath}" "${recorder}" ${cli} "$@"\n`);
      fs.chmodSync(file, 0o755);
    }
  }
  return {
    home,
    stateFile: path.join(home, ".plan2code", "launcher.json"),
    run: (args, env = {}) =>
      spawnSync(process.execPath, [LAUNCHER, ...args], {
        cwd: dir,
        input: "",
        encoding: "utf8",
        env: { ...process.env, PATH: bin, HOME: home, USERPROFILE: home, ...env },
      }),
    argsOf: (cli) => {
      const file = path.join(bin, `${cli}.json`);
      return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
    },
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

test("launcher: Claude Code gets the prompt first, then bypassPermissions and the forwarded args", (t) => {
  const box = sandbox(["claude"]);
  t.after(box.cleanup);
  const result = box.run(["--verbose"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(box.argsOf("claude"), ["/plan2code", "--permission-mode", "bypassPermissions", "--verbose"]);
  assert.match(result.stdout, new RegExp(`Claude Code ${NOTICE}`));
});

test("launcher: Devin keeps its args ahead of the -- and the prompt", (t) => {
  const box = sandbox(["devin"]);
  t.after(box.cleanup);
  const result = box.run(["--verbose"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(box.argsOf("devin"), ["--permission-mode", "bypass", "--verbose", "--", "/plan2code"]);
});

test("launcher: a forwarded --model skips the model notice", (t) => {
  const box = sandbox(["claude"]);
  t.after(box.cleanup);
  for (const args of [["--model", "opus"], ["--model=opus"]]) {
    const result = box.run(args);
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, new RegExp(NOTICE));
    assert.deepEqual(box.argsOf("claude"), ["/plan2code", "--permission-mode", "bypassPermissions", ...args]);
  }
});

test("launcher: --cli picks the CLI and is never forwarded; the pick is merged into launcher.json", (t) => {
  const box = sandbox(["claude", "devin"]);
  t.after(box.cleanup);
  fs.mkdirSync(path.dirname(box.stateFile), { recursive: true });
  fs.writeFileSync(box.stateFile, JSON.stringify({ lastFolder: box.home }));

  for (const args of [["--cli", "devin"], ["--cli=DEVIN"]]) {
    const result = box.run(args);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(box.argsOf("devin"), ["--permission-mode", "bypass", "--", "/plan2code"]);
  }
  assert.equal(box.argsOf("claude"), null);
  assert.deepEqual(JSON.parse(fs.readFileSync(box.stateFile, "utf8")), { lastFolder: box.home, lastCli: "devin" });
});

test("launcher: with both installed and no terminal to ask in, the last pick wins", (t) => {
  const box = sandbox(["claude", "devin"]);
  t.after(box.cleanup);
  fs.mkdirSync(path.dirname(box.stateFile), { recursive: true });
  fs.writeFileSync(box.stateFile, JSON.stringify({ lastCli: "devin" }));
  assert.equal(box.run([]).status, 0);
  assert.notEqual(box.argsOf("devin"), null);
  assert.equal(box.argsOf("claude"), null);
});

test("launcher: an unknown --cli exits 2, a missing CLI 127, and nothing is started", (t) => {
  const box = sandbox(["claude"]);
  t.after(box.cleanup);

  const unknown = box.run(["--cli", "bogus"]);
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /--cli takes claude or devin, not "bogus"/);

  const missing = box.run(["--cli", "devin"]);
  assert.equal(missing.status, 127);
  assert.match(missing.stderr, /the `devin` CLI was not found/);

  assert.equal(box.argsOf("claude"), null);
});

test("launcher: with neither CLI installed it exits 127 naming both", (t) => {
  const box = sandbox([]);
  t.after(box.cleanup);
  const result = box.run([]);
  assert.equal(result.status, 127);
  assert.match(result.stderr, /neither `claude` nor `devin` was found/);
});

test("launcher: a forwarded argument with a space and a cmd metacharacter arrives unchanged", (t) => {
  // On Windows the stand-in is a .cmd, so this goes through the cmd.exe quoting in quoteForCmd.
  const box = sandbox(["claude"]);
  t.after(box.cleanup);
  const result = box.run(["--append-system-prompt", "a b&c"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(box.argsOf("claude"), ["/plan2code", "--permission-mode", "bypassPermissions", "--append-system-prompt", "a b&c"]);
});

test("launcher: the CLI's non-zero exit code is passed through", (t) => {
  const box = sandbox(["claude"]);
  t.after(box.cleanup);
  const result = box.run([], { P2C_TEST_EXIT: "7" });
  assert.equal(result.status, 7, result.stderr);
  assert.notEqual(box.argsOf("claude"), null);
});
