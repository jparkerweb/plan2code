#!/usr/bin/env node
// run-check.mjs: run one check command with a timeout and classify the result.
//
// Agent shells differ in their timeouts, none kill a Windows process tree, and
// telling "the command is not there" from "the command failed" needs the exit
// code and the spawn error. So one check runs here: passed, failed, timeout or
// not-started, with the output's last lines. The full output goes only to
// --log; nothing else is written.

import fs from "node:fs";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { EXIT, fail, out, parseArgs, run, isDir } from "./common.mjs";

const USAGE = `
run-check.mjs: run one command and classify its outcome. JSON on stdout.

  node run-check.mjs --cmd <command> [--cwd <dir>] [--timeout <seconds>] [--log <file>]
      Runs the command through the shell in --cwd (relative to the current
      folder; default "."), stops it and every process it started after
      --timeout seconds (default 600, at most 86400), and prints
      { ok, cmd, cwd, outcome, exit, signal, seconds, tail, log }.
      outcome   passed (exit 0) · failed (any other exit) · timeout ·
                not-started (with reason: spawn-error, command-not-found,
                cwd-missing, log-unwritable)
      tail      the output's last 60 lines, stdout and stderr interleaved,
                each cut at 400 characters
      log       the file holding the full output, when --log was given

Exit: 0 whenever an outcome was classified · 2 bad arguments.
`;

// One day: a longer timer overflows Node's 32-bit limit and fires at once.
const MAX_TIMEOUT = 86400;
const TAIL_LINES = 60;
const LINE_CAP = 400;
const NOT_RECOGNIZED = /is not recognized as an internal or external command/;

function killTree(child) {
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    } catch {}
  } else {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {}
  }
}

function tailOf(text) {
  const lines = text.split(/\r?\n/);
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.slice(-TAIL_LINES).map((l) => (l.length > LINE_CAP ? l.slice(0, LINE_CAP) : l));
}

export function runCheck({ cmd, cwd, timeout, log }) {
  const shownCwd = cwd || ".";
  const abs = path.resolve(shownCwd);
  const logFile = log ? path.resolve(log) : null;
  const base = { ok: true, cmd, cwd: shownCwd };
  if (!isDir(abs)) {
    return Promise.resolve({ ...base, outcome: "not-started", reason: "cwd-missing", exit: null, signal: null, seconds: 0, tail: [], log: null });
  }
  return new Promise((resolve) => {
    const started = Date.now();
    let output = "";
    let stderrHead = "";
    let spawnError = null;
    let timedOut = false;
    let done = false;
    let logStream = null;
    let logFailed = false;
    if (logFile) {
      // Opened before the run, so a log that cannot be written stops the
      // check up front instead of crashing it halfway with no JSON.
      let fd;
      try {
        fs.mkdirSync(path.dirname(logFile), { recursive: true });
        fd = fs.openSync(logFile, "w");
      } catch {
        resolve({ ...base, outcome: "not-started", reason: "log-unwritable", exit: null, signal: null, seconds: 0, tail: [], log: null });
        return;
      }
      logStream = fs.createWriteStream(null, { fd });
      logStream.on("error", () => {
        logFailed = true;
      });
    }
    const child = spawn(cmd, { cwd: abs, shell: true, windowsHide: true, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
    const take = (chunk, isErr) => {
      const s = chunk.toString("utf8");
      output += s;
      // Keep only what the tail can still need, plus the start of stderr for
      // the Windows "not recognized" check.
      if (output.length > 1_000_000) output = output.slice(-TAIL_LINES * LINE_CAP * 4);
      if (isErr && stderrHead.length < 65536) stderrHead += s;
      if (logStream && !logFailed) logStream.write(chunk);
    };
    child.stdout.on("data", (c) => take(c, false));
    child.stderr.on("data", (c) => take(c, true));

    const finish = (code, signal) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearTimeout(grace);
      // A process the kill missed must not keep this one alive through its pipes.
      child.stdout.destroy();
      child.stderr.destroy();
      child.unref();
      const seconds = Math.round((Date.now() - started) / 100) / 10;
      let outcome;
      let reason;
      if (spawnError) [outcome, reason] = ["not-started", "spawn-error"];
      else if (timedOut) outcome = "timeout";
      else if (code === 0) outcome = "passed";
      else if (code === 127 || code === 9009 || NOT_RECOGNIZED.test(stderrHead)) [outcome, reason] = ["not-started", "command-not-found"];
      else outcome = "failed";
      const result = { ...base, outcome, ...(reason ? { reason } : {}), exit: typeof code === "number" ? code : null, signal: signal || null, seconds, tail: tailOf(output), log: logFailed ? null : logFile };
      // An errored stream never finishes, so it is not waited on.
      if (logStream && !logFailed) logStream.end(() => resolve(result));
      else resolve(result);
    };

    let grace = null;
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
      // Wait for close, but never more than 5 seconds after the kill.
      grace = setTimeout(() => finish(null, "SIGKILL"), 5000);
    }, timeout * 1000);

    child.on("error", (err) => {
      spawnError = err;
      // close may not follow a spawn error; give it a moment, then report.
      setTimeout(() => finish(null, null), 200);
    });
    child.on("close", (code, signal) => finish(code, signal));
  });
}

async function main(argv) {
  const args = parseArgs(argv, { values: ["cmd", "cwd", "timeout", "log"] });
  if (args._.length) fail(EXIT.USAGE, "unexpected-argument", `Unexpected argument "${args._[0]}".`, "Pass the command with --cmd \"<command>\".");
  if (!args.cmd || !args.cmd.trim()) fail(EXIT.USAGE, "missing-cmd", "run-check needs --cmd <command>.", "Run with --help for usage.");
  const timeout = args.timeout === undefined ? 600 : Number(args.timeout);
  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > MAX_TIMEOUT) {
    fail(EXIT.USAGE, "bad-timeout", `--timeout must be a number of seconds above 0 and at most ${MAX_TIMEOUT}, not "${args.timeout}".`, "Pass --timeout <seconds>.");
  }
  out(await runCheck({ cmd: args.cmd, cwd: args.cwd, timeout, log: args.log }));
}

// Run as a script; imported, do nothing.
const isMain = (() => {
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (isMain) run(USAGE, main);
