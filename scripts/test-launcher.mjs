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
 * models.json, update-check.mjs, agents.json and agent-lookup.mjs in <home>/.plan2code/bin/
 * beside a version.json saying X.Y.Z (`lookup: false` leaves agent-lookup.mjs out, `agents`
 * replaces agents.json's contents).
 */
function sandbox(clis, { installed, project = true, lookup = true, agents } = {}) {
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
    const agentsFile = agents || path.join(path.dirname(LAUNCHER), "agents.json");
    if (typeof agentsFile === "string" && fs.existsSync(agentsFile)) fs.copyFileSync(agentsFile, path.join(binCopy, "agents.json"));
    else if (agentsFile) fs.writeFileSync(path.join(binCopy, "agents.json"), JSON.stringify(agentsFile));
    if (lookup) fs.copyFileSync(path.join(ROOT, "src", "web-console", "agent-lookup.mjs"), path.join(binCopy, "agent-lookup.mjs"));
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
        env: { ...process.env, PATH: bin, PLAN2CODE_NO_SAVED_PATH: "1", HOME: home, USERPROFILE: home, PLAN2CODE_CONSOLE_HOME: consoleHome, ...env },
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

test("launcher: --keep-permissions keeps every built-in's permission prompts, and is never forwarded", (t) => {
  const box = sandbox(["claude", "devin", "codex"]);
  t.after(box.cleanup);
  const expected = {
    claude: ["/plan2code", "--verbose"],
    devin: ["--verbose", "--", "/plan2code"],
    codex: ["--verbose", "$plan2code"],
  };
  for (const [cli, args] of Object.entries(expected)) {
    const result = box.run(["--cli", cli, "--keep-permissions", "--verbose"]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(box.argsOf(cli), args, cli);
  }
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

test("launcher: a launched model is remembered per agent in launcher.json", (t) => {
  const box = sandbox(["claude", "codex"]);
  t.after(box.cleanup);
  fs.mkdirSync(path.dirname(box.stateFile), { recursive: true });
  fs.writeFileSync(box.stateFile, JSON.stringify({ lastFolder: box.home }));

  assert.equal(box.run(["--cli", "claude", "--model", "opus"]).status, 0);
  assert.equal(box.run(["--cli", "codex", "-m", "x"]).status, 0);
  assert.equal(box.run(["--cli", "codex", "-my"]).status, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(box.stateFile, "utf8")), {
    lastFolder: box.home,
    lastCli: "codex",
    lastModels: { claude: "opus", codex: "y" },
  });
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
  assert.ok(missing.stderr.includes("1. Install it: https://devin.ai (https://docs.devin.ai/work-with-devin/devin-cli)"));
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

test("launcher: a strengths key in the models files is never read as a model list, and every shipped strength names a listed model", () => {
  const { modelEntries, mergeModels } = require(LAUNCHER);
  const shipped = JSON.parse(fs.readFileSync(path.join(path.dirname(LAUNCHER), "models.json"), "utf8"));
  assert.ok(shipped.strengths && typeof shipped.strengths === "object");
  assert.deepEqual(modelEntries(shipped, "strengths"), []);
  const claude = modelEntries(shipped, "claude");
  assert.ok(claude.length > 0);
  const user = { claude: [{ id: "mine", label: "Mine" }], strengths: { claude: { best: { model: "mine" } } } };
  assert.deepEqual(modelEntries(user, "strengths"), []);
  assert.deepEqual(mergeModels(claude, modelEntries(user, "claude")), [...claude, { id: "mine", label: "Mine" }]);
  assert.deepEqual(mergeModels(claude, modelEntries({ claude: user.claude }, "claude")), mergeModels(claude, modelEntries(user, "claude")));
  // Only Claude Code and Devin ship a mapping, and every row names a model in that agent's list.
  assert.deepEqual(Object.keys(shipped.strengths).sort(), ["claude", "devin"]);
  for (const [agent, rows] of Object.entries(shipped.strengths)) {
    assert.deepEqual(Object.keys(rows), ["thrifty", "balanced", "best"], agent);
    const ids = new Set(shipped[agent].map((m) => m.id));
    for (const row of Object.values(rows)) assert.ok(ids.has(row.model), `${agent}: ${row.model}`);
  }
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
  assert.ok(result.stderr.includes("Add it by editing `~/.plan2code/agents.json`, then run `plan2code` again."));
  assert.doesNotMatch(result.stderr, /User Preferences/);
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

test("launcher: parseRegQueryValue reads REG_SZ and REG_EXPAND_SZ, and expandPercentVars fills in names", () => {
  const { parseRegQueryValue, expandPercentVars } = require(LAUNCHER);
  const out = "\r\nHKEY_CURRENT_USER\\Environment\r\n    Path    REG_EXPAND_SZ    %USERPROFILE%\\.pi\\agent\\bin;C:\\Tools\r\n\r\n";
  assert.equal(parseRegQueryValue(out), "%USERPROFILE%\\.pi\\agent\\bin;C:\\Tools");
  assert.equal(parseRegQueryValue("    Path    REG_SZ    C:\\A\r\n"), "C:\\A");
  assert.equal(parseRegQueryValue("ERROR: The system was unable to find the specified registry key or value.\r\n"), null);
  assert.equal(expandPercentVars("%userprofile%\\x;%NOPE%\\y", { USERPROFILE: "C:\\Users\\me" }), "C:\\Users\\me\\x;%NOPE%\\y");
});

// A terminal opened before an agent's installer added its folder keeps the old PATH: the
// launcher reads the saved one too, so a custom agent is offered in every terminal.
test("launcher: on Windows the saved user PATH fills in folders the inherited PATH lacks", { skip: !IS_WINDOWS }, (t) => {
  const { addSavedWindowsPath, parseRegQueryValue, expandPercentVars } = require(LAUNCHER);
  const reg = spawnSync(path.join(process.env.SystemRoot, "System32", "reg.exe"), ["query", "HKCU\\Environment", "/v", "Path"], { encoding: "utf8" });
  const saved = parseRegQueryValue(reg.stdout);
  if (!saved) return t.skip("no user PATH saved in the registry");
  const first = expandPercentVars(saved).split(";").find(Boolean);
  const pathKey = Object.keys(process.env).find((key) => key.toUpperCase() === "PATH");
  const before = { PATH: process.env[pathKey], NO: process.env.PLAN2CODE_NO_SAVED_PATH };
  t.after(() => {
    process.env[pathKey] = before.PATH;
    if (before.NO === undefined) delete process.env.PLAN2CODE_NO_SAVED_PATH;
    else process.env.PLAN2CODE_NO_SAVED_PATH = before.NO;
  });
  delete process.env.PLAN2CODE_NO_SAVED_PATH;
  process.env[pathKey] = "C:\\stale-terminal-path";
  addSavedWindowsPath();
  const dirs = process.env[pathKey].split(";");
  assert.equal(dirs[0], "C:\\stale-terminal-path", "the inherited PATH keeps its place in front");
  assert.ok(dirs.includes(first), `${first} is added from the saved PATH`);
  const length = dirs.length;
  addSavedWindowsPath();
  assert.equal(process.env[pathKey].split(";").length, length, "a second call adds nothing twice");
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
  assert.equal(modelFrom(["-mx"], "codex"), "x");
  assert.equal(modelFrom(["-m"], "codex"), null);
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
  // --keep-permissions leaves bypassArgs out.
  assert.equal(box.run(["--cli=goose", "--keep-permissions"]).status, 0);
  assert.deepEqual(box.argsOf("goose"), ["--yes", "/plan2code"]);
});

test("launcher agents: a custom agent with no bypassArgs is never asked about prompts and starts with its own", (t) => {
  const box = sandbox(["goose"]);
  t.after(box.cleanup);
  writeAgents(box, goose({ bypassArgs: [] }));
  const result = box.run(["--cli", "goose"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(box.argsOf("goose"), ["--yes", "/plan2code"]);
  assert.doesNotMatch(result.stdout, /permission prompts off/);
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
  assert.deepEqual(cli.args(["--model=m2", "-x"], { bypass: true }), ["--yes", "/plan2code", "--model", "m2", "--bypass", "-x"]);
  assert.deepEqual(cli.args(["-x"]), ["--yes", "/plan2code", "-x"]);
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
  assert.ok(result.stderr.includes("agents.json"));
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

/* ------------------------- the shipped agent list (installed layout) ------------------------- */

const OS_KEY = IS_WINDOWS ? "win" : process.platform === "darwin" ? "mac" : "linux";
const SHIPPED_AGENTS = JSON.parse(fs.readFileSync(path.join(path.dirname(LAUNCHER), "agents.json"), "utf8"));
const builtin = (id) => SHIPPED_AGENTS.agents.find((a) => a.id === id);
const leadRun = (id) => builtin(id).install[OS_KEY][0].run;

test("launcher list: the menu and launch come from the sandboxed agents.json + agent-lookup.mjs", (t) => {
  const box = sandbox(["claude", "devin", "codex"], { installed: "0.0.0" });
  t.after(box.cleanup);
  const result = box.run(["--cli", "devin", "--verbose"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(box.argsOf("devin"), ["--permission-mode", "bypass", "--verbose", "--", "/plan2code"]);
  // The menu's order and shape come from the list: --cli errors list the same ids.
  const bad = box.run(["--cli", "bogus"]);
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /--cli takes claude, devin or codex, not "bogus"/);
});

test("launcher list: a forwarded --model fills {model} in place; Codex's -m forwards untouched", (t) => {
  const box = sandbox(["claude", "codex"], { installed: "0.0.0" });
  t.after(box.cleanup);
  assert.equal(box.run(["--cli", "claude", "--model", "opus"]).status, 0);
  assert.deepEqual(box.argsOf("claude"), ["/plan2code", "--permission-mode", "bypassPermissions", "--model", "opus"]);
  assert.equal(box.run(["--cli", "codex", "-m", "x"]).status, 0);
  assert.deepEqual(box.argsOf("codex"), ["--dangerously-bypass-approvals-and-sandbox", "-m", "x", "$plan2code"]);
});

test("launcher list: the last-used notice names the gone agent and the pick, on a terminal only", () => {
  const { lastUsedNotice } = require(LAUNCHER);
  const all = [
    { id: "claude", label: "Claude Code" },
    { id: "devin", label: "Devin" },
  ];
  const installed = [all[0]];
  assert.equal(lastUsedNotice(installed, all, "devin"), "Devin (last used) was not found, using Claude Code");
  assert.equal(lastUsedNotice(installed, all, "claude"), null, "still runnable");
  assert.equal(lastUsedNotice(installed, all, "ghost"), "ghost (last used) was not found, using Claude Code");
  assert.equal(lastUsedNotice([], all, "devin"), null, "nothing to use");
  assert.equal(lastUsedNotice(installed, all, undefined), null);
});

test("launcher list: a missing agent-lookup.mjs falls back to the built-in list", (t) => {
  const box = sandbox(["claude"], { installed: "0.0.0", lookup: false });
  t.after(box.cleanup);
  const result = box.run([]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(box.argsOf("claude"), ["/plan2code", "--permission-mode", "bypassPermissions"]);
});

test("launcher list: with no agent and no terminal it prints this OS's install steps and exits 127", (t) => {
  const box = sandbox([], { installed: "0.0.0" });
  t.after(box.cleanup);
  const result = box.run([]);
  assert.equal(result.status, 127);
  for (const id of ["claude", "devin", "codex"]) {
    assert.ok(result.stderr.includes(leadRun(id)), `${id}: ${leadRun(id)}`);
    assert.ok(result.stderr.includes(builtin(id).installUrl), id);
  }
  assert.ok(result.stderr.includes("add another agent by editing `~/.plan2code/agents.json`, then run `plan2code` again") || result.stderr.includes("Add it by editing `~/.plan2code/agents.json`, then run `plan2code` again."));
  assert.doesNotMatch(result.stderr, /User Preferences/);
});

test("launcher list: --cli for a missing built-in prints its lead install line and exits 127", (t) => {
  const box = sandbox(["claude"], { installed: "0.0.0" });
  t.after(box.cleanup);
  const result = box.run(["--cli", "devin"]);
  assert.equal(result.status, 127);
  assert.match(result.stderr, /the `devin` CLI was not found/);
  assert.ok(result.stderr.includes(leadRun("devin")), leadRun("devin"));
  assert.ok(result.stderr.includes(builtin("devin").installUrl));
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

/* ------------------------- first-run setup (the browser setup page) ------------------------- */

// When no agent can run and a person can see a page, the launcher opens the console's
// agent-less `setup` workflow (`open --workflow setup`, plus `--for-cli` when one agent
// was asked for), then waits on the session until a send carries `__start`. These drive
// runSetupFlow() directly against a stand-in console.mjs that records each call and
// answers `wait` from a step list in P2C_FAKE_STEPS.

// The app-window variables scrubbedEnv() must strip from the console child (NFR-2).
const APP_VARS = [
  "PLAN2CODE_IN_APP",
  "PLAN2CODE_APP_TOKEN",
  "PLAN2CODE_APP_ANNOUNCE",
  "PLAN2CODE_EMBED_ORIGIN",
  "PLAN2CODE_CONSOLE_SID",
  "PLAN2CODE_APP_VERSION",
];

// The stand-in console: every call is recorded (argv plus which app vars leaked through),
// `open` prints a setup session's JSON, `wait` plays back the numbered step. A step the
// test forgot to write ends as a Cancel rather than hanging the four-hour cap.
const FAKE_CONSOLE = [
  'import fs from "node:fs";',
  'import path from "node:path";',
  'const dir = path.dirname(process.argv[1]);',
  `const APP = ${JSON.stringify(APP_VARS)};`,
  'fs.appendFileSync(path.join(dir, "calls.jsonl"), JSON.stringify({ argv: process.argv.slice(2), appVars: APP.filter((k) => k in process.env) }) + "\\n");',
  'if (process.argv[2] === "open") {',
  '  console.log(JSON.stringify({ sid: "setup-sid", url: "http://127.0.0.1:9/s/signtok/", setup: { url: "http://127.0.0.1:9/s/signtok/", token: "handover-tok" } }));',
  '} else if (process.argv[2] === "wait") {',
  '  const file = path.join(dir, "waits");',
  '  const n = fs.existsSync(file) ? Number(fs.readFileSync(file, "utf8")) : 0;',
  '  fs.writeFileSync(file, String(n + 1));',
  '  const steps = JSON.parse(process.env.P2C_FAKE_STEPS || "[]");',
  '  const step = steps[n] || { exit: 30 };',
  '  if (step.print) console.log(JSON.stringify(step.print));',
  '  process.exit(step.exit === undefined ? 0 : step.exit);',
  '}',
].join("\n");

// A folder holding the stand-in console.mjs (the wait counter lives beside it); calls()
// replays what it was asked, oldest first.
function setupConsoleDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-setup-console-"));
  fs.writeFileSync(path.join(dir, "console.mjs"), FAKE_CONSOLE);
  return {
    dir,
    calls: () =>
      fs.existsSync(path.join(dir, "calls.jsonl"))
        ? fs.readFileSync(path.join(dir, "calls.jsonl"), "utf8").trim().split("\n").map(JSON.parse)
        : [],
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

// Point the console search at the stand-in and hand it the wait steps; restores
// PLAN2CODE_CONSOLE_DIR, P2C_FAKE_STEPS and any app vars `extra` set afterwards.
function setupEnv(t, dir, steps, extra = {}) {
  const keys = ["PLAN2CODE_CONSOLE_DIR", "P2C_FAKE_STEPS", ...APP_VARS];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  process.env.PLAN2CODE_CONSOLE_DIR = dir;
  process.env.P2C_FAKE_STEPS = JSON.stringify(steps);
  for (const [k, v] of Object.entries(extra)) process.env[k] = v;
  t.after(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });
}

// A builtin-shaped list for runSetupFlow's re-lookup, and the send that starts claude.
const SETUP_CLIS = [{ id: "claude", label: "Claude Code", entry: { command: "claude" } }];
const START_CLAUDE = { print: { session: [{ i: "__start", agent: "claude" }] }, exit: 0 };
const foundAt = (file) => () => ({ state: "found", path: file });

test("launcher setup: a Start re-finds the agent and hands back the announce address and token", (t) => {
  const box = setupConsoleDir();
  t.after(box.cleanup);
  setupEnv(t, box.dir, [START_CLAUDE]);
  const { runSetupFlow } = require(LAUNCHER);
  const agentPath = path.join(box.dir, "claude.exe");
  const out = runSetupFlow("claude", SETUP_CLIS, foundAt(agentPath));
  assert.equal(out.cli.id, "claude");
  assert.equal(out.cli.path, agentPath, "the named agent is looked up again after the Start");
  assert.deepEqual(out.setup, { announce: "http://127.0.0.1:9/s/signtok/", token: "handover-tok" });
  assert.deepEqual(
    box.calls().map((c) => c.argv),
    [
      ["open", "--workflow", "setup", "--for-cli", "claude"],
      ["wait", "--session", "setup-sid", "--seconds", "240"],
    ]
  );
});

test("launcher setup: the console is spawned without the six app-window variables", (t) => {
  const box = setupConsoleDir();
  t.after(box.cleanup);
  // Every one set on this process: none may reach the console child.
  setupEnv(t, box.dir, [START_CLAUDE], Object.fromEntries(APP_VARS.map((k) => [k, "live"])));
  const { runSetupFlow } = require(LAUNCHER);
  runSetupFlow(undefined, SETUP_CLIS, foundAt(path.join(box.dir, "claude.exe")));
  const calls = box.calls();
  assert.deepEqual(calls[0].argv, ["open", "--workflow", "setup"], "no --for-cli without a named agent");
  for (const call of calls) assert.deepEqual(call.appVars, [], `app vars leaked into the console's ${call.argv[0]}`);
});

test("launcher setup: a send that is not a Start and a still-waiting slice keep the wait going", (t) => {
  const box = setupConsoleDir();
  t.after(box.cleanup);
  setupEnv(t, box.dir, [
    { print: { session: [{ i: "q1", type: "answer", kind: "choice", k: "A" }] }, exit: 0 },
    { exit: 10 },
    START_CLAUDE,
  ]);
  const { runSetupFlow } = require(LAUNCHER);
  const out = runSetupFlow(undefined, SETUP_CLIS, foundAt(path.join(box.dir, "claude.exe")));
  assert.equal(out.cli.id, "claude");
  assert.equal(box.calls().filter((c) => c.argv[0] === "wait").length, 3, "exit 10 re-runs the wait, exit 0 without a Start keeps it");
});

test("launcher setup: cancel, a gone server and a Start for an agent that still cannot run all end as 127", (t) => {
  const { runSetupFlow } = require(LAUNCHER);
  const cases = [
    ["cancel", [{ exit: 30 }]],
    ["server gone", [{ exit: 20 }]],
    ["Start for an agent the re-lookup misses", [{ print: { session: [{ i: "__start", agent: "ghost-cli" }] }, exit: 0 }]],
  ];
  for (const [name, steps] of cases) {
    const box = setupConsoleDir();
    t.after(box.cleanup);
    setupEnv(t, box.dir, steps);
    const out = runSetupFlow(undefined, SETUP_CLIS, foundAt(path.join(box.dir, "claude.exe")));
    assert.deepEqual(out, { code: 127 }, name);
  }
});

test("launcher setup: an older console's open line still yields the announce address and token from the url", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-setup-console-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  // No setup block in the open output: sid and the /s/<token>/ url alone must do.
  fs.writeFileSync(
    path.join(dir, "console.mjs"),
    [
      'if (process.argv[2] === "open") {',
      '  console.log(JSON.stringify({ sid: "setup-sid", url: "http://127.0.0.1:9/s/signtok/" }));',
      '} else if (process.argv[2] === "wait") {',
      '  console.log(JSON.stringify({ session: [{ i: "__start", agent: "claude" }] }));',
      '}',
    ].join("\n")
  );
  setupEnv(t, dir, []);
  const out = require(LAUNCHER).runSetupFlow(undefined, SETUP_CLIS, foundAt("x"));
  assert.equal(out.cli.id, "claude");
  assert.deepEqual(out.setup, { announce: "http://127.0.0.1:9", token: "signtok" });
});

test("launcher setup: with no console.mjs anywhere, runSetupFlow returns null rather than guessing", (t) => {
  const launcherPath = require.resolve(LAUNCHER);
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-no-console-"));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  // Every place findConsoleMjs() looks is derived from the home or
  // PLAN2CODE_CONSOLE_DIR, so a fresh module under an empty home finds nothing.
  const keys = ["HOME", "USERPROFILE", "PLAN2CODE_CONSOLE_HOME", "PLAN2CODE_CONSOLE_DIR"];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  delete require.cache[launcherPath];
  try {
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    delete process.env.PLAN2CODE_CONSOLE_HOME;
    delete process.env.PLAN2CODE_CONSOLE_DIR;
    assert.equal(require(LAUNCHER).runSetupFlow("claude", SETUP_CLIS, foundAt("x")), null);
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    // Re-require with the real home so later tests see the host's own module.
    delete require.cache[launcherPath];
    require(LAUNCHER);
  }
});

test("launcher setup: a Start can name a custom agent; the launcher re-reads ~/.plan2code/agents.json", (t) => {
  const launcherPath = require.resolve(LAUNCHER);
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-setup-home-"));
  const box = setupConsoleDir();
  t.after(() => {
    fs.rmSync(home, { recursive: true, force: true });
    box.cleanup();
  });
  // USER_AGENTS_FILE is fixed at require time from the home, so the module needs
  // a fresh instance whose home is the scratch one.
  const keys = ["HOME", "USERPROFILE", "PLAN2CODE_CONSOLE_HOME"];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  delete require.cache[launcherPath];
  try {
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    process.env.PLAN2CODE_CONSOLE_HOME = path.join(home, ".plan2code", "console");
    const { runSetupFlow } = require(LAUNCHER);
    const agent = path.join(box.dir, "myagent.cmd");
    fs.writeFileSync(agent, "@rem stand-in\r\n");
    fs.mkdirSync(path.join(home, ".plan2code"), { recursive: true });
    fs.writeFileSync(
      path.join(home, ".plan2code", "agents.json"),
      JSON.stringify({ schema: 1, agents: [{ id: "myagent", name: "My Agent", command: agent, args: ["{prompt}"] }] })
    );
    setupEnv(t, box.dir, [{ print: { session: [{ i: "__start", agent: "myagent" }] }, exit: 0 }]);
    const out = runSetupFlow(undefined, [], null);
    assert.equal(out.cli.id, "myagent");
    assert.equal(out.cli.custom, true);
    assert.equal(out.cli.path, agent);
    assert.equal(out.cli.fullPath, true);
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    delete require.cache[launcherPath];
    require(LAUNCHER);
  }
});

test("launcher setup: with the app installed and no agent runnable, the app opens on the folder alone", (t) => {
  const box = sandbox([], { installed: "0.0.0" });
  t.after(box.cleanup);
  // npm's real global folder could hold a real agent; an empty prefix keeps "none runnable" certain.
  const display = process.platform === "linux" ? { DISPLAY: ":0" } : {};
  const result = box.run([], { PLAN2CODE_APP: box.appFile, npm_config_prefix: path.join(box.dir, "no-npm"), ...display });
  assert.equal(result.status, 0, result.stderr);
  const appArgs = box.appArgs();
  assert.ok(appArgs, "the stand-in app was never started");
  assert.equal(appArgs[0], "--project");
  assert.equal(fs.realpathSync(appArgs[1]), fs.realpathSync(box.dir));
  assert.deepEqual(appArgs.slice(2), [], "no --agent and no --model when none can run");
  assert.match(result.stdout, /Opened the Plan2Code app/);
});

test("launcher setup: no agent and no display keeps the old 127 and install steps", { skip: process.platform !== "linux" }, (t) => {
  const box = sandbox([], { installed: "0.0.0" });
  t.after(box.cleanup);
  const result = box.run([], { PLAN2CODE_APP: box.appFile, DISPLAY: "", WAYLAND_DISPLAY: "", npm_config_prefix: path.join(box.dir, "no-npm") });
  assert.equal(result.status, 127);
  assert.match(result.stderr, /none was found/);
  assert.equal(box.appExists(), false);
});
