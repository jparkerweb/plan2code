// Tests for the global `plan2code` launcher. Run with: node --test scripts/test-launcher.mjs
//
// The launcher is a script that runs on load, so each test spawns it for real: a temp home
// for ~/.plan2code/launcher.json, and stand-in `claude` / `devin` / `codex` commands on PATH that
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

/**
 * A temp home and a bin dir holding stand-ins for `clis`; each writes its args to <bin>/<cli>.json.
 * `installed: "X.Y.Z"` runs an installed copy instead, as install.js lays it out: the launcher,
 * models.json and update-check.mjs in <home>/.plan2code/bin/ beside a version.json saying X.Y.Z.
 */
function sandbox(clis, { installed } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-launcher-"));
  const home = path.join(dir, "home");
  const bin = path.join(dir, "bin");
  fs.mkdirSync(home);
  fs.mkdirSync(bin);
  const consoleHome = path.join(home, ".plan2code", "console");
  let launcher = LAUNCHER;
  if (installed) {
    const binCopy = path.join(home, ".plan2code", "bin");
    fs.mkdirSync(binCopy, { recursive: true });
    launcher = path.join(binCopy, "plan2code.js");
    fs.copyFileSync(LAUNCHER, launcher);
    fs.copyFileSync(path.join(path.dirname(LAUNCHER), "models.json"), path.join(binCopy, "models.json"));
    fs.copyFileSync(path.join(ROOT, "src", "web-console", "update-check.mjs"), path.join(binCopy, "update-check.mjs"));
    fs.writeFileSync(path.join(binCopy, "version.json"), JSON.stringify({ name: "Plan2Code", version: installed }));
  }
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
    cacheFile: path.join(consoleHome, "update-check.json"),
    run: (args, env = {}) =>
      spawnSync(process.execPath, [launcher, ...args], {
        cwd: dir,
        input: "",
        encoding: "utf8",
        env: { ...process.env, PATH: bin, HOME: home, USERPROFILE: home, PLAN2CODE_CONSOLE_HOME: consoleHome, ...env },
      }),
    argsOf: (cli) => {
      const file = path.join(bin, `${cli}.json`);
      return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
    },
    // A detached release-check refresh may still be writing its cache; retry rather than fail.
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }),
  };
}

const NOTICE_LINE = /is out \(you have v/;

/** Write the console's cached release check, `ageMs` old. */
function writeCache(box, latest, ageMs = 0) {
  fs.mkdirSync(path.dirname(box.cacheFile), { recursive: true });
  fs.writeFileSync(box.cacheFile, JSON.stringify({ checkedAt: Date.now() - ageMs, latest }));
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

test("launcher: Codex gets the bypass flag, the forwarded args, then the $plan2code prompt", (t) => {
  const box = sandbox(["codex"]);
  t.after(box.cleanup);
  const result = box.run(["--verbose"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(box.argsOf("codex"), ["--dangerously-bypass-approvals-and-sandbox", "--verbose", "$plan2code"]);
});

test("launcher: --cli codex picks Codex when it is installed beside another CLI", (t) => {
  const box = sandbox(["claude", "codex"]);
  t.after(box.cleanup);
  const result = box.run(["--cli", "codex"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(box.argsOf("claude"), null);
  assert.ok(box.argsOf("codex"));
});

test("launcher: the shipped models.json lists every CLI, and every entry has an id and a label", () => {
  const shipped = JSON.parse(fs.readFileSync(path.join(path.dirname(LAUNCHER), "models.json"), "utf8"));
  for (const cli of ["claude", "devin", "codex"]) {
    assert.ok(Array.isArray(shipped[cli]), cli);
    for (const { id, label } of shipped[cli]) assert.ok(id && label, cli);
  }
});

test("launcher: Codex takes a forwarded --model ahead of the $plan2code prompt, with no notice", (t) => {
  const box = sandbox(["codex"]);
  t.after(box.cleanup);
  const result = box.run(["--cli", "codex", "--model", "x"]);
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, new RegExp(NOTICE));
  assert.deepEqual(box.argsOf("codex"), ["--dangerously-bypass-approvals-and-sandbox", "--model", "x", "$plan2code"]);
});

test("launcher: Codex's -m counts as a model already chosen", (t) => {
  const box = sandbox(["codex"]);
  t.after(box.cleanup);
  const result = box.run(["--cli", "codex", "-m", "x"]);
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, new RegExp(NOTICE));
  assert.deepEqual(box.argsOf("codex"), ["--dangerously-bypass-approvals-and-sandbox", "-m", "x", "$plan2code"]);
});

test("launcher: hasModelFlag reads -m as a model only for Codex", () => {
  const { hasModelFlag } = require(LAUNCHER);
  for (const cli of ["claude", "devin", "codex"]) {
    assert.equal(hasModelFlag(["--model", "x"], cli), true, cli);
    assert.equal(hasModelFlag(["--model=x"], cli), true, cli);
    assert.equal(hasModelFlag(["--verbose"], cli), false, cli);
  }
  for (const args of [["-m", "x"], ["-m=x"], ["-mx"]]) {
    assert.equal(hasModelFlag(args, "codex"), true, args.join(" "));
    assert.equal(hasModelFlag(args, "claude"), false, args.join(" "));
  }
});

test("launcher: without a terminal, Codex prints the model notice", (t) => {
  const box = sandbox(["codex"]);
  t.after(box.cleanup);
  const result = box.run([]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(`Codex ${NOTICE}`));
  assert.match(result.stdout, /`codex` on its own/);
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

test("launcher: with all three installed and no terminal, a last pick of codex opens Codex", (t) => {
  const box = sandbox(["claude", "devin", "codex"]);
  t.after(box.cleanup);
  fs.mkdirSync(path.dirname(box.stateFile), { recursive: true });
  fs.writeFileSync(box.stateFile, JSON.stringify({ lastCli: "codex" }));
  assert.equal(box.run([]).status, 0);
  assert.notEqual(box.argsOf("codex"), null);
  assert.equal(box.argsOf("claude"), null);
  assert.equal(box.argsOf("devin"), null);
});

test("launcher: an unknown --cli exits 2, a missing CLI 127, and nothing is started", (t) => {
  const box = sandbox(["claude"]);
  t.after(box.cleanup);

  const unknown = box.run(["--cli", "bogus"]);
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /--cli takes claude, devin or codex, not "bogus"/);

  const missing = box.run(["--cli", "devin"]);
  assert.equal(missing.status, 127);
  assert.match(missing.stderr, /the `devin` CLI was not found/);
  assert.match(missing.stderr, /\n\nTo use Devin:\n/);
  assert.ok(missing.stderr.includes("1. Install it: https://devin.ai"));
  assert.ok(missing.stderr.includes("start Devin and type /plan2code."));
  // Only the steps for the requested CLI: no "install one of" list that contradicts it.
  assert.doesNotMatch(missing.stderr, /Install one:/);

  const missingCodex = box.run(["--cli", "codex"]);
  assert.equal(missingCodex.status, 127);
  assert.ok(missingCodex.stderr.includes("npm i -g @openai/codex"));
  assert.ok(missingCodex.stderr.includes("type $plan2code."));

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

test("launcher: with no CLI installed it exits 127 and says how to run the skill from an agent", (t) => {
  const box = sandbox([]);
  t.after(box.cleanup);
  const result = box.run([]);
  assert.equal(result.status, 127);
  assert.match(result.stderr, /none of `claude`, `devin` or `codex` was found/);
  assert.ok(result.stderr.includes("type /plan2code"));
  assert.ok(result.stderr.includes("$plan2code (Codex)"));
  assert.match(result.stderr, /cd into the project/);
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
test("launcher: update runs the npx install and starts no agent", (t) => {
  const box = sandbox(["npx", "claude"]);
  t.after(box.cleanup);
  const result = box.run(["update"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Updating Plan2Code\.\.\./);
  const args = box.argsOf("npx");
  assert.ok(args, "npx was not run");
  assert.ok(args.includes("--update"), args.join(" "));
  assert.ok(args.includes("git+https://github.com/jparkerweb/plan2code.git"), args.join(" "));
  assert.equal(box.argsOf("claude"), null);
});

test("launcher: update passes npx's exit code through", (t) => {
  const box = sandbox(["npx"]);
  t.after(box.cleanup);
  assert.equal(box.run(["update"], { P2C_TEST_EXIT: "3" }).status, 3);
});

test("launcher: release notice prints from a fresh cache", (t) => {
  const box = sandbox(["claude"], { installed: "1.0.0" });
  t.after(box.cleanup);
  writeCache(box, "9.9.9");
  const result = box.run([]);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes("Plan2Code v9.9.9 is out (you have v1.0.0). Run: plan2code update"), result.stdout);
  assert.notEqual(box.argsOf("claude"), null);
});

test("launcher: no notice when current, stale or missing, and the start does not wait", (t) => {
  // PATH holds only the stand-ins, so the detached refresh finds no git: nothing may wait on it.
  const cases = [
    ["current", (box) => writeCache(box, "1.0.0")],
    ["stale", (box) => writeCache(box, "9.9.9", 2 * 60 * 60 * 1000)],
    ["missing", () => {}],
  ];
  for (const [name, setup] of cases) {
    const box = sandbox(["claude"], { installed: "1.0.0" });
    t.after(box.cleanup);
    setup(box);
    const started = Date.now();
    const result = box.run([]);
    const took = Date.now() - started;
    assert.equal(result.status, 0, `${name}: ${result.stderr}`);
    assert.doesNotMatch(result.stdout, NOTICE_LINE, name);
    assert.notEqual(box.argsOf("claude"), null, name);
    assert.ok(took < 5000, `${name}: the start took ${took} ms`);
  }
});

test("launcher: compareVersions orders X.Y.Z numerically and refuses anything else", () => {
  const { compareVersions } = require(LAUNCHER);
  assert.equal(compareVersions("1.9.0", "1.10.0"), -1);
  assert.equal(compareVersions("2.0.0", "2.0.0"), 0);
  assert.equal(compareVersions("3.0.0", "2.9.9"), 1);
  assert.equal(compareVersions("1.0.0", null), null);
  assert.equal(compareVersions("v1.0.0", "1.0.0"), null);
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

