#!/usr/bin/env node
// The live-run driver for the console wire measure. Spends model tokens, so it
// is run by hand and never from `npm test`.
//
//   node scripts/console-wire-runs/run.mjs [--models opus,haiku] [--runs 3] [--timeout 20] [--out <dir>]
//
// Each run copies the fixture to a fresh temp folder, starts headless Claude
// Code on `/plan2code --web` with the skills built under skills/, and starts
// answer.mjs against the session it opens. Run it from outside the desktop app,
// or let this script clear the app's variables, as it does for every run.
//
// `--setting-sources project` keeps the machine's own skills, hooks and memory
// out: a personal skill of the same name would otherwise win over the built one.
//
// Each run has `--permission-mode bypassPermissions`: a model-driven agent with
// unrestricted tools on this machine, working in a throwaway copy of the fixture.
//
// A run ends when the finish after the Pathfinder stop is up, or at --timeout.
// An agent that ends its turn on text with the session open stops the process:
// that is a silent slip the measure counts, so the run goes on the way a person
// would, by telling it to carry on.

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const FIXTURE = path.join(HERE, "fixture");
const CONSOLE_CLI = path.join(ROOT, "skills", "plan2code", "references", "web-console", "console.mjs");
const PROMPT = "/plan2code --web";
const NUDGE = "The console page is still open and waiting on you. Carry on with the session.";
const MAX_NUDGES = 5;
const AFTER_FINISH_MS = 30_000;

function parseArgs(argv) {
  const opts = { models: "opus,haiku", runs: "3", timeout: "20", out: "" };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, "");
    if (!Object.hasOwn(opts, key)) throw new Error(`unknown option ${argv[i]}`);
    opts[key] = argv[i + 1];
  }
  return opts;
}

// What would tie a run to the session it started from. Other CLAUDE_CODE_*
// variables stay: some carry the account or the provider (an OAuth token, Bedrock).
const SESSION_VARS = [
  "CLAUDECODE",
  "CLAUDE_PID",
  "CLAUDE_EFFORT",
  "CLAUDE_CODE_CHILD_SESSION",
  "CLAUDE_CODE_ENTRYPOINT",
  "CLAUDE_CODE_EXECPATH",
  "CLAUDE_CODE_MESSAGING_SOCKET",
  "CLAUDE_CODE_MESSAGING_TOKEN",
  "CLAUDE_CODE_SESSION_ATTENDED",
  "CLAUDE_CODE_SESSION_ID",
  "CLAUDE_CODE_SSE_PORT",
];

// Everything that would tie a run to the session or the app it started from.
function runEnv(home) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (SESSION_VARS.includes(key) || key.startsWith("PLAN2CODE_")) delete env[key];
  }
  return {
    ...env,
    PLAN2CODE_CONSOLE_HOME: home,
    PLAN2CODE_HANDOFFS_DIR: path.join(home, "handoffs"),
    PLAN2CODE_NOTEPADS_DIR: path.join(home, "notepads"),
    PLAN2CODE_NO_BROWSER: "1",
  };
}

function realTemp(prefix) {
  return fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
}

function makeProject() {
  const project = realTemp("p2c-wire-project-");
  fs.cpSync(FIXTURE, project, { recursive: true });
  fs.cpSync(path.join(ROOT, "skills"), path.join(project, ".claude", "skills"), { recursive: true });
  const init = spawnSync("git", ["init", "-q"], { cwd: project, encoding: "utf8" });
  if (init.status !== 0) throw new Error(`git init failed: ${init.stderr}`);
  return project;
}

function killTree(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else child.kill("SIGKILL");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function startClaude({ model, prompt, resume, project, env, streamFile }) {
  const args = ["-p", prompt, "--model", model, "--output-format", "stream-json", "--verbose", "--permission-mode", "bypassPermissions", "--setting-sources", "project"];
  if (resume) args.push("--resume", resume);
  const out = fs.openSync(streamFile, "a");
  const child = spawn("claude", args, { cwd: project, env, stdio: ["ignore", out, out], windowsHide: true });
  child.once("close", () => fs.closeSync(out));
  return child;
}

function exited(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) resolve();
    else child.once("close", () => resolve());
  });
}

function streamSessionIds(streamFile) {
  const ids = [];
  for (const line of fs.readFileSync(streamFile, "utf8").split(/\r?\n/)) {
    if (!line.includes('"session_id"')) continue;
    try {
      const id = JSON.parse(line).session_id;
      if (id && !ids.includes(id)) ids.push(id);
    } catch {}
  }
  return ids;
}

function transcriptPaths(ids) {
  const root = path.join(os.homedir(), ".claude", "projects");
  const found = [];
  for (const dir of fs.readdirSync(root)) {
    for (const id of ids) {
      const file = path.join(root, dir, `${id}.jsonl`);
      if (fs.existsSync(file)) found.push(file);
    }
  }
  return found;
}

function firstSession(home) {
  try {
    return fs.readdirSync(path.join(home, "sessions"))[0] || null;
  } catch {
    return null;
  }
}

function sessionState(home, sid) {
  try {
    return JSON.parse(fs.readFileSync(path.join(home, "sessions", sid, "state.json"), "utf8"));
  } catch {
    return null;
  }
}

async function oneRun({ model, n, minutes, outDir }) {
  const runDir = path.join(outDir, `${model.replace(/[^a-zA-Z0-9.-]/g, "-")}-${n}`);
  fs.mkdirSync(runDir, { recursive: true });
  const streamFile = path.join(runDir, "stream.ndjson");
  const answersFile = path.join(runDir, "answers.ndjson");
  const home = realTemp("p2c-wire-home-");
  const project = makeProject();
  const env = runEnv(home);
  const deadline = Date.now() + minutes * 60_000;
  const started = new Date().toISOString();

  let claude = startClaude({ model, prompt: PROMPT, project, env, streamFile });
  let claudeDone = false;
  let answer = null;
  let answerDone = false;
  let answerCode = null;
  let sid = null;
  let nudges = 0;
  let failure = null;
  claude.once("close", () => (claudeDone = true));

  while (Date.now() < deadline && !answerDone) {
    await sleep(500);
    if (!sid) {
      sid = firstSession(home);
      if (sid) {
        answer = spawn(process.execPath, [path.join(HERE, "answer.mjs"), "--session", sid, "--home", home, "--project", project, "--log", answersFile], {
          cwd: project,
          env,
          stdio: ["ignore", "ignore", fs.openSync(path.join(runDir, "answer.err"), "a")],
          windowsHide: true,
        });
        answer.once("close", (code) => {
          answerDone = true;
          answerCode = code;
        });
      }
    }
    if (claudeDone && !answerDone) {
      if (!sid || nudges >= MAX_NUDGES) {
        failure = sid ? "the agent kept ending its turn" : "the agent ended without opening a session";
        break;
      }
      const ids = streamSessionIds(streamFile);
      nudges++;
      claudeDone = false;
      claude = startClaude({ model, prompt: NUDGE, resume: ids[ids.length - 1], project, env, streamFile });
      claude.once("close", () => (claudeDone = true));
    }
  }

  const finished = answerDone && answerCode === 0;
  if (!finished && !failure) failure = answerDone ? `answer.mjs exited ${answerCode}` : "timed out";
  // The finish is up: leave the agent its `stop` before ending the process.
  if (finished) await Promise.race([exited(claude), sleep(AFTER_FINISH_MS)]);
  killTree(claude);
  killTree(answer);
  if (sid) spawnSync(process.execPath, [CONSOLE_CLI, "stop", "--session", sid], { cwd: project, env, stdio: "ignore" });

  const state = sid ? sessionState(home, sid) : null;
  const record = {
    model,
    run: n,
    finished,
    failure,
    nudges,
    started,
    ended: new Date().toISOString(),
    sid,
    finalWorkflow: state ? state.workflow : null,
    transcripts: transcriptPaths(streamSessionIds(streamFile)),
    project,
    home,
  };
  fs.writeFileSync(path.join(runDir, "run.json"), JSON.stringify(record, null, 2) + "\n");
  return record;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const outDir = opts.out ? path.resolve(opts.out) : realTemp("p2c-wire-runs-");
  const fromRoot = path.relative(ROOT, outDir);
  if (!fromRoot || (!fromRoot.startsWith("..") && !path.isAbsolute(fromRoot))) throw new Error("--out must be outside the repository");
  fs.mkdirSync(outDir, { recursive: true });
  if (!fs.existsSync(CONSOLE_CLI)) throw new Error("skills/ is not built: run node install.js --build-skills first");
  const runs = Number(opts.runs);
  const results = [];
  for (const model of opts.models.split(",")) {
    for (let n = 1; n <= runs; n++) {
      const record = await oneRun({ model, n, minutes: Number(opts.timeout), outDir });
      results.push(record);
      process.stdout.write(`${model} run ${n}: ${record.finished ? "finished" : `FAILED (${record.failure})`}, ${record.nudges} nudges\n`);
    }
  }
  const finished = results.filter((r) => r.finished).length;
  console.log(JSON.stringify({ out: outDir, runs: results.length, finished }));
  if (finished !== results.length) process.exitCode = 1;
}

main().catch((e) => {
  process.stderr.write(`run: ${e.message}\n`);
  process.exitCode = 1;
});
