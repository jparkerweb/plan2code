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
function sandbox(clis, { installed, project = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-launcher-"));
  // `dir` is the launcher's cwd below; mark it as a project so the project-confirmation gate
  // does not fire in every other test here. The gate's own tests pass `project: false`.
  if (project) fs.writeFileSync(path.join(dir, "AGENTS.md"), "");
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
  // A stand-in for the desktop app that records its arguments like the CLIs do. It is not
  // on PATH: the launcher finds it through PLAN2CODE_APP, set only for the run that wants it.
  const appDir = path.join(dir, "app");
  fs.mkdirSync(appDir);
  const appFile = path.join(appDir, IS_WINDOWS ? "stand-in-app.cmd" : "stand-in-app");
  if (IS_WINDOWS) {
    // The first line leaves the sandbox folder (the app's working directory) so nothing holds it open.
    fs.writeFileSync(appFile, `@cd /d "${os.tmpdir()}"\r\n@"${process.execPath}" "${recorder}" app %*\r\n`);
  } else {
    fs.writeFileSync(appFile, `#!/bin/sh\ncd "${os.tmpdir()}" && exec "${process.execPath}" "${recorder}" app "$@"\n`);
    fs.chmodSync(appFile, 0o755);
  }
  // One that starts and dies at once, as a program with a missing system library does.
  const crashFile = path.join(appDir, IS_WINDOWS ? "crashing-app.cmd" : "crashing-app");
  if (IS_WINDOWS) {
    fs.writeFileSync(crashFile, "@exit /b 3\r\n");
  } else {
    fs.writeFileSync(crashFile, "#!/bin/sh\nexit 3\n");
    fs.chmodSync(crashFile, 0o755);
  }
  return {
    dir,
    home,
    appFile,
    crashFile,
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
    // The app starts detached and the launcher exits at once, so its record can land a moment later.
    appArgs: () => {
      const file = path.join(bin, "app.json");
      for (let waited = 0; waited < 10000 && !fs.existsSync(file); waited += 50) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
      }
      return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
    },
    appExists: () => fs.existsSync(path.join(bin, "app.json")),
    // A detached release-check refresh may still be writing its cache; retry rather than fail.
    // The stand-in app runs detached with the sandbox as its folder, so on Windows it can hold
    // the directory for a moment after its record lands, and rmSync's own retries give up on
    // that EPERM at once. Try again for a few seconds; a temp folder left behind is harmless.
    cleanup: () => {
      for (let attempt = 0; attempt < 25; attempt++) {
        try {
          return fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
        } catch {
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
        }
      }
    },
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

test("launcher: with no CLI installed it exits 127 and explains how to get one and how to run the skill from an agent", (t) => {
  const box = sandbox([]);
  t.after(box.cleanup);
  const result = box.run([]);
  assert.equal(result.status, 127);
  assert.match(result.stderr, /Plan2Code runs inside an AI coding agent CLI, and none was found/);
  // Every built-in's label, install command and official page.
  for (const part of [
    "Claude Code: npm i -g @anthropic-ai/claude-code",
    "https://code.claude.com/docs/en/setup",
    "Codex: npm i -g @openai/codex",
    "https://github.com/openai/codex",
    "Devin: https://devin.ai",
    "https://docs.devin.ai/work-with-devin/devin-cli",
  ]) {
    assert.ok(result.stderr.includes(part), part);
  }
  assert.ok(result.stderr.includes("Add it in User Preferences (web console) under Agents, then run `plan2code` again."));
  assert.ok(result.stderr.includes("type /plan2code ($plan2code in Codex)"));
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


// The desktop app hand-off. The stand-in app is found through PLAN2CODE_APP; "no display" is
// only something a Linux run can ask for, since Windows and macOS always count as having one.
const NO_DISPLAY = { DISPLAY: "", WAYLAND_DISPLAY: "" };
const CLASSIC_ARGS = ["/plan2code", "--permission-mode", "bypassPermissions"];

test("launcher app: with no app installed the agent starts exactly as before", (t) => {
  const box = sandbox(["claude"]);
  t.after(box.cleanup);
  const result = box.run([]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(box.argsOf("claude"), CLASSIC_ARGS);
  assert.equal(box.appExists(), false);
});

test("launcher app: --classic runs today's flow even with the app installed, and is never forwarded", (t) => {
  const box = sandbox(["claude"]);
  t.after(box.cleanup);
  const result = box.run(["--classic", "--verbose"], { PLAN2CODE_APP: box.appFile });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(box.argsOf("claude"), [...CLASSIC_ARGS, "--verbose"]);
  assert.equal(box.appExists(), false);
});

test("launcher app: no display on Linux runs today's flow even with the app installed", { skip: process.platform !== "linux" }, (t) => {
  const box = sandbox(["claude"]);
  t.after(box.cleanup);
  const result = box.run([], { PLAN2CODE_APP: box.appFile, ...NO_DISPLAY });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(box.argsOf("claude"), CLASSIC_ARGS);
  assert.equal(box.appExists(), false);
});

test("launcher app: with the app and a display it starts the app on the folder, agent and model, and no agent", (t) => {
  const box = sandbox(["claude", "codex"]);
  t.after(box.cleanup);
  const display = process.platform === "linux" ? { DISPLAY: ":0" } : {};
  const result = box.run(["--cli", "codex", "--model", "gpt-5"], { PLAN2CODE_APP: box.appFile, ...display });
  assert.equal(result.status, 0, result.stderr);
  const appArgs = box.appArgs();
  assert.ok(appArgs, "the stand-in app was never started");
  // The launcher runs in the sandbox folder, so that folder is the project.
  assert.equal(appArgs[0], "--project");
  assert.equal(fs.realpathSync(appArgs[1]), fs.realpathSync(box.dir));
  assert.deepEqual(appArgs.slice(2), ["--agent", "codex", "--model", "gpt-5"]);
  assert.equal(box.argsOf("claude"), null);
  assert.equal(box.argsOf("codex"), null);
  assert.match(result.stdout, /Opened the Plan2Code app/);
});

test("launcher app: a model is left out of the app's arguments when none was chosen", (t) => {
  const box = sandbox(["claude"]);
  t.after(box.cleanup);
  const display = process.platform === "linux" ? { DISPLAY: ":0" } : {};
  const result = box.run([], { PLAN2CODE_APP: box.appFile, ...display });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(box.appArgs().slice(2), ["--agent", "claude"]);
});

test("launcher app: an app that cannot start falls back to the terminal flow", (t) => {
  const box = sandbox(["claude"]);
  t.after(box.cleanup);
  const display = process.platform === "linux" ? { DISPLAY: ":0" } : {};
  // Present but not runnable (no execute bit on POSIX, not a program on Windows).
  const broken = path.join(path.dirname(box.appFile), IS_WINDOWS ? "broken.exe" : "broken");
  fs.writeFileSync(broken, "not a program");
  const result = box.run([], { PLAN2CODE_APP: broken, ...display });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /could not start the app/);
  assert.deepEqual(box.argsOf("claude"), CLASSIC_ARGS);
});

test("launcher app: modelFrom reads --model, --model= and Codex's -m", () => {
  const { modelFrom } = require(LAUNCHER);
  assert.equal(modelFrom(["--model", "x"], "claude"), "x");
  assert.equal(modelFrom(["--model=x"], "claude"), "x");
  assert.equal(modelFrom(["-m", "x"], "codex"), "x");
  assert.equal(modelFrom(["-m=x"], "codex"), "x");
  assert.equal(modelFrom(["-m", "x"], "claude"), null);
  assert.equal(modelFrom(["--verbose"], "claude"), null);
});

test("launcher app: an app that starts and then exits with a failure falls back to the terminal flow", (t) => {
  const box = sandbox(["claude"]);
  t.after(box.cleanup);
  const display = process.platform === "linux" ? { DISPLAY: ":0" } : {};
  const result = box.run([], { PLAN2CODE_APP: box.crashFile, ...display });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /the app exited at once \(code 3\)/);
  assert.deepEqual(box.argsOf("claude"), CLASSIC_ARGS);
  assert.doesNotMatch(result.stdout, /Opened the Plan2Code app/);
});

test("launcher app: hasDisplay refuses an SSH session on Windows and macOS, but Linux only cares about DISPLAY", () => {
  const launcherPath = require.resolve(LAUNCHER);
  const realPlatform = process.platform;
  const saved = {
    DISPLAY: process.env.DISPLAY,
    WAYLAND_DISPLAY: process.env.WAYLAND_DISPLAY,
    SSH_CONNECTION: process.env.SSH_CONNECTION,
    SSH_TTY: process.env.SSH_TTY,
  };
  for (const key of Object.keys(saved)) delete process.env[key];

  // IS_WINDOWS/IS_MAC are consts captured from process.platform at require time, so testing a
  // platform other than this machine's needs a fresh module instance loaded under a faked one.
  function hasDisplayOn(platform) {
    Object.defineProperty(process, "platform", { value: platform, configurable: true });
    delete require.cache[launcherPath];
    try {
      return require(LAUNCHER).hasDisplay();
    } finally {
      Object.defineProperty(process, "platform", { value: realPlatform, configurable: true });
      delete require.cache[launcherPath];
    }
  }

  try {
    for (const platform of ["win32", "darwin"]) {
      assert.equal(hasDisplayOn(platform), true, platform);
      process.env.SSH_CONNECTION = "10.0.0.1 51000 10.0.0.2 22";
      assert.equal(hasDisplayOn(platform), false, `${platform} SSH_CONNECTION`);
      delete process.env.SSH_CONNECTION;
      process.env.SSH_TTY = "/dev/ttys000";
      assert.equal(hasDisplayOn(platform), false, `${platform} SSH_TTY`);
      delete process.env.SSH_TTY;
    }
    // Linux never looks at the SSH env vars; DISPLAY/WAYLAND_DISPLAY alone still decides.
    process.env.SSH_CONNECTION = "10.0.0.1 51000 10.0.0.2 22";
    assert.equal(hasDisplayOn("linux"), false);
    process.env.DISPLAY = ":0";
    assert.equal(hasDisplayOn("linux"), true);
    delete process.env.DISPLAY;
    delete process.env.SSH_CONNECTION;
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    // Re-require with the real platform so later tests in this file see the host's own module.
    delete require.cache[launcherPath];
    require(LAUNCHER);
  }
});

test("launcher app: looksLikeProject checks for a .git entry, AGENTS.md or a specs folder", () => {
  const { looksLikeProject } = require(LAUNCHER);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-project-"));
  try {
    assert.equal(looksLikeProject(dir), false);
    fs.writeFileSync(path.join(dir, "AGENTS.md"), "");
    assert.equal(looksLikeProject(dir), true);
    fs.rmSync(path.join(dir, "AGENTS.md"));
    // A worktree's .git is a file, not a directory, and still counts.
    fs.writeFileSync(path.join(dir, ".git"), "gitdir: ../elsewhere/.git/worktrees/x\n");
    assert.equal(looksLikeProject(dir), true);
    fs.rmSync(path.join(dir, ".git"));
    assert.equal(looksLikeProject(dir), false);
    fs.mkdirSync(path.join(dir, "specs"));
    assert.equal(looksLikeProject(dir), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("launcher app: a folder that doesn't look like a project is refused without a terminal to confirm it", (t) => {
  const box = sandbox(["claude"], { project: false });
  t.after(box.cleanup);
  const result = box.run([]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /doesn't look like a project/);
  assert.equal(box.argsOf("claude"), null);
});

test("launcher app: an AGENTS.md marks the folder as a project, so the agent starts as usual", (t) => {
  const box = sandbox(["claude"]);
  t.after(box.cleanup);
  const result = box.run([]);
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stderr, /doesn't look like a project/);
  assert.notEqual(box.argsOf("claude"), null);
});

// Custom agents (~/.plan2code/agents.json). The shared fixture is the contract the console and
// the desktop app read too; the rest starts real stand-ins from a temp home.
const CASES = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", "fixtures", "agents-cases.json"), "utf8"));
const GOOSE = {
  id: "goose",
  name: "Goose",
  command: "goose",
  args: ["--yes", "{prompt}"],
  bypassArgs: ["--bypass"],
  models: [{ id: "m1", label: "Model one" }, { id: "m2" }],
};

/** Write ~/.plan2code/agents.json (an object is stringified; a string goes in as it is). */
function writeAgents(box, file) {
  const target = path.join(box.home, ".plan2code", "agents.json");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, typeof file === "string" ? file : JSON.stringify(file));
  return target;
}

const goose = (extra = {}) => ({ schema: 1, agents: [{ ...GOOSE, ...extra }] });

for (const c of CASES.files) {
  test(`launcher agents file: ${c.name}`, () => {
    const { normalizeAgents } = require(LAUNCHER);
    const { agents, warnings } = normalizeAgents(c.raw);
    assert.deepEqual(agents, c.agents);
    if (!c.warnings.length) assert.deepEqual(warnings, []);
    for (const part of c.warnings) {
      assert.ok(warnings.some((w) => w.includes(part)), `a warning names "${part}": ${JSON.stringify(warnings)}`);
    }
  });
}

for (const c of CASES.buildArgs) {
  test(`launcher buildArgs: ${c.name}`, () => {
    const { buildArgs } = require(LAUNCHER);
    assert.deepEqual(buildArgs(c.entry, c.options), c.args);
  });
}

test("launcher agents: --cli <custom id> starts it with args, the model through modelArgs, then bypassArgs and the forwarded args", (t) => {
  const box = sandbox(["claude", "goose"]);
  t.after(box.cleanup);
  writeAgents(box, goose());
  const result = box.run(["--cli", "goose", "--model", "m1", "--verbose"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(box.argsOf("goose"), ["--yes", "/plan2code", "--model", "m1", "--bypass", "--verbose"]);
  assert.equal(box.argsOf("claude"), null);
  assert.equal(JSON.parse(fs.readFileSync(box.stateFile, "utf8")).lastCli, "goose");
  // No model chosen and no models flag: the model arguments are left out.
  assert.equal(box.run(["--cli=goose"]).status, 0);
  assert.deepEqual(box.argsOf("goose"), ["--yes", "/plan2code", "--bypass"]);
});

test("launcher agents: the last pick can be a custom id, and the --cli error names custom ids", (t) => {
  const box = sandbox(["claude", "goose"]);
  t.after(box.cleanup);
  writeAgents(box, goose());
  fs.mkdirSync(path.dirname(box.stateFile), { recursive: true });
  fs.writeFileSync(box.stateFile, JSON.stringify({ lastCli: "goose" }));
  assert.equal(box.run([]).status, 0);
  assert.notEqual(box.argsOf("goose"), null);
  assert.equal(box.argsOf("claude"), null);
  const bad = box.run(["--cli", "bogus"]);
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /--cli takes claude, devin, codex or goose, not "bogus"/);
});

test("launcher agents: the model menu is the agent's own models, with no shipped list or user models.json", (t) => {
  const box = sandbox([]);
  t.after(box.cleanup);
  fs.mkdirSync(path.join(box.home, ".plan2code"), { recursive: true });
  const file = writeAgents(box, goose());
  const { customClis, listModels, hasModelFlag } = require(LAUNCHER);
  const [cli] = customClis(file, false);
  assert.deepEqual(listModels(cli), [{ id: "m1", label: "Model one" }, { id: "m2", label: "" }]);
  assert.deepEqual(listModels(customClis(writeAgents(box, goose({ models: [] })), false)[0]), []);
  // Only --model counts for a custom agent: Codex's -m does not.
  assert.equal(hasModelFlag(["--model", "x"], "goose"), true);
  assert.equal(hasModelFlag(["-m", "x"], "goose"), false);
  // A model given on the command line goes through modelArgs, once.
  assert.deepEqual(cli.args(["--model=m2", "-x"]), ["--yes", "/plan2code", "--model", "m2", "--bypass", "-x"]);
});

test("launcher agents: the menu lists the built-ins found first, then the custom agents that resolve", (t) => {
  const box = sandbox(["goose", "codex", "claude"]);
  t.after(box.cleanup);
  const file = writeAgents(box, { schema: 1, agents: [GOOSE, { id: "ghost", name: "Ghost", command: "ghost-cmd" }] });
  const { customClis, runnableClis } = require(LAUNCHER);
  const realPath = process.env.PATH;
  process.env.PATH = path.join(box.dir, "bin");
  t.after(() => {
    process.env.PATH = realPath;
  });
  const { installed, missing } = runnableClis(customClis(file, false));
  assert.deepEqual(installed.map((cli) => cli.id), ["claude", "codex", "goose"]);
  assert.deepEqual(missing.map((cli) => cli.id), ["ghost"]);
});

test("launcher agents: with no terminal to ask, a custom agent's model line names its own default", (t) => {
  const box = sandbox(["goose"]);
  t.after(box.cleanup);
  writeAgents(box, goose());
  const result = box.run(["--cli", "goose"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Goose will start with its own default model\. To pick one, run `plan2code --model <id>`\./);
  assert.doesNotMatch(result.stdout, /last used/);
});

test("launcher agents: a custom agent whose command is not found is left out and named when nothing can run", (t) => {
  const box = sandbox(["claude"]);
  t.after(box.cleanup);
  writeAgents(box, { schema: 1, agents: [{ id: "ghost", name: "Ghost", command: "ghost-cmd" }] });
  // Left out of the way: claude still starts.
  assert.equal(box.run([]).status, 0);
  assert.notEqual(box.argsOf("claude"), null);
  const asked = box.run(["--cli", "ghost"]);
  assert.equal(asked.status, 127);
  assert.match(asked.stderr, /Custom agent Ghost: ghost-cmd not found/);

  const none = sandbox([]);
  t.after(none.cleanup);
  writeAgents(none, { schema: 1, agents: [{ id: "ghost", name: "Ghost", command: "ghost-cmd" }] });
  const result = none.run([]);
  assert.equal(result.status, 127);
  assert.match(result.stderr, /Custom agent Ghost: ghost-cmd not found/);
  assert.ok(result.stderr.includes("User Preferences"));
});

test("launcher agents: a malformed agents.json warns on a terminal, never crashes, and gives no agents", (t) => {
  const box = sandbox(["claude"]);
  t.after(box.cleanup);
  const file = writeAgents(box, "{ not json");
  const { customClis } = require(LAUNCHER);
  const lines = [];
  const realError = console.error;
  console.error = (line) => lines.push(String(line));
  try {
    assert.deepEqual(customClis(file, true), []);
    assert.deepEqual(customClis(path.join(box.home, "missing.json"), true), []);
  } finally {
    console.error = realError;
  }
  assert.equal(lines.length, 1);
  assert.match(lines[0], /plan2code: agents\.json: agents\.json is not valid JSON/);
  // A piped run prints no warning, and the built-ins carry on.
  const result = box.run([]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.notEqual(box.argsOf("claude"), null);
});

test("launcher agents: the app hand-over passes a custom id and its model unchanged", (t) => {
  const box = sandbox(["goose"]);
  t.after(box.cleanup);
  writeAgents(box, goose());
  const display = process.platform === "linux" ? { DISPLAY: ":0" } : {};
  const result = box.run(["--cli", "goose", "--model", "m2"], { PLAN2CODE_APP: box.appFile, ...display });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(box.appArgs().slice(2), ["--agent", "goose", "--model", "m2"]);
  assert.equal(box.argsOf("goose"), null);
  assert.equal(JSON.parse(fs.readFileSync(box.stateFile, "utf8")).lastCli, "goose");
});

test("launcher agents: a full-path command starts, and on Windows a .cmd in a folder with a space too", (t) => {
  const box = sandbox([]);
  t.after(box.cleanup);
  const spaced = path.join(box.dir, "with space");
  fs.mkdirSync(spaced);
  const recorder = path.join(box.dir, "bin", "record.js");
  let file;
  if (IS_WINDOWS) {
    file = path.join(spaced, "spaced.cmd");
    fs.writeFileSync(file, `@"${process.execPath}" "${recorder}" spaced %*\r\n`);
    // A same-named file in the project folder (the launcher's cwd) must not run instead.
    fs.writeFileSync(path.join(box.dir, "spaced.cmd"), `@"${process.execPath}" "${recorder}" decoy %*\r\n`);
  } else {
    file = path.join(spaced, "spaced");
    fs.writeFileSync(file, `#!/bin/sh\nexec "${process.execPath}" "${recorder}" spaced "$@"\n`);
    fs.chmodSync(file, 0o755);
  }
  writeAgents(box, { schema: 1, agents: [{ id: "spaced", name: "Spaced", command: file, args: ["{prompt}"] }] });
  // Some shells already set the switch the launcher sets; the run starts without it.
  const result = box.run(["--cli", "spaced", "--note", "a b"], { NoDefaultCurrentDirectoryInExePath: undefined });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(box.argsOf("spaced"), ["/plan2code", "--note", "a b"]);
  assert.equal(box.argsOf("decoy"), null);
});
