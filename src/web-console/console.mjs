#!/usr/bin/env node
// Plan2Code Web Console - the CLI the agent drives.
//
//   open    create or resume a session, publish a payload, start the server, print the URL
//   post    publish a new payload (an update) to a running session
//   wait    block for a bounded slice, then report. Exit code says what happened.
//   chat    collect Quick question messages right now, never waiting
//   keep    copy a cited note attachment into specs/<idea>/attachments/
//   status  list sessions, or show one
//   stop    shut a session's server down
//
// This file is the command table and what every command shares (the parsed
// flags, print, die and the session lookups). The commands live beside it:
// cmd-open.mjs, cmd-post-wait.mjs (post and wait, which post --wait runs),
// cmd-chat.mjs, cmd-help.mjs, and cmd-small.mjs for the rest.
//
// The design point: the SERVER is long-lived and detached; the WAITER is a short
// foreground command the agent re-invokes. A twenty-minute human session then
// never has to live inside a single tool call, and nothing the harness does to
// background tasks can destroy the human's work.
//
// Exit codes from `wait`:
//   0   done. stdout is the result JSON.
//   10  still waiting. stdout is a one-line progress summary. Call wait again.
//   20  the server is gone. Run `open --resume <sid>` and re-share the URL.
//   30  the person pressed Cancel.

import fs from "node:fs";
import path from "node:path";

import { parseArgs, readJson } from "./files.mjs";
import { projectRoot, sessionDir } from "./sessions.mjs";
import { cmdOpen, useCli as useOpen } from "./cmd-open.mjs";
import { cmdPost, cmdWait, useCli as usePostWait } from "./cmd-post-wait.mjs";
import { cmdChat, useCli as useChat } from "./cmd-chat.mjs";
import { cmdHelp, useCli as useHelp } from "./cmd-help.mjs";
import {
  cmdDeleteHandoff,
  cmdDeleteSpec,
  cmdForget,
  cmdHandoff,
  cmdKeep,
  cmdStatus,
  cmdStop,
  useCli as useSmall,
} from "./cmd-small.mjs";

function print(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function die(msg, code = 1) {
  process.stderr.write("console: " + msg + "\n");
  process.exit(code);
}

const argv = process.argv.slice(2);
const cmd = argv[0];
const args = parseArgs(argv.slice(1));

/* ---------------------------------------------------------------- utils */

function mustSession() {
  const raw = args.session || args.sid;
  if (!raw) die("--session <dir or id> is required", 2);
  const dir = fs.existsSync(raw) ? path.resolve(raw) : sessionDir(path.basename(raw));
  if (!fs.existsSync(dir)) die(`no session at ${dir}`, 1);
  return dir;
}

// The project a session belongs to, from its own state: a command run from
// another folder (an agent whose shell moved) still finds the session's
// server, rather than reporting it gone and starting a second one.
function sessionProject(dir) {
  const state = readJson(path.join(dir, "state.json"));
  return (state && typeof state.project === "string" && state.project) || projectRoot();
}

/* ------------------------------------------------------------- dispatch */

const COMMANDS = {
  open: cmdOpen,
  post: cmdPost,
  wait: cmdWait,
  chat: cmdChat,
  keep: cmdKeep,
  forget: cmdForget,
  "delete-spec": cmdDeleteSpec,
  handoff: cmdHandoff,
  "delete-handoff": cmdDeleteHandoff,
  status: cmdStatus,
  stop: cmdStop,
  help: cmdHelp,
};

// Say which Node is too old, rather than dying later inside a health check with
// "fetch is not defined". Whatever agent is driving this has to be able to read
// the failure, tell the person in one line, and carry on in the terminal.
const nodeMajor = Number.parseInt(process.versions.node, 10);
if (Number.isFinite(nodeMajor) && nodeMajor < 18) {
  process.stderr.write(
    `console: needs Node 18 or newer, found ${process.versions.node}. ` +
      `Say so in one line and carry on in the terminal.\n`
  );
  process.exit(2);
}

if (!cmd || !Object.hasOwn(COMMANDS, cmd)) {
  process.stderr.write(
    "console: usage: console.mjs <open|post|wait|chat|keep|forget|delete-spec|handoff|delete-handoff|status|stop|help> [--session <id>] [--file <patch.json>] [--seconds N]\n"
  );
  process.exit(2);
}

// A flag given with no value parses as `true`, and a boolean handed on as a
// path or a name crashes somewhere deep (path.basename(true) throws). Every
// flag that takes a value is checked once, here, and refused as bad usage.
const VALUE_FLAGS = ["session", "sid", "resume", "file", "spec", "title", "workflow", "skill", "handoff", "upload", "name", "from", "seconds", "limit", "idle-ms"];
for (const flag of VALUE_FLAGS) {
  if (flag in args && typeof args[flag] !== "string") die(`--${flag} needs a value`, 2);
}

// Every command file gets the same pieces before any of them runs.
const cli = { args, print, die, mustSession, sessionProject };
for (const use of [useOpen, usePostWait, useChat, useHelp, useSmall]) use(cli);

await COMMANDS[cmd]();
