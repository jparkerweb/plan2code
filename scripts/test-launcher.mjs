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
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
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

test("launcher: mergeModels keeps the shipped list first and drops user duplicates", () => {
  const { mergeModels, modelEntries } = require(LAUNCHER);
  const shipped = [{ id: "a", label: "A" }, { id: "b", label: "B" }];
  const user = [{ id: "b", label: "B old" }, { id: "c", label: "C" }, { id: "c", label: "C again" }];
  assert.deepEqual(mergeModels(shipped, user), [...shipped, { id: "c", label: "C" }]);
  assert.deepEqual(mergeModels(shipped, []), shipped);
  // A missing or corrupt user file yields no additions rather than an error.
  assert.deepEqual(modelEntries(null, "devin"), []);
  assert.deepEqual(modelEntries({ devin: "nope" }, "devin"), []);
  assert.deepEqual(modelEntries({ devin: [{ id: 1 }, null, { id: "ok", label: "Ok" }] }, "devin"), [{ id: "ok", label: "Ok" }]);
});

test("launcher: the shipped models.json is curated Devin at low/medium/high only", () => {
  const shipped = JSON.parse(fs.readFileSync(path.join(path.dirname(LAUNCHER), "models.json"), "utf8"));
  assert.ok(shipped.claude.length > 0);
  assert.ok(shipped.devin.length > 0 && shipped.devin.length <= 30);
  for (const { id, label } of shipped.devin) {
    assert.ok(id && label);
    assert.doesNotMatch(id, /(xhigh|max|fast|priority)$/);
  }
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
test("launcher: renderBanner draws Planny and the name, colored only through paint", () => {
  const { renderBanner, paint } = require(LAUNCHER);
  const plain = renderBanner(paint(false));
  assert.doesNotMatch(plain, /\x1b/);
  for (const part of ["╭───╮", "╰┬─┬╯", "★", "Plan2Code"]) assert.ok(plain.includes(part), part);
  assert.ok(plain.split("\n").length >= 4);
  const colored = renderBanner(paint(true));
  assert.ok(colored.includes("\x1b["));
  assert.ok(colored.includes("\x1b[0m"));
});

test("launcher: paint wraps text in the escape codes only when color is on", () => {
  const { paint } = require(LAUNCHER);
  assert.equal(paint(false).red("x"), "x");
  assert.equal(paint(true).red("x"), "\x1b[31mx\x1b[0m");
});

test("launcher: a piped run prints no escape codes, with or without NO_COLOR", (t) => {
  const box = sandbox(["claude"]);
  t.after(box.cleanup);
  const none = sandbox([]);
  t.after(none.cleanup);
  for (const env of [{}, { NO_COLOR: "1" }]) {
    const runs = [box.run([], env), box.run(["--cli", "bogus"], env), none.run([], env)];
    assert.deepEqual(runs.map((r) => r.status), [0, 2, 127]);
    for (const r of runs) {
      assert.doesNotMatch(r.stdout, /\x1b/);
      assert.doesNotMatch(r.stderr, /\x1b/);
    }
  }
});

